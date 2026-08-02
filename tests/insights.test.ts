import { describe, expect, it } from "vitest";
import {
  buildChartHistory,
  buildRatingTimeline,
  buildUpgradeTargets,
  calculateInsightRating,
  listHistoryCharts,
  periodDelta,
  snapshotProvenance
} from "../studio/lib/insights";
import { calculateChartRating } from "../src/lib/rating";
import { chartKey, type HistoryEntry } from "../studio/lib/history";
import type { StudioData, StudioRecord } from "../studio/lib/types";

const record = (overrides: Partial<StudioRecord> = {}): StudioRecord => ({
  title: "Aurora Signal",
  type: "dx",
  difficulty: "master",
  displayedLevel: "13+",
  internalLevelValue: 13.7,
  achievementRate: 99.8,
  bucket: "b15",
  chartRating: 289,
  ...overrides
});

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  generatedAt: "2026-07-01T00:00:00.000Z",
  savedAt: "2026-07-01T00:01:00.000Z",
  source: "Mai-Score extension",
  language: "en",
  playerName: "DIV",
  officialRating: 14000,
  b15Rating: 4300,
  b35Rating: 10000,
  b50Rating: 14300,
  records: [record()],
  ...overrides
});

describe("rating insights", () => {
  it("builds an oldest-first B15/B35/B50 timeline", () => {
    const timeline = buildRatingTimeline([
      entry({ generatedAt: "2026-07-10T00:00:00.000Z", b15Rating: 4400, b35Rating: 10100 }),
      entry()
    ]);
    expect(timeline.map((point) => point.b50)).toEqual([14300, 14500]);
    expect(periodDelta(timeline, "b50")).toBe(200);
    expect(periodDelta(timeline, "b15")).toBe(100);
  });

  it("rebuilds missing bucket subtotals from records", () => {
    const timeline = buildRatingTimeline([entry({
      b15Rating: undefined,
      b35Rating: undefined,
      records: [record({ bucket: "b15", chartRating: 300 }), record({ title: "Old", bucket: "b35", chartRating: 290 })]
    })]);
    expect(timeline[0]).toMatchObject({ b15: 300, b35: 290, b50: 590 });
  });

  it("uses the same chart-rating model as the extension", () => {
    for (const achievement of [97, 98, 99, 99.5, 100, 100.4999, 100.5]) {
      expect(calculateInsightRating(13.7, achievement)).toBe(calculateChartRating(13.7, achievement));
    }
  });

  it("agrees with the extension across every coefficient band", () => {
    // insights.ts keeps its own copy of the coefficient table, because Studio
    // ships as its own package. The case above only reaches the 97+ bands, so
    // the twelve entries below that were unguarded — and a B50 upgrade card
    // subtracts a rating the extension computed from one this file computes,
    // so a drifted entry shows up as a wrong gain, or as a target silently
    // dropped when the difference clamps to zero.
    const mismatches: string[] = [];
    for (let level = 10; level <= 155; level += 5) {
      for (let rate = 0; rate <= 1005000; rate += 313) {
        const internalLevel = level / 10;
        const achievement = rate / 10000;
        const extension = calculateChartRating(internalLevel, achievement);
        const studio = calculateInsightRating(internalLevel, achievement);
        if (extension !== studio && mismatches.length < 5) {
          mismatches.push(`level ${internalLevel} at ${achievement}%: ${extension} vs ${studio}`);
        }
      }
    }
    expect(mismatches, "the two rating models disagree").toEqual([]);
  });

  it("clamps out-of-range achievement the same way on both sides", () => {
    for (const achievement of [-5, 0, 101, 150]) {
      expect(calculateInsightRating(13.7, achievement)).toBe(calculateChartRating(13.7, achievement));
    }
  });

  it("ranks practical B50 upgrades by gain per achievement needed", () => {
    const data = {
      records: [
        record({ title: "Near target", achievementRate: 99.99, chartRating: calculateChartRating(13.7, 99.99) }),
        record({ title: "Far target", achievementRate: 99.6, chartRating: calculateChartRating(13.7, 99.6) })
      ]
    } as StudioData;
    const targets = buildUpgradeTargets(data);
    expect(targets[0].record.title).toBe("Near target");
    expect(targets[0].targetAchievement).toBe(100);
    expect(targets[0].ratingGain).toBeGreaterThan(0);
  });

  it("does not fabricate targets for charts without an internal level", () => {
    const data = { records: [record({ internalLevelValue: undefined })] } as StudioData;
    expect(buildUpgradeTargets(data)).toEqual([]);
  });
});

describe("chart history and provenance", () => {
  it("lists each chart once and tracks its observations chronologically", () => {
    const first = entry();
    const second = entry({
      generatedAt: "2026-07-08T00:00:00.000Z",
      records: [record({ achievementRate: 100.1, chartRating: 300 })]
    });
    expect(listHistoryCharts([second, first])).toHaveLength(1);
    expect(buildChartHistory([second, first], chartKey(record())).map((point) => point.achievementRate))
      .toEqual([99.8, 100.1]);
  });

  it("labels old snapshots instead of inventing provenance", () => {
    expect(snapshotProvenance(entry()).sourceSchema).toContain("legacy");
    expect(snapshotProvenance(entry({ provenance: {
      sourceSchema: "mai-score/rhythm-record/v1",
      observedAt: "2026-07-01T00:00:00.000Z",
      importedAt: "2026-07-01T00:01:00.000Z"
    } })).sourceSchema).toBe("mai-score/rhythm-record/v1");
  });
});
