import { describe, expect, it } from "vitest";
import {
  levelInsights,
  iidxLevelSummaries,
  iidxReviewCandidates,
  rhythmRecordFromKonamiPages,
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

  it("builds IIDX lamp summaries and prioritizes weaker lamps without guessing score gaps", () => {
    const records: InsightScore[] = [
      { id: "a", title: "Failed", style: "SP", level: 12, score: 1800, grade: "A", clear: "FAILED" },
      { id: "b", title: "Hard", style: "SP", level: 12, score: 2200, grade: "AAA", clear: "HARD CLEAR" },
      { id: "c", title: "Full combo", style: "SP", level: 12, score: 2300, grade: "AAA", clear: "FULLCOMBO CLEAR" },
      { id: "d", title: "Double", style: "DP", level: 12, score: 2000, grade: "AA", clear: "CLEAR" }
    ];
    expect(iidxLevelSummaries(records, "SP")).toEqual([expect.objectContaining({ level: "12", count: 3, aaa: 2, hardOrBetter: 2, cleared: 2, failed: 1 })]);
    expect(iidxReviewCandidates(records, { style: "SP", level: "12" }).map((entry) => entry.title)).toEqual(["Failed", "Hard"]);
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
    const history = rhythmRecordFromKonamiPages(data);
    expect(history.records[0]).toMatchObject({
      song: { title: "Song" }, chart: { id: "Song\u0000EXHAUST\u0000", levelValue: 18.3 },
      result: { rawScore: 9923042, rating: { value: 388, system: "volforce-milli" } }
    });
    data.pages[0].tables[0].headers[3] = "フレアスキル";
    expect(scoresFromKonamiPages(data)).toEqual([]);
  });

  it("normalizes wide IIDX SP/DP page tables with EX SCORE columns", () => {
    const data: KonamiPageSnapshot = {
      schema: "mai-score/konami-page-snapshot/v1", generatedAt: "2026-09-29T00:00:00Z",
      source: { game: "beatmania-iidx", connectionId: "iidx", startUrl: "https://p.eagate.573.jp/game/2dx/34/djdata/music.html", region: "jp", pageLimit: 40 },
      pages: [{ url: "https://example.test", title: "Music data", access: "collected", headings: [], fields: [], text: [], tables: [{
        headers: ["TITLE", "SP ANOTHER LEVEL", "SP ANOTHER EX SCORE", "SP ANOTHER DJ LEVEL", "SP ANOTHER CLEAR TYPE", "DP HYPER LEVEL", "DP HYPER EX SCORE"],
        rows: [["Test Song", "12", "2,345", "AAA", "HARD CLEAR", "10", "1,800"]]
      }] }],
      summary: { collected: 1, paid: 0, signInRequired: 0, failed: 0, fields: 0, tables: 1 }
    };
    expect(scoresFromKonamiPages(data)).toEqual([
      expect.objectContaining({ title: "Test Song", style: "SP", difficulty: "ANOTHER", level: 12, score: 2345, grade: "AAA", clear: "HARD CLEAR" }),
      expect.objectContaining({ title: "Test Song", style: "DP", difficulty: "HYPER", level: 10, score: 1800 })
    ]);
  });
});
