import { describe, expect, it } from "vitest";
import {
  isStudioImportRequest,
  isStudioSender,
  studioTransferKey
} from "../src/lib/studio-transfer";

describe("Studio transfer", () => {
  it("accepts only a UUID-shaped one-time request", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    expect(isStudioImportRequest({ type: "MAI_SCORE_STUDIO_IMPORT", token })).toBe(true);
    expect(isStudioImportRequest({ type: "MAI_SCORE_STUDIO_IMPORT", token: "short" })).toBe(false);
    expect(studioTransferKey(token)).toBe(`studioTransfer:${token}`);
  });

  it("accepts only the deployed Studio origin", () => {
    expect(isStudioSender("https://mai-score.milifix.com/")).toBe(true);
    expect(isStudioSender("https://mai-score.milifix.com.fake.example/")).toBe(false);
    expect(isStudioSender("https://example.com/")).toBe(false);
  });
});
