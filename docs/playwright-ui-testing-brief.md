# Playwright UI Testing Brief — NovelHub

> Hand this document to an AI assistant and ask it to write Playwright UI tests for the gap test cases listed in Part 4. Everything the AI needs to know is self-contained here.

---

## Part 1 — App Context

### What it is
**NovelHub** — a Vietnamese web novel reading platform. Content is curated (no public submissions). Monetization via coins and subscriptions. The UI is Vietnamese-language.

### Tech stack
- **Framework**: Next.js 16, App Router, TypeScript
- **Auth**: Better Auth (email/password; Google OAuth is NOT automatable)
- **UI**: shadcn/ui, Tailwind v4, Vietnamese copy throughout
- **Test runner**: Playwright 1.59

### Base URL
`http://localhost:3000`  
The dev server is started automatically by Playwright (`pnpm dev`).

### User roles
| Role | Can do |
|------|--------|
| Guest (unauthenticated) | Browse novels, read free chapters |
| Reader (authenticated) | + Follow, library, buy coins, unlock VIP chapters, comments, reviews |
| Curator | + Create/edit novels and chapters in the CMS at `/curator` |
| Admin | + User management, moderation, audit log at `/admin` |

### Routes that exist (all verified in the codebase)
```
/                               Home
/novels                         Browse list + search + filters
/novels/[slug]                  Novel detail (synopsis, chapter list, reviews)
/novels/[slug]/chapters/[n]     Chapter reader
/library                        User library (protected)
/settings                       Profile settings (protected)
/pricing                        Coin packages
/payment/complete               Post-payment landing
/sign-in                        Auth
/sign-up                        Auth
/forgot-password                Auth
/reset-password                 Auth
/curator                        Curator CMS dashboard (protected, CURATOR+)
/curator/novels                 Curator novel list
/curator/novels/new             Create novel form
/curator/novels/[id]            Edit novel
/curator/novels/[id]/chapters   Chapter list for novel
/curator/novels/[id]/chapters/new     Create chapter form
/curator/novels/[id]/chapters/[id]/edit  Edit chapter form
/admin                          Admin dashboard (protected, ADMIN only)
/admin/users                    User management
/admin/moderation               Report/moderation queue
/admin/audit                    Audit log
```

---

## Part 2 — Playwright Setup & Auth System

### Directory structure
```
tests/
  constants.ts            ← auth file path constants (import from here)
  global.setup.ts         ← creates 4 auth states before any test runs
  e2e/                    ← UI tests (Chrome browser, storageState optional)
  api/                    ← API-only tests (no browser)
playwright.config.ts
```

### Auth file constants
Import auth file paths from `../constants` (relative to `tests/e2e/`):

```ts
import { AUTH_FILE, CURATOR_AUTH_FILE, ADMIN_AUTH_FILE } from "../constants"
// AUTH_FILE         = "tests/.auth/user.json"     (READER role)
// CURATOR_AUTH_FILE = "tests/.auth/curator.json"  (CURATOR role)
// ADMIN_AUTH_FILE   = "tests/.auth/admin.json"    (ADMIN role)
```

### How to apply auth per describe block
Use `test.use()` at the TOP of a describe block. No storageState = guest (unauthenticated).

```ts
// Unauthenticated (guest) — default, no storageState needed
test.describe("Guest tests", () => {
  test("...", async ({ page }) => { ... })
})

// Authenticated as reader
test.describe("Reader tests", () => {
  test.use({ storageState: AUTH_FILE })
  test("...", async ({ page }) => { ... })
})

// Authenticated as curator
test.describe("Curator tests", () => {
  test.use({ storageState: CURATOR_AUTH_FILE })
  test("...", async ({ page }) => { ... })
})

// Authenticated as admin
test.describe("Admin tests", () => {
  test.use({ storageState: ADMIN_AUTH_FILE })
  test("...", async ({ page }) => { ... })
})
```

### beforeAll pattern for test data
Fetch dynamic data (novel slugs, chapter numbers) before tests run:

```ts
let firstNovelSlug: string
let firstNovelId: string

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/novels")
  if (!res.ok()) return
  const novels: Array<{ id: string; slug: string }> = await res.json()
  if (novels.length === 0) return
  firstNovelSlug = novels[0].slug
  firstNovelId = novels[0].id
})
```

Skip gracefully if test data is unavailable:
```ts
test("some test", async ({ page }) => {
  if (!firstNovelSlug) test.skip()
  // ...
})
```

