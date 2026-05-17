import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const outDir = join(process.cwd(), "docs", "srs-v3");
const svgDir = join(outDir, "svg");
const pngDir = join(outDir, "png");
mkdirSync(svgDir, { recursive: true });
mkdirSync(pngDir, { recursive: true });

const today = "2026-05-17";

const useCases = [
  {
    id: "UC-01",
    fr: "FR-1.1",
    name: "Register",
    actor: "Guest",
    trigger: "The guest selects the Sign Up action.",
    pre: "The guest is not currently authenticated.",
    post: "A reader account exists and the user can proceed to sign in.",
    description: "This use case allows a new reader to create a NovelHub account with email credentials or a supported OAuth provider.",
    steps: ["Click Sign Up", "Load registration page", "Enter email and password", "Validate input", "Create account", "Show success or error"],
    rules: [
      ["(3,4)", "BR-01", "Email must be valid and unique. Password validation is handled by the authentication layer."],
      ["(5)", "BR-02", "The system must never return password hashes or raw credentials to the client."],
    ],
  },
  {
    id: "UC-02",
    fr: "FR-1.2",
    name: "Login",
    actor: "Reader",
    trigger: "The user opens the sign-in page or is redirected from a protected page.",
    pre: "The account exists and is not banned.",
    post: "A secure session cookie is issued and protected routes become available.",
    description: "This use case authenticates an existing reader, curator, or admin using Better Auth.",
    steps: ["Open login page", "Submit credentials", "Validate credentials", "Create session", "Redirect by role", "Show error when invalid"],
    rules: [
      ["(2,3)", "BR-03", "Invalid credentials must return a generic error message."],
      ["(4)", "BR-04", "Session cookies must be HttpOnly, Secure in production, and SameSite compatible."],
    ],
  },
  {
    id: "UC-03",
    fr: "FR-2.1",
    name: "Browse Novel Library",
    actor: "Guest / Reader",
    trigger: "The user opens the homepage or novel library page.",
    pre: "At least one published novel may exist.",
    post: "The user sees available novels and can open a novel detail page.",
    description: "This use case lets users discover featured, trending, and newly updated novels.",
    steps: ["Open library", "Load published novels", "Apply status or genre filters", "Render novel cards", "Open selected novel"],
    rules: [
      ["(2)", "BR-05", "Only published, reader-visible novels and chapters may appear in public browsing."],
      ["(3)", "BR-06", "Filters must be represented in the URL so the result page is shareable."],
    ],
  },
  {
    id: "UC-04",
    fr: "FR-2.2",
    name: "Search and Filter Novels",
    actor: "Guest / Reader",
    trigger: "The user enters a query or changes filters.",
    pre: "The browse page is accessible.",
    post: "Matching novels are displayed, or a controlled empty state is shown.",
    description: "This use case supports typo-tolerant catalog discovery through Meilisearch when configured, with database fallback.",
    steps: ["Enter query", "Send search request", "Use Meilisearch when available", "Fallback to database when needed", "Return ranked results"],
    rules: [
      ["(3)", "BR-07", "Search index documents contain title, synopsis, genres, tags, status, language, rating, and chapter count."],
      ["(4)", "BR-08", "Search provider failure must not crash the browse page."],
    ],
  },
  {
    id: "UC-05",
    fr: "FR-3.1",
    name: "View Novel Detail",
    actor: "Guest / Reader",
    trigger: "The user selects a novel card or direct novel URL.",
    pre: "The novel slug exists and the novel is visible.",
    post: "Novel metadata, chapter list, reviews, and actions are displayed.",
    description: "This use case presents the main product page for a novel.",
    steps: ["Open novel slug", "Load metadata", "Load chapters and reviews", "Check follow state", "Render actions"],
    rules: [
      ["(2,3)", "BR-09", "Novel detail pages must be server-rendered and include SEO metadata."],
      ["(4)", "BR-10", "Follow state is shown only for authenticated users; guests see a sign-in path."],
    ],
  },
  {
    id: "UC-06",
    fr: "FR-3.2",
    name: "Read Free Chapter",
    actor: "Guest / Reader",
    trigger: "The user opens a published free chapter.",
    pre: "The chapter exists, is published, and is not VIP-protected.",
    post: "The chapter content is displayed in the reader.",
    description: "This use case provides the core reading experience for non-locked chapters.",
    steps: ["Open chapter URL", "Load chapter and novel", "Check publish status", "Render reader", "Save progress if authenticated"],
    rules: [
      ["(3)", "BR-11", "Draft or scheduled chapters must not be readable from public routes."],
      ["(5)", "BR-12", "Progress save must not block initial chapter rendering."],
    ],
  },
  {
    id: "UC-07",
    fr: "FR-3.3",
    name: "Customize Reader Settings",
    actor: "Reader",
    trigger: "The user opens reader settings.",
    pre: "A chapter reader page is loaded.",
    post: "Reader theme, font size, line height, and width are applied.",
    description: "This use case lets readers personalize the reading experience.",
    steps: ["Open settings", "Change theme", "Change typography", "Persist settings locally", "Apply to reader"],
    rules: [
      ["(2,3)", "BR-13", "Reader settings must not alter stored chapter content."],
      ["(4)", "BR-14", "Settings should remain available on future reader visits."],
    ],
  },
  {
    id: "UC-08",
    fr: "FR-3.4",
    name: "Follow Novel",
    actor: "Reader",
    trigger: "The reader clicks Follow on a novel detail page.",
    pre: "The reader is authenticated.",
    post: "The follow state is toggled and future publish notifications can be created.",
    description: "This use case lets readers subscribe to novel updates.",
    steps: ["Click Follow", "Verify session", "Toggle follow record", "Return new state", "Update button"],
    rules: [
      ["(3)", "BR-15", "A reader can follow a novel at most once."],
      ["(4)", "BR-16", "Unfollow removes notification eligibility for future chapters only."],
    ],
  },
  {
    id: "UC-09",
    fr: "FR-4.1",
    name: "Buy Coins with MoMo",
    actor: "Reader",
    trigger: "The reader selects a coin package on the pricing page.",
    pre: "The reader is authenticated and a coin package is active.",
    post: "A pending payment is created and the user is sent to MoMo payment.",
    description: "This use case starts a coin purchase using the MoMo gateway.",
    steps: ["Select package", "Create pending payment", "Call MoMo create API", "Return pay URL", "Redirect reader"],
    rules: [
      ["(2)", "BR-17", "Payment rows are created before redirecting to the provider."],
      ["(3)", "BR-18", "The client must not be trusted to mark payment success."],
    ],
  },
  {
    id: "UC-10",
    fr: "FR-4.2",
    name: "Process MoMo Webhook",
    actor: "MoMo",
    trigger: "MoMo sends an IPN callback after payment completion.",
    pre: "A matching pending payment exists.",
    post: "Coins are credited exactly once for successful payments.",
    description: "This use case handles the external payment confirmation callback.",
    steps: ["Receive webhook", "Verify signature", "Find payment", "Claim pending payment", "Credit coin ledger", "Return response"],
    rules: [
      ["(2)", "BR-19", "Invalid signatures must be rejected without mutating payment or balance state."],
      ["(4,5)", "BR-20", "Duplicate success callbacks must not credit coins more than once."],
    ],
  },
  {
    id: "UC-11",
    fr: "FR-4.3",
    name: "Unlock VIP Chapter",
    actor: "Reader",
    trigger: "The reader clicks Unlock on a locked chapter.",
    pre: "The reader is authenticated and the chapter is VIP-protected.",
    post: "The reader has permanent access to the chapter, or receives a controlled error.",
    description: "This use case grants access to a VIP chapter by spending coins.",
    steps: ["Click Unlock", "Check entitlement", "Check balance", "Start DB transaction", "Insert unlock and debit ledger", "Show chapter"],
    rules: [
      ["(2)", "BR-21", "Already unlocked chapters return success without another coin debit."],
      ["(4,5)", "BR-22", "Coin debit, ledger write, and unlock write must succeed or fail together."],
    ],
  },
  {
    id: "UC-12",
    fr: "FR-5.1",
    name: "Comment on Chapter",
    actor: "Reader",
    trigger: "The reader posts a comment or reply on a chapter page.",
    pre: "The reader is authenticated and the chapter exists.",
    post: "The comment appears in the chapter discussion unless moderation hides it later.",
    description: "This use case supports chapter-level discussion threads.",
    steps: ["Enter comment", "Validate session", "Validate content", "Save comment or reply", "Refresh discussion"],
    rules: [
      ["(3)", "BR-23", "Empty comments are rejected."],
      ["(4)", "BR-24", "Replies must reference an existing parent comment in the same chapter."],
    ],
  },
  {
    id: "UC-13",
    fr: "FR-5.2",
    name: "Review Novel",
    actor: "Reader",
    trigger: "The reader submits a star rating and optional review body.",
    pre: "The reader is authenticated and the novel exists.",
    post: "The review is stored and average novel rating is recalculated.",
    description: "This use case captures novel-level reader feedback.",
    steps: ["Open review form", "Submit rating", "Validate 1-5 stars", "Upsert review", "Recalculate average rating"],
    rules: [
      ["(3)", "BR-25", "Rating must be an integer from 1 to 5."],
      ["(4)", "BR-26", "One reader has at most one active review per novel."],
    ],
  },
  {
    id: "UC-14",
    fr: "FR-6.1",
    name: "Curator Create or Edit Novel",
    actor: "Curator",
    trigger: "The curator opens the CMS novel form.",
    pre: "The user has curator or admin role.",
    post: "Novel metadata is saved and visible according to its status.",
    description: "This use case supports internal catalog management.",
    steps: ["Open CMS", "Verify role", "Enter novel metadata", "Upload/select cover", "Save novel", "Update search index"],
    rules: [
      ["(2)", "BR-27", "Non-curators must not access curator write screens."],
      ["(5,6)", "BR-28", "Slug, genres, tags, and search index data must stay consistent after save."],
    ],
  },
  {
    id: "UC-15",
    fr: "FR-6.2",
    name: "Curator Publish Chapter",
    actor: "Curator",
    trigger: "The curator saves or publishes a chapter.",
    pre: "The target novel exists and the user has curator/admin role.",
    post: "The chapter is saved, and if published, followers can be notified.",
    description: "This use case handles chapter drafting, VIP configuration, scheduling, and publishing.",
    steps: ["Open chapter editor", "Verify role", "Enter content", "Set free/VIP and cost", "Publish or schedule", "Notify followers"],
    rules: [
      ["(4)", "BR-29", "VIP chapters require a positive coin cost."],
      ["(5,6)", "BR-30", "Notifications are created only for published chapters."],
    ],
  },
  {
    id: "UC-16",
    fr: "FR-7.1",
    name: "Admin Moderate Platform",
    actor: "Admin",
    trigger: "The admin opens moderation or user management.",
    pre: "The user has admin role.",
    post: "The selected user/content/report state changes and an audit log is recorded.",
    description: "This use case covers user management, content moderation, report resolution, and audit visibility.",
    steps: ["Open admin panel", "Verify admin role", "Select user/content/report", "Apply action", "Write audit log", "Show updated queue"],
    rules: [
      ["(2)", "BR-31", "Only admins may change roles, user status, report resolution, or hidden content state."],
      ["(5)", "BR-32", "Every sensitive admin action must include actor, target, action, and timestamp in audit logs."],
    ],
  },
];

