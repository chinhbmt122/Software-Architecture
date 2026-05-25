// generate-asr.js
// Generates docs/ASR.xlsx — Architecturally Significant Requirements for NovelHub
// Usage (from project root): node docs/generate-asr.js

'use strict';

const ExcelJS = require('exceljs');
const path    = require('path');

const docsDir = __dirname;
const outPath = path.join(docsDir, 'ASR.xlsx');

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  headerBg:  'FF2E4057',
  headerFg:  'FFFFFFFF',
  secBg:     'FFD9E1F2',
  grpBg:     'FFEEF2FA',
  altBg:     'FFF8F9FC',
  border:    'FF4A7AAF',
  noteFg:    'FF555555',
  reqBg:     'FFFFFFFF',
};

// ── ASR Data ──────────────────────────────────────────────────────────────────
// Column E (requirements) uses \n for line breaks; Excel renders them with wrapText.
// Format per row:
//   [Quality Attribute]:
//   - MUST ...
//   Architectural Driver: AD-xx
//   QA Scenarios: ADD §2.x.x
//   Tactics: T-xx (...), T-xx (...)
//   Components: ...
//   Traceability: SRS UC-xx, SAD §x, AD-D-xx

const ASR_DATA = [

  // ── 1.0 User Management & Authentication ──────────────────────────────────
  {
    section: '1.0',
    group:   'User Management &\nAuthentication',
    rows: [
      {
        fn:   'Register / Sign In /\nChange Password\n(UC-01, UC-02, UC-20)',
        desc: 'A guest creates an account or authenticates with email and password; failed login attempts are rate-limited and result in an account lock.',
        req: [
          'Security:',
          '- MUST hash passwords with bcrypt before storage; MUST NOT store plaintext passwords',
          '- MUST enforce minimum 8-character password at server-side validation',
          '- MUST reject duplicate emails via DB UNIQUE index on users.email',
          "- MUST assign role = 'reader' and coin_balance = 0 on account creation",
          '- MUST block IP after 10 failed attempts per 15-min window (Upstash rate-limit)',
          '- MUST increment users.failed_attempts on each failure; lock account (lockedUntil = NOW() + 900 s) at N = 5',
          '- Session cookie MUST be httpOnly, Secure, SameSite=Lax — inaccessible to JavaScript',
          '- Session TTL: 86400 s default; 2592000 s if remember-me selected',
          '- Password reset token MUST expire in 3600 s and be single-use',
          '- Same error message returned whether email or password is wrong (prevents enumeration)',
          '',
          'Architectural Driver: AD-02 (Brute-Force Login Protection)',
          'QA Scenarios: ADD §2.1.4 (Brute-Force Login Protection)',
          'Tactics: T-04 (login attempt counter), T-05 (httpOnly cookie)',
          'Components: Better Auth handler, users table (failed_attempts, lockedUntil), Upstash Redis',
          'Traceability: SRS UC-01 BR-01-3/5/6, UC-02 BR-02-3/5, SAD AD-D-05',
        ].join('\n'),
        note: 'AD-02. BV=H, TR=M.\nSecurity foundation — all roles depend on this.',
      },
      {
        fn:   'Sign In with Google\nOAuth\n(UC-03)',
        desc: 'Guest authenticates via Google OAuth 2.0 PKCE; system creates or links a NovelHub account automatically without creating duplicates.',
        req: [
          'Security:',
          '- MUST use OAuth 2.0 with PKCE state parameter to prevent CSRF on callback',
          '- MUST link Google identity to an existing email/password account (accounts table) if same email found',
          '- MUST NOT create duplicate users for the same email address (DB unique index)',
          '- MUST NOT store Google access or refresh tokens persistently',
          '- OAuth failure (code exchange error, user cancel) MUST redirect to /sign-in without creating any user record',
          '',
          'Architectural Driver: AD-02 (Auth Security)',
          'QA Scenarios: ADD §2.1.1 (Authentication and Authorization)',
          'Tactics: T-05 (httpOnly cookie)',
          'Components: Better Auth (OAuth plugin), accounts table, Google OAuth API (CN-09)',
          'Traceability: SRS UC-03 BR-03-1/2/5, SAD §5.5.2 CN-09',
        ].join('\n'),
        note: 'AD-02. BV=M, TR=M.\nCSRF / account-linking risk.',
      },
    ],
  },

  // ── 2.0 Content Discovery & SEO ───────────────────────────────────────────
  {
    section: '2.0',
    group:   'Content Discovery\n& SEO',
    rows: [
      {
        fn:   'Browse / Filter /\nNovel Detail\n(UC-06, UC-08, UC-09)',
        desc: 'Guest or Reader browses the novel catalog with genre/status/tag filters and views novel detail pages; all pages must be crawlable by Googlebot with correct metadata.',
        req: [
          'SEO / Performance:',
          '- MUST render browse and novel-detail pages as React Server Components (RSC) — zero client-side JS hydration for static content',
          '- MUST include og:title, og:description, og:image, and canonical URL in <head> via Next.js generateMetadata()',
          '- MUST support URL-based filtering (?genre=&status=&page=) processed entirely server-side',
          '- Novel lists MUST be paginated server-side (default 20 per page)',
          '- Cover images MUST be served via Cloudinary CDN (WebP/AVIF format) using next/image lazy loading',
          '- CDN cache-control MUST be set: Cache-Control: s-maxage=60, stale-while-revalidate=3600',
          '',
          'Modifiability:',
          '- Filter options (genres, statuses) MUST be driven by DB values, not hardcoded in UI',
          '',
          'Architectural Driver: AD-06 (Search Engine Indexability)',
          'QA Scenarios: ADD §2.2.2 (Novel Browse Page SEO Response)',
          'Tactics: T-01 (RSC — zero hydration), T-03 (Cloudinary image CDN), T-11 (generateMetadata + canonical tag)',
          'Components: app/novels/page.tsx (RSC), app/novels/[slug]/page.tsx, content module listNovels()/getNovel(), Cloudflare CDN',
          'Traceability: SRS UC-06, UC-08, UC-09, SAD AD-D-01, DR-05',
        ].join('\n'),
        note: 'AD-06. BV=H, TR=L.\nSEO = primary user acquisition channel in Vietnam.',
      },
      {
        fn:   'Search Novels\n(UC-07)',
        desc: 'Guest or Reader searches for novels by title/keywords with typo tolerance; Meilisearch is the primary path with a DB fallback.',
        req: [
          'Performance:',
          '- MUST return search results in < 500 ms P95 via Meilisearch',
          '- MUST support typo tolerance (≥ 1 character edit distance via Meilisearch configuration)',
          '- MUST fall back to Drizzle ilike query if Meilisearch response exceeds 400 ms or errors',
          '- Fallback query MUST return results within 1 s',
          '- Search endpoint MUST NEVER expose the Meilisearch API key to the browser client',
          '',
          'Reliability:',
          '- Search module MUST return an empty array (never throw) on total failure — graceful degradation',
          '- Meilisearch index MUST be updated within 60 s of any chapter status change to PUBLISHED',
          '',
          'Architectural Driver: AD-05 (Search Response Time)',
          'QA Scenarios: ADD §2.2.3 (Search Response Time)',
          'Tactics: T-09 (Meilisearch dedicated service), T-10 (Drizzle ilike DB fallback)',
          'Components: search module searchNovels(), Meilisearch Cloud (CN-05), app/api/search route',
          'Traceability: SRS UC-07, SAD AD-D-07',
        ].join('\n'),
        note: 'AD-05. BV=H, TR=M.\nCore discovery — typo tolerance matters for Vietnamese users.',
      },
      {
        fn:   'Read Chapter\n(UC-10)',
        desc: 'Guest reads a free chapter or Reader reads a VIP chapter (after unlock/subscription check); page must load fast on 4G mobile; VIP content must never leak to unauthorized users.',
        req: [
          'Performance:',
          '- MUST achieve Time-to-Interactive < 1.5 s P95 on 4G mobile (measured at Vercel edge)',
          '- MUST NOT hydrate chapter content pages with client JS — RSC only (< 50 KB JS payload)',
          '- Free chapter HTML MUST be cached at Cloudflare edge: Cache-Control: s-maxage=60',
          '- Chapter cover and images MUST be served as WebP/AVIF via Cloudinary',
          '- CDN-cached TTFB MUST be < 50 ms',
          '',
          'Integrity:',
          '- Chapter body text MUST NOT be present in HTML response to clients without access',
          '- VIP access check MUST query DB (chapter_unlocks OR subscriptions) — NEVER from Redis cache',
          '- RSC MUST call monetization.checkAccess() BEFORE fetching chapter body content',
          '- If access = false, RSC renders lock overlay only; chapter body is NOT queried from DB',
          '',
          'Architectural Driver: AD-01 (Chapter Read Latency), AD-03 (Coin Balance Integrity)',
          'QA Scenarios: ADD §2.2.1 (Free Chapter Read Latency), ADD §2.1.2 (VIP Content Protection)',
          'Tactics: T-01 (RSC), T-02 (Cloudflare edge CDN), T-03 (Cloudinary image optimization)',
          'Components: app/novels/[slug]/chapters/[n]/page.tsx (RSC), content module getChapter(), monetization module checkAccess(), Cloudflare CDN',
          'Traceability: SRS UC-10, SAD DR-01, AD-D-01, AD-D-03',
        ].join('\n'),
        note: 'AD-01. BV=H, TR=H.\nH,H DRIVER — TOP PRIORITY.\nCore reading experience driver.',
      },
    ],
  },

  // ── 3.0 Personal Library & Progress ───────────────────────────────────────
  {
    section: '3.0',
    group:   'Personal Library\n& Progress',
    rows: [
      {
        fn:   'Follow Novel / Track\nProgress / View Library\n(UC-12, UC-13, UC-14)',
        desc: 'Reader follows novels, tracks reading progress per chapter, and manages a personal library; all state is DB-backed and consistent across sessions.',
        req: [
          'Reliability:',
          '- Reading progress upsert MUST be idempotent — composite PK (userId, chapterId) ensures no duplicate progress records',
          '- Progress save MUST NOT block chapter render — implemented as background POST after page load',
          '- Library / follow state MUST be DB-backed; MUST NOT rely on localStorage or client-side session',
          '- Bookmark and library operations MUST be atomic (single DB write per action)',
          '- Novel follow creates a record in novel_follows; duplicate follow MUST be a no-op (upsert with conflict ignore)',
          '',
          'Performance:',
          '- Library list MUST support server-side pagination (default 20 per page)',
          '- Progress queries MUST use composite index on reading_progress(userId, chapterId)',
          '',
          'Architectural Driver: (Library reliability — non-ASUC; supports reader retention)',
          'Tactics: (upsert pattern, composite PK — standard DB correctness)',
          'Components: reader module (getProgress, upsertProgress, toggleLibrary), reading_progress table, library_entries table, novel_follows table',
          'Traceability: SRS UC-12, UC-13, UC-14, SAD VP-4.2',
        ].join('\n'),
        note: 'BV=M, TR=L.\nDB-only state. No cache complexity needed.',
      },
    ],
  },

  // ── 4.0 Monetization ──────────────────────────────────────────────────────
  {
    section: '4.0',
    group:   'Monetization',
    rows: [
      {
        fn:   'Purchase Coins\nvia MoMo\n(UC-17)',
        desc: 'Reader selects a coin package and pays via MoMo; MoMo delivers a signed webhook; coins are credited atomically once per payment regardless of retry count.',
        req: [
          'Reliability:',
          '- MUST verify MoMo HMAC-SHA256 signature before processing any webhook action',
          '- MUST check payments.status before crediting coins (idempotency guard: ignore if already SUCCESS)',
          '- MUST credit coins AND write coin_transactions entry in a single atomic DB transaction',
          '- MUST NOT expose the MoMo secret key to the browser client',
          '- Webhook handler MUST complete within 10 s (Vercel Hobby function timeout constraint)',
          '- One orderId MUST result in exactly one coin_transactions entry — zero double-credit',
          '- Payment record MUST be created with status = PENDING before redirecting browser to MoMo',
          '',
          'Security:',
          '- HMAC-SHA256 comparison MUST be constant-time (prevent timing attacks)',
          '- Invalid or missing signature MUST return HTTP 400 without revealing error details',
          '',
          'Architectural Driver: AD-04 (MoMo Webhook Idempotency)',
          'QA Scenarios: ADD §2.1.3 (Payment Webhook Integrity), ADD §2.3.2 (MoMo Webhook Idempotency)',
          'Tactics: T-06 (db.transaction()), T-08 (payments.status idempotency key check)',
          'Components: monetization module handleWebhook()/initPayment(), payments table, coin_transactions table, MoMo Gateway (CN-07 initiation, CN-08 webhook)',
          'Traceability: SRS UC-17, SAD AD-D-06, DR-03',
        ].join('\n'),
        note: 'AD-04. BV=H, TR=H.\nH,H DRIVER — financial correctness.\nDouble-credit = direct revenue loss.',
      },
      {
        fn:   'Unlock VIP Chapter\n(UC-18)',
        desc: 'Reader spends exactly 1 coin to unlock permanent access to a VIP chapter; concurrent requests from the same user must never cause overdraft.',
        req: [
          'Integrity:',
          '- MUST execute coin_balance debit + chapter_unlocks insert + coin_transactions insert in a SINGLE DB transaction',
          '- MUST use SELECT FOR UPDATE on users.coin_balance to serialize concurrent access (prevent race-condition overdraft)',
          '- coin_balance MUST NEVER go below 0; return HTTP 402 (insufficient_coins) if balance < 1',
          '- coin_balance MUST NEVER be read from Redis or any in-memory cache — always from DB',
          '- MUST check chapter_unlocks before charging (idempotency: return already_unlocked if record exists)',
          '- chapter_unlocks has UNIQUE constraint (userId, chapterId) — enforces idempotency at DB level',
          '- coin_transactions ledger MUST match coin_balance exactly after every operation',
          '',
          'Architectural Driver: AD-03 (Coin Balance Integrity)',
          'QA Scenarios: ADD §2.3.1 (Coin Balance Integrity)',
          'Tactics: T-06 (db.transaction()), T-07 (SELECT FOR UPDATE row lock)',
          'Components: monetization module unlockChapter(), users table (coin_balance), chapter_unlocks table, coin_transactions table, Neon PostgreSQL',
          'Traceability: SRS UC-18, SAD AD-D-03, DR-02, DR-04',
        ].join('\n'),
        note: 'AD-03. BV=H, TR=H.\nH,H DRIVER — TOP PRIORITY.\nCoin integrity = platform financial trust.',
      },
    ],
  },

  // ── 5.0 Community ─────────────────────────────────────────────────────────
  {
    section: '5.0',
    group:   'Community',
    rows: [
      {
        fn:   'Write Review /\nLeave Comment\n(UC-15, UC-16)',
        desc: 'Authenticated Reader writes a novel review or leaves a chapter comment; community actions must be authenticated, rate-limited, and free of duplicate entries.',
        req: [
          'Security / Reliability:',
          '- MUST verify authentication before allowing create/edit/delete of any comment or review',
          '- MUST enforce rate-limit on comment creation to prevent spam flooding',
          '- Reviews MUST be unique per user per novel (DB UNIQUE constraint: userId + novelId)',
          '- Comment parentId MUST be validated — threaded depth limited to 1 level (performance guard)',
          '- Voting (comment_votes, review_votes) MUST be idempotent (UNIQUE constraint: userId + targetId)',
          '',
          'Modifiability:',
          '- Community module is Phase 3 — DB schema MUST be defined but service layer is stubbed in V1',
          '- Business logic MUST NOT be embedded in RSC pages; MUST reside in community module only',
          '',
          'Architectural Driver: (Phase 3 — not a current ASUC; schema readiness is the V1 concern)',
          'Components: community module (stub), comments table, reviews table, comment_votes table, review_votes table',
          'Traceability: SRS UC-15, UC-16, SAD VP-4.2',
        ].join('\n'),
        note: 'Phase 3. BV=M, TR=L.\nSchema defined now; service logic stubbed until Phase 3.',
      },
    ],
  },

  // ── 6.0 Content Management (Curator) ──────────────────────────────────────
  {
    section: '6.0',
    group:   'Content Management\n(Curator)',
    rows: [
      {
        fn:   'Curator Manage\nNovel & Chapter\n(UC-21, UC-22)',
        desc: 'Curator creates and edits novels and chapters via CMS; chapter HTML content is server-sanitized before storage; publishing triggers Meilisearch re-indexing.',
        req: [
          'Security:',
          '- Chapter content MUST be sanitized with DOMPurify server-side before DB write (prevents stored XSS)',
          '- MUST verify curator role via src/middleware.ts before any CMS API action; return 403 for non-curator',
          '- Image uploads MUST go through Cloudinary signed upload — NEVER store on Vercel ephemeral storage',
          '- Novel slug MUST be auto-generated from title via slugify; UNIQUE index on novels.slug',
          '',
          'Publishing side-effects:',
          '- Chapter status transition (DRAFT → PUBLISHED) MUST be atomic (single DB write)',
          '- On chapter PUBLISHED: MUST trigger search module indexChapter() — index updated within 60 s',
          '- On chapter PUBLISHED: MUST trigger notifications module notifyFollowers() — followers notified within 60 s',
          '- Meilisearch indexing or notification failure MUST NOT roll back the committed chapter record',
          '- Cover image URL MUST be a Cloudinary CDN URL stored in novels.coverUrl',
          '',
          'Architectural Driver: AD-07 (Content Security — XSS Prevention)',
          'QA Scenarios: ADD §2.1.5 (Curator Content Sanitization), ADD §2.3.3 (Chapter Publish Consistency)',
          'Tactics: T-12 (server-side DOMPurify sanitization)',
          'Components: content module createChapter()/updateChapter(), chapters table, novels table, Cloudinary (CN-06), search module indexChapter(), notifications module',
          'Traceability: SRS UC-21, UC-22, SAD AD-D-08',
        ].join('\n'),
        note: 'AD-07. BV=H, TR=M.\nXSS prevention critical — stored content read by all users.',
      },
    ],
  },

  // ── 7.0 Admin & Authorization ─────────────────────────────────────────────
  {
    section: '7.0',
    group:   'Admin &\nAuthorization',
    rows: [
      {
        fn:   'Admin Manage\nSystem\n(UC-23)',
        desc: 'Admin suspends users, manages coin packages, resolves reports, and reviews audit logs; every mutation must be written to audit_logs atomically with the action.',
        req: [
          'Auditability:',
          '- MUST write audit_logs entry in the SAME DB transaction as every admin mutation',
          '- audit_logs MUST include: adminId, action, targetType, targetId, timestamp',
          '- 100% of admin mutations MUST have a corresponding audit_logs entry — zero exceptions',
          '- Admin actions MUST NOT be undone without a new opposing logged action',
          '',
          'Security:',
          '- MUST enforce ADMIN role check at src/middleware.ts before any /api/admin/* route',
          '- Non-admin requests to /api/admin/* MUST return HTTP 403 before executing any business logic',
          '- Hidden/suspended content MUST be de-indexed from Meilisearch within seconds of admin action',
          '',
          'Architectural Driver: AD-08 (Admin Action Auditability)',
          'QA Scenarios: ADD §2.1.1 (Auth & Authorization)',
          'Tactics: T-13 (audit_logs insert in same DB transaction as admin write)',
          'Components: admin module auditLog()/suspendUser()/listUsers(), audit_logs table, src/middleware.ts (role check), search module (de-index)',
          'Traceability: SRS UC-23, SAD AD-D-09',
        ].join('\n'),
        note: 'AD-08. BV=M, TR=L.\nCompliance + forensics. Atomic audit = tamper-evident trail.',
      },
    ],
  },

  // ── 8.0 Infrastructure & Deployment ───────────────────────────────────────
  {
    section: '8.0',
    group:   'Infrastructure &\nDeployment (NFR)',
    rows: [
      {
        fn:   'Serverless Deployment\n(NFR)',
        desc: 'Application runs on Vercel serverless with Neon PostgreSQL (HTTP driver); functions must be stateless and cold-start within 500 ms.',
        req: [
          'Availability / Performance:',
          '- Serverless function cold-start MUST be < 500 ms (requires Drizzle ORM, not Prisma — bundle size)',
          '- MUST use Neon HTTP serverless driver (not TCP) to work within Vercel serverless connection model',
          '- Webhook handlers MUST complete in < 10 s (Vercel Hobby plan function timeout)',
          '- MUST NOT store persistent state in function memory — stateless design required',
          '- Development MUST target Vercel Hobby + Neon free tier (cost ≤ $0)',
          '- Production MUST upgrade to Vercel Pro before accepting real MoMo payments (>10 s function support)',
          '',
          'Scalability:',
          '- V1 → V2 scaling MUST require only environment variable changes and plan upgrades — zero code changes',
          '- Static assets and ISR pages MUST be served from Cloudflare / Vercel edge PoPs (CDN)',
          '',
          'Architectural Driver: G-07 (zero cost dev), G-08 (cold-start < 500 ms)',
          'Tactics: T-02 (edge CDN caching)',
          'Components: Vercel Edge runtime, Neon Serverless HTTP driver, src/lib/db.ts',
          'Traceability: SRS §4, SAD §6 VP-6.1/6.2, AD-D-01, AD-D-02',
        ].join('\n'),
        note: 'G-08. BV=H, TR=M.\nCold-start constraint drives Drizzle > Prisma decision.',
      },
      {
        fn:   'Module Isolation\n(NFR)',
        desc: 'Feature modules in src/modules/ must not import from each other; cross-module interaction goes through exported service functions only.',
        req: [
          'Modifiability:',
          '- Modules in src/modules/ MUST NOT import from sibling modules (enforced by ESLint import rules)',
          '- Cross-module interaction MUST go through exported service functions only — never through internals',
          '- Presentation layer (src/app/) MUST NOT import src/db/schema/* directly',
          '- All DB writes involving coin_balance MUST use db.transaction() (enforced by code review)',
          '- src/lib/ MUST contain only shared infrastructure — no business logic',
          '',
          'Testability:',
          '- Module isolation enables independent unit testing of each module with a mocked DB client',
          '',
          'Architectural Driver: DR-07 (module isolation), AD-D-04',
          'Components: All src/modules/*, ESLint import configuration, src/lib/ (shared infra)',
          'Traceability: CLAUDE.md module boundaries, SAD §4.5.5 DC-01–DC-05',
        ].join('\n'),
        note: 'DR-07. BV=H, TR=L.\nPrevents big-ball-of-mud. Solo-dev maintainability.',
      },
      {
        fn:   'Database Indexing\nStrategy (NFR)',
        desc: 'Key tables must have correct indexes to meet latency targets; full-text search must route to Meilisearch, not PostgreSQL ILIKE scans on the hot path.',
        req: [
          'Performance:',
          '- users.email MUST have a UNIQUE index (fast auth lookup + duplicate prevention)',
          '- reading_progress(userId, chapterId) MUST be the composite PK (fast per-user progress lookup)',
          '- chapters(novelId, chapterNumber) MUST have a composite index (sequential chapter navigation)',
          '- payments.orderId MUST have an index (O(log n) idempotency lookup in webhook handler)',
          '- chapter_unlocks(userId, chapterId) MUST have a UNIQUE constraint (fast access check + no duplicates)',
          '- novels.slug MUST have a UNIQUE index (fast slug-based routing)',
          '- Novel title full-text search MUST route to Meilisearch; MUST NOT use ILIKE on novels table in production hot path',
          '',
          'Architectural Driver: DR-01 (chapter read < 1.5 s), AD-05 (search < 500 ms)',
          'Tactics: T-09 (Meilisearch for search), T-07 (row lock on coin_balance reads)',
          'Components: src/db/schema/ Drizzle index definitions, Neon PostgreSQL',
          'Traceability: SRS §3, SAD DR-01, AD-D-02',
        ].join('\n'),
        note: 'DR-01/AD-05. BV=H, TR=M.\nIndex placement drives query latency at scale.',
      },
    ],
  },

];

