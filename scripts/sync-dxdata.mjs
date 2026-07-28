import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const SOURCE = "https://raw.githubusercontent.com/gekichumai/dxrating/main/packages/dxdata/dxdata.json";
const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`dxdata download failed: ${response.status}`);
const sourceText = await response.text();
const dxdata = JSON.parse(sourceText);
const difficulties = new Set(["basic", "advanced", "expert", "master", "remaster"]);
const sheets = [];

for (const song of dxdata.songs) {
  for (const sheet of song.sheets) {
    if (!sheet.regions?.intl || !difficulties.has(sheet.difficulty) || !["std", "dx"].includes(sheet.type)) continue;
    const override = sheet.regionOverrides?.intl ?? {};
    const songId = String(song.songId);
    sheets.push({
      sheetId: [songId, sheet.type, sheet.difficulty].join("__dxrt__"),
      songId,
      title: song.title,
      type: sheet.type,
      difficulty: sheet.difficulty,
      level: override.level ?? sheet.level,
      internalLevelValue: override.internalLevelValue ?? sheet.internalLevelValue,
      version: override.version ?? sheet.version,
      imageName: song.imageName
    });
  }
}

sheets.sort((a, b) => a.title.localeCompare(b.title, "ja") || a.type.localeCompare(b.type) || a.difficulty.localeCompare(b.difficulty));
await mkdir("public/data", { recursive: true });
await mkdir("src/data", { recursive: true });
await writeFile("public/data/sheets.json.gz", gzipSync(JSON.stringify(sheets), { level: 9 }));
await writeFile("src/data/source.json", `${JSON.stringify({
  source: SOURCE,
  updateTime: dxdata.updateTime,
  sha256: createHash("sha256").update(sourceText).digest("hex"),
  sheets: sheets.length
}, null, 2)}\n`);
console.log(`Wrote ${sheets.length} international sheets (${dxdata.updateTime}).`);
