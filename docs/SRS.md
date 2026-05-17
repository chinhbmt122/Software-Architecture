---
title: "SOFTWARE REQUIREMENTS SPECIFICATION"
subtitle: "NovelHub — Vietnamese Novel Reading Platform"
author: "NovelHub Development Team"
date: "17 May 2026"
version: "1.0"
---

\pagebreak

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) document describes the complete functional and non-functional requirements for **NovelHub**, a Vietnamese web novel reading platform. It serves as the authoritative reference for design, development, testing, and deployment activities throughout the project lifecycle.

This document is intended to be a living reference. As the platform evolves through its development phases, this SRS will be updated to reflect approved changes to scope, features, and constraints.

## 1.2 Scope

NovelHub is a web-based platform that provides curated access to translated web novels — primarily Chinese, Korean, and Japanese novels translated into Vietnamese. The platform is consumer-facing and targets Vietnamese readers.

The system encompasses the following capabilities:

- Browsing, searching, and reading published novels and chapters
- User authentication: email/password and Google OAuth
- Reading progress tracking and personal library management
- Community features: reviews and comments on novels
- Monetization: virtual coin purchase via MoMo payment gateway and per-chapter VIP unlock
- Curator tooling: a content management system (CMS) for creating and publishing novels and chapters
- Administrative controls: user management, coin package management, audit logging

Content on the platform is **curated only** — public author submissions are out of scope.

## 1.3 Intended Audiences and Document Organization

| Audience | Relevant Sections |
|---|---|
| Product Owner / Stakeholders | All sections |
| Software Architects | 1, 3, 4 |
| Backend / Frontend Developers | 2, 4 |
| QA / Test Engineers | 2, 5 |
| Security Engineers | 3 |
| Technical Writers / Documentation | 1, 5 |

**Document organization:**

- **Section 1 — Introduction**: Purpose, scope, intended audiences, and reference documents.
- **Section 2 — Functional Requirements**: All system behaviors expressed as use cases, each with actor, trigger, pre/post conditions, activity flow narrative, and business rules.
- **Section 3 — Non-Functional Requirements**: Security and access control matrix, performance targets, availability, and security controls.
- **Section 4 — System Requirements**: Application pages catalogue, technical environment, and deployment constraints.
- **Section 5 — Appendixes**: Glossary of domain terms and a catalogue of all system messages.

## 1.4 References

| # | Title | Version | File Name / Link | Description |
|---|---|---|---|---|
| 1 | Entity Relationship Diagram | 1.0 | `docs/ERD.md` | Database schema with all 24 tables and entity relationships |
| 2 | Software Architecture Document | 1.0 | `docs/SAD.md` | Module boundaries, deployment topology, architectural decisions |
| 3 | UI Design Brief | 1.0 | `docs/UI-BRIEF.md` | Visual design guidelines, color system, and per-page design prompts |
| 4 | Better Auth Documentation | — | https://www.better-auth.com/docs | Authentication library — session management, OAuth, email/password |
| 5 | Next.js App Router Documentation | 16.x | https://nextjs.org/docs | Framework reference for routing, Server Components, API Routes |
| 6 | Drizzle ORM Documentation | — | https://orm.drizzle.team/docs | ORM query builder and schema definition reference |
| 7 | MoMo Payment API v2 | 2.0 | Internal / MoMo Developer Portal | Payment gateway integration specification |
| 8 | Meilisearch Documentation | — | https://www.meilisearch.com/docs | Full-text search engine configuration and query reference |
| 9 | Neon PostgreSQL Documentation | — | https://neon.tech/docs | Serverless PostgreSQL provider reference |
| 10 | Cloudinary Documentation | — | https://cloudinary.com/documentation | Image upload and transformation CDN reference |

\pagebreak

# 2. Functional Requirements

## 2.1 Use Case Description

This section documents all functional requirements as structured use cases. Each use case represents a discrete interaction between one or more actors and the system. Use cases are organized by functional area and numbered sequentially.

**Actors:**

| Actor | Role Description |
|---|---|
| Guest | An unauthenticated visitor. Can browse and read free content but cannot interact with community features or purchase coins. |
| Reader | An authenticated user with the default `reader` role. Can read all content (with coin balance for VIP), write reviews and comments, purchase coins, and manage their library. |
| Curator | An authenticated user with the `curator` role. Has all Reader permissions plus the ability to create and manage novels and chapters via the CMS. |
| Admin | A system administrator with the `admin` role. Has full system access including user management, coin package management, and audit log review. |
| MoMo Gateway | The external MoMo payment service. Initiates webhooks to notify the system of payment outcomes. |
| Google OAuth | The external Google identity provider. Used for social sign-in and account linking. |

**Use Case Index:**

| UC Code | Use Case Name | Actor(s) | FR Code |
|---|---|---|---|
| UC-01 | Register Account | Guest | FR-2.1 |
| UC-02 | Sign In with Email | Guest | FR-2.2 |
| UC-03 | Sign In with Google | Guest, Google OAuth | FR-2.3 |
| UC-04 | Sign Out | Reader, Curator, Admin | FR-2.4 |
| UC-05 | Reset Password | Guest, Reader | FR-2.5 |
| UC-06 | Browse Novel List | Guest, Reader | FR-3.1 |
| UC-07 | Search Novels | Guest, Reader | FR-3.2 |
| UC-08 | Filter Novels | Guest, Reader | FR-3.3 |
| UC-09 | View Novel Detail | Guest, Reader | FR-3.4 |
| UC-10 | Read Chapter | Guest, Reader | FR-3.5 |
| UC-11 | Adjust Reader Settings | Reader | FR-3.6 |
| UC-12 | Follow Novel | Reader | FR-4.1 |
| UC-13 | Track Reading Progress | Reader | FR-4.2 |
| UC-14 | View Library | Reader | FR-4.3 |
| UC-15 | Write Review | Reader | FR-5.1 |
| UC-16 | Leave Comment | Reader | FR-5.2 |
| UC-17 | Purchase Coins | Reader | FR-6.1 |
| UC-18 | Unlock VIP Chapter | Reader | FR-6.2 |
| UC-19 | Update Profile | Reader, Curator, Admin | FR-7.1 |
| UC-20 | Change Password | Reader, Curator, Admin | FR-7.2 |
| UC-21 | Curator Manage Novel | Curator | FR-8.1 |
| UC-22 | Curator Manage Chapter | Curator | FR-8.2 |
| UC-23 | Admin Manage System | Admin | FR-9.1 |

\pagebreak

---

### UC-01: Register Account (FR-2.1)

| Field | Detail |
|---|---|
| **Name** | Register Account |
| **Description** | A guest creates a new NovelHub account using their email address and a chosen password. Upon successful registration, the account is immediately active and the user is signed in. |
| **Actor** | Guest |
| **Trigger** | The guest navigates to `/sign-up` or clicks the "Đăng ký" button anywhere on the platform. |
| **Pre-condition** | The guest is not currently authenticated. No existing account is registered with the provided email address. |
| **Post-condition** | A new `users` record is created with `role = reader` and `coin_balance = 0`. An authenticated session is established. The user is redirected to the home page (`/`). |

#### Activities Flow

![Figure 1: UC-01 Register Account Activity Flow](figures/uc-01-activity.png){ width=6in }

1. Guest opens the registration page (`/sign-up`).
2. Guest enters a display name, email address, and password in the form fields.
3. Guest submits the form.
4. System validates all input fields against the defined business rules.
5. System checks the `users` table for an existing account with the same email.
6. If the email is already registered, the system returns an inline error and halts.
7. System hashes the password using bcrypt.
8. System inserts a new `users` record with `role = reader`, `coin_balance = 0`, `createdAt = now()`.
9. System creates an authenticated session and sets the session cookie.
10. System redirects the user to `/` (home page).

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Display name validation | BR-01-1 | Display name is required. Length: 1–100 characters. Printable characters only; no leading or trailing whitespace. |
| Email validation | BR-01-2 | Email must conform to RFC 5322 format. Case-insensitive storage (stored in lowercase). |
| Password validation | BR-01-3 | Password must be at least 8 characters. No maximum. |
| Email uniqueness | BR-01-4 | If an account already exists with the provided email (regardless of registration method), display MSG-001 and do not create a duplicate. |
| Coin initialisation | BR-01-5 | New accounts are created with `coin_balance = 0`. No `coin_transactions` row is written on registration. |
| Default role | BR-01-6 | All self-registered accounts receive `role = reader`. The `curator` and `admin` roles are assigned only by an existing admin. |
| Post-registration redirect | BR-01-7 | After successful registration, redirect to `/` or the `callbackURL` query parameter if present and same-origin. |

\pagebreak

---

### UC-02: Sign In with Email (FR-2.2)

| Field | Detail |
|---|---|
| **Name** | Sign In with Email |
| **Description** | A registered guest authenticates using their email address and password to access their account and personalized features. |
| **Actor** | Guest |
| **Trigger** | The guest navigates to `/sign-in` or clicks the "Đăng nhập" button. |
| **Pre-condition** | The guest is not currently authenticated. An account with the provided email exists and was created via email/password (not Google-only). |
| **Post-condition** | A new session is created and the session cookie is set. The user is redirected to the originally intended page or home page. |

