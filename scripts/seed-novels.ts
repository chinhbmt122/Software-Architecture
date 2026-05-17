/**
 * Seed script: crawls metruyencv.com and inserts novels + chapters.
 * Falls back to a built-in static dataset if crawling fails.
 *
 * Usage:
 *   pnpm db:seed            ← try crawl, fall back to static
 *   pnpm db:seed --static   ← skip crawl, use static data only
 */

// tsx injects .env.local automatically; config() here is a safety net.
import { config } from "dotenv"
config({ path: ".env.local" })

import * as https from "node:https"
import * as http from "node:http"
import * as zlib from "node:zlib"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import { load } from "cheerio"
import slugify from "slugify"

import { novels, chapters, genres, novelGenres } from "../src/db/schema/content"
import { users } from "../src/db/schema/auth"

const db = drizzle(neon(process.env.DATABASE_URL!))
const STATIC_MODE = process.argv.includes("--static")
const RESEED_MODE = process.argv.includes("--reseed")
const NOVELS_TARGET = 15
const CHAPTERS_PER_NOVEL = 12
const DELAY_MS = 900

// ── HTTP helper (uses node:https to bypass fetch TLS issues on Windows) ───────

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
}

function fetchHtml(url: string, hops = 0): Promise<string | null> {
  if (hops > 5) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url)
      const lib = parsed.protocol === "https:" ? https : http
      const req = lib.get(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers: HEADERS, rejectUnauthorized: false },
        (res) => {
          // follow redirects
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume()
            const next = res.headers.location.startsWith("http")
              ? res.headers.location
              : `${parsed.protocol}//${parsed.host}${res.headers.location}`
            resolve(fetchHtml(next, hops + 1))
            return
          }
          if (res.statusCode !== 200) { res.resume(); resolve(null); return }

          // decompress
          const enc = res.headers["content-encoding"]
          const stream =
            enc === "gzip" ? res.pipe(zlib.createGunzip())
            : enc === "deflate" ? res.pipe(zlib.createInflate())
            : enc === "br" ? res.pipe(zlib.createBrotliDecompress())
            : res

          const chunks: Buffer[] = []
          stream.on("data", (c: Buffer) => chunks.push(c))
          stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
          stream.on("error", () => resolve(null))
        },
      )
      req.on("error", (e) => { console.log(`    ↳ ${e.message}`); resolve(null) })
      req.setTimeout(12000, () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// ── metruyencv.com scraper ────────────────────────────────────────────────────

const BASE = "https://metruyencv.com"

async function getNovelSlugs(): Promise<string[]> {
  const html = await fetchHtml(`${BASE}/truyen?sort=1`) // sort=1 = views
  if (!html) return []
  const $ = load(html)
  const slugs: string[] = []
  $("a[href*='/truyen/']").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const m = href.match(/\/truyen\/([^/?#]+)/)
    if (m?.[1] && !["truyen"].includes(m[1])) slugs.push(m[1])
  })
  return [...new Set(slugs)]
}

interface NovelMeta { title: string; synopsis: string; coverUrl: string | null; genreNames: string[]; status: "ONGOING" | "COMPLETED" | "HIATUS" }

async function getNovelMeta(slug: string): Promise<NovelMeta | null> {
  const html = await fetchHtml(`${BASE}/truyen/${slug}`)
  if (!html) return null
  const $ = load(html)
  const title = $("h1").first().text().trim() || $(".truyen-title").text().trim()
  if (!title) return null
  const synopsis = $(".content-novel-detail-description, .description, [class*='description']").first().text().trim()
  const coverUrl = $("img[class*='cover'], img[class*='thumb'], .book img").attr("src") ?? null
  const genreNames: string[] = []
  $("a[href*='the-loai'], a[href*='genre'], a[itemprop='genre']").each((_, el) => {
    const g = $(el).text().trim(); if (g && g.length < 40) genreNames.push(g)
  })
  const statusText = $("body").text()
  const status: NovelMeta["status"] =
    statusText.includes("Hoàn thành") || statusText.includes("Complete") ? "COMPLETED"
    : statusText.includes("Tạm dừng") ? "HIATUS" : "ONGOING"
  return { title, synopsis, coverUrl, genreNames: genreNames.slice(0, 5), status }
}

async function getChapterNums(slug: string): Promise<number[]> {
  const html = await fetchHtml(`${BASE}/truyen/${slug}`)
  if (!html) return []
  const $ = load(html)
  const nums: number[] = []
  $("a[href*='/chuong-']").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const m = href.match(/chuong-(\d+)/)
    if (m) nums.push(Number(m[1]))
  })
  return [...new Set(nums)].sort((a, b) => a - b)
}

async function getChapter(novelSlug: string, chNum: number): Promise<{ title: string; content: string; wordCount: number } | null> {
  const html = await fetchHtml(`${BASE}/truyen/${novelSlug}/chuong-${chNum}`)
  if (!html) return null
  const $ = load(html)

  let rawTitle = $(".chapter-title, h2, h1").first().text().trim()
  rawTitle = rawTitle.replace(/^Chương\s+\d+\s*[:\-–]\s*/i, "").trim()
  const title = rawTitle || `Chương ${chNum}`

  const contentEl = $(".content-chapter, #chapter-content, [class*='chapter-content'], [id*='chapter']")
  contentEl.find("script, .ads, [id^='adv'], .hidden").remove()

  const paras: string[] = []
  contentEl.find("p").each((_, el) => {
    const t = $(el).text().trim(); if (t.length > 20) paras.push(t)
  })
  const content = paras.length > 0 ? paras.join("\n\n") : contentEl.text().trim()
  if (!content || content.length < 80) return null

  return { title, content: content.slice(0, 30000), wordCount: content.split(/\s+/).filter(Boolean).length }
}

