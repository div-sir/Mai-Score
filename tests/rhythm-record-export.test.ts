import { describe, expect, it } from "vitest";
import { rhythmRecordsCsv } from "../studio/lib/rhythm-record-export";
import type { RhythmRecordEnvelope } from "../src/lib/rhythm-record";

describe("rhythm record CSV export", () => {
  it("exports normalized fields and prevents spreadsheet formula injection", () => {
    const records: RhythmRecordEnvelope["records"] = [{
      recordId: "one", song: { id: "song", title: "=HYPERLINK(\"bad\")", artist: "A, B" },
      chart: { id: "chart", difficulty: "EXHAUST", type: "SINGLE", level: "18" },
      result: { rawScore: 9_900_000, grade: "S", clearStatus: "CLEAR", missCount: 3, rating: { system: "vf", value: 0.388 } }
    }];
    const csv = rhythmRecordsCsv(records);
    expect(csv).toMatch(/^\uFEFF"Title","Artist"/);
    expect(csv).toContain("\"'=HYPERLINK(\"\"bad\"\")\"");
    expect(csv).toContain("\"A, B\",\"EXHAUST\",\"SINGLE\",\"18\",\"9900000\"");
    expect(csv).toContain("\"0.388\",\"vf\"");
  });
});