#### Activities Flow

![Figure 2: UC-02 Sign In with Email Activity Flow](figures/uc-02-activity.png){ width=6in }

1. Guest navigates to the sign-in page (`/sign-in`).
2. Guest enters their registered email address and password.
3. Guest submits the form.
4. System looks up the `users` table by the provided email.
5. System verifies the provided password against the stored bcrypt hash.
6. If verification fails (wrong email or wrong password), the system returns MSG-002.
7. If verification succeeds, the system creates a session record.
8. System sets the session cookie on the response.
9. System redirects the user to the `callbackURL` query parameter (if same-origin) or to `/`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Account lookup | BR-02-1 | If no account matches the email, display MSG-002 without disclosing whether the email is registered. |
| Password verification | BR-02-2 | If the password does not match, display MSG-002. The same error message is used for both email-not-found and wrong-password to prevent user enumeration. |
| Session TTL | BR-02-3 | Session lifetime: 30 days when "Ghi nhớ đăng nhập" is checked; 24 hours otherwise. |
| Redirect after sign-in | BR-02-4 | Redirect to `callbackURL` if present and same-origin; otherwise to `/`. Never redirect to an external URL. |
| Rate limiting | BR-02-5 | After 10 failed attempts from the same IP within 15 minutes, further sign-in attempts are blocked for 15 minutes. |

\pagebreak

---

### UC-03: Sign In with Google (FR-2.3)

| Field | Detail |
|---|---|
| **Name** | Sign In with Google |
| **Description** | A guest authenticates using their Google account via OAuth 2.0. The system creates or links a NovelHub account automatically. |
| **Actor** | Guest, Google OAuth |
| **Trigger** | The guest clicks "Tiếp tục với Google" on the sign-in page (`/sign-in`) or sign-up page (`/sign-up`). |
| **Pre-condition** | The guest is not authenticated. The Google OAuth client ID and secret are configured. |
| **Post-condition** | A NovelHub account is created (if new) or matched (if existing). An authenticated session is created and the user is redirected to `/`. |

#### Activities Flow

![Figure 3: UC-03 Sign In with Google Activity Flow](figures/uc-03-activity.png){ width=6in }

1. Guest clicks "Tiếp tục với Google".
2. System constructs the Google OAuth authorization URL and redirects the guest.
3. Guest views the Google consent screen and grants permission.
4. Google redirects the guest back to the NovelHub callback URL with an authorization code.
5. System exchanges the authorization code for an access token via the Google token endpoint.
6. System retrieves the user's Google profile (subject ID, email, display name).
7. System checks whether an account exists with the matching Google subject ID.
8. If no subject ID match: system checks for an existing account with the same email address.
9. If an existing email/password account is found: system links the Google identity to that account (`accounts` table insert).
10. If no existing account is found: system creates a new `users` record with `role = reader`, `coin_balance = 0`, display name from Google profile.
11. System creates a session and redirects the user to `/` or the stored `callbackURL`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Account linking | BR-03-1 | If the Google email matches an existing email/password account, the Google identity is linked to that account. The user is not prompted — linking happens silently on first Google sign-in with a matching email. |
| No duplicate accounts | BR-03-2 | The system never creates two accounts for the same email. Uniqueness is enforced at the database level. |
| Display name source | BR-03-3 | For new Google-registered accounts, the display name is taken from the Google profile. The user can change it later via `/settings`. |
| No password for Google accounts | BR-03-4 | Accounts created exclusively via Google OAuth have no password hash. The "Change Password" form (UC-20) is hidden for these users. |
| OAuth failure handling | BR-03-5 | If the OAuth flow fails or the user cancels on Google's page, the system displays MSG-003 and returns the user to the sign-in page. |

\pagebreak

---

### UC-04: Sign Out (FR-2.4)

| Field | Detail |
|---|---|
| **Name** | Sign Out |
| **Description** | An authenticated user explicitly ends their current session, clearing their authentication state from the browser and server. |
| **Actor** | Reader, Curator, Admin |
| **Trigger** | The user selects "Đăng xuất" from the user account dropdown menu in the navigation bar. |
| **Pre-condition** | The user is currently authenticated (has a valid session cookie). |
| **Post-condition** | The session record is removed from the `sessions` table. The session cookie is cleared. The user is redirected to the home page (`/`) as a guest. |

#### Activities Flow

![Figure 4: UC-04 Sign Out Activity Flow](figures/uc-04-activity.png){ width=5in }

1. User opens the user dropdown menu in the navigation bar.
2. User selects "Đăng xuất".
3. System sends a POST request to the sign-out API endpoint.
4. System retrieves the session token from the cookie.
5. System deletes the session record from the `sessions` table.
6. System sets the session cookie to an expired value (clearing it from the browser).
7. System redirects the user to `/`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Session invalidation | BR-04-1 | The session token is immediately deleted from the `sessions` table on the server. Subsequent requests with the old cookie must be treated as unauthenticated. |
| Cookie clearing | BR-04-2 | The session cookie is cleared by setting `Max-Age=0` and `Expires` to a past date. |
| Redirect destination | BR-04-3 | After sign-out, always redirect to `/`. Do not redirect to protected pages or to the page the user was previously on if it requires authentication. |
| No confirmation prompt | BR-04-4 | No confirmation dialog is shown before signing out. The action is immediate upon click. |

\pagebreak

---

### UC-05: Reset Password (FR-2.5)

| Field | Detail |
|---|---|
| **Name** | Reset Password |
| **Description** | A user who has forgotten their password requests a one-time reset link sent to their registered email address, then uses that link to set a new password. |
| **Actor** | Guest, Reader |
| **Trigger** | The user clicks "Quên mật khẩu?" on the sign-in page. |
| **Pre-condition** | The user has an email/password account (not a Google-only account). |
| **Post-condition** | A time-limited reset token is emailed to the user. After the user sets a new password via the link, the password is updated and all other sessions are invalidated. |

#### Activities Flow

![Figure 5: UC-05 Reset Password Activity Flow](figures/uc-05-activity.png){ width=6in }

1. User clicks "Quên mật khẩu?" on the sign-in page.
2. System renders the forgot-password form.
3. User enters their registered email address and submits.
4. System validates the email format.
5. System performs a database lookup for the email.
6. Regardless of whether the email is found, system displays a neutral confirmation message (MSG-024) to prevent enumeration.
7. If the email is found: system generates a cryptographically secure reset token, stores a hashed version with an expiry timestamp in the `verifications` table.
8. System sends a transactional email containing the reset link (`/reset-password?token=<token>`).
9. User clicks the reset link from their email client.
10. System validates the token: checks it exists, has not expired, and has not been used.
11. If invalid: system shows an error (MSG-025) and offers a "Gửi lại" option.
12. If valid: system renders the new-password form.
13. User enters and confirms a new password and submits.
14. System validates the new password.
15. System updates the password hash in the `users` table.
16. System marks the token as used and removes it from the `verifications` table.
17. System invalidates all existing sessions for the user.
18. System redirects to `/sign-in` with MSG-004.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Email disclosure | BR-05-1 | The system always responds with a neutral message regardless of whether the email is registered, preventing user enumeration. |
| Token security | BR-05-2 | The reset token is a URL-safe 32-byte random value. Only a SHA-256 hash is stored in the database. |
| Token expiry | BR-05-3 | Reset tokens expire 1 hour after issuance. |
| Token single use | BR-05-4 | Each token can only be used once. It is invalidated immediately after the password is successfully changed. |
| New password constraints | BR-05-5 | New password must be at least 8 characters and must differ from the current password. |
| Google accounts | BR-05-6 | Users with Google-only accounts (no password) are not shown the "Quên mật khẩu?" link. If they attempt to use the endpoint directly, the system returns an informational error. |

\pagebreak

---

### UC-06: Browse Novel List (FR-3.1)

| Field | Detail |
|---|---|
| **Name** | Browse Novel List |
| **Description** | A visitor browses the complete catalogue of available novels, which can be sorted and filtered. The page is server-side rendered for SEO and initial performance. |
| **Actor** | Guest, Reader |
| **Trigger** | The user navigates to `/novels` or clicks "Thể loại" in the navigation bar. |
| **Pre-condition** | None. The page is publicly accessible. |
| **Post-condition** | The novel list page is displayed, reflecting the current filter/sort state encoded in the URL query parameters. |

#### Activities Flow

![Figure 6: UC-06 Browse Novel List Activity Flow](figures/uc-06-activity.png){ width=6in }

