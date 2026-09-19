import { describe, expect, it } from "vitest";
import {
  isKonamiImportRequest,
  LAST_COLLECTION_KEY,
  LAST_RHYTHM_RECORD_KEY
} from "../src/lib/konami-import";

const data = {
  schema: "mai-score/rhythm-record/v1",
  generatedAt: "2026-09-18T00:00:00.000Z",
  source: { game: "sound-voltex", connectionId: "sdvx-konami" },
  records: [{ recordId: "one" }]
};

describe("KONAMI in-page import protocol", () => {
  it("accepts supported local records and known languages", () => {
    expect(isKonamiImportRequest({ type: "MAI_SCORE_KONAMI_IMPORT", data, language: "zh-Hant" })).toBe(true);
    expect(isKonamiImportRequest({ type: "MAI_SCORE_KONAMI_IMPORT", data, language: "xx" })).toBe(false);
  });

  it("rejects unrelated games and empty imports", () => {
    expect(isKonamiImportRequest({
      type: "MAI_SCORE_KONAMI_IMPORT",
      data: { ...data, source: { game: "maimai-dx", connectionId: "dxnet" } },
      language: "en"
    })).toBe(false);
    expect(isKonamiImportRequest({ type: "MAI_SCORE_KONAMI_IMPORT", data: { ...data, records: [] }, language: "en" })).toBe(false);
  });

  it("keeps stable local persistence keys", () => {
    expect(LAST_COLLECTION_KEY).toBe("lastCollectionV1");
    expect(LAST_RHYTHM_RECORD_KEY).toBe("lastRhythmRecordV1");
  });
});
