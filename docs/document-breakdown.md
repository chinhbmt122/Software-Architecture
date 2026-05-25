# Section-by-Section Breakdown: SRS · SAD · ADD · ASR

---

## SRS (Software Requirements Specification) — `docs/SRS.md`

The SRS is the **source of truth for what the system must do**. Every other document traces back to it.

| Section | Title | Purpose | Expected Content |
|---------|-------|---------|-----------------|
| §1.1 | Purpose | Declares the document's role in the project lifecycle | States SRS is authoritative for design, development, testing, and deployment |
| §1.2 | Scope | Defines what is inside and outside the system boundary | Platform capabilities listed; "curated only — no public submissions" is a key constraint |
| §1.3 | Intended Audiences | Routes readers to relevant sections | Matrix of audience → section (architects → §1,3,4; QA → §2,5; security → §3) |
| §1.4 | References | Links to all external and internal dependencies | 10 references: ERD.md, SAD.md, UI-BRIEF.md, Better Auth, Next.js, Drizzle, MoMo, Meilisearch, Neon, Cloudinary |
| §2.1 | Use Case Index | Provides a master index of all 23 use cases | Table of UC-01–UC-23 with actor and FR code; UC organized into 9 functional groups (Auth, Browse, Library, Community, Monetization, Profile, Curator, Admin) |
| §2.2–§2.24 | Individual Use Cases (UC-01 to UC-23) | Specifies **what** each behavior must do in precise, testable terms | Each UC has: Name, Description, Actor, Trigger, Pre-condition, Post-condition, Activity Flow diagram, and Business Rules table with pseudocode (BR codes, MSG codes) |
| §3 | Non-Functional Requirements | Defines measurable quality constraints | Security/access-control matrix (role × permission), performance targets (< 1.5 s chapter load), availability SLAs, security controls (HMAC, bcrypt, httpOnly) |
| §4 | System Requirements | Maps requirements to technical environment | Application pages catalogue (all routes), tech stack constraints, deployment constraints (Vercel, serverless) |
| §5 | Appendixes | Glossary + message catalogue | Domain terms (VIP, xu/coin, curator) + all user-facing MSG codes referenced in BRs (MSG-001 duplicate email, MSG-002 wrong credentials, MSG-015 weak password, MSG-018 rate limit, MSG-023 validation, MSG-024 neutral reset-password confirmation, etc.) |

### Use Case Groupings in §2

| Group | UCs | Functional Area |
|-------|-----|----------------|
| FR-2 Auth | UC-01–06 | Register, Sign-In (email + Google), Sign-Out, Reset Password, Change Password |
| FR-3 Content | UC-07–11 | Browse, Search, Filter, Novel Detail, Read Chapter, Reader Settings |
| FR-4 Library | UC-12–14 | Follow Novel, Track Progress, View Library |
| FR-5 Community | UC-15–16 | Write Review, Leave Comment |
| FR-6 Monetization | UC-17–18 | Purchase Coins, Unlock VIP Chapter |
| FR-7 Profile | UC-19–20 | Update Profile, Change Password |
| FR-8 Curator | UC-21–22 | Manage Novels, Manage Chapters |
| FR-9 Admin | UC-23 | Manage System (users, packages, moderation, audit) |

---

## SAD (Software Architecture Document) — `docs/SAD.md`

The SAD answers **how the system is built** — structure, runtime topology, deployment, and why key decisions were made.

