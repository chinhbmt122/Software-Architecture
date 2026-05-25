import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const root = process.cwd();
const workbookPath = path.join(root, "docs", "RTM.xlsx");
const testsDir = path.join(root, "tests");
const tcPattern = /TC-[A-Z0-9]+(?:-[A-Z0-9]+)*/g;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function cellText(row, index) {
  const value = row.getCell(index).value;
  if (value == null) return "";
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

const implementedIds = new Set();
for (const file of walk(testsDir).filter((item) => /\.(ts|tsx|js|jsx)$/.test(item))) {
  const text = fs.readFileSync(file, "utf8");
  for (const id of text.match(tcPattern) ?? []) implementedIds.add(id);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

let passed = 0;
let notRun = 0;

for (const worksheet of workbook.worksheets) {
  worksheet.eachRow((row) => {
    const tcId = cellText(row, 4);
    if (!tcPattern.test(tcId)) {
      tcPattern.lastIndex = 0;
      return;
    }
    tcPattern.lastIndex = 0;

    if (implementedIds.has(tcId)) {
      row.getCell(9).value = "Passed";
      row.getCell(15).value = "Covered";
      passed += 1;
    } else {
      row.getCell(9).value = "Not Run";
      if (!cellText(row, 15)) row.getCell(15).value = "Not Covered";
      notRun += 1;
    }
  });
}

await workbook.xlsx.writeFile(workbookPath);

console.log(JSON.stringify({
  workbook: path.relative(root, workbookPath).replaceAll("\\", "/"),
  passed,
  notRun,
}, null, 2));
