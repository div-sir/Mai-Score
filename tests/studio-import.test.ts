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

describe("plate progress through a Mai-Score document", () => {
  const b50 = (index: number) => ({
    title: `Song ${index + 1}`,
    type: "dx" as const,
    difficulty: "master" as const,
    displayedLevel: "13+",
    internalLevelValue: 13.9,
    achievementRate: 100,
    bucket: index < 15 ? "b15" as const : "b35" as const,
    chartRating: 300
  });

  const maiScore = (extra: Record<string, unknown> = {}) => ({
    schema: "mai-score/v1",
    exportedAt: "2026-09-01T00:00:00.000Z",
    player: { name: "DIV", title: "TEST", rating: 15000 },
    records: Array.from({ length: 50 }, (_, index) => b50(index)),
    b15Rating: 4500,
    b35Rating: 10500,
    b50Rating: 15000,
    ...extra
  });

  const versionTotals = [{ version: "PRiSM", basic: 2, advanced: 2, expert: 2, master: 2, remaster: 2 }];
  const fullRecords = [
    { ...b50(0), difficulty: "basic" as const, version: "PRiSM", comboFlag: "ap" as const },
    { ...b50(0), difficulty: "master" as const, version: "PRiSM", comboFlag: "fc" as const }
  ];

  it("computes plate progress from Full Records and catalog totals", () => {
    const parsed = parseMaiScore(maiScore({ fullRecords, versionTotals }));
    const kiwami = parsed.plateProgress?.find((entry) => entry.kind === "kiwami");
    const kami = parsed.plateProgress?.find((entry) => entry.kind === "kami");

    // 8 = BASIC+ADVANCED+EXPERT+MASTER at 2 charts each; Re:MASTER excluded.
    expect(kiwami).toMatchObject({ version: "PRiSM", completed: 2, total: 8 });
    expect(kami).toMatchObject({ completed: 1, total: 8 });
  });

  it("reports no plate progress from a B50-only document", () => {
    // Without Full Records there is nothing to count, and without totals there
    // is no honest denominator. Either absence must yield silence, not zeroes.
    expect(parseMaiScore(maiScore()).plateProgress).toBeUndefined();
    expect(parseMaiScore(maiScore({ fullRecords })).plateProgress).toBeUndefined();
    expect(parseMaiScore(maiScore({ versionTotals })).plateProgress).toBeUndefined();
  });

  it("prefers plate progress the document states outright", () => {
    // An adapter that reports exact completion knows things the catalog does
    // not; the computed fallback must not overwrite it.
    const stated = [{ kind: "kiwami", version: "PRiSM", completed: 7, total: 8 }];
    const parsed = parseMaiScore(maiScore({ fullRecords, versionTotals, plateProgress: stated }));
    expect(parsed.plateProgress).toEqual(stated);
  });

  it("drops version totals that were tampered with rather than trusting them", () => {
    const broken = [{ version: "PRiSM", basic: 2, advanced: 2, expert: 2, master: -1, remaster: 2 }];
    expect(parseMaiScore(maiScore({ fullRecords, versionTotals: broken })).plateProgress).toBeUndefined();
  });
});