| Section | Title | Purpose | Expected Content |
|---------|-------|---------|-----------------|
| §1.1 | Document Management | Document metadata and governance | ID, owner, status, related documents, change process |
| §1.2 | Purpose and Scope | Scopes what the SAD covers | Covers Phase 1 end-state; forward-looking for Phases 2–4; explicitly defers to SRS/ERD for requirements |
| §1.3 | Organization | Table of contents with viewpoint mapping | 14-section map; each section mapped to its viewpoint role |
| §1.4 | Stakeholder Representation | Maps stakeholders to the sections they care about | 7 stakeholder types × primary concern × relevant viewpoints |
| §1.5 | Viewpoint Definitions | Defines which views are documented and why | Use Case, Module, C&C, Deployment, Behavior — each with notation |
| §1.6 | View Structure | Template for how every view section is written | 5-part template: Description → Packet Overview → Background → Variability → View Packets |
| §2.1 | Problem Background | Explains the technical problems architecture must solve | 5 core problems: content delivery speed, monetization security, coin integrity, SEO, solo-dev overhead |
| §2.2 | Goals and Context | 8 architectural goals with priorities | G-01 (chapter speed) Critical → G-08 (cold-start) Medium; provides a priority ordering for trade-off decisions |
| §2.3 | Significant Driving Requirements | The SRS requirements that most constrain architecture | DR-01 through DR-08; each traces to SRS section + architectural element |
| §2.4 | Solution Background | One-paragraph summary of the chosen approach | Next.js 16 full-stack monolith + module isolation + serverless + 5 managed services |
| §2.5 | Architectural Approaches | Records considered and rejected alternatives | Selected approach + 4 rejected options (microservices, headless CMS, GraphQL, Prisma) each with rationale and reconsideration trigger |
| §2.6 | Analysis Results | Shows how architecture responds to each concern | 6-row table: concern → architecture response → evidence pointer |
| §2.7 | Requirements Coverage | High-level mapping of all 23 UCs to architecture elements | UC groups → responsible module/mechanism |
| §3 | Use Case View | Identifies the architecturally significant subset of UCs | Actors table; 9 ASUCs with ASUC→AD traceability; VP-3.3 maps each ASUC to driver + QA attribute + element |
| §4 | Module View (Logical) | Static code organization: layers, modules, boundaries | 4-layer diagram; 7-module table with DB ownership + key exports; element catalog of all key files; 4 key interface contracts (getChapter, unlockChapter, handleWebhook, searchNovels); 5 dependency constraints (DC-01–DC-05) |
| §5 | C&C View | Runtime topology: what talks to what, how | C&C diagram; 9-connector catalog (CN-01–CN-09) with protocol + security properties; 3 request flow narratives (F-01 browse, F-02 VIP unlock, F-03 MoMo webhook) |
| §6 | Deployment View | Infrastructure mapping for V1 (Hobby) and V2 (Production) | V1 service table with constraints; V2 scaling comparison table; V1→V2 migration trigger |
| §7 | Behavior View | Runtime sequences for 6 architecturally significant scenarios | VP-7.1–7.6: Login, VIP Unlock, MoMo Webhook, Read Free Chapter, Curator Publish, Admin Moderate — each with element table + QA requirements demonstrated |
| §8 | Cross-View Traceability | Consistency checks across all views | Element → (Module/C&C/Deployment/Behavior) matrix; 8 cross-view consistency checks (CC-01–CC-08); driver coverage check (AD-01–08 × tactic × decision × behavior) |
| §9 | Quality Attribute Scenarios (ADs) | IEEE-format QA scenarios that are the primary architectural drivers | AD-01 to AD-08 each with Source/Stimulus/Artifact/Environment/Response/Response Measure/Tactics Applied |
| §10 | Architectural Tactics | The implementation mechanisms that satisfy QA goals | T-01–T-13 tactic registry; cross-impact matrix (primary QA + secondary benefit + negative cross-impact); QA assurance traceability table with verification evidence |
| §11 | Architectural Decisions | Rationale for 9 major decisions + design patterns | AD-D-01 to AD-D-09 (full Decision/Drivers/Rationale/Trade-offs/Alternatives); GoF/enterprise patterns table (Repository, Facade, Strategy, Middleware, Observer, Singleton, Idempotent Receiver) |
| §12 | ADD Iteration Log | How the architecture was derived phase by phase | 4 iterations: Foundation (Phase 0), Content+Reader (Phase 1), Monetization (Phase 2), Community+Search (Phase 3) — each with goal, drivers, decisions, elements, risks |
| §13 | Req-to-Architecture Traceability | Maps every SRS requirement to the architecture element that satisfies it | UC-01–UC-23 + NFR-01–NFR-06 → component(s) → architectural driver → notes |
| §14 | References | Academic and technical references | 14 items: Bass/Clements/Kazman, IEEE 1471, Kruchten 4+1, internal docs, framework docs |
| App A | Glossary | Domain and architecture terms | 15 terms: App Router, ASUC, Coin, Drizzle, RSC, VIP, etc. |
| App B | Acronyms | Abbreviation expansions | 22 acronyms: ADD, ASUC, C&C, CDN, CSRF, DR, HMAC, ISR, LCP, NFR, QA, RSC, SAD, SSR, XSS, etc. |

