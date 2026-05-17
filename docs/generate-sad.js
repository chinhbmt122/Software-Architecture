// generate-sad.js
// Generates PlantUML diagrams for docs/SAD.md then runs Pandoc → docs/SAD.docx
// Usage (from project root): node docs/generate-sad.js

'use strict';

const https = require('https');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const docsDir    = __dirname;
const figuresDir = path.join(docsDir, 'figures');
const sadMdPath  = path.join(docsDir, 'SAD.md');
const sadDocxPath = path.join(docsDir, 'SAD.docx');

if (!fs.existsSync(figuresDir)) fs.mkdirSync(figuresDir, { recursive: true });

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

// ── HTTP download with retry ───────────────────────────────────────────────
function downloadPng(encoded, outPath) {
  return new Promise((resolve, reject) => {
    const url = `https://www.plantuml.com/plantuml/png/${encoded}`;
    const attempt = (tries) => {
      const file = fs.createWriteStream(outPath);
      https.get(url, { timeout: 20000 }, (res) => {
        if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => file.close(resolve));
          file.on('error', reject);
        } else {
          file.close(); fs.unlink(outPath, () => {});
          if (tries > 1) setTimeout(() => attempt(tries - 1), 900);
          else reject(new Error(`HTTP ${res.statusCode} for ${outPath}`));
        }
      }).on('error', e => {
        file.close(); fs.unlink(outPath, () => {});
        if (tries > 1) setTimeout(() => attempt(tries - 1), 900);
        else reject(e);
      });
    };
    attempt(3);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Shared skin ───────────────────────────────────────────────────────────────
const SKIN = `
skinparam defaultFontName Arial
skinparam defaultFontSize 10
skinparam shadowing false
skinparam backgroundColor #FAFAFA
skinparam ArrowColor #334466
skinparam BorderColor #336699
skinparam NoteBackgroundColor #FFFCE0
skinparam NoteBorderColor #CCBB00
`.trim();

const COMP_SKIN = `
${SKIN}
skinparam component {
  BackgroundColor #D9E1F2
  BorderColor #2E4057
  FontSize 10
}
skinparam package {
  BackgroundColor #EEF2FA
  BorderColor #4A7AAF
  FontStyle bold
}
skinparam database {
  BackgroundColor #FFF3E0
  BorderColor #E65100
}
skinparam node {
  BackgroundColor #E8F5E9
  BorderColor #2E7D32
}
`.trim();

const SEQ_SKIN = `
${SKIN}
skinparam sequence {
  ArrowColor #334466
  ActorBorderColor #2E4057
  ActorBackgroundColor #D9E1F2
  ParticipantBackgroundColor #EEF2FA
  ParticipantBorderColor #336699
  LifeLineBorderColor #AABBCC
  BoxBackgroundColor #F5F7FB
  BoxBorderColor #BFBFBF
}
skinparam ActorFontSize 10
skinparam ParticipantFontSize 10
`.trim();

// ── Diagram definitions ───────────────────────────────────────────────────────
const DIAGRAMS = {

'sad-01-layers': `@startuml
${COMP_SKIN}
title Figure 1: NovelHub — Layered Architecture

package "Presentation Layer  (src/app/)" {
  component "Pages & Layouts\\n(RSC + Client Components)" as PAGES
  component "UI Components\\n(shadcn/ui + Tailwind v4)" as UI
}

package "Application Layer  (src/modules/)" {
  component "content" as MC
  component "reader" as MR
  component "monetization" as MM
  component "community" as MCO
  component "search" as MS
  component "notifications" as MN
  component "admin" as MA
}

package "Infrastructure / Shared  (src/lib/)" {
  component "db.ts\\n(Neon + Drizzle)" as DB
  component "auth.ts\\n(Better Auth)" as AUTH
  component "middleware.ts\\n(session check)" as MW
}

package "Data Layer  (External)" {
  database "PostgreSQL\\n(Neon Serverless)" as PG
  database "Redis\\n(Upstash)" as REDIS
  component "Meilisearch Cloud" as MEILI
  component "Cloudinary CDN" as CDN
}

PAGES ..> MC : calls
PAGES ..> MR : calls
PAGES ..> MM : calls
MC --> DB
MR --> DB
MM --> DB
MCO --> DB
MS --> DB
AUTH --> REDIS
DB --> PG
MS ..> MEILI
MC ..> CDN

note right of PAGES
  No direct DB access
  from Presentation layer
end note

note right of MC
  Modules do NOT import
  each other directly
end note
@enduml`,

'sad-02-modules': `@startuml
${COMP_SKIN}
title Figure 2: NovelHub — Module Boundaries & Schema Ownership

package "src/modules" {
  component "content\\nModule" as CONTENT #D9E1F2
  component "reader\\nModule" as READER #D9E1F2
  component "monetization\\nModule" as MONEY #D9E1F2
  component "community\\nModule" as COMM #D9E1F2
  component "search\\nModule" as SEARCH #D9E1F2
  component "notifications\\nModule" as NOTIF #D9E1F2
  component "admin\\nModule" as ADMIN #D9E1F2
}

package "src/db/schema (table ownership)" {
  database "content.ts\\n(novels, chapters,\\ngenres, tags)" as SC #FFF3E0
  database "reader.ts\\n(progress, library,\\nfollows)" as SR #FFF3E0
  database "monetization.ts\\n(payments, coins,\\nunlocks, subs)" as SM #FFF3E0
  database "community.ts\\n(comments, reviews,\\nreports)" as SCO #FFF3E0
  database "auth.ts\\n(users, sessions)" as SA #FFF3E0
  database "operations.ts\\n(notifications,\\naudit_logs)" as SO #FFF3E0
}

package "src/lib (shared)" {
  component "db.ts" as DB
  component "auth.ts" as AUTH
}

CONTENT --> SC : owns
READER  --> SR : owns
MONEY   --> SM : owns
COMM    --> SCO : owns
NOTIF   --> SO : owns
ADMIN ..> SA : reads

SC --> DB
SR --> DB
SM --> DB
SCO --> DB
SA --> AUTH

note bottom
  Cross-module reads via exported
  service functions only
end note
@enduml`,

'sad-03-cnc': `@startuml
${COMP_SKIN}
title Figure 3: NovelHub — Component-and-Connector (Runtime View)

actor "Browser\\n(User)" as USER

cloud "Vercel Platform" {
  node "Edge Runtime (Global)" {
    component "Next.js Middleware\\n(auth check, redirect)" as MW
  }
  node "Node.js Serverless (US-East)" {
    component "App Router\\n(RSC + API Routes)" as APP
  }
}

database "Neon PostgreSQL\\n(Serverless, US-East)" as NEON
component "Upstash Redis\\n(Session Cache)" as REDIS
component "Meilisearch Cloud\\n(Full-text Search)" as MEILI
component "Cloudinary\\n(Image CDN)" as CDN
component "MoMo Gateway\\n(Payment)" as MOMO
component "Google OAuth\\n(Identity Provider)" as GOOGLE

USER --> MW : HTTPS/443
MW --> APP : forward request
APP --> NEON : TCP/TLS (Drizzle ORM)
APP --> REDIS : RESP/TLS (session lookup)
APP --> MEILI : HTTPS REST (search query)
APP <-- MEILI
APP --> CDN : HTTPS (image upload)
APP --> MOMO : HTTPS (payment init)
MOMO --> APP : HTTPS webhook (payment result)
APP --> GOOGLE : OAuth 2.0 redirect
GOOGLE --> APP : OAuth callback + token

note right of NEON
  coin_balance NEVER
  cached in Redis
end note

note right of MOMO
  Webhook verified with
  HMAC-SHA256 before processing
end note
@enduml`,

'sad-04-deploy-v1': `@startuml
${COMP_SKIN}
title Figure 4: Deployment View V1.0 — Vercel Hobby (Development)

node "End User Browser" as BROWSER

cloud "Vercel Hobby (Free Tier)" {
  node "Cloudflare Edge\\n(CDN, Global PoPs)" {
    artifact "Static Assets\\n(.js .css images)" as STATIC
  }
  node "Serverless Functions\\nNode.js 20, US-East-1" {
    artifact "Next.js App Handler\\n(all routes)" as APP
    artifact "API Routes\\n(/api/*)" as API
  }
}

cloud "Managed External Services" {
  node "Neon Free\\n(PostgreSQL 16, US-East)" {
    database "novelHub_dev DB\\n0.5 GB limit" as PG
  }
  node "Upstash Free" {
    database "Redis 7\\n(10K req/day)" as REDIS
  }
  node "Meilisearch Cloud\\nFree (100K docs)" {
    artifact "novels index\\nchapters index" as IDX
  }
  node "Cloudinary Free\\n(25 GB)" {
    artifact "cover images\\n(optimised WebP)" as IMGS
  }
  node "MoMo Sandbox\\n(no real payments)" {
    artifact "Payment API\\n(test credentials)" as MOMO
  }
}

BROWSER --> STATIC : HTTPS (CDN-cached)
BROWSER --> APP : HTTPS (SSR pages)
APP --> PG : Neon HTTP connector
APP --> REDIS : RESP/TLS
APP --> IDX : REST API
APP --> IMGS : REST upload
API --> MOMO : HTTPS (sandbox)
MOMO --> API : webhook callback

note right of APP
  Max function timeout: 10s
  Max bundle: 50 MB (Hobby)
  NOT for real payments
end note
@enduml`,

'sad-05-deploy-v2': `@startuml
${COMP_SKIN}
title Figure 5: Deployment View V2.0 — Production Scaling

node "End User Browser" as BROWSER

cloud "Vercel Pro / Enterprise" {
  node "Cloudflare Edge (Global)" {
    artifact "Edge Middleware\\n(auth, geo-routing)" as MW
    artifact "ISR / Static Cache" as CACHE
  }
  node "Serverless Functions\\n(Auto-scaled, Multiple Regions)" {
    artifact "Next.js App" as APP
    artifact "API Routes" as API
    artifact "Background Jobs\\n(notifications, indexing)" as JOB
  }
}

cloud "Production Data Tier" {
  node "Neon Launch ($19/mo)\\nPostgreSQL 16 (10 GB)" {
    database "Primary DB\\n(read-write)" as PG_RW
    database "Read Replica\\n(read-only queries)" as PG_RO
  }
  node "Upstash Pro\\n(Redis Cluster)" {
    database "Session Cache\\nRate-Limit Counters" as REDIS
  }
  node "Meilisearch Cloud Pro\\n(Self-hosted option)" {
    artifact "Multi-index Search" as MEILI
  }
  node "Cloudinary Pro" {
    artifact "Image CDN\\n(Auto WebP/AVIF)" as CDN
  }
  node "MoMo Production\\n+ VNPay Production" {
    artifact "Live Payment\\nGateways" as PAY
  }
}

BROWSER --> MW : HTTPS
MW --> APP : authenticated
APP --> PG_RW : writes
APP --> PG_RO : read-heavy queries
APP --> REDIS : session, rate-limit
APP --> MEILI : search
APP --> CDN : images
API --> PAY : payment
PAY --> API : webhook
JOB --> REDIS : queue
JOB --> PG_RW : bulk updates

note right of PG_RO
  Read replica offloads
  browse/search queries
end note
@enduml`,

'sad-06-seq-login': `@startuml
${SEQ_SKIN}
title Figure 6: Sequence — Email/Password Login (UC-02)

actor User
participant "Next.js\\nApp Router" as APP
participant "Better Auth\\nHandler" as AUTH
database "Neon\\nPostgreSQL" as DB
participant "Upstash\\nRedis" as REDIS

User -> APP : POST /api/auth/sign-in\\n{email, password}
APP -> AUTH : signIn.email(credentials)
AUTH -> DB : SELECT id, hashed_password,\\n  failed_attempts FROM users\\n  WHERE email = ?
DB --> AUTH : user record
AUTH -> AUTH : bcrypt.compare(password, hash)

alt password matches AND failed_attempts < 5
  AUTH -> DB : UPDATE users\\n  SET failed_attempts = 0
  AUTH -> DB : INSERT INTO sessions\\n  (userId, token, expiresAt)
  AUTH -> REDIS : SET session:{token} userId\\n  TTL = 86400s
  AUTH --> APP : Set-Cookie: session=token\\n  (httpOnly, Secure, SameSite=Lax)
  APP --> User : 302 redirect → home
else password mismatch
  AUTH -> DB : UPDATE users\\n  SET failed_attempts += 1
  DB --> AUTH : new failed_attempts = N
  alt N >= 5
    AUTH --> APP : 429 Too Many Requests
    APP --> User : "Tài khoản bị khóa 15 phút"
  else N < 5
    AUTH --> APP : 401 Unauthorised
    APP --> User : "Email hoặc mật khẩu không đúng"
  end
end
@enduml`,

'sad-07-seq-vip': `@startuml
${SEQ_SKIN}
title Figure 7: Sequence — VIP Chapter Unlock (UC-18)

actor Reader
participant "Next.js\\nApp Router" as APP
participant "monetization\\nmodule" as MOD
database "Neon PostgreSQL\\n(transaction)" as DB

Reader -> APP : POST /api/chapters/{id}/unlock\\n(authenticated, session cookie)
APP -> APP : verify session token
APP -> MOD : unlockChapter(userId, chapterId)
MOD -> DB : SELECT subscriptions WHERE userId\\n  AND status='ACTIVE'\\n  AND expiresAt > NOW()
DB --> MOD : no active subscription

MOD -> DB : SELECT coin_balance FROM users\\n  WHERE id = userId FOR UPDATE
DB --> MOD : balance = N

alt balance >= 1
  MOD -> DB : BEGIN TRANSACTION
  MOD -> DB : UPDATE users\\n  SET coin_balance = balance - 1
  MOD -> DB : INSERT chapter_unlocks\\n  (userId, chapterId, unlockedAt)
  MOD -> DB : INSERT coin_transactions\\n  (userId, amount=-1,\\n   type='UNLOCK', refId=chapterId)
  MOD -> DB : COMMIT
  DB --> MOD : success
  MOD --> APP : { access: true }
  APP --> Reader : 200 OK — chapter content
else balance < 1
  MOD --> APP : { access: false, reason: 'insufficient_coins' }
  APP --> Reader : 402 — VIP overlay\\n  (coin cost + buy link)
end
@enduml`,

'sad-09-seq-read-free': `@startuml
${SEQ_SKIN}
title Figure 9: Sequence — Read Free Chapter (UC-09)

actor "Guest / Reader" as USER
participant "Cloudflare\\nEdge CDN" as EDGE
participant "Next.js\\nApp Router" as APP
participant "content\\nmodule" as CONTENT
participant "reader\\nmodule" as READER
database "Neon\\nPostgreSQL" as DB

USER -> EDGE : GET /novels/{slug}/chapters/{n}
alt cache HIT
  EDGE --> USER : cached HTML (< 50 ms)
else cache MISS
  EDGE -> APP : origin request
  APP -> APP : middleware: read session cookie\\n(guest if absent — no redirect)
  APP -> CONTENT : getChapter(slug, n)
  CONTENT -> DB : SELECT chapters WHERE\\n  novel_slug = slug AND number = n
  DB --> CONTENT : chapter (id, title, content,\\n  isVip=false, publishedAt)
  CONTENT --> APP : chapter data

  APP -> APP : RSC renders full HTML +\\n  generateMetadata(og:title, canonical)

  alt user is authenticated
    APP -> READER : upsertProgress(userId, novelId,\\n  chapterId, lastReadAt=NOW())
    READER -> DB : INSERT reading_progress\\n  ON CONFLICT UPDATE lastReadAt
  end

  APP --> EDGE : HTML + Cache-Control: s-maxage=60
  EDGE --> USER : HTML (now cached at edge)
end

note right of EDGE
  Cloudflare caches free chapter HTML.
  VIP chapter pages are NOT cached
  (contain user-specific lock state).
end note
@enduml`,

'sad-10-seq-curator-publish': `@startuml
${SEQ_SKIN}
title Figure 10: Sequence — Curator Publishes Chapter (UC-22)

actor Curator
participant "Next.js\\nApp Router" as APP
participant "content\\nmodule" as CONTENT
participant "search\\nmodule" as SEARCH
participant "notifications\\nmodule" as NOTIF
participant "Cloudinary" as CLOUD
database "Neon\\nPostgreSQL" as DB
participant "Meilisearch\\nCloud" as MEILI

Curator -> APP : POST /api/admin/chapters\\n{novelId, title, content, coverFile, isVip}
APP -> APP : middleware: verify role = CURATOR
APP -> CONTENT : createChapter(curatorId, payload)

CONTENT -> CONTENT : DOMPurify.sanitize(content)\\n(strips <script>, on* event handlers)

alt coverFile provided
  CONTENT -> CLOUD : upload image (REST API)
  CLOUD --> CONTENT : {coverUrl, publicId}
end

CONTENT -> DB : BEGIN TRANSACTION
CONTENT -> DB : INSERT chapters\\n  (novelId, title, sanitizedContent,\\n   coverUrl, isVip, status='PUBLISHED')
CONTENT -> DB : UPDATE novels\\n  SET lastChapterAt=NOW(), chapterCount+=1
CONTENT -> DB : COMMIT
DB --> CONTENT : chapter (id, chapterNumber)
CONTENT --> APP : chapter record

APP -> SEARCH : indexChapter(chapter)
SEARCH -> MEILI : PUT /indexes/chapters/documents
MEILI --> SEARCH : 202 Accepted (async index)

APP -> NOTIF : notifyFollowers(novelId, chapterId)
NOTIF -> DB : SELECT novel_follows WHERE novelId
DB --> NOTIF : follower userIds[]
NOTIF -> DB : INSERT notifications (batch)\\n  type='NEW_CHAPTER', refId=chapterId

APP --> Curator : 201 Created {chapterId, chapterNumber}
@enduml`,

'sad-11-seq-admin-moderate': `@startuml
${SEQ_SKIN}
title Figure 11: Sequence — Admin Moderates Content (UC-23)

actor Admin
participant "Next.js\\nApp Router" as APP
participant "admin\\nmodule" as ADMIN
participant "search\\nmodule" as SEARCH
database "Neon\\nPostgreSQL" as DB
participant "Meilisearch\\nCloud" as MEILI

Admin -> APP : POST /api/admin/reports/{id}/resolve\\n{action, targetId}
APP -> APP : middleware: verify role = ADMIN
APP -> ADMIN : resolveReport(adminId, reportId, action, targetId)
ADMIN -> DB : SELECT reports WHERE id = reportId\\n  AND status = 'PENDING'
DB --> ADMIN : report record

alt action = HIDE_CHAPTER
  ADMIN -> DB : BEGIN TRANSACTION
  ADMIN -> DB : UPDATE chapters SET status='HIDDEN'\\n  WHERE id = targetId
  ADMIN -> DB : UPDATE reports\\n  SET status='RESOLVED', resolvedBy=adminId
  ADMIN -> DB : INSERT audit_logs\\n  (actorId=adminId, action='HIDE_CHAPTER',\\n   targetId, targetType='chapter',\\n   timestamp=NOW())
  ADMIN -> DB : COMMIT

  ADMIN -> SEARCH : removeFromIndex(targetId)
  SEARCH -> MEILI : DELETE /indexes/chapters/{id}
  MEILI --> SEARCH : 202 Accepted

else action = SUSPEND_USER
  ADMIN -> DB : BEGIN TRANSACTION
  ADMIN -> DB : UPDATE users SET status='SUSPENDED'\\n  WHERE id = targetId
  ADMIN -> DB : UPDATE reports\\n  SET status='RESOLVED', resolvedBy=adminId
  ADMIN -> DB : INSERT audit_logs\\n  (actorId=adminId, action='SUSPEND_USER',\\n   targetId, targetType='user',\\n   timestamp=NOW())
  ADMIN -> DB : COMMIT
end

ADMIN --> APP : { resolved: true }
APP --> Admin : 200 OK

note right of DB
  audit_logs INSERT is in the same
  transaction as the target update.
  Either both commit or neither does.
  (T-13 — AD-D-09)
end note
@enduml`,

'sad-08-seq-payment': `@startuml
${SEQ_SKIN}
title Figure 8: Sequence — MoMo Payment Webhook (UC-17)

actor Reader
participant "Next.js\\nApp" as APP
participant "monetization\\nmodule" as MOD
participant "MoMo\\nGateway" as MOMO
database "Neon\\nPostgreSQL" as DB

Reader -> APP : POST /api/payments/momo/create\\n{packageId}
APP -> MOD : initPayment(userId, packageId)
MOD -> DB : SELECT coin_packages WHERE id = packageId
DB --> MOD : {price, coins, bonus}
MOD -> MOMO : POST /v2/gateway/api/create\\n  (HMAC-SHA256 signed)
MOMO --> MOD : {payUrl, orderId}
MOD -> DB : INSERT payments\\n  (orderId, userId, status='PENDING')
MOD --> APP : {payUrl}
APP --> Reader : redirect to payUrl

group Reader completes MoMo payment
  Reader -> MOMO : scan QR / confirm
  MOMO -> APP : POST /api/payments/momo/webhook\\n  {orderId, resultCode, signature}
  APP -> MOD : handleWebhook(payload)
  MOD -> MOD : verify HMAC-SHA256(payload, secretKey)

  alt signature INVALID
    MOD --> APP : 400 Bad Request (silent)
  else signature valid AND resultCode = 0
    MOD -> DB : SELECT payments WHERE orderId\\n  AND status = 'PENDING'
    alt already processed (idempotency)
      MOD --> APP : 204 No Content
    else first time
      MOD -> DB : BEGIN TRANSACTION
      MOD -> DB : UPDATE payments SET status='SUCCESS'
      MOD -> DB : UPDATE users\\n  SET coin_balance += (coins + bonus)
      MOD -> DB : INSERT coin_transactions\\n  (userId, +total, 'PURCHASE', orderId)
      MOD -> DB : COMMIT
      MOD --> APP : 200 OK
      APP --> Reader : notification "Nạp xu thành công"
    end
  else resultCode != 0 (payment failed)
    MOD -> DB : UPDATE payments SET status='FAILED'
    MOD --> APP : 200 OK
    APP --> Reader : notification "Thanh toán thất bại"
  end
end
@enduml`,

};

// ── Figure replacement pairs ───────────────────────────────────────────────
const FIGURE_REPLACEMENTS = [
  ['*[Figure 1: Layered Architecture]*',   '![Figure 1: NovelHub Layered Architecture](figures/sad-01-layers.png){ width=6in }'],
  ['*[Figure 2: Module Boundaries]*',      '![Figure 2: Module Boundaries & Schema Ownership](figures/sad-02-modules.png){ width=6in }'],
  ['*[Figure 3: C&C Runtime]*',            '![Figure 3: Component-and-Connector Runtime View](figures/sad-03-cnc.png){ width=6in }'],
  ['*[Figure 4: Deployment V1]*',          '![Figure 4: Deployment View V1.0 — Vercel Hobby](figures/sad-04-deploy-v1.png){ width=6in }'],
  ['*[Figure 5: Deployment V2]*',          '![Figure 5: Deployment View V2.0 — Production](figures/sad-05-deploy-v2.png){ width=6in }'],
  ['*[Figure 6: Sequence Login]*',         '![Figure 6: Sequence — Email/Password Login](figures/sad-06-seq-login.png){ width=6in }'],
  ['*[Figure 7: Sequence VIP Unlock]*',    '![Figure 7: Sequence — VIP Chapter Unlock](figures/sad-07-seq-vip.png){ width=6in }'],
  ['*[Figure 8: Sequence MoMo Payment]*',  '![Figure 8: Sequence — MoMo Payment Webhook](figures/sad-08-seq-payment.png){ width=6in }'],
  ['*[Figure 9: Sequence Read Free Chapter]*',  '![Figure 9: Sequence — Read Free Chapter](figures/sad-09-seq-read-free.png){ width=6in }'],
  ['*[Figure 10: Sequence Curator Publish]*',   '![Figure 10: Sequence — Curator Publishes Chapter](figures/sad-10-seq-curator-publish.png){ width=6in }'],
  ['*[Figure 11: Sequence Admin Moderate]*',    '![Figure 11: Sequence — Admin Moderates Content](figures/sad-11-seq-admin-moderate.png){ width=6in }'],
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const keys = Object.keys(DIAGRAMS);
  console.log(`Generating ${keys.length} SAD diagrams...`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const outPath = path.join(figuresDir, `${key}.png`);
    process.stdout.write(`  [${i+1}/${keys.length}] ${key} ... `);
    try {
      await downloadPng(encodePuml(DIAGRAMS[key]), outPath);
      const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
      console.log(`OK (${kb} KB)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
    if (i < keys.length - 1) await sleep(400);
  }

  // Patch SAD.md
  let md = fs.readFileSync(sadMdPath, 'utf-8');
  let replacements = 0;
  for (const [placeholder, imageRef] of FIGURE_REPLACEMENTS) {
    if (md.includes(placeholder)) {
      md = md.replace(placeholder, imageRef);
      replacements++;
    }
  }
  fs.writeFileSync(sadMdPath, md, 'utf-8');
  console.log(`\nPatched SAD.md: ${replacements}/${FIGURE_REPLACEMENTS.length} replacements`);

  // Run Pandoc
  console.log('\nRunning Pandoc...');
  try {
    execSync(
      `pandoc "${sadMdPath}" -o "${sadDocxPath}" --toc --toc-depth=4 --standalone --resource-path "${docsDir}"`,
      { stdio: 'inherit' }
    );
    const kb = (fs.statSync(sadDocxPath).size / 1024).toFixed(0);
    console.log(`\nDone! SAD.docx = ${kb} KB`);
  } catch (err) {
    console.error('Pandoc failed:', err.message);
  }
}

main().catch(console.error);
