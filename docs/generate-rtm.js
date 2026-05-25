// generate-rtm.js
// Generates docs/RTM.xlsx — Requirements Traceability Matrix for NovelHub
// Usage (from project root): node docs/generate-rtm.js

'use strict';

const ExcelJS = require('exceljs');
const path    = require('path');

const docsDir = __dirname;
const outPath = path.join(docsDir, 'RTM.xlsx');

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  headerBg:    'FF1A3550', headerFg:  'FFFFFFFF',
  subheadBg:   'FF2E6096', subheadFg: 'FFFFFFFF',
  reqRowBg:    'FFD6E4F0',
  altRowBg:    'FFEEF5FB',
  plainRowBg:  'FFFFFFFF',
  border:      'FF2E6096',
  notRunFg:    'FF555555', notRunBg:  'FFF5F5F5',
  partialFg:   'FF8B5E00', partialBg: 'FFFFF0CC',
  notCovFg:    'FF8B0000', notCovBg:  'FFFFCCCC',
  completeFg:  'FF1B5E20', completeBg:'FFD4EDDA',
  blockedFg:   'FF555555', blockedBg: 'FFE0E0E0',
};

const DESIGNER = 'NovelHub QA';
const NOT_RUN  = 'Not Run';
const DONE     = 'Complete';

// ── Column widths ─────────────────────────────────────────────────────────────
const COLS = [
  { key: 'no',        width: 6  },
  { key: 'reqId',     width: 12 },
  { key: 'reqDesc',   width: 26 },
  { key: 'tcId',      width: 22 },
  { key: 'tcDesc',    width: 60 },
  { key: 'design',    width: 12 },
  { key: 'designer',  width: 14 },
  { key: 'uatReq',    width: 12 },
  { key: 'testEnv',   width: 12 },  // I – under "Test Execution"
  { key: 'uatEnv',    width: 12 },  // J
  { key: 'prodEnv',   width: 12 },  // K
  { key: 'defects',   width: 10 },
  { key: 'defectId',  width: 12 },
  { key: 'defStatus', width: 14 },
  { key: 'coverage',  width: 18 },
];

// ── Helper ────────────────────────────────────────────────────────────────────
const t = (tcId, desc, uatReq = 'No') => ({ tcId, desc, uatReq });

