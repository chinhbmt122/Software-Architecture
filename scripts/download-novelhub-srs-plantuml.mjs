import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "docs", "srs-v3", "plantuml");
const outDir = join(dir, "png");
mkdirSync(outDir, { recursive: true });

const items = JSON.parse(readFileSync(join(dir, "plantuml-urls.json"), "utf8"));

for (const item of items) {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`${item.id} ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(join(outDir, `${item.id}.png`), Buffer.from(arrayBuffer));
  console.log(`${item.id} ${arrayBuffer.byteLength}`);
}