// ── Build workbook ─────────────────────────────────────────────────────────────
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'NovelHub Architecture Team';
  wb.created  = new Date('2026-05-18');
  wb.modified = new Date();

  const ws = wb.addWorksheet('ASR', {
    views:      [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF2E4057' } },
  });

  // ── Column widths ──────────────────────────────────────────────────────────
  ws.columns = [
    { key: 'section',  width: 10  },  // A
    { key: 'group',    width: 24  },  // B
    { key: 'fn',       width: 24  },  // C
    { key: 'desc',     width: 40  },  // D
    { key: 'req',      width: 82  },  // E
    { key: 'note',     width: 34  },  // F
  ];

  // ── Header row ─────────────────────────────────────────────────────────────
  const headerLabels = [
    'Section', 'Requirement Group', 'Function', 'Description',
    'Architectural Requirements', 'Note',
  ];
  const hRow = ws.addRow(headerLabels);
  hRow.height = 28;
  hRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 11, color: { argb: C.headerFg } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border    = border('medium');
  });

  // ── Data rows ──────────────────────────────────────────────────────────────
  let rowNum = 2;  // 1-indexed; header = row 1

  for (const grp of ASR_DATA) {
    const grpStart = rowNum;

    for (let i = 0; i < grp.rows.length; i++) {
      const r   = grp.rows[i];
      const alt = i % 2 === 1;

      const dRow = ws.addRow([grp.section, grp.group, r.fn, r.desc, r.req, r.note]);

      // Row height — proportional to lines in requirements column
      const lines  = r.req.split('\n').length;
      dRow.height  = Math.max(90, lines * 12 + 16);

      // Col A — section number
      styleCell(dRow.getCell(1), {
        bold: true, size: 11,
        fill: C.secBg,
        halign: 'center', valign: 'top', wrap: true,
      });

      // Col B — group name
      styleCell(dRow.getCell(2), {
        bold: true, size: 10,
        fill: C.grpBg,
        halign: 'left', valign: 'top', wrap: true,
      });

      // Col C — function
      styleCell(dRow.getCell(3), {
        bold: true, size: 10,
        fill: alt ? C.altBg : C.reqBg,
        halign: 'left', valign: 'top', wrap: true,
      });

      // Col D — description
      styleCell(dRow.getCell(4), {
        italic: true, size: 10,
        fill: alt ? C.altBg : C.reqBg,
        halign: 'left', valign: 'top', wrap: true,
      });

      // Col E — architectural requirements (main content)
      styleCell(dRow.getCell(5), {
        size: 10,
        fill: alt ? C.altBg : C.reqBg,
        halign: 'left', valign: 'top', wrap: true,
      });

      // Col F — note
      const noteCell = dRow.getCell(6);
      styleCell(noteCell, {
        size: 10, italic: true,
        fill: alt ? C.altBg : C.reqBg,
        halign: 'left', valign: 'top', wrap: true,
      });
      noteCell.font = { ...noteCell.font, color: { argb: C.noteFg } };

      rowNum++;
    }

    // Merge section (A) and group (B) cells if the group has multiple rows
    if (grp.rows.length > 1) {
      ws.mergeCells(grpStart, 1, rowNum - 1, 1);
      ws.mergeCells(grpStart, 2, rowNum - 1, 2);
      // Re-apply alignment on merged cells (ExcelJS requires setting on first cell again)
      ws.getCell(grpStart, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      ws.getCell(grpStart, 2).alignment = { horizontal: 'left',   vertical: 'middle', wrapText: true };
    }

    // Thicker bottom border on the last row of each group
    const lastRow = ws.getRow(rowNum - 1);
    lastRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col <= 6) cell.border = border('medium');
    });
  }

  // ── Write file ─────────────────────────────────────────────────────────────
  await wb.xlsx.writeFile(outPath);
  const { statSync } = require('fs');
  const kb = (statSync(outPath).size / 1024).toFixed(1);
  console.log(`Done! ASR.xlsx = ${kb} KB  →  ${outPath}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function border(style = 'thin') {
  const s = { style, color: { argb: C.border } };
  return { top: s, left: s, bottom: s, right: s };
}

function styleCell(cell, { bold, italic, size, fill, halign, valign, wrap }) {
  cell.font = {
    name: 'Arial',
    size: size  ?? 10,
    bold: bold  ?? false,
    italic: italic ?? false,
  };
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill ?? C.reqBg } };
  cell.alignment = { horizontal: halign ?? 'left', vertical: valign ?? 'top', wrapText: wrap ?? true };
  cell.border    = border('thin');
}

main().catch(console.error);