// =============================================================================
// BACKEND TESTS
// =============================================================================
const BACKEND_TESTS = [

// ─── UC-01: Register Account ──────────────────────────────────────────────────
{
  reqId:'UC-01', reqDesc:'Register Account', coverage:'Partial', tests:[
  t('TC-BE-01-001','Valid name + email + password → users row created with id, name, email, role=reader, coinBalance=0','Yes'),
  t('TC-BE-01-002','Password stored as bcrypt hash in DB — plaintext never present','Yes'),
  t('TC-BE-01-003','New user assigned role=reader (not curator or admin) by default','Yes'),
  t('TC-BE-01-004','New user assigned coinBalance=0; no coin_transactions row created on registration','Yes'),
  t('TC-BE-01-005','Authenticated session created immediately; session cookie set httpOnly=true','Yes'),
  t('TC-BE-01-006','Session cookie has Secure=true and SameSite=Lax attributes','Yes'),
  t('TC-BE-01-007','Empty display name (BR-01-1) → 400; no user created','No'),
  t('TC-BE-01-008','Name = 101 chars (BR-01-1 max=100) → 400; name = 100 chars → accepted','No'),
  t('TC-BE-01-009','Name with leading/trailing whitespace → 400 (BR-01-1 printable, no surrounding whitespace)','No'),
  t('TC-BE-01-010','Invalid email format "notanemail" (BR-01-2) → 400; no user created','Yes'),
  t('TC-BE-01-011','Email stored lowercase; submission "User@Example.COM" → stored as "user@example.com"','No'),
  t('TC-BE-01-012','Password = 7 chars (BR-01-3 min=8) → 400; no user created','Yes'),
  t('TC-BE-01-013','Password = 8 chars (BR-01-3 boundary) → accepted','Yes'),
  t('TC-BE-01-014','Password = 128 chars (no maximum) → accepted','No'),
  t('TC-BE-01-015','Duplicate email (exact match, BR-01-4) → 409; second user not created','Yes'),
  t('TC-BE-01-016','Duplicate email case-insensitive (BR-01-4): "user@x.com" vs "USER@X.COM" → same account','Yes'),
  t('TC-BE-01-017','callbackUrl = same origin "/library" (BR-01-7) → redirect honoured after registration','No'),
  t('TC-BE-01-018','callbackUrl = external "https://evil.com" (BR-01-7) → rejected; redirect to /','No'),
  t('TC-BE-01-019','Concurrent registration with same email → exactly one user row; second returns 409','Yes'),
  t('TC-BE-01-020','Missing required field (email omitted) → 400 with field-level error','No'),
]},

// ─── UC-02: Sign In with Email ────────────────────────────────────────────────
{
  reqId:'UC-02', reqDesc:'Sign In with Email', coverage:'Partial', tests:[
  t('TC-BE-02-001','Correct email + password → session row created in sessions table','Yes'),
  t('TC-BE-02-002','Correct credentials → httpOnly, Secure, SameSite=Lax session cookie set','Yes'),
  t('TC-BE-02-003','Wrong password → generic MSG-002 returned; response body does not reveal if email exists','Yes'),
  t('TC-BE-02-004','Non-existent email → exact same error body as wrong-password (no enumeration, BR-02-1)','Yes'),
  t('TC-BE-02-005','1st–9th consecutive failed attempts: each blocked, counter increments','Yes'),
  t('TC-BE-02-006','10th failed attempt in 15-min window → IP rate-limited; 429 returned (BR-02-3)','Yes'),
  t('TC-BE-02-007','After rate-limit: correct credentials still blocked until 15-min window expires','Yes'),
  t('TC-BE-02-008','Rate-limit counter resets after 15 min (new window allows login again)','No'),
  t('TC-BE-02-009','rememberMe=true → session TTL=2592000 s (30 days, BR-02-3)','No'),
  t('TC-BE-02-010','rememberMe=false (default) → session TTL=86400 s (1 day)','No'),
  t('TC-BE-02-011','Same-origin callbackUrl=/library honored after sign-in (BR-02-4)','No'),
  t('TC-BE-02-012','External callbackUrl rejected; redirected to / (BR-02-4)','No'),
  t('TC-BE-02-013','Google-only account email submitted to email sign-in → appropriate error returned','No'),
  t('TC-BE-02-014','Email comparison case-insensitive (stored lowercase, submitted uppercase → matches)','No'),
]},

// ─── UC-03: Sign In with Google ───────────────────────────────────────────────
{
  reqId:'UC-03', reqDesc:'Sign In with Google', coverage:'Partial', tests:[
  t('TC-BE-03-001','Completely new Google identity → users row created: role=reader, coinBalance=0','Yes'),
  t('TC-BE-03-002','New Google user → display name sourced from Google profile (BR-03-3)','No'),
  t('TC-BE-03-003','New Google user → passwordHash is null in users table (BR-03-4)','No'),
  t('TC-BE-03-004','Google email matches existing email/password account → accounts row linked; no new user (BR-03-1)','Yes'),
  t('TC-BE-03-005','Linked account: subsequent sign-in with same Google subject returns existing user (BR-03-2)','Yes'),
  t('TC-BE-03-006','Same Google subject revisited → no duplicate users row created (BR-03-2)','Yes'),
  t('TC-BE-03-007','OAuth state parameter (CSRF nonce) mismatch → request rejected, no user created','Yes'),
  t('TC-BE-03-008','OAuth code exchange fails (Google error) → redirect to /sign-in, no user (BR-03-5)','Yes'),
  t('TC-BE-03-009','User cancels Google consent → redirect to /sign-in, no user (BR-03-5)','Yes'),
  t('TC-BE-03-010','Google access/refresh tokens NOT stored in any DB table (BR-03-4)','No'),
]},

// ─── UC-04: Sign Out ──────────────────────────────────────────────────────────
{
  reqId:'UC-04', reqDesc:'Sign Out', coverage:'Partial', tests:[
  t('TC-BE-04-001','Sign-out POST → session row deleted from sessions table (BR-04-1)','Yes'),
  t('TC-BE-04-002','Response header sets session cookie Max-Age=0 (BR-04-2)','Yes'),
  t('TC-BE-04-003','Old session token reused after sign-out → 401 Unauthorized','Yes'),
  t('TC-BE-04-004','Sign-out redirects to / (BR-04-3); never to a protected page','Yes'),
  t('TC-BE-04-005','Unauthenticated POST to sign-out → handled gracefully (200 or 401, no 500)','No'),
  t('TC-BE-04-006','All other sessions for the same user remain valid after single sign-out','No'),
]},

// ─── UC-05: Reset Password ────────────────────────────────────────────────────
{
  reqId:'UC-05', reqDesc:'Reset Password', coverage:'Partial', tests:[
  t('TC-BE-05-001','Known email → token generated and reset email sent (BR-05-2)','Yes'),
  t('TC-BE-05-002','Unknown email → neutral MSG-024 shown; no verifications row created (BR-05-1)','Yes'),
  t('TC-BE-05-003','Response body identical whether email found or not (no enumeration, BR-05-1)','Yes'),
  t('TC-BE-05-004','Reset token stored as SHA-256 hash; raw token never in DB (BR-05-2)','Yes'),
  t('TC-BE-05-005','Token expires after 3600 s: use after expiry → 400/410 (BR-05-3)','Yes'),
  t('TC-BE-05-006','Token at exactly 3599 s → accepted; at 3601 s → rejected (boundary)','No'),
  t('TC-BE-05-007','Token single-use: successful reset then reuse same token → rejected (BR-05-4)','Yes'),
  t('TC-BE-05-008','New password = 7 chars → rejected 400 (BR-05-5)','Yes'),
  t('TC-BE-05-009','New password = 8 chars (boundary) → accepted','Yes'),
  t('TC-BE-05-010','New password same as current → rejected with MSG-017 (BR-05-5)','No'),
  t('TC-BE-05-011','Successful reset → all other sessions for that user invalidated (BR-05-4)','Yes'),
  t('TC-BE-05-012','Successful reset → redirect to /sign-in with MSG-004','No'),
  t('TC-BE-05-013','Google-only account POST to reset-password endpoint → error (BR-05-6)','No'),
  t('TC-BE-05-014','Second reset request for same email → old token invalidated; new token sent','No'),
]},

// ─── UC-06: Browse Novel List ─────────────────────────────────────────────────
{
  reqId:'UC-06', reqDesc:'Browse Novel List', coverage:'Partial', tests:[
  t('TC-BE-06-001','Default response: published novels sorted by updatedAt DESC (BR-06-1)','No'),
  t('TC-BE-06-002','page=1 returns first 30 novels; page=2 returns next 30 (BR-06-3)','No'),
  t('TC-BE-06-003','page beyond total pages → empty array returned (no 500)','No'),
  t('TC-BE-06-004','status=COMPLETED → only COMPLETED novels in results (BR-06-4)','Yes'),
  t('TC-BE-06-005','status=ONGOING → only ONGOING novels','Yes'),
  t('TC-BE-06-006','status=HIATUS → only HIATUS novels','No'),
  t('TC-BE-06-007','status=DROPPED → only DROPPED novels','No'),
  t('TC-BE-06-008','Unknown status value → falls back to no filter; all published novels returned (BR-06-4)','No'),
  t('TC-BE-06-009','genre=<id> → only novels with that genre in results (BR-06-5)','Yes'),
  t('TC-BE-06-010','Multiple genre params → only first applied (BR-06-5)','No'),
  t('TC-BE-06-011','sort=trending → ordered by totalViews DESC (BR-06-2)','No'),
  t('TC-BE-06-012','sort=rating → ordered by avgRating DESC','No'),
  t('TC-BE-06-013','sort=chapters → ordered by totalChapters DESC','No'),
  t('TC-BE-06-014','sort=unknown → falls back to updatedAt; no 400 (BR-06-2)','No'),
  t('TC-BE-06-015','Combined status=COMPLETED + genre → AND-filtered results','No'),
  t('TC-BE-06-016','Zero-match filter combination → empty array + result count 0 (BR-06-6)','No'),
  t('TC-BE-06-017','DRAFT novels never appear in public browse results','Yes'),
  t('TC-BE-06-018','page=0 → treated as page=1; first 30 results returned (no 400)','No'),
  t('TC-BE-06-019','page=-1 or page=NaN → defaults to page=1; no 500 error','No'),
  t('TC-BE-06-020','limit query param ignored; server enforces fixed page size of 30 (BR-06-3)','No'),
  t('TC-BE-06-021','sort=rating: novels with avgRating=null sorted after rated novels (nulls last)','No'),
  t('TC-BE-06-022','Triple combination: status + genre + sort → results satisfy all three constraints','No'),
]},

// ─── UC-07: Search Novels ─────────────────────────────────────────────────────
{
  reqId:'UC-07', reqDesc:'Search Novels', coverage:'Partial', tests:[
  t('TC-BE-07-001','Meilisearch exact-title query returns correct novel in < 500 ms P95','Yes'),
  t('TC-BE-07-002','Empty query string → Meilisearch not called; full novel list returned (BR-07-1)','No'),
  t('TC-BE-07-003','Query with 1-char typo returns matching novel (BR-07-4 typo tolerance)','Yes'),
  t('TC-BE-07-004','Search scope: matches title and synopsis; genre/tag names not indexed (BR-07-3)','No'),
  t('TC-BE-07-005','Meilisearch slow (> 400 ms) → DB ILIKE fallback triggered (BR-07-5)','Yes'),
  t('TC-BE-07-006','Meilisearch throws error → DB ILIKE fallback executes','Yes'),
  t('TC-BE-07-007','DB fallback returns results within 1 s','Yes'),
  t('TC-BE-07-008','Both Meilisearch and DB fail → empty array returned; no exception thrown','Yes'),
  t('TC-BE-07-009','MEILISEARCH_API_KEY not present in any response body or header','Yes'),
  t('TC-BE-07-010','Search + status=COMPLETED → AND-filtered (BR-07-6)','No'),
  t('TC-BE-07-011','Search + genre filter → AND-filtered in same Meilisearch request','No'),
  t('TC-BE-07-012','Vietnamese diacritics: "thánh nhân" query matches "Thánh Nhân Lộ" correctly','No'),
  t('TC-BE-07-013','Special chars in query (quotes, slashes) do not cause 500 or injection','No'),
  t('TC-BE-07-014','Meilisearch index updated within 60 s of chapter PUBLISHED status change','Yes'),
  t('TC-BE-07-015','Single-char query returns results; no minimum query-length enforced','No'),
  t('TC-BE-07-016','200-char query handled gracefully; no 500 or timeout','No'),
  t('TC-BE-07-017','10 concurrent search requests → all return 200; no race conditions or contention','No'),
  t('TC-BE-07-018','Case-insensitive matching: "THIEN DAO" query matches novel with Vietnamese title','No'),
]},

// ─── UC-08: Filter Novels ─────────────────────────────────────────────────────
{
  reqId:'UC-08', reqDesc:'Filter Novels', coverage:'Partial', tests:[
  t('TC-BE-08-001','status + genre filter AND-combined in single DB/search query (BR-08-5)','No'),
  t('TC-BE-08-002','Toggling active status filter removes param; full list restored (BR-08-1)','No'),
  t('TC-BE-08-003','Toggling active genre filter removes param (BR-08-2)','No'),
  t('TC-BE-08-004','URL ?status=COMPLETED&genre=X on reload → identical view restored (BR-08-3)','No'),
  t('TC-BE-08-005','Genre options sourced from DB genres table; no hardcoded list','No'),
  t('TC-BE-08-006','Unknown genre ID returns empty result, not 500','No'),
  t('TC-BE-08-007','Result count reflects filter combination accurately (BR-08-4)','No'),
  t('TC-BE-08-008','Filter + pagination: ?status=COMPLETED&page=2 → correct page within filtered subset','No'),
  t('TC-BE-08-009','Genre ID with SQL injection attempt → safe; 400 or empty result; no 500','No'),
  t('TC-BE-08-010','?status=completed (lowercase) → treated same as COMPLETED or ignored; no 500','No'),
  t('TC-BE-08-011','Multiple ?status= params → first value used; subsequent values silently ignored','No'),
  t('TC-BE-08-012','All active filters cleared simultaneously → full novel list restored without reload','No'),
]},

// ─── UC-09: View Novel Detail ─────────────────────────────────────────────────
{
  reqId:'UC-09', reqDesc:'View Novel Detail', coverage:'Partial', tests:[
  t('TC-BE-09-001','Valid slug → 200 with full novel data','Yes'),
  t('TC-BE-09-002','Non-existent slug → 404 (BR-09-1)','Yes'),
  t('TC-BE-09-003','DRAFT chapters excluded from public chapter list (BR-09-3)','Yes'),
  t('TC-BE-09-004','Future-scheduled chapters (publishedAt > now) excluded','Yes'),
  t('TC-BE-09-005','Response <head> includes og:title matching novel title','Yes'),
  t('TC-BE-09-006','Response <head> includes og:description','Yes'),
  t('TC-BE-09-007','Response <head> includes canonical URL for the novel detail page','Yes'),
  t('TC-BE-09-008','totalViews incremented fire-and-forget; page load not blocked (BR-09-2)','No'),
  t('TC-BE-09-009','Authenticated reader: reading_progress fetched; "Tiếp tục đọc" CTA populated','No'),
  t('TC-BE-09-010','No reading progress → "Đọc từ đầu" CTA (first chapter link)','No'),
  t('TC-BE-09-011','No published chapters → "Chưa có chương" disabled CTA','No'),
  t('TC-BE-09-012','Novel with no reviews → avgRating not displayed (BR-09-6)','No'),
  t('TC-BE-09-013','Recommendations: ≤6 same-genre novels, current novel excluded (BR-09-5)','No'),
  t('TC-BE-09-014','VIP chapters show isVip=true flag in chapter list (BR-09-4)','Yes'),
  t('TC-BE-09-015','Cover image URL is Cloudinary CDN domain','No'),
  t('TC-BE-09-016','Redis cache hit: second request for same novel slug served from cache in < 10 ms','No'),
  t('TC-BE-09-017','Cache invalidated on novel update; subsequent request hits DB and refreshes cache','No'),
  t('TC-BE-09-018','og:image meta tag set to coverUrl when cover is present; absent otherwise','No'),
  t('TC-BE-09-019','Novel with 0 published chapters: chapter list is empty array; no error thrown','No'),
  t('TC-BE-09-020','totalChapters field matches exact count of PUBLISHED chapters in DB','No'),
]},

// ─── UC-10: Read Chapter ──────────────────────────────────────────────────────
{
  reqId:'UC-10', reqDesc:'Read Chapter', coverage:'Partial', tests:[
  t('TC-BE-10-001','Free chapter: full content in server HTML response for unauthenticated guest','Yes'),
  t('TC-BE-10-002','Free chapter: no authentication required (BR-10-3 guest allowed)','Yes'),
  t('TC-BE-10-003','Free chapter Cache-Control: s-maxage=60, stale-while-revalidate=3600','No'),
  t('TC-BE-10-004','VIP chapter: content=null in server response for unauthenticated guest (BR-10-2)','Yes'),
  t('TC-BE-10-005','VIP chapter: content NOT hidden via CSS — completely absent from HTML (BR-10-2)','Yes'),
  t('TC-BE-10-006','VIP chapter: content=null for authenticated reader with 0 coins and no subscription','Yes'),
  t('TC-BE-10-007','VIP chapter: full content returned after reader completes coin unlock (BR-10-1)','Yes'),
  t('TC-BE-10-008','VIP chapter: full content returned for reader with active subscription (BR-10-1)','Yes'),
  t('TC-BE-10-009','VIP access check queries chapter_unlocks table in DB — not Redis (BR-10-1)','Yes'),
  t('TC-BE-10-010','VIP access check queries subscriptions table in DB — not Redis','Yes'),
  t('TC-BE-10-011','checkAccess() called before chapter content DB query (access-first ordering, BR-10-1)','Yes'),
  t('TC-BE-10-012','Non-existent chapter number → 404','Yes'),
  t('TC-BE-10-013','DRAFT chapter → 404 for public access (not visible to readers)','Yes'),
  t('TC-BE-10-014','Future-scheduled chapter (publishedAt > now) → 404 or 403 for readers','Yes'),
  t('TC-BE-10-015','Prev chapter link correct (BR-10-6): chapter 3 prev = chapter 2','No'),
  t('TC-BE-10-016','Next chapter link absent for last chapter (BR-10-6)','No'),
  t('TC-BE-10-017','Reading time estimate = ceil(wordCount / 250) minutes (BR-10-5)','No'),
  t('TC-BE-10-018','Authenticated: reading_progress upserted after chapter load (BR-10-4)','Yes'),
  t('TC-BE-10-019','Re-reading earlier chapter: progress NOT overwritten (forward-only, BR-10-4)','Yes'),
  t('TC-BE-10-020','Chapter content page JS payload < 50 KB (RSC — no client hydration)','No'),
  t('TC-BE-10-021','incrementChapterViews fires without blocking response (fire-and-forget)','No'),
]},

// ─── UC-11: Reader Settings ───────────────────────────────────────────────────
{
  reqId:'UC-11', reqDesc:'Adjust Reader Settings', coverage:'Partial', tests:[
  t('TC-BE-11-001','Default settings: theme=dark, font=serif, fontSize=18, lineHeight=1.85, width=680 (BR-11-1)','No'),
  t('TC-BE-11-002','Settings stored in localStorage key "reader-settings" as JSON (BR-11-2)','No'),
  t('TC-BE-11-003','No API call or DB write on settings change (BR-11-4)','No'),
  t('TC-BE-11-004','Theme change applies to .chapter-content only; site header unaffected (BR-11-3)','No'),
  t('TC-BE-11-005','Dark theme class applied before first paint via inline script (no flash)','No'),
  t('TC-BE-11-006','fontSize slider range 14–26 px; values outside range rejected by UI','No'),
  t('TC-BE-11-007','lineHeight slider range 1.4–2.2; step 0.1','No'),
  t('TC-BE-11-008','contentWidth slider range 480–900 px; step 10','No'),
  t('TC-BE-11-009','Corrupted JSON in localStorage "reader-settings" → defaults applied; no runtime error','No'),
  t('TC-BE-11-010','localStorage key absent (first visit) → all defaults applied without throwing','No'),
  t('TC-BE-11-011','Settings are scoped to browser localStorage; clearing localStorage resets to defaults','No'),
]},

// ─── UC-12: Follow Novel ──────────────────────────────────────────────────────
{
  reqId:'UC-12', reqDesc:'Follow Novel', coverage:'Partial', tests:[
  t('TC-BE-12-001','Follow: novel_follows row inserted for (userId, novelId)','Yes'),
  t('TC-BE-12-002','Follow without session → 401 (BR-12-1)','Yes'),
  t('TC-BE-12-003','Duplicate follow (INSERT ON CONFLICT DO NOTHING, BR-12-2) → 200, no duplicate row','Yes'),
  t('TC-BE-12-004','Unfollow: novel_follows row deleted','Yes'),
  t('TC-BE-12-005','Double unfollow → no error; idempotent (BR-12-2)','No'),
  t('TC-BE-12-006','Follow non-existent novel → 404','No'),
  t('TC-BE-12-007','Follow state drives notification fan-out on chapter publish (BR-12-3)','No'),
  t('TC-BE-12-008','Follow count accurately reflects novel_follows rows for that novel','No'),
]},

// ─── UC-13: Track Reading Progress ───────────────────────────────────────────
{
  reqId:'UC-13', reqDesc:'Track Reading Progress', coverage:'Partial', tests:[
  t('TC-BE-13-001','First visit to a chapter → reading_progress row inserted (BR-13-2)','Yes'),
  t('TC-BE-13-002','Second visit to same chapter → only one row exists (composite PK, BR-13-2)','Yes'),
  t('TC-BE-13-003','Re-reading earlier chapter → progress row NOT downgraded (forward-only, BR-13-1)','Yes'),
  t('TC-BE-13-004','Reading higher chapter number → progress row updated to new chapter (BR-13-1)','Yes'),
  t('TC-BE-13-005','Unauthenticated read → no reading_progress write (BR-13-4)','Yes'),
  t('TC-BE-13-006','Progress save does not block chapter page render (fire-and-forget)','Yes'),
  t('TC-BE-13-007','Progress percentage = ceil(lastChapterNumber / totalChapters * 100), max 100 (BR-13-3)','No'),
  t('TC-BE-13-008','Novel detail "Tiếp tục đọc" CTA uses stored lastChapterNumber','No'),
]},

// ─── UC-14: View Library ──────────────────────────────────────────────────────
{
  reqId:'UC-14', reqDesc:'View Library', coverage:'Partial', tests:[
  t('TC-BE-14-001','/library → 401/redirect for unauthenticated guest (BR-14-1)','Yes'),
  t('TC-BE-14-002','Library lists novel_follows joined with novels for authenticated user','Yes'),
  t('TC-BE-14-003','"Đang đọc" tab: novels where lastChapterNumber < totalChapters','No'),
  t('TC-BE-14-004','"Hoàn thành" tab: novels where lastChapterNumber >= totalChapters','No'),
  t('TC-BE-14-005','"Tất cả" tab: all followed novels regardless of progress (BR-14-4 default)','No'),
  t('TC-BE-14-006','No followed novels → empty state with link to /novels (BR-14-3)','No'),
  t('TC-BE-14-007','Progress bar value = lastChapterNumber / totalChapters (BR-14-2)','No'),
  t('TC-BE-14-008','Library data is DB-backed — localStorage clear does not affect it','No'),
]},

// ─── UC-15: Write Review ──────────────────────────────────────────────────────
{
  reqId:'UC-15', reqDesc:'Write Review', coverage:'Not Covered', tests:[
  t('TC-BE-15-001','Review create → 401 for unauthenticated user (BR-15-1)','Yes'),
  t('TC-BE-15-002','First review: reviews row inserted with userId, novelId, rating, body','Yes'),
  t('TC-BE-15-003','Second review same user+novel → upserts (updates) existing row — no duplicate (BR-15-2)','Yes'),
  t('TC-BE-15-004','Rating = 0 → 400 rejected (BR-15-3 min=1)','Yes'),
  t('TC-BE-15-005','Rating = 6 → 400 rejected (BR-15-3 max=5)','Yes'),
  t('TC-BE-15-006','Rating = 1 and = 5 (boundaries) → accepted','Yes'),
  t('TC-BE-15-007','Body omitted (null/empty) → accepted (BR-15-4 optional)','No'),
  t('TC-BE-15-008','Body = 2001 chars → 400; body = 2000 chars → accepted (BR-15-4)','No'),
  t('TC-BE-15-009','avgRating on novels row recalculated after review upsert (BR-15-5)','No'),
  t('TC-BE-15-010','Review delete: own review deleted; avgRating recalculated (BR-15-6)','No'),
  t('TC-BE-15-011','Review delete: attempting to delete another user\'s review → 403','No'),
  t('TC-BE-15-012','Review vote: duplicate vote (same userId+reviewId) → no-op, no error','No'),
  t('TC-BE-15-013','Review list for novel paginated at 20 per page (BR-15-7 if defined)','No'),
  t('TC-BE-15-014','Review upvote: review_votes row inserted; voteCount on review increments','No'),
  t('TC-BE-15-015','Review vote on own review → rejected with 403 (BR-15-8)','No'),
  t('TC-BE-15-016','Review body with XSS attempt: <script>alert(1)</script> stripped; plain text stored','No'),
  t('TC-BE-15-017','Review update by author: new rating and body replace old values in DB','No'),
]},

// ─── UC-16: Leave Comment ─────────────────────────────────────────────────────
{
  reqId:'UC-16', reqDesc:'Leave Comment', coverage:'Not Covered', tests:[
  t('TC-BE-16-001','Comment create → 401 for unauthenticated user (BR-16-1)','Yes'),
  t('TC-BE-16-002','Valid comment → comments row with userId, targetType, targetId, content, parentId=null','Yes'),
  t('TC-BE-16-003','Empty comment body → 400 (BR-16-2 non-empty)','Yes'),
  t('TC-BE-16-004','Comment = 1001 chars → 400; = 1000 chars → accepted (BR-16-2 max)','No'),
  t('TC-BE-16-005','Reply with valid parentId (parent.parentId===null) → accepted (BR-16-3)','No'),
  t('TC-BE-16-006','Reply to a reply (parent.parentId !== null) → 400 depth guard (BR-16-3)','No'),
  t('TC-BE-16-007','Invalid (non-existent) parentId → 400 (BR-16-3)','No'),
  t('TC-BE-16-008','Comment within 15 min: edit allowed for owner (BR-16-4)','No'),
  t('TC-BE-16-009','Comment after 15 min: edit rejected for reader; admin still allowed (BR-16-4)','No'),
  t('TC-BE-16-010','Hidden comment (isHidden=true) not returned by public findAll (BR-16-5)','No'),
  t('TC-BE-16-011','Top-level comments sorted by createdAt DESC (newest first, BR-16-6)','No'),
  t('TC-BE-16-012','Replies sorted by createdAt ASC (oldest first, BR-16-6)','No'),
  t('TC-BE-16-013','Comment vote: duplicate vote (same userId+commentId) → no-op (idempotent)','No'),
  t('TC-BE-16-014','Admin hides comment: isHidden=true in DB; hidden comment absent from public response','No'),
  t('TC-BE-16-015','Report comment: reports row created with targetType=comment, targetId=commentId','No'),
  t('TC-BE-16-016','Comment body with XSS: <script> tag stripped before DB write','No'),
  t('TC-BE-16-017','Comment list paginated at 20 per page; page 2 returns next 20 comments','No'),
  t('TC-BE-16-018','targetType=novel vs targetType=chapter correctly stored per request context','No'),
]},

// ─── UC-17: Purchase Coins via MoMo ──────────────────────────────────────────
{
  reqId:'UC-17', reqDesc:'Purchase Coins via MoMo', coverage:'Partial', tests:[
  t('TC-BE-17-001','payments row with status=PENDING, orderId, userId, amountVnd created before redirect (step 4)','Yes'),
  t('TC-BE-17-002','Each payment initiation produces a unique orderId','Yes'),
  t('TC-BE-17-003','Unauthenticated user cannot initiate coin purchase → 401','Yes'),
  t('TC-BE-17-004','Initiation with inactive coin package → 404/400','No'),
  t('TC-BE-17-005','Valid HMAC-SHA256 signature → webhook proceeds','Yes'),
  t('TC-BE-17-006','Invalid HMAC → 400 returned; no coins credited; no DB write','Yes'),
  t('TC-BE-17-007','Missing HMAC field entirely → 400','Yes'),
  t('TC-BE-17-008','Empty string HMAC → 400','Yes'),
  t('TC-BE-17-009','HMAC comparison must be constant-time (prevent timing attacks)','Yes'),
  t('TC-BE-17-010','resultCode=0 (success): coins credited, status=COMPLETED, coin_transactions created','Yes'),
  t('TC-BE-17-011','resultCode≠0 (failure): payments.status=FAILED; users.coinBalance unchanged','Yes'),
  t('TC-BE-17-012','resultCode≠0: no coin_transactions row written','Yes'),
  t('TC-BE-17-013','coinBalance increment + coin_transactions insert in single DB transaction (BR atomic)','Yes'),
  t('TC-BE-17-014','Transaction partial failure rolls back both coinBalance and coin_transactions','Yes'),
  t('TC-BE-17-015','orderId already SUCCESS: second webhook → 200; coinBalance unchanged (idempotency)','Yes'),
  t('TC-BE-17-016','orderId already SUCCESS: no second coin_transactions row inserted','Yes'),
  t('TC-BE-17-017','orderId already FAILED: second webhook with resultCode=0 → re-process or reject safely','Yes'),
  t('TC-BE-17-018','Concurrent webhooks for same orderId → exactly one credit (race guard)','Yes'),
  t('TC-BE-17-019','Coin amount matches totalCoins from coin_packages (base + bonus)','Yes'),
  t('TC-BE-17-020','Webhook handler completes within 10 s (Vercel Hobby plan limit)','Yes'),
  t('TC-BE-17-021','MOMO_SECRET_KEY not present in any browser-accessible response','Yes'),
  t('TC-BE-17-022','orderId not found in payments → return 200 to MoMo (no retry storm); no credit','No'),
]},

// ─── UC-18: Unlock VIP Chapter ────────────────────────────────────────────────
{
  reqId:'UC-18', reqDesc:'Unlock VIP Chapter', coverage:'Partial', tests:[
  t('TC-BE-18-001','Unlock without session → 401','Yes'),
  t('TC-BE-18-002','Unlock non-VIP chapter → 400 (cannot unlock free chapter)','Yes'),
  t('TC-BE-18-003','Non-existent chapter → 404','Yes'),
  t('TC-BE-18-004','Successful unlock: users.coinBalance decremented by 1','Yes'),
  t('TC-BE-18-005','Successful unlock: chapter_unlocks row (userId, chapterId) created','Yes'),
  t('TC-BE-18-006','Successful unlock: coin_transactions row with type=DEBIT, amount=1','Yes'),
  t('TC-BE-18-007','All three writes in single DB transaction (atomic, BR coin integrity)','Yes'),
  t('TC-BE-18-008','Transaction rollback test: simulated failure after coinBalance decrement → no partial state','Yes'),
  t('TC-BE-18-009','coinBalance = 0 → 402 insufficient_coins; no debit, no unlock row','Yes'),
  t('TC-BE-18-010','coinBalance = 1 → unlock succeeds; coinBalance becomes 0','Yes'),
  t('TC-BE-18-011','coinBalance never goes below 0 in any scenario','Yes'),
  t('TC-BE-18-012','Already-unlocked chapter → 200 idempotent; no second debit (BR check existing unlock)','Yes'),
  t('TC-BE-18-013','Already-unlocked chapter → no second coin_transactions row','Yes'),
  t('TC-BE-18-014','chapter_unlocks UNIQUE (userId, chapterId) DB constraint prevents duplicate unlock','Yes'),
  t('TC-BE-18-015','Concurrent unlock requests from same user → exactly one debit (SELECT FOR UPDATE)','Yes'),
  t('TC-BE-18-016','Two concurrent requests at coinBalance=1 → one succeeds (200), one gets 402','Yes'),
  t('TC-BE-18-017','coinBalance never read from Redis or any cache — always from DB in transaction','Yes'),
  t('TC-BE-18-018','coin_transactions ledger sum equals users.coinBalance after every operation','Yes'),
  t('TC-BE-18-019','Active subscription: VIP chapter accessible without spending coins (no chapter_unlocks needed)','Yes'),
  t('TC-BE-18-020','Unlock persists after session expiry — chapter_unlocks checked on next visit','Yes'),
]},

// ─── UC-19: Update Profile ────────────────────────────────────────────────────
{
  reqId:'UC-19', reqDesc:'Update Profile', coverage:'Partial', tests:[
  t('TC-BE-19-001','Profile update → 401 for unauthenticated','Yes'),
  t('TC-BE-19-002','Valid name update → users.name updated in DB','Yes'),
  t('TC-BE-19-003','Name = empty string → rejected','No'),
  t('TC-BE-19-004','Name > 100 chars → rejected','No'),
  t('TC-BE-19-005','hasPassword() returns false for Google-only account (BR-03-4)','No'),
  t('TC-BE-19-006','Change-password form hidden server-side for Google-only accounts','No'),
  t('TC-BE-19-007','Email field is immutable; email update attempt → rejected or silently ignored','No'),
  t('TC-BE-19-008','Updated name reflects in navbar on next page load','No'),
]},

// ─── UC-20: Change Password ───────────────────────────────────────────────────
{
  reqId:'UC-20', reqDesc:'Change Password', coverage:'Partial', tests:[
  t('TC-BE-20-001','Change password → 401 for unauthenticated','Yes'),
  t('TC-BE-20-002','Wrong current password → 400/403; password not changed','Yes'),
  t('TC-BE-20-003','Correct current password → update proceeds','Yes'),
  t('TC-BE-20-004','New password = 7 chars → 400','Yes'),
  t('TC-BE-20-005','New password = 8 chars → accepted (boundary)','Yes'),
  t('TC-BE-20-006','New password same as current → 400 with MSG-017','No'),
  t('TC-BE-20-007','Successful change → all other sessions invalidated','Yes'),
  t('TC-BE-20-008','Successful change → current session remains valid','No'),
  t('TC-BE-20-009','Google-only account → change password endpoint returns error','No'),
  t('TC-BE-20-010','New password hash differs from old hash in DB','No'),
]},

// ─── UC-21: Curator Manage Novel ─────────────────────────────────────────────
{
  reqId:'UC-21', reqDesc:'Curator Manage Novel', coverage:'Partial', tests:[
  t('TC-BE-21-001','Novel create → 401 for unauthenticated','Yes'),
  t('TC-BE-21-002','Novel create → 403 for reader role','Yes'),
  t('TC-BE-21-003','Novel create → 200 for curator role','Yes'),
  t('TC-BE-21-004','Novel create → 200 for admin role','Yes'),
  t('TC-BE-21-005','Slug auto-generated from title via slugify (spaces → hyphens, diacritics stripped)','No'),
  t('TC-BE-21-006','Duplicate slug → 409 (DB UNIQUE index on novels.slug)','No'),
  t('TC-BE-21-007','Empty title → 400','No'),
  t('TC-BE-21-008','Title > 500 chars → 400','No'),
  t('TC-BE-21-009','Valid Cloudinary URL accepted for coverUrl','No'),
  t('TC-BE-21-010','Genre IDs associated atomically (no orphan novel_genres rows on failure)','No'),
  t('TC-BE-21-011','Tag IDs associated atomically','No'),
  t('TC-BE-21-012','Novel update by owner curator → 200','Yes'),
  t('TC-BE-21-013','Novel delete removes all associated chapters, novel_genres, novel_tags','No'),
  t('TC-BE-21-014','Status change to PUBLISHED → novel appears in public browse list','Yes'),
]},

// ─── UC-22: Curator Manage Chapter ───────────────────────────────────────────
{
  reqId:'UC-22', reqDesc:'Curator Manage Chapter', coverage:'Partial', tests:[
  t('TC-BE-22-001','Chapter create → 401 for unauthenticated','Yes'),
  t('TC-BE-22-002','Chapter create → 403 for reader role','Yes'),
  t('TC-BE-22-003','Chapter create → 200 for curator role','Yes'),
  t('TC-BE-22-004','Chapter content: <script>alert(1)</script> stripped by DOMPurify before DB write','Yes'),
  t('TC-BE-22-005','Chapter content: onclick attribute stripped (stored XSS prevention)','Yes'),
  t('TC-BE-22-006','Chapter content: <p>, <em>, <strong>, <br> preserved by DOMPurify','No'),
  t('TC-BE-22-007','chapterNumber must be positive integer; 0 → 400; negative → 400','No'),
  t('TC-BE-22-008','Duplicate chapterNumber for same novel → 400/409','No'),
  t('TC-BE-22-009','DRAFT → PUBLISHED: novels.totalChapters incremented by 1','Yes'),
  t('TC-BE-22-010','PUBLISHED → DRAFT: novels.totalChapters decremented by 1','Yes'),
  t('TC-BE-22-011','DRAFT → PUBLISHED: Meilisearch indexChapter() called','Yes'),
  t('TC-BE-22-012','DRAFT → PUBLISHED: fanOutNewChapterNotification() called for followers','Yes'),
  t('TC-BE-22-013','Meilisearch indexing failure does NOT roll back the chapter DB commit','Yes'),
  t('TC-BE-22-014','Notification failure does NOT roll back the chapter DB commit','Yes'),
  t('TC-BE-22-015','isVip=true, coinCost omitted → coinCost defaults to 1','No'),
  t('TC-BE-22-016','isVip=false → coinCost set to null regardless of input','No'),
  t('TC-BE-22-017','wordCount recalculated on content update (content.trim().split(/\s+/).length)','No'),
  t('TC-BE-22-018','Chapter delete for PUBLISHED chapter → totalChapters decremented','No'),
  t('TC-BE-22-019','Cache invalidated after chapter update (chapter:novelId:chapterNumber key)','No'),
]},

// ─── UC-23: Admin Manage System ──────────────────────────────────────────────
{
  reqId:'UC-23', reqDesc:'Admin Manage System', coverage:'Partial', tests:[
  t('TC-BE-23-001','/api/admin/* → 401 for unauthenticated','Yes'),
  t('TC-BE-23-002','/api/admin/* → 403 for reader role','Yes'),
  t('TC-BE-23-003','/api/admin/* → 403 for curator role','Yes'),
  t('TC-BE-23-004','/api/admin/* → 200 for admin role','Yes'),
  t('TC-BE-23-005','User suspension: users.status=SUSPENDED + audit_logs row in same transaction','Yes'),
  t('TC-BE-23-006','User suspension: if transaction fails, neither status nor log is written','Yes'),
  t('TC-BE-23-007','Role change: users.role updated + audit_logs row in same transaction','Yes'),
  t('TC-BE-23-008','Report resolution: reports.status updated + audit_logs row in same transaction','Yes'),
  t('TC-BE-23-009','Content hide: novel/chapter hidden + audit_logs row in same transaction','Yes'),
  t('TC-BE-23-010','100% of admin mutations produce a corresponding audit_logs entry','Yes'),
  t('TC-BE-23-011','audit_logs row includes adminId, action, targetType, targetId, timestamp','Yes'),
  t('TC-BE-23-012','Suspended user: sign-in attempt rejected (session not created)','Yes'),
  t('TC-BE-23-013','Hidden novel: de-indexed from Meilisearch on hide action','Yes'),
  t('TC-BE-23-014','Coin package create → audit_logs entry written','No'),
  t('TC-BE-23-015','Coin package deactivate → audit_logs entry written','No'),
  t('TC-BE-23-016','Audit log list endpoint returns entries in reverse-chronological order','No'),
  t('TC-BE-23-017','Admin cannot perform actions on own account via admin panel','No'),
]},

// ─── NFR / System Quality ─────────────────────────────────────────────────────
{
  reqId:'NFR', reqDesc:'Non-Functional / System Quality', coverage:'Partial', tests:[
  t('TC-BE-NFR-001','GET /api/health → 200 JSON with status, timestamp, and per-dependency check results','Yes'),
  t('TC-BE-NFR-002','GET /api/health: database check returns latencyMs; status=ok when DB reachable','Yes'),
  t('TC-BE-NFR-003','GET /api/health: overall status=degraded when Redis unreachable but DB healthy','Yes'),
  t('TC-BE-NFR-004','GET /api/health: overall status=down (HTTP 503) when DB unreachable','Yes'),
  t('TC-BE-NFR-005','GET /api/health: check results include latencyMs for each dependency','No'),
  t('TC-BE-NFR-006','Login rate limiter: 10 attempts/15 min per IP (Upstash Redis sliding window)','Yes'),
  t('TC-BE-NFR-007','Serverless cold-start completes < 500 ms (Drizzle ORM bundle size target)','Yes'),
  t('TC-BE-NFR-008','Neon HTTP driver used (not TCP): no persistent connection pool warnings','No'),
  t('TC-BE-NFR-009','All DB writes involving coinBalance use db.transaction() — enforced by code','Yes'),
  t('TC-BE-NFR-010','Module boundary: src/modules/ do not import from sibling modules','No'),
  t('TC-BE-NFR-011','Module boundary: src/app/ pages do not import from src/db/schema/ directly','No'),
  t('TC-BE-NFR-012','Structured logger (pino) emits JSON to stdout on every error/warn event','No'),
  t('TC-BE-NFR-013','Meilisearch fallback logs WARN with query and error context','No'),
  t('TC-BE-NFR-014','Redis cache failure logs WARN; DB fallback executes transparently','No'),
  t('TC-BE-NFR-015','MoMo webhook error logs ERROR with orderId and transId context','Yes'),
  t('TC-BE-NFR-016','Notification fan-out failure logs ERROR with novelId and chapterId','No'),
  t('TC-BE-NFR-017','OpenTelemetry traces registered via @vercel/otel on startup','No'),
  t('TC-BE-NFR-018','Web vitals (LCP, CLS, INP, TTFB) sent to POST /api/vitals in production','No'),
  t('TC-BE-NFR-019','XSS: all chapter content sanitized server-side with DOMPurify before storage','Yes'),
  t('TC-BE-NFR-020','All API routes return Content-Type: application/json (no mixed types)','No'),
  t('TC-BE-NFR-021','HTTP Strict-Transport-Security header present on all production HTTPS responses','No'),
  t('TC-BE-NFR-022','X-Content-Type-Options: nosniff header present on all API responses','No'),
  t('TC-BE-NFR-023','X-Frame-Options: DENY header present on HTML page responses','No'),
  t('TC-BE-NFR-024','SQL injection in ?q= search param → safe; no 500; empty result or ignored','No'),
  t('TC-BE-NFR-025','SQL injection in novel slug URL param → 404; no 500 or data leak','No'),
  t('TC-BE-NFR-026','CORS: /api/* rejects requests from non-whitelisted origins (no ACAO wildcard)','No'),
  t('TC-BE-NFR-027','coin_transactions SUM(amount) per user always equals users.coinBalance (invariant)','Yes'),
  t('TC-BE-NFR-028','All datetime columns stored as UTC; client formats to ICT (UTC+7) for display','No'),
  t('TC-BE-NFR-029','Concurrent rate-limit increments for same IP use Redis INCR atomic; counter never drifts','No'),
  t('TC-BE-NFR-030','POST /api/vitals receives web-vital payload; returns 204; metric logged via pino','No'),
]},

];

