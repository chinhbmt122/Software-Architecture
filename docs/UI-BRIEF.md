# NovelHub — UI Design Brief

Use this document as the context/prompt when working with AI UI tools (v0, Bolt, Lovable, etc.).
Paste the **Master Context** block first, then paste the individual **Page Prompt** for the screen you want to design.

---

## Master Context (paste this at the start of every session)

```
I'm redesigning "NovelHub" — a Vietnamese web novel reading platform (translated novels CN/KR/JP → Vietnamese).

Tech stack: Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui (Nova preset), Radix UI primitives.
All generated code must be compatible with this stack.

Design direction:
- Clean, editorial, content-first — the reading experience is the core product
- Dark mode first (most readers use dark/night mode); light mode also supported
- Vietnamese copy throughout (keep all existing Vietnamese text)
- Primary color: use shadcn Nova preset purple (--primary)
- Accent: amber/gold for coins and VIP indicators (#f59e0b / amber-500)
- Accent: emerald for "Ongoing" status (#10b981 / emerald-500)
- Typography: Lora (serif, italic) for chapter content; Inter (sans) for UI
- Responsive: mobile-first, breakpoints sm/md/lg

Tone: calm, premium, focused — similar to Webtoon or Royal Road but more minimalist.

Do not add features that don't exist. Redesign the visual style only, keep the same components and data structure.
```

---

## Page Prompts

### 1. Navigation Header (global, all pages)

**Contains:**
- Logo: BookOpen icon + "NovelHub" text (links to `/`)
- Primary nav (desktop): Thể loại → `/novels` | Bảng xếp hạng → `/novels?sort=trending` | Hoàn thành → `/novels?status=COMPLETED`
- Right actions (guest): Search icon button, Đăng nhập (ghost), Đăng ký (filled)
- Right actions (logged-in): Search icon, CMS link (curators only), Tủ sách link, Coin balance (amber, links to `/pricing`), Notification bell with unread badge, Avatar circle (links to `/settings`)

**Prompt:**
```
Redesign the sticky top navigation bar for NovelHub.
Logo left: BookOpen icon + "NovelHub" bold text.
Center nav (hidden on mobile): "Thể loại", "Bảng xếp hạng", "Hoàn thành" text links.
Right side (logged-in state): search icon button, "Tủ sách" ghost link, amber coin balance "1,200" with Coins icon linking to /pricing, notification bell with a red badge "3", user avatar circle (32px, purple initial or image).
Right side (guest state): search icon, "Đăng nhập" ghost button, "Đăng ký" filled button.
Height: 56px. Sticky with backdrop blur. Border bottom. Supports light and dark mode.
Use shadcn/ui Button, and lucide-react icons. Output React + Tailwind.
```

---

### 2. Home Page

**Contains:**
- Section: "Đặc sắc" — 6-col grid of novel cards (only if featured novels exist)
- Section: "Thịnh hành" — 5-col grid of novel cards (10 items)
- Section: "Mới cập nhật" — 5-col grid of novel cards (10 items)
- Each section has a header with: color accent bar + title + "Xem thêm →" link
- NovelCard: cover image (2:3 ratio), title (2-line truncate), chapter count badge

**Prompt:**
```
Redesign the home page for NovelHub, a Vietnamese novel reading platform.
Three sections: "Đặc sắc" (featured, 6 cols), "Thịnh hành" (trending, 5 cols), "Mới cập nhật" (new, 5 cols).
Each section header: left-side primary-color vertical bar accent + bold title + right-aligned "Xem thêm →" small muted link.
Novel card: 2:3 cover image with rounded corners + shadow, title below (2-line clamp, 13px), subtle chapter-count badge overlay on cover corner.
Grid gaps tight (12px). Sections separated by 40px vertical space.
Max width 1152px, centered, 16px horizontal padding.
Warm dark background (#111) for dark mode. Clean white for light mode.
Output React + Tailwind.
```

