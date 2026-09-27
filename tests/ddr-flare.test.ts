import { describe, expect, it } from "vitest";
import { analyzeDdrFlare, ddrFlareForStyle } from "../studio/lib/ddr-flare";
import type { KonamiPageSnapshot } from "../studio/lib/konami-page";

function snapshot(): KonamiPageSnapshot {
  const categoryRows = (category: string, style: string, count: number, base: number) => Array.from({ length: count }, (_, index) => [
    `${category} Song ${index + 1}`, style, category, index % 2 ? "EXPERT" : "CHALLENGE", `${18 - index % 4}`, `${base - index}`
  ]);
  return {
    schema: "mai-score/konami-page-snapshot/v1",
    generatedAt: "2026-09-27T12:00:00.000Z",
    source: { game: "dance-dance-revolution", connectionId: "ddr-konami-page", startUrl: "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html", region: "jp", pageLimit: 40 },
    pages: [{
      url: "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/flare.html", title: "Flare Skill Target", access: "collected",
      headings: ["FLARE SKILL TARGET"], fields: [], text: [],
      tables: [{
        headers: ["曲名", "プレースタイル", "カテゴリ", "難易度", "LEVEL", "フレアスキル"],
        rows: [
          ...categoryRows("CLASSIC", "SINGLE", 32, 400),
          ...categoryRows("WHITE", "SINGLE", 30, 350),
          ...categoryRows("GOLD", "SINGLE", 30, 300),
          ...categoryRows("GOLD", "DOUBLE", 2, 250),
          ["No Category", "SINGLE", "", "EXPERT", "16", "199"]
        ]
      }]
    }],
    summary: { collected: 1, paid: 0, signInRequired: 0, failed: 0, fields: 0, tables: 1 }
  };
}

describe("DDR Flare Skill analysis", () => {
  it("separates play styles and counts the best 30 in every official category", () => {
    const analysis = analyzeDdrFlare(snapshot());
    expect(analysis.styles).toEqual(["SINGLE", "DOUBLE"]);
    expect(analysis.unknownCategoryCount).toBe(1);
    const groups = ddrFlareForStyle(analysis, "SINGLE");
    expect(groups.map((group) => group.counted.length)).toEqual([30, 30, 30]);
    expect(groups[0].cutoff).toBe(371);
    expect(groups[0].candidates[0]).toMatchObject({ title: "CLASSIC Song 31", flareSkill: 370, needed: 2 });
    expect(groups.reduce((sum, group) => sum + group.total, 0)).toBe(30195);
  });

  it("does not invent a category or a skill from unrelated score columns", () => {
    const data = snapshot();
    data.pages[0].tables = [{ headers: ["曲名", "プレースタイル", "スコア"], rows: [["Song", "SINGLE", "999999"]] }];
    expect(analyzeDdrFlare(data).charts).toEqual([]);
  });
});
