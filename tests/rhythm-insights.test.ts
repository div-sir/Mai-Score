import { describe, expect, it } from "vitest";
import {
  levelInsights,
  scoresFromKonamiPages,
  sdvxVfMilli,
  sdvxVolforce,
  targetScoreCandidates,
  type InsightScore
} from "../studio/lib/rhythm-insights";
import type { KonamiPageSnapshot } from "../studio/lib/konami-page";

const sdvx = (index: number, score = 9_923_042): InsightScore => ({
  id: `chart-${index}`, title: `Song ${index}`, difficulty: "EXHAUST", level: 18.3,
  score, grade: "S", clear: "EXCESSIVE RATE CLEAR"
});

describe("cross-game score insights", () => {
  it("summarizes levels and finds the closest score goals", () => {
    const records: InsightScore[] = [
      { id: "a", title: "A", level: 17, score: 980000, clear: "CLEAR" },
      { id: "b", title: "B", level: 17, score: 940000, clear: "FAILED" },
      { id: "c", title: "C", level: 18, score: 910000, clear: "CLEAR" }
    ];
    expect(levelInsights(records)[0]).toMatchObject({ level: "17", count: 2, average: 960000, best: 980000, clearRate: 0.5 });
    expect(targetScoreCandidates(records, 990000).map((entry) => entry.title)).toEqual(["A", "B", "C"]);
  });

  it("calculates SDVX per-chart and Best-50 VOLFORCE using explicit chart data", () => {
    expect(sdvxVfMilli(sdvx(0))).toBe(388);
    const result = sdvxVolforce(Array.from({ length: 51 }, (_, index) => sdvx(index, 9_900_000 - index * 1000)));
    expect(result.counted).toHaveLength(50);
    expect(result.cutoff).toBeGreaterThan(0);
    expect(result.potential[0].gainMilli).toBeGreaterThan(0);
  });

  it("extracts usable free-page score tables without confusing Flare Skill for score", () => {
    const data: KonamiPageSnapshot = {
      schema: "mai-score/konami-page-snapshot/v1", generatedAt: "2026-09-27T00:00:00Z",
      source: { game: "sound-voltex", connectionId: "sdvx", startUrl: "https://p.eagate.573.jp/game/sdvx/vi/playdata/index.html", region: "jp", pageLimit: 40 },
      pages: [{ url: "https://example.test", title: "Scores", access: "collected", headings: [], fields: [], text: [], tables: [{
        headers: ["曲名", "難易度", "LEVEL", "SCORE", "CLEAR", "単曲VF"],
        rows: [["Song", "EXHAUST", "18.3", "9,923,042", "EXCESSIVE RATE CLEAR", "0.388"]]
      }] }],
      summary: { collected: 1, paid: 0, signInRequired: 0, failed: 0, fields: 0, tables: 1 }
    };
    expect(scoresFromKonamiPages(data)).toEqual([expect.objectContaining({ title: "Song", level: 18.3, score: 9923042, ratingMilli: 388 })]);
    data.pages[0].tables[0].headers[3] = "フレアスキル";
    expect(scoresFromKonamiPages(data)).toEqual([]);
  });
});