### Locator conventions
- Prefer semantic locators: `page.getByRole()`, `page.getByText()`, `page.locator('input[name="q"]')`
- UI is Vietnamese — use Vietnamese text in `getByRole({ name: "..." })` and `getByText()`
- Use `page.waitForLoadState("networkidle")` after `page.goto()` for dynamic pages
- Use `page.waitForTimeout(500)` sparingly, only when waiting for UI animation after an action
- Scope locators to avoid false positives: `page.getByRole("main").getByRole("link", ...)`

### File header convention
```ts
// UI/Integration tests: UC-XX <Use Case Name>
import { test, expect } from "@playwright/test"
import { AUTH_FILE, CURATOR_AUTH_FILE, ADMIN_AUTH_FILE } from "../constants"
```

---

## Part 3 — Existing Coverage (DO NOT DUPLICATE)

The following test cases are **already implemented**. Do not write tests for them.

### `auth.spec.ts`
- Sign-in page: form renders (email, password, button, forgot-password link)
- Sign-in: wrong credentials → `p.text-destructive` visible
- Sign-in: valid credentials → redirect to `/`
- Forgot-password: form renders, submit shows "đã gửi email đến"
- Sign-up: page renders with email and password inputs

### `auth-gates.spec.ts`
- Unauthenticated access to `/admin`, `/library`, `/settings`, `/curator` → redirect to `/sign-in`
- Reader (authenticated): CMS nav link not visible after sign-in

### `public.spec.ts`
- Home: title contains "NovelHub", brand link visible, section headings visible
- Home: nav has "Thể loại", "Bảng xếp hạng", "Hoàn thành" links
- Home: guest sees "Đăng nhập" and "Đăng ký" buttons
- Novels list: heading, search input, status filter pills visible
- Novels list: search `?q=truyen` returns results/empty without error
- Novels list: click "Hoàn thành" filter → URL gains `?status=COMPLETED`

### `novels-ui.spec.ts`
- UC-06: SSR check, novel card grid, status filter URL changes, click card → `/novels/[slug]`
- UC-07: Search input accepts text, clearing search, typo query, no results empty state
- UC-08: Genre pill adds `?genreId=` to URL
- UC-09: Non-existent slug shows 404, og:title, og:description, VIP lock icon, chapter list ascending

### `reader-ui.spec.ts`
- UC-10: Free chapter visible for guest, VIP lock overlay for guest, VIP sign-in prompt
- UC-10: Reader with 0 coins sees unlock/coin prompt, next chapter link present
- UC-10: Chapter text selectable (user-select ≠ none), non-existent chapter → 404
- UC-11: Settings button presence, dark theme via localStorage persists

### `library-ui.spec.ts`
- UC-14: `/library` redirects guest to `/sign-in`
- UC-12: Follow button visible on novel detail (authenticated)
- UC-12: Follow via API → novel appears in `/library`
- UC-14: `/library` loads for authenticated user (URL stays, main visible)
- UC-13: Reading progress — `/library` accessible

### `payments-ui.spec.ts`
- UC-17: `/pricing` accessible without auth, shows coin content, Mua button present
- UC-17: Coin balance/pricing link in navbar for authenticated user
- UC-17: `/payment/complete` loads without crash
- UC-18: VIP chapter page shows unlock button or content (authenticated)

### `community-ui.spec.ts`
- UC-15/16: Guest on novel detail — sign-in prompt in comment area
- UC-15: Review form/star rating presence (authenticated)
- UC-16: Comment text box presence (authenticated)
- UC-15: Submit review without rating → stays on page

### `curator-ui.spec.ts`
- UC-21/22 (guest): `/curator` redirects to sign-in
- UC-21/22 (reader): CMS nav link NOT visible, `/curator` shows 403/redirect, `/curator/novels/new` blocked
- UC-22 (public): Public chapter list has no DRAFT chapters
- UC-21/22 (curator): CMS nav IS visible, `/curator` accessible, `/curator/novels` accessible
- UC-22 (curator): Curator API returns DRAFT chapters, XSS in chapter content is stripped

### `admin-ui.spec.ts`
- UC-23 (guest): `/admin`, `/admin/users`, `/admin/moderation`, `/admin/audit` redirect to sign-in
- UC-23 (reader): `/admin` blocked (403/redirect), `/admin/users` blocked, `/admin/audit` blocked
- UC-23 (admin): `/admin` accessible, `/admin/users` renders, `/admin/audit` renders, `/admin/moderation` renders

