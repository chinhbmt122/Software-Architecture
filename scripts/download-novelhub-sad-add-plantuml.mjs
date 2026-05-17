import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const plantumlDir = join(process.cwd(), "docs", "sad-add-v3", "plantuml");
const pngDir = join(plantumlDir, "png");
mkdirSync(pngDir, { recursive: true });

const urls = JSON.parse(readFileSync(join(plantumlDir, "plantuml-urls.json"), "utf8"));

for (const [name, url] of Object.entries(urls)) {
  const response = await fetch(url);
  if (!response.ok) {
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = join(pngDir, `${name}.error.png`);
    writeFileSync(file, bytes);
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}; saved ${file}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const file = join(pngDir, `${name}.png`);
  writeFileSync(file, bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