---

### 3. Novels List / Browse Page (`/novels`)

**Contains:**
- H1: "Thư viện truyện"
- Search bar (full width, icon left, `name="q"`)
- Status filter pills: Tất cả | Đang ra | Hoàn thành | Tạm dừng | Đã drop (active = filled/inverted)
- Genre filter pills (dynamic list, toggle one at a time, active = primary color)
- Result count: "{n} truyện" small muted text
- Novel grid: 6 cols desktop, 4 cols tablet, 3 cols mobile

**Prompt:**
```
Redesign the novel browse/library page for NovelHub.
Top: H1 "Thư viện truyện". Below: full-width search input with Search icon, placeholder "Tìm kiếm truyện...".
Status filters as pill links: "Tất cả", "Đang ra", "Hoàn thành", "Tạm dừng", "Đã drop". Active pill: dark fill + white text. Inactive: outline.
Genre filters as smaller pill links below. Active genre: primary purple fill.
Result count "40 truyện" in small muted text.
Novel grid: 6 cols (lg) / 4 cols (sm) / 3 cols (default). Cards same as home page.
Padding 32px top/bottom. Max width 1152px centered.
Output React + Tailwind.
```

---

### 4. Novel Detail Page (`/novels/[slug]`)

**Contains:**
- Hero section: blurred cover as full-width background (opacity 30%), gradient fade to bg at bottom
  - Left: cover image (w-52, 2:3, rounded, heavy shadow)
  - Right: title (2xl-3xl bold), status badge (color-coded), language badge, genre badges, stats row (chapters/views/rating), CTA buttons
