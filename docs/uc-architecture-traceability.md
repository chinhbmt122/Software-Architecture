# Use Case → Architecture Traceability Analysis

This document traces all 23 use cases through the ADD quality attribute scenarios, SAD architectural decisions and tactics, and the actual implementation files.

---

## UC-01: Register (Email/Password)

**Architectural concern**: None elevated — standard account creation. The concern is downstream: the `users.id` being `text` (not UUID) because Better Auth generates its own IDs, and every FK referencing it must match that type.

**ADD**: No dedicated QA scenario. UC-01 is a prerequisite for UC-02, which carries the security driver.

**SAD decision**: AD-D-05 — Better Auth over custom JWT. All user table columns (`failed_attempts`, `lockedUntil`) are co-created here and relied on by UC-02.

**Tactic**: T-05 (httpOnly session cookie set immediately after registration).

**Implementation**: `src/app/api/auth/[...all]/route.ts` (Better Auth catch-all handler). Schema defined in `src/db/schema/auth.ts`. The `users.id` as `text` is enforced at schema level — all FK references across all 24 tables must use `text` or the DB insert fails.

---

## UC-02: Login (Email/Password) — ASUC

**Architectural concern**: Brute-force credential stuffing. An attacker can automate thousands of login attempts. Concern is both availability (locking legit users) and security (protecting accounts).

**ADD scenario 2.1.4**: After 5 consecutive failures on same account → lock 15 min. Generic error message regardless of which field is wrong (avoids enumeration). Lock triggered at exactly N=5.

**SAD driver**: AD-02. Behavior packet VP-7.1 shows the full sequence: POST → Better Auth → DB increment `failed_attempts` → check threshold → set `lockedUntil` → return 429.

**SAD decisions**:
- AD-D-05: Better Auth manages the rate-limit fields (`failed_attempts`, `lockedUntil`) without custom code
- AD-D-01: Session stored in Upstash Redis (CN-04) with TTL, not a stateless JWT — allows server-side session revocation

**Tactics**: T-04 (failed_attempts counter in DB), T-05 (httpOnly, Secure, SameSite=Lax cookie inaccessible to JS).

**Implementation**: `src/lib/auth.ts` configures Better Auth with the rate-limit plugin. The `users.failed_attempts` and `users.lockedUntil` columns in the auth schema. `src/middleware.ts` (edge runtime) validates the session cookie against Redis on every protected request — it does not re-run the brute-force check, which already happened at sign-in time.

---

## UC-03: Google OAuth Login — ASUC

**Architectural concern**: OAuth CSRF. Without a state parameter, an attacker can craft a malicious redirect that silently links their Google account to a victim's existing account (account hijacking via OAuth).

**ADD**: Covered under 2.1.1 (auth/authorization); the CSRF state concern is noted in SAD §3.5.2 as the key architectural concern for UC-03.

**SAD decision**: AD-D-05 — Better Auth implements the OAuth 2.0 PKCE flow with state parameter verification, handling CSRF by default.

**Tactic**: T-05 (same httpOnly session cookie issued after OAuth callback as after password login).

**Implementation**: `src/lib/auth.ts` configures the Google provider. The OAuth callback route is handled by Better Auth's catch-all at `src/app/api/auth/[...all]/route.ts`. The state parameter and PKCE code verifier are managed by the library — no custom implementation required.

---

## UC-04: Sign Out

**Architectural concern**: Session invalidation must be server-side. If sessions are stateless JWT, sign-out is cosmetic — the token remains valid until expiry. A compromised token could be replayed.

**ADD**: No dedicated scenario. The concern is implied by AD-D-05.

**SAD decision**: AD-D-05 — session-in-Redis model. Sign-out deletes the Redis key (CN-04), making the session immediately invalid everywhere — not just on the current device.

**Implementation**: Better Auth sign-out endpoint via `src/app/api/auth/[...all]/route.ts`. Redis deletion is handled internally by the library on the `POST /api/auth/sign-out` call.

