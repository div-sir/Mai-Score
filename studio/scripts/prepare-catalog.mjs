import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

// Use the same pinned international catalog as the extension. No build-time network request.
const source = JSON.parse(await readFile(new URL("../../src/data/source.json", import.meta.url), "utf8"));
const sheets = JSON.parse(gunzipSync(await readFile(new URL("../../public/data/sheets.json.gz", import.meta.url))).toString("utf8"));
if (!Array.isArray(sheets) || !sheets.length || source.sheets !== sheets.length) throw new Error("Catalog count does not match source metadata");
const ids = new Set();
for (const sheet of sheets) {
  if (typeof sheet.sheetId !== "string" || !sheet.sheetId || ids.has(sheet.sheetId)
    || typeof sheet.title !== "string" || !["std", "dx"].includes(sheet.type)
    || !["basic", "advanced", "expert", "master", "remaster"].includes(sheet.difficulty)) {
    throw new Error("Invalid or duplicate catalog chart identity");
  }
  ids.add(sheet.sheetId);
}
const directory = new URL("../public/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("catalog.json", directory), JSON.stringify({ schema: "mai-score/catalog/v1", region: "intl", source, sheets }));
console.log(`Prepared ${sheets.length} international catalog charts (${source.updateTime})`);