- CTA buttons: "Tiếp tục đọc" (filled, BookMarked icon) + "Từ đầu" (outline) OR "Đọc từ đầu →" (filled) OR "Chưa có chương" (disabled)
- Follow button (toggle)
- Body: Synopsis section, Tags (# prefixed badges), Reviews, Chapter list, Recommendations

**Chapter list row:** chapter number (mono, muted) | chapter title (truncate) | VIP lock icon (amber) | publish date (right, muted)

**Recommendations section:** "Có thể bạn thích" heading + 6-col novel card grid

**Prompt:**
```
Redesign the novel detail page for NovelHub.

Hero section (full-width): blurred cover image background with 30% opacity + gradient-to-bottom overlay. Inside: flex row with cover image (208px wide, 2:3 ratio, rounded-lg, heavy drop shadow) + info column. Info column: large title, row of colored status badge + language badge + genre badges, stats row (BookOpen chapters, Eye views, Star rating), action buttons row.

Below hero, body in max-w-4xl centered column:
1. "Giới thiệu" label + synopsis paragraph
2. Tag badges with # prefix
3. Reviews section (star ratings, user comments)
4. Chapter list: each row = chapter number (monospace) | title | optional amber lock icon | date right-aligned. Dividers between rows. Hover highlights row.
5. "Có thể bạn thích" grid (6 cols, novel cards)

Supports dark/light mode. Use shadcn/ui Badge, Button, Separator.
Output React + Tailwind.
```

---

### 5. Chapter Reader (`/novels/[slug]/chapters/[number]`)

**Contains:**
- Minimal fixed top bar: back arrow to novel | novel title (truncate) | chapter picker (select) | settings gear icon
- Chapter content area: centered column, max-width controlled by user setting (480–900px), font size/line-height/font family from reader settings
- Bottom navigation: ← Prev chapter | chapter title center | Next chapter →
- Reader Settings Sheet (right side panel):
  - Theme selector: Sáng (light) / Tối (dark) / Đêm (night) — colored buttons
  - Font family: Serif (Lora italic) / Sans (Inter)
  - Font size slider: 14–26px
  - Line height slider: 1.4–2.2×
  - Width slider: 480–900px
- VIP lock state: blurred/faded content + unlock card (coin cost, balance, unlock button)

**Three themes:**
- Sáng: bg #faf9f6, text zinc-800
- Tối: bg #212121, text zinc-200
- Đêm: bg #0f0f0f, text zinc-400

**Prompt:**
```
Redesign the chapter reader page for NovelHub.

Top bar (fixed, minimal, 44px tall): left = back arrow icon + novel title (truncated). Center = chapter selector dropdown. Right = settings gear icon. Semi-transparent with backdrop blur. No heavy borders — subtle bottom border only.

Content area: centered column (default 680px wide, user-adjustable). Chapter title (xl, semi-bold, centered, mb-8). Body text (18px, line-height 1.85, Lora serif italic). No distractions — pure reading.

Bottom nav (fixed): prev chapter link (←) left | current chapter title center | next chapter link (→) right. Translucent background.

Settings drawer (right sheet, 288px): three theme buttons side by side (Sáng/Tối/Đêm) with colored backgrounds matching the theme. Font family toggle (Serif/Sans). Three sliders: font size, line height, width.

VIP locked state overlay: content blurred + centered card "Chương VIP — 1 xu" with coin balance shown + "Mở khoá" button (amber).

Three theme variants:
- Sáng: bg #faf9f6, text #27272a
- Tối: bg #212121, text #e4e4e7
- Đêm: bg #0f0f0f, text #a1a1aa

Output React + Tailwind with dark-mode class support.
```

---

### 6. Sign-in Page (`/sign-in`)

**Contains:**
- Centered card, max-w-sm
- Title "Đăng nhập", subtitle "Chào mừng bạn trở lại"
- Email input (id="email"), Password input (id="password")
- "Quên mật khẩu?" link inline with password label
- Submit button "Đăng nhập" (full width, loading state "Đang đăng nhập...")
- Error message paragraph (destructive color)
- Divider "hoặc"
- "Tiếp tục với Google" outline button
- Footer: "Chưa có tài khoản? Đăng ký" link

**Prompt:**
```
Redesign the sign-in page for NovelHub.
Centered card (max-width 384px) vertically centered on page.
Card header: title "Đăng nhập", subtitle "Chào mừng bạn trở lại".
Form fields: Email (id="email", type="email") and Password (id="password", type="password"). Inline with password label: right-aligned "Quên mật khẩu?" small muted link.
Full-width primary submit button "Đăng nhập".
Red error message paragraph below button (hidden when no error).
"hoặc" divider with horizontal lines.
Outline "Tiếp tục với Google" button with Google icon.
Footer: "Chưa có tài khoản? Đăng ký" centered.
Subtle background pattern or gradient behind the card.
Use shadcn/ui Card, Input, Button, Label. Output React + Tailwind.
```

---

### 7. Sign-up Page (`/sign-up`)

**Contains:**
- Same card layout as sign-in
- Title "Đăng ký", subtitle "Tạo tài khoản mới"
- Name, Email, Password inputs
- Submit button "Tạo tài khoản"
- Google sign-up button
- Footer: "Đã có tài khoản? Đăng nhập"

**Prompt:**
```
Same design as sign-in page but for registration.
Title "Đăng ký", subtitle "Tạo tài khoản mới".
Three fields: Tên hiển thị (text), Email (email), Mật khẩu (password).
Full-width "Tạo tài khoản" button.
Google button. Footer "Đã có tài khoản? Đăng nhập".
```

---

### 8. Pricing / Coin Purchase Page (`/pricing`)

**Contains:**
- Header: Coins icon (amber) + "Nạp xu" title + "1 xu = 1 chương VIP" subtitle
- Guest banner: prompt to sign in
- Grid of coin packages (2–3 cols): each card shows coin amount (large), bonus coins (emerald "+N bonus"), total coins, price in VND, buy button
- "Popular" badge on the mid-tier package (primary color, positioned top center of card)
- Footer note about MoMo Sandbox testing

**Prompt:**
```
Redesign the coin purchase/pricing page for NovelHub.
Center-aligned header: amber Coins icon, H1 "Nạp xu", subtitle "Dùng xu để mở khoá chương VIP. 1 xu = 1 chương VIP."
Package grid (3 cols desktop, 2 cols tablet, 1 col mobile). Each package card:
- Coins amount large (bold, 28px) + Coins icon + green "+N bonus" if applicable
- "Tổng: N xu" small muted
- Price in VND format (bold, 20px)  
- "Mua N xu" full-width button
Popular card: primary purple border + ring + floating "Phổ biến" pill badge at top center.
Footer: small muted note about sandbox testing.
Use shadcn/ui Card, Button, Badge. Output React + Tailwind.
```

---

### 9. Settings Page (`/settings`)

**Contains:**
- H1 "Cài đặt tài khoản"
- Section "Thông tin cá nhân":
  - Email (disabled, read-only, id="email")
  - Tên hiển thị (id="name", maxLength 100)
  - Giới thiệu textarea (id="bio", rows=3, maxLength 300, char counter bottom-right)
  - "Lưu thay đổi" button
- Separator
- Section "Đổi mật khẩu":
  - Mật khẩu hiện tại (id="current-password")
  - Mật khẩu mới (id="new-password", minLength 8)
  - Xác nhận mật khẩu mới (id="confirm-password")
  - "Đổi mật khẩu" button

**Prompt:**
```
Redesign the account settings page for NovelHub.
Max width 576px centered, 40px top padding.
H1 "Cài đặt tài khoản".
Section label "THÔNG TIN CÁ NHÂN" (xs, uppercase, muted). Form fields: Email (disabled/muted bg), Tên hiển thị, Giới thiệu (textarea 3 rows, resize-none, "0/300" char counter bottom-right muted). "Lưu thay đổi" button left-aligned.
Horizontal Separator.
Section label "ĐỔI MẬT KHẨU". Three password fields: current, new, confirm. "Đổi mật khẩu" button.
Use shadcn/ui Input, Textarea, Button, Label, Separator. Output React + Tailwind.
```

---

### 10. Library Page (`/library`)

**Contains:**
- User's saved novels (library entries)
- Grid of novel cards with reading progress indicator
- Filter tabs: Đang đọc | Hoàn thành | Tất cả
- Empty state: icon + "Chưa có truyện nào trong tủ sách"

**Prompt:**
```
Redesign the reading library page for NovelHub.
H1 "Tủ sách". Filter tabs: "Đang đọc" | "Hoàn thành" | "Tất cả".
Novel grid (same card style as home). Each card has a reading progress bar at bottom (thin, primary color, shows % of chapters read).
Empty state: centered BookOpen icon (muted, 48px) + "Chưa có truyện nào trong tủ sách" + "Khám phá truyện" link button.
Use shadcn/ui Tabs, Progress. Output React + Tailwind.
```

---

## Best Practices for Using AI UI Tools

### Tool Recommendation
| Goal | Best Tool |
|---|---|
| Individual component (card, button, form) | **v0.dev** — native shadcn/ui output |
| Full page redesign with Next.js code | **v0.dev** or **Bolt.new** |
| Multi-screen design exploration | **Google Stitch** (free, 350/mo) |
| Full feature with backend logic | **Bolt.new** |

### Rules for Better Output
1. **Always paste the Master Context first** — sets the stack, tone, and color system
2. **One page per session** — don't ask for 5 pages at once; iterate on one
3. **Specify component IDs** — use exact `id="email"` names so Playwright tests still pass
4. **Attach a screenshot** — if you have a current screenshot, upload it and say "improve this"
5. **Iterate, don't restart** — follow up with "make the cards larger", "add hover animation", "use more contrast" rather than rewriting the prompt
6. **For v0 specifically** — mention "shadcn/ui Nova preset" and it will use the right tokens
7. **Copy output back here** — paste the AI-generated component into the right file in this Claude Code session for integration
