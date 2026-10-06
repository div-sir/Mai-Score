import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const SOURCE = "https://raw.githubusercontent.com/gekichumai/dxrating/main/packages/dxdata/dxdata.json";
// The International release trails Japan. Update this only after SEGA launches
// the named version on the International service; individual future-version
// charts may be flagged intl upstream before that rollout happens.
const INTERNATIONAL_VERSION = "CiRCLE PLUS";
const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`dxdata download failed: ${response.status}`);
const sourceText = await response.text();
const dxdata = JSON.parse(sourceText);
const difficulties = new Set(["basic", "advanced", "expert", "master", "remaster"]);
// DX NET International can receive a chart before dxdata's regional flag is
// updated. Keep evidence-backed availability fixes here so a later catalog
// refresh does not silently remove them; once upstream flips the flag this is
// harmless because each source sheet is still emitted only once.
const intlAvailabilityOverrides = new Set([
  "魔理沙は大変なものを盗んでいきました\u0000dx"
]);
const versionOrder = new Map(dxdata.versions.map(({ version }, index) => [version, index]));
const internationalVersionOrder = versionOrder.get(INTERNATIONAL_VERSION);
if (internationalVersionOrder === undefined) throw new Error(`Unknown International version: ${INTERNATIONAL_VERSION}`);
const sheets = [];

for (const song of dxdata.songs) {
  for (const sheet of song.sheets) {
    const override = sheet.regionOverrides?.intl ?? {};
    const effectiveVersion = override.version ?? sheet.version;
    const availableInternationally = (sheet.regions?.intl
      || intlAvailabilityOverrides.has(`${song.title}\u0000${sheet.type}`))
      && (versionOrder.get(effectiveVersion) ?? Number.POSITIVE_INFINITY) <= internationalVersionOrder;
    if (!availableInternationally || !difficulties.has(sheet.difficulty) || !["std", "dx"].includes(sheet.type)) continue;
    const songId = String(song.songId);
    sheets.push({
      sheetId: [songId, sheet.type, sheet.difficulty].join("__dxrt__"),
      songId,
      title: song.title,
      type: sheet.type,
      difficulty: sheet.difficulty,
      level: override.level ?? sheet.level,
      internalLevelValue: override.internalLevelValue
        ?? sheet.multiverInternalLevelValue?.[INTERNATIONAL_VERSION]
        ?? sheet.internalLevelValue,
      version: effectiveVersion,
      imageName: song.imageName
    });
  }
}

sheets.sort((a, b) => a.title.localeCompare(b.title, "ja") || a.type.localeCompare(b.type) || a.difficulty.localeCompare(b.difficulty));
await mkdir("public/data", { recursive: true });
await mkdir("src/data", { recursive: true });
const compressedSheets = gzipSync(JSON.stringify(sheets), { level: 9 });
// zlib writes the host OS into byte 9 of the gzip header. Normalizing it to
// "unknown" keeps the generated catalog byte-for-byte identical on macOS and
// the Linux GitHub Actions runner.
compressedSheets[9] = 0xff;
await writeFile("public/data/sheets.json.gz", compressedSheets);
await writeFile("src/data/source.json", `${JSON.stringify({
  source: SOURCE,
  region: "intl",
  version: INTERNATIONAL_VERSION,
  updateTime: dxdata.updateTime,
  sha256: createHash("sha256").update(sourceText).digest("hex"),
  sheets: sheets.length
}, null, 2)}\n`);
console.log(`Wrote ${sheets.length} International ${INTERNATIONAL_VERSION} sheets (${dxdata.updateTime}).`);
