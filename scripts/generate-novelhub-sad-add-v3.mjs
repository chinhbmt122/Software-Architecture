import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

const outDir = join(process.cwd(), "docs", "sad-add-v3");
const plantumlDir = join(outDir, "plantuml");
mkdirSync(plantumlDir, { recursive: true });

const today = "2026-05-17";

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function plantumlEncode(source) {
  const data = deflateRawSync(Buffer.from(source, "utf8"));
  let encoded = "";
  for (let i = 0; i < data.length; i += 3) {
    encoded += append3bytes(data[i], data[i + 1] ?? 0, data[i + 2] ?? 0);
  }
  return encoded;
}

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return "-";
  if (b === 1) return "_";
  return "?";
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return (
    encode6bit(c1 & 0x3f) +
    encode6bit(c2 & 0x3f) +
    encode6bit(c3 & 0x3f) +
    encode6bit(c4 & 0x3f)
  );
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function toc(items) {
  return `<h1>Table of Contents</h1><ol class="toc">${items
    .map((item) => `<li><a href="#${item.id}">${esc(item.title)}</a></li>`)
    .join("")}</ol>`;
}

function section(item, body) {
  return `<h1 id="${item.id}">${esc(item.title)}</h1>${body}`;
}

function figure(token, caption) {
  return `<p class="figure-token">${token}</p><p class="caption">${esc(caption)}</p>`;
}

function doc(title, subtitle, sections) {
  const css = `
    @page { margin: 0.7in; }
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
    .cover { min-height: 560px; border-left: 12px solid #2563eb; padding: 32px 36px; background: #f8fafc; display: flex; flex-direction: column; justify-content: center; }
    .version { color: #475569; font-size: 12pt; margin-bottom: 48px; }
    .doc-title { color: #1e3a8a; font-size: 28pt; font-weight: 700; letter-spacing: 0; }
    .subtitle { color: #374151; font-size: 14pt; margin-top: 14px; }
    .meta { color: #475569; font-size: 10pt; margin-top: 70px; }
    h1 { color: #1e3a8a; font-size: 20pt; margin: 26px 0 10px; border-bottom: 2px solid #bfdbfe; padding-bottom: 5px; }
    h2 { color: #1f2937; font-size: 14pt; margin: 18px 0 7px; }
    h3 { color: #374151; font-size: 12pt; margin: 14px 0 6px; }
    p { margin: 7px 0; }
    ul, ol { margin-top: 5px; }
    .toc li { margin: 5px 0; }
    .toc a { color: #1d4ed8; text-decoration: none; }
    .callout { border: 1px solid #bfdbfe; border-left: 6px solid #2563eb; background: #eff6ff; padding: 10px 12px; margin: 12px 0; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0 16px; }
    .card { border: 1px solid #cbd5e1; background: #ffffff; padding: 10px 12px; }
    .card b { color: #1e3a8a; }
    table { border-collapse: collapse; width: 100%; margin: 9px 0 16px; font-size: 9.2pt; }
    th, td { border: 1px solid #94a3b8; padding: 6px 7px; vertical-align: top; }
    th { background: #dbeafe; color: #111827; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    code { font-family: Consolas, monospace; background: #f1f5f9; padding: 1px 4px; }
    .figure-token { color: #ffffff; font-size: 1pt; margin: 12px 0 0; }
    .caption { text-align: center; color: #475569; font-size: 9pt; margin: 4px 0 16px; }
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
    <div class="cover">
      <p class="version">Version 3.0</p>
      <div class="doc-title">${esc(title)}</div>
      <div class="subtitle">${esc(subtitle)}</div>
      <p class="meta">Project: NovelHub web novel reading platform | Date: ${today} | Status: Working architecture deliverable</p>
    </div>
    ${toc(sections)}
    ${sections.map((s) => section(s, s.body)).join("\n")}
  </body></html>`;
}

