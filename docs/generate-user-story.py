#!/usr/bin/env python3
"""
generate-user-story.py
Generates docs/USER-STORY.docx — NovelHub User Story + QA Mapping Document
Run: python docs/generate-user-story.py
"""

import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ── Colours ─────────────────────────────────────────────────────────────────
HDR_BG    = '2E4057'   # deep navy   – column header
HDR_FG    = 'FFFFFF'
ROW_A     = 'F2F4F8'   # light grey  – alternating rows
ROW_B     = 'FFFFFF'
SEC_BG    = 'D9E1F2'   # soft blue   – section heading row

P_HIGH    = 'C6EFCE'   # green
P_MED     = 'FFEB9C'   # amber
P_LOW     = 'FCE4D6'   # salmon

BORDER_C  = 'BFBFBF'   # cell border colour

# Column widths (cm): ID | User Story | Acceptance Criteria | QA | Related | Priority
COL_W = [1.5, 4.5, 11.0, 2.5, 2.5, 2.0]

# ── Data ─────────────────────────────────────────────────────────────────────
SECTIONS = [
    {
        "title": "1. Quản lý Tài khoản & Người dùng",
        "focus": "Security, Usability, Performance",
        "stories": [
            {
                "id": "US-01",
                "story": "Là khách (guest), tôi muốn đăng ký tài khoản bằng email và mật khẩu, để có thể truy cập các tính năng cá nhân hóa.",
                "criteria": [
                    "Biểu mẫu yêu cầu: Tên hiển thị, Email hợp lệ, Mật khẩu ≥ 8 ký tự.",
                    "Từ chối email đã tồn tại với thông báo chung (không tiết lộ email có hay không).",
                    "Mật khẩu lưu dưới dạng bcrypt hash — không bao giờ lưu plain text.",
                    "Biểu mẫu phản hồi trong 2 giây ở tải bình thường.",
                    "Xác thực email được gửi trong 30 giây sau đăng ký.",
                ],
                "qa": "Security, Usability, Performance",
                "related": "UC-01, FR-01",
                "priority": "High",
            },
            {
                "id": "US-02",
                "story": "Là người dùng đã đăng ký, tôi muốn đăng nhập bằng email và mật khẩu, để truy cập nội dung và dữ liệu cá nhân.",
                "criteria": [
                    "Đăng nhập hoàn thành trong 2 giây ở tải bình thường.",
                    "Tài khoản bị khóa 15 phút sau 5 lần đăng nhập sai liên tiếp.",
                    "Thông báo lỗi không tiết lộ trường nào sai (email hay mật khẩu).",
                    "Session token lưu trong httpOnly cookie; không để lộ trong JavaScript.",
                    "CSRF token được kiểm tra mỗi yêu cầu POST.",
                ],
                "qa": "Security, Performance",
                "related": "UC-02, FR-02",
                "priority": "High",
            },
            {
                "id": "US-03",
                "story": "Là khách, tôi muốn đăng nhập bằng tài khoản Google, để đăng nhập nhanh mà không cần tạo mật khẩu riêng.",
                "criteria": [
                    "Nhấn nút Google → chuyển hướng đến Google OAuth trong 1 giây.",
                    "Tài khoản mới tự động tạo nếu email chưa tồn tại.",
                    "Email đã tồn tại thì liên kết OAuth với tài khoản hiện tại.",
                    "Toàn bộ luồng hoàn thành trong 3 giây.",
                    "State parameter CSRF được kiểm tra trước khi xử lý callback.",
                ],
                "qa": "Security, Usability",
                "related": "UC-03, FR-03",
                "priority": "High",
            },
            {
                "id": "US-04",
                "story": "Là người dùng đang đăng nhập, tôi muốn đăng xuất, để bảo vệ tài khoản khi không sử dụng.",
                "criteria": [
                    "Session bị vô hiệu hóa phía server ngay lập tức.",
                    "Cookie session bị xóa khỏi trình duyệt.",
                    "Người dùng được chuyển hướng về trang chủ trong 1 giây.",
                    "Sau đăng xuất, truy cập trang cần xác thực redirect về /sign-in.",
                ],
                "qa": "Security, Usability",
                "related": "UC-04, FR-04",
                "priority": "High",
            },
            {
                "id": "US-05",
                "story": "Là người dùng đăng nhập, tôi muốn cập nhật tên hiển thị và giới thiệu, để cá nhân hóa hồ sơ.",
                "criteria": [
                    "Tên hiển thị tối đa 100 ký tự; Giới thiệu tối đa 300 ký tự.",
                    "Bộ đếm ký tự hiển thị thời gian thực góc dưới-phải textarea.",
                    "Lưu thay đổi trong 1 giây và hiển thị thông báo thành công.",
                    "Trường Email ở chế độ chỉ đọc — không thể chỉnh sửa.",
                ],
                "qa": "Usability",
                "related": "UC-05, FR-05",
                "priority": "Medium",
            },
            {
                "id": "US-06",
                "story": "Là người dùng đăng nhập, tôi muốn đổi mật khẩu, để tăng cường bảo mật tài khoản.",
                "criteria": [
                    "Phải nhập mật khẩu hiện tại trước khi đặt mật khẩu mới.",
                    "Mật khẩu mới ≥ 8 ký tự; xác nhận mật khẩu phải khớp.",
                    "Tất cả session khác bị vô hiệu hóa sau khi đổi thành công.",
                    "Thông báo lỗi khi mật khẩu hiện tại sai không tiết lộ thêm thông tin.",
                ],
                "qa": "Security, Usability",
                "related": "UC-06, FR-06",
                "priority": "Medium",
            },
        ],
    },
    {
        "title": "2. Khám phá Truyện & Đọc Chương",
        "focus": "Performance, Usability, SEO",
        "stories": [
            {
                "id": "US-07",
                "story": "Là khách hoặc người dùng, tôi muốn duyệt danh sách truyện với bộ lọc thể loại và trạng thái, để tìm truyện phù hợp.",
                "criteria": [
                    "Danh sách tải trong 2 giây; phân trang 20–30 truyện mỗi trang.",
                    "Bộ lọc trạng thái: Tất cả / Đang ra / Hoàn thành / Tạm dừng / Đã drop.",
                    "Bộ lọc thể loại: chọn nhiều, AND logic.",
                    "Tham số lọc phản ánh trong URL (query string) để chia sẻ và bookmark.",
                    "Trang được server-side render để Google index đúng nội dung.",
                ],
                "qa": "Performance, Usability, SEO",
                "related": "UC-07, FR-07",
                "priority": "High",
            },
            {
                "id": "US-08",
                "story": "Là khách hoặc người dùng, tôi muốn xem trang chi tiết truyện với thông tin đầy đủ và danh sách chương, để quyết định có đọc không.",
                "criteria": [
                    "LCP (Largest Contentful Paint) < 2.5 giây trên kết nối 4G.",
                    "Ảnh bìa lazy-loaded; hiển thị skeleton khi tải.",
                    "Thống kê (số chương, lượt xem, điểm đánh giá) chính xác và cập nhật.",
                    "Canonical URL đặt đúng, tránh nội dung trùng lặp.",
                    "Chương VIP hiển thị icon khóa màu amber trong danh sách.",
                ],
                "qa": "Performance, SEO, Usability",
                "related": "UC-08, FR-08",
                "priority": "High",
            },
            {
                "id": "US-09",
                "story": "Là người đọc, tôi muốn đọc nội dung chương trong giao diện tối giản, để tập trung vào trải nghiệm đọc.",
                "criteria": [
                    "Nội dung chương tải trong 1.5 giây.",
                    "Điều hướng Chương trước / Chương sau hoạt động đúng.",
                    "Cài đặt đọc (font, size, theme, width) lưu vào localStorage và khôi phục.",
                    "Chương VIP chưa mở khóa hiển thị trạng thái khóa và nút mua xu.",
                    "Thanh điều hướng ẩn khi cuộn xuống, hiện lại khi cuộn lên.",
                ],
                "qa": "Performance, Usability, Reliability",
                "related": "UC-09, FR-09",
                "priority": "High",
            },
            {
                "id": "US-10",
                "story": "Là khách hoặc người dùng, tôi muốn tìm kiếm truyện theo tiêu đề hoặc tác giả, để nhanh chóng tìm nội dung mong muốn.",
                "criteria": [
                    "Kết quả xuất hiện trong 500ms (Meilisearch).",
                    "Chịu lỗi chính tả sai lệch 1–2 ký tự (fuzzy matching).",
                    "Hiển thị 'Không tìm thấy kết quả' khi không có kết quả.",
                    "Từ khóa được highlight trong tiêu đề kết quả.",
                    "Fallback về full-text DB search nếu Meilisearch không khả dụng.",
                ],
                "qa": "Performance, Usability, Reliability",
                "related": "UC-10, FR-10",
                "priority": "High",
            },
            {
                "id": "US-11",
                "story": "Là người đọc, tôi muốn tùy chỉnh phông chữ, cỡ chữ, chiều cao dòng và chủ đề màu trong trang đọc, để đọc thoải mái hơn.",
                "criteria": [
                    "3 chủ đề: Sáng (#faf9f6), Tối (#212121), Đêm (#0f0f0f).",
                    "Cỡ chữ: 14–26px điều chỉnh bằng slider.",
                    "Chiều cao dòng: 1.4–2.2× điều chỉnh bằng slider.",
                    "Độ rộng nội dung: 480–900px điều chỉnh bằng slider.",
                    "Thay đổi áp dụng ngay lập tức, không reload trang.",
                ],
                "qa": "Usability",
                "related": "UC-09, FR-11",
                "priority": "Medium",
            },
        ],
    },
    {
        "title": "3. Tủ sách, Theo dõi & Tiến độ Đọc",
        "focus": "Reliability, Usability",
        "stories": [
            {
                "id": "US-12",
                "story": "Là người dùng đăng nhập, tôi muốn lưu truyện vào tủ sách, để dễ tìm lại và theo dõi tiến độ.",
                "criteria": [
                    "Nút thêm/xóa phản hồi ngay lập tức (optimistic update).",
                    "Dữ liệu tủ sách lưu vào DB, đồng bộ giữa các thiết bị.",
                    "Trạng thái tủ sách hiển thị đúng sau khi reload trang.",
                ],
                "qa": "Usability, Reliability",
                "related": "UC-12, FR-12",
                "priority": "High",
            },
            {
                "id": "US-13",
                "story": "Là người dùng đăng nhập, tôi muốn xem danh sách truyện trong tủ sách với bộ lọc, để quản lý sách dễ dàng.",
                "criteria": [
                    "Tabs lọc: Đang đọc | Hoàn thành | Tất cả.",
                    "Mỗi card hiển thị thanh tiến độ đọc (% chương đã đọc).",
                    "Empty state: icon + text + link 'Khám phá truyện' khi chưa có sách.",
                    "Danh sách tải trong 2 giây.",
                ],
                "qa": "Usability, Reliability",
                "related": "UC-13, FR-13",
                "priority": "Medium",
            },
            {
                "id": "US-14",
                "story": "Là người đọc, tôi muốn tiến độ đọc tự động lưu khi mở chương, để tiếp tục đọc từ nơi đã dừng.",
                "criteria": [
                    "Tiến độ cập nhật khi người dùng mở một chương.",
                    "Nút 'Tiếp tục đọc' trên trang chi tiết dẫn đến chương đọc cuối.",
                    "Tiến độ hiển thị trên card trong tủ sách.",
                    "Dữ liệu tiến độ không mất khi đăng xuất và đăng nhập lại.",
                ],
                "qa": "Reliability, Usability",
                "related": "UC-14, UC-15, FR-14",
                "priority": "High",
            },
            {
                "id": "US-15",
                "story": "Là người dùng đăng nhập, tôi muốn theo dõi truyện để nhận thông báo khi có chương mới, để không bỏ lỡ cập nhật.",
                "criteria": [
                    "Nút theo dõi/bỏ theo dõi phản hồi trong 1 giây.",
                    "Thông báo gửi trong 5 phút sau khi chương mới được xuất bản.",
                    "Bỏ theo dõi ngay lập tức ngừng thông báo.",
                    "Số người theo dõi trên trang chi tiết truyện cập nhật chính xác.",
                ],
                "qa": "Reliability, Usability",
                "related": "UC-15, FR-15",
                "priority": "Medium",
            },
        ],
    },
    {
        "title": "4. Truy cập VIP & Thanh toán",
        "focus": "Security, Reliability, Integrity",
        "stories": [
            {
                "id": "US-16",
                "story": "Là người dùng đăng nhập, tôi muốn xem số dư xu của mình ở mọi trang, để biết mình còn bao nhiêu xu.",
                "criteria": [
                    "Số dư xu hiển thị trong header sau khi đăng nhập.",
                    "Số dư KHÔNG bao giờ được cache; luôn đọc trực tiếp từ DB.",
                    "Số dư cập nhật ngay sau khi mua hoặc sử dụng xu.",
                    "Click vào số dư chuyển hướng đến trang /pricing.",
                ],
                "qa": "Reliability, Integrity",
                "related": "UC-16, FR-16",
                "priority": "High",
            },
            {
                "id": "US-17",
                "story": "Là người dùng đăng nhập, tôi muốn mua xu qua MoMo, để có xu mở khóa chương VIP.",
                "criteria": [
                    "Danh sách gói xu hiển thị đúng giá VND và số xu (kể cả bonus).",
                    "Thanh toán chuyển hướng đến MoMo QR / deep link.",
                    "Webhook MoMo được xác thực bằng HMAC-SHA256 trước khi xử lý.",
                    "Cộng xu và ghi ledger trong một DB transaction nguyên tử.",
                    "Webhook trùng lặp (idempotency key) không cộng xu hai lần.",
                    "Người dùng nhận thông báo thành công/thất bại trong 30 giây.",
                    "Không nhận thanh toán thật trên Vercel Hobby tier — sandbox only.",
                ],
                "qa": "Security, Reliability, Integrity",
                "related": "UC-17, FR-17",
                "priority": "High",
            },
            {
                "id": "US-18",
                "story": "Là người đọc có đủ xu, tôi muốn mở khóa chương VIP bằng 1 xu, để đọc nội dung cao cấp.",
                "criteria": [
                    "Kiểm tra số dư trước khi trừ xu; không trừ nếu không đủ.",
                    "Trừ xu và tạo bản ghi unlock trong một DB transaction nguyên tử.",
                    "Chương có thể truy cập ngay sau khi mở khóa.",
                    "Mục coin_transactions được tạo cho mỗi lần unlock.",
                    "Chương đã mở khóa không bị tính phí lại khi đọc lại.",
                    "Thông báo lỗi rõ ràng khi không đủ xu.",
                ],
                "qa": "Reliability, Integrity, Security",
                "related": "UC-18, FR-18",
                "priority": "High",
            },
            {
                "id": "US-19",
                "story": "Là người dùng, tôi muốn đăng ký gói Premium để đọc không giới hạn chương VIP, thay vì trả xu từng chương.",
                "criteria": [
                    "Gói Premium đang hoạt động bỏ qua kiểm tra xu cho mọi chương VIP.",
                    "Trạng thái đăng ký kiểm tra per-request từ DB — không cache.",
                    "Đăng ký hết hạn tự động quay lại mô hình trả xu từng chương.",
                    "Ngày hết hạn hiển thị trên trang /settings hoặc /pricing.",
                ],
                "qa": "Reliability, Security, Integrity",
                "related": "UC-19, FR-19",
                "priority": "Medium",
            },
        ],
    },
    {
        "title": "5. Đánh giá, Bình luận & Kiểm duyệt",
        "focus": "Integrity, Auditability, Usability",
        "stories": [
            {
                "id": "US-20",
                "story": "Là người đọc đã đọc ít nhất 1 chương, tôi muốn viết đánh giá và cho điểm sao truyện, để chia sẻ ý kiến với cộng đồng.",
                "criteria": [
                    "Điểm 1–5 sao bắt buộc; nội dung tối đa 2000 ký tự.",
                    "Mỗi người dùng chỉ được 1 đánh giá mỗi truyện.",
                    "Cho phép chỉnh sửa trong 24 giờ sau khi đăng.",
                    "Đánh giá hiển thị sau kiểm duyệt từ khóa tự động.",
                    "Điểm trung bình truyện cập nhật sau mỗi đánh giá mới.",
                ],
                "qa": "Integrity, Usability",
                "related": "UC-19, UC-20, FR-20",
                "priority": "Medium",
            },
            {
                "id": "US-21",
                "story": "Là người dùng đăng nhập, tôi muốn bình luận trên chương, để trao đổi với độc giả khác.",
                "criteria": [
                    "Nội dung bình luận tối đa 500 ký tự.",
                    "Nội dung được sanitize (escape XSS) trước khi lưu và hiển thị.",
                    "Bình luận xuất hiện trong 1 giây sau khi gửi.",
                    "Hỗ trợ trả lời lồng nhau 1 cấp.",
                    "Admin và curator có thể ẩn/xóa bình luận.",
                ],
                "qa": "Security, Usability, Integrity",
                "related": "UC-20, UC-21, FR-21",
                "priority": "Medium",
            },
            {
                "id": "US-22",
                "story": "Là người dùng đăng nhập, tôi muốn báo cáo bình luận hoặc đánh giá vi phạm, để duy trì môi trường cộng đồng lành mạnh.",
                "criteria": [
                    "Chọn lý do báo cáo từ dropdown (spam, vi phạm, không phù hợp).",
                    "Báo cáo trùng lặp từ cùng người dùng bị bỏ qua.",
                    "Nội dung bị báo cáo đánh dấu trong hàng đợi kiểm duyệt admin.",
                    "Người báo cáo nhận thông báo khi admin xử lý.",
                    "Hành động admin ghi vào audit_logs.",
                ],
                "qa": "Integrity, Auditability, Usability",
                "related": "UC-22, FR-22",
                "priority": "Medium",
            },
            {
                "id": "US-23",
                "story": "Là người dùng đăng nhập, tôi muốn upvote/downvote đánh giá của người khác, để giúp đánh giá hữu ích nổi bật hơn.",
                "criteria": [
                    "Mỗi người dùng chỉ bỏ 1 phiếu mỗi đánh giá.",
                    "Thay đổi phiếu bầu phản ánh ngay (optimistic update).",
                    "Chỉ người dùng đã đăng nhập mới bỏ phiếu được.",
                    "Điểm vote không ảnh hưởng đến điểm sao tổng của truyện.",
                ],
                "qa": "Integrity, Usability",
                "related": "UC-20, FR-23",
                "priority": "Low",
            },
        ],
    },
    {
        "title": "6. Xuất bản Nội dung (Curator CMS)",
        "focus": "Maintainability, Reliability, Usability",
        "stories": [
            {
                "id": "US-24",
                "story": "Là curator, tôi muốn tạo và quản lý truyện với đầy đủ metadata, để xuất bản nội dung cho người đọc.",
                "criteria": [
                    "Bắt buộc: Tiêu đề, Tóm tắt, Trạng thái, ít nhất 1 thể loại.",
                    "Slug tự động tạo từ tiêu đề; có thể chỉnh sửa thủ công.",
                    "Ảnh bìa upload lên Cloudinary; URL lưu vào DB.",
                    "Hỗ trợ trạng thái Draft và Published.",
                    "Thay đổi phản ánh trên trang browse trong 60 giây.",
                ],
                "qa": "Usability, Reliability",
                "related": "UC-22, FR-24",
                "priority": "High",
            },
            {
                "id": "US-25",
                "story": "Là curator, tôi muốn soạn và xuất bản nội dung chương, để cung cấp nội dung cho người đọc.",
                "criteria": [
                    "Trình soạn thảo hỗ trợ văn bản phong phú (bold, italic, paragraph breaks).",
                    "Số chương tự động tăng hoặc nhập thủ công.",
                    "Cờ VIP có thể bật/tắt riêng cho từng chương.",
                    "Nội dung được sanitize trước khi lưu (loại bỏ script tags).",
                    "Người theo dõi nhận thông báo trong 5 phút sau khi xuất bản.",
                ],
                "qa": "Usability, Reliability, Security",
                "related": "UC-22, FR-25",
                "priority": "High",
            },
            {
                "id": "US-26",
                "story": "Là curator, tôi muốn cập nhật trạng thái truyện (Đang ra / Hoàn thành / Tạm dừng / Đã drop), để người đọc biết tình trạng cập nhật.",
                "criteria": [
                    "Thay đổi trạng thái phản ánh ngay trên trang chi tiết.",
                    "Chuyển sang 'Hoàn thành' kích hoạt thông báo đến người theo dõi.",
                    "Trạng thái hiển thị đúng màu badge (emerald / amber / red).",
                ],
                "qa": "Reliability, Usability",
                "related": "UC-22, FR-26",
                "priority": "Medium",
            },
            {
                "id": "US-27",
                "story": "Là curator, tôi muốn gán thể loại và tag cho truyện, để người đọc dễ lọc và tìm kiếm.",
                "criteria": [
                    "Chọn nhiều thể loại từ danh sách có sẵn.",
                    "Tag tự do tối đa 20 tag/truyện; mỗi tag tối đa 30 ký tự.",
                    "Thay đổi cập nhật index Meilisearch trong 60 giây.",
                    "Thể loại và tag hiển thị trên trang chi tiết truyện.",
                ],
                "qa": "Maintainability, Usability",
                "related": "UC-22, FR-27",
                "priority": "Medium",
            },
        ],
    },
    {
        "title": "7. Quản trị Hệ thống (Admin)",
        "focus": "Security, Auditability, Manageability",
        "stories": [
            {
                "id": "US-28",
                "story": "Là admin, tôi muốn quản lý tài khoản người dùng (xem, đình chỉ, xóa), để duy trì an toàn nền tảng.",
                "criteria": [
                    "Tìm kiếm người dùng theo email hoặc tên hiển thị.",
                    "Đình chỉ/bỏ đình chỉ kèm lý do; lý do lưu vào audit_logs.",
                    "Xóa tài khoản ẩn danh hóa dữ liệu — không xóa vật lý bản ghi.",
                    "Mọi hành động admin ghi vào audit_logs với timestamp và actor ID.",
                    "Chỉ role='ADMIN' mới truy cập được endpoint quản trị.",
                ],
                "qa": "Security, Auditability",
                "related": "UC-23, FR-28",
                "priority": "High",
            },
            {
                "id": "US-29",
                "story": "Là admin, tôi muốn quản lý các gói xu (tạo, chỉnh sửa, vô hiệu hóa), để kiểm soát chính sách thanh toán.",
                "criteria": [
                    "Đặt giá (VND), số xu và xu bonus cho mỗi gói.",
                    "Vô hiệu hóa gói mà không xóa lịch sử giao dịch.",
                    "Thay đổi có hiệu lực ngay cho giao dịch mới.",
                    "Mọi thay đổi ghi vào audit_logs.",
                ],
                "qa": "Integrity, Auditability, Manageability",
                "related": "UC-23, FR-29",
                "priority": "Medium",
            },
            {
                "id": "US-30",
                "story": "Là admin, tôi muốn xem hàng đợi nội dung bị báo cáo và xử lý (giữ / xóa), để kiểm duyệt cộng đồng hiệu quả.",
                "criteria": [
                    "Hiển thị danh sách báo cáo chưa xử lý với nội dung và lý do.",
                    "Hành động: Giữ nguyên (dismiss) hoặc Xóa nội dung.",
                    "Hành động ghi vào audit_logs với admin ID và timestamp.",
                    "Người dùng báo cáo nhận thông báo kết quả xử lý.",
                ],
                "qa": "Auditability, Security, Usability",
                "related": "UC-22, UC-23, FR-30",
                "priority": "High",
            },
            {
                "id": "US-31",
                "story": "Là admin, tôi muốn xem nhật ký kiểm tra (audit log) tất cả hành động admin và hệ thống, để truy vết và giám sát.",
                "criteria": [
                    "Lọc theo loại hành động, khoảng thời gian và actor.",
                    "Phân trang 50 mục mỗi trang.",
                    "Log bất biến: không thể xóa hoặc chỉnh sửa.",
                    "Lưu giữ tối thiểu 90 ngày.",
                ],
                "qa": "Auditability, Security",
                "related": "UC-23, FR-31",
                "priority": "Medium",
            },
        ],
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)


def set_cell_borders(cell, color=BORDER_C):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side in ('top', 'left', 'bottom', 'right'):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), '4')
        el.set(qn('w:space'), '0')
        el.set(qn('w:color'), color)
        tcBorders.append(el)
    tcPr.append(tcBorders)


