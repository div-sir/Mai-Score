import { describe, expect, it } from "vitest";
import { importWithAdapter } from "../studio/lib/import-adapters";

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
});
