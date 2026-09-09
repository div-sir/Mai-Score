import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { beforeAll, expect, it, vi } from "vitest";
import type { SheetRecord } from "../src/lib/types";

let catalog: Buffer;
let sheet: SheetRecord;

beforeAll(async () => {
  catalog = await readFile("public/data/sheets.json.gz");
  const sheets = JSON.parse(gunzipSync(catalog).toString("utf8")) as SheetRecord[];
  sheet = sheets.find(entry => entry.title.length >= 4)!;
  vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `bundled:${path}` } });
  vi.stubGlobal("fetch", async () => new Response(new Uint8Array(catalog)));
});

it("matches a uniquely identifiable chart despite invisible title formatting", async () => {
  const { resolveScores } = await import("../src/lib/resolver");
  const split = Math.floor(sheet.title.length / 2);
  const [resolved] = await resolveScores([{
    title: `${sheet.title.slice(0, split)}\u200b${sheet.title.slice(split)}`,
    type: sheet.type,
    difficulty: sheet.difficulty,
    displayedLevel: sheet.level,
    achievementRate: 100
  }]);

  expect(resolved.warning).toBeUndefined();
  expect(resolved.sheetId).toBe(sheet.sheetId);
});

it("still reports a genuinely absent chart instead of guessing", async () => {
  const { resolveScores } = await import("../src/lib/resolver");
  const [resolved] = await resolveScores([{
    title: "Definitely not a maimai chart",
    type: "dx",
    difficulty: "master",
    displayedLevel: "14",
    achievementRate: 100
  }]);

  expect(resolved.warning).toContain("無法比對");
  expect(resolved.sheetId).toBeUndefined();
});
