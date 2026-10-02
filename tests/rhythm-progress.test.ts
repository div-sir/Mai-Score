import { describe, expect, it } from "vitest";
import { compareRhythmRecords } from "../studio/lib/rhythm-progress";
import type { RhythmRecordEnvelope } from "../src/lib/rhythm-record";

const snapshot = (generatedAt: string, scores: Array<[string, number]>): RhythmRecordEnvelope => ({
  schema: "mai-score/rhythm-record/v1", generatedAt,
  source: { game: "sound-voltex", connectionId: "test" },
  records: scores.map(([id, score]) => ({
    recordId: id, song: { id, title: `Song ${id}` },
    chart: { id, difficulty: "EXHAUST", level: "18" }, result: { rawScore: score }
  }))
});

describe("multi-game score progress", () => {
  it("separates newly collected charts from score improvements", () => {
    const result = compareRhythmRecords(snapshot("2026-09-29", [["a", 9_950_000], ["b", 9_800_000], ["c", 9_000_000]]), snapshot("2026-09-28", [["a", 9_900_000], ["b", 9_850_000]]));
    expect(result).toMatchObject({ previousAt: "2026-09-28", newCharts: 1, improvedCharts: 1, scoreGain: 50_000 });
    expect(result?.topImprovements[0]).toMatchObject({ id: "a", previousScore: 9_900_000, score: 9_950_000, gain: 50_000 });
  });

  it("does not compare different games", () => {
    const previous = snapshot("2026-09-28", [["a", 1]]);
    previous.source.game = "dance-dance-revolution";
    expect(compareRhythmRecords(snapshot("2026-09-29", [["a", 2]]), previous)).toBeUndefined();
  });
});
