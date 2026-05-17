import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "docs", "generated-drive");
mkdirSync(outDir, { recursive: true });

const today = "2026-05-17";
const css = `
  @page { margin: 0.7in; }
  body { font-family: Arial, sans-serif; color: #1f2937; line-height: 1.48; }
  h1 { color: #1e3a8a; font-size: 28pt; margin: 0 0 8px; }
  h2 { color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 5px; margin-top: 28px; }
  h3 { color: #374151; margin-top: 18px; }
  p { margin: 7px 0; }
  .cover { border-left: 10px solid #2563eb; padding: 18px 22px; background: #f8fafc; margin-bottom: 18px; }
  .meta { color: #475569; font-size: 10pt; }
  .callout { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 5px solid #2563eb; padding: 10px 12px; margin: 12px 0; }
  .warn { background: #fff7ed; border-color: #fed7aa; border-left-color: #f97316; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; background: #ffffff; }
  .kpi { font-size: 18pt; color: #1d4ed8; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 9.5pt; }
  th { background: #dbeafe; color: #111827; text-align: left; font-weight: 700; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { font-family: Consolas, monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
  .figure { margin: 16px 0 22px; padding: 12px; border: 1px solid #cbd5e1; background: #ffffff; }
  .caption { color: #475569; font-size: 9pt; margin-top: 6px; }
  svg { max-width: 100%; height: auto; }
  .small { font-size: 9pt; color: #475569; }
`;

function doc(title, subtitle, sections) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body>
  <div class="cover">
    <h1>${title}</h1>
    <h3>${subtitle}</h3>
    <p class="meta">Project: NovelHub web novel platform | Version: 2.0 | Date: ${today} | Status: Working architecture deliverable</p>
  </div>
  ${sections.join("\n")}
</body>
</html>`;
}

const table = (headers, rows) => `
<table>
  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