def cell_text(cell, text, bold=False, italic=False, size=9,
              color=None, align=WD_ALIGN_PARAGRAPH.LEFT):
    para = cell.paragraphs[0]
    para.alignment = align
    para.paragraph_format.space_before = Pt(1)
    para.paragraph_format.space_after = Pt(1)
    run = para.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.name = 'Calibri'
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def cell_bullets(cell, items, size=9):
    for i, item in enumerate(items):
        if i == 0:
            p = cell.paragraphs[0]
        else:
            p = cell.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.left_indent = Cm(0.25)
        run = p.add_run(f'•  {item}')
        run.font.name = 'Calibri'
        run.font.size = Pt(size)


def set_landscape_a4(doc):
    section = doc.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width  = Cm(29.7)
    section.page_height = Cm(21.0)
    section.left_margin   = Cm(1.5)
    section.right_margin  = Cm(1.5)
    section.top_margin    = Cm(1.8)
    section.bottom_margin = Cm(1.8)


def add_header_row(table):
    hdr_cells = table.rows[0].cells
    labels = ['ID', 'User Story', 'Acceptance Criteria', 'QA', 'Related FR/UC', 'Priority']
    for cell, label in zip(hdr_cells, labels):
        set_cell_bg(cell, HDR_BG)
        set_cell_borders(cell, HDR_BG)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        cell_text(cell, label, bold=True, size=9, color=HDR_FG,
                  align=WD_ALIGN_PARAGRAPH.CENTER)
    # Lock header row
    tr = table.rows[0]._tr
    trPr = tr.get_or_add_trPr()
    tblHeader = OxmlElement('w:tblHeader')
    trPr.append(tblHeader)