const diagrams = {
  context: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
skinparam componentStyle rectangle
skinparam rectangle {
  BackgroundColor #EFF6FF
  BorderColor #2563EB
  FontName Arial
}
skinparam actor {
  BackgroundColor #F8FAFC
  BorderColor #334155
  FontName Arial
  FontColor #111827
}
title NovelHub System Context
left to right direction
component "NovelHub\\nNext.js 16 Modular Monolith" as App
component "Guest" as Guest
component "Reader" as Reader
component "Curator" as Curator
component "Admin" as Admin
database "Neon PostgreSQL\\nSystem of record" as DB
cloud "Upstash Redis\\nCache" as Redis
cloud "Meilisearch\\nCatalog search" as Search
cloud "Cloudinary\\nCover images" as Media
cloud "MoMo\\nPayment gateway" as Momo
Guest --> App : browse/read free
Reader --> App : read, comment,\\nunlock VIP chapters
Curator --> App : manage novels\\nand chapters
Admin --> App : moderate and operate
App --> DB
App --> Redis
App --> Search
App --> Media
App --> Momo : create payment
Momo --> App : signed webhook
@enduml`,
  container: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
skinparam componentStyle rectangle
title NovelHub Container View
package "Next.js 16 Application" {
  [App Router Pages] as Pages
  [Route Handlers] as Routes
  [Server Actions / Services] as Services
  [Domain Modules] as Modules
  [Shared Infrastructure Clients] as Infra
}
database "PostgreSQL" as DB
queue "Redis Cache" as Redis
component "Meilisearch" as Search
component "Cloudinary" as Media
component "MoMo API" as Momo
Pages --> Routes
Pages --> Services
Routes --> Services
Services --> Modules
Modules --> Infra
Infra --> DB
Infra --> Redis
Infra --> Search
Infra --> Media
Infra --> Momo
@enduml`,
  modules: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
skinparam componentStyle rectangle
title NovelHub Module Dependency View
component "App Routes" as Routes
component "Content Module" as Content
component "Reader Module" as ReaderModule
component "Community Module" as Community
component "Monetization Module" as Monetization
component "Admin Module" as AdminModule
component "Search Module" as SearchModule
database "Database" as Database
component "Meilisearch" as Meili
Routes --> Content
Routes --> ReaderModule
Routes --> Community
Routes --> Monetization
Routes --> AdminModule
Routes --> SearchModule
Content --> SearchModule : index novel
Content --> ReaderModule : notify followers
ReaderModule --> Content : read refs
Community --> Content : validate target
Monetization --> Content : validate VIP chapter
AdminModule --> Community : hide/unhide
AdminModule --> Content : moderate
Monetization --> Database
Content --> Database
ReaderModule --> Database
Community --> Database
AdminModule --> Database
SearchModule --> Meili
@enduml`,
  deployment: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
title NovelHub Phase 1 Deployment
node "User Browser" as Browser
cloud "Cloudflare\\nDNS, CDN, WAF" as Cloudflare
cloud "Vercel\\nNext.js runtime" as Vercel
database "Neon PostgreSQL" as Neon
cloud "Upstash Redis" as Redis
cloud "Meilisearch Cloud" as Search
cloud "Cloudinary" as Cloudinary
cloud "MoMo Gateway" as Momo
Browser --> Cloudflare : HTTPS
Cloudflare --> Vercel : SSR/API
Vercel --> Neon : Drizzle SQL
Vercel --> Redis : cache
Vercel --> Search : search/index
Vercel --> Cloudinary : media URLs
Vercel --> Momo : create payment
Momo --> Vercel : signed webhook
@enduml`,
  vipSequence: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
title VIP Chapter Unlock Sequence
actor Reader
participant "Chapter Lock Gate" as UI
participant "Unlock Route Handler" as API
participant "Unlock Service" as Service
database "PostgreSQL" as DB
Reader -> UI : Click Unlock
UI -> API : POST unlock request
API -> Service : userId, novelId, chapterId
Service -> DB : Read chapter, existing unlock,\\nsubscription, coin balance
alt Already entitled
  Service --> API : Return success without debit
else Not enough coins
  Service --> API : Return insufficient balance
else Can unlock
  Service -> DB : BEGIN
  Service -> DB : Insert chapter_unlocks
  Service -> DB : Insert coin_transactions debit
  Service -> DB : Update users.coin_balance
  Service -> DB : COMMIT
  Service --> API : New balance and entitlement
end
API --> UI : Result
UI --> Reader : Show chapter or action message
@enduml`,
  paymentSequence: `@startuml
skinparam dpi 180
skinparam shadowing false
skinparam defaultFontName Arial
skinparam defaultFontColor #111827
title MoMo Coin Purchase Sequence
actor Reader
participant "Pricing Page" as UI
participant "MoMo Create API" as Create
participant "MoMo Service" as Service
database "PostgreSQL" as DB
participant "MoMo Gateway" as Momo
participant "Webhook Route" as Hook
Reader -> UI : Choose coin package
UI -> Create : POST create payment
Create -> Service : Validate package and session
Service -> DB : Insert payment PENDING
Service -> Momo : Create payment request
Momo --> Service : Pay URL / QR
Service --> UI : Redirect details
Reader -> Momo : Complete payment
Momo -> Hook : Signed IPN webhook
Hook -> Service : Verify signature
Service -> DB : Claim pending payment
Service -> DB : Insert coin ledger and update balance
Hook --> Momo : 200 OK
@enduml`,
};

for (const [name, source] of Object.entries(diagrams)) {
  writeFileSync(join(plantumlDir, `${name}.puml`), source);
}

const urls = Object.fromEntries(
  Object.entries(diagrams).map(([name, source]) => [
    name,
    `https://www.plantuml.com/plantuml/png/${plantumlEncode(source)}`,
  ]),
);
writeFileSync(join(plantumlDir, "plantuml-urls.json"), `${JSON.stringify(urls, null, 2)}\n`);