---

## UC-05: Update Profile / Settings

**Architectural concern**: Minor — character limits (display name length), avatar image upload via Cloudinary.

**ADD**: No QA scenario. Covered under SAD §13 as a functional requirement only.

**SAD decision**: No dedicated AD. Cloudinary upload (T-03 / CN-06) applies for avatar images.

**Implementation**: User update API route. User update queries against the `users` table. The architectural concern here is that `coin_balance` must never be updated through this route — only through `deductCoins()` / `completeMomoPayment()`.

---

## UC-06: Change Password

**Architectural concern**: After password change, all existing sessions must be invalidated to prevent a compromised session from persisting. This is different from sign-out (which invalidates one session).

**ADD**: Addressed under 2.1.1 — protected route requiring a valid session before proceeding.

**SAD decision**: AD-D-05 — Better Auth provides `invalidateOtherSessions()` after password change. Session-in-Redis makes this possible since all session keys can be deleted by `userId` prefix.

**Implementation**: `src/app/api/auth/[...all]/route.ts`. The SAD §13 notes "All sessions invalidated on change" — enforced by Better Auth's session management.

---

## UC-07: Browse Novels — ASUC

**Architectural concern**: SEO. The `/novels` page with filter parameters (`?genre=xuanhuan&status=ONGOING`) must return fully server-rendered HTML with correct metadata so Googlebot can crawl and index every filter combination. JavaScript-rendered content is invisible to crawlers.

**ADD scenario 2.2.2**: Every `/novels`, `/novels?genre=X`, and `/novels/{slug}` request must return HTML with `og:title`, `og:description`, `og:image`, and canonical URL. P95 TTFB < 500 ms with warm CDN.

**SAD driver**: AD-06. Behavior narrative F-01 in §5.5.3 traces the full request path.

**SAD decisions**:
- AD-D-01: Next.js App Router RSC pages — server renders the novel grid with filter state, no client-side data fetching needed
- `generateMetadata()` per page (T-11) produces the correct `<head>` on every response

**Tactics**: T-01 (RSC — zero client hydration for the novel grid), T-02 (CDN edge caching for ISR pages), T-11 (server-side metadata generation).

**Implementation**: `src/app/novels/page.tsx` — async RSC that reads URL search params server-side, calls `content.listNovels({ genre, status, page })`, and renders the full grid. `generateMetadata()` in the same file. `src/modules/content/services/novel.service.ts` — `listNovels()` with Drizzle join queries for genre/tag filters.

---

## UC-08: Novel Detail Page

**Architectural concern**: Same SEO concern as UC-07 plus cover image performance. The novel detail page carries the cover image (LCP element on mobile) — if unoptimized, it will dominate the P95 load time metric.

**ADD scenario 2.2.1**: LCP < 2.5 s — dominated by the cover image on detail pages.

**SAD decisions**: AD-D-01 (RSC for server render), T-03 (Cloudinary auto-serves WebP/AVIF based on `Accept` header; Next.js `<Image>` adds `lazy` loading and width/height to prevent layout shift).

**Implementation**: `src/app/novels/[slug]/page.tsx` — RSC that calls `content.getNovel(slug)`, renders chapter list and metadata. Cover images stored in Cloudinary and referenced by CDN URL. `generateMetadata()` produces the novel-specific `og:title`, `og:description`, `og:image`.

---

## UC-09: Read Chapter — ASUC

**Architectural concern**: This is the core product experience — two concerns in one use case:
1. **Performance**: Chapter must render < 1.5 s P95 on 4G mobile. This is the primary revenue-generating interaction.
2. **VIP content gate**: Chapter body text must not appear in server-rendered HTML for unauthorized users — not just hidden by CSS.

**ADD scenarios**:
- 2.2.1: Free chapter read latency — P95 TTI < 1.5 s; LCP < 2.5 s; JS payload < 50 KB; CDN-cached TTFB < 50 ms
- 2.1.2: VIP content protection — chapter body absent from HTML source for unauthorized users; 0 bytes leaked; access check < 15 ms
- 2.5.1: 500 concurrent readers must not exceed P95 1.5 s — CDN absorbs > 80% of repeat chapter reads