def apply_col_widths(table):
    for row in table.rows:
        for i, cell in enumerate(row.cells):
            cell.width = Cm(COL_W[i])


def add_story_row(table, story, row_idx):
    row = table.add_row()
    cells = row.cells
    bg = ROW_A if row_idx % 2 == 0 else ROW_B

    for cell in cells:
        set_cell_borders(cell)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP

    # ID
    set_cell_bg(cells[0], bg)
    cell_text(cells[0], story['id'], bold=True, size=9,
              align=WD_ALIGN_PARAGRAPH.CENTER)

    # User Story
    set_cell_bg(cells[1], bg)
    cell_text(cells[1], story['story'], size=9)

    # Acceptance Criteria
    set_cell_bg(cells[2], bg)
    cell_bullets(cells[2], story['criteria'], size=9)

    # QA tags (one per line)
    set_cell_bg(cells[3], bg)
    tags = [t.strip() for t in story['qa'].split(',')]
    p = cells[3].paragraphs[0]
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    for j, tag in enumerate(tags):
        run = p.add_run(tag)
        run.bold = True
        run.font.name = 'Calibri'
        run.font.size = Pt(8)
        if j < len(tags) - 1:
            p.add_run('\n').font.size = Pt(3)

    # Related
    set_cell_bg(cells[4], bg)
    cell_text(cells[4], story['related'], size=8)

    # Priority
    pcolor = {'High': P_HIGH, 'Medium': P_MED, 'Low': P_LOW}.get(story['priority'], ROW_B)
    set_cell_bg(cells[5], pcolor)
    cell_text(cells[5], story['priority'], bold=True, size=9,
              align=WD_ALIGN_PARAGRAPH.CENTER)


