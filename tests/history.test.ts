import { describe, expect, it } from "vitest";
import { chartKey, diffHistory, fromHistoryEntry, sortHistory, toHistoryEntry } from "../studio/lib/history";
import type { HistoryEntry } from "../studio/lib/history";
import type { StudioData, StudioRecord } from "../studio/lib/types";

const record = (overrides: Partial<StudioRecord> = {}): StudioRecord => ({
  title: "Aurora Signal",
  type: "dx",
  difficulty: "master",
  displayedLevel: "13",
  achievementRate: 99,
  bucket: "b15",
  chartRating: 280,
  ...overrides
});

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  generatedAt: "2026-07-01T00:00:00.000Z",
  savedAt: "2026-07-01T00:00:00.000Z",
  source: "extension",
  language: "en",
  playerName: "DIV",
  officialRating: 14000,
  b50Rating: 14000,
  records: [record()],
  ...overrides
});

describe("history entries", () => {
  it("keys a collection by when it was taken, not when it was saved", () => {
    const data = {
      schema: "mai-score/v1",
      exportedAt: "2026-07-02T03:04:05.000Z",
      player: { name: "DIV", rating: 15000 },
      b50Rating: 14900,
      records: [record()]
    } as unknown as StudioData;

    const first = toHistoryEntry(data, "extension", "en", "2026-07-02T09:00:00.000Z");
    const second = toHistoryEntry(data, "extension", "en", "2026-07-03T09:00:00.000Z");

    // Saving twice must land on one key so the timeline gains one point.
    expect(first.generatedAt).toBe("2026-07-02T03:04:05.000Z");
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.savedAt).not.toBe(first.savedAt);
    expect(second.provenance).toEqual({
      sourceSchema: "mai-score/v1",
      observedAt: "2026-07-02T03:04:05.000Z",
      importedAt: "2026-07-03T09:00:00.000Z"
    });
  });

  it("copies records so later edits cannot rewrite history", () => {
    const source = record();
    const data = {
      schema: "mai-score/v1",
      exportedAt: "2026-07-02T00:00:00.000Z",
      player: { name: "DIV", rating: 15000 },
      b50Rating: 14900,
      records: [source]
    } as unknown as StudioData;

    const saved = toHistoryEntry(data, "extension", "en");
    source.achievementRate = 12;
    expect(saved.records[0].achievementRate).toBe(99);
  });

  it("restores a previewable B50 from synced history and rebuilds its totals", () => {
    const restored = fromHistoryEntry(entry({
      playerTitle: "Champion",
      playerIconUrl: "https://example.com/icon.png",
      records: [
        record({ bucket: "b15", chartRating: 301 }),
        record({ title: "Old song", bucket: "b35", chartRating: 289 })
      ],
      b50Rating: 99999
    }));

    expect(restored.exportedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(restored.player).toMatchObject({
      name: "DIV",
      title: "Champion",
      iconUrl: "https://example.com/icon.png"
    });
    expect(restored.b15Rating).toBe(301);
    expect(restored.b35Rating).toBe(289);
    expect(restored.b50Rating).toBe(590);
  });

  it("preserves exact plate progress through local and Drive history", () => {
    const data = {
      schema: "mai-score/v1",
      exportedAt: "2026-07-02T03:04:05.000Z",
      player: { name: "DIV", rating: 15000 },
      records: [record()],
      b15Rating: 280,
      b35Rating: 0,
      b50Rating: 280,
      plateProgress: [{ kind: "kiwami" as const, version: "FESTiVAL", completed: 182, total: 195 }]
    } as StudioData;
    const saved = toHistoryEntry(data, "full-records", "en");
    expect(fromHistoryEntry(saved).plateProgress).toEqual(data.plateProgress);
    data.plateProgress![0].completed = 1;
    expect(saved.plateProgress![0].completed).toBe(182);
  });

  it("distinguishes the same song across type and difficulty", () => {
    const master = record({ difficulty: "master" });
    expect(chartKey(master)).not.toBe(chartKey(record({ difficulty: "expert" })));
    expect(chartKey(master)).not.toBe(chartKey(record({ type: "std" })));
    expect(chartKey(master)).toBe(chartKey(record()));
  });

  it("orders history newest first", () => {
    const ordered = sortHistory([
      entry({ generatedAt: "2026-07-01T00:00:00.000Z" }),
      entry({ generatedAt: "2026-07-09T00:00:00.000Z" }),
      entry({ generatedAt: "2026-07-05T00:00:00.000Z" })
    ]);
    expect(ordered.map((item) => item.generatedAt)).toEqual([
      "2026-07-09T00:00:00.000Z",
      "2026-07-05T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    ]);
  });
});

describe("history diff", () => {
  it("reports charts that entered and left the B50", () => {
    const before = entry({ records: [record({ title: "Stays" }), record({ title: "Drops" })] });
    const after = entry({ records: [record({ title: "Stays" }), record({ title: "Arrives" })] });

    const diff = diffHistory(before, after);
    expect(diff.entered.map((r) => r.title)).toEqual(["Arrives"]);
    expect(diff.left.map((r) => r.title)).toEqual(["Drops"]);
  });

  it("reports achievement and rating movement on charts kept in both", () => {
    const before = entry({ records: [record({ achievementRate: 99, chartRating: 280 })] });
    const after = entry({ records: [record({ achievementRate: 100.5, chartRating: 300 })] });

    const diff = diffHistory(before, after);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].previousAchievement).toBe(99);
    expect(diff.changed[0].achievementDelta).toBeCloseTo(1.5);
    expect(diff.changed[0].ratingDelta).toBe(20);
  });

  it("leaves untouched charts out of the change list", () => {
    const diff = diffHistory(entry(), entry());
    expect(diff.changed).toEqual([]);
    expect(diff.entered).toEqual([]);
    expect(diff.left).toEqual([]);
    expect(diff.ratingDelta).toBe(0);
  });

  it("ranks the biggest rating gain first", () => {
    const before = entry({
      records: [
        record({ title: "Small", chartRating: 280, achievementRate: 99 }),
        record({ title: "Big", chartRating: 250, achievementRate: 97 })
      ]
    });
    const after = entry({
      records: [
        record({ title: "Small", chartRating: 282, achievementRate: 99.2 }),
        record({ title: "Big", chartRating: 300, achievementRate: 100.5 })
      ]
    });

    expect(diffHistory(before, after).changed.map((c) => c.record.title)).toEqual(["Big", "Small"]);
  });

  it("tracks the official rating separately from the computed total", () => {
    const before = entry({ b50Rating: 14000, officialRating: 14000 });
    const after = entry({ b50Rating: 14120, officialRating: 14100 });

    const diff = diffHistory(before, after);
    expect(diff.ratingDelta).toBe(120);
    expect(diff.officialRatingDelta).toBe(100);
  });
});