**SAD driver**: AD-01 (chapter read latency), AD-02 (VIP gate security).

**SAD decisions**:
- AD-D-01: RSC page renders the chapter server-side. The VIP gate logic executes before any content is included in the response — not a client-side overlay.
- AD-D-03: `monetization.checkAccess()` always reads from DB, never cache. This is the "no cache for coin_balance" rule applied to the read side.

**Tactics**: T-01 (RSC — zero client JS for chapter text), T-02 (CDN caches free chapter HTML; `Cache-Control: s-maxage=60, stale-while-revalidate=3600`), T-03 (Cloudinary for cover image), T-05 (session cookie checked by middleware before RSC executes).

**Behavior packet**: VP-7.4 (read free chapter) and VP-7.2 partial (VIP gate check before unlock).

**Implementation**:
- `src/app/novels/[slug]/chapters/[number]/page.tsx` — RSC. Calls `content.getChapter()` then `monetization.checkChapterAccess(userId, chapterId)`. If `canRead = false`, renders lock overlay with zero chapter content in HTML.
- `src/modules/content/services/chapter.service.ts` — `getChapter()` query.
- `src/modules/monetization/services/unlock.service.ts` — `checkChapterAccess()` runs 4 parallel DB queries (`Promise.all`): chapter VIP flag, existing unlock record, active subscription, current coin balance. The `canRead` result: `!chapter?.isVip || isUnlocked || hasSubscription`.

---

## UC-10: Search Novels — ASUC

**Architectural concern**: Search latency with graceful degradation. Meilisearch is a managed external service that can become unavailable. Without a fallback, search would return errors during any Meilisearch incident. Additionally, Meilisearch must remain replaceable without touching caller code.

**ADD scenarios**:
- 2.2.3: < 500 ms with typo tolerance (Meilisearch path); < 1 s fallback (DB `ilike`); no errors surfaced to caller on Meilisearch failure
- 2.4.2: During Meilisearch outage, search stays functional via DB fallback
- 2.5.2: Index must grow from 100 to 10,000 documents without code changes; provider swap requires only env var change

**SAD driver**: AD-05. No behavior VP (prose narrative only in §5.5.3).

**SAD decisions**:
- AD-D-07: Meilisearch Cloud with `ilike` fallback — the fallback implementation already proves the interface is provider-independent
- AD-D-04: Module isolation — callers call `search.searchNovels()`, never the Meilisearch client directly

**Tactics**: T-09 (dedicated Meilisearch service with pre-built index), T-10 (DB `ilike` fallback on timeout or error).

**Pattern**: Strategy — `searchNovels()` selects between two interchangeable strategies at runtime.

**Implementation**: `src/modules/search/services/search.service.ts` — `getClient()` returns `null` if `MEILISEARCH_URL` is unset, forcing the DB fallback. The try/catch catches any Meilisearch failure and immediately falls through to the Drizzle `ilike` query. The `initSearchIndex()` retry loop handles Meilisearch Cloud's async index creation.

---

## UC-11: Filter Novels

**Architectural concern**: URL-driven filter state for shareability and SEO. Filters applied via JavaScript state (not URL params) are invisible to crawlers and cannot be bookmarked or linked.

**ADD**: Subsumed by scenario 2.2.2 (SEO response requirement).

**SAD decision**: AD-D-01 — RSC pages read URL search params server-side; filter state lives in the URL query string, not React state.

**Implementation**: `src/app/novels/page.tsx` — `searchParams` passed directly to `listNovels()` as server-side arguments. Cloudflare caches each unique filter combination as a separate ISR page.

---

## UC-12: Add/Remove from Library

**Architectural concern**: Optimistic UI — the toggle must feel instant even though it's a DB write. A failed write should revert the UI state gracefully.

