import { describe, expect, it } from "vitest";
import { isGenericRhythmRecord, parseGenericRhythmRecord } from "../studio/lib/generic-rhythm";

const input = () => ({
  schema: "mai-score/rhythm-record/v1",
  generatedAt: "2026-09-18T12:00:00.000Z",
  source: { game: "sound-voltex", connectionId: "sdvx-konami", region: "jp" },
  records: [{
    recordId: "song:exhaust",
    song: { id: "song", title: "Test Song", artist: "Artist" },
    chart: { id: "song:exhaust", type: "SDVX", difficulty: "EXHAUST", level: "17" },
    result: { rawScore: 9876543, grade: "AAA+", clearStatus: "ULTIMATE CHAIN" }
  }]
});

describe("generic Rhythm Record dashboard import", () => {
  it("recognizes and validates supported KONAMI games", () => {
    expect(isGenericRhythmRecord(input())).toBe(true);
    expect(parseGenericRhythmRecord(input())).toMatchObject({
      source: { game: "sound-voltex", connectionId: "sdvx-konami" },
      records: [{ result: { rawScore: 9876543 } }]
    });
  });

  it("rejects duplicate record ids and unrelated games", () => {
    const duplicate = input();
    duplicate.records.push({ ...duplicate.records[0] });
    expect(() => parseGenericRhythmRecord(duplicate)).toThrow(/Duplicate/);
    expect(isGenericRhythmRecord({ ...input(), source: { game: "maimai-dx", connectionId: "dxnet" } })).toBe(false);
  });
});
