import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_OPTIONS,
  formatImageTimestamp,
  normalizeImageOptions,
  timestampForFilename
} from "../src/lib/image-options";

describe("image options", () => {
  it("normalizes persisted values and rejects invalid colors", () => {
    expect(normalizeImageOptions({
      layout: "landscape",
      theme: "maimai",
      accentColor: "red",
      watermark: "x".repeat(80),
      showFrame: false,
      scale: 1.5
    })).toMatchObject({
      layout: "landscape",
      theme: "maimai",
      accentColor: DEFAULT_IMAGE_OPTIONS.accentColor,
      watermark: "x".repeat(48),
      showFrame: false,
      scale: 1.5
    });
  });

  it("formats visible and filename timestamps deterministically", () => {
    const date = new Date("2026-07-27T06:30:45.000Z");
    const options = {
      ...DEFAULT_IMAGE_OPTIONS,
      timestampMode: "datetime" as const
    };
    expect(formatImageTimestamp(date, options, "en-US")).not.toContain("UTC");
    expect(timestampForFilename(date)).toBe("20260727-063045Z");
  });
});