**ADD**: No dedicated QA scenario.

**SAD decision**: No architectural decision. Standard module encapsulation via `reader.toggleLibrary()`.

**Implementation**: `src/modules/reader/services/follow.service.ts` — `toggleLibrary()` with an upsert/delete pattern against `library_entries`. The API route returns the new state so the client can confirm or revert.

---

## UC-13: View Library

**Architectural concern**: The library page must show reading progress for each novel. This requires a join between `library_entries` and `reading_progress` — the concern is avoiding N+1 queries per novel in the list.

**ADD**: No dedicated scenario.

**SAD decision**: AD-D-04 (module isolation) — `reader.getLibrary()` owns both `library_entries` and `reading_progress` tables, so the join is legal within the module and does not require cross-module access.

**Implementation**: `src/app/library/page.tsx` RSC. `src/modules/reader/` — `getLibrary()` uses a single Drizzle query with `leftJoin` on `reading_progress` to avoid N+1.

---

## UC-14: Track Reading Progress

**Architectural concern**: Progress must not block chapter rendering. A slow `upsertProgress()` write should not delay the reader seeing the chapter. Upsert semantics must also handle opening the same chapter in two tabs simultaneously.

**ADD**: Addressed implicitly by AD-01 (chapter read latency) — progress tracking is non-blocking.

**SAD behavior packet VP-7.4**: "Progress tracking is conditional on authentication and does not block the render path." The RSC renders the chapter first; progress is updated via a client-side fire-and-forget POST after hydration.

**Implementation**: `src/modules/reader/services/follow.service.ts` — `upsertProgress()` with Drizzle `onConflictDoUpdate` on `(userId, novelId)`, updating `chapterId`, `chapterNumber`, and `updatedAt`. Called from a client component that fires after the chapter page mounts.

---

## UC-15: Follow Novel

**Architectural concern**: Fan-out notification delivery. When a curator publishes a new chapter, every follower must receive a notification. A novel with 10,000 followers requires 10,000 `notifications` INSERTs — this must not block the curator's publish response.

**ADD scenario 2.3.3**: After chapter commit, side effects (Meilisearch indexing + follower notifications) run post-transaction. Side-effect failures must not roll back the chapter.

**SAD decision**: AD-D-04 (module isolation) — the notifications module is called as fire-and-forget after the content module's `createChapter()` commits.

**Pattern**: Observer / Fan-out — `fanOutNewChapterNotification()` is called asynchronously (no `await`) from the chapter publish API route.

**Implementation**: `src/modules/reader/services/notification.service.ts` — `fanOutNewChapterNotification()` queries `novel_follows` for all followers and bulk-inserts notifications. Called from `src/app/api/novels/[id]/chapters/route.ts` (POST) without awaiting.

---

## UC-16: View Coin Balance

**Architectural concern**: The coin balance displayed in the header must reflect the true DB value. If cached in Redis, a user who just unlocked a chapter would see a stale (pre-deduction) balance until the TTL expires — leading to confusion and potential double-spend attempts.

**ADD**: Addressed by constraint DC-05 in ADD §1 and by AD-03 (coin balance integrity).

**SAD decision**: AD-D-03 — `coin_balance` is **never cached**. Every balance display is a live DB read.

**SAD §4.5.5 VP-4.5 constraint DC-05**: "`coin_balance` must not be cached in Redis or any in-memory store."

**Implementation**: `src/modules/monetization/services/unlock.service.ts` — `checkChapterAccess()` queries `users.coinBalance` directly from DB inside `Promise.all`. The header coin balance component calls a similar direct DB read via the monetization module's `getCoinBalance()`. No Redis keys for balance exist anywhere in the codebase.

---

## UC-17: Purchase Coins — ASUC

**Architectural concern**: Two distinct concerns that must both be solved:
1. **Webhook forgery**: Any HTTP client could POST a fake payment-success webhook to credit free coins.
2. **Double-credit**: MoMo retries webhooks if it doesn't receive a 200 within the timeout. The same payment must credit coins exactly once regardless of how many times the webhook arrives.