# ── Build Document ───────────────────────────────────────────────────────────

def build():
    doc = Document()
    set_landscape_a4(doc)

    # Remove default paragraph style spacing
    style = doc.styles['Normal']
    style.font.name = 'Calibri'
    style.font.size = Pt(10)

    # ── Title Page ────────────────────────────────────────────────────────────
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_para.paragraph_format.space_before = Pt(60)
    title_para.paragraph_format.space_after = Pt(10)
    r = title_para.add_run('TÀI LIỆU USER STORY')
    r.bold = True
    r.font.name = 'Calibri'
    r.font.size = Pt(22)
    r.font.color.rgb = RGBColor.from_string('2E4057')

    sub_para = doc.add_paragraph()
    sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_para.paragraph_format.space_after = Pt(6)
    r2 = sub_para.add_run('TÍCH HỢP THUỘC TÍNH CHẤT LƯỢNG (QA)')
    r2.bold = True
    r2.font.name = 'Calibri'
    r2.font.size = Pt(16)
    r2.font.color.rgb = RGBColor.from_string('4A7AAF')

    for line, sz, bold in [
        ('NovelHub — Nền tảng đọc truyện web tiếng Việt', 12, False),
        ('Phiên bản: 1.0  |  Ngày: 17/05/2026', 10, False),
        ('Giai đoạn: Phase 1 — Content Module & Reading UI', 10, True),
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        rr = p.add_run(line)
        rr.font.name = 'Calibri'
        rr.font.size = Pt(sz)
        rr.bold = bold
        rr.font.color.rgb = RGBColor.from_string('555555')

    doc.add_page_break()

    # ── Purpose paragraph ─────────────────────────────────────────────────────
    intro = doc.add_paragraph()
    intro.paragraph_format.space_before = Pt(0)
    intro.paragraph_format.space_after = Pt(12)
    r_intro = intro.add_run(
        'Tài liệu này trình bày toàn bộ User Story của hệ thống NovelHub, '
        'tích hợp Thuộc tính Chất lượng (Quality Attributes — QA) vào từng tiêu chí '
        'chấp thuận. Mỗi User Story được liên kết với Use Case trong SRS và '
        'Utility Tree để truy vết yêu cầu xuyên suốt vòng đời phát triển.'
    )
    r_intro.font.name = 'Calibri'
    r_intro.font.size = Pt(10)

    # ── Legend ────────────────────────────────────────────────────────────────
    legend_para = doc.add_paragraph()
    r_leg = legend_para.add_run('Chú thích mức độ ưu tiên:  ')
    r_leg.bold = True
    r_leg.font.size = Pt(9)

    for label, color in [('High', P_HIGH), ('Medium', P_MED), ('Low', P_LOW)]:
        r = legend_para.add_run(f'  {label}  ')
        r.bold = True
        r.font.size = Pt(9)

    legend_para.paragraph_format.space_after = Pt(16)

    # ── Sections ──────────────────────────────────────────────────────────────
    for sec in SECTIONS:
        # Section heading
        sh = doc.add_paragraph()
        sh.paragraph_format.space_before = Pt(14)
        sh.paragraph_format.space_after = Pt(2)
        r_sh = sh.add_run(sec['title'])
        r_sh.bold = True
        r_sh.font.name = 'Calibri'
        r_sh.font.size = Pt(13)
        r_sh.font.color.rgb = RGBColor.from_string('2E4057')

        # Focus line
        fp = doc.add_paragraph()
        fp.paragraph_format.space_before = Pt(0)
        fp.paragraph_format.space_after = Pt(6)
        r_fl = fp.add_run('Trọng tâm QA: ')
        r_fl.bold = True
        r_fl.font.name = 'Calibri'
        r_fl.font.size = Pt(10)
        r_fl.font.color.rgb = RGBColor.from_string('4A7AAF')
        r_fv = fp.add_run(sec['focus'])
        r_fv.italic = True
        r_fv.font.name = 'Calibri'
        r_fv.font.size = Pt(10)
        r_fv.font.color.rgb = RGBColor.from_string('555555')

        # Table
        n_stories = len(sec['stories'])
        table = doc.add_table(rows=1, cols=6)
        table.style = 'Table Grid'

        add_header_row(table)
        apply_col_widths(table)

        for idx, story in enumerate(sec['stories']):
            add_story_row(table, story, idx)

        apply_col_widths(table)

        doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # ── Save ─────────────────────────────────────────────────────────────────
    out_path = os.path.join(os.path.dirname(__file__), 'USER-STORY.docx')
    doc.save(out_path)
    total = sum(len(s['stories']) for s in SECTIONS)
    print(f'Saved: {out_path}')
    print(f'  {total} user stories across {len(SECTIONS)} feature groups')


if __name__ == '__main__':
    build()
