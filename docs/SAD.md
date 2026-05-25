---
title: "Software Architecture Document (SAD)"
subtitle: "NovelHub — Vietnamese Web Novel Reading Platform"
author: "Architecture Team"
date: "17/05/2026"
version: "1.0"
---

# Revision History

| Version | Date       | Author             | Changes                              |
|---------|------------|--------------------|--------------------------------------|
| 0.1     | 01/05/2026 | Architecture Team  | Initial outline                      |
| 0.5     | 10/05/2026 | Architecture Team  | All views drafted; ADD log added     |
| 1.0     | 17/05/2026 | Architecture Team  | Final review; diagrams embedded      |

\pagebreak

# 1. Documentation Roadmap

## 1.1 Document Management

| Item              | Detail                                                         |
|-------------------|----------------------------------------------------------------|
| Document ID       | NovelHub-SAD-v1.0                                              |
| Project           | NovelHub — Vietnamese Web Novel Reading Platform               |
| Status            | Released                                                       |
| Owner             | Lead Architect                                                 |
| Related Documents | SRS v1.0, User Story v1.0, Utility Tree v1.0, ERD v1.0        |
| Toolchain         | Next.js 16, Drizzle ORM, Better Auth, Pandoc 3.9, PlantUML    |

Changes to this document must be proposed via pull request, reviewed by the Lead Architect, and recorded in the Revision History table above.

## 1.2 Purpose and Scope

This Software Architecture Document describes the architecture of **NovelHub**, a Vietnamese web novel reading platform. NovelHub is a curated platform (no public submissions) offering translated novels (CN/KR/JP → Vietnamese) with monetization via coin-per-chapter unlocks and monthly subscriptions.

The SAD covers the architecture as it exists at the end of Phase 1 (Content module + Reading UI) and includes forward-looking decisions for Phase 2 (Monetization), Phase 3 (Community + Search), and Phase 4 (Admin + Analytics).

This document does **not** replace the SRS, ERD, or User Story documents. It references those documents for requirements and data-model details.

## 1.3 How the SAD Is Organized

| Section | Viewpoint / Purpose                                      |
|---------|----------------------------------------------------------|
| §1      | Documentation Roadmap — how to read this document        |
| §2      | Architecture Background — problem, goals, approach       |
| §3      | Use Case View — architecturally significant use cases    |
| §4      | Module View — code/layer structure, module boundaries    |
| §5      | Component-and-Connector View — runtime topology          |
| §6      | Deployment View — infrastructure mapping                 |
| §7      | Behavior View — sequence diagrams for key flows          |
| §8      | Cross-View Traceability — element consistency checks     |
| §9      | Quality Attribute Scenarios — architectural drivers (AD) |
| §10     | Architectural Tactics — how QA goals are achieved        |
| §11     | Architectural Decisions — rationale for key choices      |
| §12     | ADD Iteration Log — how architecture was derived         |
| §13     | Requirement-to-Architecture Traceability                 |
| §14     | References                                               |
| App. A  | Glossary                                                 |
| App. B  | Acronyms                                                 |

## 1.4 Stakeholder Representation

| Stakeholder          | Role                       | Primary Concern                              | Viewpoints           |
|----------------------|----------------------------|----------------------------------------------|----------------------|
| Product Owner        | Business decision-maker    | Feature scope, delivery schedule             | Use Case, Deployment |
| Lead Developer       | Architect + implementer    | All concerns                                 | All views            |
| Security Reviewer    | Compliance and security    | Auth, payments, data confidentiality         | Module, C&C, §9      |
| DevOps / SRE         | Deployment, operations     | Uptime, scaling, cost                        | Deployment, C&C      |
| End User (Reader)    | Consumes product           | Reading experience, speed, reliability       | Use Case, Behavior   |
| Curator / Author     | Content publisher          | CMS usability, publishing workflow           | Use Case, Behavior   |
| External Auditor     | Compliance, finance        | Audit log, payment integrity                 | §8, §9, §13          |

## 1.5 Viewpoint Definitions

| Viewpoint                  | Purpose                                                        | Primary Notation         |
|----------------------------|----------------------------------------------------------------|--------------------------|
| Use Case View              | Architecturally significant actors and scenarios               | UML Use Case table       |
| Module View (Logical)      | Static code organisation, layers, module boundaries            | UML Package/Component    |
| C&C View (Process)         | Runtime components, connectors, protocols                      | UML Component + notes    |
| Deployment View            | Infrastructure mapping, nodes, ports, scaling                  | UML Deployment           |
| Behavior View              | Runtime interaction for key scenarios                          | UML Sequence             |

## 1.6 How a View Is Documented

Every architecture view section in this document follows this structure:

1. **View Description** — purpose and scope of the view
2. **View Packet Overview** — list of diagrams/packets in the view
3. **Architecture Background** — design decisions relevant to this view
4. **Variability Mechanisms** — what may change across environments or phases
5. **View Packets** — primary presentation (diagram) + element catalog + relations + constraints

## 1.7 Process for Updating the SAD

1. Raise a change request (GitHub Issue) describing the affected section.
2. Lead Architect reviews and approves scope of change.
3. Author updates the relevant section and regenerates affected diagrams.
4. Increment minor version (e.g., 1.0 → 1.1) and record in Revision History.
5. Major restructuring (new views, changed AD identifiers) increments major version.

\pagebreak

# 2. Architecture Background

## 2.1 Problem Background

NovelHub is a Vietnamese-language platform for reading translated web novels (Chinese xianxia/xuanhuan, Korean manhwa, Japanese light novels). The core problems to solve are:

