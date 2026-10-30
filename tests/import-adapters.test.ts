import { describe, expect, it } from "vitest";
import { importFileWithAdapter, importWithAdapter } from "../studio/lib/import-adapters";

describe("Studio import adapter registry", () => {
  it("selects the generic Rhythm Record adapter", () => {
    const imported = importWithAdapter({
      schema: "mai-score/rhythm-record/v1",
      generatedAt: "2026-10-28T12:00:00.000Z",
      source: { game: "sound-voltex", connectionId: "test" },
      records: [{
        recordId: "one",
        song: { id: "song", title: "Song" },
        chart: { id: "chart", difficulty: "EXH", level: "18" },
        result: { rawScore: 9_900_000 }
      }]
    });
    expect(imported.adapter).toBe("rhythm-record");
    expect(imported.kind).toBe("rhythm-record");
  });

  it("reports an unsupported scalar instead of guessing", () => {
    expect(() => importWithAdapter("not a dataset")).toThrow(/No compatible import adapter/);
  });

  it("imports an sdvx_helper CSV with quoted titles and VF metadata", () => {
    const imported = importFileWithAdapter({
      name: "sdvx_score.csv",
      mimeType: "text/csv",
      text: '\uFEFFLV,Title,Difficulty,Lamp,Score,EXScore,Grade,VF,Last Played\r\n18,"Song, One",EXHAUST,UC,9987654,4210,AAA+,392,2026-10-28 20:15\r\n'
    });
    expect(imported.adapter).toBe("sdvx-helper");
    expect(imported.kind).toBe("rhythm-record");
    if (imported.kind !== "rhythm-record") throw new Error("Expected a Rhythm Record import.");
    expect(imported.data.source).toMatchObject({ game: "sound-voltex", connectionId: "sdvx-helper-csv" });
    expect(imported.data.records[0]).toMatchObject({
      playedAt: "2026-10-28T20:15:00",
      song: { title: "Song, One" },
      chart: { difficulty: "EXHAUST", level: "18", levelValue: 18 },
      result: { rawScore: 9_987_654, grade: "AAA+", clearStatus: "UC", rating: { value: 392, system: "volforce-milli" } },
      gameSpecific: { exScore: 4210 }
    });
  });

  it("does not mistake an unrelated CSV for an SDVX export", () => {
    expect(() => importFileWithAdapter({ name: "scores.csv", text: "name,value\nfoo,10" })).toThrow(/No compatible import adapter/);
  });
});