1. User navigates to `/novels` (with optional query parameters: `q`, `status`, `genre`, `sort`, `page`).
2. System parses the query parameters and builds the database query with any active filters.
3. System executes a paginated query against the `novels` table.
4. System counts the total number of matching novels for the result counter.
5. System renders the page with: the search bar, status filter pills, genre filter pills, result count, and the novel grid.
6. User views the rendered novel list.
7. User optionally interacts with filters or the search bar (handled by UC-07 and UC-08).
8. Filter changes update the URL and trigger a new page render (client-side navigation with server revalidation).

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Default sort | BR-06-1 | Default sort order is by most recently updated novel (`updatedAt DESC`). |
| Available sort options | BR-06-2 | Supported sort values: `updatedAt` (newest update), `trending` (view count), `rating` (average rating), `chapters` (chapter count). |
| Pagination size | BR-06-3 | Each page displays a maximum of 30 novels. Pagination controls appear when total results exceed 30. |
| Status filter values | BR-06-4 | Valid status filter values: `ONGOING`, `COMPLETED`, `HIATUS`, `DROPPED`. Selecting "Tất cả" or providing no status removes the filter. |
| Single genre filter | BR-06-5 | At most one genre filter can be active at a time. |
| Empty results | BR-06-6 | If no novels match the current filters, an empty-state illustration and text are shown instead of the grid. |
| URL state | BR-06-7 | All filter and sort state is reflected in the URL so that the view is bookmarkable and shareable. |

\pagebreak

---

### UC-07: Search Novels (FR-3.2)

| Field | Detail |
|---|---|
| **Name** | Search Novels |
| **Description** | A visitor searches for novels by typing a keyword. The search is powered by Meilisearch for ranked, typo-tolerant results. |
| **Actor** | Guest, Reader |
| **Trigger** | The user types in the search input on the novel browse page (`/novels`) or clicks the search icon in the navigation bar. |
| **Pre-condition** | None. |
| **Post-condition** | The novel list is updated to show only novels whose title or synopsis matches the search query. The `q` query parameter in the URL is updated. |

#### Activities Flow

![Figure 7: UC-07 Search Novels Activity Flow](figures/uc-07-activity.png){ width=6in }

1. User focuses the search input and begins typing.
2. System debounces the input for 300 ms.
3. After debounce, system updates the `q` query parameter in the URL via client-side navigation.
4. System sends a search request to the Meilisearch index with the query string.
5. Meilisearch returns ranked results (by relevance score), including highlighted matches.
6. System renders the matching novel grid.
7. The result count updates to reflect the number of matched novels.
8. If the user clears the search input, the `q` parameter is removed and the full list is restored.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Minimum query length | BR-07-1 | A search request is sent only when the query is at least 1 non-whitespace character. An empty query returns all novels (same as no filter). |
| Debounce | BR-07-2 | Input is debounced for 300 ms to avoid sending a request on every keystroke. |
| Search scope | BR-07-3 | Meilisearch indexes the `title` and `synopsis` fields. Tag and genre names are not searched. |
| Typo tolerance | BR-07-4 | Meilisearch's default typo tolerance is enabled (up to 2 typos for words longer than 8 characters). |
| Fallback search | BR-07-5 | If the Meilisearch service is unavailable, the system falls back to a PostgreSQL `ILIKE '%query%'` search on the `title` field only. |
| Combined filters | BR-07-6 | Search is compatible with status and genre filters. All active filters are applied together (AND logic). |

\pagebreak

---

### UC-08: Filter Novels (FR-3.3)

| Field | Detail |
|---|---|
| **Name** | Filter Novels |
| **Description** | A visitor refines the novel catalogue by selecting a publication status or genre from the filter pill UI. |
| **Actor** | Guest, Reader |
| **Trigger** | The user clicks a status pill (e.g., "Đang ra") or a genre pill on the `/novels` browse page. |
| **Pre-condition** | The user is on the `/novels` page. |
| **Post-condition** | The URL query parameters are updated with the selected filter(s), and the novel grid is re-rendered to show only matching novels. |

#### Activities Flow

![Figure 8: UC-08 Filter Novels Activity Flow](figures/uc-08-activity.png){ width=6in }

1. User clicks a status pill (e.g., "Hoàn thành").
2. System updates the `status` query parameter in the URL.
3. System triggers a navigation to the updated URL (client-side).
4. Server re-fetches the novel list with the status filter applied.
5. The clicked pill is visually highlighted as active; all other status pills appear inactive.
6. The result count updates to reflect the number of matching novels.
7. User optionally also clicks a genre pill.
8. System adds the `genre` query parameter to the URL.
9. Novel list is re-rendered with both status and genre filters active simultaneously.
10. User can deselect an active filter by clicking the same pill again.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Single status selection | BR-08-1 | Only one status filter can be active at a time. Clicking the active status pill deselects it (reverts to "Tất cả"). |
| Single genre selection | BR-08-2 | Only one genre filter can be active at a time. Clicking the active genre pill deselects it. |
| Filter persistence in URL | BR-08-3 | All active filters are stored in the URL query string. Sharing or reloading the URL restores the same filtered view. |
| Result count display | BR-08-4 | The number of novels matching the current filter combination is displayed as small muted text (e.g., "42 truyện"). |
| Combined with search | BR-08-5 | Status and genre filters combine with any active search query using AND logic — all conditions must be satisfied simultaneously. |

\pagebreak

---

### UC-09: View Novel Detail (FR-3.4)

| Field | Detail |
|---|---|
| **Name** | View Novel Detail |
| **Description** | A visitor views the full detail page for a novel, including the hero section with metadata and CTAs, synopsis, tags, reviews, chapter list, and recommendations. |
| **Actor** | Guest, Reader |
| **Trigger** | The user clicks on a novel card or navigates directly to `/novels/[slug]`. |
| **Pre-condition** | A published novel with the given slug exists in the database. |
| **Post-condition** | The novel detail page is rendered. The novel's `totalViews` counter is incremented by 1. If the user is authenticated, the "Tiếp tục đọc" CTA is populated with their last-read chapter. |

#### Activities Flow

![Figure 9: UC-09 View Novel Detail Activity Flow](figures/uc-09-activity.png){ width=6in }

1. User navigates to `/novels/[slug]`.
2. System fetches the novel record by slug.
3. If no novel is found, the system renders a 404 page.
4. System fetches the published chapter list for the novel (only chapters with `publishedAt <= now()`).
5. If the user is authenticated, system fetches their `reading_progress` record for this novel (last-read chapter number).
6. System fetches up to 6 recommended novels (same genres, excluding the current novel).
7. System triggers a fire-and-forget increment of `novels.totalViews`.
8. System renders the page:
   - **Hero section**: blurred cover background, cover image, title, status/language/genre badges, stats (chapter count, views, rating), CTA buttons, follow button.
   - **Body**: synopsis, tag badges, reviews section (UC-15), chapter list with VIP lock icons, recommendations grid.
9. CTA logic:
   - If no chapters exist: "Chưa có chương" (disabled).
   - If chapters exist but no progress: "Đọc từ đầu" (links to first chapter).
   - If progress exists: "Tiếp tục đọc" + "Từ đầu" (links to last-read chapter and first chapter respectively).

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Slug uniqueness | BR-09-1 | Novel slugs are globally unique. A request for a non-existent slug returns HTTP 404. |
| View counter | BR-09-2 | `totalViews` increment is a fire-and-forget, non-blocking operation. It must not delay the page response. |
| Published chapters only | BR-09-3 | Draft chapters (`publishedAt IS NULL`) and scheduled chapters with a future `publishedAt` are not shown in the chapter list. |
| Chapter VIP indicators | BR-09-4 | VIP chapters display an amber lock icon in the chapter list row regardless of the user's access level. |
| Recommendations count | BR-09-5 | Up to 6 recommended novels are displayed. Recommendations share at least one genre with the current novel and are sorted by view count descending. |
| Rating display | BR-09-6 | Average rating is shown only if at least one review exists. Displayed to one decimal place (e.g., 4.7). |

\pagebreak

---

### UC-10: Read Chapter (FR-3.5)

| Field | Detail |
|---|---|
| **Name** | Read Chapter |
| **Description** | A user reads the text content of a specific published chapter. VIP chapters require a prior coin unlock or an active subscription. The content is never exposed server-side to unauthorized users. |
| **Actor** | Guest, Reader |
| **Trigger** | The user clicks a chapter row in the chapter list or uses the prev/next navigation in the chapter reader. |
| **Pre-condition** | A published chapter with the given number exists for the novel. |
| **Post-condition** | The chapter content is rendered. If authenticated, a `reading_progress` record is upserted. |

#### Activities Flow

![Figure 10: UC-10 Read Chapter Activity Flow](figures/uc-10-activity.png){ width=6in }

1. User navigates to `/novels/[slug]/chapters/[number]`.
2. System fetches the chapter record by novel ID and chapter number.
3. If no matching published chapter is found, the system returns 404.
4. System evaluates access:
   - If `chapter.isVip = false`: access is granted unconditionally.
   - If `chapter.isVip = true` and user is not authenticated: access is denied; `isLocked = true`.
   - If `chapter.isVip = true` and user is authenticated: system checks `chapter_unlocks` and `subscriptions` tables.
