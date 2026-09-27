import { describe, expect, it } from "vitest";
import { isMaimaiImportRequest } from "../src/lib/maimai-import";

const result = {
  schema: "mai-score/v1",
  exportedAt: "2026-09-26T12:00:00.000Z",
  source: "https://maimaidx-eng.com/maimai-mobile/home/ratingTargetMusic/",
  player: { name: "Player", rating: 15000 },
  records: Array.from({ length: 50 }, (_, index) => ({ title: `Song ${index}` })),
  b15Rating: 4500,
  b35Rating: 10500,
  b50Rating: 15000,
  warnings: []
};

describe("maimai page-to-Studio import request", () => {
  it("accepts a complete collection with a supported language", () => {
    expect(isMaimaiImportRequest({
      type: "MAI_SCORE_MAIMAI_IMPORT",
      data: result,
      language: "zh-Hant",
      autoSync: true
    })).toBe(true);
  });

  it("rejects incomplete or malformed page messages", () => {
    expect(isMaimaiImportRequest({
      type: "MAI_SCORE_MAIMAI_IMPORT",
      data: { ...result, records: result.records.slice(0, 49) },
      language: "zh-Hant"
    })).toBe(false);
    expect(isMaimaiImportRequest({
      type: "MAI_SCORE_MAIMAI_IMPORT",
      data: result,
      language: "fr"
    })).toBe(false);
  });
});