const currentStatus = table(
  ["Area", "Implemented in codebase", "Planned or partial"],
  [
    ["Foundation", "Next.js 16.2.4 App Router, React 19, TypeScript, Tailwind v4, shadcn/Radix UI.", "Production observability and release gates."],
    ["Authentication", "Better Auth email/password, Google OAuth, session adapter over Drizzle/PostgreSQL.", "Facebook/Zalo OAuth and account deletion workflow."],
    ["Content", "Novel, chapter, genre, tag schema and curator CMS routes.", "Advanced scheduling workflow and editorial review queues."],
    ["Reader", "Chapter reader, reader settings, progress endpoint, follows, notifications.", "Offline reading and cross-device sync polish."],
    ["Community", "Comments, replies, votes, reviews, helpful votes, moderation flags.", "More public social profile features."],
    ["Monetization", "Coin packages, MoMo create/webhook/test routes, balance API, VIP unlock service.", "VNPay, subscriptions lifecycle, invoice/VAT handling."],
    ["Admin", "Users, moderation, reports, audit pages and services.", "Operational alerting and deeper analytics."],
    ["Search", "Meilisearch service and indexing script with database fallback behavior.", "Relevance tuning and automated index health monitoring."],
  ],
);

const sadSections = [
  {
    id: "purpose",
    title: "1. Purpose and Scope",
    body: `<p>This Software Architecture Document describes the architecture of NovelHub, a web novel reading platform for curated translated novels. It uses the existing <code>docs/SAD.md</code> as the baseline and updates it against the current source tree, database schema, and implemented route structure.</p>
    <div class="callout"><b>Architecture position:</b> NovelHub is a Next.js modular monolith. It should remain one deployable unit until measured load or team structure justifies service extraction.</div>`,
  },
  {
    id: "drivers",
    title: "2. Architecture Drivers",
    body: table(["Driver", "Architectural effect"], [
      ["SEO-ready reading experience", "Novel and chapter pages are server-rendered with metadata, sitemap, robots policy, and stable URLs."],
      ["Read-heavy workload", "Published public content can use CDN/Redis caching; private entitlement data remains database-authoritative."],
      ["Payment correctness", "MoMo callbacks, coin balance changes, and VIP unlocks must be idempotent and transaction-backed."],
      ["Solo-operable delivery", "Prefer managed services and one deployment over operationally expensive microservices."],
      ["Future extraction path", "Domain modules isolate content, reader, community, monetization, search, and admin responsibilities."],
    ]),
  },
  {
    id: "context",
    title: "3. System Context View",
    body: `${figure("FIGURE_SAD_CONTEXT", "Figure 1. NovelHub system context and external providers.")}${table(["Actor or service", "Interaction"], [
      ["Guest", "Browses published novels and reads free chapters."],
      ["Reader", "Reads, follows novels, comments, reviews, buys coins, and unlocks VIP chapters."],
      ["Curator", "Manages novels, chapters, covers, publish status, and VIP settings."],
      ["Admin", "Moderates reports/content, manages users, and reviews audit logs."],
      ["MoMo", "Creates payment sessions and sends signed webhooks."],
      ["Meilisearch, Redis, Cloudinary, Neon", "Provide managed search, cache, media, and relational persistence."],
    ])}`,
  },
  {
    id: "container",
    title: "4. Container and Runtime View",
    body: `${figure("FIGURE_SAD_CONTAINER", "Figure 2. Main runtime containers inside and outside the Next.js application.")}<p>The application is deployed as a single Next.js runtime. Pages and route handlers call module services; module services apply business rules and use shared infrastructure clients for persistence and external providers.</p>`,
  },
  {
    id: "modules",
    title: "5. Module View",
    body: `${figure("FIGURE_SAD_MODULES", "Figure 3. Domain module dependencies and ownership boundaries.")}${table(["Module", "Responsibility", "Representative paths"], [
      ["Content", "Novels, chapters, genres, tags, cover metadata, publish state, counters.", "<code>src/modules/content</code>, <code>src/db/schema/content.ts</code>"],
      ["Reader", "Progress, follows, bookmarks/library entries, reader notifications.", "<code>src/modules/reader</code>, <code>src/db/schema/reader.ts</code>"],
      ["Community", "Comments, replies, votes, reviews, helpful votes, reports.", "<code>src/modules/community</code>, <code>src/db/schema/community.ts</code>"],
      ["Monetization", "Coin packages, payments, ledger, subscriptions, chapter unlocks, MoMo.", "<code>src/modules/monetization</code>, <code>src/db/schema/monetization.ts</code>"],
      ["Search", "Meilisearch query/index integration and fallback behavior.", "<code>src/modules/search</code>, <code>scripts/index-meilisearch.ts</code>"],
      ["Admin", "User management, moderation, report resolution, audit visibility.", "<code>src/modules/admin</code>, <code>src/db/schema/operations.ts</code>"],
    ])}`,
  },
  {
    id: "data",
    title: "6. Data and Persistence View",
    body: `<p>PostgreSQL is the system of record. Drizzle schema files are split by domain so table ownership is clear. Public read models such as novel metadata and chapter content may be cached, but private financial and entitlement state must always be resolved from durable data.</p>${table(["Data group", "Owned tables", "Notes"], [
      ["Auth", "<code>users</code>, <code>sessions</code>, <code>accounts</code>, <code>verifications</code>", "Better Auth owns sessions and identity mapping; additional user fields include role, status, coin balance, and bio."],
      ["Content", "<code>novels</code>, <code>chapters</code>, <code>genres</code>, <code>tags</code>", "Novel/chapter records support publish state, SEO slugs, VIP flag, costs, counters, and taxonomy."],
      ["Reader", "<code>reading_progress</code>, <code>bookmarks</code>, <code>library_entries</code>, <code>novel_follows</code>", "Reader-specific state is scoped to the authenticated user."],
      ["Community", "<code>comments</code>, <code>comment_votes</code>, <code>reviews</code>, <code>review_votes</code>, <code>reports</code>", "Moderation uses hidden flags and report resolution state."],
      ["Monetization", "<code>coin_packages</code>, <code>payments</code>, <code>coin_transactions</code>, <code>chapter_unlocks</code>, <code>subscriptions</code>", "Ledger plus denormalized balance supports fast reads and auditability."],
      ["Operations", "<code>audit_logs</code>, <code>notifications</code>", "Audit logs are sensitive-operation records; notifications support reader-facing updates."],
    ])}`,
  },
  {
    id: "flows",
    title: "7. Key Runtime Flows",
    body: `${figure("FIGURE_SAD_VIP_SEQUENCE", "Figure 4. VIP chapter unlock sequence.")}${figure("FIGURE_SAD_PAYMENT_SEQUENCE", "Figure 5. MoMo coin purchase and webhook sequence.")}${table(["Flow", "Architectural rule"], [
      ["Read free chapter", "SSR can return published free content to guests; progress writes are authenticated and non-blocking."],
      ["Read VIP chapter", "Server checks subscription/unlock before protected content is returned."],
      ["Buy coins", "A pending payment is created before redirect; webhook is the source of truth."],
      ["Unlock VIP chapter", "Unlock, ledger debit, and balance update happen in a single database transaction."],
      ["Publish chapter", "Content write succeeds first; search indexing and notifications follow as secondary effects."],
      ["Moderate content", "Visibility change and audit log should be part of the admin operation."],
    ])}`,
  },
  {
    id: "deployment",
    title: "8. Deployment View",
    body: `${figure("FIGURE_SAD_DEPLOYMENT", "Figure 6. Phase 1 deployment topology using managed providers.")}${table(["Layer", "Provider", "Reason"], [
      ["Edge and DNS", "Cloudflare", "DNS, CDN, WAF, and DDoS protection."],
      ["Application hosting", "Vercel", "Managed Next.js deployment with serverless route handlers."],
      ["Database", "Neon PostgreSQL", "Managed relational database for all durable state."],
      ["Cache", "Upstash Redis", "Managed Redis for hot public data and future rate limiting."],
      ["Search", "Meilisearch Cloud", "Typo-tolerant catalog search without self-hosting."],
      ["Media", "Cloudinary", "Cover image storage and delivery."],
      ["Payments", "MoMo", "Vietnam-first e-wallet payment flow."],
    ])}`,
  },
  {
    id: "decisions",
    title: "9. Architecture Decisions",
    body: table(["ADR", "Decision", "Rationale", "Trade-off"], [
      ["ADR-01", "Use Next.js 16 as full-stack framework.", "One codebase and SSR support for SEO.", "Must follow local version-specific Next.js docs before framework changes."],
      ["ADR-02", "Use PostgreSQL/Neon as sole system of record.", "Relational model, transactions, Drizzle integration.", "Serverless limits may require paid tier/read replicas later."],
      ["ADR-03", "Use modular monolith rather than microservices.", "Lower operations cost and easier solo maintenance.", "Requires discipline around module boundaries."],
      ["ADR-04", "Use Meilisearch for catalog search.", "Typo tolerance and relevance are important for novel discovery.", "Provider outage requires DB fallback."],
      ["ADR-05", "Use MoMo as primary Phase 1 payment provider.", "Vietnam-first product fit and current implementation exists.", "VNPay/subscriptions/tax logic remain future work."],
      ["ADR-06", "Use denormalized coin balance plus ledger.", "Fast balance reads and full audit trail.", "Must update balance and ledger transactionally."],
    ]),
  },
  {
    id: "security",
    title: "10. Security and Reliability",
    body: table(["Concern", "Architecture response"], [
      ["Sessions", "Better Auth stores sessions in PostgreSQL and uses secure server-issued cookies."],
      ["Roles", "Curator/admin permissions are enforced in route handlers and module services."],
      ["Payment webhooks", "Verify MoMo signatures and claim pending payments idempotently."],
      ["VIP content", "Never return protected chapter content until server-side entitlement passes."],
      ["Coin ledger", "Credit/debit operations are transaction-backed and auditable."],
      ["Moderation", "Admin/curator sensitive actions should write audit logs."],
      ["Provider failure", "Search and non-critical side effects degrade without breaking public reading."],
    ]),
  },
  {
    id: "implementation",
    title: "11. Current Implementation Fit",
    body: currentStatus,
  },
];