5. If access is denied: the server strips the `content` field before sending the response. The `ChapterReader` component renders the locked overlay.
6. If access is granted: the full `content` is included in the server response.
7. System renders the `ChapterReader` component with the chapter content, adjacent chapter links, and all-chapters dropdown.
8. If authenticated: system upserts a `reading_progress` record: `userId`, `novelId`, `chapterId`, `updatedAt = now()`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| VIP access check | BR-10-1 | VIP access is granted if the user has either: (a) a `chapter_unlocks` row matching `userId + chapterId`, OR (b) an active `subscriptions` row (status = `ACTIVE`, `expiresAt > now()`). |
| Server-side content stripping | BR-10-2 | The server NEVER sends VIP chapter content in the page payload if the user lacks access. Content is stripped in the Server Component, not hidden via CSS. |
| Guest VIP handling | BR-10-3 | Guests viewing a VIP chapter see the locked overlay with a prompt to sign in. They are NOT redirected automatically — they can still view the chapter metadata. |
| Reading progress update | BR-10-4 | Progress is upserted on every chapter page load for authenticated users. An earlier chapter load only updates the record if `chapterNumber > stored chapterNumber`. |
| Reading time display | BR-10-5 | Estimated reading time is calculated as `ceil(wordCount / 250)` minutes and shown in the reader top bar. |
| Chapter navigation | BR-10-6 | Prev/next buttons show the adjacent chapter numbers. If the chapter is the first or last, the corresponding button is hidden or disabled. |

\pagebreak

---

### UC-11: Adjust Reader Settings (FR-3.6)

| Field | Detail |
|---|---|
| **Name** | Adjust Reader Settings |
| **Description** | A reader opens the settings panel in the chapter reader and customises the visual reading experience — theme, font family, font size, line height, and content width. Changes take effect immediately and are persisted in the browser's local storage. |
| **Actor** | Reader |
| **Trigger** | The user clicks the gear icon (settings) in the chapter reader's fixed top bar. |
| **Pre-condition** | The user is on the chapter reader page (`/novels/[slug]/chapters/[number]`). |
| **Post-condition** | The selected settings are applied to the reading area in real time. Settings are saved to `localStorage` under the key `reader-settings`. |

#### Activities Flow

![Figure 11: UC-11 Adjust Reader Settings Activity Flow](figures/uc-11-activity.png){ width=6in }

1. User clicks the gear icon; a settings sheet slides in from the right.
2. User selects a reading theme by clicking one of three theme buttons: **Sáng**, **Tối**, or **Đêm**.
   - Sáng: background `#faf9f6`, text `#27272a`.
   - Tối: background `#212121`, text `#e4e4e7`.
   - Đêm: background `#0f0f0f`, text `#a1a1aa`.
3. User selects a font family: **Serif** (Lora, italic) or **Sans** (Inter).
4. User adjusts the font size slider (range: 14–26 px, step: 1).
5. User adjusts the line height slider (range: 1.4–2.2, step: 0.1).
6. User adjusts the content width slider (range: 480–900 px, step: 10).
7. Each change is applied immediately to the reading area without a save button.
8. Settings are serialized to JSON and written to `localStorage['reader-settings']` on every change.
9. On page load, settings are read from `localStorage` and applied before the first paint (no flash).

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Default settings | BR-11-1 | Default values on first visit: theme = Tối, font = Serif (Lora), size = 18 px, line-height = 1.85, width = 680 px. |
| Persistence scope | BR-11-2 | Settings are stored in `localStorage` only. They persist across sessions on the same browser and device but are not synced across devices. |
| Theme independence | BR-11-3 | The reader theme is independent of the site-wide dark/light mode toggle. Changing the reader theme does not affect the navigation bar or other pages. |
| No server storage | BR-11-4 | Reader settings are never stored in the database. They are purely client-side preferences. |

\pagebreak

---

### UC-12: Follow Novel (FR-4.1)

| Field | Detail |
|---|---|
| **Name** | Follow Novel |
| **Description** | A reader toggles their follow status on a novel to receive notifications when new chapters are published. The follow state is reflected immediately in the button UI. |
| **Actor** | Reader |
| **Trigger** | The reader clicks the "Theo dõi" or "Đang theo dõi" button on the novel detail page. |
| **Pre-condition** | The user is authenticated. The novel exists. |
| **Post-condition** | A `novel_follows` record is created (follow) or deleted (unfollow). The button label and state update to reflect the new status. |

#### Activities Flow

![Figure 12: UC-12 Follow Novel Activity Flow](figures/uc-12-activity.png){ width=5in }

1. Reader views the novel detail page.
2. The follow button displays "Theo dõi" if not following, or "Đang theo dõi" if already following.
3. Reader clicks the button.
4. **If currently not following:**
   - System inserts a `novel_follows` record (`userId`, `novelId`, `createdAt`).
   - Button changes to "Đang theo dõi" with a different visual style.
5. **If currently following:**
   - System deletes the matching `novel_follows` record.
   - Button reverts to "Theo dõi".
6. The follow/unfollow action is optimistic — the UI updates immediately and the server is called asynchronously.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Authentication required | BR-12-1 | If an unauthenticated guest clicks the follow button, they are redirected to `/sign-in?callbackURL=/novels/[slug]`. |
| Idempotency | BR-12-2 | The follow API endpoint is idempotent. Sending a follow request when already following returns success without creating a duplicate record (enforced by a unique index on `novel_follows(userId, novelId)`). |
| Notification integration | BR-12-3 | When a new chapter is published, the system queues notifications for all users who follow the novel. This feature is implemented in Phase 3. |

\pagebreak

---

### UC-13: Track Reading Progress (FR-4.2)

| Field | Detail |
|---|---|
| **Name** | Track Reading Progress |
| **Description** | The system automatically records and maintains the reader's last-read chapter for each novel. This enables the "Tiếp tục đọc" CTA on the novel detail page and the progress bar in the library. |
| **Actor** | Reader |
| **Trigger** | An authenticated reader opens any accessible chapter page. |
| **Pre-condition** | The user is authenticated. The chapter is accessible (not locked, or already unlocked). |
| **Post-condition** | The `reading_progress` record for the (userId, novelId) pair is upserted with the current `chapterId` and `updatedAt = now()`. |

#### Activities Flow

![Figure 13: UC-13 Track Reading Progress Activity Flow](figures/uc-13-activity.png){ width=6in }

1. Authenticated reader opens a chapter page (UC-10).
2. System checks whether a `reading_progress` row exists for (userId, novelId).
3. **If no existing row:** system inserts a new record with `userId`, `novelId`, `chapterId`, `updatedAt`.
4. **If an existing row exists:** system updates the row only if the new `chapterNumber` is greater than or equal to the stored chapter number.
5. On the novel detail page, the CTA reads "Tiếp tục đọc chương [N]" using the stored chapter number.
6. In the library, a progress bar displays `(lastChapterNumber / totalChapters) × 100%`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Upsert direction | BR-13-1 | Progress only moves forward. Re-reading an earlier chapter does not overwrite the stored (later) chapter. The record is updated only if `newChapterNumber >= storedChapterNumber`. |
| One record per novel | BR-13-2 | There is exactly one `reading_progress` row per (userId, novelId) pair, enforced by a unique constraint. |
| Progress percentage | BR-13-3 | Progress percentage is calculated as `min(lastChapterNumber / totalChapters × 100, 100)`, displayed as an integer. |
| Guest users | BR-13-4 | Reading progress is not tracked for unauthenticated users. No anonymous tracking via cookies or IP. |

\pagebreak

---

### UC-14: View Library (FR-4.3)

| Field | Detail |
|---|---|
| **Name** | View Library |
| **Description** | A reader views their personal reading library — a collection of novels they are following or have read — with filter tabs and reading progress indicators. |
| **Actor** | Reader |
| **Trigger** | The reader navigates to `/library` or clicks "Tủ sách" in the navigation bar. |
| **Pre-condition** | The user is authenticated. |
| **Post-condition** | The library page is displayed, showing the user's novels filtered by the selected tab (Đang đọc / Hoàn thành / Tất cả). |

#### Activities Flow

![Figure 14: UC-14 View Library Activity Flow](figures/uc-14-activity.png){ width=6in }

1. Reader navigates to `/library`.
2. System verifies authentication; unauthenticated users are redirected to `/sign-in?callbackURL=/library`.
3. System fetches the user's followed novels from `novel_follows` joined with `novels`.
4. System joins with `reading_progress` to get the last-read chapter number for each novel.
5. System renders the page with three filter tabs: **Đang đọc**, **Hoàn thành**, **Tất cả**.
6. **Đang đọc**: novels where `readingProgress.lastChapterNumber < novel.totalChapters`.
7. **Hoàn thành**: novels where `readingProgress.lastChapterNumber >= novel.totalChapters`.
8. **Tất cả**: all followed novels regardless of progress.
9. Each novel card shows the cover, title, and a thin primary-color progress bar at the bottom.
10. If no novels match the current tab, an empty state is shown.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Protected route | BR-14-1 | `/library` is a protected route enforced at the middleware level. Unauthenticated users are always redirected to sign-in. |
| Progress display | BR-14-2 | The progress bar height is 3 px, primary color fill, full width of the card. Width represents `lastChapterNumber / totalChapters` as a percentage. |
| Empty state | BR-14-3 | If no novels match the selected tab, display a centered `BookOpen` icon, the message "Chưa có truyện nào trong tủ sách", and a "Khám phá truyện" link button pointing to `/novels`. |
| Tab default | BR-14-4 | The default active tab on page load is "Tất cả". Tab state is stored in the URL (`?tab=reading`, `?tab=completed`). |