// =============================================================================
// UI AND INTEGRATION TESTS
// =============================================================================
const UI_TESTS = [

// ─── Auth – Register & Sign-in ────────────────────────────────────────────────
{
  reqId:'UC-01/02', reqDesc:'Registration & Sign-in Flows', coverage:'Partial', tests:[
  t('TC-UI-AUTH-001','Sign-up form shows inline error for empty name on submit','Yes'),
  t('TC-UI-AUTH-002','Sign-up form shows inline error for invalid email format','Yes'),
  t('TC-UI-AUTH-003','Sign-up form shows inline error for password < 8 chars','Yes'),
  t('TC-UI-AUTH-004','Successful sign-up → user redirected to /; navbar shows user avatar','Yes'),
  t('TC-UI-AUTH-005','Navbar shows coin balance = 0 immediately after registration','Yes'),
  t('TC-UI-AUTH-006','Sign-in with correct credentials → dashboard loads, user name visible in navbar','Yes'),
  t('TC-UI-AUTH-007','Sign-in with wrong password → error message on page; no redirect','Yes'),
  t('TC-UI-AUTH-008','10+ failed sign-ins → rate-limit error message displayed on form','Yes'),
  t('TC-UI-AUTH-009','Sign-in page: "Tiếp tục với Google" button present and clickable','Yes'),
  t('TC-UI-AUTH-010','Sign-up page: "Tiếp tục với Google" button present and clickable','Yes'),
  t('TC-UI-AUTH-011','Sign-out via user dropdown → navbar reverts to "Đăng nhập" / "Đăng ký"','Yes'),
  t('TC-UI-AUTH-012','After sign-out, navigating to /library → redirected to /sign-in?callbackUrl','Yes'),
  t('TC-UI-AUTH-024','Sign-in form: password field uses type=password; plaintext not visible','Yes'),
  t('TC-UI-AUTH-025','Session persists across new tabs opened in same browser (shared origin cookie)','No'),
  t('TC-UI-AUTH-026','Registration: submit button disabled while request is in-flight (no double submit)','No'),
]},

// ─── Auth – Password Reset ────────────────────────────────────────────────────
{
  reqId:'UC-05', reqDesc:'Reset Password Flow', coverage:'Partial', tests:[
  t('TC-UI-AUTH-013','"Quên mật khẩu?" link on /sign-in navigates to forgot-password form','Yes'),
  t('TC-UI-AUTH-014','Submitting any email (found or not) shows neutral confirmation message','Yes'),
  t('TC-UI-AUTH-015','Valid reset link opens new-password form with two fields','Yes'),
  t('TC-UI-AUTH-016','New password < 8 chars: inline error shown; form not submitted','Yes'),
  t('TC-UI-AUTH-017','Successful password reset → redirected to /sign-in with success message','Yes'),
  t('TC-UI-AUTH-018','Expired or already-used reset link → error page with "Gửi lại" option','No'),
]},

// ─── Auth – Protected Routes ──────────────────────────────────────────────────
{
  reqId:'UC-02', reqDesc:'Protected Route Redirects', coverage:'Partial', tests:[
  t('TC-UI-AUTH-019','Unauthenticated guest visits /library → redirected to /sign-in?callbackUrl=/library','Yes'),
  t('TC-UI-AUTH-020','Unauthenticated guest visits /settings → redirected to /sign-in','Yes'),
  t('TC-UI-AUTH-021','After sign-in from redirect, callbackUrl honored → lands on /library','Yes'),
  t('TC-UI-AUTH-022','Authenticated reader cannot access /admin → 403 page shown','Yes'),
  t('TC-UI-AUTH-023','Authenticated curator cannot access /admin → 403 page shown','Yes'),
]},

// ─── Browse & Filter ─────────────────────────────────────────────────────────
{
  reqId:'UC-06', reqDesc:'Browse & Filter Novel List', coverage:'Partial', tests:[
  t('TC-UI-BROWSE-001','/novels page renders correctly with JavaScript disabled (SSR check)','Yes'),
  t('TC-UI-BROWSE-002','Novel grid shows cover image, title, status badge, chapter count','Yes'),
  t('TC-UI-BROWSE-003','"Hoàn thành" status pill click → URL gains ?status=COMPLETED; list re-renders','Yes'),
  t('TC-UI-BROWSE-004','Clicking same active status pill deselects it; list reverts to unfiltered','Yes'),
  t('TC-UI-BROWSE-005','Genre pill selection adds ?genre= to URL and filters list','Yes'),
  t('TC-UI-BROWSE-006','Both status and genre pills active → AND-filtered results displayed','Yes'),
  t('TC-UI-BROWSE-007','Filter URL shared with another user → identical view on load','No'),
  t('TC-UI-BROWSE-008','Zero-match filter → "Không tìm thấy truyện" empty state visible','No'),
  t('TC-UI-BROWSE-009','Pagination control: page 2 link loads next set of novels','No'),
  t('TC-UI-BROWSE-010','Mobile viewport (375px): novel grid renders as 1-column; no horizontal scroll','No'),
  t('TC-UI-BROWSE-011','Novel card click navigates to correct /novels/[slug] URL','Yes'),
  t('TC-UI-BROWSE-012','Sort selector change re-fetches with new ?sort= param; list updates without full reload','No'),
]},

// ─── Search ───────────────────────────────────────────────────────────────────
{
  reqId:'UC-07', reqDesc:'Search Novels', coverage:'Partial', tests:[
  t('TC-UI-SEARCH-001','Typing in search input updates ?q= param after ~300 ms debounce','Yes'),
  t('TC-UI-SEARCH-002','Typo query returns related novels (Meilisearch typo tolerance)','Yes'),
  t('TC-UI-SEARCH-003','Clearing search input removes ?q= and restores unfiltered list','Yes'),
  t('TC-UI-SEARCH-004','Search + status filter active simultaneously: both applied in results','No'),
  t('TC-UI-SEARCH-005','Search result count updates to reflect matched novels','No'),
  t('TC-UI-SEARCH-006','Search debounce: rapid typing fires only one API request per 300 ms window','No'),
  t('TC-UI-SEARCH-007','No results found: "Không tìm thấy truyện nào" empty state shown','No'),
  t('TC-UI-SEARCH-008','Vietnamese diacritics typed in search box return accented matches correctly','No'),
]},

// ─── Novel Detail ─────────────────────────────────────────────────────────────
{
  reqId:'UC-09', reqDesc:'Novel Detail Page', coverage:'Partial', tests:[
  t('TC-UI-NOVEL-001','Novel detail <head> contains og:title (view-source check)','Yes'),
  t('TC-UI-NOVEL-002','Novel detail <head> contains og:description','Yes'),
  t('TC-UI-NOVEL-003','Cover image loaded from res.cloudinary.com (network tab)','Yes'),
  t('TC-UI-NOVEL-004','Navigating to /novels/non-existent-slug shows 404 page','Yes'),
  t('TC-UI-NOVEL-005','VIP chapters show amber lock icon in chapter list','Yes'),
  t('TC-UI-NOVEL-006','No reading progress → "Đọc từ đầu" CTA links to chapter 1','No'),
  t('TC-UI-NOVEL-007','With reading progress → "Tiếp tục đọc chương N" CTA correct','No'),
  t('TC-UI-NOVEL-008','Novel with no reviews → reviews section shows "Chưa có đánh giá"','No'),
  t('TC-UI-NOVEL-009','Recommendations grid shows same-genre novels','No'),
  t('TC-UI-NOVEL-010','Novel cover image uses loading="lazy"; does not block page render','No'),
  t('TC-UI-NOVEL-011','Chapter list sorted ascending by chapterNumber by default','No'),
  t('TC-UI-NOVEL-012','Novel status badge color matches status (green=ONGOING, blue=COMPLETED, etc.)','No'),
  t('TC-UI-NOVEL-013','Genre tag pills on novel detail link to /novels?genre=X filtered list','No'),
]},

// ─── Chapter Reading ─────────────────────────────────────────────────────────
{
  reqId:'UC-10', reqDesc:'Read Chapter', coverage:'Partial', tests:[
  t('TC-UI-READ-001','Free chapter: full text visible for unauthenticated guest','Yes'),
  t('TC-UI-READ-002','VIP chapter: lock overlay shown for guest; chapter text absent from DOM (Inspect)','Yes'),
  t('TC-UI-READ-003','VIP chapter: "Đăng nhập để đọc" link shown for unauthenticated user','Yes'),
  t('TC-UI-READ-004','VIP chapter: coin-purchase prompt shown for authenticated reader with 0 coins','Yes'),
  t('TC-UI-READ-005','After clicking "Mở khóa", chapter content revealed; coin balance in navbar decrements','Yes'),
  t('TC-UI-READ-006','Prev chapter button absent on chapter 1 (no prev)','No'),
  t('TC-UI-READ-007','Next chapter button absent on last chapter','No'),
  t('TC-UI-READ-008','Chapter nav works: clicking Next loads next chapter correctly','Yes'),
  t('TC-UI-READ-009','Reading time estimate displayed in reader top bar ("~N phút đọc")','No'),
  t('TC-UI-READ-014','Breadcrumb on chapter page links back to correct novel detail','No'),
  t('TC-UI-READ-015','Chapter text is selectable (user-select not overridden to none)','No'),
  t('TC-UI-READ-016','Long chapter content does not cause horizontal overflow or layout shift','No'),
  t('TC-UI-READ-017','Reader renders correctly on mobile viewport (375px); text is readable','No'),
]},

// ─── Reader Settings ──────────────────────────────────────────────────────────
{
  reqId:'UC-11', reqDesc:'Reader Settings', coverage:'Partial', tests:[
  t('TC-UI-READ-010','Font size change applied immediately to chapter text','No'),
  t('TC-UI-READ-011','Dark theme persists across browser reload without flash','No'),
  t('TC-UI-READ-012','Settings panel opens on gear icon click; closes on outside click','No'),
  t('TC-UI-READ-013','Settings do not affect site navigation or global theme','No'),
]},

// ─── Library & Progress ───────────────────────────────────────────────────────
{
  reqId:'UC-12/13/14', reqDesc:'Library, Follow & Progress', coverage:'Partial', tests:[
  t('TC-UI-LIB-001','"Theo dõi" button toggles to "Đang theo dõi" for authenticated user','Yes'),
  t('TC-UI-LIB-002','"Theo dõi" button shows sign-in prompt for unauthenticated guest','Yes'),
  t('TC-UI-LIB-003','Followed novel appears in /library list','Yes'),
  t('TC-UI-LIB-004','Unfollowing novel removes it from /library list','Yes'),
  t('TC-UI-LIB-005','After reading chapter N, novel detail shows "Tiếp tục đọc chương N"','Yes'),
  t('TC-UI-LIB-006','Progress bar shown in library card; percentage matches chapter progress','No'),
  t('TC-UI-LIB-007','Library tab "Đang đọc" shows only in-progress novels','No'),
  t('TC-UI-LIB-008','Library tab "Hoàn thành" shows only completed novels','No'),
  t('TC-UI-LIB-009','Notification bell shows unread count badge when notifications exist','No'),
  t('TC-UI-LIB-010','Library page: unauthenticated guest immediately redirected to /sign-in','Yes'),
  t('TC-UI-LIB-011','Empty library state shows illustration + "Khám phá truyện" CTA link to /novels','No'),
  t('TC-UI-LIB-012','Library card shows last-read chapter number and progress percentage','No'),
]},

// ─── Payments & Coins ────────────────────────────────────────────────────────
{
  reqId:'UC-17/18', reqDesc:'Payments & Coin Unlock', coverage:'Partial', tests:[
  t('TC-UI-PAY-001','/pricing lists all active coin packages with VND price and coin amount','Yes'),
  t('TC-UI-PAY-002','Clicking "Mua" on a package → redirected to MoMo payment page (external URL)','Yes'),
  t('TC-UI-PAY-003','Coin balance shown in navbar for authenticated user','Yes'),
  t('TC-UI-PAY-004','After successful payment return, coin balance in navbar updated','Yes'),
  t('TC-UI-PAY-005','Cancelled/failed MoMo return → /pricing with error notice','Yes'),
  t('TC-UI-PAY-006','VIP chapter page shows coin cost and "Mở khóa" button','Yes'),
  t('TC-UI-PAY-007','Zero-balance: "Mở khóa" shows "Mua xu" shortcut link instead','Yes'),
  t('TC-UI-PAY-008','Unlock confirmation dialog shows coin cost and current balance','No'),
  t('TC-UI-PAY-009','After unlock, "Mở khóa" button replaced by chapter content (no reload needed)','Yes'),
  t('TC-UI-PAY-010','Transaction history page lists past coin purchases in reverse-chronological order','No'),
  t('TC-UI-PAY-011','Coin package with bonus shows "+N bonus xu" label on /pricing page','No'),
  t('TC-UI-PAY-012','Redirect button to MoMo disabled while payment is initiating (no double-submit)','No'),
  t('TC-UI-PAY-013','Insufficient-coin state: "Mở khóa" shows coin requirement and balance shortfall','No'),
]},

// ─── Community ───────────────────────────────────────────────────────────────
{
  reqId:'UC-15/16', reqDesc:'Reviews & Comments', coverage:'Not Covered', tests:[
  t('TC-UI-COMM-001','Review form on novel detail visible for authenticated reader','Yes'),
  t('TC-UI-COMM-002','Star rating UI: clicking star 4 selects 4; reclick deselects','Yes'),
  t('TC-UI-COMM-003','Rating required: submitting without star → inline error shown','Yes'),
  t('TC-UI-COMM-004','Review body > 2000 chars: character counter turns red; submit blocked','No'),
  t('TC-UI-COMM-005','Comment text box on novel detail visible for authenticated reader','Yes'),
  t('TC-UI-COMM-006','Unauthenticated user: comment area shows "Đăng nhập để bình luận"','Yes'),
  t('TC-UI-COMM-007','Reply button on comment opens indented reply input','No'),
  t('TC-UI-COMM-008','New comment appears at top of list immediately after submit','No'),
]},

// ─── Profile & Settings ───────────────────────────────────────────────────────
{
  reqId:'UC-19/20', reqDesc:'Profile & Password', coverage:'Partial', tests:[
  t('TC-UI-PROF-001','/settings page accessible for authenticated user','Yes'),
  t('TC-UI-PROF-002','Display name update: save shows success toast; new name in navbar','Yes'),
  t('TC-UI-PROF-003','Change password form hidden for Google-only accounts','No'),
  t('TC-UI-PROF-004','Wrong current password on change-password form → error shown','Yes'),
  t('TC-UI-PROF-005','Password change success → success toast; user stays signed in','Yes'),
]},

// ─── Curator CMS ─────────────────────────────────────────────────────────────
{
  reqId:'UC-21/22', reqDesc:'Curator CMS', coverage:'Partial', tests:[
  t('TC-UI-CUR-001','"CMS" nav link visible only for CURATOR and ADMIN roles','Yes'),
  t('TC-UI-CUR-002','/curator accessible for curator role; /curator blocked (403) for reader','Yes'),
  t('TC-UI-CUR-003','Novel creation form: submitting empty title → validation error inline','Yes'),
  t('TC-UI-CUR-004','Slug field auto-populated from title; can be manually edited','No'),
  t('TC-UI-CUR-005','Cover image upload widget shows preview after Cloudinary upload','No'),
  t('TC-UI-CUR-006','New chapter created as DRAFT → not visible in public chapter list','Yes'),
  t('TC-UI-CUR-007','DRAFT chapter published via CMS → appears in public chapter list','Yes'),
  t('TC-UI-CUR-008','Chapter list in CMS shows DRAFT chapters that guests cannot see','Yes'),
  t('TC-UI-CUR-009','XSS attempt in chapter content field: <script> removed in preview render','Yes'),
  t('TC-UI-CUR-010','Chapter editor displays live word count; updates as content is typed','No'),
  t('TC-UI-CUR-011','Novel status change to COMPLETED: confirmation dialog shown before submission','No'),
  t('TC-UI-CUR-012','DRAFT badge shown on chapter cards in CMS that are not yet published','No'),
]},

// ─── Admin Panel ─────────────────────────────────────────────────────────────
{
  reqId:'UC-23', reqDesc:'Admin Panel', coverage:'Partial', tests:[
  t('TC-UI-ADM-001','/admin accessible with ADMIN role; reader sees 403 error page','Yes'),
  t('TC-UI-ADM-002','User list shows all users with role, status, and coin balance','Yes'),
  t('TC-UI-ADM-003','Suspending a user from admin panel → status changes; user cannot sign in','Yes'),
  t('TC-UI-ADM-004','Audit log table shows action, adminId, targetId, timestamp','Yes'),
  t('TC-UI-ADM-005','Coin package management: create new package → appears in /pricing','No'),
  t('TC-UI-ADM-006','Report queue shows pending reports; resolution removes from queue','No'),
  t('TC-UI-ADM-007','Unsuspending a user restores sign-in access; status badge changes to active','No'),
  t('TC-UI-ADM-008','Role promotion reader→curator: reflected in navbar and route access on next session','No'),
]},

// ─── Error Boundaries & Observability UI ─────────────────────────────────────
{
  reqId:'NFR', reqDesc:'Error Boundaries & Observability', coverage:'Partial', tests:[
  t('TC-UI-OBS-001','error.tsx: route error shows Vietnamese error message + "Thử lại" button','No'),
  t('TC-UI-OBS-002','"Thử lại" button in error.tsx calls reset() and reloads route segment','No'),
  t('TC-UI-OBS-003','global-error.tsx: catastrophic error shows "Tải lại" button (minimal HTML)','No'),
  t('TC-UI-OBS-004','error.tsx shows error.digest ID for traceable support reference','No'),
  t('TC-UI-OBS-005','GET /api/health returns 200 JSON with status and check results','Yes'),
  t('TC-UI-OBS-006','Web vitals POST fires to /api/vitals on page load (confirmed via network tab)','No'),
  t('TC-UI-OBS-007','error.tsx: digest ID shown is short alphanumeric code, not full stack trace','No'),
  t('TC-UI-OBS-008','All unknown routes (/foo/bar) render the 404 not-found page, not a 500','No'),
]},

];

