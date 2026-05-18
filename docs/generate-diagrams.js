// generate-diagrams.js
// Usage (from project root): node docs/generate-diagrams.js
// Requires internet access — uses the public PlantUML server.
// Generates 23 activity-diagram PNGs into docs/figures/
// then patches docs/SRS.md with the image references.

const https = require('https');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

// ── PlantUML encoding (deflate-raw + custom base-64) ─────────────────────────
function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10; if (b < 26) return String.fromCharCode(65 + b);
  b -= 26; if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  return b === 0 ? '-' : b === 1 ? '_' : '?';
}
function encode64(data) {
  let r = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i], b2 = data[i+1] ?? 0, b3 = data[i+2] ?? 0;
    r += encode6bit(b1 >> 2)
       + encode6bit(((b1 & 3) << 4) | (b2 >> 4))
       + encode6bit(((b2 & 15) << 2) | (b3 >> 6))
       + encode6bit(b3 & 63);
  }
  return r;
}
function encodePuml(text) {
  const compressed = zlib.deflateRawSync(Buffer.from(text, 'utf-8'), { level: 9 });
  return encode64(compressed);
}

// ── HTTP download ──────────────────────────────────────────────────────────────
function downloadPng(encoded, outPath) {
  return new Promise((resolve, reject) => {
    const url = `https://www.plantuml.com/plantuml/png/${encoded}`;
    const file = fs.createWriteStream(outPath);
    https.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      } else {
        file.close(); fs.unlink(outPath, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    }).on('error', e => { file.close(); fs.unlink(outPath, () => {}); reject(e); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Shared skinparam header ────────────────────────────────────────────────────
const SKIN = `
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam ArrowColor #334466
skinparam ActivityBorderColor #336699
skinparam ActivityBackgroundColor #EBF4FA
skinparam ActivityBorderThickness 1
skinparam ActivityDiamondBorderColor #336699
skinparam ActivityDiamondBackgroundColor #FFF9E6
skinparam NoteBackgroundColor #FFFCE0
skinparam NoteBorderColor #CCBB00
skinparam swimlaneBorderColor #AABBCC
skinparam swimlaneWidth 160
skinparam shadowing false
`.trim();

// ── 23 PlantUML activity diagrams (numbered activities) ───────────────────────
const DIAGRAMS = {

'uc-01': `@startuml
${SKIN}
title UC-01: Register Account
|Guest|
start
:(1) Open /sign-up page;
:(2) Enter display name,\\nemail, and password;
:(3) Submit registration form;
|System|
:(4) Validate all input fields;
if (All fields valid?) then (no)
  :Return inline validation errors;
  |Guest|
  :Correct input and resubmit;
  stop
else (yes)
endif
:(5) Query users table by email;
if (Email already registered?) then (yes)
  :(6) Display MSG-001;
  stop
else (no)
endif
:(7) Hash password with bcrypt;
:(8) INSERT users record\\n(role=reader, coin_balance=0);
:(9) Create session + set cookie;
:(10) Redirect to /;
|Guest|
:Home page displayed;
stop
@enduml`,

'uc-02': `@startuml
${SKIN}
title UC-02: Sign In with Email
|Guest|
start
:(1) Open /sign-in page;
:(2) Enter email and password;
:(3) Submit sign-in form;
|System|
:(4) Query users table by email;
if (Account found?) then (no)
  :Display MSG-002;
  stop
else (yes)
endif
:(5) Verify password against bcrypt hash;
if (Password matches?) then (no)
  :Display MSG-002;
  stop
else (yes)
endif
:(6) Check IP rate limit\\n(max 10 attempts / 15 min);
if (Rate limit exceeded?) then (yes)
  :Block sign-in for 15 minutes;
  stop
else (no)
endif
:(7) Create session record;
:(8) Set session cookie;
:(9) Redirect to callbackURL or /;
|Guest|
:Authenticated page loaded;
stop
@enduml`,

'uc-03': `@startuml
${SKIN}
title UC-03: Sign In with Google
|Guest|
start
:(1) Click "Tiep tuc voi Google";
|System|
:(2) Build OAuth authorization URL;
:(3) Redirect guest to Google;
|Google OAuth|
:(4) Display consent screen;
|Guest|
:(5) Grant permission;
|Google OAuth|
:(6) Return authorization code\\nvia callback redirect;
|System|
:(7) Exchange code for access token;
:(8) Retrieve Google profile\\n(subject ID, email, name);
:(9) Search account by Google subject ID;
if (Account found by subject ID?) then (no)
  :(10) Search account by email address;
  if (Email account exists?) then (yes)
    :Link Google identity to existing account;
  else (no)
    :(11) CREATE users record\\n(role=reader, coin_balance=0,\\nname from Google profile);
  endif
else (yes)
endif
:Create session record;
:Set session cookie;
:Redirect to / or callbackURL;
|Guest|
:Authenticated page loaded;
stop
@enduml`,

'uc-04': `@startuml
${SKIN}
title UC-04: Sign Out
|User|
start
:(1) Open user dropdown menu;
:(2) Click "Dang xuat";
|System|
:(3) Send POST to sign-out API endpoint;
:(4) Extract session token from cookie;
:(5) DELETE session record from sessions table;
:(6) Set cookie Max-Age = 0\\n(clear from browser);
:(7) Redirect to /;
|User|
:Home page shown (as Guest);
stop
@enduml`,

'uc-05': `@startuml
${SKIN}
title UC-05: Reset Password
|User|
start
:(1) Click "Quen mat khau?" on sign-in page;
|System|
:(2) Render forgot-password form;
|User|
:(3) Enter registered email and submit;
|System|
:(4) Validate email format;
if (Format valid?) then (no)
  :Display MSG-023;
  stop
else (yes)
endif
:(5) Look up account by email;
:(6) Display neutral MSG-024\\n(always — prevents enumeration);
if (Account exists with password?) then (yes)
  :(7) Generate 32-byte secure reset token;
  :(8) Store hashed token\\n(expiry = now + 1 hour);
  :(9) Send reset email with token link;
else (no)
  note right: No action taken
endif
|User|
:(10) Click reset link from email;
|System|
:(11) Validate token\\n(exists, not expired, not used);
if (Token valid?) then (no)
  :Display MSG-025;
  stop
else (yes)
endif
:(12) Render new-password form;
|User|
:(13) Enter and confirm new password;
:(14) Submit new password;
|System|
:(15) Validate new password\\n(>= 8 chars, differs from current);
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:(16) Hash and store new password;
:(17) Invalidate reset token;
:(18) Delete all user sessions;
:Redirect to /sign-in with MSG-004;
|User|
:Sign-in page shown;
stop
@enduml`,

'uc-06': `@startuml
${SKIN}
title UC-06: Browse Novel List
|User|
start
:(1) Navigate to /novels\\n(optional: q, status, genre, sort, page);
|System|
:(2) Parse query parameters;
:(3) Build DB query with active filters;
:(4) Execute paginated query\\nagainst novels table (max 30);
:(5) Count total matching novels;
if (Novels found?) then (yes)
  :(6) Render novel grid + pagination;
else (no)
  :(6) Render empty-state message;
endif
:(7) Render filter pills,\\nsearch bar, result count;
|User|
:(8) View novel list;
if (User changes filter or sort?) then (yes)
  |System|
  :Update URL query parameters;
  :Re-query with new filters;
  :Re-render grid and count;
  |User|
else (no)
endif
stop
@enduml`,

'uc-07': `@startuml
${SKIN}
title UC-07: Search Novels
|User|
start
:(1) Type query in search input;
|System|
:(2) Debounce input 300 ms;
:(3) Update URL param q=<query>;
:(4) Send search request to Meilisearch;
if (Meilisearch available?) then (yes)
  |Meilisearch|
  :Run typo-tolerant search\\non title and synopsis;
  :Return ranked results;
  |System|
else (no)
  :Fallback: PostgreSQL\\nILIKE search on title;
endif
:(5) Evaluate results;
if (Results found?) then (yes)
  :(6) Render matched novel grid;
else (no)
  :(6) Render empty state;
endif
:(7) Update result count;
|User|
:(8) View search results;
if (User clears input?) then (yes)
  |System|
  :Remove q from URL;
  :Restore full novel list;
  |User|
else (no)
endif
stop
@enduml`,

'uc-08': `@startuml
${SKIN}
title UC-08: Filter Novels
|User|
start
:(1) Click a status pill;
|System|
:(2) Toggle status param in URL;
:(3) Re-query novels with status filter;
:(4) Highlight active pill;
:(5) Update result count;
:(6) Re-render novel grid;
|User|
:(7) View filtered results;
if (User clicks a genre pill?) then (yes)
  |System|
  :(8) Toggle genre param in URL;
  :(9) Re-query with status AND genre;
  :(10) Re-render grid and count;
  |User|
  :View doubly-filtered results;
else (no)
endif
if (User deselects active pill?) then (yes)
  |System|
  :Remove param from URL;
  :Re-query without that filter;
  |User|
else (no)
endif
stop
@enduml`,

'uc-09': `@startuml
${SKIN}
title UC-09: View Novel Detail
|User|
start
:(1) Navigate to /novels/[slug];
|System|
:(2) Fetch novel by slug;
if (Novel found?) then (no)
  :(3) Return 404 page;
  stop
else (yes)
endif
fork
  :(4) Fetch published chapters\\n(publishedAt <= now());
fork again
  :(5) Fetch reading_progress\\n(if authenticated);
fork again
  :(6) Fetch up to 6\\nrecommended novels;
fork again
  :(7) Increment totalViews\\n(fire-and-forget);
end fork
:(8) Render hero section\\n(cover, badges, stats, CTAs);
:(9) Render body:\\nsynopsis, tags, reviews,\\nchapter list, recommendations;
note right
  CTA logic:
  No chapters → disabled
  No progress → "Doc tu dau"
  Has progress → "Tiep tuc doc"
end note
|User|
:Novel detail page displayed;
stop
@enduml`,

'uc-10': `@startuml
${SKIN}
title UC-10: Read Chapter
|User|
start
:(1) Navigate to\\n/novels/[slug]/chapters/[number];
|System|
:(2) Fetch chapter by novelId + number;
if (Chapter published?) then (no)
  :(3) Return 404 page;
  stop
else (yes)
endif
:(4) Evaluate VIP access;
if (chapter.isVip = true?) then (yes)
  if (User authenticated?) then (no)
    :isLocked = true (guest);
  else (yes)
    :Check chapter_unlocks\\nand subscriptions;
    if (Access granted?) then (yes)
      :isLocked = false;
    else (no)
      :isLocked = true;
    endif
  endif
else (no)
  :isLocked = false;
endif
:(5) Strip or include content\\nbased on isLocked;
if (isLocked = true?) then (yes)
  :Render lock overlay\\n(coin cost, sign-in prompt);
else (no)
  :(6) Render ChapterReader\\nwith full content;
endif
if (User authenticated?) then (yes)
  :(7) Upsert reading_progress\\n(only if chapterNumber increases);
else (no)
endif
:(8) Display estimated reading time;
|User|
:Chapter page displayed;
stop
@enduml`,

'uc-11': `@startuml
${SKIN}
title UC-11: Adjust Reader Settings
|Reader|
start
:(1) Open chapter reader page;
|System|
:(2) Read settings from localStorage\\nor apply defaults;
:(3) Apply settings to reading area;
|Reader|
:(4) Click gear icon;
:(5) Settings sheet opens (right side);
fork
  :(6) Select theme (Sang/Toi/Dem);
fork again
  :(6) Select font family (Serif/Sans);
fork again
  :(6) Adjust font size (14–26 px);
fork again
  :(6) Adjust line height (1.4–2.2);
fork again
  :(6) Adjust content width (480–900 px);
end fork
|System|
:(7) Apply change to reading area\\n(real-time, no save button);
:(8) Serialize and write settings\\nto localStorage["reader-settings"];
|Reader|
:(9) Reading area updates immediately;
note right
  Settings persist on same
  browser/device only.
  Not stored in database.
end note
stop
@enduml`,

'uc-12': `@startuml
${SKIN}
title UC-12: Follow Novel
|Reader|
start
:(1) View novel detail page;
:(2) Follow button shows current state\\n("Theo doi" or "Dang theo doi");
:(3) Click follow/unfollow button;
if (User authenticated?) then (no)
  |System|
  :Redirect to /sign-in?callbackURL=...;
  stop
else (yes)
endif
|System|
:(4) Optimistically update button state in UI;
:(5) Check existing novel_follows record;
if (Currently following?) then (yes)
  :(6) DELETE novel_follows (userId, novelId);
  :Update button → "Theo doi";
else (no)
  :(6) INSERT novel_follows\\n(userId, novelId, createdAt);
  :Update button → "Dang theo doi";
endif
note right
  Phase 3: Notify followers
  when new chapter published.
end note
|Reader|
:Button state updated;
stop
@enduml`,

'uc-13': `@startuml
${SKIN}
title UC-13: Track Reading Progress
|Reader|
start
:(1) Open any chapter page\\n(authenticated);
|System|
:(2) Chapter rendered (UC-10);
:(3) Query reading_progress\\nfor (userId, novelId);
if (Record exists?) then (yes)
  :(4) Compare new vs stored chapter number;
  if (newChapterNumber >=\\nstoredChapterNumber?) then (yes)
    :UPDATE reading_progress\\nSET chapterId = new, updatedAt = now();
  else (no)
    note right: No update — revisiting\\nearlier chapter
  endif
else (no)
  :(4) INSERT reading_progress\\n(userId, novelId, chapterId, updatedAt);
endif
:(5) CTA on novel detail page:\\n"Tiep tuc doc chuong [N]";
:(6) Progress bar in library:\\n(lastChapter / totalChapters) x 100%;
|Reader|
:Progress silently recorded;
stop
@enduml`,

'uc-14': `@startuml
${SKIN}
title UC-14: View Library
|Reader|
start
:(1) Navigate to /library;
|System|
:(2) Check authentication;
if (User authenticated?) then (no)
  :Redirect to /sign-in?callbackURL=/library;
  stop
else (yes)
endif
:(3) Fetch novel_follows joined with novels;
:(4) Join with reading_progress\\n(last chapter per novel);
:(5) Parse tab param (default: "all");
:(6) Filter novels by tab:\\n- "reading": lastChapter < totalChapters\\n- "completed": lastChapter >= totalChapters\\n- "all": no filter;
if (Library empty for tab?) then (yes)
  :(7) Render empty state\\n(icon + message + "Kham pha truyen" link);
else (no)
  :(7) Render novel grid\\nwith progress bars;
endif
:(8) Render three filter tabs;
|Reader|
:(9) View library;
if (Click filter tab?) then (yes)
  |System|
  :(10) Update URL tab param;
  :Re-filter novels;
  :Re-render grid;
  |Reader|
else (no)
endif
stop
@enduml`,

'uc-15': `@startuml
${SKIN}
title UC-15: Write Review
|Reader|
start
:(1) Click "Viet danh gia"\\non novel detail page;
|System|
:(2) Check authentication;
if (User authenticated?) then (no)
  :Show sign-in prompt;
  stop
else (yes)
endif
:(3) Check for existing review (userId, novelId);
if (Review already exists?) then (yes)
  :(4) Pre-populate form with\\nexisting rating and text;
else (no)
  :(4) Render empty review form;
endif
|Reader|
:(5) Select star rating (1–5);
:(6) Optionally type review text;
:(7) Click "Gui danh gia";
|System|
:(8) Validate:\\n- Rating required (1–5)\\n- Text <= 2000 chars;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:(9) UPSERT reviews record\\n(userId, novelId, rating, body);
:(10) Recalculate novels.avgRating\\n= AVG(rating) for this novel;
|Reader|
:Reviews section refreshes;
stop
@enduml`,

'uc-16': `@startuml
${SKIN}
title UC-16: Leave Comment
|Reader|
start
:(1) Click comment input\\non novel detail page;
|System|
:(2) Check authentication;
if (User authenticated?) then (no)
  :Show sign-in prompt;
  stop
else (yes)
endif
|Reader|
if (Posting a reply?) then (yes)
  :(3) Click "Tra loi" on a comment;
  :(4) Type in indented reply input;
else (no)
  :(3) Type in main comment input;
endif
:(5) Click "Gui";
|System|
:(6) Validate:\\n- Content non-empty\\n- Length <= 1000 chars;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
if (Is a reply?) then (yes)
  :(7) INSERT comments\\n(parentId = parent comment ID);
else (no)
  :(7) INSERT comments (parentId = null);
endif
:(8) Sort: top-level newest-first,\\nreplies oldest-first;
|Reader|
:(9) Comment appears immediately;
:(10) Display comment in list;
stop
@enduml`,

'uc-17': `@startuml
${SKIN}
title UC-17: Purchase Coins
|Reader|
start
:(1) Navigate to /pricing;
:(2) View active coin packages;
:(3) Select package and click "Mua N xu";
|System|
:(4) Check authentication;
if (Authenticated?) then (no)
  :Show sign-in prompt;
  stop
else (yes)
endif
:(5) INSERT payments record\\n(status=PENDING, orderId, userId, packageId);
:(6) Call MoMo createPayment API;
if (MoMo API success?) then (no)
  :Show payment error;
  stop
else (yes)
endif
:(7) Receive payUrl from MoMo;
:(8) Redirect reader to MoMo payment page;
|Reader|
:(9) Complete payment on MoMo interface;
|MoMo Gateway|
:(10) POST webhook to\\n/api/payments/momo/webhook;
|System|
:(11) Verify HMAC-SHA256 signature;
if (Signature valid?) then (no)
  :Return HTTP 400;
  stop
else (yes)
endif
if (resultCode = 0?) then (yes)
  :(12) BEGIN transaction;
  :UPDATE payments SET COMPLETED;
  :INCREMENT users.coin_balance;
  :INSERT coin_transactions (CREDIT);
  :COMMIT transaction;
  :(13) Return HTTP 200 to MoMo;
  |Reader|
  :(14) Redirect to /payments/success;
  :Show MSG-011;
else (no)
  |System|
  :UPDATE payments SET FAILED;
  |Reader|
  :Redirect to /payments/failure;
  :Show MSG-012;
endif
stop
@enduml`,

'uc-18': `@startuml
${SKIN}
title UC-18: Unlock VIP Chapter
|Reader|
start
:(1) View locked VIP chapter;
:(2) Overlay shows: coin cost,\\ncurrent balance;
:(3) Click "Mo khoa";
|System|
:(4) Check authentication;
if (Authenticated?) then (no)
  :Return HTTP 401;
  stop
else (yes)
endif
:(5) Re-verify chapter is still locked for user;
if (Already unlocked?) then (yes)
  :Reload chapter (no charge);
  stop
else (no)
endif
:(6) Check coin_balance >= coinCost;
if (Balance sufficient?) then (no)
  :Display MSG-005;
  :Show link to /pricing;
  stop
else (yes)
endif
:(7) BEGIN transaction;
:INSERT chapter_unlocks\\n(userId, chapterId, coinSpent);
:UPDATE users.coin_balance -= coinCost;
:INSERT coin_transactions (DEBIT);
:COMMIT transaction;
:(8) Reload chapter with full content;
|Reader|
:Chapter unlocked;
:Show MSG-013;
stop
@enduml`,

'uc-19': `@startuml
${SKIN}
title UC-19: Update Profile
|User|
start
:(1) Navigate to /settings;
|System|
:(2) Check authentication;
if (Authenticated?) then (no)
  :Redirect to /sign-in?callbackURL=/settings;
  stop
else (yes)
endif
:(3) Fetch users record;
:(4) Render profile form\\n(name, bio pre-filled;\\nemail read-only);
|User|
:(5) Edit display name and/or bio;
note right
  Live character counter:
  e.g. "47/300" below bio
end note
:(6) Click "Luu thay doi";
|System|
:(7) Validate server-side:\\n- name: 1–100 chars, required\\n- bio: 0–300 chars, optional;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:(8) UPDATE users SET name, bio;
:(9) Display MSG-008 (saved);
|User|
:(10) Profile updated;
stop
@enduml`,

'uc-20': `@startuml
${SKIN}
title UC-20: Change Password
|User|
start
:(1) Navigate to /settings password section;
|System|
:(2) Check if account has password\\n(not Google-only);
if (Email/password account?) then (no)
  :Hide "Doi mat khau" section;
  stop
else (yes)
endif
|User|
:(3) Enter current password,\\nnew password,\\nconfirm new password;
:(4) Click "Doi mat khau";
|System|
:(5) Verify current password against bcrypt hash;
if (Current password correct?) then (no)
  :Display MSG-007;
  stop
else (yes)
endif
:(6) Validate new password:\\n>= 8 chars, differs from current;
if (New password valid?) then (no)
  :Show MSG-015 or MSG-017;
  stop
else (yes)
endif
:(7) Check new and confirm passwords match;
if (Passwords match?) then (no)
  :Show MSG-016;
  stop
else (yes)
endif
:(8) Hash new password with bcrypt;
:(9) UPDATE users.passwordHash;
:(10) DELETE all sessions\\nexcept current session;
:(11) Display MSG-006 (success);
|User|
:Password changed;
note right
  Other devices are
  signed out automatically.
end note
stop
@enduml`,

'uc-21': `@startuml
${SKIN}
title UC-21: Curator Manage Novel
|Curator|
start
:(1) Navigate to /curator/novels/new\\nor .../[id]/edit;
|System|
:(2) Verify role = curator or admin;
if (Authorized?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:(3) Render novel form\\n(pre-filled for edit mode);
|Curator|
:(4) Fill in title,\\noriginal language, status;
:(5) Optionally: synopsis,\\ngenres (max 5), tags;
if (Upload cover image?) then (yes)
  :(6) Open Cloudinary upload widget;
  |Cloudinary|
  :Upload image directly to CDN;
  :Return secure_url;
  |System|
  :(7) Store coverImageUrl;
  |Curator|
else (no)
endif
:(8) Click "Luu";
|System|
:(9) Validate all fields server-side;
if (Valid?) then (no)
  :Show field-level errors;
  stop
else (yes)
endif
:(10) Auto-generate slug if not provided;
:(11) Check slug uniqueness;
if (Collision?) then (yes)
  :Append numeric suffix;
else (no)
endif
:(12) UPSERT novels record;
:(13) Sync novel_genres and novel_tags;
:Redirect to novel detail;
|Curator|
:Novel saved;
stop
@enduml`,

'uc-22': `@startuml
${SKIN}
title UC-22: Curator Manage Chapter
|Curator|
start
:(1) Navigate to chapter editor;
|System|
:(2) Verify role = curator or admin;
if (Authorized?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:(3) Render chapter form\\n(pre-filled for edit mode);
|Curator|
:(4) Enter chapter number, title, content;
:(5) Optionally set VIP flag and coin cost;
:(6) Optionally set scheduled publishedAt;
:(7) Click "Luu ban nhap" or "Xuat ban";
if (Click "Luu ban nhap"?) then (yes)
  :publishedAt = null (draft);
else (click "Xuat ban")
  :publishedAt = now() or scheduled date;
endif
|System|
:(8) Validate:\\n- Chapter number unique in novel\\n- Title non-empty;
if (Valid?) then (no)
  :Show validation errors;
  stop
else (yes)
endif
:(9) Calculate wordCount\\n(strip HTML, count tokens);
:(10) UPSERT chapters record;
:(11) Update novels.totalChapters;
if (Transitioning to published?) then (yes)
  :INCREMENT novels.totalChapters;
else if (Transitioning to draft?) then (yes)
  :DECREMENT novels.totalChapters;
else (no state change)
endif
|Curator|
:Chapter saved;
stop
@enduml`,

'uc-23': `@startuml
${SKIN}
title UC-23: Admin Manage System
|Admin|
start
:(1) Navigate to /admin;
|System|
:(2) Verify role = admin;
if (role = admin?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:(3) Render admin dashboard;
|Admin|
:(4) Select management area;
switch (Area)
case (Users)
  :(5) View paginated user list;
  if (Change role?) then (yes)
    |System|
    :UPDATE users.role;
    :(6) INSERT audit_logs;
  else if (Ban user?) then (yes)
    :Check not self-banning;
    :UPDATE users.banned = true;
    :Delete all user sessions;
    :(6) INSERT audit_logs;
  else (view only)
  endif
case (Coin Packages)
  :(5) View coin package list;
  if (Create / Edit?) then (yes)
    |System|
    :UPSERT coin_packages;
    :(6) INSERT audit_logs;
  else if (Deactivate?) then (yes)
    :UPDATE isActive = false;
    :(6) INSERT audit_logs;
  else (view only)
  endif
case (Audit Logs)
  note right: Read-only view
endswitch
|Admin|
:Action complete;
stop
@enduml`

}; // end DIAGRAMS

// ── Figure placeholder → image reference mapping ─────────────────────────────
const FIGURE_REPLACEMENTS = [
  ['*[Figure 1: UC-01 Register Account Activity Flow]*',       '![Figure 1: UC-01 Register Account Activity Flow](figures/uc-01-activity.png){ width=6in }'],
  ['*[Figure 2: UC-02 Sign In with Email Activity Flow]*',     '![Figure 2: UC-02 Sign In with Email Activity Flow](figures/uc-02-activity.png){ width=6in }'],
  ['*[Figure 3: UC-03 Sign In with Google Activity Flow]*',    '![Figure 3: UC-03 Sign In with Google Activity Flow](figures/uc-03-activity.png){ width=6in }'],
  ['*[Figure 4: UC-04 Sign Out Activity Flow]*',               '![Figure 4: UC-04 Sign Out Activity Flow](figures/uc-04-activity.png){ width=5in }'],
  ['*[Figure 5: UC-05 Reset Password Activity Flow]*',         '![Figure 5: UC-05 Reset Password Activity Flow](figures/uc-05-activity.png){ width=6in }'],
  ['*[Figure 6: UC-06 Browse Novel List Activity Flow]*',      '![Figure 6: UC-06 Browse Novel List Activity Flow](figures/uc-06-activity.png){ width=6in }'],
  ['*[Figure 7: UC-07 Search Novels Activity Flow]*',          '![Figure 7: UC-07 Search Novels Activity Flow](figures/uc-07-activity.png){ width=6in }'],
  ['*[Figure 8: UC-08 Filter Novels Activity Flow]*',          '![Figure 8: UC-08 Filter Novels Activity Flow](figures/uc-08-activity.png){ width=6in }'],
  ['*[Figure 9: UC-09 View Novel Detail Activity Flow]*',      '![Figure 9: UC-09 View Novel Detail Activity Flow](figures/uc-09-activity.png){ width=6in }'],
  ['*[Figure 10: UC-10 Read Chapter Activity Flow]*',          '![Figure 10: UC-10 Read Chapter Activity Flow](figures/uc-10-activity.png){ width=6in }'],
  ['*[Figure 11: UC-11 Adjust Reader Settings Activity Flow]*','![Figure 11: UC-11 Adjust Reader Settings Activity Flow](figures/uc-11-activity.png){ width=6in }'],
  ['*[Figure 12: UC-12 Follow Novel Activity Flow]*',          '![Figure 12: UC-12 Follow Novel Activity Flow](figures/uc-12-activity.png){ width=5in }'],
  ['*[Figure 13: UC-13 Track Reading Progress Activity Flow]*','![Figure 13: UC-13 Track Reading Progress Activity Flow](figures/uc-13-activity.png){ width=6in }'],
  ['*[Figure 14: UC-14 View Library Activity Flow]*',          '![Figure 14: UC-14 View Library Activity Flow](figures/uc-14-activity.png){ width=6in }'],
  ['*[Figure 15: UC-15 Write Review Activity Flow]*',          '![Figure 15: UC-15 Write Review Activity Flow](figures/uc-15-activity.png){ width=6in }'],
  ['*[Figure 16: UC-16 Leave Comment Activity Flow]*',         '![Figure 16: UC-16 Leave Comment Activity Flow](figures/uc-16-activity.png){ width=6in }'],
  ['*[Figure 17: UC-17 Purchase Coins Activity Flow]*',        '![Figure 17: UC-17 Purchase Coins Activity Flow](figures/uc-17-activity.png){ width=6in }'],
  ['*[Figure 18: UC-18 Unlock VIP Chapter Activity Flow]*',    '![Figure 18: UC-18 Unlock VIP Chapter Activity Flow](figures/uc-18-activity.png){ width=6in }'],
  ['*[Figure 19: UC-19 Update Profile Activity Flow]*',        '![Figure 19: UC-19 Update Profile Activity Flow](figures/uc-19-activity.png){ width=5in }'],
  ['*[Figure 20: UC-20 Change Password Activity Flow]*',       '![Figure 20: UC-20 Change Password Activity Flow](figures/uc-20-activity.png){ width=6in }'],
  ['*[Figure 21: UC-21 Curator Manage Novel Activity Flow]*',  '![Figure 21: UC-21 Curator Manage Novel Activity Flow](figures/uc-21-activity.png){ width=6in }'],
  ['*[Figure 22: UC-22 Curator Manage Chapter Activity Flow]*','![Figure 22: UC-22 Curator Manage Chapter Activity Flow](figures/uc-22-activity.png){ width=6in }'],
  ['*[Figure 23: UC-23 Admin Manage System Activity Flow]*',   '![Figure 23: UC-23 Admin Manage System Activity Flow](figures/uc-23-activity.png){ width=6in }'],
];

// ── Pandoc path resolution ─────────────────────────────────────────────────────
function findPandoc() {
  const candidates = [
    'pandoc',
    process.env.PANDOC_PATH,
    `${process.env.TEMP}\\pandoc-bin\\pandoc-3.6.4\\pandoc.exe`,
    `${process.env.LOCALAPPDATA}\\Pandoc\\pandoc.exe`,
    'C:\\Program Files\\Pandoc\\pandoc.exe',
  ].filter(Boolean);
  for (const p of candidates) {
    try { execSync(`"${p}" --version`, { stdio: 'ignore' }); return p; } catch {}
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const docsDir   = __dirname;                          // script lives inside docs/
  const figDir    = path.join(docsDir, 'figures');
  const srsMdPath = path.join(docsDir, 'SRS.md');
  const srsDocxPath = path.join(docsDir, 'SRS.docx');

  fs.mkdirSync(figDir, { recursive: true });

  const entries = Object.entries(DIAGRAMS);
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const [key, text] = entries[i];
    const outPath = path.join(figDir, `${key}-activity.png`);
    process.stdout.write(`[${String(i+1).padStart(2)}/${entries.length}] ${key} ... `);
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        await downloadPng(encodePuml(text.trim()), outPath);
        const size = fs.statSync(outPath).size;
        console.log(`OK  (${(size/1024).toFixed(1)} KB)${attempt > 1 ? ` [retry ${attempt}]` : ''}`);
        ok = true;
      } catch (e) {
        if (attempt < 3) { process.stdout.write(`retry... `); await sleep(800); }
        else { console.log(`FAILED: ${e.message}`); failed++; }
      }
    }
    if (i < entries.length - 1) await sleep(250);
  }

  // ── Patch SRS.md ───────────────────────────────────────────────────────────
  console.log('\nPatching SRS.md ...');
  let src = fs.readFileSync(srsMdPath, 'utf-8');
  let patches = 0;
  for (const [placeholder, replacement] of FIGURE_REPLACEMENTS) {
    if (src.includes(placeholder)) {
      src = src.replace(placeholder, replacement);
      patches++;
    } else {
      console.warn(`  WARN: placeholder not found: ${placeholder.slice(0, 60)}`);
    }
  }
  fs.writeFileSync(srsMdPath, src, 'utf-8');
  console.log(`  Replaced ${patches}/${FIGURE_REPLACEMENTS.length} figure placeholders.`);

  // ── Re-run Pandoc ──────────────────────────────────────────────────────────
  console.log('\nRegenerating SRS.docx ...');
  const pandoc = findPandoc();
  if (!pandoc) {
    console.error('  Pandoc not found — skipping DOCX generation. Set PANDOC_PATH env var.');
  } else {
    try {
      execSync(
        `"${pandoc}" "${srsMdPath}" -o "${srsDocxPath}" --toc --toc-depth=4 --standalone --resource-path "${docsDir}"`,
        { stdio: 'inherit', env: { ...process.env } }
      );
      const size = fs.statSync(srsDocxPath).size;
      console.log(`  SRS.docx updated (${(size/1024).toFixed(0)} KB)`);
    } catch (e) {
      console.error('  Pandoc failed:', e.message);
    }
  }

  console.log(`\nDone. ${failed} diagram(s) failed.`);
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