\pagebreak

---

### UC-15: Write Review (FR-5.1)

| Field | Detail |
|---|---|
| **Name** | Write Review |
| **Description** | A reader submits a star rating (1–5) and an optional text review for a novel. Each reader can write at most one review per novel; submitting again updates the existing review. |
| **Actor** | Reader |
| **Trigger** | The reader clicks "Viết đánh giá" on the novel detail page's reviews section. |
| **Pre-condition** | The user is authenticated. The novel exists. |
| **Post-condition** | A `reviews` record is inserted or updated. The novel's `avgRating` is recalculated. The reviews section re-renders with the new review. |

#### Activities Flow

![Figure 15: UC-15 Write Review Activity Flow](figures/uc-15-activity.png){ width=6in }

1. Reader clicks "Viết đánh giá" in the reviews section.
2. System checks whether the user already has a review for this novel.
3. The review form opens (modal or inline). If an existing review exists, the form is pre-populated with the prior rating and text.
4. Reader selects a star rating (1–5 by clicking star icons).
5. Reader optionally types review text in the textarea.
6. Reader clicks "Gửi đánh giá".
7. System validates: rating is required (1–5), text length ≤ 2,000 characters.
8. System inserts or updates the `reviews` record (`userId`, `novelId`, `rating`, `body`, `updatedAt`).
9. System recalculates `novels.avgRating` as the average of all ratings for the novel.
10. The reviews section refreshes to show the updated review.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Authentication required | BR-15-1 | Only authenticated readers can write reviews. Unauthenticated users see a prompt to sign in. |
| One review per user | BR-15-2 | Each user can have at most one review per novel, enforced by a unique constraint on `reviews(userId, novelId)`. |
| Rating required | BR-15-3 | A star rating (integer 1–5) is required. The form cannot be submitted without selecting a rating. |
| Text is optional | BR-15-4 | Review body text is optional. Maximum 2,000 characters. |
| avgRating recalculation | BR-15-5 | `novels.avgRating` is updated atomically after every review insert, update, or delete using the SQL average aggregate. |
| Review deletion | BR-15-6 | Readers can delete their own review. This also triggers `avgRating` recalculation. |

\pagebreak

---

### UC-16: Leave Comment (FR-5.2)

| Field | Detail |
|---|---|
| **Name** | Leave Comment |
| **Description** | A reader posts a text comment on a novel. Comments support one level of nesting (replies to top-level comments). |
| **Actor** | Reader |
| **Trigger** | The reader types in the comment text box on the novel detail page and clicks "Gửi". |
| **Pre-condition** | The user is authenticated. |
| **Post-condition** | A `comments` record is inserted. The comment appears immediately at the top of the comments section. |

#### Activities Flow

![Figure 16: UC-16 Leave Comment Activity Flow](figures/uc-16-activity.png){ width=6in }

1. Reader types a comment in the text input at the top of the comments section.
2. Reader clicks "Gửi".
3. System validates the comment is non-empty and within the character limit.
4. System inserts a `comments` record with `userId`, `targetType = novel`, `targetId = novelId`, `content`, `parentId = null`, `createdAt`.
5. The comment appears at the top of the list (newest first).
6. For replies: reader clicks "Trả lời" on an existing comment.
7. An indented reply input appears.
8. Reader types and submits the reply.
9. System inserts a `comments` record with `parentId` referencing the parent comment.
10. The reply appears indented below the parent comment.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Authentication required | BR-16-1 | Only authenticated users can post comments. Unauthenticated visitors see a prompt to sign in when clicking the input. |
| Character limit | BR-16-2 | Maximum 1,000 characters per comment or reply. |
| Nesting depth | BR-16-3 | Comments support exactly one level of nesting (parent comment → replies). Replies cannot themselves be replied to (no deep nesting). |
| Edit / Delete | BR-16-4 | Users can edit or delete their own comments within 15 minutes of posting. Admins and curators can delete any comment at any time. |
| Moderation | BR-16-5 | Comments flagged as reported by other users are hidden from public view pending curator or admin review. |
| Comment ordering | BR-16-6 | Top-level comments are displayed newest-first by default. Replies are displayed oldest-first under their parent. |

\pagebreak

---

### UC-17: Purchase Coins (FR-6.1)

| Field | Detail |
|---|---|
| **Name** | Purchase Coins |
| **Description** | A reader purchases a coin package using the MoMo payment gateway. On successful payment, the reader's coin balance is incremented atomically and a ledger entry is written. |
| **Actor** | Reader, MoMo Gateway |
| **Trigger** | The reader clicks "Mua [N] xu" on a coin package card at `/pricing`. |
| **Pre-condition** | The user is authenticated. At least one active coin package exists in the `coin_packages` table. |
| **Post-condition** | `users.coin_balance` is incremented by `totalCoins` (base + bonus). A `payments` record with `status = COMPLETED` exists. A `coin_transactions` record with `type = CREDIT` exists. |

#### Activities Flow

![Figure 17: UC-17 Purchase Coins Activity Flow](figures/uc-17-activity.png){ width=6in }

1. Reader navigates to `/pricing`.
2. System fetches and displays active coin packages.
3. Reader selects a package and clicks the buy button.
4. System creates a `payments` record with `status = PENDING`, unique `orderId`, `userId`, `packageId`, `amountVnd`.
5. System calls the MoMo `createPayment` API with the `orderId`, amount, and redirect URLs.
6. MoMo returns a `payUrl`.
7. System redirects the reader to the MoMo payment page (external).
8. Reader completes the payment on MoMo's interface.
9. MoMo sends a `POST` webhook to `/api/payments/momo/webhook`.
10. System verifies the HMAC-SHA256 signature on the incoming webhook.
11. If the signature is invalid, the system responds HTTP 400 and discards the request.
12. If the signature is valid and `resultCode = 0` (success):
    - System begins a database transaction.
    - Updates `payments.status = COMPLETED`.
    - Increments `users.coin_balance` by `totalCoins`.
    - Inserts a `coin_transactions` row with `type = CREDIT`, `amount = totalCoins`.
    - Commits the transaction.
13. System returns HTTP 200 to MoMo.
14. User is redirected from MoMo to the success page with MSG-011.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Authentication required | BR-17-1 | Unauthenticated users are shown a sign-in prompt and cannot initiate a purchase. |
| HMAC verification mandatory | BR-17-2 | Every webhook must have its HMAC-SHA256 signature verified using the MoMo secret key. Webhooks with invalid signatures are rejected with HTTP 400 and logged. |
| Atomic update | BR-17-3 | Coin balance increment and `coin_transactions` insert must be executed in a single database transaction to prevent partial state. |
| Idempotency | BR-17-4 | Duplicate webhook calls for the same `orderId` are detected by checking the existing `payments` status. If already `COMPLETED`, the system returns HTTP 200 without re-processing. |
| Sandbox environment | BR-17-5 | Development uses MoMo Sandbox. No real money is charged. This is disclosed on the `/pricing` page footer. |
| Failed payment | BR-17-6 | If MoMo reports `resultCode != 0`, the `payments.status` is set to `FAILED`. Coin balance is not changed. The user is redirected to the failure page with MSG-012. |

\pagebreak

---

### UC-18: Unlock VIP Chapter (FR-6.2)

| Field | Detail |
|---|---|
| **Name** | Unlock VIP Chapter |
| **Description** | A reader spends one or more coins to permanently unlock a VIP chapter, gaining permanent access regardless of future coin balance changes. |
| **Actor** | Reader |
| **Trigger** | The reader clicks "Mở khoá" on the VIP lock overlay while viewing a locked chapter. |
| **Pre-condition** | The user is authenticated. The chapter is VIP and locked for this user. The user's `coin_balance >= chapter.coinCost`. |
| **Post-condition** | A `chapter_unlocks` record is created. `users.coin_balance` is decremented by `coinCost`. A debit `coin_transactions` record is created. The chapter content becomes accessible. |

#### Activities Flow

![Figure 18: UC-18 Unlock VIP Chapter Activity Flow](figures/uc-18-activity.png){ width=6in }