// =============================================================================
// Sheet builder
// =============================================================================
async function buildSheet(wb, name, tabColor, groups) {
  const ws = wb.addWorksheet(name, {
    views:      [{ state: 'frozen', ySplit: 2 }],
    properties: { tabColor: { argb: tabColor } },
  });
  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

  // ── 2-row header ────────────────────────────────────────────────────────
  const hNames  = ['No','Req ID','Req Desc','TC ID','TC Desc','Test Design','Test Designer','UAT Test Req?','Test Execution','','','Defects?','Defect ID','Defect Status','Req Coverage Status'];
  const hSubs   = ['','','','','','','','','Test Env','UAT Env','Prod Env','','','',''];
  const hRow1   = ws.addRow(hNames);
  const hRow2   = ws.addRow(hSubs);
  hRow1.height  = 22; hRow2.height = 17;

  // Merge: non-execution cols span both rows; I1:K1 = "Test Execution"
  for (let i = 0; i < COLS.length; i++) {
    const c = i + 1;
    if (c < 9 || c > 11) ws.mergeCells(1, c, 2, c);
  }
  ws.mergeCells(1, 9, 1, 11);

  for (let c = 1; c <= 15; c++) {
    styleHeaderCell(hRow1.getCell(c), c >= 9 && c <= 11 ? C.subheadBg : C.headerBg, C.headerFg);
    styleHeaderCell(hRow2.getCell(c), c >= 9 && c <= 11 ? C.subheadBg : C.headerBg, c >= 9 && c <= 11 ? C.subheadFg : C.headerFg);
  }

  // ── Data rows ────────────────────────────────────────────────────────────
  let no = 1;
  for (const grp of groups) {
    for (let i = 0; i < grp.tests.length; i++) {
      const tc      = grp.tests[i];
      const isFirst = i === 0;
      const rowBg   = isFirst ? C.reqRowBg : (i % 2 ? C.altRowBg : C.plainRowBg);

      const row = ws.addRow([
        no,
        isFirst ? grp.reqId   : '',
        isFirst ? grp.reqDesc : '',
        tc.tcId,
        tc.desc,
        DONE,
        DESIGNER,
        tc.uatReq,
        NOT_RUN, NOT_RUN, NOT_RUN,
        '', '', '',
        isFirst ? grp.coverage : '',
      ]);
      row.height = 16;

      for (let c = 1; c <= 15; c++) {
        const cell = row.getCell(c);
        const isExec = c >= 9 && c <= 11;
        cell.font      = { name: 'Arial', size: 10, bold: (c === 2 && isFirst) };
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isExec ? C.notRunBg : rowBg } };
        cell.alignment = { horizontal: c === 1 ? 'center' : 'left', vertical: 'middle', wrapText: c === 3 || c === 5 };
        cell.border    = border('thin');
        if (isExec) cell.font = { name: 'Arial', size: 10, italic: true, color: { argb: C.notRunFg } };
        if (c === 15 && isFirst) applyCovStyle(cell, grp.coverage);
      }
      no++;
    }
    // Thicker group-separator border
    ws.getRow(ws.rowCount).eachCell({ includeEmpty: true }, (cell, c) => {
      if (c <= 15) cell.border = border('medium');
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  ws.addRow([]);
  const sh = ws.addRow(['', 'Req ID', 'Req Desc', 'Test Cases', '', '', '', '', '', '', '', '', '', '', '']);
  sh.height = 20;
  [1,2,3,4].forEach(c => styleHeaderCell(sh.getCell(c), C.headerBg, C.headerFg));

  for (const grp of groups) {
    const sr = ws.addRow(['', grp.reqId, grp.reqDesc, grp.tests.length]);
    sr.height = 15;
    [1,2,3,4].forEach(c => {
      const cell = sr.getCell(c);
      cell.font  = { name: 'Arial', size: 10, bold: c === 4 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.altRowBg } };
      cell.alignment = { horizontal: c === 4 ? 'center' : 'left', vertical: 'middle' };
      cell.border = border('thin');
    });
  }
  const total = groups.reduce((s, g) => s + g.tests.length, 0);
  const tr = ws.addRow(['', 'TOTAL', '', total]);
  tr.height = 18;
  [1,2,3,4].forEach(c => styleHeaderCell(tr.getCell(c), C.headerBg, C.headerFg));
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'NovelHub QA Team';
  wb.created  = new Date('2026-05-19');
  wb.modified = new Date();

  await buildSheet(wb, 'BACKEND TESTS',             'FF1A3550', BACKEND_TESTS);
  await buildSheet(wb, 'UI AND INTEGRATION TESTING', 'FF2E6096', UI_TESTS);

  await wb.xlsx.writeFile(outPath);
  const { statSync } = require('fs');
  const kb = (statSync(outPath).size / 1024).toFixed(1);
  const be = BACKEND_TESTS.reduce((s, g) => s + g.tests.length, 0);
  const ui = UI_TESTS.reduce((s, g)      => s + g.tests.length, 0);
  console.log(`Done!  RTM.xlsx = ${kb} KB  →  ${outPath}`);
  console.log(`  Backend tests  : ${be}`);
  console.log(`  UI/Integration : ${ui}`);
  console.log(`  Total          : ${be + ui}`);
}

// =============================================================================
// Helpers
// =============================================================================
function border(style = 'thin') {
  const s = { style, color: { argb: C.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function styleHeaderCell(cell, bg, fg) {
  cell.font      = { bold: true, name: 'Arial', size: 10, color: { argb: fg } };
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border    = border('medium');
}

function applyCovStyle(cell, status) {
  const map = {
    'Complete':    [C.completeFg, C.completeBg],
    'Partial':     [C.partialFg,  C.partialBg ],
    'Not Covered': [C.notCovFg,   C.notCovBg  ],
    'Blocked':     [C.blockedFg,  C.blockedBg ],
  };
  const [fg, bg] = map[status] || map['Partial'];
  cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: fg } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

main().catch(console.error);