const pages = [
  ["1", "Home", "Displays featured, trending, and newly updated novels."],
  ["2", "Novel Library", "Browse, search, and filter public novels."],
  ["3", "Novel Detail", "Displays synopsis, metadata, chapter list, reviews, follow action, and recommendations."],
  ["4", "Chapter Reader", "Displays chapter content, reader settings, navigation, VIP lock gate, and comments."],
  ["5", "Pricing", "Displays coin packages and starts MoMo payment."],
  ["6", "Library", "Displays authenticated reader bookshelf and reading progress."],
  ["7", "Curator CMS", "Allows internal curators to manage novels and chapters."],
  ["8", "Admin Panel", "Allows administrators to manage users, moderation, reports, audit logs, and analytics."],
  ["9", "Settings", "Allows profile, account, and reading preferences management."],
];

const messages = [
  ["MSG-01", "Invalid email or password.", "Try again"],
  ["MSG-02", "Registration successful. Please sign in.", "Go to login"],
  ["MSG-03", "Please sign in to continue.", "Sign in"],
  ["MSG-04", "This VIP chapter requires coins or an active subscription.", "Unlock"],
  ["MSG-05", "Insufficient coin balance.", "Buy coins"],
  ["MSG-06", "Chapter unlocked successfully.", "Read now"],
  ["MSG-07", "Payment is pending confirmation.", "Check again"],
  ["MSG-08", "Comment cannot be empty.", "Edit comment"],
  ["MSG-09", "You do not have permission to perform this action.", "Back"],
  ["MSG-10", "Changes saved.", "Continue"],
];

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function table(rows, cls = "") {
  return `<table${cls ? ` class="${cls}"` : ""}>${rows.map((row, i) => `<tr>${row.map((cell) => `${i === 0 ? "th" : "td"}` === "th" ? `<th>${cell}</th>` : `<td>${cell}</td>`).join("")}</tr>`).join("")}</table>`;
}

