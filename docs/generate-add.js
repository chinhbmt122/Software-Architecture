// generate-add.js
// Generates PlantUML diagrams for docs/ADD.md then runs Pandoc → docs/ADD.docx
// Usage (from project root): node docs/generate-add.js

'use strict';

const https = require('https');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const docsDir     = __dirname;
const figuresDir  = path.join(docsDir, 'figures');
const addMdPath   = path.join(docsDir, 'ADD.md');
const addDocxPath = path.join(docsDir, 'ADD.docx');

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

// ── HTTP download with retry ──────────────────────────────────────────────────
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
`.trim();

const ENTITY_SKIN = `
${SKIN}
hide circle
skinparam linetype ortho
skinparam entity {
  BackgroundColor #EEF2FF
  BorderColor #336699
  FontSize 10
}
`.trim();

// ── Diagram definitions ───────────────────────────────────────────────────────
const DIAGRAMS = {

'add-01-impl': `@startuml
${COMP_SKIN}
title Figure 5: ADD — Implementation View (Source Directory Structure)

package "src/app/  (Next.js App Router)" {
  component "Route Pages & Layouts\\n(auth), novels/, library/, search/" as Pages
  component "API Routes\\n/api/auth   /api/payments\\n/api/chapters/[id]/unlock" as API
}

package "src/modules/  (Feature Modules — Business Logic)" {
  component "content" as MC
  component "reader" as MR
  component "monetization" as MM
  component "community" as MCm
  component "search" as MS
  component "notifications" as MN
  component "admin" as MA
}

package "src/lib/  (Shared Infrastructure)" {
  component "db.ts\\n(Neon + Drizzle client)" as DB
  component "auth.ts\\n(Better Auth server)" as Auth
  component "middleware.ts\\n(session + role check)" as MW
}

package "src/db/schema/  (Drizzle ORM Definitions)" {
  component "auth.ts   content.ts   reader.ts\\nmonetization.ts   community.ts   operations.ts" as Schema
}

Pages ..> MC : getChapter()
Pages ..> MR : getProgress()
Pages ..> MM : checkAccess()
Pages ..> MS : searchNovels()
API ..> MM : handleWebhook()
MW ..> Auth : validateSession()

MC --> DB
MR --> DB
MM --> DB
MCm --> DB
MS --> DB
MN --> DB
MA --> DB

DB --> Schema : Drizzle queries

note bottom of "src/modules/  (Feature Modules — Business Logic)"
  No cross-module imports.
  Modules interact only through
  exported service functions.
end note
@enduml`,

'add-02-erd': `@startuml
${ENTITY_SKIN}
title Figure 6: ADD — Data View (Simplified Entity Relationship Diagram)

entity "users" as U {
  * id : text <<PK>>
  --
  email : text
  role : text
  coin_balance : integer
  lockedUntil : timestamp
}

entity "novels" as N {
  * id : uuid <<PK>>
  --
  slug : text
  title : text
  status : text
  curatorId : text <<FK>>
}

entity "chapters" as Ch {
  * id : uuid <<PK>>
  --
  novelId : uuid <<FK>>
  chapterNumber : integer
  isVip : boolean
  status : text
}

entity "reading_progress" as RP {
  * userId : text <<FK>>
  * chapterId : uuid <<FK>>
  --
  lastReadAt : timestamp
}

entity "payments" as P {
  * id : uuid <<PK>>
  --
  userId : text <<FK>>
  orderId : text
  status : text
  coinAmount : integer
}

entity "coin_transactions" as CT {
  * id : uuid <<PK>>
  --
  userId : text <<FK>>
  delta : integer
  type : text
  refId : uuid
}

entity "chapter_unlocks" as CU {
  * userId : text <<FK>>
  * chapterId : uuid <<FK>>
  --
  unlockedAt : timestamp
}

entity "subscriptions" as S {
  * id : uuid <<PK>>
  --
  userId : text <<FK>>
  status : text
  expiresAt : timestamp
}

entity "comments" as Cm {
  * id : uuid <<PK>>
  --
  userId : text <<FK>>
  novelId : uuid <<FK>>
  parentId : uuid
}

entity "audit_logs" as AL {
  * id : uuid <<PK>>
  --
  adminId : text <<FK>>
  action : text
  targetType : text
  targetId : uuid
}

U ||--o{ N : curates
U ||--o{ RP : tracks
U ||--o{ P : makes
U ||--o{ CT : has
U ||--o{ CU : owns
U ||--o| S : holds
U ||--o{ Cm : writes
U ||--o{ AL : performs

N ||--o{ Ch : contains
Ch ||--o{ RP : tracked in
Ch ||--o{ CU : protected by

@enduml`,

};

// ── Figure replacement pairs ───────────────────────────────────────────────────
const FIGURE_REPLACEMENTS = [
  ['*[Figure 5: Implementation View]*',          '![Figure 5: Implementation View — Source Directory Structure](figures/add-01-impl.png){ width=6in }'],
  ['*[Figure 6: Entity Relationship Diagram]*',  '![Figure 6: Data View — Entity Relationship Diagram](figures/add-02-erd.png){ width=6in }'],
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const keys = Object.keys(DIAGRAMS);
  console.log(`Generating ${keys.length} ADD diagrams...`);

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

  // Patch ADD.md (replace placeholders with actual image refs)
  let md = fs.readFileSync(addMdPath, 'utf-8');
  let replacements = 0;
  for (const [placeholder, imageRef] of FIGURE_REPLACEMENTS) {
    if (md.includes(placeholder)) {
      md = md.replace(placeholder, imageRef);
      replacements++;
    }
  }
  fs.writeFileSync(addMdPath, md, 'utf-8');
  console.log(`\nPatched ADD.md: ${replacements}/${FIGURE_REPLACEMENTS.length} replacements`);

  // Run Pandoc
  console.log('\nRunning Pandoc...');
  try {
    execSync(
      `pandoc "${addMdPath}" -o "${addDocxPath}" --toc --toc-depth=4 --standalone --resource-path "${docsDir}"`,
      { stdio: 'inherit' }
    );
    const kb = (fs.statSync(addDocxPath).size / 1024).toFixed(0);
    console.log(`\nDone! ADD.docx = ${kb} KB`);
  } catch (err) {
    console.error('Pandoc failed:', err.message);
    console.error('If pandoc is not in PATH, run directly:');
    console.error(`  $LOCALAPPDATA/Pandoc/pandoc.exe "${addMdPath}" -o "${addDocxPath}" --toc --toc-depth=4 --standalone --resource-path "${docsDir}"`);
  }
}

main().catch(console.error);
