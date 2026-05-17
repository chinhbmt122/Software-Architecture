# Development Phases
## Novel Reading Web Platform

**Total phases**: 5 (Phase 0 → Phase 4)  
**Last updated**: 2026-05-02

---

## Summary

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 0 | Scaffold · DB schema · Auth | **Complete** |
| Phase 1 | Content module · Curator CMS · Reading UI | **Complete** |
| Phase 2 | Monetization · Coins · MoMo/VNPay payments | Pending |
| Phase 3 | Community · Search · Notifications · Offline | Pending |
| Phase 4 | Admin panel · Analytics · Recommendations | Pending |

---

## Phase 0 — Scaffold + DB Schema + Auth
**Status: Complete**

### What we built
- Next.js 16.2.4 project with App Router, TypeScript, Tailwind v4, shadcn/ui (Nova preset)
- Full DB schema: 24 tables across 6 domain files (`auth`, `content`, `reader`, `community`, `monetization`, `operations`)
- Better Auth: email/password + Google OAuth, HttpOnly session cookies, `proxy.ts` for protected routes
- `@better-auth/infra` dashboard plugin
- All env vars configured, schema pushed to Neon (PostgreSQL, Singapore region)

### SRS requirements covered
`F-50` `F-51` (Google only) `NF-14` `NF-16` `NF-17`

### Verification checklist
- [x] `pnpm dev` starts without errors
- [x] `/sign-up` returns 200, form renders
- [x] `/sign-in` returns 200, form renders
- [x] `/library` returns 307 redirect → `/sign-in` (proxy working)
- [x] Sign up with Google account succeeds
- [x] Sign in with Google account succeeds
- [x] `pnpm db:push` pushes all 24 tables without errors

---

## Phase 1 — Content Module + Curator CMS + Reading UI

### What we will build

#### Backend (`src/modules/content/`)
- Novel CRUD service (create, read, update, delete)
- Chapter CRUD service with scheduling (publish immediately or at future datetime)
- Genre and tag management
- Novel featuring/unfeaturing
- Curator role guard (only users with `role = CURATOR` can write)

#### Frontend — Curator CMS (`src/app/curator/`)
- `/curator/novels` — list all novels with status badges
- `/curator/novels/new` — create novel form (title, synopsis, cover image upload to Cloudinary, genre/tags)
- `/curator/novels/[id]` — edit novel
- `/curator/novels/[id]/chapters` — chapter list
- `/curator/novels/[id]/chapters/new` — add chapter (content editor, VIP toggle, schedule picker)
- `/curator/novels/[id]/chapters/[chapterId]/edit` — edit chapter

#### Frontend — Reader-facing
- `/` — homepage: trending novels, new arrivals, staff picks sections
- `/novels` — browse page with genre/tag filter and status filter
- `/novels/[slug]` — novel detail page: cover, synopsis, genre tags, chapter list, "readers also enjoyed"
- `/novels/[slug]/chapters/[number]` — chapter reader:
  - Customizable font size (5 levels), line spacing, reading width
  - Light / Dark / Sepia themes (follows system preference by default)
  - Estimated reading time display
  - Previous / Next chapter navigation
  - Table of contents sidebar
  - Auto-save reading progress (per user per chapter)
  - "Continue reading" button on novel page resumes exact position

#### Infrastructure
- Upstash Redis cache wired up (`src/lib/redis.ts`)
- Chapter content cached in Redis (24h TTL)
- Trending list cached in Redis (1h TTL)
- Cloudinary integration for cover image upload (`src/lib/cloudinary.ts`)
- `generateMetadata` on novel and chapter pages (Open Graph, Twitter Card, JSON-LD)
- Canonical URLs on all content pages
- `sitemap.ts` in `src/app/` — auto-generates on new novel/chapter publish

### SRS requirements covered
`F-01` `F-02` `F-03` `F-06` `F-07` `F-08` `F-09` `F-10` `F-11` `F-12` `F-13` `F-14` `F-37` `F-38` `F-39` `F-41` `F-42`  
`NF-01` `NF-03` `NF-11` `NF-12` `NF-21` `NF-22` `NF-23` `NF-24`