// ── Static fallback dataset ───────────────────────────────────────────────────
// Each paragraph is ~200 words; 8 paragraphs chosen per chapter ≈ 1600 words.

const PARA = {
  xh: [
    "Tại Đấu Khí Đại Lục, tu luyện đấu khí là nền tảng của mọi sức mạnh, là ranh giới duy nhất phân biệt kẻ đứng trên đỉnh với người nằm dưới đáy. Bầu trời tím thẫm trải dài vô tận phía trên thành trấn nhỏ bé, nơi mà số phận của một thiếu niên đang chuẩn bị bước vào bước ngoặt không thể đảo ngược. Gió đêm mang theo mùi thảo dược từ khu chợ phía Đông thổi qua, thoáng lạnh trên làn da người trẻ đang đứng một mình trên mái nhà. Xung quanh, những ngọn đèn dầu leo lét trong các căn nhà thấp thoáng qua vách gỗ mỏng, tiếng cười nói nhỏ nhẹ từ đâu đó vọng lại, tất cả tạo nên một khung cảnh yên bình mà cậu biết mình không thuộc về. Cậu chưa bao giờ thuộc về sự yên bình.",
    "\"Không có đấu khí, ngươi chỉ là đồ vô dụng.\" Những lời ấy vang vọng mãi trong đầu cậu, sắc bén như lưỡi dao được mài giũa suốt ba năm không nghỉ. Chúng đến từ người thầy đầu tiên từ chối nhận cậu làm đồ đệ, từ gã thiếu niên cùng lứa đã nhổ nước bọt trước mặt cậu ở giữa quảng trường, từ người anh họ dùng cậu như trò cười trong các bữa tiệc gia tộc. Những lời ấy tích lũy từng ngày, từng tháng, từng năm, xếp thành một bức tường vô hình bao quanh cậu. Nhưng ánh mắt cậu không hề mờ đục – ngược lại, trong đó bùng cháy một ngọn lửa không dễ dập tắt, thứ lửa chỉ có thể nuôi dưỡng bởi sự khinh thường chứ không thể bị nó dập tắt. Thiên tài? Phế tài? Cậu không quan tâm đến những danh hiệu rỗng tuếch ấy.",
    "Từ lúc bản mạch bị phong ấn từ năm bảy tuổi, cậu đã quen với những cái nhìn thương hại lẫn khinh thường đến mức chúng không còn đủ sức tổn thương nữa. Cậu học cách làm mình trở nên vô hình trong các buổi tập luyện của gia tộc, học cách nói những gì người ta muốn nghe mà trong lòng vẫn giữ riêng con đường của mình. Không phải vì cậu sợ – mà vì cậu hiểu rằng kẻ mạnh không cần phải chứng tỏ bản thân với những kẻ yếu hơn. Chứng tỏ bằng kết quả, không bằng lời nói – đó là triết lý cậu tự rút ra trong những đêm dài ngồi một mình với quyển sách cũ kỹ không tên. Đêm nay khác. Đêm nay, dưới ánh sao vằng vặc và bầu trời rộng lớn, cậu tìm thấy thứ mà người ta tưởng không còn tồn tại nữa – hy vọng.",
    "Ba năm là khoảng thời gian đủ để mài giũa một ý chí, hoặc nghiền nát nó thành bụi mịn. Người ta thường nghĩ rằng không có đấu khí thì không thể tu luyện, nhưng người ta đã nhầm – họ chỉ không biết rằng tồn tại những con đường khác, những con đường mà ngay cả những bậc tôn giả cũng đã bỏ quên từ lâu. Với cậu, ba năm đó là ba năm tự học trong im lặng, lặng lẽ quan sát những gì mà kẻ khác bỏ qua, ghi nhớ từng chi tiết nhỏ nhặt trong từng buổi tập luyện của người khác. Cậu học từ bóng tối, học từ những cuốn sách cũ mà không ai thèm đọc, học từ chính những thất bại lặp đi lặp lại của bản thân. Mỗi buổi sáng bắt đầu trước khi mặt trời mọc, mỗi đêm kết thúc sau khi sao đã lên đầy trời.",
    "Sức mạnh không đến từ bẩm sinh, cậu tự nhủ trong khi những giọt mồ hôi lăn dài xuống trán, rơi thành từng giọt tròn trên nền đất khô. Nó đến từ mồ hôi, từ máu, và đôi khi từ cả nước mắt. Nhưng nước mắt là thứ cậu đã không còn rơi từ lâu rồi – không phải vì cậu không còn đau, mà vì cậu đã học cách chuyển hóa nỗi đau thành nhiên liệu cho ý chí. Bàn tay cậu chai sạn, đầu gối xây xát, lưng đau như muốn gãy sau mỗi buổi luyện tập kéo dài đến tận nửa đêm. Nhưng mỗi sáng cậu vẫn dậy, vẫn tiếp tục, vẫn bước tiếp trên con đường mà chỉ có mình cậu nhìn thấy.",
    "Chiến đấu không chỉ là chuyện của sức mạnh thể xác hay lượng đấu khí dự trữ trong đan điền. Đó là câu chuyện về chiến thuật, về kinh nghiệm, về khả năng đọc đối thủ trong từng khoảnh khắc. Cậu học điều này không phải từ một vị thầy tài giỏi hay từ một môn phái nổi tiếng – cậu học từ việc quan sát hàng trăm trận đấu, từ việc ghi nhớ từng di chuyển, từng kỹ năng, từng điểm yếu mà người thua bộc lộ trước khi ngã xuống. Kiến thức là thứ không ai có thể lấy đi được, và đó chính là tài sản quý giá nhất mà cậu tích lũy trong những năm tháng bị gọi là phế tài.",
    "Đêm trôi qua chậm chạp, ngôi sao từng ngôi tắt dần khi bầu trời phía Đông bắt đầu ửng hồng. Cậu nhìn xuống bàn tay mình, những ngón tay thô ráp nhưng ổn định, rồi ngước nhìn lên khoảng trời đang chuyển màu từ tím sang cam. Ngày mới lại bắt đầu. Và với cậu, mỗi ngày mới là một cơ hội để tiến thêm một bước, dù nhỏ bé đến đâu, trên con đường mà người ta nói là không thể đi. Cậu mỉm cười – không phải nụ cười của kẻ hài lòng, mà là nụ cười của người biết rằng cuộc hành trình mới chỉ bắt đầu.",
    "Trên con đường tu luyện, không có phím tắt nào. Cậu đã học được điều đó rất sớm, sớm hơn nhiều so với những người đồng lứa đang tự mãn với thiên phú của mình. Mỗi cảnh giới là một bức tường, và để phá vỡ nó không chỉ cần sức mạnh mà còn cần sự thấu hiểu sâu sắc về bản chất của đấu khí, về cách năng lượng lưu chuyển trong cơ thể, về những bí mật mà các bậc tiền bối đã để lại trong các điển tịch cổ. Cậu đọc tất cả những gì có thể đọc, thực hành tất cả những gì có thể thực hành, và khi thất bại, cậu đứng dậy và thử lại.",
  ],
  romance: [
    "Mùa xuân năm ấy, khi hoa anh đào rụng đầy sân như tuyết trắng, nàng lần đầu gặp hắn trong một buổi chiều tà mà nắng vàng trải dài như dải lụa trên con đường đất đỏ. Hắn đứng đó như thể đã đứng đó từ rất lâu, từ trước khi nàng biết tên hắn, từ trước khi nàng hiểu rằng một số khoảnh khắc trong đời có khả năng thay đổi tất cả những gì đến sau nó. Ánh sáng buổi chiều tô một viền vàng lên vai hắn, trên mái tóc đen và gương mặt nhìn nghiêng lạnh lùng đến mức nàng không dám nhìn thẳng. Nàng đã đứng đó một lúc trước khi hắn quay lại, và khi ánh mắt hai người chạm nhau, nàng cảm thấy có gì đó dịch chuyển trong lồng ngực – một cảm giác mà nàng chưa từng có tên gọi.",
    "\"Ngươi đang nhìn gì vậy?\" Giọng hắn bình thản đến lạ, không giống bất kỳ ai nàng từng gặp – không có sự trêu chọc, không có sự tò mò rõ ràng, chỉ là một câu hỏi đơn thuần như người ta hỏi về thời tiết. Nàng không trả lời ngay, chỉ nhìn hắn bằng đôi mắt mà người ta hay bảo là quá thẳng thắn cho một thiếu nữ. Khoảng cách giữa hai người chỉ vài bước chân, nhưng cảm giác như cả một bầu trời đêm đang nằm ở giữa, đầy những thứ chưa được nói ra. Cuối cùng nàng chỉ lắc đầu và bước đi, không nhìn lại, dù từng bước đi đều cảm thấy nặng nề một cách kỳ lạ.",
    "Có những điều chỉ hiểu khi đã qua đi. Nàng nhớ lại buổi tối đó nhiều năm sau, khi ngồi bên cửa sổ nghe mưa nhẹ gõ trên mái ngói và tiếng đàn ai đó kéo ở xa vọng lại qua màn đêm. Lúc ấy nàng chưa biết rằng khoảnh khắc đó sẽ theo nàng mãi mãi, sẽ trở thành điểm neo mà ký ức luôn quay về mỗi khi mùa thu bắt đầu và gió lạnh thổi qua những con phố quen thuộc. Người ta nói rằng những điều quan trọng nhất trong cuộc đời thường đến mà không có cảnh báo, không có nhạc nền, không có sự chuẩn bị. Và nàng tin điều đó là thật.",
    "Tình cảm là thứ kỳ lạ nhất trên đời, nàng nghĩ, trong khi ngồi nhìn những chiếc lá vàng bay qua ô cửa sổ nhỏ của thư phòng. Không ai chọn được nó, cũng không ai dễ dàng bỏ được nó đi khi nó đã bén rễ. Nàng hiểu điều này không phải từ sách vở hay từ những câu chuyện của người khác, mà từ những đêm dài không ngủ được, từ những buổi sáng thức dậy với cảm giác ngực trống rỗng không rõ lý do, từ việc bắt gặp bản thân luôn để ý xem hắn có ở gần không mỗi khi bước vào một căn phòng. Đó là những dấu hiệu nhỏ, nhưng tích lũy lại, chúng nói lên điều mà lý trí nàng cố tình không chịu thừa nhận.",
    "Hắn không phải kiểu người nói những lời hoa mỹ hay tặng hoa vào những dịp đặc biệt. Nhưng đôi khi, một câu nói bình thường từ đúng người vào đúng lúc lại có sức nặng hơn ngàn lời thề nguyền được thốt ra một cách trịnh trọng. Hắn nhớ rằng nàng không thích mùi hoa nhài. Hắn biết rằng nàng thường uống trà đặc vào buổi sáng chứ không phải trà nhạt. Hắn để ý những thứ nhỏ nhặt mà chính nàng đôi khi cũng quên mất, và nàng học được điều đó từ hắn – rằng tình cảm thực sự thể hiện qua sự chú ý, không phải qua những cử chỉ hoành tráng.",
    "Buổi chiều hôm ấy, khi ánh nắng cuối ngày kéo những cái bóng dài trên sân gạch, hai người ngồi im lặng bên nhau mà không cảm thấy cần phải lấp đầy khoảng lặng bằng những câu chuyện không đâu. Đó là thứ nàng luôn tìm kiếm mà không biết mình đang tìm – sự im lặng dễ chịu bên cạnh một người, loại im lặng không cần được cứu vớt hay bao biện. Hắn nhấm một ngụm trà, nhìn ra khoảng sân, và nàng nhìn hắn, và trong khoảnh khắc đó tất cả mọi thứ vừa đủ và vừa tốt như thể nó chưa bao giờ có thể khác đi.",
    "Sự thật là nàng đã biết từ rất lâu rồi, sớm hơn nàng chịu thừa nhận với bản thân. Nó hiển hiện trong từng lần nàng cố ý đi con đường dài hơn để có thể đi qua chỗ hắn thường đứng, trong từng lần nàng mỉm cười vô cớ khi đọc lại một câu nói bình thường của hắn, trong từng lần nàng cảm thấy ngày dài hơn vào những hôm hắn không có mặt. Tình cảm không cần phải được đặt tên để tồn tại. Đôi khi nó tồn tại chính xác vì chưa được đặt tên.",
    "Và rồi đến một buổi tối mà nàng sẽ nhớ mãi, khi mưa bắt đầu rơi nhẹ trên mái hiên và tiếng sấm xa xa vọng lại như lời nhắc nhở rằng cơn bão đang đến. Hắn đứng trước mặt nàng, ánh mắt bình thản như mọi khi nhưng có điều gì đó trong đó nàng chưa từng nhìn thấy trước đây – một sự cởi mở nhỏ bé, như cánh cửa vừa hé ra một kẽ nhỏ sau thời gian dài im lặng. Nàng chờ. Và lần đầu tiên trong nhiều tháng, hắn nói điều mà cả hai đều biết nhưng chưa ai dám thốt ra thành lời.",
  ],
  system: [
    "Ting! Một âm thanh trong vắt vang lên ngay giữa tâm trí, kéo anh ra khỏi giấc ngủ nặng nề sau ca đêm kéo dài mười hai tiếng liên tục. Màn hình xanh phát sáng ngay trước mắt – không phải màn hình điện thoại, không phải màn hình máy tính, mà là một thứ gì đó ngoài không khí, rõ ràng và thực như ánh đèn neon trên phố khuya. Những dòng chữ trắng chạy nhanh đến mức anh chớp mắt không theo kịp, nhảy nhảy như dòng code debug trên terminal, nhưng bằng tiếng Việt, và có cả tên anh ở góc trên bên phải. Anh ngồi thẳng dậy. Tim đập mạnh. \"Hệ Thống Tiến Hóa đã kích hoạt thành công. Chào mừng Người Được Chọn số 00247.\"",
    "\"Mình đang mơ hay tỉnh?\" Câu hỏi đó anh hỏi to thành tiếng, không cần biết có ai nghe hay không. Anh nhéo mạnh vào cánh tay, cái đau rõ ràng và sắc nét khiến anh rụt tay lại. Tỉnh. Hoàn toàn tỉnh. Anh nhìn quanh căn phòng trọ mười tám mét vuông quen thuộc – bàn học nhỏ đầy sách vở chưa dọn, đống tài liệu nằm chênh vênh góc tường, chiếc quạt cũ cánh số ba kêu xè xè như sắp chết, bức tường bong sơn loang lổ như bản đồ thế giới. Không có gì thay đổi cả, ngoại trừ cái màn hình xanh trong suốt vẫn đang trôi nổi trước mặt anh, chờ đợi, kiên nhẫn.",
    "[Cấp độ: 1] [Điểm EXP: 0/100] [STR: 8] [AGI: 7] [INT: 12] [VIT: 9]\n\nNhiệm vụ hàng ngày: Hoàn thành 100 cái đẩy (0/100). Phần thưởng: +3 STR, +50 EXP.\n\nAnh đọc đi đọc lại ba lần, gõ ngón tay vào cạnh bàn theo nhịp quen thuộc của thói quen tư duy. Sau đó anh gấp máy tính lại, đứng dậy, đặt tay xuống sàn nhà lạnh và bắt đầu đếm. Một. Hai. Ba. Khi đến cái thứ hai mươi, cánh tay bắt đầu run. Khi đến cái thứ năm mươi, mồ hôi đã thấm ướt áo. Nhưng anh không dừng lại. Khi số đếm chạm một trăm, màn hình xanh nháy sáng và dòng chữ mới hiện ra: [Nhiệm vụ hoàn thành. +3 STR. +50 EXP.]",
    "Một tháng sau ngày đó, anh là người khác hoàn toàn – không phải theo nghĩa anh có sức mạnh siêu nhiên hay kỹ năng phi thường, mà theo nghĩa anh lần đầu tiên trong hai mươi bảy năm cuộc đời thực sự cố gắng một cách có hệ thống. Mỗi nhiệm vụ, dù nhỏ nhặt đến đâu, đều được anh thực hiện đầy đủ. Mỗi điểm EXP, dù ít ỏi đến đâu, đều được anh tích lũy cẩn thận. Không có ngày nào anh bỏ qua nhiệm vụ hàng ngày, dù trời mưa, dù người mệt, dù công việc tối mắt tối mũi. Kết quả không đến ngay lập tức – không có gì tốt thật sự đến ngay lập tức – nhưng sau ba mươi ngày, anh nhìn lại và thấy khoảng cách giữa người anh bây giờ và người anh một tháng trước.",
    "Kẻ địch đầu tiên xuất hiện vào một tối thứ Sáu cuối tháng, khi anh đang trên đường về nhà qua con hẻm tắt thường dùng. Màn hình hệ thống đột ngột bật sáng với màu đỏ cảnh báo, chữ lớn nhấp nháy: [Mục tiêu đã được xác định. Tên: Nguyễn Văn T. Đe dọa: Trung bình. Khuyến nghị: Né tránh hoặc vô hiệu hóa.] Anh không có thời gian để đọc hết trước khi một bàn tay chộp lấy vai anh từ phía sau. Nhưng điều kỳ lạ là anh không hoảng. Hệ thống đã luyện cho anh phản xạ mà trước đây anh không có – anh xoay người, đưa cánh tay lên chặn, và bước sang một bên trong một động tác liên hoàn mà anh đã lặp đi lặp lại hàng nghìn lần trong tháng vừa qua.",
    "Bí mật của hệ thống không phải là nó cho anh sức mạnh – mà là nó cho anh định hướng. Trong hai mươi bảy năm, anh đã sống không có mục tiêu rõ ràng, trôi theo dòng chảy của những kỳ vọng người khác đặt lên anh, học những thứ người ta bảo phải học, làm những công việc người ta bảo nên làm. Hệ thống, với tất cả sự lạnh lùng và máy móc của nó, lại là thứ đầu tiên hỏi anh: ngươi muốn gì? Không phải cha mẹ muốn gì, không phải xã hội muốn gì – ngươi muốn gì? Và anh phải ngồi lại, lần đầu tiên trong đời, để thực sự suy nghĩ về câu trả lời.",
    "Nâng cấp không chỉ là những con số tăng lên trên bảng chỉ số. Nó là cảm giác buổi sáng thức dậy mà không còn mệt mỏi như trước. Là việc leo năm tầng cầu thang mà không thở dốc. Là khả năng ngồi tập trung làm việc bốn tiếng liên tục mà không cần cà phê. Những thay đổi nhỏ tích lũy thành những thay đổi lớn theo cách mà anh chỉ nhận ra khi nhìn lại, không phải khi đang trải qua. Đó là lý do hầu hết mọi người bỏ cuộc quá sớm – họ không thấy sự thay đổi vì họ đang ở quá gần để có góc nhìn đúng.",
    "Cái ngày anh chính thức lên cấp độ mười, hệ thống hiển thị một thông báo khác với tất cả những thông báo trước: [Người dùng đã đạt ngưỡng Thức Tỉnh. Khóa năng lực đặc biệt đã được mở. Chú ý: Từ đây, con đường sẽ khó hơn và nguy hiểm hơn. Bạn có muốn tiếp tục không?] Anh nhìn dòng chữ đó trong vài giây, nghĩ về căn phòng trọ mười tám mét vuông, nghĩ về công việc văn phòng chín đến năm, nghĩ về tất cả những buổi sáng anh đã dậy trước bình minh để hoàn thành nhiệm vụ trong khi những người khác vẫn còn ngủ. Rồi anh chạm vào [Có].",
  ],
}