1. Reader views a VIP chapter and sees the locked overlay.
2. The overlay displays: chapter title, coin cost, the reader's current coin balance.
3. Reader clicks "Mở khoá".
4. System re-verifies (server-side) that the chapter is still locked for this user.
5. System checks that `users.coin_balance >= chapter.coinCost`.
6. If insufficient balance: system displays MSG-005 with a link to `/pricing`. No deduction is made.
7. If balance is sufficient:
   - System begins a database transaction.
   - Inserts a `chapter_unlocks` row (`userId`, `chapterId`, `coinSpent`, `unlockedAt`).
   - Decrements `users.coin_balance` by `coinCost`.
   - Inserts a `coin_transactions` row (`type = DEBIT`, `amount = coinCost`).
   - Commits the transaction.
8. System reloads the chapter with full content now visible.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Insufficient balance | BR-18-1 | If `coin_balance < coinCost`, display MSG-005 with a link to `/pricing`. Abort without any database changes. |
| Atomic deduction | BR-18-2 | Coin deduction, unlock record creation, and transaction ledger insert are all performed in a single database transaction. |
| Permanent unlock | BR-18-3 | Once a chapter is unlocked, the `chapter_unlocks` record is never deleted. The user retains access permanently, even if their coin balance drops to zero later. |
| Default coin cost | BR-18-4 | Default `coinCost` for a VIP chapter is 1 coin. Curators may set a different `coinCost` per chapter (positive integer). |
| Guest redirect | BR-18-5 | If a guest attempts to unlock (e.g., direct API call), they receive HTTP 401 and a redirect to sign-in. |
| Subscription bypass | BR-18-6 | Users with an active `ACTIVE` subscription status do not see the lock overlay and do not spend coins, regardless of their balance. |

\pagebreak

---

### UC-19: Update Profile (FR-7.1)

| Field | Detail |
|---|---|
| **Name** | Update Profile |
| **Description** | An authenticated user updates their display name and bio (self-introduction) from the account settings page. |
| **Actor** | Reader, Curator, Admin |
| **Trigger** | The user navigates to `/settings` and clicks "Lưu thay đổi" after editing their profile fields. |
| **Pre-condition** | The user is authenticated. |
| **Post-condition** | The `users.name` and `users.bio` fields are updated in the database. A success notification is displayed. |

#### Activities Flow

![Figure 19: UC-19 Update Profile Activity Flow](figures/uc-19-activity.png){ width=5in }

1. User navigates to `/settings`.
2. System verifies authentication; unauthenticated users are redirected to `/sign-in`.
3. System fetches the current user record and renders the profile form pre-populated with `name` and `bio`.
4. The `email` field is displayed as read-only (disabled input).
5. User edits the display name and/or bio.
6. The bio textarea shows a live character counter (e.g., "47/300") that updates as the user types.
7. User clicks "Lưu thay đổi".
8. System validates the inputs server-side.
9. System updates the `users` record with the new `name` and `bio`.
10. System displays a success toast: MSG-008.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Display name required | BR-19-1 | Display name is required. Length: 1–100 characters. Cannot be blank. Display MSG-014 if invalid. |
| Bio optional | BR-19-2 | Bio is optional. Maximum 300 characters. Display a character counter below the textarea. |
| Email is immutable | BR-19-3 | The email field is read-only (HTML `disabled`). The API endpoint ignores any `email` field in the request body. |
| Protected route | BR-19-4 | `/settings` is a protected route. Unauthenticated requests are redirected to `/sign-in?callbackURL=/settings`. |

\pagebreak

---

### UC-20: Change Password (FR-7.2)

| Field | Detail |
|---|---|
| **Name** | Change Password |
| **Description** | An authenticated user with an email/password account changes their account password. All other active sessions are invalidated after a successful change. |
| **Actor** | Reader, Curator, Admin |
| **Trigger** | The user fills in the "Đổi mật khẩu" form on `/settings` and submits. |
| **Pre-condition** | The user is authenticated and their account has a password (not a Google-only account). |
| **Post-condition** | The password hash is updated. All sessions other than the current one are invalidated. MSG-006 is displayed. |

#### Activities Flow

![Figure 20: UC-20 Change Password Activity Flow](figures/uc-20-activity.png){ width=6in }

1. User scrolls to the "Đổi mật khẩu" section on `/settings`.
2. User enters: current password, new password, confirm new password.
3. User clicks "Đổi mật khẩu".
4. System verifies the current password against the stored bcrypt hash.
5. If current password is incorrect: system displays MSG-007 and halts.
6. System validates the new password (minimum length, does not match current).
7. System checks that the new password and confirmation match.
8. System hashes the new password with bcrypt.
9. System updates `users.passwordHash` with the new hash.
10. System deletes all session records for the user except the current session.
11. System displays MSG-006.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Current password verification | BR-20-1 | The submitted current password must match the stored bcrypt hash. If not, display MSG-007. |
| Confirmation match | BR-20-2 | New password and confirm password must be identical. |
| Minimum length | BR-20-3 | New password must be at least 8 characters. |
| No password reuse | BR-20-4 | New password must not be identical to the current password. |
| Google account exclusion | BR-20-5 | Users who registered exclusively via Google OAuth (no password) do not see the "Đổi mật khẩu" section. The form is conditionally rendered on the server based on whether the account has a password credential. |
| Session invalidation | BR-20-6 | After a successful password change, all `sessions` rows for the user except the current session ID are deleted, forcing re-authentication on other devices. |

\pagebreak

---

### UC-21: Curator Manage Novel (FR-8.1)

| Field | Detail |
|---|---|
| **Name** | Curator Manage Novel |
| **Description** | A curator creates a new novel or edits an existing one. This includes setting all metadata fields, uploading a cover image, and associating genres and tags. |
| **Actor** | Curator |
| **Trigger** | The curator navigates to `/curator/novels/new` (create) or `/curator/novels/[id]/edit` (edit). |
| **Pre-condition** | The user is authenticated and has `role = curator` or `role = admin`. |
| **Post-condition** | The `novels` record is inserted or updated. Associated `novel_genres` and `novel_tags` junction table rows are synchronized. |

#### Activities Flow

![Figure 21: UC-21 Curator Manage Novel Activity Flow](figures/uc-21-activity.png){ width=6in }

1. Curator opens the novel form via the CMS.
2. System renders the form. For edit mode: pre-populated with existing novel data.
3. Curator fills in required fields: title, original language, publication status.
4. Curator optionally fills in: synopsis, slug (auto-generated if blank), genres (multi-select, max 5), tags (multi-select or free-text), cover image.
5. For cover image: curator uploads via the Cloudinary upload widget. The widget uploads directly to Cloudinary and returns a `secure_url`.
6. System stores the Cloudinary `secure_url` in `novels.coverImageUrl`.
7. Curator clicks "Lưu".
8. System validates all fields server-side.
9. System generates a slug from the title if not provided (lowercase, hyphens, Vietnamese transliteration).
10. System checks slug uniqueness; if a collision occurs, appends a numeric suffix.
11. System upserts the `novels` record.
12. System synchronizes `novel_genres` and `novel_tags` junction rows (delete all existing, insert selected).
13. System redirects to the novel detail page or the chapter management list.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Required fields | BR-21-1 | Title (1–500 characters), original language (ZH / KO / JA / EN / VI), and status (ONGOING / COMPLETED / HIATUS / DROPPED) are required. |
| Slug format | BR-21-2 | Slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Uniqueness is enforced at the database level by a unique index. |
| Auto-slug | BR-21-3 | If the curator does not provide a slug, the system auto-generates one from the title using Vietnamese transliteration (removing diacritics, replacing spaces with hyphens, lowercasing). |
| Cover image constraints | BR-21-4 | Accepted formats: JPEG, PNG, WebP. Maximum file size: 5 MB. The image is stored on Cloudinary; only the URL is in the database. |
| Genre limit | BR-21-5 | A novel may be associated with a maximum of 5 genres. |
| CMS access control | BR-21-6 | Middleware verifies `role = curator` or `role = admin` on all `/curator/**` routes. Readers receive HTTP 403. |

\pagebreak

---

### UC-22: Curator Manage Chapter (FR-8.2)

| Field | Detail |
|---|---|
| **Name** | Curator Manage Chapter |
| **Description** | A curator creates, edits, and controls the publication state of chapters belonging to a novel. Chapters can be saved as drafts or published immediately or on a schedule. |
| **Actor** | Curator |
| **Trigger** | The curator opens the chapter editor at `/curator/novels/[id]/chapters/new` or `/curator/novels/[id]/chapters/[chId]/edit`. |
| **Pre-condition** | The user has the `curator` or `admin` role. The parent novel exists. |
| **Post-condition** | The `chapters` record is created or updated. If published, `publishedAt` is set and `novels.totalChapters` is incremented. |

#### Activities Flow

![Figure 22: UC-22 Curator Manage Chapter Activity Flow](figures/uc-22-activity.png){ width=6in }

