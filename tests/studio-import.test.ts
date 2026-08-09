import { describe, expect, it } from "vitest";
import { parseMaiScore } from "../studio/lib/import";

function rhythmRecord(index: number, bucket?: "b15" | "b35") {
  return {
    recordId: `record-${index}`,
    song: { id: `song-${index}`, title: `Song ${index}`, jacketId: `cover-${index}` },
    chart: {
      id: `chart-${index}`,
      type: index % 2 ? "dx" : "std",
      difficulty: index % 3 ? "master" : "expert",
      level: index < 25 ? "13+" : "14",
      levelValue: index < 25 ? 13.9 : 14.2
    },
    result: {
      achievementRate: 99 + index / 100,
      grade: "SS",
      rating: { value: 280 + index, system: "maimai-dx-rating" }
    },
    ...(bucket ? { grouping: { bucket, rank: index + 1 } } : {}),
    gameSpecific: { comboFlag: index % 2 ? "fc" : "ap", syncFlag: "fs", version: "CiRCLE PLUS" }
  };
}

function fullEnvelope() {
  return {
    schema: "mai-score/rhythm-record/v1",
    generatedAt: "2026-08-10T00:00:00.000Z",
    source: { game: "maimai-dx", connectionId: "fixture", region: "intl" },
    player: { displayName: "DIV", title: "Full Records", rating: 15000 },
    records: [
      ...Array.from({ length: 15 }, (_, index) => rhythmRecord(index, "b15")),
      ...Array.from({ length: 35 }, (_, index) => rhythmRecord(index + 15, "b35")),
      rhythmRecord(50),
      rhythmRecord(51),
      {
        ...rhythmRecord(52),
        recordId: "better-chart-50",
        chart: { ...rhythmRecord(50).chart, id: "chart-50" },
        result: { ...rhythmRecord(50).result, achievementRate: 100.5 }
      }
    ],
    summaries: [{
      system: "maimai-plate-progress",
      entries: [{ kind: "kiwami", version: "FESTiVAL", completed: 190, total: 195 }]
    }]
  };
}

describe("Studio Rhythm Record import", () => {
  it("validates, extracts B50, and retains one best result per full-record chart", () => {
    const parsed = parseMaiScore(fullEnvelope());
    expect(parsed.records).toHaveLength(50);
    expect(parsed.records.filter((record) => record.bucket === "b15")).toHaveLength(15);
    expect(parsed.records.filter((record) => record.bucket === "b35")).toHaveLength(35);
    expect(parsed.fullRecords).toHaveLength(52);
    expect(parsed.fullRecords?.find((record) => record.chartId === "chart-50")?.achievementRate).toBe(100.5);
    expect(parsed.plateProgress).toEqual([{ kind: "kiwami", version: "FESTiVAL", completed: 190, total: 195 }]);
    expect(parsed.b50Rating).toBe(parsed.b15Rating + parsed.b35Rating);
  });

  it("rejects duplicate record identifiers", () => {
    const envelope = fullEnvelope();
    envelope.records[1].recordId = envelope.records[0].recordId;
    expect(() => parseMaiScore(envelope)).toThrow(/Duplicate recordId/);
  });

  it("rejects unsupported games and invalid achievements", () => {
    const wrongGame = fullEnvelope();
    wrongGame.source.game = "sound-voltex";
    expect(() => parseMaiScore(wrongGame)).toThrow(/only maimai-dx/);

    const invalidAchievement = fullEnvelope();
    invalidAchievement.records[0].result.achievementRate = 102;
    expect(() => parseMaiScore(invalidAchievement)).toThrow(/between 0 and 101/);
  });

  it("requires an explicit 15/35 B50 grouping inside Full Records", () => {
    const envelope = fullEnvelope();
    delete envelope.records[0].grouping;
    expect(() => parseMaiScore(envelope)).toThrow(/Expected 15 new and 35 old charts/);
  });
});