const STATIC_NOVELS = [
  { title: "Đấu Phá Thương Khung", genres: ["Tiên Hiệp", "Huyền Huyễn", "Hành Động"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/dptk/300/450", synopsis: "Tại Đấu Khí Đại Lục, tu luyện đấu khí là nền tảng của mọi sức mạnh. Tiêu Viêm, một thiên tài từng được coi là kỳ lãnh của Tiêu gia, đột nhiên mất đi toàn bộ đấu khí ở tuổi mười một. Ba năm sống trong sự khinh thường, cậu tình cờ có được một nhẫn cổ bí ẩn cùng linh hồn của một vị Đấu Đế từ nghìn năm về trước. Hành trình từ phế tài trở thành đỉnh phong bắt đầu từ đây.", type: "xh" as const },
  { title: "Đấu La Đại Lục", genres: ["Tiên Hiệp", "Phiêu Lưu", "Hành Động"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/dldl/300/450", synopsis: "Đường Tam, một trong những hồn sư mạnh nhất Đường Môn, vì lấy được bí kíp tuyệt học mà bị phản bội và ném xuống vách núi. Linh hồn tỉnh dậy trong một thân xác mới tại thế giới Đấu La – nơi không có phép thuật, chỉ có hồn sư và hồn thú. Với ký ức và kỹ năng từ kiếp trước, Đường Tam lại bắt đầu leo lên đỉnh cao.", type: "xh" as const },
  { title: "Toàn Chức Pháp Sư", genres: ["Huyền Huyễn", "Đô Thị", "Hành Động"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/tcps/300/450", synopsis: "Trong một thế giới nơi ma thuật tồn tại song song với khoa học hiện đại, Mặc Phàm vốn là học sinh trung học bình thường lại bất ngờ giác thức toàn bộ bảy hệ ma thuật – điều mà người ta vẫn nghĩ là không thể. Hành trình của anh từ một thanh niên thường thường bậc trung trở thành pháp sư mạnh nhất thế giới đầy bất ngờ và hài hước.", type: "xh" as const },
  { title: "Phàm Nhân Tu Tiên", genres: ["Tiên Hiệp", "Tu Chân", "Phiêu Lưu"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/pntt/300/450", synopsis: "Hàn Lập, xuất thân từ gia đình nghèo khó, tình cờ gia nhập môn phái tu tiên bằng một chút mưu trí. Không có thiên phú phi thường, không có cơ duyên trời ban – chỉ có sự bền bỉ, tính toán cẩn thận và một lọ thuốc bí ẩn. Đây là câu chuyện của một phàm nhân thực sự tu thành tiên nhân qua hàng ngàn năm gian khổ.", type: "xh" as const },
  { title: "Tiên Nghịch", genres: ["Tiên Hiệp", "Tu Chân"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/tn/300/450", synopsis: "Vương Lâm sinh ra trong gia đình không có thiên phú tu luyện. Qua nhiều lần trắc trở và nhờ cơ duyên đặc biệt, anh bước vào con đường tu tiên đầy gian nan. Nhưng con đường của Vương Lâm không phải thuận theo thiên đạo – anh chọn nghịch thiên, dùng ý chí của bản thân để chiến thắng cả số phận.", type: "xh" as const },
  { title: "Vạn Cổ Đệ Nhất Thần", genres: ["Tiên Hiệp", "Hành Động"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/vcdn/300/450", synopsis: "Một linh hồn từ hiện đại đầu thai vào thân xác của phế tài trong thế giới tu tiên. Với trí nhớ và hiểu biết của người hiện đại cộng thêm cơ duyên bí ẩn, anh từng bước xây dựng lại bản thân từ đáy vực.", type: "xh" as const },
  { title: "Thần Đạo Đan Tôn", genres: ["Tiên Hiệp", "Luyện Đan"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/tddt/300/450", synopsis: "Đỉnh Đan Vương trên thiên thượng đầu thai trở lại vào thế giới loài người. Với trí nhớ về vô số bí phương luyện đan từ kiếp trước, Đan Thần Kỳ bắt đầu hành trình leo lên đỉnh cao của giới luyện đan, bước vào con đường không thể quay đầu.", type: "xh" as const },
  { title: "Cô Nương Ở Phòng Bên", genres: ["Lãng Mạn", "Đô Thị", "Thanh Xuân"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/cnopb/300/450", synopsis: "Lâm Dịch chuyển vào căn hộ mới với dự định sống yên tĩnh sau năm năm làm việc không nghỉ ngơi. Điều anh không ngờ tới là cô hàng xóm ở phòng bên – ồn ào, bừa bộn và không thể đoán trước – lại khiến cuộc sống đơn điệu của anh thay đổi hoàn toàn.", type: "romance" as const },
  { title: "Nguyệt Dạ Ly Thương", genres: ["Cổ Đại", "Lãng Mạn", "Ngôn Tình"], status: "COMPLETED" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/ndlt/300/450", synopsis: "Bạch Lộc, tiểu thư khuê các, vì cứu người mà lạc vào cung phủ rắc rối. Vị tướng quân lạnh lùng nổi tiếng khắp kinh thành lại là người đầu tiên cô gặp. Giữa thế sự rối ren, giữa quyền mưu và chiến tranh, một mối tình bắt đầu từ hiểu lầm dần dần nở rộ theo cách không ai ngờ tới.", type: "romance" as const },
  { title: "Sủng Thê Vô Độ", genres: ["Lãng Mạn", "Cổ Đại", "Hài Hước"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/stvd/300/450", synopsis: "Nàng xuyên việt thành tiểu thư xấu số đã bị hứa hôn với một vị hoàng tử nổi tiếng khó tính. Vốn định âm thầm sống qua ngày, ai ngờ vị hoàng tử đó lại không như tin đồn – thậm chí còn có vẻ... thích nàng? Một câu chuyện ngôn tình nhẹ nhàng với nhiều tình huống hài hước.", type: "romance" as const },
  { title: "Hệ Thống Thành Thần", genres: ["Đô Thị", "Hệ Thống", "Hành Động"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/httt/300/450", synopsis: "Sau một tai nạn bất ngờ, Lý Minh tỉnh dậy với một hệ thống bí ẩn xuất hiện trong đầu. Mỗi nhiệm vụ hoàn thành đem lại điểm thưởng có thể dùng để nâng cấp bản thân. Từ một nhân viên văn phòng bình thường, anh từng bước trở thành nhân vật không thể bỏ qua trong thế giới ngầm đầy nguy hiểm của thành phố.", type: "system" as const },
  { title: "Siêu Cấp Thần Cơ", genres: ["Hệ Thống", "Khoa Học Viễn Tưởng", "Hành Động"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/sctc/300/450", synopsis: "Trí tuệ nhân tạo từ tương lai bị gửi ngược về quá khứ và gắn kết với một thanh niên bình thường. Cùng nhau, họ đối mặt với những thách thức mà cả hai đều chưa từng gặp. Đây không chỉ là câu chuyện về sức mạnh, mà còn về lòng tin giữa người và máy.", type: "system" as const },
  { title: "Kiếm Đạo Độc Tôn", genres: ["Tiên Hiệp", "Kiếm Thuật", "Hành Động"], status: "ONGOING" as const, lang: "ZH" as const, cover: "https://picsum.photos/seed/kddtc/300/450", synopsis: "Khi thế giới tu tiên chia ra thành trăm phái, kiếm đạo được coi là con đường thuần khiết nhất nhưng cũng gian nan nhất. Trần Phong, sinh ra với thiên phú kiếm đạo khác thường, quyết tâm đi theo con đường mà ngay cả sư phụ ông cũng không dám đặt chân vào.", type: "xh" as const },
  { title: "Nước Mắt Cuối Mùa", genres: ["Hiện Đại", "Lãng Mạn", "Tâm Lý"], status: "COMPLETED" as const, lang: "VI" as const, cover: "https://picsum.photos/seed/nmcm/300/450", synopsis: "Gia Linh trở về thành phố cũ sau năm năm xa cách để tổ chức đám tang cho bà ngoại. Không ngờ, người cô không muốn gặp nhất lại là người đầu tiên chờ cô ở sân bay. Một câu chuyện về những điều chưa nói, những lựa chọn không thể làm lại, và hy vọng rằng một số điều vẫn có thể được chữa lành.", type: "romance" as const },
  { title: "Vô Tận Tiến Hóa", genres: ["Huyền Huyễn", "Hệ Thống", "Phiêu Lưu"], status: "ONGOING" as const, lang: "KO" as const, cover: "https://picsum.photos/seed/vtte/300/450", synopsis: "Trái Đất bước vào kỷ nguyên thức tỉnh – mỗi người dân đều nhận được một hệ thống cá nhân với những năng lực khác nhau. Kim Juno nhận được kỹ năng bị coi là vô dụng nhất: sao chép. Nhưng trong tay đúng người, kỹ năng thấp nhất có thể trở thành vũ khí mạnh nhất.", type: "system" as const },
]

const CHAPTER_TITLES: Record<string, string[]> = {
  xh: ["Phế Tài", "Cơ Duyên Bí Ẩn", "Luyện Công Khổ Cực", "Thách Đấu", "Đột Phá Cảnh Giới", "Kẻ Thù Cũ", "Vào Môn", "Thử Thách Đầu Tiên", "Bí Mật Gia Tộc", "Xuất Quan", "Giải Đấu", "Lên Đường"],
  romance: ["Gặp Gỡ", "Hiểu Lầm Đầu Tiên", "Tình Cờ Hay Sắp Xếp", "Lần Đầu Nói Chuyện", "Buổi Tối Mưa", "Kỷ Niệm Nhỏ", "Bí Mật Chưa Nói", "Gần Hơn Một Chút", "Lòng Bàn Tay", "Câu Hỏi Không Có Đáp", "Chọn Lựa", "Điều Còn Lại"],
  system: ["Thức Tỉnh", "Nhiệm Vụ Đầu Tiên", "Nâng Cấp", "Khám Phá Giới Hạn", "Kẻ Địch Xuất Hiện", "Kỹ Năng Bí Ẩn", "Đột Phá", "Bí Mật Hệ Thống", "Liên Minh", "Thử Thách Lớn", "Mặt Thật", "Trận Chiến Quyết Định"],
}

function buildChapterContent(type: "xh" | "romance" | "system", chNum: number): string {
  const pool = PARA[type]
  // Pick 8 paragraphs with chapter-specific rotation → ~1600 words per chapter
  const paras: string[] = []
  for (let i = 0; i < 8; i++) {
    paras.push(pool[(chNum * 3 + i) % pool.length])
  }
  return paras.join("\n\n")
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function makeSlug(title: string): Promise<string> {
  let base = slugify(title, { lower: true, strict: true, locale: "vi" })
  let candidate = base; let i = 1
  while (true) {
    const [r] = await db.select({ id: novels.id }).from(novels).where(eq(novels.slug, candidate)).limit(1)
    if (!r) return candidate
    candidate = `${base}-${i++}`
  }
}

async function upsertGenre(name: string): Promise<number> {
  const slug = slugify(name, { lower: true, strict: true })
  const [e] = await db.select({ id: genres.id }).from(genres).where(eq(genres.slug, slug)).limit(1)
  if (e) return e.id
  const [c] = await db.insert(genres).values({ name, slug }).returning({ id: genres.id })
  return c.id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 NovelHub seed${STATIC_MODE ? " (static mode)" : " (crawl → fallback)"}\n`)

  const [user] = await db.select({ id: users.id }).from(users).limit(1)
  if (!user) { console.error("❌ No users in DB. Sign up at /sign-up first."); process.exit(1) }
  console.log(`✅ User: ${user.id}\n`)

  // --reseed: delete all chapters for previously seeded novels, then re-insert
  if (RESEED_MODE) {
    console.log("🗑️  Removing previously seeded chapters…")
    for (const spec of STATIC_NOVELS) {
      const slug = slugify(spec.title, { lower: true, strict: true, locale: "vi" })
      const [novel] = await db.select({ id: novels.id }).from(novels).where(eq(novels.slug, slug)).limit(1)
      if (!novel) continue
      await db.delete(chapters).where(eq(chapters.novelId, novel.id))
      await db.update(novels).set({ totalChapters: 0 }).where(eq(novels.id, novel.id))
      process.stdout.write(`  ✓ cleared "${spec.title}"\n`)
    }
    console.log()
  }

  let seeded = 0

  // ── Try live crawl first (unless --static) ──────────────────────────────────
  if (!STATIC_MODE) {
    console.log("🕷️  Trying metruyencv.com…")
    const slugCandidates = await getNovelSlugs()
    console.log(`   Found ${slugCandidates.length} candidates\n`)

    for (const slug of slugCandidates) {
      if (seeded >= NOVELS_TARGET) break
      await sleep(DELAY_MS)

      process.stdout.write(`📖 [${seeded + 1}/${NOVELS_TARGET}] ${slug} … `)
      const meta = await getNovelMeta(slug)
      if (!meta?.title) { console.log("skip (no title)"); continue }

      const baseSlug = slugify(meta.title, { lower: true, strict: true, locale: "vi" })
      const [exists] = await db.select({ id: novels.id }).from(novels).where(eq(novels.slug, baseSlug)).limit(1)
      if (exists) { console.log("skip (exists)"); seeded++; continue }

      const genreIds = await Promise.all(meta.genreNames.map(upsertGenre))
      const novelSlug = await makeSlug(meta.title)
      const [novel] = await db.insert(novels).values({
        title: meta.title, slug: novelSlug, synopsis: meta.synopsis || null,
        coverImageUrl: meta.coverUrl, status: meta.status, originalLanguage: "ZH", createdBy: user.id,
      }).returning()
      if (genreIds.length) await db.insert(novelGenres).values(genreIds.map((gId) => ({ novelId: novel.id, genreId: gId })))

      console.log(`"${meta.title}"`)

      await sleep(DELAY_MS)
      let chNums = await getChapterNums(slug)
      if (chNums.length === 0) chNums = Array.from({ length: CHAPTERS_PER_NOVEL }, (_, i) => i + 1)
      else chNums = chNums.slice(0, CHAPTERS_PER_NOVEL)

      let chCount = 0
      for (const n of chNums) {
        await sleep(DELAY_MS)
        const ch = await getChapter(slug, n)
        if (!ch) { process.stdout.write(`    ch${n}: empty\n`); continue }
        await db.insert(chapters).values({ novelId: novel.id, chapterNumber: n, title: ch.title, content: ch.content, wordCount: ch.wordCount, isVip: false, status: "PUBLISHED", publishedAt: new Date() }).onConflictDoNothing()
        chCount++
        process.stdout.write(`    ✓ ch${n} "${ch.title.slice(0, 35)}" (${ch.wordCount}w)\n`)
      }
      await db.update(novels).set({ totalChapters: chCount }).where(eq(novels.id, novel.id))
      console.log(`  → ${chCount} chapters\n`)
      seeded++
    }

    if (seeded > 0) { console.log(`\n🎉 Crawled ${seeded} novels.`); return }
    console.log("⚠️  Crawl yielded 0 novels — switching to built-in static dataset.\n")
  }

  // ── Static seed ─────────────────────────────────────────────────────────────
  console.log("📦 Inserting static dataset…\n")

  for (const spec of STATIC_NOVELS) {
    if (seeded >= NOVELS_TARGET) break

    const baseSlug = slugify(spec.title, { lower: true, strict: true, locale: "vi" })
    const [exists] = await db.select({ id: novels.id }).from(novels).where(eq(novels.slug, baseSlug)).limit(1)
    if (exists && !RESEED_MODE) { console.log(`  ⏭️  "${spec.title}" already exists`); seeded++; continue }

    const genreIds = await Promise.all(spec.genres.map(upsertGenre))

    // Re-use the existing novel row when reseeding; create new row otherwise
    let novelId: string
    if (exists) {
      novelId = exists.id
    } else {
      const novelSlug = await makeSlug(spec.title)
      const [novel] = await db.insert(novels).values({
        title: spec.title, slug: novelSlug, synopsis: spec.synopsis,
        coverImageUrl: spec.cover, status: spec.status, originalLanguage: spec.lang,
        isFeatured: seeded < 5,
        createdBy: user.id,
      }).returning()
      novelId = novel.id
      if (genreIds.length) await db.insert(novelGenres).values(genreIds.map((gId) => ({ novelId, genreId: gId })))
    }

    const titleList = CHAPTER_TITLES[spec.type]
    let chCount = 0
    for (let i = 0; i < CHAPTERS_PER_NOVEL; i++) {
      const chNum = i + 1
      const title = titleList[i] ?? `Chương ${chNum}`
      const content = buildChapterContent(spec.type, chNum)
      const wordCount = content.split(/\s+/).filter(Boolean).length
      await db.insert(chapters).values({ novelId, chapterNumber: chNum, title, content, wordCount, isVip: i >= 8, status: "PUBLISHED", publishedAt: new Date(Date.now() - (CHAPTERS_PER_NOVEL - i) * 86400_000) }).onConflictDoNothing()
      chCount++
    }

    await db.update(novels).set({ totalChapters: chCount }).where(eq(novels.id, novelId))
    console.log(`  ✅ "${spec.title}" — ${chCount} chapters`)
    seeded++
  }

  console.log(`\n🎉 Done! Seeded ${seeded} novels.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