1. Curator opens the chapter form via the CMS.
2. System renders the chapter editor. For edit mode: pre-populated with existing chapter data.
3. Curator fills in: chapter number, chapter title, content (rich text editor).
4. Curator optionally toggles the VIP flag and sets the coin cost.
5. Curator optionally sets a scheduled `publishedAt` date/time.
6. Curator clicks:
   - **"Lưu bản nháp"**: saves with `publishedAt = null`. Chapter is not visible to readers.
   - **"Xuất bản"**: saves with `publishedAt = now()` (or the scheduled date).
7. System validates: chapter number is a positive integer, unique within the novel; title is non-empty.
8. System calculates `wordCount` by stripping HTML tags from the content and counting space-delimited tokens.
9. System inserts or updates the `chapters` record.
10. If publishing (setting `publishedAt`): system atomically increments `novels.totalChapters`.
11. If reverting from published to draft: system atomically decrements `novels.totalChapters`.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Chapter number uniqueness | BR-22-1 | Chapter numbers must be unique within a novel. A duplicate chapter number returns a validation error. |
| Word count calculation | BR-22-2 | `wordCount` is calculated server-side after stripping HTML tags. It is not user-editable. |
| Draft visibility | BR-22-3 | Chapters with `publishedAt IS NULL` are drafts and invisible to all readers (Guest, Reader). They are visible only to curators and admins in the CMS. |
| Scheduled chapters | BR-22-4 | A chapter with a future `publishedAt` is treated as a draft until the timestamp passes. The reader-facing query filters on `publishedAt <= now()`. |
| VIP flag | BR-22-5 | `isVip` can only be set to `true` by a curator or admin. Readers cannot manipulate this flag. |
| Chapter count synchronization | BR-22-6 | `novels.totalChapters` reflects the count of all published chapters. It is updated atomically whenever a chapter transitions between draft and published states. |
| Content safety | BR-22-7 | Chapter content is stored as HTML. On render, it is sanitized using an allowlist of safe HTML tags to prevent XSS. |

\pagebreak

---

### UC-23: Admin Manage System (FR-9.1)

| Field | Detail |
|---|---|
| **Name** | Admin Manage System |
| **Description** | An admin performs system administration tasks: managing user accounts and roles, configuring coin packages, reviewing audit logs, and moderating reported content. All admin actions are logged. |
| **Actor** | Admin |
| **Trigger** | The admin navigates to `/admin` or any sub-page of the admin dashboard. |
| **Pre-condition** | The user is authenticated with `role = admin`. |
| **Post-condition** | The requested administrative action is executed. An `audit_logs` entry is created for every state-changing operation. |

#### Activities Flow

![Figure 23: UC-23 Admin Manage System Activity Flow](figures/uc-23-activity.png){ width=6in }

1. Admin navigates to the admin dashboard (`/admin`).
2. System verifies `role = admin`; non-admin users receive HTTP 403.
3. Admin selects a management area from the sidebar:
   - **Users** (`/admin/users`): paginated list of all users with role, status, and join date.
   - **Coin Packages** (`/admin/coin-packages`): list of all coin packages (active and inactive).
   - **Audit Logs** (`/admin/audit-logs`): chronological event feed of all admin actions.
   - **Reports** (Phase 3): moderation queue for reported comments and reviews.
4. **User management actions:**
   - Admin views user profile details and current role.
   - Admin changes a user's role (`reader ↔ curator`).
   - Admin bans or unbans a user account.
   - Each change is written to `audit_logs`.
5. **Coin package actions:**
   - Admin creates a new coin package (coins, bonusCoins, priceVnd, isActive).
   - Admin edits an existing package's values.
   - Admin deactivates a package (hidden from `/pricing` but existing purchases are unaffected).
   - Each change is written to `audit_logs`.
6. **Audit log viewing:**
   - Admin views the event feed, filtered by date range or action type.
   - No mutations are possible from the audit log view.

#### Business Rules

| Activity | BR Code | Description |
|---|---|---|
| Role escalation | BR-23-1 | Only admins can promote users to `curator` or `admin`. Curators cannot change their own or others' roles. |
| Self-ban prevention | BR-23-2 | An admin cannot ban their own account. The ban button is hidden/disabled for the admin's own record. |
| Audit log immutability | BR-23-3 | `audit_logs` rows are insert-only. They cannot be edited or deleted, even by admins. |
| Audit log coverage | BR-23-4 | Every state-changing admin action (role change, ban, package create/edit/deactivate, content removal) creates an `audit_logs` entry with `adminId`, `action`, `targetType`, `targetId`, `metadata (JSON)`, `createdAt`. |
| Package deactivation | BR-23-5 | Deactivating a coin package sets `isActive = false`. The package is hidden from `/pricing` but all historical `payments` and `coin_transactions` records referencing it are preserved. |
| Admin-only access | BR-23-6 | All `/admin/**` routes are protected at the middleware level. Any user without `role = admin` receives HTTP 403. |

\pagebreak

# 3. Non-Functional Requirements

## 3.1 User Access and Security

The following matrix defines access control across all system functions. Roles are additive — Reader permissions are a strict subset of Curator, and Curator is a strict subset of Admin unless explicitly noted.

`X` = access granted &nbsp;&nbsp; `X(*)` = access to own data only &nbsp;&nbsp; `—` = no access

| Function / Data | Guest | Reader | Curator | Admin |
|---|---|---|---|---|
| Browse novel list | X | X | X | X |
| Search novels | X | X | X | X |
| View novel detail | X | X | X | X |
| Read free chapter | X | X | X | X |
| Read VIP chapter | — | X(*) | X(*) | X |
| Write review | — | X(*) | X(*) | X |
| Edit / delete own review | — | X(*) | X(*) | X(*) |
| Delete any review | — | — | — | X |
| Leave comment | — | X(*) | X(*) | X |
| Edit / delete own comment | — | X(*) | X(*) | X(*) |
| Delete any comment | — | — | X | X |
| Follow novel | — | X(*) | X(*) | X |
| View own library | — | X(*) | X(*) | X(*) |
| Purchase coins | — | X(*) | — | — |
| View own coin balance | — | X(*) | X(*) | X(*) |
| Unlock VIP chapter (coins) | — | X(*) | X(*) | X |
| Update own profile | — | X(*) | X(*) | X(*) |
| Change own password | — | X(*) | X(*) | X(*) |
| Create / edit novel | — | — | X | X |
| Create / edit chapter | — | — | X | X |
| Publish / unpublish chapter | — | — | X | X |
| View CMS | — | — | X | X |
| Manage all users | — | — | — | X |
| Change user roles | — | — | — | X |
| Ban / unban users | — | — | — | X |
| Manage coin packages | — | — | — | X |
| View audit logs | — | — | — | X |
| Moderate reported content | — | — | — | X |
| View any user's data | — | — | — | X |

## 3.2 Performance Requirements

| Requirement | Target | Notes |
|---|---|---|
| Home page LCP | ≤ 2.5 s | Measured on a 4G mobile connection |
| Novel list page server response | ≤ 500 ms | P95 under normal load |
| Search result latency (Meilisearch) | ≤ 200 ms | P95 for queries returning ≤ 30 results |
| Chapter page server response | ≤ 1 s | Including VIP access check |
| Payment webhook processing | ≤ 3 s | From receipt to DB commit |
| Concurrent reader sessions | ≥ 500 | Limited by Neon free-tier connection pool |
| Image load time (novel cover) | ≤ 1 s | Via Cloudinary CDN with WebP auto-format |

## 3.3 Availability and Reliability

| Requirement | Target |
|---|---|
| Platform uptime | ≥ 99.5% monthly (excluding planned maintenance) |
| Database failover (Neon) | Automatic; handled by Neon serverless infrastructure |
| Payment idempotency | MoMo webhooks are retried up to 3 times; the system handles duplicates without double-crediting |
| Graceful degradation | Search falls back to PostgreSQL ILIKE if Meilisearch is unavailable; pages do not hard-error |
| Session expiry handling | Expired sessions cause graceful redirect to sign-in; no data corruption |

## 3.4 Security Requirements

| Requirement | Implementation Detail |
|---|---|
| Password hashing | bcrypt with work factor ≥ 12 |
| Session management | HTTP-only, Secure, SameSite=Lax cookie; session stored in DB |
| OAuth security | State parameter validated on callback; PKCE used where supported |
| Input sanitization | All user-submitted HTML content sanitized with an allowlist before storage |
| XSS prevention | React's default JSX escaping; `dangerouslySetInnerHTML` prohibited for user-controlled content |
| SQL injection prevention | Drizzle ORM parameterized queries; no raw string interpolation in queries |
| Payment webhook security | HMAC-SHA256 signature verification required; invalid-signature requests rejected with HTTP 400 |
| Rate limiting | Sign-in: max 10 failures per IP per 15 minutes; coin purchase: max 5 requests per user per minute |
| Role enforcement | User role is read from the database session on every request; never from a cookie or client header |
| Sensitive route protection | `/library`, `/settings`, `/curator/**`, `/admin/**` protected at the Next.js middleware layer |
| Secrets management | All secrets stored in environment variables (`.env.local`); never committed to source control |

\pagebreak

# 4. System Requirements

## 4.1 Custom Pages