**ADD scenarios**:
- 2.1.3: HMAC-SHA256 verification before any DB mutation. Invalid signature → HTTP 400 silently. 0 credits issued on invalid signature.
- 2.3.2: Idempotency — check `payments.status` before processing. If already `SUCCESS`, return HTTP 204 with 0 DB writes. Exactly one `coin_transactions` entry per `orderId`.

**SAD driver**: AD-04. Behavior packet VP-7.3 traces the complete flow.

**SAD decisions**:
- AD-D-06: HMAC-SHA256 webhook verification using `MOMO_SECRET_KEY`
- AD-D-03: Atomic DB transaction for payment status update + coin credit + ledger write

**Tactics**: T-06 (DB transaction wrapping the three writes), T-08 (idempotency key check — `payments.status` guard).

**Pattern**: Idempotent Receiver — `completeMomoPayment()` checks `payment.status === 'SUCCESS'` and uses a conditional `UPDATE WHERE status = 'PENDING'` as a race guard.

**Implementation**:
- `src/modules/monetization/services/momo.service.ts` — `verifyMomoIpn()` reconstructs the canonical signature string (same field ordering as MoMo spec) and computes HMAC-SHA256 with `crypto.createHmac`. `completeMomoPayment()` — `if (payment.status === "SUCCESS") return` (idempotency guard); conditional UPDATE `WHERE status = 'PENDING'` (race guard for concurrent deliveries); coin credit + ledger write.
- Note: The current implementation uses `===` for signature comparison rather than a constant-time comparison — a minor timing-attack risk vs. ADD §2.1.3's specification.

---

## UC-18: Unlock VIP Chapter — ASUC

**Architectural concern**: Concurrent unlock race condition. If a user with exactly 1 coin rapidly double-taps or opens two tabs and both requests read the balance simultaneously before either write completes, both could see `balance = 1` and both proceed to unlock — resulting in `balance = -1` and two unlock records.

**ADD scenario 2.3.1**: Two simultaneous unlock requests from user with 1 coin → exactly one succeeds; other returns 402; `coin_balance ≥ 0` always; exactly one `chapter_unlocks` record per `(userId, chapterId)`.

**SAD driver**: AD-03. Behavior packet VP-7.2 traces the sequence showing `SELECT FOR UPDATE` serializing concurrent access.

**SAD decisions**:
- AD-D-03: `db.transaction()` + `SELECT ... FOR UPDATE` on `users.coin_balance`. No Redis cache for balance (DR-04).

**Tactics**: T-06 (atomic DB transaction), T-07 (pessimistic row lock on `users.coin_balance`).

**Pattern**: Idempotent Receiver — if the chapter is already unlocked, `unlockChapter()` returns the current balance without deducting.

**Implementation**: `src/modules/monetization/services/unlock.service.ts` — `unlockChapter()`:
- Pre-flight idempotency check — if `chapterUnlocks` record already exists, returns current balance immediately (no deduction).
- Calls `deductCoins(userId, coinCost, chapterId)` — the `SELECT FOR UPDATE` and atomic transaction must live inside `coin.service.ts` to actually serialize concurrent requests.
- Inserts `chapterUnlocks` record after deduction.

---

## UC-19: Premium Subscription Check

**Architectural concern**: Same as UC-16 and UC-18 — subscription status must be read from DB on every access check, never from cache. A user whose subscription expired must not continue reading VIP chapters.

**ADD**: Addressed by AD-D-03 — "Per-request DB check, no cache" (SAD §13).

**SAD decision**: AD-D-03 extends to subscription status. `monetization.checkSubscription()` queries `subscriptions WHERE status = 'ACTIVE' AND expiresAt > NOW()`.

**Implementation**: `src/modules/monetization/services/unlock.service.ts` — `checkChapterAccess()` includes the subscription query in `Promise.all`, checking `subscriptions.status = 'ACTIVE'` and `subscriptions.expiresAt > new Date()`. The `hasSubscription` flag feeds directly into `canRead = !chapter?.isVip || isUnlocked || hasSubscription`.

