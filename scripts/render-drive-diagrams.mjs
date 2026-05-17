import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const dir = join(process.cwd(), "docs", "generated-drive");
const pngDir = join(dir, "png");
mkdirSync(pngDir, { recursive: true });

const files = [
  "use-case",
  "layered-architecture",
  "module-dependency",
  "deployment",
  "vip-unlock-sequence",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });

for (const name of files) {
  const svg = readFileSync(join(dir, `${name}.svg`), "utf8");
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:24px;background:white">${svg}</body></html>`);
  const el = page.locator("svg");
  await el.screenshot({ path: join(pngDir, `${name}.png`) });
}

await browser.close();
console.log(pngDir);