const addSections = [
  {
    id: "purpose",
    title: "1. Purpose",
    body: `<p>This Architecture Design Document explains why the NovelHub architecture is shaped the way it is. It complements the SAD by focusing on quality attributes, alternatives, risks, and trade-offs.</p>`,
  },
  {
    id: "quality-scenarios",
    title: "2. Quality Attribute Scenarios",
    body: table(["ID", "Quality", "Stimulus", "Response", "Measure"], [
      ["ASR-01", "Performance", "Reader opens a public chapter.", "Render readable SSR page and initialize reader controls.", "LCP target under 1.5 seconds for cacheable content."],
      ["ASR-02", "Search usability", "Reader searches with typo or partial title.", "Return relevant catalog results through Meilisearch.", "p95 target under 300 ms when provider is healthy."],
      ["ASR-03", "Payment consistency", "MoMo sends duplicate success webhook.", "Do not double-credit coins.", "Exactly one successful ledger credit per payment."],
      ["ASR-04", "Access control", "Reader retries VIP unlock or opens locked chapter directly.", "Check entitlement server-side before returning content.", "At most one unlock debit per user/chapter."],
      ["ASR-05", "Availability", "Search provider is unavailable.", "Browse page degrades to database fallback or controlled state.", "No reader-facing crash."],
      ["ASR-06", "Auditability", "Admin hides reported review.", "Review state changes and audit record is stored.", "Actor, target, action, timestamp are traceable."],
      ["ASR-07", "Maintainability", "VNPay or subscription renewal is added.", "Change stays mostly inside monetization module.", "No unrelated reader/content rewrites."],
    ]),
  },
  {
    id: "utility-tree",
    title: "3. Utility Tree",
    body: table(["Priority", "Quality", "Scenario", "Design tactic"], [
      ["High", "Payment correctness", "Duplicate, failed, or delayed payment callbacks.", "Signed webhooks, pending payment claim, ledger transaction."],
      ["High", "Protected content security", "Unauthorized request for VIP chapter content.", "Server-side subscription/unlock check."],
      ["High", "Reading performance", "Popular chapter receives repeated public reads.", "SSR plus cacheable public data and CDN assets."],
      ["Medium", "Search relevance", "Reader searches by genre/tag/title with typo.", "Meilisearch index and fallback."],
      ["Medium", "Operational simplicity", "Solo developer deploys and maintains system.", "Single app, managed providers, no premature services."],
      ["Medium", "Auditability", "Curator/admin changes sensitive state.", "Audit logs for sensitive operations."],
      ["Low now, high later", "Notification fan-out", "A popular novel publishes a new chapter.", "Synchronous now; queue extraction later."],
    ]),
  },
  {
    id: "alternatives",
    title: "4. Alternatives Considered",
    body: table(["Decision area", "Chosen", "Alternative", "Reason alternative was rejected"], [
      ["Architecture style", "Modular monolith", "Microservices", "Too much deployment and observability overhead for one developer and current traffic."],
      ["Backend shape", "Next.js route handlers and services", "Separate Express/Nest service", "Adds another deployable and API boundary without current benefit."],
      ["Primary database", "PostgreSQL", "MongoDB plus SQL", "Current data is relational and payments require transactions."],
      ["Search", "Meilisearch", "Only SQL LIKE", "SQL fallback is acceptable, but not enough for typo-tolerant discovery."],
      ["Payments", "MoMo first", "Stripe first", "Initial market is Vietnam; Stripe is useful later for international users."],
      ["Content model", "Curated internal CMS", "Open author submissions", "Current product is curated platform, not creator marketplace."],
    ]),
  },
  {
    id: "tradeoffs",
    title: "5. Trade-Off Analysis",
    body: table(["Trade-off", "Benefit", "Cost", "Control"], [
      ["Single deployable app", "Simple deployment and local reasoning.", "Frontend/backend cannot scale independently.", "Extract only after measured bottleneck."],
      ["PostgreSQL as content store", "Transactions and simpler data model.", "Large text content increases DB read pressure.", "Cache public chapter content and consider storage split later."],
      ["Denormalized coin balance", "Fast balance display and unlock checks.", "Requires transactional consistency with ledger.", "Ledger write and balance update in one transaction."],
      ["Managed providers", "Less operations burden.", "Provider limits and outages.", "Fallbacks, paid tier path, and provider-specific health checks."],
      ["Synchronous Phase 1 notifications", "Simpler implementation.", "Publish flow may slow with many followers.", "Introduce queue when follower volume grows."],
    ]),
  },
  {
    id: "risks",
    title: "6. Architecture Risks",
    body: table(["Risk", "Impact", "Mitigation"], [
      ["Next.js 16 APIs differ from older Next.js assumptions.", "Incorrect implementation or deprecated API use.", "Read <code>node_modules/next/dist/docs/</code> before framework changes."],
      ["Payment flow is used before production hardening.", "Financial/accounting risk.", "Keep sandbox explicit; add production checklist before launch."],
      ["Module boundaries drift.", "Harder testability and later extraction.", "Review imports and keep business rules in module services."],
      ["Search index drifts from database.", "Incorrect discovery results.", "Index on publish/update and provide reindex script."],
      ["Notification fan-out grows.", "Slow curator publish operation.", "Move notification dispatch to queue/background job."],
      ["Private entitlement data is accidentally cached.", "VIP content exposure risk.", "Keep private checks database-authoritative and review cache headers."],
    ]),
  },
  {
    id: "roadmap",
    title: "7. Roadmap Implications",
    body: `${list([
      "Before real payments: complete production MoMo configuration, failure/refund handling, monitoring, and compliance copy.",
      "Before larger launch: add observability, background jobs, search index health checks, and cache invalidation review.",
      "Before international expansion: add Stripe/card support, currency handling, localized copy, and tax behavior.",
      "Before service extraction: measure bottlenecks and document stable module contracts.",
    ])}${figure("FIGURE_ADD_DEPLOYMENT", "Figure 1. Deployment and provider boundary considered by ADD risks.")}`,
  },
];

writeFileSync(join(outDir, "NovelHub_SAD_v3.html"), doc("NovelHub Software Architecture Document", "Architecture views, modules, deployment, flows, and decisions", sadSections));
writeFileSync(join(outDir, "NovelHub_ADD_v1.html"), doc("NovelHub Architecture Design Document", "Quality attributes, alternatives, trade-offs, and risks", addSections));

console.log(outDir);