</table>`;

const bullets = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;

const currentStatus = table(
  ["Area", "Implemented now", "Still planned or partial"],
  [
    ["Platform foundation", "Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/Radix UI.", "Production hardening, monitoring, and formal release gates."],
    ["Identity", "Better Auth email/password and Google OAuth, session cookies, protected routes.", "Facebook/Zalo OAuth, deeper account deletion workflow."],
    ["Content", "Curator CMS, novels, chapters, genres, tags, featured content, Cloudinary covers.", "Advanced scheduling controls and richer editorial workflows."],
    ["Reader", "Chapter reader, theme/settings, progress API, free/VIP gating.", "Offline pre-download and real-time cross-device sync."],
    ["Monetization", "Coin packages, MoMo create/webhook/test flow, balance endpoint, VIP unlock service.", "VNPay, subscription renewal/cancel lifecycle, invoices/VAT workflow."],
    ["Community", "Chapter comments/replies/votes, reviews/helpful votes, follows, notifications.", "Public reader-following UI and richer reporting UX."],
    ["Admin", "Users, moderation, hidden comments/reviews, reports, audit logs, analytics summary.", "Full analytics dashboard depth and operational alerting."],
    ["Search", "Meilisearch service with database fallback and index script.", "Recommendation engine and automated search relevance tuning."],
  ],
);

const srsSections = [
  `<h2>1. Purpose and Scope</h2>
  <p>This SRS defines the expected behavior of NovelHub, a Vietnamese web novel reading platform for curated translated novels. It is written for implementation, testing, architecture review, and project handoff. The platform is not a public author-submission product; content is managed by internal curators and administrators.</p>
  <div class="callout"><b>Boundary rule:</b> NovelHub is a reading, discovery, community, and monetization product. Source samples are visual references only and do not define product scope.</div>`,
  `<h2>2. Stakeholders and Actors</h2>
  ${table(["Actor", "Goal", "Primary system access"], [
    ["Guest", "Discover novels and read free public chapters.", "Homepage, browse, novel detail, free chapter reader, sign-in/up."],
    ["Reader", "Track progress, follow novels, comment/review, buy coins, unlock VIP chapters.", "Reader UI, account pages, payment, community APIs."],
    ["Curator", "Publish and maintain internal novel catalog.", "Curator CMS for novels, chapters, covers, VIP flags, publish status."],
    ["Admin", "Operate the platform and moderate users/content.", "Admin dashboard, user management, moderation, reports, audit logs, analytics."],
    ["MoMo", "Confirm external payments.", "Payment creation endpoint and signed webhook callback."],
    ["Search provider", "Serve typo-tolerant catalog search.", "Meilisearch index and query integration."],
  ])}`,
  `<h2>3. Product Context</h2>
  <div class="grid">
    <div class="card"><div class="kpi">Content-first</div><p>Novel detail and chapter pages must be fast, readable, and SEO-friendly.</p></div>
    <div class="card"><div class="kpi">Vietnam-first</div><p>Vietnamese UI copy, MoMo-first payments, and low-latency SEA hosting choices.</p></div>
    <div class="card"><div class="kpi">Solo-operable</div><p>Managed services and a modular monolith are preferred over distributed operations.</p></div>
  </div>`,
  `<h2>4. Functional Requirements</h2>
  ${table(["ID", "Requirement", "Acceptance notes"], [
    ["FR-01", "The homepage shall show featured, trending, and newly updated novels.", "Empty sections are hidden; data comes from content services and cached where safe."],
    ["FR-02", "Users shall browse by search keyword, status, genre, and tags.", "Filters must be reflected in URL query parameters and be shareable."],
    ["FR-03", "Search shall query Meilisearch when configured and fall back to database matching otherwise.", "Fallback must not crash browse page when search credentials are absent."],
    ["FR-04", "Novel detail pages shall display cover, synopsis, status, language, genres, tags, rating, chapters, reviews, follow action, and recommendations placeholder.", "Server-rendered metadata must be present for SEO."],
    ["FR-05", "Chapter pages shall render published free content to guests and authenticated readers.", "Unpublished and missing chapters return controlled not-found behavior."],
    ["FR-06", "Reader settings shall support theme, font family, font size, line height, and reading width.", "Settings persist client-side and do not block SSR content."],
    ["FR-07", "Authenticated reading progress shall be saved and used for continue-reading.", "Progress is per user, novel, and chapter."],
    ["FR-08", "VIP chapters shall hide protected content unless the user has an active entitlement.", "Entitlement is subscription or existing chapter unlock."],
    ["FR-09", "Readers shall purchase coins through MoMo and receive a payment redirect or QR/deep link.", "Payment row is created before redirect."],
    ["FR-10", "MoMo webhooks shall verify signature, update payment status, and credit coins idempotently.", "Repeated SUCCESS webhook must not double-credit balance."],
    ["FR-11", "Readers shall unlock VIP chapters by spending coins.", "Unlock creates chapter_unlock and ledger transaction atomically."],
    ["FR-12", "Unlocked chapters shall remain permanently accessible to the unlocking reader.", "Access does not depend on current coin balance."],
    ["FR-13", "Curators shall create, edit, delete, schedule, publish, feature, and mark VIP novels/chapters.", "Role checks apply to all write routes."],
    ["FR-14", "Readers shall comment on chapters, reply to comments, and vote on comments.", "Votes are one per user per comment."],
    ["FR-15", "Readers shall write/update/delete novel reviews and mark reviews helpful.", "Average rating updates when review content changes."],
    ["FR-16", "Readers shall follow/unfollow novels and receive in-app notifications for new chapters.", "Notifications are generated when publish flow runs."],
    ["FR-17", "Admins shall list users, update role/status, resolve reports, hide/unhide content, and inspect audit logs.", "Sensitive admin operations must be audited."],
    ["FR-18", "The system shall expose sitemap, robots policy, Open Graph, and structured metadata.", "Novel/chapter pages should be indexable; admin/API paths should not."],
    ["FR-19", "Users shall sign up, sign in, sign out, reset password, and update profile settings.", "Auth state uses secure HttpOnly session cookies."],
    ["FR-20", "The platform shall expose transaction history for purchases, unlocks, and subscriptions.", "Ledger is the audit source; balance is denormalized for reads."],
  ])}`,
  `<h2>5. Primary Use Cases</h2>
  ${table(["Use case", "Trigger", "Main success flow", "Exceptions"], [
    ["UC-01 Browse catalog", "Guest or reader opens /novels.", "Apply filters, search, paginate, display novel cards.", "Search provider down: use DB fallback or cached editorial lists."],
    ["UC-02 Read free chapter", "User opens published free chapter.", "SSR loads metadata/content, renders reader, initializes settings, optionally saves progress.", "Chapter missing/unpublished: return not found."],
    ["UC-03 Unlock VIP chapter", "Reader clicks unlock in lock gate.", "Check session, entitlement, balance, perform DB transaction, return new balance.", "Insufficient coins: show buy-coins path. Already unlocked: return success without debit."],
    ["UC-04 Buy coins with MoMo", "Reader selects package on pricing page.", "Create pending payment, call MoMo create API, redirect to pay URL, process webhook.", "Invalid signature or failed result: mark failed and do not credit coins."],
    ["UC-05 Curator publishes chapter", "Curator submits publish form.", "Validate role/content, save chapter, update novel counters, index search, notify followers.", "Invalid role: deny. Search unavailable: save content and retry later."],
    ["UC-06 Review novel", "Reader submits rating and review body.", "Upsert review, recalculate average rating, show updated reviews.", "Rating outside 1-5 or unauthenticated: reject."],
    ["UC-07 Moderate report", "Admin opens report queue.", "Review target, hide/unhide/dismiss, write audit log.", "Target deleted: resolve as stale with audit note."],
  ])}`,
  `<h2>6. Non-Functional Requirements</h2>
  ${table(["ID", "Quality", "Scenario", "Target"], [
    ["NFR-01", "Performance", "Chapter reader opens from novel detail on normal network.", "LCP under 1.5s for cached/public content."],
    ["NFR-02", "Search performance", "Reader searches a common title/tag.", "p95 under 300 ms when Meilisearch is healthy."],
    ["NFR-03", "Availability", "Meilisearch or recommendation service is unavailable.", "Reader-facing pages continue with fallback content."],
    ["NFR-04", "Security", "Payment webhook received from external provider.", "Reject if signature is invalid; never trust client-reported payment status."],
    ["NFR-05", "Consistency", "Coin purchase or unlock is retried.", "Ledger and balance remain correct after retries or duplicate webhooks."],
    ["NFR-06", "Maintainability", "A feature grows large enough to extract.", "Module has service boundary and limited direct cross-module coupling."],
    ["NFR-07", "SEO", "Search engine crawls novel/chapter page.", "SSR content, canonical URL, sitemap, robots policy, and metadata are valid."],
    ["NFR-08", "Accessibility", "Reader uses keyboard and dark mode.", "Core reading/navigation controls are keyboard reachable with sufficient contrast."],
  ])}`,
  `<h2>7. Constraints and Assumptions</h2>
  ${bullets([
    "The project uses Next.js 16.2.4 App Router; implementation must follow the local Next.js documentation before new framework code is written.",
    "The database is PostgreSQL on Neon with Drizzle ORM schema ownership.",
    "Public novel and chapter data can be cached; private payment, balance, subscription, and entitlement checks cannot be publicly cached.",
    "MoMo is primary for Phase 1 payment testing; VNPay and subscriptions are tracked as planned/partial until implemented.",
    "The system is optimized for a solo developer and low-cost managed infrastructure first.",
  ])}`,
  `<h2>8. Current Implementation Fit</h2>${currentStatus}`,
  `<h2>9. Glossary</h2>
  ${table(["Term", "Definition"], [
    ["Novel", "A curated long-form work published by the internal team."],
    ["Chapter", "A numbered unit of a novel. It can be free, VIP, draft, scheduled, or published."],
    ["VIP chapter", "A locked chapter requiring coins or an active subscription entitlement."],
    ["Coin", "Virtual currency purchased through payment provider and spent on VIP unlocks."],
    ["Curator", "Internal content operator who manages catalog content."],
    ["Entitlement", "The right for a reader to access protected chapter content."],
  ])}`,
];

const layeredSvg = `
<svg viewBox="0 0 960 620" xmlns="http://www.w3.org/2000/svg">
  <defs><style>.t{font:600 16px Arial}.s{font:13px Arial;fill:#334155}.box{rx:10;stroke:#2563eb;stroke-width:2;fill:#eff6ff}.infra{fill:#f8fafc;stroke:#64748b}</style></defs>
  <rect x="40" y="35" width="880" height="85" class="box"/><text x="70" y="70" class="t">Presentation Layer</text><text x="70" y="98" class="s">Next.js App Router pages, server components, client reader controls, admin/curator UI</text>
  <rect x="40" y="145" width="880" height="85" class="box"/><text x="70" y="180" class="t">API and Route Layer</text><text x="70" y="208" class="s">Route handlers for auth, novels, progress, comments, reviews, payments, notifications, admin</text>
  <rect x="40" y="255" width="880" height="105" class="box"/><text x="70" y="290" class="t">Domain Modules</text><text x="70" y="318" class="s">content | reader | community | monetization | search | admin | auth integration</text><text x="70" y="342" class="s">Module services own business rules and database access patterns</text>
  <rect x="40" y="385" width="880" height="85" class="box"/><text x="70" y="420" class="t">Shared Infrastructure</text><text x="70" y="448" class="s">Drizzle DB client, Better Auth config, Redis, Cloudinary, Meilisearch client, validation helpers</text>
  <rect x="40" y="495" width="170" height="70" class="infra"/><text x="70" y="525" class="t">Neon Postgres</text><text x="70" y="550" class="s">system of record</text>
  <rect x="240" y="495" width="150" height="70" class="infra"/><text x="270" y="525" class="t">Upstash Redis</text><text x="270" y="550" class="s">hot cache</text>
  <rect x="420" y="495" width="170" height="70" class="infra"/><text x="450" y="525" class="t">Meilisearch</text><text x="450" y="550" class="s">catalog search</text>
  <rect x="620" y="495" width="130" height="70" class="infra"/><text x="650" y="525" class="t">Cloudinary</text><text x="650" y="550" class="s">covers</text>
  <rect x="780" y="495" width="140" height="70" class="infra"/><text x="810" y="525" class="t">MoMo</text><text x="810" y="550" class="s">payments</text>
</svg>`;

const modulesSvg = `
<svg viewBox="0 0 1040 650" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker><style>.m{rx:10;fill:#eef2ff;stroke:#4338ca;stroke-width:2}.i{rx:10;fill:#f8fafc;stroke:#64748b}.t{font:600 15px Arial}.s{font:12px Arial;fill:#475569}.ln{stroke:#475569;stroke-width:2;marker-end:url(#a)}</style></defs>
  <rect x="420" y="40" width="200" height="70" class="m"/><text x="455" y="72" class="t">App Routes</text><text x="455" y="95" class="s">pages and APIs</text>
  <rect x="70" y="180" width="150" height="70" class="m"/><text x="95" y="213" class="t">Content</text><text x="95" y="235" class="s">novels chapters</text>
  <rect x="260" y="180" width="150" height="70" class="m"/><text x="285" y="213" class="t">Reader</text><text x="285" y="235" class="s">progress follows</text>
  <rect x="450" y="180" width="150" height="70" class="m"/><text x="475" y="213" class="t">Community</text><text x="475" y="235" class="s">comments reviews</text>
  <rect x="640" y="180" width="170" height="70" class="m"/><text x="665" y="213" class="t">Monetization</text><text x="665" y="235" class="s">coins unlocks MoMo</text>
  <rect x="850" y="180" width="130" height="70" class="m"/><text x="875" y="213" class="t">Admin</text><text x="875" y="235" class="s">ops audit</text>
  <rect x="165" y="340" width="150" height="70" class="m"/><text x="195" y="373" class="t">Search</text><text x="195" y="395" class="s">index query</text>
  <rect x="390" y="340" width="170" height="70" class="m"/><text x="415" y="373" class="t">Notifications</text><text x="415" y="395" class="s">chapter events</text>
  <rect x="650" y="340" width="160" height="70" class="m"/><text x="675" y="373" class="t">Auth</text><text x="675" y="395" class="s">Better Auth</text>
  <rect x="130" y="520" width="780" height="65" class="i"/><text x="165" y="555" class="t">Shared storage and providers: Postgres, Redis, Meilisearch, Cloudinary, MoMo</text>
  <path d="M520 110 L145 180" class="ln"/><path d="M520 110 L335 180" class="ln"/><path d="M520 110 L525 180" class="ln"/><path d="M520 110 L725 180" class="ln"/><path d="M520 110 L915 180" class="ln"/>
  <path d="M145 250 L240 340" class="ln"/><path d="M145 250 L475 340" class="ln"/><path d="M335 250 L475 340" class="ln"/><path d="M725 250 L730 340" class="ln"/><path d="M915 250 L730 340" class="ln"/>
  <path d="M240 410 L240 520" class="ln"/><path d="M475 410 L475 520" class="ln"/><path d="M730 410 L730 520" class="ln"/><path d="M145 250 L300 520" class="ln"/><path d="M725 250 L725 520" class="ln"/>
</svg>`;

const deploymentSvg = `
<svg viewBox="0 0 1040 560" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="a2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#334155"/></marker><style>.n{rx:12;fill:#ecfeff;stroke:#0891b2;stroke-width:2}.e{rx:12;fill:#fff7ed;stroke:#f97316;stroke-width:2}.d{rx:12;fill:#f0fdf4;stroke:#16a34a;stroke-width:2}.t{font:600 15px Arial}.s{font:12px Arial;fill:#475569}.ln{stroke:#334155;stroke-width:2;marker-end:url(#a2)}</style></defs>
  <rect x="40" y="70" width="160" height="80" class="n"/><text x="72" y="105" class="t">Browser</text><text x="72" y="128" class="s">guest reader admin</text>
  <rect x="250" y="70" width="180" height="80" class="e"/><text x="285" y="105" class="t">Cloudflare</text><text x="285" y="128" class="s">DNS CDN WAF</text>
  <rect x="490" y="70" width="190" height="80" class="e"/><text x="525" y="105" class="t">Vercel</text><text x="525" y="128" class="s">Next.js runtime</text>
  <rect x="90" y="290" width="170" height="80" class="d"/><text x="125" y="325" class="t">Neon</text><text x="125" y="348" class="s">PostgreSQL</text>
  <rect x="310" y="290" width="170" height="80" class="d"/><text x="345" y="325" class="t">Upstash</text><text x="345" y="348" class="s">Redis cache</text>
  <rect x="530" y="290" width="170" height="80" class="d"/><text x="565" y="325" class="t">Meilisearch</text><text x="565" y="348" class="s">catalog search</text>
  <rect x="750" y="290" width="170" height="80" class="d"/><text x="785" y="325" class="t">Cloudinary</text><text x="785" y="348" class="s">cover images</text>
  <rect x="780" y="70" width="180" height="80" class="d"/><text x="815" y="105" class="t">MoMo</text><text x="815" y="128" class="s">payment gateway</text>
  <path d="M200 110 L250 110" class="ln"/><path d="M430 110 L490 110" class="ln"/><path d="M680 110 L780 110" class="ln"/>
  <path d="M585 150 L175 290" class="ln"/><path d="M585 150 L395 290" class="ln"/><path d="M585 150 L615 290" class="ln"/><path d="M585 150 L835 290" class="ln"/><path d="M870 150 L610 150 L610 70" fill="none" stroke="#334155" stroke-width="2"/>
  <text x="720" y="185" class="s">signed webhook returns to /api/payment/momo/webhook</text>
</svg>`;

const unlockSvg = `
<svg viewBox="0 0 980 530" xmlns="http://www.w3.org/2000/svg">
  <defs><marker id="a3" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#334155"/></marker><style>.p{rx:8;fill:#f8fafc;stroke:#64748b;stroke-width:2}.t{font:600 14px Arial}.s{font:12px Arial;fill:#475569}.ln{stroke:#334155;stroke-width:2;marker-end:url(#a3)}</style></defs>
  <rect x="40" y="40" width="130" height="60" class="p"/><text x="70" y="76" class="t">Reader UI</text>
  <rect x="230" y="40" width="155" height="60" class="p"/><text x="260" y="76" class="t">Unlock API</text>
  <rect x="445" y="40" width="170" height="60" class="p"/><text x="475" y="76" class="t">Unlock Service</text>
  <rect x="675" y="40" width="160" height="60" class="p"/><text x="710" y="76" class="t">Postgres</text>
  <path d="M105 100 L105 470" stroke="#94a3b8"/><path d="M307 100 L307 470" stroke="#94a3b8"/><path d="M530 100 L530 470" stroke="#94a3b8"/><path d="M755 100 L755 470" stroke="#94a3b8"/>
  <path d="M105 135 L307 135" class="ln"/><text x="135" y="128" class="s">POST unlock chapter</text>
  <path d="M307 175 L530 175" class="ln"/><text x="337" y="168" class="s">validate session and IDs</text>
  <path d="M530 215 L755 215" class="ln"/><text x="560" y="208" class="s">read chapter, subscription, unlock, balance</text>
  <path d="M755 255 L530 255" class="ln"/><text x="570" y="248" class="s">current entitlement state</text>
  <path d="M530 300 L755 300" class="ln"/><text x="560" y="293" class="s">DB transaction: debit coins, insert ledger, insert unlock</text>
  <path d="M755 340 L530 340" class="ln"/><text x="580" y="333" class="s">commit new balance</text>
  <path d="M530 385 L307 385" class="ln"/><text x="360" y="378" class="s">return success</text>
  <path d="M307 430 L105 430" class="ln"/><text x="145" y="423" class="s">refresh reader and balance</text>
</svg>`;

const useCaseSvg = `
<svg viewBox="0 0 1020 650" xmlns="http://www.w3.org/2000/svg">
  <defs><style>.actor{font:600 14px Arial}.uc{fill:#eff6ff;stroke:#2563eb;stroke-width:2}.sys{fill:none;stroke:#94a3b8;stroke-width:2;stroke-dasharray:6 4}.s{font:12px Arial;fill:#334155}.ln{stroke:#64748b;stroke-width:1.5}</style></defs>
  <rect x="220" y="40" width="570" height="560" class="sys"/><text x="245" y="70" class="actor">NovelHub System</text>
  <text x="60" y="115" class="actor">Guest</text><text x="55" y="310" class="actor">Reader</text><text x="850" y="185" class="actor">Curator</text><text x="855" y="410" class="actor">Admin</text>
  <ellipse cx="410" cy="120" rx="115" ry="34" class="uc"/><text x="350" y="126" class="s">Browse catalog</text>
  <ellipse cx="600" cy="120" rx="115" ry="34" class="uc"/><text x="535" y="126" class="s">Read free chapter</text>
  <ellipse cx="405" cy="230" rx="125" ry="34" class="uc"/><text x="325" y="236" class="s">Manage library/progress</text>
  <ellipse cx="605" cy="230" rx="125" ry="34" class="uc"/><text x="540" y="236" class="s">Unlock VIP chapter</text>
  <ellipse cx="405" cy="340" rx="120" ry="34" class="uc"/><text x="345" y="346" class="s">Comment and review</text>
  <ellipse cx="605" cy="340" rx="115" ry="34" class="uc"/><text x="545" y="346" class="s">Follow novel</text>
  <ellipse cx="500" cy="450" rx="130" ry="34" class="uc"/><text x="425" y="456" class="s">Buy coins with MoMo</text>
  <ellipse cx="380" cy="545" rx="120" ry="34" class="uc"/><text x="315" y="551" class="s">Publish content</text>
  <ellipse cx="625" cy="545" rx="120" ry="34" class="uc"/><text x="560" y="551" class="s">Moderate platform</text>
  <path d="M105 115 L295 120" class="ln"/><path d="M105 115 L485 120" class="ln"/>
  <path d="M105 310 L280 230" class="ln"/><path d="M105 310 L480 230" class="ln"/><path d="M105 310 L285 340" class="ln"/><path d="M105 310 L490 340" class="ln"/><path d="M105 310 L370 450" class="ln"/>
  <path d="M850 185 L500 545" class="ln"/><path d="M850 185 L605 340" class="ln"/>
  <path d="M865 410 L625 545" class="ln"/><path d="M865 410 L500 450" class="ln"/>
</svg>`;

const sadSections = [
  `<h2>1. Executive Architecture Summary</h2>
  <p>NovelHub is a modular monolith deployed as a single Next.js 16 application. It uses PostgreSQL as the system of record, managed external services for search, cache, media, and payments, and strict internal domain modules to keep the codebase extractable later. This choice matches the project constraint of solo-developer operation and low infrastructure cost.</p>
  <div class="callout">Architecture driver: ship a reliable reading and monetization product first, with module boundaries that allow later extraction only after measured bottlenecks appear.</div>`,
  `<h2>2. Architecture Drivers</h2>
  ${table(["Driver", "Impact on architecture"], [
    ["SEO and discovery", "Novel and chapter pages are server-rendered. Metadata, sitemap, and canonical URLs are application concerns."],
    ["Read-heavy workload", "Public content can be cached at CDN/Redis layers; private entitlements are always database-checked."],
    ["Payment correctness", "MoMo callbacks are verified and idempotent; coin balance updates use ledger-backed transactions."],
    ["Solo maintainability", "One deployable Next.js app, managed providers, no premature microservices."],
    ["Future scale", "Content, search, monetization, community, notifications, and admin are separated by module/service boundaries."],
  ])}`,
  `<h2>3. Layered View</h2><div class="figure">${layeredSvg}<p class="caption">Figure 1. Runtime layers for the NovelHub modular monolith.</p></div>`,
  `<h2>4. Module View</h2><div class="figure">${modulesSvg}<p class="caption">Figure 2. Domain modules and provider dependencies. Cross-module behavior should use exported services or events, not ad hoc imports.</p></div>`,
  `<h2>5. Runtime Components</h2>
  ${table(["Component", "Responsibility", "Key files/modules"], [
    ["Next.js App Router", "Pages, layouts, metadata, route handlers, server/client split.", "src/app"],
    ["Content module", "Novel/chapter CRUD, filters, featured content, counters.", "src/modules/content, src/db/schema/content.ts"],
    ["Reader module", "Progress, follows, notifications, reader-facing state.", "src/modules/reader"],
    ["Community module", "Comments, replies, votes, reviews, helpful votes.", "src/modules/community"],
    ["Monetization module", "Coin packages, MoMo payment creation/webhook, unlock rules.", "src/modules/monetization"],
    ["Admin module", "User management, moderation queues, audit logs, analytics.", "src/modules/admin"],
    ["Search module", "Meilisearch setup, query, indexing, DB fallback.", "src/modules/search"],
    ["Database", "Durable relational state and transaction boundary.", "src/db/schema"],
  ])}`,
  `<h2>6. Deployment View</h2><div class="figure">${deploymentSvg}<p class="caption">Figure 3. Phase 1 deployment topology using managed services.</p></div>`,
  `<h2>7. Key Request Flows</h2>
  <h3>7.1 VIP Chapter Unlock</h3><div class="figure">${unlockSvg}<p class="caption">Figure 4. Unlock flow uses entitlement check plus database transaction to prevent duplicate debits.</p></div>
  ${table(["Flow", "Architectural rule"], [
    ["Read free chapter", "SSR loads published public content. Auth is optional; progress save is authenticated and non-blocking."],
    ["Read VIP chapter", "Never trust client state. Server checks unlock/subscription before returning protected content."],
    ["Buy coins", "Create pending payment before calling MoMo. Webhook is source of payment truth."],
    ["Publish chapter", "Content module writes durable state, then triggers search index and notifications."],
    ["Moderate content", "Admin action updates visibility and writes an audit log."],
  ])}`,
  `<h2>8. Architecture Decisions</h2>
  ${table(["ADR", "Decision", "Rationale", "Risk/mitigation"], [
    ["ADR-01", "Use Next.js 16 full-stack app.", "One codebase/deployment, SSR for SEO, route handlers for APIs.", "Framework changes are version-specific; read local Next docs before code changes."],
    ["ADR-02", "Use PostgreSQL/Neon as system of record.", "Relational data, transactions, future pgvector support, managed ops.", "Serverless limits; move to paid tier/read replicas when measured."],
    ["ADR-03", "Use modular monolith.", "Avoid ops overhead while preserving clean module boundaries.", "Boundary drift; enforce ownership and service exports."],
    ["ADR-04", "Use Meilisearch for search.", "Typo-tolerant catalog search without self-hosting.", "Provider unavailable; DB fallback and cached lists."],
    ["ADR-05", "Use MoMo first for payments.", "Vietnam-first market fit and current implementation exists.", "Provider errors; signed webhook, pending/failed status, idempotency."],
    ["ADR-06", "Use coin balance plus ledger.", "Fast reads and auditable history.", "Dual-write risk; use transaction and idempotent webhook claim."],
  ])}`,
  `<h2>9. Quality Attribute Coverage</h2>
  ${table(["Quality", "Tactics"], [
    ["Performance", "SSR/streaming where appropriate, Redis for public hot data, CDN for assets, lightweight reader UI."],
    ["Scalability", "Managed autoscaling, module boundaries, read replicas later, background queues for fan-out notifications."],
    ["Security", "HttpOnly cookies, role checks, webhook signature verification, server-side entitlement checks, audit logs."],
    ["Reliability", "Fallback search, idempotent payments, durable ledger, graceful degradation for non-critical services."],
    ["Maintainability", "Domain modules, Drizzle schema ownership, explicit current/planned status in docs."],
  ])}`,
];

const addSections = [
  `<h2>1. Architecture Design Method</h2>
  <p>This ADD records the reasoning behind the selected architecture, the quality attributes that shaped it, and the trade-offs still open. It complements the SRS and SAD by explaining why the design is suitable for the current NovelHub implementation.</p>`,
  `<h2>2. Quality Attribute Scenarios</h2>
  ${table(["ID", "Source", "Stimulus", "Environment", "Response", "Measure"], [
    ["ASR-01", "Reader", "Opens a public chapter.", "Normal traffic, cached content available.", "Render readable chapter page with metadata.", "LCP under 1.5s target."],
    ["ASR-02", "Reader", "Searches with a typo.", "Meilisearch configured.", "Return relevant novels with filters.", "p95 under 300 ms target."],
    ["ASR-03", "MoMo", "Sends duplicate success webhook.", "Payment already processed.", "Do not credit coins twice.", "Exactly one ledger credit."],
    ["ASR-04", "Reader", "Unlock request is retried.", "Network retry or double click.", "Return entitlement without duplicate debit.", "At most one unlock debit per user/chapter."],
    ["ASR-05", "Curator", "Publishes chapter followed by many users.", "Low traffic Phase 1.", "Save content first, create notifications, allow later queue extraction.", "No publish data loss."],
    ["ASR-06", "Admin", "Hides a reported review.", "Authenticated admin session.", "Review is hidden and audit entry is written.", "Action is traceable by actor/time."],
    ["ASR-07", "Search provider", "Search is unavailable.", "Provider outage.", "Browse page falls back instead of crashing.", "User sees catalog or controlled empty state."],
    ["ASR-08", "Developer", "Adds VNPay or subscriptions.", "Existing monetization module.", "Change stays within module and schema contracts.", "No unrelated content/reader rewrites."],
  ])}`,
  `<h2>3. Utility Tree</h2>
  ${table(["Priority", "Quality", "Scenario", "Architectural response"], [
    ["High", "Payment consistency", "Duplicate or delayed webhook.", "Idempotent payment claim and ledger transaction."],
    ["High", "Access control", "VIP content request from unauthorized user.", "Server-side entitlement check before content is returned."],
    ["High", "Read performance", "Reader opens popular chapter.", "SSR plus cacheable public content and CDN assets."],
    ["Medium", "Search usability", "Typo-tolerant search needed.", "Meilisearch with DB fallback."],
    ["Medium", "Operational simplicity", "Solo developer deploys system.", "Single Next.js app on Vercel with managed providers."],
    ["Medium", "Auditability", "Admin/curator action changes content visibility.", "Audit logs on sensitive operations."],
    ["Low now, high later", "Notification fan-out", "Novel with many followers publishes.", "Synchronous now; queue extraction planned."],
  ])}`,
  `<h2>4. Design Tactics</h2>
  ${table(["Concern", "Tactic", "Where applied"], [
    ["Avoid stale private access", "Do not cache coin balance, unlocks, or subscriptions publicly.", "Chapter gate, unlock service, payment/balance APIs."],
    ["Handle retries", "Make payment and unlock mutations idempotent.", "MoMo webhook, unlock service."],
    ["Keep modules understandable", "Group business rules by domain module.", "src/modules/content, reader, community, monetization, admin, search."],
    ["Keep SEO strong", "SSR public pages and generate metadata/sitemap.", "Novel and chapter routes, app/sitemap.ts, app/robots.ts."],
    ["Keep cost low", "Use managed free tiers first.", "Vercel, Neon, Upstash, Meilisearch, Cloudinary, Cloudflare."],
  ])}`,
  `<h2>5. Selected Alternatives</h2>
  ${table(["Decision area", "Chosen option", "Rejected option", "Why rejected"], [
    ["Application architecture", "Modular monolith", "Microservices", "Unnecessary operations burden for one developer and current scale."],
    ["Backend split", "Next.js route handlers/server code", "Separate Express/Nest API", "Would add deployment and contract overhead without current need."],
    ["Search", "Meilisearch with DB fallback", "Only SQL LIKE", "Poor typo tolerance and relevance for catalog discovery."],
    ["Payments", "MoMo first", "Stripe first", "Vietnam-first product; Stripe is useful later for international users."],
    ["Content pipeline", "Curated internal CMS", "Open author submissions", "Product scope is quality-controlled catalog, not creator marketplace."],
  ])}`,
  `<h2>6. Architecture Risks</h2>
  ${table(["Risk", "Impact", "Mitigation"], [
    ["Next.js 16 behavior differs from older guidance.", "Wrong API use or deprecated patterns.", "Read node_modules/next/dist/docs before framework code changes."],
    ["Payment implementation goes live before production compliance.", "Financial/accounting risk.", "Keep sandbox explicit; add VNPay/subscriptions/VAT checks before production payments."],
    ["Module boundaries blur over time.", "Harder extraction and testing.", "Review imports and keep domain rules inside module services."],
    ["Search index drifts from database.", "Wrong browse/search results.", "Index on publish/update and provide reindex script."],
    ["Notification fan-out blocks publishing at scale.", "Slow curator workflow.", "Move to queue/background worker when follower counts justify it."],
  ])}`,
  `<h2>7. Roadmap Implications</h2>
  ${bullets([
    "Before accepting real payments: finish production payment hardening, compliance copy, refund/failure handling, and monitoring.",
    "Before larger launch: add observability, background jobs, and search index health checks.",
    "Before international expansion: add Stripe/card support, locale-aware copy, and currency/tax handling.",
    "Before extraction to services: measure bottlenecks and document module contracts.",
  ])}`,
];

const diagramSections = [
  `<h2>1. Diagram Set Overview</h2>
  <p>This document contains the visual architecture diagrams for NovelHub. The images are based on the sample document style, but all labels and system content are specific to the novel reading platform.</p>
  <div class="callout warn"><b>Terminology guard:</b> diagrams use NovelHub product language only. Source samples are visual references only.</div>`,
  `<h2>2. Use Case Diagram</h2><div class="figure">${useCaseSvg}<p class="caption">Guest, Reader, Curator, and Admin interactions with NovelHub.</p></div>`,
  `<h2>3. Layered Architecture Diagram</h2><div class="figure">${layeredSvg}<p class="caption">System layers from presentation through managed infrastructure.</p></div>`,
  `<h2>4. Module Dependency Diagram</h2><div class="figure">${modulesSvg}<p class="caption">Domain modules and provider dependencies.</p></div>`,
  `<h2>5. Deployment Diagram</h2><div class="figure">${deploymentSvg}<p class="caption">Managed Phase 1 deployment using Vercel, Cloudflare, Neon, Upstash, Meilisearch, Cloudinary, and MoMo.</p></div>`,
  `<h2>6. VIP Unlock Sequence</h2><div class="figure">${unlockSvg}<p class="caption">Server-side entitlement and ledger-backed unlock flow.</p></div>`,
  `<h2>7. Recommended Diagram Tooling</h2>
  ${table(["Need", "Recommended tool", "Reason"], [
    ["Architecture diagrams in docs", "SVG generated from HTML or Mermaid/PlantUML source", "Versionable, repeatable, easy to relabel for NovelHub."],
    ["Formal UML deliverables", "PlantUML source", "The sample PNG metadata indicates PlantUML-style generation; useful for use case/class/deployment diagrams."],
    ["Editable presentation visuals", "Google Slides native shapes", "Best when reviewers need to move boxes/arrows directly."],
    ["High-fidelity UI screenshots", "Playwright screenshots from running app", "Useful after code implementation, not for abstract architecture."],
  ])}`,
];

const diagramFigureSections = [
  `<h2>1. Diagram Set Overview</h2>
  <p>This document contains connector-inserted image figures for NovelHub architecture review. The image files are generated from versioned SVG sources in the project workspace.</p>
  <div class="callout warn"><b>Terminology guard:</b> diagrams use NovelHub product language only. Source samples are visual references only.</div>`,
  `<h2>2. Use Case Diagram</h2><p>FIGURE_USE_CASE</p><p class="caption">Guest, Reader, Curator, and Admin interactions with NovelHub.</p>`,
  `<h2>3. Layered Architecture Diagram</h2><p>FIGURE_LAYERED_ARCHITECTURE</p><p class="caption">System layers from presentation through managed infrastructure.</p>`,
  `<h2>4. Module Dependency Diagram</h2><p>FIGURE_MODULE_DEPENDENCY</p><p class="caption">Domain modules and provider dependencies.</p>`,
  `<h2>5. Deployment Diagram</h2><p>FIGURE_DEPLOYMENT</p><p class="caption">Managed Phase 1 deployment using Vercel, Cloudflare, Neon, Upstash, Meilisearch, Cloudinary, and MoMo.</p>`,
  `<h2>6. VIP Unlock Sequence</h2><p>FIGURE_VIP_UNLOCK_SEQUENCE</p><p class="caption">Server-side entitlement and ledger-backed unlock flow.</p>`,
  `<h2>7. Recommended Diagram Tooling</h2>
  ${table(["Need", "Recommended tool", "Reason"], [
    ["Architecture diagrams in docs", "SVG generated from HTML or Mermaid/PlantUML source", "Versionable, repeatable, easy to relabel for NovelHub."],
    ["Formal UML deliverables", "PlantUML source", "Sample images use a PlantUML-style generation path; useful for use case/class/deployment diagrams."],
    ["Editable presentation visuals", "Google Slides native shapes", "Best when reviewers need to move boxes/arrows directly."],
    ["High-fidelity UI screenshots", "Playwright screenshots from running app", "Useful after code implementation, not for abstract architecture."],
  ])}`,
];

writeFileSync(join(outDir, "NovelHub_SRS_v2.html"), doc("NovelHub Software Requirements Specification", "Detailed requirements and validation scope", srsSections));
writeFileSync(join(outDir, "NovelHub_SAD_v2.html"), doc("NovelHub Software Architecture Document", "Views, modules, deployment, request flows, and decisions", sadSections));
writeFileSync(join(outDir, "NovelHub_ADD_v2.html"), doc("NovelHub Architecture Design Document", "Quality attributes, trade-offs, risks, and rationale", addSections));
writeFileSync(join(outDir, "NovelHub_Diagram_Package_v2.html"), doc("NovelHub Architecture Diagram Package", "Use case, layered, module, deployment, and sequence diagrams", diagramSections));
writeFileSync(join(outDir, "NovelHub_Diagram_Package_v2_figures.html"), doc("NovelHub Architecture Diagram Package", "Connector-inserted image figures", diagramFigureSections));

writeFileSync(join(outDir, "layered-architecture.svg"), layeredSvg);
writeFileSync(join(outDir, "module-dependency.svg"), modulesSvg);
writeFileSync(join(outDir, "deployment.svg"), deploymentSvg);
writeFileSync(join(outDir, "vip-unlock-sequence.svg"), unlockSvg);
writeFileSync(join(outDir, "use-case.svg"), useCaseSvg);

console.log(outDir);
