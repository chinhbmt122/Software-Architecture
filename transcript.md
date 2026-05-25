Here is the full updated transcript version, with Slide 5 rewritten in the style you meant:

```md
**Slide 1 — NovelHub**

Transcript:  
“Xin chào thầy. Nhóm em làm về một website đọc truyện chữ. Mục tiêu của hệ thống là hỗ trợ người dùng tìm kiếm, đọc truyện, theo dõi tiến độ đọc, tương tác cộng đồng, và mở khóa chương VIP bằng xu hoặc gói trả phí.”

---

**Slide 2 — Project Problem**

Transcript:  
“Vấn đề chính của dự án là làm sao xây dựng một website đọc truyện có trải nghiệm đọc nhanh và mượt trên trình duyệt, đồng thời vẫn đảm bảo bảo mật cho chương VIP và tính đúng đắn của giao dịch xu. Ngoài ra, hệ thống cần có quy trình quản lý nội dung cho curator và công cụ kiểm duyệt cho admin.”

---

**Slide 3 — Users And Scope**

Transcript:  
“Hệ thống có bốn nhóm người dùng chính. Guest có thể xem danh sách truyện, tìm kiếm và đọc chương miễn phí. Reader có thêm thư viện cá nhân, bình luận, đánh giá và mở khóa chương VIP. Curator quản lý truyện và chương. Admin quản lý người dùng, báo cáo vi phạm, kiểm duyệt nội dung và xem audit log.”

---

**Slide 4 — SRS Defines The Product**

Transcript:  
“SRS là tài liệu xác định hệ thống phải làm gì. Trong dự án này, SRS mô tả 23 use case, bao gồm đăng ký, đăng nhập, duyệt truyện, tìm kiếm, đọc chương, theo dõi truyện, bình luận, đánh giá, mua xu, mở khóa chương VIP, quản lý profile, quản lý nội dung và quản trị hệ thống. Các business rule trong SRS giúp nhóm tránh hiểu sai yêu cầu khi triển khai.”

---

**Slide 5 — Quality Drivers**

Transcript:  
“Không phải yêu cầu nào cũng ảnh hưởng mạnh đến kiến trúc. Nhóm chọn ra các quality driver quan trọng, và với mỗi driver nhóm có tactic triển khai cụ thể.

Performance: Đạt mục tiêu đọc chương nhanh và search phản hồi nhanh bằng React Server Components, CDN caching, Cloudinary image optimization, và Meilisearch cho search dưới 500ms.

Security: Bảo vệ đăng nhập, chương VIP và webhook thanh toán bằng Better Auth, httpOnly session cookie, server-side VIP access check, role check cho curator/admin, DOMPurify sanitization, và HMAC-SHA256 verification cho MoMo webhook.

Reliability: Đảm bảo tính đúng đắn của số dư xu bằng database transaction, SELECT FOR UPDATE khi trừ coin balance, coin transaction ledger, và idempotency check để webhook thanh toán lặp lại không cộng xu hai lần.

Availability: Khi Meilisearch lỗi, search module fallback về database query. Với chương miễn phí, CDN có thể phục vụ cached hoặc stale content trong trường hợp origin gặp lỗi.

Modifiability: Áp dụng kiến trúc 4 lớp và module isolation trong `src/modules`, giúp thay đổi search provider, payment provider hoặc module nội dung mà không ảnh hưởng toàn hệ thống.”

---

**Slide 6 — Architecture Overview**

Transcript:  
“Ở kiến trúc tổng thể, nhóm chọn Next.js full-stack monolith. Điều này có nghĩa là cùng một ứng dụng Next.js xử lý cả phần giao diện, server-rendered pages và API routes.

Lý do chọn hướng này là vì dự án có phạm vi vừa phải và nhóm phát triển nhỏ. Nếu tách microservices ngay từ đầu, nhóm sẽ phải quản lý nhiều deployment, nhiều service, API gateway, distributed tracing và các vấn đề giao tiếp giữa service. Điều đó làm tăng độ phức tạp nhưng chưa đem lại nhiều lợi ích ở giai đoạn hiện tại.

Next.js full-stack giúp nhóm có một codebase, một deployment, nhưng vẫn có thể chia module rõ ràng bên trong. Các module như content, reader, monetization, community, search và admin được đặt trong `src/modules`. Nhờ vậy hệ thống vẫn giữ được ranh giới kiến trúc mà không cần tách thành nhiều service riêng.

Ngoài ra, Next.js App Router hỗ trợ server rendering và metadata tốt, phù hợp với website đọc truyện vì SEO rất quan trọng. Các trang danh sách truyện, chi tiết truyện và chương truyện có thể được render từ server để Google dễ index hơn và người dùng nhận nội dung nhanh hơn.”

---

**Slide 7 — Tech Stack And Rationale**

Transcript:  
“Slide này giới thiệu các công nghệ chính nhóm sử dụng trong dự án.

Đầu tiên là Next.js 16 và React 19. Next.js là framework full-stack cho React, hỗ trợ routing, server rendering, API routes và metadata. Trong NovelHub, Next.js phù hợp vì hệ thống cần nhiều trang public như danh sách truyện, chi tiết truyện và chương truyện. Các trang này nên được render từ server để tốt cho SEO.

React 19 được dùng để xây dựng giao diện tương tác, ví dụ form đăng nhập, form bình luận, nút follow truyện, reader settings và các trang quản trị.

Về database, nhóm dùng Neon PostgreSQL. PostgreSQL phù hợp vì hệ thống có nhiều quan hệ dữ liệu như users, novels, chapters, comments, reviews, payments, coin transactions và unlock records. Neon là PostgreSQL dạng managed serverless nên giảm công việc vận hành.

Drizzle ORM được dùng để viết truy vấn database có type-safety. So với việc viết SQL rời rạc, Drizzle giúp code dễ kiểm soát hơn. So với một ORM nặng hơn như Prisma, Drizzle nhẹ và gần với SQL hơn, phù hợp với serverless.

Better Auth được dùng cho đăng nhập, session và xác thực người dùng. Upstash Redis hỗ trợ session, rate limit hoặc dữ liệu tạm thời.

Meilisearch được dùng cho chức năng tìm kiếm truyện vì nó hỗ trợ tìm kiếm nhanh và typo tolerance. Nếu Meilisearch lỗi, hệ thống vẫn có fallback về database search.

Cloudinary dùng để lưu và phục vụ ảnh bìa truyện. MoMo dùng cho flow thanh toán mua xu. Cuối cùng, Playwright được dùng để test UI và integration flow, giúp kiểm tra các luồng như đăng nhập, đọc truyện, thanh toán và admin.”

---

**Slide 8 — Key Architecture Decisions**

Transcript:  
“Slide này nói về các quyết định kiến trúc quan trọng và lý do nhóm chọn chúng.

Quyết định đầu tiên là chọn full-stack monolith thay vì microservices. Microservices có lợi khi hệ thống rất lớn và nhiều team cùng phát triển độc lập. Nhưng với NovelHub, nhóm nhỏ hơn và cần tốc độ triển khai. Vì vậy monolith giúp giảm chi phí vận hành, giảm số lượng service phải deploy, và tránh các vấn đề phức tạp như distributed transaction hoặc tracing giữa service.

Quyết định thứ hai là chọn Drizzle thay vì Prisma. Prisma có developer experience tốt, nhưng query engine của Prisma có thể làm tăng kích thước bundle và cold-start cost trong môi trường serverless. Drizzle nhẹ hơn, gần với SQL hơn, và giúp nhóm kiểm soát transaction rõ hơn, đặc biệt trong các flow liên quan đến xu và thanh toán.

Quyết định thứ ba là dùng Better Auth thay vì tự viết JWT. Tự viết auth dễ tạo ra lỗi bảo mật như session handling sai, cookie config sai, hoặc thiếu CSRF/rate-limit. Better Auth giúp nhóm dựa trên thư viện có sẵn, giảm rủi ro bảo mật và giảm code tự bảo trì.

Quyết định thứ tư là không cache coin balance. Đây là quyết định rất quan trọng. Số dư xu liên quan trực tiếp đến tiền, nếu cache sai hoặc stale thì có thể gây mất tiền hoặc mở khóa sai. Vì vậy coin balance luôn đọc từ database và các thao tác trừ xu luôn nằm trong transaction.

Quyết định thứ năm là dùng Meilisearch cho search nhưng có database fallback. Meilisearch giúp tìm kiếm nhanh và hỗ trợ typo tolerance, nhưng nếu service này gặp lỗi, website không nên trả lỗi trực tiếp cho người dùng. Vì vậy search module có fallback query bằng database để hệ thống vẫn hoạt động ở mức chấp nhận được.

Cuối cùng, VIP chapter được check access ở server-side. Hệ thống không chỉ ẩn nội dung bằng CSS hay JavaScript. Nếu user chưa có quyền, server không render hoặc trả về nội dung chương VIP. Điều này giúp tránh lộ nội dung premium trong HTML hoặc API response.”

---

**Slide 9 — Critical Flow: VIP Chapter Unlock**

Transcript:  
“Đây là luồng quan trọng nhất về mặt kiến trúc. Khi reader mở một chương VIP, hệ thống kiểm tra người dùng đã unlock chưa, có subscription không, hoặc có đủ xu không. Nếu cần trừ xu, hệ thống thực hiện trong một database transaction: trừ coin balance, tạo unlock record và ghi coin transaction. Nếu một bước thất bại, toàn bộ transaction rollback. Vì vậy hệ thống tránh được lỗi trừ xu nhưng không mở khóa, hoặc mở khóa nhưng không ghi ledger.”

---

**Slide 10 — How Documents Connect**

Transcript:  
“Các tài liệu không tách rời nhau. SRS định nghĩa yêu cầu. ASR chọn các yêu cầu có ảnh hưởng kiến trúc. ADD giải thích cách nhóm đưa ra quyết định dựa trên quality attribute. SAD mô tả kiến trúc cuối cùng qua các view, tactic và decision. Cuối cùng RTM kiểm tra lại rằng yêu cầu trong SRS đã có test case tương ứng.”

---

**Slide 11 — Verification With RTM**

Transcript:  
“RTM là bảng traceability giữa requirement và test case. Với mỗi use case trong SRS, RTM chỉ ra các test case backend, UI hoặc integration tương ứng. Backend test kiểm tra logic, authorization, transaction và validation. UI/integration test kiểm tra luồng người dùng thật. Nhờ RTM, nhóm có thể biết yêu cầu nào đã được test đầy đủ, yêu cầu nào mới chỉ partial, và lỗi nào còn liên quan đến defect.”

---

**Slide 12 — Result And Next Steps**

Transcript:  
“Tóm lại, dự án NovelHub không chỉ có phần code mà còn có chuỗi tài liệu giúp kiểm soát quá trình phát triển. SRS giúp xác định đúng yêu cầu. ADD và SAD giúp giải thích và ghi lại kiến trúc. RTM giúp xác minh yêu cầu bằng test. Hướng phát triển tiếp theo là recommendation, analytics, monitoring production và mở rộng thêm payment provider.

Phần trình bày của nhóm em đến đây là hết. Nhóm em xin cảm ơn thầy/cô và các bạn đã lắng nghe.”
```