### Verification checklist
- [ ] Curator can create a novel with cover image, genres, tags
- [ ] Curator can add a chapter (free and VIP) with scheduled publish
- [ ] Curator can edit and delete a chapter
- [ ] Curator can set novel status (Ongoing / Completed / Hiatus / Dropped)
- [ ] Curator can feature/unfeature a novel
- [ ] Homepage shows trending, new arrivals, staff picks
- [ ] Browse page filters by genre, status, rating
- [ ] Novel detail page renders server-side (view source shows content)
- [ ] Chapter reader renders server-side (view source shows content)
- [ ] Font size / theme / line spacing controls work and persist in localStorage
- [ ] Reading progress saves on scroll/leave; "Continue reading" resumes correct position
- [ ] Previous / Next chapter navigation works without full page reload
- [ ] Estimated reading time shows on chapter page
- [ ] Novel page has correct Open Graph tags (`og:title`, `og:description`, `og:image`)
- [ ] Novel page has JSON-LD structured data
- [ ] `/sitemap.xml` returns valid XML with novel and chapter URLs
- [ ] Chapter content served from Redis cache on second request (check Redis dashboard)
- [ ] Non-curator users cannot access `/curator/*` routes (403 or redirect)

---

## Phase 2 — Monetization

### What we will build

#### Backend (`src/modules/monetization/`)
- Coin package service (list available packages)
- MoMo payment initiation + webhook handler (HMAC signature verification)
- VNPay payment initiation + webhook handler
- Chapter unlock service (atomic: deduct coin + insert unlock record)
- Subscription service (create, renew, cancel)
- Transaction history query

#### Frontend
- `/pricing` — subscription plans (Free vs Premium) and coin packages
- `/novels/[slug]/chapters/[number]` — paywall UI for locked VIP chapters
- "Unlock (1 coin)" button → coin deduction flow
- "Buy coins" modal → MoMo/VNPay payment flow
- `/settings/billing` — active subscription, coin balance, transaction history
- Subscription cancel flow

#### User library (`src/modules/reader/`)
- Personal bookshelf (`/library`) — add novels with status: Reading / Completed / On Hold / Plan to Read
- Follow novels for notifications
- Reading history log
- Bookmarks within chapters (mark position + note)
- Reading statistics (total chapters read, time spent, streak)

### SRS requirements covered
`F-17` `F-18` `F-20` `F-21` `F-22` `F-29` `F-30` `F-31` `F-32` `F-33` `F-34` `F-35` `F-36` `F-40`  
`NF-15` `NF-19` `NF-20`

### Verification checklist
- [ ] Curator can mark a chapter as VIP with coin cost
- [ ] VIP chapter shows paywall to unauthenticated users
- [ ] VIP chapter shows paywall to free users without coins
- [ ] "Buy coins" flow initiates MoMo payment and returns deeplink/QR
- [ ] MoMo webhook verifies HMAC signature and rejects invalid requests
- [ ] MoMo webhook credits coins atomically (coin_balance + coin_transactions in one DB transaction)
- [ ] "Unlock" deducts coin atomically (chapter_unlocks + coin_transactions + balance in one transaction)
- [ ] Unlocked chapter is accessible to that user permanently (even after coin balance drops to 0)
- [ ] Premium subscriber can read all VIP chapters without spending coins
- [ ] Subscription auto-renews; cancel sets `cancelAtPeriodEnd = true`
- [ ] Transaction history shows all purchases, unlocks, subscriptions
- [ ] Payment data (card/wallet tokens) is never stored in our DB
- [ ] `/library` shows bookshelf with status tracking
- [ ] Follow novel → appears in followed list
- [ ] Bookmarks save position + note; restore on revisit
- [ ] Reading stats update after finishing a chapter

---

## Phase 3 — Community + Search + Notifications + Offline

### What we will build

#### Search (`src/modules/search/`)
- Meilisearch Cloud integration (`src/lib/meilisearch.ts`)
- Index novel documents on publish/update/delete
- Search API route: `/api/search?q=...`
- Search UI: instant results with typo tolerance, filter by genre/status

#### Community (`src/modules/community/`)
- Chapter-level threaded comments (reply to comment creates thread)
- Novel-level reviews with 1–5 star rating + written body
- Upvote / downvote on comments and reviews
- Curator/admin verified badge on their comments (pinned)
- Follow other readers
- Report system (flag comments, reviews, chapters)

#### Notifications (`src/modules/notifications/`)
- Web push notification setup (Firebase FCM)
- Email digest (batched, not per-event)
- Notification dispatch on new chapter publish to all followers
- `/notifications` page — inbox of unread notifications

#### Offline + sync (`src/modules/reader/`)
- Service Worker for offline chapter caching (pre-download N chapters ahead)
- Reading position sync across devices in real time (via API poll or SSE)