---

## ADD (Attribute-Driven Design) — `docs/ADD.md`

The ADD records **why quality attributes drove specific design choices** — it bridges "what matters" (QA requirements) and "what was built" (architecture). It is more scenario-dense than SAD §9 and §11, providing full IEEE scenario tables for every QA concern.

| Section | Title | Purpose | Expected Content |
|---------|-------|---------|-----------------|
| §1 | Design Constraints | System-level properties that are non-negotiable regardless of QA priorities | DC-01 Scalability (500–5000 DAU), DC-02 Availability (CDN layer), DC-03 Reliability (transactional), DC-04 Security (VIP gate, HMAC, role enforcement), DC-05 Modifiability (isolated modules), DC-06 Deployment (Vercel serverless, no Docker) |
| §2.0 | QA Implementation Snapshot | Slide-ready summary linking each QA to its concrete tactic | 5-row table: Performance/Security/Reliability/Availability/Modifiability → how NovelHub ensures each → which UCs it supports |
| §2.1.1 | Auth & Authorization Scenario | Verifies protected routes reject unauthorized requests | IEEE scenario: stimulus = request to protected route; measure = 100% rejected without session, role mismatch 403 in < 5 ms |
| §2.1.2 | VIP Content Protection Scenario | Verifies VIP content bytes = 0 in HTML for unauthorized users | IEEE scenario: RSC calls `checkAccess()` before fetching content; measure = 0 bytes VIP content leaked |
| §2.1.3 | Payment Webhook Integrity Scenario | Verifies forged webhooks are rejected before any DB write | IEEE scenario: HMAC-SHA256 constant-time comparison; measure = 0 coins credited on invalid signature |
| §2.1.4 | Brute-Force Login Scenario | Quantifies the lockout trigger and duration | IEEE scenario: N=5 failures → 900 s lock; measure = generic error message regardless of which field wrong |
| §2.1.5 | Content Sanitization Scenario | Verifies XSS is stripped server-side before DB write | IEEE scenario: DOMPurify in `createChapter()`; measure = 0 script/on* in stored content |
| §2.2.1 | Chapter Read Latency Scenario | Quantifies the mobile reading performance target | IEEE scenario: 4G cold CDN miss; measure = P95 TTI < 1.5 s, LCP < 2.5 s, JS payload < 50 KB, CDN TTFB < 50 ms |
| §2.2.2 | SEO Response Scenario | Verifies Googlebot sees correct metadata on every page | IEEE scenario: bot crawls novel/browse pages; measure = og:title + canonical in 100% of responses, 0 "not indexed" errors |
| §2.2.3 | Search Response Scenario | Quantifies search latency with typo tolerance and fallback | IEEE scenario: 1–3 word query; measure = P95 < 500 ms (Meilisearch), < 1 s (fallback), typo tolerance ≥ 1 edit distance |
| §2.3.1 | Coin Integrity Scenario | Verifies concurrent unlock can never produce negative balance | IEEE scenario: simultaneous unlock with 1 coin; measure = coin_balance ≥ 0 always, exactly 1 unlock record per (user, chapter) |
| §2.3.2 | Webhook Idempotency Scenario | Verifies coins credited exactly once across retries | IEEE scenario: same webhook delivered twice; measure = exactly 1 coin_transactions entry per orderId |
| §2.3.3 | Chapter Publish Consistency Scenario | Verifies side-effects (Meilisearch, notifications) don't block or roll back the commit | IEEE scenario: curator publishes; measure = chapter in DB if API returned 201; side effects complete within 60 s |
| §2.4.1 | CDN Availability During Outage Scenario | Quantifies how long cached pages remain readable during origin failure | IEEE scenario: origin returns 5xx; measure = cached free chapters accessible up to 60 min, TTFB < 50 ms stale |
| §2.4.2 | Search Fallback Scenario | Verifies search returns results during Meilisearch outage | IEEE scenario: Meilisearch timeout; measure = fallback P95 < 1 s, 0 errors propagated |
| §2.4.3 | Serverless Fault Isolation Scenario | Verifies one function crash doesn't cause sustained downtime | IEEE scenario: instance crashes; measure = recovery within 1 retry cycle, 0 data corruption |
| §2.5.1–2.5.3 | Scalability Scenarios (3) | Quantifies behavior under concurrent load and growth | Concurrent reads (500 DAU), index growth (100 → 10,000 novels), DB connections (V1 → V2 zero code change) |
| §2.6.1–2.6.4 | Modifiability Scenarios (4) | Defines cost-of-change bounds for provider swaps | Payment gateway (≤ 3 files in monetization module), search provider (0 changes outside search module), auth provider (≤ 4 files in lib), feature modules (0 cross-module imports verified by ESLint) |
| §3.1 | Logical View | Compact reference to the 4-layer structure | Layer table + diagram reference; layer dependency rule |
| §3.2 | Implementation View | Source directory conventions and coding constraints | 5 key implementation conventions (service-function-only exports, schema ownership, coin_balance constraints) |
| §3.3 | Deployment View | V1 and V2 service tables with constraints | Free-tier limits; V1→V2 migration triggers |
| §3.4 | Data View | Schema organization and critical data rules | 6 schema files × module owner; 5 critical data constraints |
| §4 | QA Driver Summary | Master cross-reference linking every ADD scenario to SAD tactics, decisions, behavior views, and test evidence | 21-row table: ADD scenario → QA attribute → SAD tactic(s) → SAD decision → behavior view packet → implementation file + test file |

