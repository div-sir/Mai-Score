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

it("resolves the newly available International Marisa DX MASTER chart", async () => {
  const { resolveScores } = await import("../src/lib/resolver");
  const [resolved] = await resolveScores([{
    title: "魔理沙は大変なものを盗んでいきました",
    type: "dx",
    difficulty: "master",
    displayedLevel: "13+",
    achievementRate: 98.0664
  }]);

  expect(resolved).toMatchObject({
    internalLevelValue: 13.6,
    version: "CiRCLE PLUS"
  });
  expect(resolved.warning).toBeUndefined();
  expect(resolved.chartRating).toBeGreaterThan(0);
});

it("resolves the October International catalog additions reported by DX NET", async () => {
  const { resolveScores } = await import("../src/lib/resolver");
  const records = [
    ["RONDØ", "expert", "12+", 100.4428, 12.8],
    ["キスキツネ", "master", "13+", 98.8674, 13.8],
    ["WWW", "master", "13", 100.4421, 13.4],
    ["うたかたよいかないで", "master", "13", 100.8312, 13.2],
    ["TAKE CONTROL", "master", "13+", 97.9374, 13.9],
    ["Hyperdrive", "master", "13+", 99.0789, 13.8],
    ["Paradoxical Empress", "master", "13+", 98.1862, 13.9],
    ["RONDØ", "master", "14", 95.4202, 14.5]
  ] as const;

  const resolved = await resolveScores(records.map(([title, difficulty, displayedLevel, achievementRate]) => ({
    title,
    type: "dx" as const,
    difficulty,
    displayedLevel,
    achievementRate
  })));

  expect(resolved).toHaveLength(records.length);
  resolved.forEach((chart, index) => {
    expect(chart.warning, records[index][0]).toBeUndefined();
    expect(chart.internalLevelValue, records[index][0]).toBe(records[index][4]);
    expect(chart.chartRating, records[index][0]).toBeGreaterThan(0);
  });
});