function useCaseDetail(uc, n) {
  const placeholder = `FIGURE_${uc.id.replace("-", "_")}`;
  return `
    <h3>${uc.id}: ${esc(uc.name)} (${uc.fr})</h3>
    ${table([
      ["Name", esc(uc.name)],
      ["Description", esc(uc.description)],
      ["Actor", esc(uc.actor)],
      ["Trigger", esc(uc.trigger)],
      ["Pre-condition", esc(uc.pre)],
      ["Post-condition", esc(uc.post)],
    ], "uc-table")}
    <h4>Activities Flow</h4>
    <p class="figure-token">${placeholder}</p>
    <p class="caption">Figure ${n + 1}: ${uc.name} Activity Flow</p>
    <h4>Business Rules</h4>
    ${table([["Activity", "BR Code", "Description"], ...uc.rules.map((r) => r.map(esc))], "rules")}
  `;
}

function diagramSvg(uc) {
  const steps = uc.steps;
  const w = 920;
  const top = 48;
  const rowH = 62;
  const h = 110 + steps.length * rowH;
  const actorX = 190;
  const sysX = 650;
  const lane1 = 35;
  const lane2 = 455;
  const lane3 = 885;
  const boxes = steps.map((step, i) => {
    const actorSide = i % 2 === 0;
    const x = actorSide ? actorX : sysX;
    const y = top + 45 + i * rowH;
    const text = esc(`${i + 1}. ${step}`);
    return `<rect x="${x - 145}" y="${y - 20}" width="290" height="40" rx="12" fill="#f8fafc" stroke="#475569"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Arial" font-size="13">${text}</text>`;
  }).join("\n");
  const arrows = steps.slice(1).map((_, i) => {
    const fromActor = i % 2 === 0;
    const x1 = fromActor ? actorX : sysX;
    const x2 = fromActor ? sysX : actorX;
    const y1 = top + 45 + i * rowH + 22;
    const y2 = top + 45 + (i + 1) * rowH - 22;
    return `<path d="M${x1} ${y1} C ${x1} ${y1 + 22}, ${x2} ${y2 - 22}, ${x2} ${y2}" fill="none" stroke="#111827" stroke-width="1.4" marker-end="url(#arrow)"/>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111827"/></marker></defs>
    <rect width="${w}" height="${h}" fill="white"/>
    <text x="${w / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="17" font-weight="700">${uc.id}: ${esc(uc.name)} Activity Flow</text>
    <line x1="${lane1}" y1="52" x2="${lane1}" y2="${h - 25}" stroke="#111827" stroke-width="2"/>
    <line x1="${lane2}" y1="52" x2="${lane2}" y2="${h - 25}" stroke="#111827" stroke-width="2"/>
    <line x1="${lane3}" y1="52" x2="${lane3}" y2="${h - 25}" stroke="#111827" stroke-width="2"/>
    <text x="${actorX}" y="70" text-anchor="middle" font-family="Arial" font-size="20">${esc(uc.actor.split("/")[0].trim())}</text>
    <text x="${sysX}" y="70" text-anchor="middle" font-family="Arial" font-size="20">System</text>
    <circle cx="${actorX}" cy="92" r="10" fill="#111827"/>
    <path d="M${actorX} 102 L${actorX} ${top + 65}" stroke="#111827" marker-end="url(#arrow)"/>
    ${boxes}
    ${arrows}
    <circle cx="${steps.length % 2 === 0 ? sysX : actorX}" cy="${top + 45 + (steps.length - 1) * rowH + 45}" r="12" fill="none" stroke="#111827" stroke-width="2"/>
    <circle cx="${steps.length % 2 === 0 ? sysX : actorX}" cy="${top + 45 + (steps.length - 1) * rowH + 45}" r="7" fill="#111827"/>
  </svg>`;
}

const css = `
  @page { margin: 0.7in; }
  body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
  .cover { min-height: 620px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border: 2px solid #1f2937; padding: 40px; }
  .version { font-size: 13pt; margin-bottom: 70px; }
  .doc-title { font-size: 28pt; font-weight: 700; letter-spacing: 0.8px; }
  .project { font-size: 26pt; font-weight: 700; margin-top: 18px; color: #1e3a8a; }
  h1 { color: #1e3a8a; font-size: 20pt; margin-top: 28px; border-bottom: 2px solid #bfdbfe; padding-bottom: 5px; }
  h2 { color: #1f2937; font-size: 15pt; margin-top: 22px; }
  h3 { color: #1f2937; font-size: 13pt; margin-top: 20px; }
  h4 { color: #374151; font-size: 11pt; margin: 14px 0 6px; }
  p { margin: 7px 0; }
  ul { margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 15px; font-size: 9.5pt; }
  th, td { border: 1px solid #9ca3af; padding: 6px 8px; vertical-align: top; }
  th { background: #dbeafe; font-weight: 700; }
  .uc-table td:first-child { width: 26%; font-weight: 700; background: #f8fafc; }
  .rules th { background: #e0f2fe; }
  .caption { text-align: center; color: #475569; font-size: 9pt; margin-top: 4px; }
  .figure-token { color: #ffffff; font-size: 1pt; }
  .toc li { margin: 4px 0; }
`;

const sections = [];
sections.push(`<div class="cover"><p class="version">Version 3.0</p><div class="doc-title">SOFTWARE REQUIREMENTS SPECIFICATION</div><div class="project">NovelHub</div><p style="margin-top:90px">Prepared for the NovelHub web novel reading platform</p><p>${today}</p></div>`);
sections.push(`<h1>Table of Contents</h1><ol class="toc"><li>Introduction</li><li>References</li><li>Functional Requirements</li><li>Non-functional Requirements</li><li>System Requirements</li><li>Appendixes</li></ol>`);
sections.push(`<h1>Introduction</h1><h2>Purpose</h2><p>This Software Requirements Specification defines the functional and non-functional requirements for NovelHub, a Vietnamese web novel reading platform for curated translated novels. It is intended to guide implementation, testing, architecture decisions, and stakeholder review.</p><p>The document follows a use-case driven structure so each major feature includes its trigger, actor, pre-condition, post-condition, activity flow, and business rules.</p><h2>Scope</h2><p>NovelHub allows guests to discover and read free chapters, authenticated readers to track reading progress and participate in community features, curators to manage internal catalog content, and administrators to moderate and operate the platform. Monetization is supported through coins, VIP chapter unlocks, and payment provider integration.</p><h2>Intended Audiences and Document Organization</h2><p>This document is intended for the following audiences:</p><ul><li><b>Development Team:</b> Implements the application and maps features to Next.js, database, and service modules.</li><li><b>Testing Team:</b> Derives test scenarios from use cases, business rules, non-functional requirements, and messages.</li><li><b>Project Stakeholders:</b> Reviews product scope, user roles, and acceptance behavior before development milestones.</li></ul>`);
sections.push(`<h1>References</h1>${table([["#", "Title", "Version", "File Name / Link", "Description"], ["1", "NovelHub SRS Draft", "1.0", "docs/SRS.md", "Initial local requirements for the novel reading platform."], ["2", "NovelHub SAD Draft", "1.0", "docs/SAD.md", "Architecture goals, modules, request flows, and deployment choices."], ["3", "NovelHub ERD", "1.0", "docs/ERD.md", "Database entities and relationships used by NovelHub."], ["4", "NovelHub Source Code", "current", "src/", "Implemented Next.js application, modules, routes, and database schema."]])}`);
sections.push(`<h1>Functional Requirements</h1><h2>Use Case Description</h2>${useCases.map(useCaseDetail).join("\n")}`);
sections.push(`<h1>Non-functional Requirements</h1><h2>User Access and Security</h2>${table([["Function / Data", "Guest", "Reader", "Curator", "Administrator"], ["Browse public novels", "Read", "Read", "Read", "Read"], ["Read free chapters", "Read", "Read", "Read", "Read"], ["Read VIP chapters", "No unless unlocked by auth flow", "Read with unlock or subscription", "Read for operational review", "Read for operational review"], ["Reading progress", "No access", "Own data only", "No access", "Support visibility only when needed"], ["Comments and reviews", "Read public visible", "Create/edit/delete own content", "May participate with verified role", "Hide/unhide and moderate"], ["Coin balance and transactions", "No access", "Own data only", "No access", "Operational support/audit"], ["Curator CMS", "No access", "No access", "Create/update owned catalog workflow", "Full content override"], ["Admin users and moderation", "No access", "No access", "No access", "Full access with audit logging"]])}<h2>Performance and Availability</h2>${table([["ID", "Requirement", "Target"], ["NFR-01", "Published chapter reader should load quickly under normal network conditions.", "LCP target under 1.5 seconds for cacheable content."], ["NFR-02", "Search should return catalog results quickly when search provider is healthy.", "p95 target under 300 ms."], ["NFR-03", "Reader-facing public pages must degrade gracefully when optional providers fail.", "Search failure falls back to database/catalog results."], ["NFR-04", "Read-heavy public data may be cached, but private entitlement data must remain authoritative.", "Coin balance, unlocks, subscriptions, and payment state are not publicly cached."]])}<h2>Security, Reliability, and Auditability</h2>${table([["ID", "Requirement", "Target"], ["NFR-05", "Authentication must use secure server-issued sessions.", "HttpOnly cookies through Better Auth."], ["NFR-06", "Payment callbacks must be verified and idempotent.", "Invalid signatures rejected; duplicate success callbacks do not double-credit."], ["NFR-07", "VIP unlock operations must be consistent.", "Ledger debit and unlock insert occur in one database transaction."], ["NFR-08", "Sensitive curator/admin operations must be auditable.", "Audit records include actor, action, target, metadata, and timestamp."], ["NFR-09", "The system must preserve module maintainability.", "Business logic remains in domain modules, not scattered across UI components."]])}`);
sections.push(`<h1>System Requirements</h1><h2>Custom Pages</h2>${table([["#", "Page Name", "Description"], ...pages])}<h2>External Services</h2>${table([["Service", "Purpose", "Requirement"], ["Neon PostgreSQL", "Primary relational database", "Stores users, novels, chapters, progress, community, monetization, and audit data."], ["Better Auth", "Authentication", "Handles email/password, OAuth, sessions, and credential security."], ["Meilisearch", "Catalog search", "Provides typo-tolerant novel search with database fallback."], ["Upstash Redis", "Cache", "Supports hot public data and future rate limiting/cache needs."], ["Cloudinary", "Media", "Stores and serves cover images."], ["MoMo", "Payments", "Creates payment sessions and sends signed webhooks for coin purchases."]])}`);
sections.push(`<h1>Appendixes</h1><h2>Glossary</h2>${table([["Term", "Description"], ["Novel", "A curated long-form story published by the platform team."], ["Chapter", "A numbered part of a novel. It can be draft, scheduled, published, free, or VIP."], ["VIP Chapter", "A locked chapter that requires coins or subscription entitlement."], ["Coin", "Virtual currency purchased by users and spent on VIP chapter unlocks."], ["Curator", "Internal content operator who manages novels and chapters."], ["Entitlement", "A user's right to access protected chapter content."], ["Audit Log", "Immutable record of sensitive curator/admin operations."]])}<h2>Messages</h2>${table([["Message Code", "Message Content", "Button"], ...messages])}`);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>NovelHub SRS v3</title><style>${css}</style></head><body>${sections.join("\n")}</body></html>`;
writeFileSync(join(outDir, "NovelHub_SRS_v3.html"), html);

for (const uc of useCases) {
  writeFileSync(join(svgDir, `${uc.id}.svg`), diagramSvg(uc));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 2 });
for (const uc of useCases) {
  const svg = diagramSvg(uc);
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:24px;background:white">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: join(pngDir, `${uc.id}.png`) });
}
await browser.close();

console.log(outDir);