### SRS requirements covered
`F-04` `F-15` `F-16` `F-19` `F-23` `F-24` `F-25` `F-26` `F-27` `F-28`  
`NF-02` `NF-07` `NF-08`

### Verification checklist
- [ ] Search returns results in < 300ms (check Network tab)
- [ ] Search handles typos ("maguc" → "magic")
- [ ] Search filters by genre and status work
- [ ] Meilisearch index updates automatically on novel publish/update/delete
- [ ] If Meilisearch is unavailable, homepage falls back to trending list (no crash)
- [ ] Chapter comments render as threads (replies indented under parent)
- [ ] Novel review saves rating + body; average rating updates on novel page
- [ ] Upvote/downvote changes count correctly; one vote per user
- [ ] Curator/admin comments show verified badge; their replies appear pinned
- [ ] Following a reader appears in their follower list
- [ ] Report modal submits and creates record in `reports` table
- [ ] Push notification arrives after a followed novel publishes a new chapter
- [ ] Email digest sends to followers (check with test email)
- [ ] Pre-downloaded chapters are readable when browser is offline
- [ ] Reading position syncs within 5 seconds across two browser tabs

---

## Phase 4 — Admin Panel + Analytics + Recommendations

### What we will build

#### Admin panel (`src/modules/admin/`, `/admin/*`)
- `/admin/users` — list users, suspend/ban, assign CURATOR role
- `/admin/content` — all novels and chapters, hide/delete any
- `/admin/reports` — review flagged content, resolve or dismiss
- `/admin/analytics` — DAU chart, revenue chart, top novels, churn rate
- Override / undo any curator action (audit trail)

#### Recommendations (`src/modules/search/`)
- pgvector embeddings on novels (via Neon's pgvector extension)
- "Readers also enjoyed" section powered by vector similarity
- Personalized homepage recommendations based on reading history
- Fallback to trending list if recommendation engine fails

#### Account settings
- `/settings/profile` — avatar, display name, bio
- `/settings/notifications` — notification preferences
- `/settings/reading` — default font size, theme, reading width
- `/settings/privacy` — public/private reading stats
- `/settings/account` — delete account (PDPD compliance)

#### Polish
- WCAG 2.1 AA audit and fixes across all reader-facing pages
- Facebook OAuth + Zalo OAuth wired into Better Auth
- Forgot password / reset password flow (email link)
- Rate limiting on auth endpoints (3 failures / 15 min / IP)

### SRS requirements covered
`F-05` `F-07` `F-43` `F-44` `F-45` `F-46` `F-51` (Facebook + Zalo) `F-52` `F-53` `F-54`  
`NF-05` `NF-06` `NF-20` `NF-25` `NF-26` `NF-27`

### Verification checklist
- [ ] Admin can suspend/ban a user; suspended user gets 403 on next request
- [ ] Admin can grant CURATOR role to a user
- [ ] Admin can hide or delete any comment, review, or chapter
- [ ] Admin can view and resolve reports
- [ ] Admin analytics page shows DAU, revenue totals, top 10 novels
- [ ] Audit log records every curator/admin mutation with actor + timestamp
- [ ] "Readers also enjoyed" shows 5 similar novels on novel detail page
- [ ] Homepage shows personalized recommendations for logged-in users
- [ ] Recommendation failure falls back to trending list silently
- [ ] Facebook OAuth and Zalo OAuth complete sign-in successfully
- [ ] Forgot password sends email with reset link; link expires after 1 hour
- [ ] Auth rate limit blocks after 3 failed attempts; unlocks after 15 min
- [ ] Account deletion removes all user PII and anonymizes their content
- [ ] WCAG contrast ratio ≥ 4.5:1 in light mode, ≥ 7:1 in dark mode
- [ ] All interactive elements reachable and operable by keyboard alone
- [ ] Lighthouse accessibility score ≥ 90 on novel and chapter pages

---

## Cross-phase requirements (verified at end of each phase)

| Requirement | How to verify |
|-------------|--------------|
| NF-03: API < 200ms p95 | Check Vercel analytics or add logging |
| NF-09: DB backups | Confirm Neon auto-backup is enabled in dashboard |
| NF-10: Modular monolith | No direct cross-module imports (grep `from "@/modules/X"` inside module Y) |
| NF-18: HTTPS + HSTS | Enforced by Cloudflare — verify after production deploy |
| NF-19: XSS/SQLi prevention | Chapter content rendered via DOMPurify; all DB queries use Drizzle parameterized |