---

## ASR (Architecturally Significant Requirements) — `docs/ASR.xlsx`

The ASR is an **Excel workbook** that extracts and structures the architecturally significant requirements from the SRS into a form directly usable by ADD/SAD work. It is the input to the ADD process: utility tree → scenarios → architectural drivers.

| Sheet / Section | Purpose | Expected Content |
|-----------------|---------|-----------------|
| Utility Tree | Hierarchical breakdown of quality attributes into scenarios | Root: "Quality" → QA attributes (Performance, Security, Reliability, Availability, Modifiability, Scalability) → sub-attributes → leaf scenarios with priority (H/M/L) and difficulty (H/M/L) ratings |
| QA Scenarios | Full IEEE scenario table for each leaf node | For each scenario: Source, Stimulus, Environment, Artifact, Response, Response Measure — these become AD-01–AD-08 in the SAD and §2.1–2.6 in the ADD |
| Requirements Mapping | Links ASRs to SRS use cases and SRS NFRs | ASR ID → UC(s) it protects → FR/NFR code in SRS → whether it's a functional constraint or a QA scenario |
| Architectural Decisions Index | Records which ADD/SAD decision each ASR drives | ASR → AD-D-## (SAD §11) + Tactic T-## (SAD §10) |
| Priority Grid | 2×2 grid of business importance × architectural difficulty | Used to identify which scenarios most need architectural attention; drives the ADD iteration order |

---

## Cross-Document Traceability Map

This is the traceability chain: every requirement that matters traces from SRS all the way to a test.

```
SRS §2 (UC + BR)
    ↓ selects architecturally significant UCs
ASR Utility Tree (QA scenarios with priority/difficulty)
    ↓ provides IEEE scenarios
ADD §2 (QA Requirement Scenarios)
    ↓ drives
ADD §1 (Design Constraints) + SAD §2.3 (Driving Requirements)
    ↓ determines
SAD §9 (Architectural Drivers AD-01–08)
    ↓ resolved by
SAD §10 (Tactics T-01–T-13)
    ↓ implemented as
SAD §11 (Decisions AD-D-01–09) + SAD §4 (Module View) + SAD §5 (C&C View) + SAD §6 (Deployment)
    ↓ demonstrated in
SAD §7 (Behavior View VP-7.1–7.6)
    ↓ verified by
RTM (test IDs) → Playwright test files
```

### Key Cross-Document Links