### `observability-ui.spec.ts`
- NFR: `/api/health` returns 200 with `{status, timestamp}`, unknown routes → 404 not 500
- NFR: `/novels/[nonexistent]` renders (not blank), all standard routes return valid HTML titles
- NFR XSS: Free chapter page in browser does not execute injected `<script>` tags

---

## Part 4 — Target UI Test Cases (WRITE THESE)

These are the gaps between the RTM and the current automated suite. Write tests for these. Group them by use case and put them in the correct spec file (file name listed for each group).

---

### File: `tests/e2e/auth.spec.ts` — append to existing file

**UC-01 Sign Up form validation**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-AUTH-002 | Valid sign-up flow | Go to `/sign-up`, fill valid name+email+password, submit | Redirects away from `/sign-up` (to `/` or email-verification page) OR shows success message |
| TC-UI-AUTH-003 | Duplicate email error | Fill an already-registered email (use `process.env.TEST_USER_EMAIL`), submit | Error message visible on page |
| TC-UI-AUTH-004 | Invalid email format | Type `notanemail` in email field, submit | Browser or app validation prevents submission / shows error |
| TC-UI-AUTH-005 | Empty name → error | Leave name blank (if name field exists), submit | Error or prevent submission |

**UC-04 Sign Out**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-AUTH-008 | Sign out via UI | Auth as reader, go to `/`, click the user menu / sign-out button | "Đăng nhập" button visible in navbar (session cleared) |
| TC-UI-AUTH-009 | Protected route after sign-out | After sign out, navigate to `/library` | Redirected to `/sign-in` |

> Hints: The sign-out button is likely in a dropdown triggered by clicking the user avatar in the nav. Try `page.getByRole("button", { name: /avatar|account|menu/i })` or look for a button near the pricing link. After clicking, look for a "Đăng xuất" or "Sign out" menu item. Use `page.locator('[data-testid*="signout"], button:has-text("Đăng xuất")')`.

---

### File: `tests/e2e/novels-ui.spec.ts` — append to existing file

**UC-06 Browse — additional coverage**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-BROWSE-006 | URL `?status=` filter removes non-matching novels | Go to `/novels?status=COMPLETED`, check all visible novel cards | Cards present should only be COMPLETED status novels, or no cards (empty state), not a mix |
| TC-UI-BROWSE-008 | Back navigation preserves URL state | Go to `/novels?status=COMPLETED`, click a novel card, press browser back | Returns to `/novels?status=COMPLETED` (URL intact) |

**UC-07 Search — additional coverage**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-SEARCH-004 | Enter key submits search | Type in search input, press `Enter` | URL gains `?q=<term>` |
| TC-UI-SEARCH-005 | URL `?q=` pre-fills input | Go to `/novels?q=test` | Search input shows `test` as its value |

**UC-09 Novel Detail — additional coverage**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-NOVEL-003 | Cover, title, synopsis visible | Go to `/novels/[firstNovelSlug]` | Cover image (`img`), novel title (h1/h2), and synopsis text all visible |
| TC-UI-NOVEL-008 | "Đọc ngay" button navigates to first chapter | Go to `/novels/[firstNovelSlug]`, click the read button | URL changes to `/novels/[slug]/chapters/[n]` |
| TC-UI-NOVEL-009 | Genre tags visible | Go to `/novels/[firstNovelSlug]` | At least one genre tag/badge is visible |

---

### File: `tests/e2e/reader-ui.spec.ts` — append to existing file

**UC-10 Chapter reader — additional navigation**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-READ-005 | Previous chapter link | Go to chapter 2+ of a novel with multiple chapters | A "prev" / "trước" link exists and its href contains `/chapters/` with a lower number |
| TC-UI-READ-006 | Page title includes chapter info | Go to any chapter page | `document.title` contains either the novel title or chapter number |
| TC-UI-READ-007 | Breadcrumb / back-to-novel link | Go to any chapter page | A link that navigates back to the novel detail page (`/novels/[slug]`) is visible |

---

### File: `tests/e2e/library-ui.spec.ts` — append to existing file

**UC-12 Follow/Unfollow**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-LIB-001b | Follow button text changes | Auth as reader, go to novel detail, click "Theo dõi" | Button text changes to "Đang theo dõi" (or equivalent) |
| TC-UI-LIB-004 | Unfollow removes from library | Auth as reader, ensure following, go to `/library`, click unfollow (or toggle via API then reload) | Novel no longer appears in library list |