- **Content delivery**: Thousands of chapters of long-form text must load fast on mobile connections (Vietnam's dominant access mode) without JavaScript hydration bottlenecks.
- **Monetization**: Premium chapters must be gated securely while free chapters remain fully accessible without authentication.
- **Integrity**: Coin balances and payment ledgers must be exactly correct — over-crediting or double-crediting is a direct business loss.
- **SEO**: Vietnamese users discover novels through Google search; pages must be server-rendered with correct metadata.
- **Solo development**: The initial team is one developer. The architecture must minimize operational overhead, prefer managed services, and support clear module boundaries so features can be added without full-system understanding.

## 2.2 Goals and Context

| Goal ID | Goal                                                          | Priority |
|---------|---------------------------------------------------------------|----------|
| G-01    | Chapter pages load in < 1.5 s on 4G (core reading experience)| Critical |
| G-02    | Coin transactions are always atomic and consistent            | Critical |
| G-03    | All novel and chapter pages are indexable by Google           | High     |
| G-04    | Auth flow is secure (CSRF, brute-force protection, httpOnly)  | High     |
| G-05    | Payment webhooks are idempotent and HMAC-verified             | High     |
| G-06    | Architecture supports solo development with clean boundaries  | High     |
| G-07    | Infrastructure cost ≤ $0 on development tier                  | Medium   |
| G-08    | Cold-start latency < 500 ms for serverless functions          | Medium   |

## 2.3 Significant Driving Requirements

The following requirements have the greatest influence on architectural decisions:

| ID    | Requirement                                                        | Source       | Drives          |
|-------|--------------------------------------------------------------------|--------------|-----------------|
| DR-01 | Chapter read latency < 1.5 s (P95, 4G)                            | SRS §3, G-01 | §4 RSC, §6 CDN  |
| DR-02 | Coin deduction + unlock record must be a single atomic transaction  | SRS UC-18    | §4, §5 Drizzle  |
| DR-03 | MoMo webhook must be idempotent (no double-credit)                 | SRS UC-17    | §5, §9 AD-04    |
| DR-04 | coin_balance NEVER cached — always read from DB                   | SRS §3.1     | §5, §9 AD-03    |
| DR-05 | All SSR pages must render with correct og:title, canonical URL     | SRS §3.2     | §4 App Router   |
| DR-06 | Account lockout after 5 failed login attempts                      | SRS UC-02    | §7, §9 AD-02    |
| DR-07 | Modules must not import each other directly                        | CLAUDE.md    | §4 boundaries   |
| DR-08 | Search results in < 500 ms with typo tolerance                     | SRS UC-10    | §5 Meilisearch  |

## 2.4 Solution Background

NovelHub is built as a **Next.js 16 full-stack monolith** using the App Router. This is a deliberate architectural choice (see §11) that combines:

- **Server Components (RSC)** for zero-JS, fast-rendering pages (novel lists, chapter content)
- **API Routes** as the backend (no separate service layer needed)
- **Module boundaries** enforced by convention within a single codebase
- **Serverless infrastructure** (Vercel + Neon) to eliminate server management

The system connects to five external managed services: Neon PostgreSQL, Upstash Redis, Meilisearch Cloud, Cloudinary, and MoMo/VNPay payment gateways.

## 2.5 Architectural Approaches

### 2.5.1 Selected: Next.js 16 Full-Stack Monolith with Module Isolation

**Description**: A single Next.js 16 application (App Router) serves all pages and all API routes. Code is divided into feature modules (`src/modules/`) that own their DB tables and export service functions. Modules interact only through exports, never through direct imports of each other's internals.

**Rationale**:

- Solo developer: one deployment, one CI pipeline, one monitoring concern
- App Router RSC eliminates client-side hydration for content pages (most of the product)
- Modules provide logical separation without the operational overhead of microservices
- Next.js natively solves SEO (SSR + metadata API) without a separate SSR service

### 2.5.2 Rejected: Microservices Architecture

| Aspect      | Detail                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Description | Separate services for content, monetization, auth, search                           |
| Rejection   | Unacceptable operational overhead for a solo developer; adds distributed-tracing, API gateway, service mesh needs; cross-service transactions complex |
| Reconsider  | When team size > 5 engineers and a specific service needs independent scaling       |

### 2.5.3 Rejected: Headless CMS + Separate API Server

| Aspect      | Detail                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Description | Contentful/Sanity for content + Express.js API + Next.js frontend                  |
| Rejection   | Three deployments to manage; Contentful costs scale with content volume; loss of type-safety between API and frontend |
| Reconsider  | If content volume requires a dedicated CDN-backed CMS at enterprise scale           |

### 2.5.4 Rejected: GraphQL API Layer

| Aspect      | Detail                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Description | Apollo Server GraphQL API between Next.js and DB                                   |
| Rejection   | Over-engineering for a CRUD-heavy platform; resolver complexity adds latency; Drizzle ORM + Server Components already provide co-located data fetching |
| Reconsider  | If a mobile app (React Native) is added and needs a shared API layer                |

### 2.5.5 Rejected: Prisma ORM

| Aspect      | Detail                                                                              |
|-------------|-------------------------------------------------------------------------------------|
| Description | Prisma as ORM instead of Drizzle                                                   |
| Rejection   | Prisma's query engine binary adds ~50 MB cold-start weight, significant on Vercel serverless; Drizzle is lighter, generates SQL the developer can audit |
| Reconsider  | If Prisma Accelerate (edge-optimised) matures and solves cold-start penalty         |

## 2.6 Analysis Results

| Concern                    | Architecture Response                                | Evidence          |
|----------------------------|------------------------------------------------------|-------------------|
| Chapter load latency       | RSC eliminates client-side hydration; CDN-cached     | DR-01, §9 AD-01   |
| Coin integrity             | DB transactions; no cache for coin_balance           | DR-02, §9 AD-03   |
| Payment correctness        | HMAC verification + idempotency key on payments      | DR-03, §9 AD-04   |
| SEO                        | All novel/chapter pages use Next.js generateMetadata | DR-05, §9 AD-06   |
| Auth security              | Better Auth: httpOnly cookies, rate-limit, bcrypt    | DR-06, §9 AD-02   |
| Module isolation           | Convention enforced by lint; all DB access via module exports | DR-07, §4  |

## 2.7 Requirements Coverage

All 23 use cases from the SRS are covered by at least one architecture element. Full mapping is in §13. Summary:

- **UC-01 to UC-06** (Auth): Better Auth handler + middleware
- **UC-07 to UC-11** (Browse/Read): content + reader modules + RSC pages
- **UC-12 to UC-15** (Library): reader module
- **UC-16 to UC-19** (Monetization): monetization module + MoMo webhook handler
- **UC-20 to UC-22** (Community): community module (Phase 3)
- **UC-23** (Admin): admin module + audit_logs table

\pagebreak

# 3. Use Case View

## 3.1 View Description

The Use Case View selects the architecturally significant use cases (ASUCs) — those that directly influence the choice of components, layers, connectors, or quality attribute tactics. It does not repeat all 23 use cases from the SRS; rather, it identifies the subset that drives architecture decisions.

## 3.2 View Packet Overview

| Packet | Content                                      |
|--------|----------------------------------------------|
| VP-3.1 | Actor definitions and system boundary        |
| VP-3.2 | Architecturally Significant Use Case table   |
| VP-3.3 | Traceability to architectural drivers        |

## 3.3 Architecture Background

A use case is architecturally significant if it (a) imposes measurable performance/security/integrity requirements, (b) requires a cross-cutting component, or (c) exposes a risk that shapes module or deployment topology.

## 3.4 Variability Mechanisms

- Guest users see the same pages as logged-in users but with VIP content locked
- Curator role is distinguished from Reader at the middleware layer (role check)
- Phase-gated features (community, admin) are scaffolded but not yet wired in V1

## 3.5 View Packets

### 3.5.1 VP-3.1: Actors

| Actor    | Type     | Description                                                    |
|----------|----------|----------------------------------------------------------------|
| Guest    | Primary  | Unauthenticated visitor; can browse and read free chapters     |
| Reader   | Primary  | Authenticated user; can unlock VIP chapters, use library       |
| Curator  | Primary  | Authenticated staff; publishes novels and chapters             |
| Admin    | Primary  | Platform administrator; manages users, packages, reports       |
| System   | Secondary| Background jobs, webhook receivers, notification sender        |
| MoMo     | External | Payment gateway; sends payment webhooks                        |
| Google   | External | OAuth identity provider                                        |

### 3.5.2 VP-3.2: Architecturally Significant Use Cases

| ASUC ID | Use Case           | Actor(s)        | Architectural Concern                        | Driver   |
|---------|--------------------|-----------------|----------------------------------------------|----------|
| UC-02   | Login (email/pw)   | Guest→Reader    | Brute-force protection, session management   | AD-02    |
| UC-03   | Google OAuth Login | Guest→Reader    | OAuth CSRF state, account linking            | AD-02    |
| UC-09   | Read Chapter       | Guest, Reader   | Chapter load latency < 1.5 s; VIP gate      | AD-01    |
| UC-17   | Purchase Coins     | Reader, MoMo    | HMAC webhook, atomic DB credit, idempotency  | AD-04    |
| UC-18   | Unlock VIP Chapter | Reader          | Atomic debit + unlock, no cache for balance  | AD-03    |
| UC-10   | Search Novels      | Guest, Reader   | Meilisearch < 500 ms, fallback to DB         | AD-05    |
| UC-07   | Browse Novels      | Guest           | SSR for SEO, filter via URL query params     | AD-06    |
| UC-22   | Curator Publish    | Curator         | Content sanitization, Cloudinary upload      | AD-07    |
| UC-23   | Admin Manage       | Admin           | Audit log on every action, role enforcement  | AD-08    |

### 3.5.3 VP-3.3: ASUC to Architectural Driver Traceability

| ASUC  | Driver | QA Attribute   | Architecture Element                        |
|-------|--------|----------------|---------------------------------------------|
| UC-09 | AD-01  | Performance    | RSC pages, Cloudflare CDN, Cloudinary       |
| UC-02 | AD-02  | Security       | Better Auth rate-limiter, bcrypt, httpOnly  |
| UC-18 | AD-03  | Integrity      | Drizzle `db.transaction()`, no Redis cache  |
| UC-17 | AD-04  | Reliability    | Idempotency key, HMAC verification, tx      |
| UC-10 | AD-05  | Performance    | Meilisearch, fallback query in search module|
| UC-07 | AD-06  | SEO            | Next.js `generateMetadata`, canonical URLs  |
| UC-22 | AD-07  | Security       | DOMPurify sanitize, Cloudinary upload       |
| UC-23 | AD-08  | Auditability   | audit_logs table, admin module middleware   |

\pagebreak

# 4. Module View (Logical View)

## 4.1 View Description

The Module View describes the static code organization of NovelHub — how source code is divided into layers, modules, and packages, and what the allowed dependency directions are.

## 4.2 View Packet Overview

| Packet | Content                                          |
|--------|--------------------------------------------------|
| VP-4.1 | Layered Architecture diagram                     |
| VP-4.2 | Module Boundaries & Schema Ownership diagram     |
| VP-4.3 | Element Catalog                                  |
| VP-4.4 | Interface Contracts (key service functions)      |
| VP-4.5 | Dependency Constraints                           |

## 4.3 Architecture Background

The layered architecture was chosen to:

- Prevent presentation logic from bypassing module services to directly query the DB
- Allow each module to be replaced without touching pages
- Enforce a single path for DB access through `src/lib/db.ts` so connection pooling is consistent

## 4.4 Variability Mechanisms

- New feature modules can be added under `src/modules/` without modifying existing modules
- The DB provider can be swapped (Neon → PlanetScale) by replacing `src/lib/db.ts`
- Auth provider can be swapped by replacing `src/lib/auth.ts` and `src/lib/auth-client.ts`

## 4.5 View Packets

### 4.5.1 VP-4.1: Layered Architecture

![Figure 1: NovelHub Layered Architecture](figures/sad-01-layers.png){ width=6in }

| Layer          | Source Path          | Responsibility                                            |
|----------------|----------------------|-----------------------------------------------------------|
| Presentation   | `src/app/`           | Route segments, layouts, RSC pages, client components     |
| Application    | `src/modules/`       | Feature logic; owns its DB tables; exports service fns    |
| Infrastructure | `src/lib/`           | DB client, auth config, shared utilities (no business logic) |
| Data           | External services    | Neon, Redis, Meilisearch, Cloudinary, MoMo                |

**Layer rule**: Dependencies flow downward only. Presentation → Application → Infrastructure → Data.

### 4.5.2 VP-4.2: Module Boundaries & Schema Ownership

![Figure 2: Module Boundaries & Schema Ownership](figures/sad-02-modules.png){ width=6in }

| Module            | DB Tables Owned                                                 | Key Exports                                     |
|-------------------|-----------------------------------------------------------------|-------------------------------------------------|
| `content`         | novels, chapters, genres, tags, novel_genres, novel_tags        | `getNovel()`, `getChapter()`, `listNovels()`    |
| `reader`          | reading_progress, bookmarks, library_entries, novel_follows, user_follows | `getProgress()`, `upsertProgress()`, `toggleLibrary()` |
| `monetization`    | coin_packages, payments, coin_transactions, chapter_unlocks, subscriptions | `getCoinBalance()`, `unlockChapter()`, `initPayment()`, `handleWebhook()` |
| `community`       | comments, comment_votes, reviews, review_votes, reports         | `listComments()`, `createReview()`, `reportContent()` |
| `search`          | (reads content tables; owns no tables)                          | `searchNovels()`, `indexNovel()`               |
| `notifications`   | notifications                                                   | `sendNotification()`, `listNotifications()`    |
| `admin`           | audit_logs (writes); reads all others                           | `listUsers()`, `auditLog()`, `suspendUser()`   |

### 4.5.3 VP-4.3: Element Catalog

| Element                            | Type      | Responsibility                                                |
|------------------------------------|-----------|---------------------------------------------------------------|
| `app/(auth)/sign-in/page`          | RSC Page  | Renders sign-in form; delegates to Better Auth client         |
| `app/novels/[slug]/page`           | RSC Page  | Server-renders novel detail with chapters                     |
| `app/novels/[slug]/chapters/[n]/page` | RSC Page | Loads chapter; calls monetization to check VIP access      |
| `app/api/auth/[...all]`            | API Route | Better Auth HTTP handler; all auth endpoints                  |
| `app/api/payments/momo/webhook`    | API Route | MoMo webhook receiver; calls monetization.handleWebhook()    |
| `src/modules/content/`             | Module    | Novel and chapter CRUD, Cloudinary uploads                    |
| `src/modules/monetization/`        | Module    | Coin balance, chapter unlock, payment processing              |
| `src/modules/reader/`              | Module    | Reading progress, library, follows                            |
| `src/modules/search/`              | Module    | Meilisearch queries, index management, fallback DB search     |
| `src/lib/db.ts`                    | Infra     | Neon serverless client + Drizzle ORM singleton               |
| `src/lib/auth.ts`                  | Infra     | Better Auth server configuration (providers, session config)  |
| `src/middleware.ts`                | Infra     | Edge middleware: session check, role-based route protection   |
| `src/db/schema/`                   | Schema    | 24 Drizzle table definitions split by domain                  |

### 4.5.4 VP-4.4: Key Interface Contracts

**`content.getChapter(slug: string, number: number): Promise<Chapter | null>`**

| Field       | Detail                                                   |
|-------------|----------------------------------------------------------|
| Input       | Novel slug, chapter number                               |
| Output      | Chapter (id, title, content, isVip, publishedAt) or null |
| Side-effect | None — pure read                                         |
| Error       | Returns `null` if not found; throws on DB error          |

**`monetization.unlockChapter(userId: string, chapterId: string): Promise<UnlockResult>`**

| Field       | Detail                                                   |
|-------------|----------------------------------------------------------|
| Input       | userId (text, Better Auth ID), chapterId (uuid)          |
| Output      | `{ success: true }` or `{ success: false, reason: 'insufficient_coins' | 'already_unlocked' }` |
| Side-effect | DB transaction: debit coin_balance, insert chapter_unlocks, insert coin_transactions |
| Error       | Throws on transaction failure                            |

**`monetization.handleWebhook(payload: MoMoWebhookPayload): Promise<void>`**

| Field       | Detail                                                   |
|-------------|----------------------------------------------------------|
| Input       | Full MoMo webhook payload including HMAC signature       |
| Output      | void                                                     |
| Side-effect | Verifies HMAC; updates payment status; credits coins; writes coin_transactions |
| Idempotency | Checks `payments.status` before processing; returns early if already SUCCESS |
| Error       | Throws on invalid signature (caller returns 400)         |

**`search.searchNovels(query: string, filters: SearchFilters): Promise<SearchResult[]>`**

| Field       | Detail                                                    |
|-------------|-----------------------------------------------------------|
| Input       | Query string; optional genre/status filters               |
| Output      | Array of results (id, title, slug, coverUrl, score)       |
| Fallback    | If Meilisearch > 400 ms, falls back to Drizzle `ilike`   |
| Error       | Never throws to caller — returns empty array on failure   |

### 4.5.5 VP-4.5: Dependency Constraints

| Constraint | Rule                                                                 | Violation Impact        |
|------------|----------------------------------------------------------------------|-------------------------|
| DC-01      | Presentation layer must not import `src/db/schema/*` directly        | Bypasses module access  |
| DC-02      | Modules must not import from other modules                           | Creates hidden coupling |
| DC-03      | `src/lib/` must not contain business logic                           | Pollutes shared layer   |
| DC-04      | All DB writes involving coin_balance must use `db.transaction()`     | Data integrity risk     |
| DC-05      | `coin_balance` must not be cached in Redis or any in-memory store    | Integrity violation     |

\pagebreak

# 5. Component-and-Connector View

## 5.1 View Description

The C&C View describes the runtime topology of NovelHub — what processes/services exist at runtime, how they communicate, and the protocols used.

## 5.2 View Packet Overview

| Packet | Content               |
|--------|-----------------------|
| VP-5.1 | C&C Diagram           |
| VP-5.2 | Connector Catalog     |
| VP-5.3 | Request Flow Narratives |

## 5.3 Architecture Background

Next.js App Router merges what would traditionally be separate client/server processes into a single deployment unit. React Server Components run on the server; client components hydrate in the browser. API routes are lightweight serverless functions co-deployed with the app. The C&C boundary is logical (RSC vs. client, API route vs. page) rather than process-level.

## 5.4 Variability Mechanisms

- In development, `pnpm dev` runs a single Node.js process on port 3000.
- In production, Vercel splits the app into edge middleware, serverless functions, and static assets — the C&C topology changes but the logical connectors remain the same.
- Meilisearch can be replaced by PostgreSQL full-text search without changing the interface (search module's fallback is already implemented).

## 5.5 View Packets

### 5.5.1 VP-5.1: C&C Diagram

![Figure 3: Component-and-Connector Runtime View](figures/sad-03-cnc.png){ width=6in }

### 5.5.2 VP-5.2: Connector Catalog

| Conn ID | Source                 | Target               | Protocol           | Sync  | Notes                              |
|---------|------------------------|----------------------|--------------------|-------|------------------------------------|
| CN-01   | Browser                | Vercel Edge          | HTTPS/TLS 1.3      | Sync  | All user-facing HTTP traffic       |
| CN-02   | Vercel Middleware       | Serverless Functions | Internal Vercel    | Sync  | Auth check before every request    |
| CN-03   | Next.js App            | Neon PostgreSQL      | Neon HTTP over TLS | Sync  | Drizzle ORM queries                |
| CN-04   | Better Auth            | Upstash Redis        | RESP over TLS      | Sync  | Session token lookup/storage       |
| CN-05   | Next.js App            | Meilisearch Cloud    | HTTPS REST         | Sync  | Search queries; 500 ms timeout     |
| CN-06   | Next.js App            | Cloudinary           | HTTPS REST         | Async | Image upload (curator CMS)         |
| CN-07   | Next.js App            | MoMo Gateway         | HTTPS REST         | Sync  | Payment initiation                 |
| CN-08   | MoMo Gateway           | Next.js API Route    | HTTPS POST         | Async | Webhook delivery after payment     |
| CN-09   | Next.js App            | Google OAuth         | HTTPS + redirect   | Sync  | OAuth 2.0 PKCE flow                |

**Security properties:**

| Conn  | Authentication           | Integrity        | Confidentiality |
|-------|--------------------------|------------------|-----------------|
| CN-03 | Neon connection string   | TLS              | TLS             |
| CN-04 | Upstash token in env var | TLS              | TLS             |
| CN-07 | MoMo API key + HMAC      | HMAC-SHA256      | TLS             |
| CN-08 | HMAC-SHA256 signature    | HMAC-SHA256      | TLS             |

### 5.5.3 VP-5.3: Request Flow Narratives

**Flow F-01: Guest browses novel list**

1. Browser → Vercel Edge: `GET /novels?genre=xuanhuan&status=ONGOING`
2. Middleware: session absent → proceeds as guest (no redirect)
3. Serverless: `app/novels/page.tsx` RSC executes on server
4. RSC calls `content.listNovels({ genre, status, page })` via CN-03
5. RSC renders HTML with Open Graph meta + novel grid
6. HTML returned to browser; no hydration for static grid (< 10 KB JS)
7. Browser caches static assets via Cloudflare CDN (CN-01)

**Flow F-02: Reader opens a VIP chapter**

1. Browser → Vercel Edge: `GET /novels/slug/chapters/42` (with session cookie)
2. Middleware: validates session token via Redis (CN-04); role = Reader → forward
3. Serverless RSC: calls `content.getChapter(slug, 42)` → chapter is `isVip: true`
4. RSC calls `monetization.checkAccess(userId, chapterId)`: no subscription, no existing unlock → returns `{ access: false }`
5. RSC renders chapter page with VIP lock overlay (no content)
6. User clicks "Mở khóa" → client POST `/api/chapters/{id}/unlock`
7. API route calls `monetization.unlockChapter(userId, chapterId)` (atomic DB transaction)
8. Response `{ success: true }` → client router.refresh() → page re-fetches with content

**Flow F-03: MoMo payment webhook**

1. Reader selects coin package → Browser POST `/api/payments/momo/create`
2. Function calls `monetization.initPayment(userId, packageId)` → creates PENDING record, calls MoMo API
3. MoMo returns `payUrl`; function redirects browser to MoMo checkout
4. After payment, MoMo POSTs to `/api/payments/momo/webhook`
5. Function calls `monetization.handleWebhook(payload)`:
   - Verifies HMAC-SHA256 against `MOMO_SECRET`
   - Checks `payments` for `status = 'PENDING'` (idempotency guard)
   - Atomic transaction: update payment, credit coins, write ledger
6. Function returns 200 to MoMo; user sees "Nạp xu thành công" notification

\pagebreak

# 6. Deployment View

## 6.1 View Description

The Deployment View maps software components to infrastructure nodes. NovelHub has two deployment configurations: V1 (development/MVP on free tiers) and V2 (production with paid tiers and scaling).

## 6.2 View Packet Overview

| Packet  | Content                              |
|---------|--------------------------------------|
| VP-6.1  | Deployment V1.0 — Vercel Hobby       |
| VP-6.2  | Deployment V2.0 — Production Scaling |

## 6.3 Architecture Background

The serverless deployment model eliminates server management for a solo team. Neon PostgreSQL uses a serverless HTTP driver that works within Vercel's function constraints (no persistent TCP connections). Each request opens a connection through Neon's connection pooler.

**Deployment constraint**: On Vercel Hobby, functions time out after 10 seconds. All webhook handlers must complete within this window.

## 6.4 Variability Mechanisms

- Scaling from V1 to V2 requires only environment variable changes and a Vercel plan upgrade; no code changes.
- Self-hosted Meilisearch can replace Meilisearch Cloud by changing `MEILISEARCH_HOST` env var.

## 6.5 View Packets

### 6.5.1 VP-6.1: Deployment V1.0 — Vercel Hobby

![Figure 4: Deployment View V1.0 — Vercel Hobby](figures/sad-04-deploy-v1.png){ width=6in }

**Port and service mapping:**

| Service         | Endpoint                       | Protocol | Auth Method         |
|-----------------|--------------------------------|----------|---------------------|
| Next.js App     | `*.vercel.app` / custom domain | HTTPS    | Session cookie       |
| Neon PostgreSQL | `*.neon.tech:5432`             | TCP/TLS  | Connection string    |
| Upstash Redis   | `*.upstash.io:6379`            | RESP/TLS | Upstash token        |
| Meilisearch     | `*.meilisearch.io:443`         | HTTPS    | API key              |
| Cloudinary      | `api.cloudinary.com`           | HTTPS    | API key + secret     |
| MoMo Sandbox    | `test-payment.momo.vn`         | HTTPS    | API key + secret key |

**Constraints V1:**

- Max function execution: 10 s (Hobby limit)
- Max function bundle: 50 MB
- No real payments (sandbox only)
- 100 Vercel deployments/day

### 6.5.2 VP-6.2: Deployment V2.0 — Production Scaling

![Figure 5: Deployment View V2.0 — Production](figures/sad-05-deploy-v2.png){ width=6in }

**Scaling topology:**

| Concern          | V1 Approach              | V2 Approach                                    |
|------------------|--------------------------|------------------------------------------------|
| DB connections   | Neon HTTP (stateless)    | Neon pooler (PgBouncer) for high concurrency   |
| Read scalability | Single Neon branch       | Neon read replica for browse/search queries    |
| Function timeout | 10 s (Hobby)             | 60 s (Pro)                                     |
| CDN              | Vercel Edge (static)     | Cloudflare full-proxy (HTML + static)          |
| Payments         | MoMo Sandbox             | MoMo Production + VNPay Production             |
| Search           | Meilisearch Cloud Free   | Meilisearch Cloud Pro or self-hosted           |
| Monitoring       | Vercel Analytics         | Sentry + Grafana + Vercel Analytics            |

**Trigger for V1→V2 migration:** > 500 DAU, OR payment go-live decision, OR Neon free tier (0.5 GB) exhausted.

\pagebreak

# 7. Behavior View

## 7.1 View Description

The Behavior View shows runtime interaction between architectural elements for six architecturally significant scenarios. Each sequence diagram demonstrates how elements from the Module View, C&C View, and Deployment View collaborate.

## 7.2 View Packet Overview

| Packet | Scenario                   | ASUC  | Drivers      |
|--------|----------------------------|-------|--------------|
| VP-7.1 | Email/Password Login       | UC-02 | AD-02        |
| VP-7.2 | VIP Chapter Unlock         | UC-18 | AD-03        |
| VP-7.3 | MoMo Payment Webhook       | UC-17 | AD-04        |
| VP-7.4 | Read Free Chapter          | UC-09 | AD-01, AD-06 |
| VP-7.5 | Curator Publishes Chapter  | UC-22 | AD-07        |
| VP-7.6 | Admin Moderates Content    | UC-23 | AD-08        |

## 7.3 View Packets

### 7.3.1 VP-7.1: Email/Password Login

![Figure 6: Sequence — Email/Password Login](figures/sad-06-seq-login.png){ width=6in }

**Architectural elements involved:**

| Element             | Role in Scenario                                    |
|---------------------|-----------------------------------------------------|
| Next.js API Route   | Receives POST `/api/auth/sign-in`                   |
| Better Auth Handler | Validates credentials, manages session              |
| Neon PostgreSQL     | Stores users (hashed_password, failed_attempts)     |
| Upstash Redis       | Stores session token with TTL                       |

**QA requirements demonstrated:**

- **Brute-force protection**: `failed_attempts` counter incremented per failure; lock triggered at N=5 (AD-02)
- **Secure session**: httpOnly cookie prevents JS access; Redis TTL enforces expiry
- **Generic error message**: same response text regardless of which field is wrong

### 7.3.2 VP-7.2: VIP Chapter Unlock

![Figure 7: Sequence — VIP Chapter Unlock](figures/sad-07-seq-vip.png){ width=6in }

**Architectural elements involved:**

| Element             | Role in Scenario                                      |
|---------------------|-------------------------------------------------------|
| Next.js API Route   | Validates session; calls monetization module          |
| monetization module | Orchestrates balance check and DB transaction         |
| Neon PostgreSQL     | Executes atomic transaction (3 writes)                |

**QA requirements demonstrated:**

- **Atomic operation**: all three writes (user balance, chapter_unlocks, coin_transactions) succeed or all roll back (AD-03)
- **No cache**: `SELECT FOR UPDATE` from DB ensures current balance (DR-04)
- **Idempotency**: `chapter_unlocks` unique constraint prevents double unlock

### 7.3.3 VP-7.3: MoMo Payment Webhook

![Figure 8: Sequence — MoMo Payment Webhook](figures/sad-08-seq-payment.png){ width=6in }

**Architectural elements involved:**

| Element             | Role in Scenario                                      |
|---------------------|-------------------------------------------------------|
| MoMo Gateway        | External actor; sends webhook after payment           |
| Next.js API Route   | Receives POST webhook                                 |
| monetization module | Verifies HMAC, checks idempotency, executes credit    |
| Neon PostgreSQL     | Atomic transaction: payment status + coin credit      |

**QA requirements demonstrated:**

- **HMAC-SHA256 verification** before any DB operation (AD-04, DR-03)
- **Idempotency**: `payments.status` check prevents double-processing
- **Atomicity**: payment status update and coin credit in single transaction

### 7.3.4 VP-7.4: Read Free Chapter

![Figure 9: Sequence — Read Free Chapter](figures/sad-09-seq-read-free.png){ width=6in }

**Architectural elements involved:**

| Element              | Role in Scenario                                                    |
|----------------------|---------------------------------------------------------------------|
| Cloudflare Edge CDN  | Serves cached HTML to repeat visitors; on cache miss forwards to origin |
| Next.js App Router   | Middleware allows guest access; RSC renders full chapter HTML        |
| content module       | `getChapter()` — queries chapter record from DB                     |
| reader module        | `upsertProgress()` — updates reading position for authenticated users |
| Neon PostgreSQL      | Source of truth for chapter content and reading_progress            |

**QA requirements demonstrated:**

- **Cache-hit path** (< 50 ms): Cloudflare edge serves cached HTML without hitting origin (T-02, AD-01)
- **Guest access**: Middleware passes unauthenticated requests to free chapter pages without redirect — enabling SEO crawl
- **SSR + metadata**: RSC generates `og:title`, `canonical` URL for every response (T-11, AD-06)
- **Progress tracking** is conditional on authentication and does not block the render path

### 7.3.5 VP-7.5: Curator Publishes Chapter

![Figure 10: Sequence — Curator Publishes Chapter](figures/sad-10-seq-curator-publish.png){ width=6in }

**Architectural elements involved:**

| Element              | Role in Scenario                                                    |
|----------------------|---------------------------------------------------------------------|
| Next.js App Router   | Verifies Curator role via middleware; delegates to content module   |
| content module       | Sanitizes content (DOMPurify); orchestrates DB write + side effects |
| Cloudinary           | Stores and optimises cover image; returns CDN-hosted URL            |
| Neon PostgreSQL      | Atomic transaction: chapter insert + novel stats update             |
| search module        | Pushes new chapter document to Meilisearch index after publish      |
| notifications module | Fans out NEW_CHAPTER notification to all novel followers            |
| Meilisearch Cloud    | Asynchronously indexes the chapter for full-text search             |

**QA requirements demonstrated:**

- **Server-side sanitization** (T-12, AD-07): DOMPurify strips `<script>` and `on*` event handlers before any DB write — content stored and served clean for all readers
- **Atomic DB write**: chapter insert + novel stat update in one transaction (T-06)
- **Search index sync**: Meilisearch updated asynchronously after publish (T-09, AD-05)
- **Follower notifications**: all followers receive NEW_CHAPTER event without blocking the Curator's publish response

### 7.3.6 VP-7.6: Admin Moderates Content

![Figure 11: Sequence — Admin Moderates Content](figures/sad-11-seq-admin-moderate.png){ width=6in }

**Architectural elements involved:**

| Element              | Role in Scenario                                                    |
|----------------------|---------------------------------------------------------------------|
| Next.js App Router   | Verifies ADMIN role via middleware before routing action            |
| admin module         | Resolves report, applies visibility change, writes audit log atomically |
| Neon PostgreSQL      | Single transaction: target update + report resolution + audit_logs  |
| search module        | Removes hidden chapter from Meilisearch to prevent search discovery |
| Meilisearch Cloud    | Asynchronously de-indexes hidden content                            |

**QA requirements demonstrated:**

- **Role enforcement** (middleware): only the ADMIN role reaches this handler; any other role receives 403 (AD-08)
- **Atomic audit log** (T-13, AD-D-09): `audit_logs` INSERT is in the same transaction as the target update — either both commit or neither does, ensuring complete audit trail
- **Public visibility propagation**: hidden chapters are removed from Meilisearch within seconds, preventing discovery via search even if cached page still exists

\pagebreak

# 8. View Consistency & Cross-View Traceability

## 8.1 Element Traceability Matrix

| Element                        | Module View | C&C View       | Deployment  | Behavior               |
|--------------------------------|-------------|----------------|-------------|------------------------|
| Next.js App Router             | §4 Layer 1  | CN-01–09       | VP-6.1, 6.2 | VP-7.1–7.6             |
| `src/modules/content/`         | VP-4.2      | Flow F-01      | serverless  | VP-7.4, VP-7.5         |
| `src/modules/monetization/`    | VP-4.2      | F-02, F-03     | serverless  | VP-7.2, VP-7.3         |
| `src/modules/reader/`          | VP-4.2      | Flow F-02      | serverless  | VP-7.4                 |
| `src/modules/search/`          | VP-4.2      | CN-05          | serverless  | VP-7.5, VP-7.6         |
| `src/modules/notifications/`   | VP-4.2      | —              | serverless  | VP-7.5                 |
| `src/modules/admin/`           | VP-4.2      | —              | serverless  | VP-7.6                 |
| `src/lib/db.ts` (Drizzle)      | VP-4.3      | CN-03          | VP-6.1, 6.2 | VP-7.2, VP-7.3         |
| `src/lib/auth.ts` (Better Auth)| VP-4.3      | CN-04          | VP-6.1      | VP-7.1                 |
| `src/middleware.ts`            | VP-4.3      | CN-02          | Edge runtime| VP-7.1, VP-7.5, VP-7.6 |
| Neon PostgreSQL                | Data Layer  | CN-03          | VP-6.1, 6.2 | VP-7.1–7.6             |
| Upstash Redis                  | Data Layer  | CN-04          | VP-6.1, 6.2 | VP-7.1                 |
| Meilisearch Cloud              | Data Layer  | CN-05          | VP-6.1, 6.2 | VP-7.5, VP-7.6         |
| Cloudinary                     | Data Layer  | CN-06          | VP-6.1      | VP-7.5                 |
| MoMo Gateway                   | Data Layer  | CN-07, 08      | VP-6.1, 6.2 | VP-7.3                 |

## 8.2 Cross-View Consistency Checks

| Check | Claim                                                                | Status  |
|-------|----------------------------------------------------------------------|---------|
| CC-01 | All modules in Module View appear as components in C&C View          | PASS    |
| CC-02 | All C&C components are deployed to nodes in Deployment View          | PASS    |
| CC-03 | All Behavior View sequences use elements defined in C&C View         | PASS    |
| CC-04 | All ASUCs in Use Case View have at least one Behavior or narrative    | PASS — VP-7.4 covers UC-09 (read), VP-7.5 covers UC-22 (curator publish), VP-7.6 covers UC-23 (admin); UC-07/UC-10 have prose narratives in §5.5.3 |
| CC-05 | All connectors in C&C View map to a protocol in Deployment View      | PASS    |
| CC-06 | Interface contracts in Module View are consistent with C&C flows      | PASS    |
| CC-07 | All AD drivers in §9 are covered by at least one tactic in §10       | PASS    |
| CC-08 | All ASUCs in §3 are mapped to requirements in §13                    | PASS    |

## 8.3 Driver Coverage Check

| Driver | QA Attribute   | Tactic(s)        | Decision     | Behavior View | Deployment |
|--------|----------------|------------------|--------------|---------------|------------|
| AD-01  | Performance    | T-01, T-02, T-03 | AD-D-01      | —             | V1, V2     |
| AD-02  | Security       | T-04, T-05       | AD-D-05      | VP-7.1        | V1, V2     |
| AD-03  | Integrity      | T-06, T-07       | AD-D-03      | VP-7.2        | V1, V2     |
| AD-04  | Reliability    | T-06, T-08       | AD-D-06      | VP-7.3        | V1, V2     |
| AD-05  | Performance    | T-09, T-10       | AD-D-07      | —             | V1, V2     |
| AD-06  | SEO            | T-11             | AD-D-01      | —             | V1, V2     |
| AD-07  | Security       | T-12             | AD-D-08      | VP-7.5        | V1         |
| AD-08  | Auditability   | T-13             | AD-D-09      | VP-7.6        | V1, V2     |

\pagebreak

# 9. Quality Attribute Scenarios (Architectural Drivers)

Each architectural driver follows the IEEE QA scenario structure.

## AD-01: Chapter Read Latency

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Reader on 4G mobile connection                                           |
| **Stimulus**         | Requests a free chapter page (`/novels/{slug}/chapters/{n}`)             |
| **Artifact**         | Chapter RSC page + Cloudinary cover image                                |
| **Environment**      | Normal load (< 500 concurrent readers)                                   |
| **Response**         | Server renders HTML; CDN serves static assets; page is readable          |
| **Response Measure** | Time-to-Interactive < 1.5 s (P95); LCP < 2.5 s                         |
| **Tactics Applied**  | T-01 (RSC), T-02 (CDN), T-03 (image optimization)                       |

## AD-02: Brute-Force Login Protection

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Attacker with a credential list                                          |
| **Stimulus**         | 10 POST requests to `/api/auth/sign-in` with wrong password in 2 min    |
| **Artifact**         | Better Auth handler + users table                                        |
| **Environment**      | Any — development or production                                          |
| **Response**         | After 5th failure: account locked 15 min; further attempts rejected      |
| **Response Measure** | Lock activated at exactly N=5 failures; lock duration = 900 s           |
| **Tactics Applied**  | T-04 (failed_attempts counter), T-05 (httpOnly cookie)                  |

## AD-03: Coin Balance Integrity

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Reader with 1 coin remaining                                             |
| **Stimulus**         | Two simultaneous POST requests to unlock different VIP chapters          |
| **Artifact**         | monetization module + Neon PostgreSQL                                    |
| **Environment**      | Concurrent requests (race condition scenario)                            |
| **Response**         | Exactly one unlock succeeds; other returns 402; balance never < 0       |
| **Response Measure** | coin_balance ≥ 0 after any concurrent operation; exactly one chapter_unlocks record |
| **Tactics Applied**  | T-06 (atomic transaction), T-07 (SELECT FOR UPDATE row lock)            |

## AD-04: MoMo Webhook Idempotency

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | MoMo Gateway                                                             |
| **Stimulus**         | Same webhook delivered twice (MoMo retry after timeout)                  |
| **Artifact**         | `/api/payments/momo/webhook` + monetization module                       |
| **Environment**      | Production; second webhook within 5 minutes of first                     |
| **Response**         | Second delivery silently ignored; coins credited exactly once            |
| **Response Measure** | `coin_transactions` contains exactly one entry per orderId              |
| **Tactics Applied**  | T-06 (atomic transaction), T-08 (idempotency key check)                 |

## AD-05: Search Response Time

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | User typing in search box                                                |
| **Stimulus**         | GET `/api/search?q=thap+xich` (1–3 word query with possible typos)      |
| **Artifact**         | search module → Meilisearch Cloud                                        |
| **Environment**      | Meilisearch healthy; index contains ≤ 5,000 novels                      |
| **Response**         | Relevant results returned with typo tolerance                            |
| **Response Measure** | P95 latency < 500 ms; typo tolerance ≥ 1 character edit distance        |
| **Tactics Applied**  | T-09 (Meilisearch dedicated service), T-10 (DB fallback)                |

## AD-06: Search Engine Indexability

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Googlebot crawler                                                        |
| **Stimulus**         | Crawls `/novels/{slug}` and `/novels?genre=xuanhuan`                     |
| **Artifact**         | Novel detail page + browse page (RSC)                                    |
| **Environment**      | Normal crawl schedule                                                    |
| **Response**         | Full HTML with title, description, og:image, canonical URL in response   |
| **Response Measure** | Zero "Crawled - currently not indexed" errors for novel pages in Google Search Console |
| **Tactics Applied**  | T-11 (Next.js generateMetadata, canonical tag)                          |

## AD-07: Content Security (XSS Prevention)

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Curator submitting chapter content via CMS                               |
| **Stimulus**         | Chapter content contains `<script>alert(1)</script>` or `<img onerror>` |
| **Artifact**         | content module → chapters table → chapter reader page                    |
| **Environment**      | Curator with valid session                                               |
| **Response**         | Script tags stripped; content stored and displayed as safe HTML          |
| **Response Measure** | Zero XSS vectors in stored chapter content; sanitization runs on every save |
| **Tactics Applied**  | T-12 (server-side sanitization before DB write)                         |

## AD-08: Admin Action Auditability

| Field                | Detail                                                                   |
|----------------------|--------------------------------------------------------------------------|
| **Source**           | Admin suspending a user account                                          |
| **Stimulus**         | Admin POST `/api/admin/users/{id}/suspend`                               |
| **Artifact**         | admin module + audit_logs table                                          |
| **Environment**      | Normal operation                                                         |
| **Response**         | User suspended; audit record written atomically with action              |
| **Response Measure** | 100% of admin mutations have a corresponding audit_logs entry with actor_id, action, timestamp |
| **Tactics Applied**  | T-13 (audit log in same transaction as action)                          |

\pagebreak

# 10. Architectural Tactics

## 10.0 Quality Attribute Implementation Summary

This is the concise presentation form of the tactic registry. Each line states which quality attribute is protected and which architectural tactic implements it.

| Quality Attribute | Implemented Tactics In NovelHub |
|-------------------|---------------------------------|
| Performance | Chapter reading uses RSC pages, CDN caching, and Cloudinary image optimization to meet the mobile reading target; search uses Meilisearch for the < 500 ms path. |
| Security | Better Auth sessions, httpOnly cookies, role checks, server-side VIP content gating, server-side sanitization, and HMAC-verified MoMo webhooks protect accounts, premium content, and payment callbacks. |
| Reliability | Atomic Drizzle transactions, row locking on `users.coin_balance`, ledger writes, and idempotent webhook processing prevent partial unlocks, negative balances, and duplicate coin credits. |
| Availability | CDN stale serving keeps cached free chapters readable during origin issues; search falls back to a Drizzle `ilike` database query when Meilisearch is down. |
| Modifiability | The 4-layer Next.js full-stack monolith keeps presentation, feature modules, infrastructure, and data separate; search and payment providers are isolated behind module service functions. |

## 10.1 Tactic Registry

| ID   | Tactic Name                 | Implementation in NovelHub                                                   | Addresses   |
|------|-----------------------------|------------------------------------------------------------------------------|-------------|
| T-01 | Server Components (RSC)     | Novel, chapter, browse pages use async RSC — zero client JS hydration        | AD-01       |
| T-02 | Edge CDN Caching            | Static assets and ISR pages served from Cloudflare/Vercel edge PoPs          | AD-01       |
| T-03 | Image Optimisation          | Cloudinary auto-serves WebP/AVIF; Next.js `<Image>` for lazy loading         | AD-01       |
| T-04 | Login Attempt Counter       | `users.failed_attempts` column; incremented per failure; reset on success    | AD-02       |
| T-05 | HttpOnly Session Cookie     | Better Auth sets `httpOnly, Secure, SameSite=Lax` — inaccessible to JS       | AD-02       |
| T-06 | Database Transactions       | All multi-write operations use Drizzle `db.transaction()`                    | AD-03, AD-04|
| T-07 | Pessimistic Row Lock        | `SELECT ... FOR UPDATE` on `users.coin_balance` prevents concurrent oversend | AD-03       |
| T-08 | Idempotency Key             | Check `payments.status` before processing; ignore if already SUCCESS          | AD-04       |
| T-09 | Dedicated Search Service    | Meilisearch Cloud with pre-built index; avoids LIKE query load on Neon        | AD-05       |
| T-10 | Search Fallback             | If Meilisearch > 400 ms or error → Drizzle `ilike` query                    | AD-05       |
| T-11 | Server-Side Metadata        | Next.js `generateMetadata()` per page; canonical tag in `<head>`              | AD-06       |
| T-12 | Server-Side Sanitization    | DOMPurify (server) strips scripts/event handlers before chapter content saved | AD-07      |
| T-13 | Audit Log on Admin Writes   | Every admin mutation appends to `audit_logs` in same DB transaction           | AD-08       |

## 10.2 Cross-Impact Matrix

| Tactic | Primary QA       | Secondary Benefit                   | Negative Cross-Impact                               |
|--------|------------------|-------------------------------------|-----------------------------------------------------|
| T-01   | Performance      | Reduced JS bundle; better SEO       | Complex to mix RSC + client state in same route     |
| T-02   | Performance      | Reduced origin load                 | CDN may serve stale content; requires cache-bust    |
| T-03   | Performance      | Reduced bandwidth cost              | Cloudinary egress cost at scale                     |
| T-04   | Security         | Deters credential stuffing          | Legitimate users locked out (support burden)        |
| T-05   | Security         | Prevents XSS session theft          | No negative impact                                  |
| T-06   | Integrity        | Prevents partial write states       | DB transaction overhead (~1 ms); acceptable         |
| T-07   | Integrity        | Prevents race-condition overspend   | Row lock adds contention if many concurrent unlocks |
| T-08   | Reliability      | Correct ledger under retries        | Requires orderId stored before payment redirect     |
| T-09   | Performance      | Decouples search from OLTP DB       | Additional service to monitor; eventual consistency |
| T-10   | Reliability      | Graceful degradation of search      | Fallback query is slower; must have 500 ms budget   |
| T-11   | SEO              | Social share previews               | Adds per-page SSR overhead (marginal)               |
| T-12   | Security         | Prevents stored XSS                 | May strip legitimate formatting (configure carefully)|
| T-13   | Auditability     | Compliance, forensics               | One extra INSERT per admin action                   |

## 10.3 Quality Assurance Traceability

The tactics above are treated as verifiable implementation obligations, not only design notes. A quality attribute is considered covered when its tactic appears in the architecture, is implemented in the named code artifact, and is traced to RTM/API/UI evidence.

| QA Concern | Tactic(s) | Implementation Position | Verification Evidence |
|------------|-----------|-------------------------|-----------------------|
| Fast chapter reading and SEO | T-01, T-02, T-03, T-11 | `src/app/novels/`, `src/app/novels/[slug]/`, `src/app/novels/[slug]/chapters/[number]/`, `src/app/sitemap.ts` | `tests/e2e/reader-ui.spec.ts`, `tests/e2e/novels-ui.spec.ts`, `tests/api/nfr-api.spec.ts`, RTM UC-07 to UC-11 and NFR rows |
| VIP content protection | T-01, T-05, T-06, T-07 | Chapter RSC page calls monetization access checks before rendering content; unlock API routes through `src/modules/monetization/services/unlock.service.ts` | `tests/e2e/reader-ui.spec.ts`, `tests/api/payments-api.spec.ts`, RTM UC-09 and UC-18 |
| Coin balance integrity | T-06, T-07 | `unlockChapter()` performs balance read, debit, unlock insert, and ledger insert inside one transaction; `coin_balance` is never cached | `tests/api/payments-api.spec.ts`, `tests/e2e/payments-ui.spec.ts`, RTM UC-16 to UC-18 |
| Payment correctness | T-06, T-08 | `src/modules/monetization/services/momo.service.ts` verifies webhook state and updates payment, balance, and ledger atomically | `tests/api/payments-api.spec.ts`, `tests/e2e/payments-ui.spec.ts`, RTM UC-17 |
| Search degradation | T-09, T-10 | `src/modules/search/services/search.service.ts` uses Meilisearch first and falls back to Drizzle `ilike` when unavailable | `tests/e2e/novels-ui.spec.ts`, `tests/e2e/public.spec.ts`, RTM UC-10 |
| Curator/admin control | T-04, T-05, T-12, T-13 | `src/middleware.ts`, curator routes, admin module services, and audit log writes guard privileged actions | `tests/e2e/auth-gates.spec.ts`, `tests/e2e/curator-ui.spec.ts`, `tests/e2e/admin-ui.spec.ts`, `tests/api/admin-api.spec.ts`, RTM UC-21 to UC-23 |
| Module modifiability | T-10 plus AD-D-04 | Feature code stays inside `src/modules/*`; callers use exported module functions instead of internal schemas/helpers | `npm run lint`, code review checklist, RTM architecture rows |

\pagebreak

# 11. Architectural Decisions

## AD-D-01: Next.js 16 App Router as Full-Stack Framework

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Use Next.js 16 with App Router for both frontend and backend API routes                       |
| **Drivers**    | G-01 (chapter load speed), G-03 (SEO), G-06 (solo dev), DR-05 (SSR for crawlers), AD-01 (chapter read latency), AD-06 (search engine indexability) |
| **Rationale**  | App Router RSC eliminates client-side hydration for content-heavy pages, satisfying AD-01 (read latency < 1.5 s). API Routes co-deployed with the frontend eliminate a separate backend deployment. The `generateMetadata` API produces correct `og:title`, `og:description`, and canonical URL on every server-rendered response, directly satisfying AD-06 (Search Engine Indexability) via tactic T-11. |
| **Trade-offs** | RSC mental model is harder than traditional SPA; mixing server and client state requires discipline. Accepted because performance and SEO gains outweigh complexity. |
| **Alternatives** | Remix (RSC not native), SvelteKit (smaller ecosystem), Next.js Pages Router (no RSC)       |

## AD-D-02: Drizzle ORM over Prisma

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Use Drizzle ORM with Neon serverless driver                                                   |
| **Drivers**    | G-08 (cold-start < 500 ms), G-06 (SQL transparency for solo dev)                             |
| **Rationale**  | Prisma Query Engine binary adds ~50 MB to bundle and cold-start latency on Vercel serverless. Drizzle is ~300 KB, generates readable SQL, and has a `db.transaction()` API that maps directly to PostgreSQL transactions. |
| **Trade-offs** | Drizzle has less mature migration tooling than Prisma. Mitigated by `drizzle-kit push` for development. |

## AD-D-03: Atomic Coin Transactions — No Cache for Balance

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | All coin_balance changes use `db.transaction()`; coin_balance is NEVER cached                |
| **Drivers**    | DR-02 (atomic unlock), DR-04 (no cache), AD-03                                               |
| **Rationale**  | A stale cached balance could allow a user to unlock more chapters than their balance covers — a direct financial loss. The DB is the single source of truth. Neon HTTP queries are < 10 ms; caching adds risk without meaningful latency savings. |
| **Trade-offs** | Every VIP chapter access requires a DB round-trip. Acceptable because unlock is an infrequent write, not a high-frequency read. |

## AD-D-04: Module Isolation by Convention

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Modules in `src/modules/` must not import from each other; share only through exports        |
| **Drivers**    | DR-07 (module isolation), G-06 (maintainability for solo dev)                               |
| **Rationale**  | Without process-level isolation, module boundaries are enforced by ESLint rules and code review. This prevents the "big ball of mud" monolith pattern and allows each module to be refactored independently. |
| **Trade-offs** | Some duplication of utility functions across modules. Mitigated by `src/lib/utils.ts`. |

## AD-D-05: Better Auth over Custom JWT

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Use Better Auth library for session management and OAuth                                      |
| **Drivers**    | G-04 (secure auth), UC-02, UC-03                                                             |
| **Rationale**  | Custom JWT auth leaves CSRF protection, token rotation, and OAuth state management to the developer. Better Auth implements these correctly by default. The session-in-Redis model is more revocable than stateless JWT. |
| **Trade-offs** | Dependency on a third-party library. Mitigated by Better Auth being MIT-licensed with schema fully visible in `src/db/schema/auth.ts`. |

## AD-D-06: MoMo HMAC-SHA256 Webhook Verification

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | All MoMo webhooks must pass HMAC-SHA256 signature verification before processing             |
| **Drivers**    | DR-03, AD-04, UC-17                                                                          |
| **Rationale**  | Without signature verification, any HTTP client could forge a payment-success webhook and receive free coins. HMAC verification using the MoMo secret key ensures only authentic webhooks are processed. |
| **Trade-offs** | Processing overhead of one HMAC computation per webhook (< 1 ms). No meaningful downside. |

## AD-D-07: Meilisearch for Search with DB Fallback

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Use Meilisearch Cloud for search; fall back to Drizzle `ilike` if unavailable                |
| **Drivers**    | AD-05, UC-10                                                                                 |
| **Rationale**  | Meilisearch provides typo-tolerant, fast full-text search. The fallback ensures search remains functional during Meilisearch outages at the cost of slower, non-typo-tolerant results. |
| **Trade-offs** | Index synchronisation lag (up to 60 s after novel publish). Acceptable for a content platform. |

## AD-D-08: Server-Side Content Sanitization

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Chapter content is sanitized with DOMPurify on the server before DB write                    |
| **Drivers**    | AD-07, UC-22                                                                                 |
| **Rationale**  | Client-side sanitization can be bypassed by an attacker calling the API directly. Server-side sanitization is the authoritative defense. Content stored clean in DB so every reader sees safe HTML without runtime sanitization. |
| **Trade-offs** | Requires `isomorphic-dompurify` in Node.js. Small runtime cost per save. |

## AD-D-09: Audit Log in Same Transaction as Admin Write

| Field          | Detail                                                                                        |
|----------------|-----------------------------------------------------------------------------------------------|
| **Decision**   | Every admin mutation appends a record to `audit_logs` in the same DB transaction             |
| **Drivers**    | AD-08, UC-23                                                                                 |
| **Rationale**  | If the audit log is written in a separate transaction and that transaction fails, the action is recorded but the log is missing. Co-locating the audit write guarantees atomicity: either both exist or neither does. |
| **Trade-offs** | Audit table grows large; requires periodic archiving. Mitigated by a 90-day retention policy. |

## Design Pattern Manifestations

The following GoF and enterprise patterns appear in the implementation. They are listed here for traceability; each pattern is a consequence of an architectural decision or tactic already documented above — not an independent design choice.

| Pattern | Where It Appears | Key File(s) | Architectural Link |
|---------|-----------------|-------------|--------------------|
| **Repository** | Each module exposes named service functions (`getNovel()`, `listChaptersByNovel()`, `unlockChapter()`) that abstract all Drizzle queries; no page or API route imports from `src/db/schema/` directly | `src/modules/content/services/novel.service.ts`, `chapter.service.ts`; `src/modules/monetization/services/unlock.service.ts` | DC-01 (no schema imports from presentation), AD-D-04 (module isolation) |
| **Facade** | Each module's `index.ts` re-exports only its public service functions; internal folder structure and helper functions are not visible to callers | `src/modules/content/index.ts`, `src/modules/monetization/index.ts`, `src/modules/reader/index.ts`, `src/modules/search/index.ts` | DC-02 (no cross-module imports), AD-D-04 |
| **Strategy** | `searchNovels()` selects between two interchangeable search strategies at runtime: Meilisearch (primary, typo-tolerant) and Drizzle `ilike` (fallback, < 1 s) | `src/modules/search/services/search.service.ts` | AD-05, T-09, T-10, AD-D-07 |
| **Middleware / Chain of Responsibility** | `src/middleware.ts` forms a three-stage chain — path classifier → session check → role check — before any handler executes; pages redirect on failure, API routes return 401/403 | `src/middleware.ts` | AD-02 (brute-force protection), AD-08, T-05, AD-D-05 |
| **Observer (Fan-out)** | After a chapter publish commits to DB, `fanOutNewChapterNotification()` is called asynchronously (fire-and-forget) to insert notifications for all novel followers; failure does not roll back the publish | `src/app/api/novels/[id]/chapters/route.ts` (POST), `.../[chapterId]/route.ts` (PATCH); `src/modules/reader/services/notification.service.ts` | ADD §2.3.3 (chapter publish side-effects do not block commit) |
| **Singleton** | `db` (Drizzle + Neon HTTP client) is instantiated once at module load and imported by all service files; no per-request reconnection | `src/lib/db.ts` | DC-06 (Vercel serverless — no persistent TCP), AD-D-02 |
| **Idempotent Receiver** | `completeMomoPayment()` checks `payment.status === 'SUCCESS'` before any write, then uses a conditional `UPDATE WHERE status = 'PENDING'` as a race guard; `unlockChapter()` checks for an existing unlock record before deducting coins | `src/modules/monetization/services/momo.service.ts`, `unlock.service.ts` | AD-04 (webhook idempotency), T-08, AD-D-06 |

\pagebreak

# 12. ADD Iteration Log

## Iteration 1: Foundation — Framework, Database, and Auth (Phase 0)

| Item              | Detail                                                                       |
|-------------------|------------------------------------------------------------------------------|
| **Goal**          | Select core technology stack; establish DB schema; implement auth            |
| **Drivers**       | G-01, G-03, G-04, G-06, DR-01, DR-05                                        |
| **Decisions**     | Next.js 16 App Router (AD-D-01), Neon + Drizzle (AD-D-02), Better Auth (AD-D-05), Module isolation (AD-D-04) |
| **Elements Created** | `src/app/` structure, `src/lib/db.ts`, `src/lib/auth.ts`, `src/middleware.ts`, all 24 DB schema tables, `(auth)` route group |
| **Risks Resolved** | SSR feasibility on Vercel Hobby confirmed; Neon serverless driver tested; Better Auth OAuth tested |

## Iteration 2: Content Module and Reading Experience (Phase 1)

| Item              | Detail                                                                       |
|-------------------|------------------------------------------------------------------------------|
| **Goal**          | Deliver browsable novel library and functional chapter reader                |
| **Drivers**       | AD-01 (read latency), AD-06 (SEO), AD-07 (content security)                 |
| **Decisions**     | RSC for novel/chapter pages (T-01), Cloudinary for images (T-03), content sanitization (AD-D-08), `generateMetadata` (T-11) |
| **Elements Created** | `src/modules/content/`, `src/modules/reader/`, novel browse/detail/reader pages, Cloudinary upload helper |
| **Risks Resolved** | Image load performance acceptable with Cloudinary WebP; RSC rendering verified < 1.5 s on 4G test |

## Iteration 3: Monetization Architecture (Phase 2)

| Item              | Detail                                                                       |
|-------------------|------------------------------------------------------------------------------|
| **Goal**          | Implement coin system, MoMo payment, and VIP chapter gating                 |
| **Drivers**       | AD-03 (coin integrity), AD-04 (webhook idempotency), DR-02, DR-03, DR-04    |
| **Decisions**     | Atomic transactions for all coin operations (AD-D-03), HMAC webhook verification (AD-D-06), no coin_balance cache |
| **Elements Created** | `src/modules/monetization/`, `/api/payments/momo/webhook`, `coin_packages`, `payments`, `coin_transactions`, `chapter_unlocks`, `subscriptions` tables |
| **Risks Resolved** | MoMo Sandbox integration tested; double-webhook idempotency verified; SELECT FOR UPDATE race condition test passed |

## Iteration 4: Community, Search, and Notifications (Phase 3)

| Item              | Detail                                                                       |
|-------------------|------------------------------------------------------------------------------|
| **Goal**          | Add user comments/reviews, full-text search, and follower notifications      |
| **Drivers**       | AD-05 (search latency), AD-08 (auditability), AD-07 (comment XSS)           |
| **Decisions**     | Meilisearch with DB fallback (AD-D-07), audit log on moderation (AD-D-09), XSS sanitization on comments |
| **Elements Created** | `src/modules/search/`, `src/modules/community/`, `src/modules/notifications/`, Meilisearch index sync job, `audit_logs` table |
| **Risks Resolved** | Meilisearch Cloud free tier sufficient for ≤ 5,000 novels; fallback DB query benchmarked at < 800 ms |

\pagebreak

# 13. Requirement-to-Architecture Traceability

| Requirement | Type | Architecture Component(s)                                   | Driver      | Notes                              |
|-------------|------|-------------------------------------------------------------|-------------|------------------------------------|
| UC-01       | Func | Better Auth sign-up endpoint, `auth.ts`                     | —           | Email/password registration        |
| UC-02       | Func | Better Auth sign-in, `failed_attempts`, Redis session       | AD-02       | Brute-force tactic applied         |
| UC-03       | Func | Better Auth Google provider, OAuth callback route           | AD-02       | CSRF state verified                |
| UC-04       | Func | Better Auth sign-out, Redis session delete                  | —           | Server-side session invalidation   |
| UC-05       | Func | `/settings` page, user update API route                     | —           | Char limits enforced in schema     |
| UC-06       | Func | Better Auth password change, session invalidation           | AD-02       | All sessions invalidated on change |
| UC-07       | Func | `content.listNovels()`, `/novels` RSC page                  | AD-06       | URL filter params, SSR             |
| UC-08       | Func | `content.getNovel()`, `/novels/[slug]` RSC page             | AD-01, AD-06| LCP < 2.5 s, canonical URL        |
| UC-09       | Func | `content.getChapter()`, reader page RSC                     | AD-01       | 1.5 s target; VIP gate             |
| UC-10       | Func | `search.searchNovels()`, Meilisearch, DB fallback           | AD-05       | < 500 ms; typo tolerance           |
| UC-11       | Func | `content.listNovels()` with filter params                   | AD-06       | URL-driven filters                 |
| UC-12       | Func | `reader.toggleLibrary()`, library_entries table             | —           | Optimistic UI update               |
| UC-13       | Func | `/library` page, `reader.getLibrary()`                      | —           | Progress bar from reading_progress |
| UC-14       | Func | `reader.upsertProgress()`, reading_progress table           | —           | Upsert on every chapter open       |
| UC-15       | Func | `reader.toggleFollow()`, notifications module               | —           | Notification on new chapter        |
| UC-16       | Func | Header coin balance, `monetization.getCoinBalance()`        | AD-03       | DB read, no cache                  |
| UC-17       | Func | `monetization.initPayment()`, MoMo API, webhook handler     | AD-04       | HMAC verification, idempotency     |
| UC-18       | Func | `monetization.unlockChapter()`, atomic DB transaction       | AD-03       | SELECT FOR UPDATE, T-06, T-07      |
| UC-19       | Func | `monetization.checkSubscription()`, subscriptions table     | AD-03       | Per-request DB check, no cache     |
| UC-20       | Func | `community.createReview()`, reviews table                   | —           | One review per user per novel      |
| UC-21       | Func | `community.createComment()`, XSS sanitization               | AD-07       | T-12 applied on save               |
| UC-22       | Func | `community.reportContent()`, reports table                  | AD-08       | Audit trail for moderation         |
| UC-23       | Func | `admin` module, `audit_logs` table, middleware role check   | AD-08       | T-13; role = ADMIN in MW           |
| NFR-01      | NFR  | RSC pages, Cloudflare CDN (T-01, T-02)                      | AD-01       | < 1.5 s chapter load               |
| NFR-02      | NFR  | `db.transaction()`, SELECT FOR UPDATE (T-06, T-07)          | AD-03       | Coin atomicity                     |
| NFR-03      | NFR  | HMAC verification, idempotency key (T-08)                   | AD-04       | Payment integrity                  |
| NFR-04      | NFR  | generateMetadata, canonical URL (T-11)                      | AD-06       | SEO                                |
| NFR-05      | NFR  | DOMPurify server-side (T-12)                                | AD-07       | XSS prevention                     |
| NFR-06      | NFR  | audit_logs in same transaction (T-13)                       | AD-08       | Auditability                       |

\pagebreak

# 14. References

| ID   | Reference                                                                                |
|------|------------------------------------------------------------------------------------------|
| R-01 | Bass, L., Clements, P., Kazman, R. — *Software Architecture in Practice*, 3rd ed., 2012  |
| R-02 | Clements et al. — *Documenting Software Architectures: Views and Beyond*, 2nd ed., 2010  |
| R-03 | IEEE 1471-2000 — Recommended Practice for Architectural Description of Software-Intensive Systems |
| R-04 | Kruchten, P. — *The 4+1 View Model of Architecture*, IEEE Software, 1995                  |
| R-05 | Rozanski, N., Woods, E. — *Software Systems Architecture*, 2nd ed., 2011                 |
| R-06 | NovelHub SRS v1.0 — `docs/SRS.md`                                                        |
| R-07 | NovelHub User Story v1.0 — `docs/USER-STORY.docx`                                        |
| R-08 | NovelHub Utility Tree v1.0 — `docs/UTILITY-TREE.docx`                                    |
| R-09 | NovelHub ERD v1.0 — `docs/ERD.md`                                                        |
| R-10 | Next.js 16 App Router documentation — https://nextjs.org/docs                            |
| R-11 | Drizzle ORM documentation — https://orm.drizzle.team                                     |
| R-12 | Better Auth documentation — https://better-auth.com                                      |
| R-13 | Meilisearch documentation — https://www.meilisearch.com/docs                             |
| R-14 | MoMo Payment API v2 — https://developers.momo.vn                                         |

\pagebreak

# Appendix A: Glossary

| Term                   | Definition                                                                         |
|------------------------|------------------------------------------------------------------------------------|
| App Router             | Next.js routing system (v13+) based on filesystem conventions under `app/`         |
| Architectural Driver   | A QA scenario that significantly influences architectural decisions                 |
| ASUC                   | Architecturally Significant Use Case                                                |
| Better Auth            | Open-source authentication library for Next.js with session-in-DB/Redis model     |
| C&C View               | Component-and-Connector View — describes runtime topology                          |
| Coin                   | NovelHub virtual currency; 1 coin = 1 VIP chapter unlock; 100 coins = 10,000 VND  |
| Drizzle ORM            | TypeScript-first ORM that generates typed SQL queries; used with Neon              |
| Idempotency key        | An identifier that prevents the same operation from being applied more than once   |
| Neon                   | Serverless PostgreSQL provider used as the primary database for NovelHub           |
| RSC                    | React Server Component — renders on server; sends HTML, no JS hydration            |
| SELECT FOR UPDATE      | PostgreSQL row-level lock; prevents concurrent reads from racing on the same row   |
| Upstash Redis          | Serverless Redis service used for session token storage                            |
| VIP chapter            | A chapter requiring 1 coin or an active Premium subscription to read               |
| Webhook                | HTTP callback sent by MoMo after a payment event to notify NovelHub                |

# Appendix B: Acronyms

| Acronym | Full Form                                             |
|---------|-------------------------------------------------------|
| ADD     | Attribute-Driven Design                               |
| ASUC    | Architecturally Significant Use Case                  |
| C&C     | Component-and-Connector                               |
| CDN     | Content Delivery Network                              |
| CSRF    | Cross-Site Request Forgery                            |
| DAU     | Daily Active Users                                    |
| DR      | Driving Requirement                                   |
| ERD     | Entity-Relationship Diagram                           |
| HMAC    | Hash-based Message Authentication Code               |
| ISR     | Incremental Static Regeneration (Next.js)             |
| LCP     | Largest Contentful Paint (Core Web Vital)             |
| NFR     | Non-Functional Requirement                            |
| ORM     | Object-Relational Mapper                              |
| PoP     | Point of Presence (CDN node)                          |
| QA      | Quality Attribute                                     |
| RSC     | React Server Component                                |
| SAD     | Software Architecture Document                        |
| SSR     | Server-Side Rendering                                 |
| TTL     | Time to Live (cache/session expiry)                   |
| UC      | Use Case                                              |
| VIP     | Very Important Person (premium content tier)          |
| XSS     | Cross-Site Scripting                                  |
