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

// ── 23 PlantUML activity diagrams ─────────────────────────────────────────────
const DIAGRAMS = {

'uc-01': `@startuml
${SKIN}
title UC-01: Register Account
|Guest|
start
:Open /sign-up page;
:Enter display name,\\nemail, and password;
:Submit registration form;
|System|
:Validate all input fields;
if (All fields valid?) then (no)
  :Return inline validation errors;
  |Guest|
  :Correct input and resubmit;
  stop
else (yes)
endif
:Query users table by email;
if (Email already registered?) then (yes)
  :Display MSG-001;
  stop
else (no)
endif
:Hash password with bcrypt;
:INSERT users record\\n(role = reader, coin_balance = 0);
:Create session record;
:Set HTTP-only session cookie;
:Redirect to /;
|Guest|
:Home page displayed;
stop
@enduml`,

'uc-02': `@startuml
${SKIN}
title UC-02: Sign In with Email
|Guest|
start
:Open /sign-in page;
:Enter email and password;
:Submit sign-in form;
|System|
:Query users by email;
if (Account found?) then (no)
  :Display MSG-002;
  stop
else (yes)
endif
:Verify password against bcrypt hash;
if (Password matches?) then (no)
  :Display MSG-002;
  stop
else (yes)
endif
:Check IP rate limit\\n(10 attempts / 15 min);
if (Rate limit exceeded?) then (yes)
  :Block sign-in request\\nfor 15 minutes;
  stop
else (no)
endif
:Create session record;
:Set session cookie;
if (callbackURL present\\nand same-origin?) then (yes)
  :Redirect to callbackURL;
else (no)
  :Redirect to /;
endif
|Guest|
:Authenticated page loaded;
stop
@enduml`,

'uc-03': `@startuml
${SKIN}
title UC-03: Sign In with Google
|Guest|
start
:Click "Continue with Google";
|System|
:Build OAuth authorization URL;
:Redirect guest to Google;
|Google OAuth|
:Display consent screen;
|Guest|
:Grant permission;
|Google OAuth|
:Return authorization code\\nvia callback redirect;
|System|
:Exchange code for access token;
:Retrieve Google profile\\n(subject ID, email, name);
:Search account by\\nGoogle subject ID;
if (Account found by subject ID?) then (no)
  :Search account by\\nemail address;
  if (Email account exists?) then (yes)
    :Link Google identity\\nto existing account;
  else (no)
    :CREATE new users record\\n(role = reader, coin_balance = 0,\\nname from Google profile);
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
:Open user dropdown menu;
:Click "Dang xuat";
|System|
:Extract session token\\nfrom cookie;
:DELETE session record\\nfrom sessions table;
:Set cookie Max-Age = 0\\n(clears from browser);
:Redirect to /;
|User|
:Home page shown (as Guest);
stop
@enduml`,

'uc-05': `@startuml
${SKIN}
title UC-05: Reset Password
|User|
start
:Click "Quen mat khau?"\\non sign-in page;
:Enter registered email;
:Submit;
|System|
:Validate email format;
if (Format valid?) then (no)
  :Display MSG-023;
  stop
else (yes)
endif
:Look up account by email;
:Display neutral MSG-024\\n(always — prevents enumeration);
if (Account exists with password?) then (yes)
  :Generate 32-byte secure reset token;
  :Store hashed token with\\nexpiry = now + 1 hour;
  :Send reset email with token link;
else (no)
  note right: No action taken
endif
|User|
:Receive reset email;
:Click reset link;
|System|
:Validate token\\n(exists, not expired, not used);
if (Token valid?) then (no)
  :Display MSG-025;
  stop
else (yes)
endif
:Render new-password form;
|User|
:Enter and confirm new password;
:Submit;
|System|
:Validate new password\\n(>= 8 chars, differs from current);
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:Hash and store new password;
:Invalidate reset token;
:Delete all user sessions;
:Redirect to /sign-in\\nwith MSG-004;
|User|
:Sign-in page shown;
stop
@enduml`,

'uc-06': `@startuml
${SKIN}
title UC-06: Browse Novel List
|User|
start
:Navigate to /novels\\n(with optional: q, status,\\ngenre, sort, page);
|System|
:Parse query parameters;
:Build DB query with filters;
:Execute paginated query\\nagainst novels table;
:Count total matching novels;
if (Novels found?) then (yes)
  :Render novel grid (max 30/page);
  :Render pagination controls;
else (no)
  :Render empty-state message;
endif
:Render filter pills,\\nsearch bar, result count;
|User|
:View novel list;
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
:Type query in search input;
|System|
:Debounce 300 ms;
:Update URL param q=<query>;
if (Meilisearch available?) then (yes)
  |Meilisearch|
  :Run typo-tolerant search\\non title and synopsis;
  :Return ranked results;
  |System|
else (no)
  :Fallback: PostgreSQL\\nILIKE search on title;
endif
if (Results found?) then (yes)
  :Render matched novel grid;
else (no)
  :Render empty state;
endif
:Update result count;
|User|
:View search results;
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
:Click a status pill\\n(e.g. "Hoan thanh");
|System|
if (Pill already active?) then (yes)
  :Remove status param from URL;
else (no)
  :Set status param in URL;
endif
:Re-query novels with filter;
:Highlight active pill;
:Update result count;
:Re-render novel grid;
|User|
:View filtered results;
if (User clicks a genre pill?) then (yes)
  |System|
  if (Genre pill already active?) then (yes)
    :Remove genre param from URL;
  else (no)
    :Set genre param in URL;
  endif
  :Re-query with status AND genre;
  :Re-render grid and count;
  |User|
  :View doubly-filtered results;
else (no)
endif
stop
@enduml`,

'uc-09': `@startuml
${SKIN}
title UC-09: View Novel Detail
|User|
start
:Navigate to /novels/[slug];
|System|
:Fetch novel by slug;
if (Novel found?) then (no)
  :Return 404 page;
  stop
else (yes)
endif
fork
  :Fetch published chapters\\n(publishedAt <= now());
fork again
  :Fetch reading progress\\n(if authenticated);
fork again
  :Fetch up to 6\\nrecommended novels;
fork again
  :Increment totalViews\\n(fire-and-forget);
end fork
:Render hero section\\n(cover, badges, stats);
if (Has chapters?) then (no)
  :CTA = "Chua co chuong" (disabled);
else (yes)
  if (Has reading progress?) then (yes)
    :CTA = "Tiep tuc doc" + "Tu dau";
  else (no)
    :CTA = "Doc tu dau";
  endif
endif
:Render body: synopsis, tags,\\nreviews, chapter list,\\nrecommendations;
|User|
:Novel detail page displayed;
stop
@enduml`,

'uc-10': `@startuml
${SKIN}
title UC-10: Read Chapter
|User|
start
:Navigate to\\n/novels/[slug]/chapters/[number];
|System|
:Fetch chapter by novel ID\\nand chapter number;
if (Chapter published?) then (no)
  :Return 404 page;
  stop
else (yes)
endif
if (chapter.isVip = true?) then (yes)
  if (User authenticated?) then (no)
    :isLocked = true\\n(guest cannot read VIP);
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
if (isLocked = true?) then (yes)
  :Strip content from response;
  :Render lock overlay\\n(coin cost, sign-in prompt);
else (no)
  :Include full content;
  :Render ChapterReader;
endif
if (User authenticated?) then (yes)
  :Upsert reading_progress\\n(only if chapterNumber increases);
else (no)
endif
|User|
:Chapter page displayed;
stop
@enduml`,

'uc-11': `@startuml
${SKIN}
title UC-11: Adjust Reader Settings
|Reader|
start
:Open chapter reader page;
|System|
:Read settings from localStorage\\nor apply defaults;
:Apply settings to reading area;
|Reader|
:Click gear icon;
:Settings sheet opens (right side);
fork
  :Select theme\\n(Sang / Toi / Dem);
fork again
  :Select font family\\n(Serif / Sans);
fork again
  :Adjust font size\\n(14-26 px);
fork again
  :Adjust line height\\n(1.4-2.2x);
fork again
  :Adjust content width\\n(480-900 px);
end fork
|System|
:Apply change to reading area\\n(real-time, no save button);
:Write settings JSON to\\nlocalStorage["reader-settings"];
|Reader|
:Reading area updates immediately;
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
:Click "Theo doi" or\\n"Dang theo doi" button;
if (User authenticated?) then (no)
  |System|
  :Redirect to\\n/sign-in?callbackURL=...;
  stop
else (yes)
endif
|System|
:Optimistically update\\nbutton state in UI;
:Check existing\\nnovel_follows record;
if (Currently following?) then (yes)
  :DELETE novel_follows\\n(userId, novelId);
  :Update button → "Theo doi";
else (no)
  :INSERT novel_follows\\n(userId, novelId, createdAt);
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
:Open any chapter page\\n(authenticated);
|System|
:Chapter rendered (UC-10);
:Query reading_progress\\nfor (userId, novelId);
if (Record exists?) then (yes)
  if (newChapterNumber >=\\nstoredChapterNumber?) then (yes)
    :UPDATE reading_progress\\nSET chapterId = new,\\nupdatedAt = now();
  else (no)
    note right: No update; revisiting\\nearlier chapter
  endif
else (no)
  :INSERT reading_progress\\n(userId, novelId, chapterId,\\nupdatedAt = now());
endif
note right
  Progress is used for:
  1. "Tiep tuc doc" CTA
     on novel detail page.
  2. Progress bar in library
     (lastChapter / totalChapters).
end note
|Reader|
:Progress silently recorded;
stop
@enduml`,

'uc-14': `@startuml
${SKIN}
title UC-14: View Library
|Reader|
start
:Navigate to /library\\nor click "Tu sach";
|System|
:Check authentication;
if (User authenticated?) then (no)
  :Redirect to\\n/sign-in?callbackURL=/library;
  stop
else (yes)
endif
:Fetch novel_follows\\njoined with novels;
:Join with reading_progress\\n(last chapter per novel);
:Render page with tabs:\\nDang doc / Hoan thanh / Tat ca;
if (Library empty?) then (yes)
  :Render empty state\\n(icon + message +\\n"Kham pha truyen" link);
else (no)
  :Render novel grid\\nwith progress bars;
endif
|Reader|
:Library displayed;
if (Click filter tab?) then (yes)
  |System|
  :Update URL tab param;
  :Re-filter by progress status;
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
:Click "Viet danh gia"\\non novel detail page;
|System|
:Check authentication;
if (User authenticated?) then (no)
  :Redirect to /sign-in;
  stop
else (yes)
endif
:Check for existing review\\n(userId, novelId);
if (Review already exists?) then (yes)
  :Pre-populate form\\nwith existing rating + text;
else (no)
  :Render empty review form;
endif
|Reader|
:Select star rating (1-5);
:Optionally type review text;
:Click "Gui danh gia";
|System|
:Validate:\\n- Rating required (1-5)\\n- Text <= 2000 chars;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:UPSERT reviews record\\n(userId, novelId, rating, body);
:Recalculate novels.avgRating\\n= AVG(rating) for this novel;
|Reader|
:Reviews section refreshes;
stop
@enduml`,

'uc-16': `@startuml
${SKIN}
title UC-16: Leave Comment
|Reader|
start
:Click comment input\\non novel detail page;
|System|
:Check authentication;
if (User authenticated?) then (no)
  :Show sign-in prompt;
  stop
else (yes)
endif
|Reader|
if (Posting a reply?) then (yes)
  :Click "Tra loi" on comment;
  :Type in indented reply input;
else (no)
  :Type in main comment input;
endif
:Click "Gui";
|System|
:Validate:\\n- Content non-empty\\n- Length <= 1000 chars;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
if (Is a reply?) then (yes)
  :INSERT comments\\n(parentId = parent comment ID);
else (no)
  :INSERT comments\\n(parentId = null);
endif
|Reader|
:Comment appears immediately;
stop
@enduml`,

'uc-17': `@startuml
${SKIN}
title UC-17: Purchase Coins
|Reader|
start
:Navigate to /pricing;
:Select a coin package;
:Click "Mua N xu";
|System|
:Check authentication;
if (Authenticated?) then (no)
  :Show sign-in prompt;
  stop
else (yes)
endif
:INSERT payments record\\n(status = PENDING, orderId);
:Call MoMo createPayment API;
if (MoMo API success?) then (no)
  :Show payment error;
  stop
else (yes)
endif
:Receive payUrl;
:Redirect reader to MoMo;
|Reader|
:Complete payment on MoMo;
|MoMo Gateway|
:POST webhook to\\n/api/payments/momo/webhook;
|System|
:Verify HMAC-SHA256 signature;
if (Signature valid?) then (no)
  :Return HTTP 400;
  stop
else (yes)
endif
if (resultCode = 0 (success)?) then (yes)
  :BEGIN transaction;
  :UPDATE payments SET COMPLETED;
  :INCREMENT users.coin_balance;
  :INSERT coin_transactions (CREDIT);
  :COMMIT transaction;
  :Return HTTP 200;
  |Reader|
  :Redirect to /payments/success;
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
:View locked VIP chapter;
:Overlay shows: coin cost,\\ncurrent balance;
:Click "Mo khoa";
|System|
:Check authentication;
if (Authenticated?) then (no)
  :Return HTTP 401;
  stop
else (yes)
endif
:Re-verify chapter is\\nstill locked for this user;
if (Already unlocked?) then (yes)
  :Reload chapter (no charge);
  stop
else (no)
endif
:Check coin balance;
if (coin_balance >= coinCost?) then (no)
  :Display MSG-005;
  :Show link to /pricing;
  stop
else (yes)
endif
:BEGIN transaction;
:INSERT chapter_unlocks\\n(userId, chapterId, coinSpent);
:UPDATE users.coin_balance -= coinCost;
:INSERT coin_transactions (DEBIT);
:COMMIT transaction;
:Reload chapter with full content;
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
:Navigate to /settings;
|System|
:Check authentication;
if (Authenticated?) then (no)
  :Redirect to /sign-in;
  stop
else (yes)
endif
:Fetch users record;
:Render profile form\\n(name, bio pre-filled;\\nemail read-only);
|User|
:Edit display name and/or bio;
note right
  Live character counter:
  e.g. "47/300" below bio
end note
:Click "Luu thay doi";
|System|
:Validate server-side:\\n- name: 1-100 chars, required\\n- bio: 0-300 chars, optional;
if (Valid?) then (no)
  :Show validation error;
  stop
else (yes)
endif
:UPDATE users SET name, bio;
:Display MSG-008 (saved);
|User|
:Profile updated;
stop
@enduml`,

'uc-20': `@startuml
${SKIN}
title UC-20: Change Password
|User|
start
:Navigate to /settings\\npassword section;
|System|
:Check if account has password\\n(not Google-only);
if (Email/password account?) then (no)
  :Hide "Doi mat khau" section;
  stop
else (yes)
endif
|User|
:Enter current password,\\nnew password,\\nconfirm new password;
:Click "Doi mat khau";
|System|
:Verify current password\\nagainst bcrypt hash;
if (Current password correct?) then (no)
  :Display MSG-007;
  stop
else (yes)
endif
:Validate new password:\\n>= 8 chars, differs from current;
if (New password valid?) then (no)
  :Show MSG-015 or MSG-017;
  stop
else (yes)
endif
if (New and confirm match?) then (no)
  :Show MSG-016;
  stop
else (yes)
endif
:Hash new password with bcrypt;
:UPDATE users.passwordHash;
:DELETE all sessions\\nexcept current session;
:Display MSG-006 (success);
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
:Navigate to\\n/curator/novels/new\\nor .../[id]/edit;
|System|
:Verify role = curator or admin;
if (Authorized?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:Render novel form\\n(pre-filled for edit mode);
|Curator|
:Fill in title,\\noriginal language, status;
:Optionally: synopsis,\\ngenres (max 5), tags;
if (Upload cover image?) then (yes)
  :Open Cloudinary upload widget;
  |Cloudinary|
  :Upload image directly to CDN;
  :Return secure_url;
  |System|
  :Store coverImageUrl;
  |Curator|
else (no)
endif
:Click "Luu";
|System|
:Validate all fields server-side;
if (Valid?) then (no)
  :Show field-level errors;
  stop
else (yes)
endif
if (Slug not provided?) then (yes)
  :Auto-generate slug\\n(transliterate, lowercase, hyphens);
else (no)
endif
:Check slug uniqueness;
if (Collision?) then (yes)
  :Append numeric suffix;
else (no)
endif
:UPSERT novels record;
:Sync novel_genres (delete + insert);
:Sync novel_tags (delete + insert);
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
:Navigate to chapter editor\\n(/curator/novels/[id]/chapters/new\\nor .../[chId]/edit);
|System|
:Verify role = curator or admin;
if (Authorized?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:Render chapter form\\n(pre-filled for edit mode);
|Curator|
:Enter chapter number,\\ntitle, and content;
:Optionally set VIP flag\\nand coin cost;
:Optionally set\\nscheduled publishedAt;
if (Click "Luu ban nhap"?) then (yes)
  :publishedAt = null;
else (click "Xuat ban")
  :publishedAt = now()\\nor scheduled date;
endif
|System|
:Validate:\\n- Chapter number unique in novel\\n- Title non-empty;
if (Valid?) then (no)
  :Show validation errors;
  stop
else (yes)
endif
:Calculate wordCount\\n(strip HTML, count tokens);
:UPSERT chapters record;
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
:Navigate to /admin;
|System|
:Verify role = admin;
if (role = admin?) then (no)
  :Return HTTP 403;
  stop
else (yes)
endif
:Render admin dashboard;
|Admin|
:Select management area;
switch (Area)
case (Users)
  :View paginated user list;
  if (Change role?) then (yes)
    |System|
    :UPDATE users.role;
    :INSERT audit_logs;
  else if (Ban user?) then (yes)
    :Check not self-banning;
    :UPDATE users banned = true;
    :Delete all user sessions;
    :INSERT audit_logs;
  else (view only)
  endif
case (Coin Packages)
  if (Create / Edit?) then (yes)
    |System|
    :UPSERT coin_packages;
    :INSERT audit_logs;
  else if (Deactivate?) then (yes)
    :UPDATE isActive = false;
    :INSERT audit_logs;
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
  try {
    execSync(
      `pandoc "${srsMdPath}" -o "${srsDocxPath}" --toc --toc-depth=4 --standalone --resource-path "${docsDir}"`,
      { stdio: 'inherit', env: { ...process.env } }
    );
    const size = fs.statSync(srsDocxPath).size;
    console.log(`  SRS.docx updated (${(size/1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error('  Pandoc failed:', e.message);
  }

  console.log(`\nDone. ${failed} diagram(s) failed.`);
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
