import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, "docs", "presentation-build");
const pptxPath = path.join(root, "docs", "NovelHub-Architecture-Presentation.pptx");
const W = 12192000;
const H = 6858000;
const EMU = 914400;

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
};

let shapeId = 1;
let mediaId = 1;

const C = {
  bg: "F7F3EA",
  ink: "1D2733",
  muted: "52606D",
  navy: "123047",
  teal: "0B8F8A",
  gold: "D8A73F",
  coral: "D7654C",
  green: "3B8C5A",
  white: "FFFFFF",
  line: "D5D7DA",
  paleTeal: "DCEFED",
  paleGold: "F5E8C5",
  paleCoral: "F6DCD5",
};

const slides = [
  {
    title: "NovelHub",
    subtitle: "Architecture presentation for a Vietnamese web novel platform",
    kicker: "Software Architecture Project",
    type: "title",
  },
  {
    title: "Project Problem",
    body: [
      "Readers need fast novel discovery and a comfortable mobile reading experience.",
      "Premium chapters require secure access control and correct coin accounting.",
      "Curators and admins need controlled publishing, moderation, and auditability.",
    ],
    callout: "Core challenge: combine content delivery, payment integrity, and solo-developer maintainability.",
  },
  {
    title: "Users And Scope",
    body: [
      "Guest: browse novels, search, read free chapters.",
      "Reader: account, library, progress, comments, reviews, VIP unlocks.",
      "Curator: manage novels and chapters.",
      "Admin: users, reports, moderation, and audit logs.",
    ],
    visual: "actors",
  },
  {
    title: "SRS Defines The Product",
    body: [
      "23 use cases organized around auth, browsing, reading, library, community, monetization, profile, curator, and admin flows.",
      "Business rules clarify access control, validation, VIP chapter gating, and payment behavior.",
      "Non-functional requirements identify security, performance, availability, and reliability targets.",
    ],
    metrics: [
      ["23", "Use cases"],
      ["4", "Primary actors"],
      ["6", "Major feature areas"],
    ],
  },
  {
    title: "Quality Drivers",
    body: [
      "Performance: RSC + CDN + Cloudinary for fast reading; Meilisearch for <500 ms search.",
      "Security: Better Auth, httpOnly cookies, role checks, VIP server-side gate, HMAC webhooks.",
      "Reliability: db.transaction(), SELECT FOR UPDATE, ledger writes, and idempotent webhooks.",
      "Modifiability: 4-layer structure with isolated feature modules under src/modules.",
    ],
    visual: "drivers",
  },
  {
    title: "Architecture Overview",
    body: [
      "Next.js App Router serves pages and backend API routes in one deployable unit.",
      "Feature modules own domain logic and database tables.",
      "Managed services reduce operational work while preserving clear boundaries.",
    ],
    image: "docs/figures/sad-01-layers.png",
  },
  {
    title: "Tech Stack Rationale",
    body: [
      "Next.js 16 + React 19: SSR/RSC for SEO and fast reading pages.",
      "Drizzle + Neon PostgreSQL: typed SQL, light serverless footprint, auditable transactions.",
      "Better Auth + Upstash Redis: secure sessions and rate-limit support.",
      "Meilisearch, Cloudinary, MoMo: focused managed services for search, images, and payments.",
    ],
    visual: "stack",
  },
  {
    title: "Key Architecture Decisions",
    body: [
      "Full-stack monolith selected instead of microservices to reduce operational overhead.",
      "Module isolation gives clean ownership without separate deployments.",
      "Coin balance is never cached; all balance-changing operations use database transactions.",
      "Search uses Meilisearch with database fallback for degraded operation.",
    ],
    image: "docs/figures/sad-02-modules.png",
  },
  {
    title: "Critical Flow: VIP Unlock",
    body: [
      "The reader requests a locked chapter.",
      "The monetization module checks existing unlock, subscription, or coin balance.",
      "Coin deduction, unlock creation, and ledger entry are committed atomically.",
    ],
    image: "docs/figures/sad-07-seq-vip.png",
  },
  {
    title: "How The Documents Connect",
    body: [
      "SRS states what the product must do.",
      "ASR selects architecturally significant requirements.",
      "ADD explains the chosen architecture from quality drivers.",
      "SAD documents the final views, decisions, tactics, and traceability.",
      "RTM verifies requirements through backend, UI, and integration tests.",
    ],
    visual: "trace",
  },
  {
    title: "Verification With RTM",
    body: [
      "RTM maps each SRS use case to test cases and execution status.",
      "Backend tests verify validation, authorization, transactions, and service behavior.",
      "UI and integration tests verify real user workflows and navigation.",
      "Playwright/API tests provide evidence that documentation and implementation stay aligned.",
    ],
    metrics: [
      ["SRS", "Requirement source"],
      ["RTM", "Coverage control"],
      ["Tests", "Execution evidence"],
    ],
  },
  {
    title: "Result And Next Steps",
    body: [
      "NovelHub has a traceable path from requirements to architecture to implementation.",
      "The chosen architecture fits the current team size while leaving scaling paths open.",
      "Future work: recommendations, richer analytics, production monitoring, and payment-provider expansion.",
    ],
    callout: "Conclusion: the documents are not separate deliverables; they form the control system for the project.",
  },
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function emu(inches) {
  return Math.round(inches * EMU);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

function textRuns(text, opts = {}) {
  const color = opts.color || C.ink;
  const size = opts.size || 2200;
  const face = opts.face || "Aptos";
  const bold = opts.bold ? ' b="1"' : "";
  return `<a:r><a:rPr lang="en-US" sz="${size}"${bold}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${face}"/></a:rPr><a:t>${esc(text)}</a:t></a:r>`;
}

function textBox(x, y, w, h, paragraphs, opts = {}) {
  const id = ++shapeId;
  const fill = opts.fill ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>` : "<a:noFill/>";
  const line = opts.line ? `<a:ln w="${opts.lineWidth || 9525}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const radius = opts.round ? "roundRect" : "rect";
  const bodyPr = `<a:bodyPr wrap="square" anchor="${opts.anchor || "t"}" lIns="${opts.pad || 91440}" tIns="${opts.pad || 91440}" rIns="${opts.pad || 91440}" bIns="${opts.pad || 91440}"/>`;
  const pXml = paragraphs.map((p) => {
    if (typeof p === "string") {
      return `<a:p>${textRuns(p, opts)}</a:p>`;
    }
    const bullet = p.bullet ? `<a:pPr marL="285750" indent="-171450"><a:buChar char="•"/></a:pPr>` : "<a:pPr/>";
    return `<a:p>${bullet}${textRuns(p.text, { ...opts, ...p })}</a:p>`;
  }).join("");
  return `
    <p:sp>
      <p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${radius}"><a:avLst/></a:prstGeom>${fill}${line}</p:spPr>
      <p:txBody>${bodyPr}<a:lstStyle/>${pXml}</p:txBody>
    </p:sp>`;
}

function rect(x, y, w, h, fill, opts = {}) {
  const id = ++shapeId;
  const line = opts.line ? `<a:ln w="${opts.lineWidth || 9525}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>` : "<a:ln><a:noFill/></a:ln>";
  const prst = opts.round ? "roundRect" : "rect";
  return `
    <p:sp>
      <p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>${line}</p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
    </p:sp>`;
}

function line(x1, y1, x2, y2, color = C.teal, arrow = false) {
  const id = ++shapeId;
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 1;
  const h = Math.abs(y2 - y1) || 1;
  return `
    <p:cxnSp>
      <p:nvCxnSpPr><p:cNvPr id="${id}" name="Connector ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>
      <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="25400"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${arrow ? '<a:tailEnd type="triangle"/>' : ""}</a:ln></p:spPr>
    </p:cxnSp>`;
}

function imagePic(x, y, w, h, relId) {
  const id = ++shapeId;
  return `
    <p:pic>
      <p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
      <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    </p:pic>`;
}

function titleBlock(title, subtitle = "") {
  return [
    rect(0, 0, W, emu(0.18), C.teal),
    textBox(emu(0.55), emu(0.35), emu(11.8), emu(0.6), [title], { size: 3000, bold: true, color: C.navy, pad: 0 }),
    subtitle ? textBox(emu(0.58), emu(0.95), emu(10.4), emu(0.34), [subtitle], { size: 1350, color: C.muted, pad: 0 }) : "",
  ].join("");
}

function bulletColumn(items, x = 0.75, y = 1.45, w = 5.55, h = 4.65) {
  return textBox(emu(x), emu(y), emu(w), emu(h), items.map((text) => ({ text, bullet: true, size: 1650, color: C.ink })), { pad: emu(0.04) });
}

function metricCards(metrics, x = 7.0, y = 1.7) {
  return metrics.map(([value, label], i) => {
    const yy = emu(y + i * 1.35);
    const fill = [C.paleTeal, C.paleGold, C.paleCoral][i % 3];
    return [
      rect(emu(x), yy, emu(4.55), emu(0.95), fill, { round: true, line: C.line }),
      textBox(emu(x + 0.25), yy + emu(0.1), emu(1.35), emu(0.5), [value], { size: 2650, bold: true, color: C.navy, pad: 0 }),
      textBox(emu(x + 1.45), yy + emu(0.23), emu(2.7), emu(0.38), [label], { size: 1450, color: C.ink, pad: 0 }),
    ].join("");
  }).join("");
}

function actorVisual() {
  const labels = [
    ["Guest", C.paleTeal],
    ["Reader", C.paleGold],
    ["Curator", C.paleCoral],
    ["Admin", "E0E7F0"],
  ];
  const cx = [7.2, 9.7, 7.2, 9.7];
  const cy = [2.0, 2.0, 4.0, 4.0];
  return labels.map(([label, fill], i) => [
    rect(emu(cx[i]), emu(cy[i]), emu(1.85), emu(1.05), fill, { round: true, line: C.line }),
    textBox(emu(cx[i] + 0.15), emu(cy[i] + 0.32), emu(1.55), emu(0.32), [label], { size: 1550, bold: true, color: C.navy, pad: 0, anchor: "mid" }),
  ].join("")).join("");
}

function driversVisual() {
  const items = [
    ["RSC + CDN", C.teal],
    ["Auth + VIP gate", C.coral],
    ["Atomic coin ledger", C.gold],
    ["Module isolation", C.green],
  ];
  return items.map(([label, color], i) => {
    const yy = 1.55 + i * 1.0;
    return [
      rect(emu(7.05), emu(yy), emu(0.22), emu(0.7), color, { round: true }),
      textBox(emu(7.45), emu(yy + 0.07), emu(3.9), emu(0.44), [label], { size: 1750, bold: true, color: C.ink, pad: 0 }),
    ].join("");
  }).join("");
}

function stackVisual() {
  const groups = [
    ["Frontend + Backend", "Next.js 16 / React 19", C.paleTeal],
    ["Data", "Drizzle / Neon PostgreSQL", C.paleGold],
    ["Security", "Better Auth / Redis", C.paleCoral],
    ["Services", "Meilisearch / Cloudinary / MoMo", "E6E8EF"],
  ];
  return groups.map(([head, detail, fill], i) => {
    const yy = 1.45 + i * 1.05;
    return [
      rect(emu(6.95), emu(yy), emu(4.85), emu(0.82), fill, { round: true, line: C.line }),
      textBox(emu(7.18), emu(yy + 0.1), emu(1.95), emu(0.28), [head], { size: 1100, bold: true, color: C.navy, pad: 0 }),
      textBox(emu(7.18), emu(yy + 0.4), emu(4.2), emu(0.28), [detail], { size: 1200, color: C.ink, pad: 0 }),
    ].join("");
  }).join("");
}

function traceVisual() {
  const labels = ["SRS", "ASR", "ADD", "SAD", "RTM"];
  return labels.map((label, i) => {
    const x = 6.7 + i * 1.05;
    return [
      i > 0 ? line(emu(x - 0.35), emu(3.15), emu(x - 0.02), emu(3.15), C.teal, true) : "",
      rect(emu(x), emu(2.63), emu(0.82), emu(0.82), [C.paleTeal, C.paleGold, C.paleCoral, "E0E7F0", "E1EFD9"][i], { round: true, line: C.line }),
      textBox(emu(x + 0.08), emu(2.92), emu(0.65), emu(0.25), [label], { size: 1150, bold: true, color: C.navy, pad: 0, anchor: "mid" }),
    ].join("");
  }).join("");
}

function slideContent(slide, idx) {
  const rels = [];
  const parts = [];

  if (slide.type === "title") {
    parts.push(rect(0, 0, W, H, C.navy));
    parts.push(rect(0, emu(6.95), W, emu(0.55), C.teal));
    parts.push(rect(emu(8.2), emu(0.0), emu(5.2), H, "173B56"));
    parts.push(textBox(emu(0.85), emu(0.8), emu(7.3), emu(0.4), [slide.kicker], { size: 1450, color: C.gold, bold: true, pad: 0 }));
    parts.push(textBox(emu(0.8), emu(1.7), emu(6.8), emu(0.9), [slide.title], { size: 5200, bold: true, color: C.white, pad: 0 }));
    parts.push(textBox(emu(0.85), emu(2.75), emu(6.6), emu(0.7), [slide.subtitle], { size: 1900, color: "DDE8EF", pad: 0 }));
    parts.push(textBox(emu(0.85), emu(5.9), emu(5.8), emu(0.35), ["SRS -> ASR -> ADD -> SAD -> RTM"], { size: 1350, color: C.white, pad: 0 }));
    parts.push(rect(emu(8.65), emu(1.2), emu(3.35), emu(3.6), C.bg, { round: true }));
    parts.push(textBox(emu(9.0), emu(2.0), emu(2.65), emu(0.4), ["Requirements"], { size: 1700, bold: true, color: C.navy, pad: 0 }));
    parts.push(textBox(emu(9.0), emu(2.65), emu(2.65), emu(0.4), ["Architecture"], { size: 1700, bold: true, color: C.teal, pad: 0 }));
    parts.push(textBox(emu(9.0), emu(3.3), emu(2.65), emu(0.4), ["Verification"], { size: 1700, bold: true, color: C.coral, pad: 0 }));
  } else {
    parts.push(rect(0, 0, W, H, C.bg));
    parts.push(titleBlock(slide.title));
    parts.push(bulletColumn(slide.body));

    if (slide.callout) {
      parts.push(rect(emu(6.85), emu(2.0), emu(4.8), emu(2.45), C.navy, { round: true }));
      parts.push(textBox(emu(7.18), emu(2.36), emu(4.15), emu(1.55), [slide.callout], { size: 1900, bold: true, color: C.white, pad: 0 }));
    }
    if (slide.metrics) parts.push(metricCards(slide.metrics));
    if (slide.visual === "actors") parts.push(actorVisual());
    if (slide.visual === "drivers") parts.push(driversVisual());
    if (slide.visual === "stack") parts.push(stackVisual());
    if (slide.visual === "trace") parts.push(traceVisual());
    if (slide.image) {
      const src = path.join(root, slide.image);
      if (fs.existsSync(src)) {
        const ext = path.extname(src).toLowerCase().slice(1);
        const mediaName = `image${mediaId++}.${ext}`;
        const mediaPath = path.join(outDir, "ppt", "media", mediaName);
        ensureDir(path.dirname(mediaPath));
        fs.copyFileSync(src, mediaPath);
        const relId = `rId${rels.length + 2}`;
        rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`);
        parts.push(rect(emu(6.65), emu(1.45), emu(5.15), emu(4.95), C.white, { round: true, line: C.line }));
        parts.push(imagePic(emu(6.85), emu(1.68), emu(4.75), emu(4.48), relId));
      }
    }
    parts.push(textBox(emu(0.58), emu(6.94), emu(2.4), emu(0.25), [`${idx + 1} / ${slides.length}`], { size: 900, color: C.muted, pad: 0 }));
  }

  return { parts: parts.join("\n"), rels };
}

function slideXml(parts) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${parts}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function relsXml(rels) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`;
}

function contentTypes() {
  const slideOverrides = slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideOverrides}
</Types>`;
}

function presentationXml() {
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${ids}</p:sldIdLst>
  <p:sldSz cx="${W}" cy="${H}" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`;
}

function presentationRels() {
  const rels = [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`];
  slides.forEach((_, i) => rels.push(`<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`));
  return relsXml(rels);
}

function masterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;
}

function layoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function themeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${NS.a}" name="NovelHub">
  <a:themeElements>
    <a:clrScheme name="NovelHub"><a:dk1><a:srgbClr val="${C.ink}"/></a:dk1><a:lt1><a:srgbClr val="${C.bg}"/></a:lt1><a:dk2><a:srgbClr val="${C.navy}"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="${C.teal}"/></a:accent1><a:accent2><a:srgbClr val="${C.gold}"/></a:accent2><a:accent3><a:srgbClr val="${C.coral}"/></a:accent3><a:accent4><a:srgbClr val="${C.green}"/></a:accent4><a:accent5><a:srgbClr val="697386"/></a:accent5><a:accent6><a:srgbClr val="B7C6D0"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="NovelHub"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

function docProps() {
  const now = new Date().toISOString();
  write(path.join(outDir, "docProps", "core.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>NovelHub Architecture Presentation</dc:title><dc:creator>Codex</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  write(path.join(outDir, "docProps", "app.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slides.length}</Slides></Properties>`);
}

function build() {
  cleanDir(outDir);
  write(path.join(outDir, "[Content_Types].xml"), contentTypes());
  write(path.join(outDir, "_rels", ".rels"), relsXml([
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
  ]));
  docProps();
  write(path.join(outDir, "ppt", "presentation.xml"), presentationXml());
  write(path.join(outDir, "ppt", "_rels", "presentation.xml.rels"), presentationRels());
  write(path.join(outDir, "ppt", "slideMasters", "slideMaster1.xml"), masterXml());
  write(path.join(outDir, "ppt", "slideMasters", "_rels", "slideMaster1.xml.rels"), relsXml([
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
  ]));
  write(path.join(outDir, "ppt", "slideLayouts", "slideLayout1.xml"), layoutXml());
  write(path.join(outDir, "ppt", "slideLayouts", "_rels", "slideLayout1.xml.rels"), relsXml([
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
  ]));
  write(path.join(outDir, "ppt", "theme", "theme1.xml"), themeXml());

  slides.forEach((slide, i) => {
    const { parts, rels } = slideContent(slide, i);
    write(path.join(outDir, "ppt", "slides", `slide${i + 1}.xml`), slideXml(parts));
    write(path.join(outDir, "ppt", "slides", "_rels", `slide${i + 1}.xml.rels`), relsXml([
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
      ...rels,
    ]));
  });

  fs.rmSync(pptxPath, { force: true });
  const zipPath = pptxPath.replace(/\.pptx$/i, ".zip");
  fs.rmSync(zipPath, { force: true });
  const ps = spawnSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}" -Force`,
  ], { stdio: "inherit" });
  if (ps.status !== 0) {
    throw new Error("Compress-Archive failed");
  }
  fs.renameSync(zipPath, pptxPath);
  console.log(pptxPath);
}

build();