**UC-14 Library tabs**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-LIB-008 | Library tabs visible | Auth as reader, go to `/library` | Tabs or filter chips for "Đang theo dõi" / "Đang đọc" or equivalent visible |
| TC-UI-LIB-011 | Empty state message | Auth as reader (fresh), go to `/library` when nothing followed | Empty state illustration or text message visible (not a blank page) |

---

### File: `tests/e2e/community-ui.spec.ts` — append to existing file

**UC-15 Reviews — form interaction**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-COMM-002 | Star rating highlights | Auth as reader, go to `/novels/[slug]`, click a star | That star and all stars before it appear highlighted/filled |
| TC-UI-COMM-004 | Submit valid review | Auth as reader, select a star rating, fill review text, submit | Review appears in the list with the correct rating, OR a success toast/message shown |

**UC-16 Comments — form interaction**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-COMM-009 | Submit comment | Auth as reader, go to `/novels/[slug]`, type a comment, submit | Comment appears in the comment list with the author's name |
| TC-UI-COMM-010 | Comment shows author | After submitting a comment, inspect the comment card | Author name visible alongside the comment text |

> Note: If the review/comment feature is not fully rendered (no form found), use `test.skip()` gracefully rather than failing.

---

### File: `tests/e2e/payments-ui.spec.ts` — append to existing file

**UC-17 Payment flow**

| TC ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| TC-UI-PAY-004 | Click "Mua" initiates payment | Auth as reader, go to `/pricing`, click a "Mua" button | Either navigates to MoMo URL (external), OR shows a MoMo redirect/modal, OR stays on page with order summary |
| TC-UI-PAY-007 | Payment complete page shows status | Go to `/payment/complete` | Body text contains a status message ("thành công", "thất bại", "đang xử lý", or similar) OR a CTA button visible |

---

### File: `tests/e2e/settings-ui.spec.ts` — NEW FILE

**UC-19 Profile / Settings**

> This is a new spec file. Create it at `tests/e2e/settings-ui.spec.ts`.

```
// UI/Integration tests: UC-19 Profile Update
import { test, expect } from "@playwright/test"
import { AUTH_FILE } from "../constants"
```