| SRS | ADD Scenario | SAD AD | SAD Tactic | SAD Decision | Behavior VP | Implementation Position | Test File |
|-----|-------------|--------|-----------|-------------|-------------|------------------------|-----------|
| UC-02 (Sign In) | §2.1.4 (brute-force) | AD-02 | T-04, T-05 | AD-D-05 | VP-7.1 | `src/lib/auth.ts:7` (Better Auth `emailAndPassword` config); `src/proxy.ts:9` (`proxy()` — session check entry point); `src/proxy.ts:23` (no-session redirect / 401) | `auth-api.spec.ts` |
| UC-09 (Read Chapter) | §2.2.1 (latency) | AD-01 | T-01, T-02, T-03 | AD-D-01 | VP-7.4 | `src/app/novels/[slug]/chapters/[number]/page.tsx:2` (imports `checkChapterAccess`); `src/app/novels/[slug]/chapters/[number]/page.tsx:13` (`generateMetadata`); `src/modules/monetization/services/unlock.service.ts:16` (`checkChapterAccess`) | `reader-ui.spec.ts` |
| UC-10 (Search) | §2.2.3 (search latency) | AD-05 | T-09, T-10 | AD-D-07 | — | `src/modules/search/services/search.service.ts:69` (`searchNovels`); `:76` (Meilisearch path); `:91` (`ilike` fallback on error) | `novels-ui.spec.ts` |
| UC-17 (Purchase Coins) | §2.1.3 (HMAC) + §2.3.2 (idempotency) | AD-04 | T-06, T-08 | AD-D-06 | VP-7.3 | `src/modules/monetization/services/momo.service.ts:118` (`verifyMomoIpn`); `:141` (HMAC comparison); `:161` (idempotency guard `if status === "SUCCESS" return`) | `payments-api.spec.ts` |
| UC-18 (VIP Unlock) | §2.1.2 (VIP gate) + §2.3.1 (coin integrity) | AD-03 | T-06, T-07 | AD-D-03 | VP-7.2 | `src/modules/monetization/services/unlock.service.ts:54` (`unlockChapter`); `:65` (idempotency pre-check); `:80` (`deductCoins` call); `src/modules/monetization/services/coin.service.ts:47` (`deductCoins`) | `payments-api.spec.ts` |
| UC-22 (Curator Publish) | §2.1.5 (XSS sanitization) + §2.3.3 (publish consistency) | AD-07 | T-12 | AD-D-08 | VP-7.5 | `src/modules/content/services/chapter.service.ts:7` (`sanitizeContent` helper); `:39` (called in `createChapter` before DB insert) | `curator-api.spec.ts`, `curator-ui.spec.ts` |
| UC-23 (Admin) | §2.1.1 (auth/authz) | AD-08 | T-13 | AD-D-09 | VP-7.6 | `src/proxy.ts:34` (ADMIN role check → 403 on API routes); `src/proxy.ts:38` (ADMIN role check → redirect on pages); `src/modules/admin/services/admin.service.ts:256` (`writeAuditLog`) | `admin-api.spec.ts`, `admin-ui.spec.ts` |
| SRS §3 NFR (SEO) | §2.2.2 (SEO response) | AD-06 | T-11 | AD-D-01 | VP-7.4 | `src/app/novels/page.tsx:16` (`metadata` export); `src/app/novels/[slug]/page.tsx:42` (`generateMetadata`); `src/app/novels/[slug]/chapters/[number]/page.tsx:13` (`generateMetadata` with canonical) | `nfr-api.spec.ts`, `novels-ui.spec.ts` |
| SRS §3 NFR (availability) | §2.4.1 (CDN outage) | AD-01 | T-02 | AD-D-01 | VP-7.4 | `src/app/novels/[slug]/chapters/[number]/page.tsx` (Next.js default ISR — no explicit `Cache-Control` header set in current implementation; relies on Vercel/Cloudflare edge defaults) | `nfr-api.spec.ts` |
| SRS §3 NFR (modifiability) | §2.6.1–2.6.4 (module isolation) | — | — | AD-D-04 | — | `src/modules/content/index.ts:1`; `src/modules/monetization/index.ts:1`; `src/modules/search/index.ts:1` (Facade — `export *` from service files; no internals exposed) | `npm run lint` |

### What Each Document Uniquely Contributes

| Document | Exclusive Content |
|----------|-----------------|
| SRS | Actor definitions, 23 use cases with activity flows and BR pseudocode, MSG code catalogue, application pages catalogue |
| ASR | Utility tree structure, priority/difficulty ratings, requirement selection rationale |
| ADD | Full IEEE scenario tables for all 21 QA scenarios (more detailed than SAD §9); modifiability cost-of-change bounds; implementation conventions; complete QA driver → test evidence mapping |
| SAD | All architectural views (Module, C&C, Deployment, Behavior); interface contracts; connector catalog with security properties; cross-view consistency checks; design pattern registry; ADD iteration log (Phases 0–3) |
