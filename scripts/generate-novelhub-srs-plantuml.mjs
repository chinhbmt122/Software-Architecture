import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";

const outDir = join(process.cwd(), "docs", "srs-v3", "plantuml");
mkdirSync(outDir, { recursive: true });

const useCases = [
  ["UC-01", "Register", "Guest", ["Click Sign Up", "Load registration page", "Enter email and password", "Validate input", "Create account", "Show success or error"]],
  ["UC-02", "Login", "Reader", ["Open login page", "Submit credentials", "Validate credentials", "Create session", "Redirect by role", "Show error when invalid"]],
  ["UC-03", "Browse Novel Library", "Guest / Reader", ["Open library", "Load published novels", "Apply status or genre filters", "Render novel cards", "Open selected novel"]],
  ["UC-04", "Search and Filter Novels", "Guest / Reader", ["Enter query", "Send search request", "Use Meilisearch when available", "Fallback to database when needed", "Return ranked results"]],
  ["UC-05", "View Novel Detail", "Guest / Reader", ["Open novel slug", "Load metadata", "Load chapters and reviews", "Check follow state", "Render actions"]],
  ["UC-06", "Read Free Chapter", "Guest / Reader", ["Open chapter URL", "Load chapter and novel", "Check publish status", "Render reader", "Save progress if authenticated"]],
  ["UC-07", "Customize Reader Settings", "Reader", ["Open settings", "Change theme", "Change typography", "Persist settings locally", "Apply to reader"]],
  ["UC-08", "Follow Novel", "Reader", ["Click Follow", "Verify session", "Toggle follow record", "Return new state", "Update button"]],
  ["UC-09", "Buy Coins with MoMo", "Reader", ["Select package", "Create pending payment", "Call MoMo create API", "Return pay URL", "Redirect reader"]],
  ["UC-10", "Process MoMo Webhook", "MoMo", ["Receive webhook", "Verify signature", "Find payment", "Claim pending payment", "Credit coin ledger", "Return response"]],
  ["UC-11", "Unlock VIP Chapter", "Reader", ["Click Unlock", "Check entitlement", "Check balance", "Start DB transaction", "Insert unlock and debit ledger", "Show chapter"]],
  ["UC-12", "Comment on Chapter", "Reader", ["Enter comment", "Validate session", "Validate content", "Save comment or reply", "Refresh discussion"]],
  ["UC-13", "Review Novel", "Reader", ["Open review form", "Submit rating", "Validate 1-5 stars", "Upsert review", "Recalculate average rating"]],
  ["UC-14", "Curator Create or Edit Novel", "Curator", ["Open CMS", "Verify role", "Enter novel metadata", "Upload or select cover", "Save novel", "Update search index"]],
  ["UC-15", "Curator Publish Chapter", "Curator", ["Open chapter editor", "Verify role", "Enter content", "Set free or VIP and cost", "Publish or schedule", "Notify followers"]],
  ["UC-16", "Admin Moderate Platform", "Admin", ["Open admin panel", "Verify admin role", "Select user, content, or report", "Apply action", "Write audit log", "Show updated queue"]],
];

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return "-";
  if (b === 1) return "_";
  return "?";
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3F;
  return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F);
}

function plantumlEncode(source) {
  const data = deflateRawSync(Buffer.from(source, "utf8"));
  let encoded = "";
  for (let i = 0; i < data.length; i += 3) {
    encoded += append3bytes(data[i], data[i + 1] ?? 0, data[i + 2] ?? 0);
  }
  return encoded;
}

function plantumlSource([id, name, actor, steps]) {
  const actorLane = actor.includes("/") ? "User" : actor;
  const lines = [
    "@startuml",
    "skinparam dpi 180",
    "skinparam backgroundColor white",
    "skinparam activity {",
    "  BackgroundColor #F8FAFC",
    "  BorderColor #475569",
    "  FontName Arial",
    "  FontSize 13",
    "}",
    "skinparam ArrowColor #111827",
    "skinparam swimlaneBorderColor #111827",
    `title ${id}: ${name} Activity Flow`,
    `|${actorLane}|`,
    "start",
  ];
  steps.forEach((step, index) => {
    if (index % 2 === 1) lines.push("|System|");
    else lines.push(`|${actorLane}|`);
    lines.push(`:${index + 1}. ${step};`);
  });
  lines.push("stop", "@enduml");
  return lines.join("\n");
}

const items = useCases.map((uc) => {
  const source = plantumlSource(uc);
  const encoded = plantumlEncode(source);
  const url = `https://www.plantuml.com/plantuml/png/${encoded}`;
  writeFileSync(join(outDir, `${uc[0]}.puml`), source);
  return { id: uc[0], title: uc[1], url };
});

writeFileSync(join(outDir, "plantuml-urls.json"), JSON.stringify(items, null, 2));
console.log(JSON.stringify(items, null, 2));