| TC ID | Scenario | Role | Steps | Expected |
|-------|----------|------|-------|----------|
| TC-UI-PROF-001 | `/settings` renders | Reader | Go to `/settings` | Page renders, not redirected, form visible |
| TC-UI-PROF-002 | Name field pre-filled | Reader | Go to `/settings` | Name input has a non-empty value (current user's name) |
| TC-UI-PROF-003 | Valid name update → success | Reader | Change name to `"Test Updated Name"`, submit | Success toast / "thành công" message appears, OR name field still has the new value |
| TC-UI-PROF-004 | Empty name → error | Reader | Clear name field, submit | Error shown OR submission prevented |

---

### File: `tests/e2e/curator-ui.spec.ts` — append to existing file

**UC-21 Curator — Novel creation form**

| TC ID | Scenario | Role | Steps | Expected |
|-------|----------|------|-------|----------|
| TC-UI-CUR-004 | Novel creation form renders | Curator | Go to `/curator/novels/new` | Form has title input, synopsis textarea, status selector visible |
| TC-UI-CUR-005 | Empty title shows validation | Curator | Go to `/curator/novels/new`, click submit without filling title | Error message or HTML validation prevents submission |
| TC-UI-CUR-010 | Edit novel form pre-filled | Curator | Create a novel via API, go to `/curator/novels/[id]` | Title input shows existing novel title |

**UC-22 Curator — Chapter creation form**

| TC ID | Scenario | Role | Steps | Expected |
|-------|----------|------|-------|----------|
| TC-UI-CUR-006b | Chapter creation form renders | Curator | Create novel via API, go to `/curator/novels/[id]/chapters/new` | Form shows title input, content textarea, status selector |
| TC-UI-CUR-007 | DRAFT status is default | Curator | Go to `/curator/novels/[id]/chapters/new` | Status field/selector defaults to "DRAFT" |

> Curator test data setup hint:
```ts
test.beforeAll(async ({ request }) => {
  const res = await request.post("/api/novels", {
    data: { title: `UI Test Novel ${Date.now()}`, synopsis: "For UI tests", status: "ONGOING" },
  })
  if (res.ok()) testNovelId = (await res.json()).id
})
```

---

### File: `tests/e2e/admin-ui.spec.ts` — append to existing file

**UC-23 Admin — content of pages**

| TC ID | Scenario | Role | Steps | Expected |
|-------|----------|------|-------|----------|
| TC-UI-ADM-005 | User list has entries | Admin | Go to `/admin/users` | At least one user entry (row or card) visible in the list |
| TC-UI-ADM-006 | Moderation queue renders items | Admin | Go to `/admin/moderation` | Either report items visible OR empty state message shown |
| TC-UI-ADM-007 | Audit log has entries | Admin | Go to `/admin/audit` | At least one audit log entry visible OR empty state shown |

---

## Part 5 — Code Quality Rules

Follow these rules when writing any test:

1. **Skip, don't fail, on missing data**: If `firstNovelSlug` is not set or API returns no novels, call `test.skip()` immediately.

2. **Lenient for incomplete features**: If the UI element might not be implemented yet, use `expect(count).toBeGreaterThanOrEqual(0)` or a try/skip pattern rather than a hard assertion that always fails.

3. **No hardcoded IDs or slugs**: All IDs and slugs must come from the API in `beforeAll`.

4. **Vietnamese text in locators**: UI copy is Vietnamese. Examples:
   - "Đăng nhập" = Sign in
   - "Đăng ký" = Sign up  
   - "Đăng xuất" = Sign out
   - "Theo dõi" = Follow
   - "Đang theo dõi" = Following (already followed)
   - "Mở khóa" = Unlock
   - "Thư viện" = Library
   - "Bình luận" = Comment
   - "Đánh giá" = Review/Rating
   - "Xu" / "xu" = Coins
   - "Mua" = Buy
   - "Cài đặt" = Settings

5. **Prefer `page.waitForLoadState("networkidle")` over timeouts** after navigation.

6. **Test isolation**: Each test must be independently runnable. Don't rely on state from a previous test.

7. **One describe block per use-case group**, with `test.use()` for the role at the top.

---

## Part 6 — Environment Variables Available

The `.env.test` file provides these during test runs:

```
TEST_USER_EMAIL=...        # READER role
TEST_USER_PASSWORD=...
TEST_CURATOR_EMAIL=...     # CURATOR role
TEST_CURATOR_PASSWORD=...
TEST_ADMIN_EMAIL=...       # ADMIN role
TEST_ADMIN_PASSWORD=...
TEST_VICTIM_EMAIL=...      # READER (used for admin manipulation tests)
TEST_VICTIM_PASSWORD=...
```

Access in tests: `process.env.TEST_USER_EMAIL!`

---

## Appendix — Annotated RTM Extract (Un-automated UI TCs)

The full RTM has 142 UI/Integration test cases. Below are the ~50 not yet automated, annotated with route, expected locator hints, and difficulty.

| TC ID | Use Case | Route | Scenario | Key Locator / Hint | Difficulty |
|-------|----------|-------|----------|--------------------|------------|
| TC-UI-AUTH-002 | UC-01 Register | `/sign-up` | Valid sign-up → redirect/success | `input[name="name"]`, `input[type="email"]`, `input[type="password"]`, submit button | Low |
| TC-UI-AUTH-003 | UC-01 Register | `/sign-up` | Duplicate email → error | Use `TEST_USER_EMAIL`, expect `p.text-destructive` or error text | Low |
| TC-UI-AUTH-004 | UC-01 Register | `/sign-up` | Invalid email → validation | Fill `notanemail`, submit, expect browser or app validation | Low |
| TC-UI-AUTH-005 | UC-01 Register | `/sign-up` | Empty name → error | Leave name blank, submit | Low |
| TC-UI-AUTH-008 | UC-04 Sign Out | `/` | Click sign-out → "Đăng nhập" visible | Find user dropdown, click "Đăng xuất" | Medium |
| TC-UI-AUTH-009 | UC-04 Sign Out | `/library` | After sign-out, protected route redirects | Follow TC-UI-AUTH-008, then `page.goto("/library")` | Low |
| TC-UI-BROWSE-006 | UC-06 Browse | `/novels?status=COMPLETED` | Filter shows only COMPLETED novels | Check novel cards vs COMPLETED status | Medium |
| TC-UI-BROWSE-008 | UC-06 Browse | `/novels` | Back navigation preserves filter | Click novel, press browser back, check URL | Low |
| TC-UI-SEARCH-004 | UC-07 Search | `/novels` | Enter key submits search | `searchInput.press("Enter")`, check URL | Low |
| TC-UI-SEARCH-005 | UC-07 Search | `/novels?q=test` | URL pre-fills input | `expect(input).toHaveValue("test")` | Low |
| TC-UI-NOVEL-003 | UC-09 Detail | `/novels/[slug]` | Cover, title, synopsis visible | `img`, `h1`, paragraph with synopsis text | Low |
| TC-UI-NOVEL-008 | UC-09 Detail | `/novels/[slug]` | "Đọc ngay" navigates to chapter | `button:has-text("Đọc ngay")` or similar | Low |
| TC-UI-NOVEL-009 | UC-09 Detail | `/novels/[slug]` | Genre tags visible | `a[href*="genreId"]` or genre badge elements | Low |
| TC-UI-READ-005 | UC-10 Reader | `/novels/[slug]/chapters/[n]` | Previous chapter link | `a[href*="/chapters/"]` with lower number than current | Medium |
| TC-UI-READ-006 | UC-10 Reader | `/novels/[slug]/chapters/[n]` | Page title has chapter info | `page.title()` contains novel title or "Chương" | Low |
| TC-UI-READ-007 | UC-10 Reader | `/novels/[slug]/chapters/[n]` | Back-to-novel link | `a[href="/novels/${slug}"]` | Low |
| TC-UI-LIB-001b | UC-12 Follow | `/novels/[slug]` | Click follow → button changes text | `button:has-text("Theo dõi")` → click → text becomes "Đang theo dõi" | Medium |
| TC-UI-LIB-004 | UC-12 Follow | `/library` | Unfollow removes from library | Toggle follow via API, reload library | Medium |
| TC-UI-LIB-008 | UC-14 Library | `/library` | Tabs visible | `role="tab"` or elements with "Đang theo dõi" text | Low |
| TC-UI-LIB-011 | UC-14 Library | `/library` | Empty library has empty state | Check for empty state text when nothing followed | Medium |
| TC-UI-COMM-002 | UC-15 Review | `/novels/[slug]` | Click star → highlights | Star locator, check aria-pressed or class after click | Medium |
| TC-UI-COMM-004 | UC-15 Review | `/novels/[slug]` | Submit valid review | Select star, fill textarea, submit, check list or toast | High |
| TC-UI-COMM-009 | UC-16 Comment | `/novels/[slug]` | Submit comment → appears in list | Comment textarea, submit, check new comment in DOM | High |
| TC-UI-COMM-010 | UC-16 Comment | `/novels/[slug]` | Comment shows author name | After submit, check comment card has author name | Medium |
| TC-UI-PAY-004 | UC-17 Payment | `/pricing` | Click "Mua" initiates | Click buy button, check navigation or modal | Medium |
| TC-UI-PAY-007 | UC-17 Payment | `/payment/complete` | Complete page shows status | Check body text for success/failure keywords | Low |
| TC-UI-PROF-001 | UC-19 Settings | `/settings` | Page renders with form | `page.goto("/settings")`, `expect(page).toHaveURL("/settings")` | Low |
| TC-UI-PROF-002 | UC-19 Settings | `/settings` | Name pre-filled | `input[name="name"]` has non-empty value | Low |
| TC-UI-PROF-003 | UC-19 Settings | `/settings` | Valid name → success | Change name, submit, look for toast/success | Medium |
| TC-UI-PROF-004 | UC-19 Settings | `/settings` | Empty name → error | Clear name, submit, check error | Low |
| TC-UI-CUR-004 | UC-21 Curator | `/curator/novels/new` | Novel form renders | Title input, synopsis textarea, status select | Low |
| TC-UI-CUR-005 | UC-21 Curator | `/curator/novels/new` | Empty title → validation | Submit without title, check for error | Low |
| TC-UI-CUR-010 | UC-21 Curator | `/curator/novels/[id]` | Edit form pre-filled | Create novel via API, navigate to edit page, check title input | Medium |
| TC-UI-CUR-006b | UC-22 Curator | `/curator/novels/[id]/chapters/new` | Chapter form renders | Title input, content editor, status select | Low |
| TC-UI-CUR-007 | UC-22 Curator | `/curator/novels/[id]/chapters/new` | DRAFT is default status | Check status select default value | Low |
| TC-UI-ADM-005 | UC-23 Admin | `/admin/users` | User list has entries | Table rows or user cards present | Low |
| TC-UI-ADM-006 | UC-23 Admin | `/admin/moderation` | Moderation items or empty state | Check for report items or empty state text | Low |
| TC-UI-ADM-007 | UC-23 Admin | `/admin/audit` | Audit log entries or empty state | Check for log entries or empty state text | Low |

**Difficulty legend**: Low = straightforward nav+assert, Medium = requires interaction or dynamic data, High = depends on feature working end-to-end.