---

## UC-20: Write Review

**Architectural concern**: One review per user per novel — enforced at DB level, not application level. If enforced only in code, a race condition (two simultaneous submit clicks) could create duplicates.

**ADD**: No dedicated QA scenario. Covered under community module.

**SAD decision**: AD-D-04 (module isolation) — `community.createReview()` owns the reviews table. The unique constraint `(userId, novelId)` on `reviews` enforces the one-per-user invariant at the DB level via `INSERT ... ON CONFLICT DO UPDATE` (upsert semantics).

**Implementation**: `src/modules/community/services/review.service.ts` — `upsertReview()` uses Drizzle `onConflictDoUpdate` on the unique compound key. After write, recalculates the novel's aggregate rating via an `UPDATE novels SET rating = ...` query.

---

## UC-21: Write Comment

**Architectural concern**: XSS stored injection. If a comment containing `<script>alert(document.cookie)</script>` is stored without sanitization and rendered back to readers, it executes in every reader's browser — a stored XSS attack affecting all users.

**ADD scenario 2.1.5**: Curator Content Sanitization — `DOMPurify.sanitize(content)` before DB INSERT; `<script>` and `on*` handlers stripped; sanitization runs on every save.

**SAD driver**: AD-07. Behavior packet VP-7.5 covers this for chapter content; same tactic applies to comments.

**SAD decision**: AD-D-08 — server-side sanitization with DOMPurify. Client-side sanitization is bypassable by calling the API directly; server-side is authoritative.

**Tactic**: T-12 (server-side sanitization before any DB write).

**Implementation**: `src/modules/community/services/comment.service.ts` — `createComment()` applies `isomorphic-dompurify` sanitization on comment content before the Drizzle INSERT. Same pattern applied in `createChapter()` / `updateChapter()` in the content module.

---

## UC-22: Report Content

**Architectural concern**: Reports must be traceable — a moderation action taken on a report must be auditable (who resolved it, when, what action was taken). This feeds into UC-23's audit requirement.

**ADD**: Covered under AD-08 (admin action auditability). Reports feed the moderation queue.

**SAD decision**: AD-D-09 — audit log in same transaction as action. When an admin resolves a report, the `audit_logs` INSERT and `reports.status` UPDATE are in one transaction.

**Implementation**: `src/modules/community/services/review.service.ts` and comment service — `reportContent()` inserts into the `reports` table. The admin module's `resolveReport()` handles the resolution side with the audit log co-write.

---

## UC-23: Admin Moderation — ASUC

**Architectural concern**: Two concerns:
1. **Role enforcement**: Admin routes must never be reachable by non-admin roles — not just hidden in UI, but blocked at the server.
2. **Audit trail completeness**: Every admin mutation (suspend user, hide content, resolve report) must have a corresponding `audit_logs` record. If the audit log write fails separately from the action, the action is unaudited.

**ADD scenario 2.1.1**: Role mismatch → HTTP 403 before any business logic executes.

**SAD driver**: AD-08. Behavior packet VP-7.6 shows the sequence: middleware role check → admin module → single DB transaction (target update + report resolution + `audit_logs` INSERT) → Meilisearch de-index.

**SAD decisions**:
- AD-D-05: Edge middleware checks `role = ADMIN` before routing to any `/api/admin/*` handler. Returns 403 without hitting business logic for any other role.
- AD-D-09: `audit_logs` INSERT and the action write must be in the same `db.transaction()` call. "Either both commit or neither does" — no unaudited actions, no orphaned audit records.

**Tactics**: T-05 (session cookie role check in middleware), T-13 (audit log in same transaction as admin write).

**Pattern**: Chain of Responsibility — middleware forms a three-stage chain: path classifier → session check → role check. Admin pages fail at the third stage for non-admin roles.