| # | Page Name | Route | Description |
|---|---|---|---|
| 1 | Home | `/` | Featured, trending, and newly updated novel sections |
| 2 | Novel List / Browse | `/novels` | Full searchable, filterable novel catalogue |
| 3 | Novel Detail | `/novels/[slug]` | Novel metadata, chapter list, reviews, tags, recommendations |
| 4 | Chapter Reader | `/novels/[slug]/chapters/[number]` | Distraction-free chapter reading with reader settings |
| 5 | Sign In | `/sign-in` | Email/password sign-in and Google OAuth entry point |
| 6 | Sign Up | `/sign-up` | New account registration form |
| 7 | Pricing / Coin Purchase | `/pricing` | Coin package catalogue and purchase flow |
| 8 | Library | `/library` | Authenticated user's followed novels with progress tracking |
| 9 | Account Settings | `/settings` | Profile editing and password change |
| 10 | Curator Dashboard | `/curator` | CMS landing page for curators |
| 11 | Curator Novel List | `/curator/novels` | List of all novels in the CMS with edit/delete actions |
| 12 | Curator Novel Create | `/curator/novels/new` | Create a new novel record |
| 13 | Curator Novel Edit | `/curator/novels/[id]/edit` | Edit an existing novel's metadata |
| 14 | Curator Chapter List | `/curator/novels/[id]/chapters` | Chapter management list for a specific novel |
| 15 | Curator Chapter Create | `/curator/novels/[id]/chapters/new` | Create and publish a new chapter |
| 16 | Curator Chapter Edit | `/curator/novels/[id]/chapters/[chId]/edit` | Edit an existing chapter |
| 17 | Admin Dashboard | `/admin` | System administration overview with key metrics |
| 18 | Admin User Management | `/admin/users` | User list with role assignment and ban controls |
| 19 | Admin Coin Packages | `/admin/coin-packages` | Coin package CRUD interface |
| 20 | Admin Audit Logs | `/admin/audit-logs` | Chronological feed of all administrative events |
| 21 | Payment Success | `/payments/success` | Post-payment confirmation with coin balance update |
| 22 | Payment Failure | `/payments/failure` | Post-payment failure notice with retry options |
| 23 | 404 Not Found | — | Custom 404 error page |
| 24 | 500 Server Error | — | Custom 500 error page |

## 4.2 Technical Environment

| Attribute | Value |
|---|---|
| Language | TypeScript 5.x |
| Runtime | Node.js 20 LTS |
| Framework | Next.js 16 (App Router, Server Components, API Routes) |
| Database | PostgreSQL 16 via Neon (serverless) |
| ORM | Drizzle ORM |
| Authentication | Better Auth (email/password + Google OAuth) |
| Full-text Search | Meilisearch Cloud |
| Cache | Upstash Redis (serverless) |
| Payment Gateway | MoMo (Sandbox → Production) |
| Image Management | Cloudinary (upload, transformation, CDN delivery) |
| CDN / Edge | Cloudflare |
| UI Library | shadcn/ui (Nova preset), Radix UI, Tailwind CSS v4 |
| Hosting | Vercel (Hobby tier in development; Pro tier on production launch) |
| Package Manager | pnpm |

## 4.3 Development Phases

| Phase | Scope | Status |
|---|---|---|
| Phase 0 | Project scaffold, database schema, authentication setup | Complete |
| Phase 1 | Content module (novels, chapters), curator CMS, basic reading UI | Complete |
| Phase 2 | Monetization: coins, MoMo payment, VIP chapter unlock | In Progress |
| Phase 3 | Community: comments, reviews; search: Meilisearch; notifications | Planned |
| Phase 4 | Admin panel, analytics dashboard, recommendation engine | Planned |

\pagebreak

# 5. Appendixes

## 5.1 Glossary

| Term | Description |
|---|---|
| Admin | A system administrator with full platform access. Responsible for user management, coin package configuration, and content moderation. |
| Audit Log | An immutable chronological record of all administrative actions. Stored in the `audit_logs` table. |
| BR | Business Rule. A numbered constraint within a use case (e.g., BR-01-1). |
| Coin | The platform's virtual currency. 1 coin = 1 VIP chapter unlock. 100 coins ≈ 10,000 VND. |
| CMS | Content Management System. The curator-facing interface at `/curator/**`. |
| Curator | An authenticated user with content management privileges. Can create and publish novels and chapters. |
| Draft | A chapter with `publishedAt IS NULL`. Not visible to readers. |
| ERD | Entity Relationship Diagram. Documents all database tables and their relationships. See `docs/ERD.md`. |
| FR | Functional Requirement code (e.g., FR-2.1). |
| Guest | An unauthenticated visitor. |
| HMAC | Hash-based Message Authentication Code. Used to verify MoMo webhook signatures. |
| LCP | Largest Contentful Paint. A Core Web Vital measuring perceived load speed. Target: ≤ 2.5 s. |
| Library | A reader's personal collection of followed novels with reading progress. Located at `/library`. |
| MSG | System Message Code (e.g., MSG-001). |
| NFR | Non-Functional Requirement. A quality attribute such as performance or security. |
| Novel | A web novel available on the platform. Has metadata, chapters, genres, and tags. |
| OAuth | Open Authorization. The protocol used for Google social sign-in. |
| Reader | An authenticated user with the default role. |
| Reading Progress | A per-user, per-novel record of the last chapter number read. Stored in `reading_progress`. |
| SAD | Software Architecture Document. See `docs/SAD.md`. |
| Scheduled Chapter | A chapter with a future `publishedAt`. Automatically becomes visible after the timestamp. |
| Slug | A URL-safe identifier derived from a title (e.g., `tu-te-than-nong`). Used in novel URLs. |
| SRS | Software Requirements Specification. This document. |
| UC | Use Case code (e.g., UC-01). |
| VIP Chapter | A chapter requiring a coin unlock or active subscription to read. Displayed with a lock icon. |
| Webhook | An HTTP POST callback sent by MoMo to the platform after a payment event. |

## 5.2 Messages

| Message Code | Message Content | Trigger | Button(s) |
|---|---|---|---|
| MSG-001 | Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập. | UC-01: Duplicate email on registration | — |
| MSG-002 | Email hoặc mật khẩu không đúng. Vui lòng thử lại. | UC-02: Sign-in failure | — |
| MSG-003 | Đăng nhập với Google thất bại. Vui lòng thử lại. | UC-03: OAuth flow error or cancellation | Thử lại |
| MSG-004 | Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập. | UC-05: Successful password reset | Đăng nhập |
| MSG-005 | Số xu không đủ để mở khoá chương này. Vui lòng nạp thêm xu. | UC-18: Insufficient coin balance | Nạp xu |
| MSG-006 | Mật khẩu đã được thay đổi thành công. | UC-20: Successful password change | — |
| MSG-007 | Mật khẩu hiện tại không đúng. Vui lòng thử lại. | UC-20: Current password mismatch | — |
| MSG-008 | Đã lưu thay đổi thành công. | UC-19: Profile update success | — |
| MSG-009 | Đã theo dõi truyện. | UC-12: Follow action | — |
| MSG-010 | Đã bỏ theo dõi truyện. | UC-12: Unfollow action | — |
| MSG-011 | Thanh toán thành công. [N] xu đã được cộng vào tài khoản của bạn. | UC-17: Payment confirmed | Đọc tiếp |
| MSG-012 | Thanh toán thất bại. Vui lòng thử lại hoặc liên hệ hỗ trợ. | UC-17: Payment failure | Thử lại |
| MSG-013 | Chương VIP đã được mở khoá thành công. | UC-18: Chapter unlock success | — |
| MSG-014 | Tên hiển thị phải có từ 1 đến 100 ký tự. | UC-19: Display name validation failure | — |
| MSG-015 | Mật khẩu phải có ít nhất 8 ký tự. | UC-01, UC-05, UC-20: Password too short | — |
| MSG-016 | Mật khẩu xác nhận không khớp. Vui lòng thử lại. | UC-20: Confirmation mismatch | — |
| MSG-017 | Mật khẩu mới phải khác mật khẩu hiện tại. | UC-20: Password reuse | — |
| MSG-018 | Đã xảy ra lỗi. Vui lòng thử lại sau. | Generic server error | Thử lại |
| MSG-019 | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. | Session expiry | Đăng nhập |
| MSG-020 | Bạn không có quyền truy cập trang này. | HTTP 403 — insufficient role | Về trang chủ |
| MSG-021 | Truyện không tồn tại hoặc đã bị xoá. | HTTP 404 on novel slug | Về trang chủ |
| MSG-022 | Chương không tồn tại hoặc chưa được xuất bản. | HTTP 404 on chapter | Danh sách chương |
| MSG-023 | Email không hợp lệ. Vui lòng kiểm tra lại. | UC-01, UC-02: Email format validation | — |
| MSG-024 | Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư. | UC-05: Reset email sent (neutral) | — |
| MSG-025 | Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. | UC-05: Expired or used reset token | Gửi lại |
