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

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

const rtmRows = [];
for (const worksheet of workbook.worksheets) {
  worksheet.eachRow((row, rowNumber) => {
    const tcId = cellText(row, 4);
    if (!tcPattern.test(tcId)) {
      tcPattern.lastIndex = 0;
      return;
    }
    tcPattern.lastIndex = 0;
    rtmRows.push({
      sheet: worksheet.name,
      row: rowNumber,
      no: cellText(row, 1),
      reqId: cellText(row, 2),
      reqDesc: cellText(row, 3),
      tcId,
      tcDesc: cellText(row, 5),
      testEnv: cellText(row, 9),
      uatEnv: cellText(row, 10),
      prodEnv: cellText(row, 11),
      coverage: cellText(row, 15),
    });
  });
}

const testFiles = walk(testsDir).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const implementedIds = new Map();
for (const file of testFiles) {
  const text = fs.readFileSync(file, "utf8");
  const ids = text.match(tcPattern) ?? [];
  for (const id of ids) {
    if (!implementedIds.has(id)) implementedIds.set(id, []);
    implementedIds.get(id).push(path.relative(root, file).replaceAll("\\", "/"));
  }
}

const rtmIds = rtmRows.map((row) => row.tcId);
const uniqueRtmIds = new Set(rtmIds);
const duplicateRtmIds = [...rtmIds.reduce((map, id) => {
  map.set(id, (map.get(id) ?? 0) + 1);
  return map;
}, new Map())]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const missingRows = rtmRows.filter((row) => !implementedIds.has(row.tcId));
const implementedNotInRtm = [...implementedIds.keys()]
  .filter((id) => !uniqueRtmIds.has(id))
  .sort();

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "(blank)";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

const report = {
  workbook: path.relative(root, workbookPath).replaceAll("\\", "/"),
  sheets: workbook.worksheets.map((sheet) => sheet.name),
  totalRtmRows: rtmRows.length,
  uniqueRtmIds: uniqueRtmIds.size,
  implementedIdsFoundInTests: implementedIds.size,
  matchedRtmRows: rtmRows.filter((row) => implementedIds.has(row.tcId)).length,
  missingRtmRows: missingRows.length,
  rtmRowsBySheet: countBy(rtmRows, "sheet"),
  missingRowsBySheet: countBy(missingRows, "sheet"),
  coverageStatusCounts: countBy(rtmRows, "coverage"),
  testEnvStatusCounts: countBy(rtmRows, "testEnv"),
  duplicateRtmIds: duplicateRtmIds.slice(0, 50).map(([tcId, count]) => ({ tcId, count })),
  implementedNotInRtmCount: implementedNotInRtm.length,
  implementedNotInRtm: implementedNotInRtm.slice(0, 100),
  sampleMissingRows: missingRows.slice(0, 80).map((row) => ({
    sheet: row.sheet,
    row: row.row,
    req: row.reqId || row.reqDesc,
    tcId: row.tcId,
    tcDesc: row.tcDesc,
  })),
};

console.log(JSON.stringify(report, null, 2));