**Implementation**:
- `src/middleware.ts` (edge runtime) — role check against session payload. Redirects to 403 before any serverless function executes.
- `src/modules/admin/services/admin.service.ts` — every write method (`suspendUser()`, `resolveReport()`, `hideContent()`) wraps the action + `audit_logs.insert()` in a single `db.transaction()` call. The `audit_logs` table captures `actorId`, `action`, `targetType`, `targetId`, and `createdAt`.

---

## Summary Matrix

| UC | ADD Scenario | QA Attribute | SAD Decisions | Tactics | Primary Implementation |
|----|-------------|--------------|---------------|---------|------------------------|
| UC-01 | — | — | AD-D-05 | T-05 | `src/lib/auth.ts`, auth schema |
| UC-02 | 2.1.1, 2.1.4 | Security | AD-D-05 | T-04, T-05 | `src/lib/auth.ts`, `users.failed_attempts` |
| UC-03 | 2.1.1 | Security | AD-D-05 | T-05 | `src/lib/auth.ts` (Google provider) |
| UC-04 | — | — | AD-D-05 | T-05 | Better Auth sign-out endpoint |
| UC-05 | — | — | — | — | User update API route |
| UC-06 | 2.1.1 | Security | AD-D-05 | T-05 | Better Auth password change |
| UC-07 | 2.2.2 | SEO | AD-D-01 | T-01, T-02, T-11 | `src/app/novels/page.tsx` |
| UC-08 | 2.2.1, 2.2.2 | Performance, SEO | AD-D-01 | T-01, T-02, T-03, T-11 | `src/app/novels/[slug]/page.tsx` |
| UC-09 | 2.1.2, 2.2.1, 2.5.1 | Security, Performance | AD-D-01, AD-D-03 | T-01, T-02, T-03 | Chapter RSC page, `unlock.service.ts` |
| UC-10 | 2.2.3, 2.4.2, 2.5.2 | Performance, Availability | AD-D-07, AD-D-04 | T-09, T-10 | `search.service.ts` |
| UC-11 | 2.2.2 | SEO | AD-D-01 | T-01, T-11 | `src/app/novels/page.tsx` (URL params) |
| UC-12 | — | — | AD-D-04 | — | `reader` module, `library_entries` |
| UC-13 | — | — | AD-D-04 | — | `src/app/library/page.tsx` |
| UC-14 | 2.2.1 | Performance | AD-D-01 | T-01 | `notification.service.ts:upsertProgress` |
| UC-15 | 2.3.3 | Reliability | AD-D-04 | T-06 | `notification.service.ts:fanOut` (fire-and-forget) |
| UC-16 | 2.3.1 | Reliability | AD-D-03 | — | `unlock.service.ts:checkChapterAccess` (DB read) |
| UC-17 | 2.1.3, 2.3.2 | Security, Reliability | AD-D-06, AD-D-03 | T-06, T-08 | `momo.service.ts` |
| UC-18 | 2.3.1 | Reliability | AD-D-03 | T-06, T-07 | `unlock.service.ts:unlockChapter`, `coin.service.ts` |
| UC-19 | 2.3.1 | Reliability | AD-D-03 | — | `unlock.service.ts:checkChapterAccess` (subscription query) |
| UC-20 | — | — | AD-D-04 | — | `review.service.ts:upsertReview` |
| UC-21 | 2.1.5 | Security | AD-D-08 | T-12 | `comment.service.ts` (DOMPurify on save) |
| UC-22 | 2.1.5, AD-08 | Security, Auditability | AD-D-08, AD-D-09 | T-12, T-13 | `review.service.ts:reportContent` |
| UC-23 | 2.1.1, AD-08 | Security, Auditability | AD-D-05, AD-D-09 | T-05, T-13 | `src/middleware.ts`, `admin.service.ts` |

The architecturally significant use cases — UC-02, UC-09, UC-10, UC-17, UC-18, and UC-23 — are the ones that forced the core architectural decisions. Everything else follows from the structure those decisions established.
