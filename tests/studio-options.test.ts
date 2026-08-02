import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, normalizeLanguage, normalizeStudioOptions } from "../studio/lib/types";

describe("normalizing a stored or shared Studio style", () => {
  it("keeps values it recognizes and fills in the rest", () => {
    expect(normalizeStudioOptions({
      layout: "landscape",
      theme: "maimai",
      accentScope: "full",
      watermark: "@div"
    })).toEqual({
      ...DEFAULT_OPTIONS,
      layout: "landscape",
      theme: "maimai",
      accentScope: "full",
      watermark: "@div"
    });
  });

  it("rejects values outside each field's vocabulary", () => {
    expect(normalizeStudioOptions({
      layout: "poster",
      theme: "neon",
      accent: "rebeccapurple",
      accentScope: "everywhere",
      chartValue: "internal",
      timestamp: "epoch"
    })).toEqual(DEFAULT_OPTIONS);
  });

  it("drops keys that are no longer part of the style", () => {
    // A preset link from an older build carries retired fields; they must not
    // survive into the options object and reach the renderer.
    const normalized = normalizeStudioOptions({
      showOfficialRating: true,
      timezone: "Asia/Taipei"
    }) as unknown as Record<string, unknown>;
    expect(normalized.showOfficialRating).toBeUndefined();
    expect(normalized.timezone).toBeUndefined();
  });

  it.each([
    [{ showLevel: true, showConstant: false }, "level"],
    [{ showLevel: false, showConstant: true }, "constant"],
    [{ showLevel: true, showConstant: true }, "both"],
    [{ showLevel: false, showConstant: false }, "none"],
    [{ showConstant: true }, "both"]
  ])("reads the retired showLevel/showConstant pair as %j", (legacy, expected) => {
    expect(normalizeStudioOptions(legacy)).toMatchObject({ chartValue: expected });
  });

  it("prefers an explicit chartValue over the legacy booleans", () => {
    expect(normalizeStudioOptions({
      chartValue: "none",
      showLevel: true,
      showConstant: true
    })).toMatchObject({ chartValue: "none" });
  });

  it("caps the watermark at the length the input allows", () => {
    expect(normalizeStudioOptions({ watermark: "x".repeat(80) }).watermark).toHaveLength(48);
  });

  it("migrates retired title and score badge toggles", () => {
    expect(normalizeStudioOptions({ showTrophy: false, showScoreBadges: false })).toMatchObject({
      showPlayerTitle: false,
      showAchievementRank: false,
      showComboBadge: false,
      showSyncBadge: false
    });
  });

  it("falls back to English for an unknown language", () => {
    expect(normalizeLanguage("zh-Hant")).toBe("zh-Hant");
    expect(normalizeLanguage("kl")).toBe("en");
    expect(normalizeLanguage(undefined)).toBe("en");
  });
});
