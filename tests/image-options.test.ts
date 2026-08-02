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

  it.each([
    [{ showLevel: true, showInternalLevel: false }, "level"],
    [{ showLevel: false, showInternalLevel: true }, "constant"],
    [{ showLevel: true, showInternalLevel: true }, "both"],
    [{ showLevel: false, showInternalLevel: false }, "none"],
    [{ showInternalLevel: true }, "both"]
  ])("reads the retired showLevel/showInternalLevel pair as %j", (legacy, expected) => {
    // Styles saved before chartValue existed must keep rendering what they
    // rendered, rather than snapping back to the default.
    expect(normalizeImageOptions(legacy)).toMatchObject({ chartValue: expected });
  });

  it("prefers an explicit chartValue over the legacy booleans", () => {
    expect(normalizeImageOptions({
      chartValue: "none",
      showLevel: true,
      showInternalLevel: true
    })).toMatchObject({ chartValue: "none" });
  });

  it("falls back to the default when neither form is present", () => {
    expect(normalizeImageOptions({ theme: "light" }).chartValue)
      .toBe(DEFAULT_IMAGE_OPTIONS.chartValue);
  });

  it("migrates the former all-in-one score badge toggle", () => {
    expect(normalizeImageOptions({ showScoreBadges: false })).toMatchObject({
      showAchievementRank: false,
      showComboBadge: false,
      showSyncBadge: false
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
