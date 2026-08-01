import { describe, expect, it } from "vitest";
import { accentReach as extensionAccentReach } from "../src/lib/render";
import { accentReach as studioAccentReach, renderStudioSvg } from "../studio/lib/render";
import { DEFAULT_OPTIONS, type AccentScope, type StudioData, type StudioOptions } from "../studio/lib/types";

const data: StudioData = {
  schema: "mai-score/v1",
  exportedAt: "2026-08-01T06:00:00.000Z",
  player: { name: "DIV", title: "TEST TITLE", rating: 14876 },
  records: Array.from({ length: 50 }, (_, index) => ({
    title: `Song ${index + 1}`,
    type: "dx" as const,
    difficulty: index % 5 === 0 ? "expert" as const : "master" as const,
    displayedLevel: "13+",
    internalLevelValue: 13.9,
    achievementRate: 100,
    bucket: index < 15 ? "b15" as const : "b35" as const,
    chartRating: 300
  })),
  b15Rating: 4535,
  b35Rating: 10341,
  b50Rating: 14876
};

const render = (options: Partial<StudioOptions> = {}) =>
  renderStudioSvg(data, { ...DEFAULT_OPTIONS, ...options }, "en").svg;

describe("Studio renderer", () => {
  it("agrees with the extension on how far the accent reaches", () => {
    // Studio cannot import from the extension package, so the reach table is
    // duplicated by hand. Both sides must return the same numbers or one
    // export would be tinted differently from the other.
    for (const scope of ["minimal", "outline", "full"] as AccentScope[]) {
      expect(studioAccentReach(scope)).toEqual(extensionAccentReach(scope));
    }
    expect(extensionAccentReach("outline").outline).toBe(.48);
    expect(extensionAccentReach("full").outline).toBe(.64);
  });

  it("carries the chart figure chartValue selects, with no CONST prefix", () => {
    expect(render({ chartValue: "level" })).toContain("MASTER · 13+<");
    expect(render({ chartValue: "constant" })).toContain("MASTER · 13.9<");
    expect(render({ chartValue: "both" })).toContain("MASTER · 13+ · 13.9<");
    expect(render({ chartValue: "none" })).toContain("MASTER<");
    expect(render({ chartValue: "both" })).not.toContain("CONST");
  });

  it("blends the accent into card borders only as far as accentScope allows", () => {
    // stroke-width="3" is the card outline; the first bare stroke= in the
    // document belongs to the header panel, which is accent-coloured always.
    const border = (accentScope: AccentScope) =>
      render({ accentScope, accent: "#ff0000" }).match(/stroke="(#[0-9a-f]{8})" stroke-width="3"/)![1];

    expect(border("minimal")).toBe("#ff5b6673");
    expect(border("outline")).not.toBe(border("minimal"));
    expect(border("full")).not.toBe(border("outline"));
  });

  it("tints surfaces only at the full accent scope", () => {
    const background = (accentScope: AccentScope) =>
      render({ accentScope, accent: "#ff0000" })
        .match(/<rect width="2000" height="2650" fill="(#[0-9a-f]{6})"\/>/)![1];

    expect(background("minimal")).toBe("#0a1022");
    expect(background("outline")).toBe("#0a1022");
    expect(background("full")).not.toBe("#0a1022");
  });

  it("renders the trophy under the name, in its rarity colour", () => {
    const gold = { ...data, player: { ...data.player, titleColor: "gold" } };
    const svg = renderStudioSvg(gold, DEFAULT_OPTIONS, "en").svg;
    const nameY = Number(svg.match(/y="(\d+)" font-size="49"/)![1]);
    const trophyY = Number(svg.match(/<g transform="translate\(\d+ (\d+)\)">\s*<rect width="\d+" height="36"/)![1]);

    expect(trophyY).toBeGreaterThan(nameY);
    expect(svg).toContain('stop-color="#f8e5a6"');
  });

  it("hides the trophy and nameplate when their toggles are off", () => {
    const assets = { covers: {}, plate: "data:image/png;base64,plate" };
    const shown = renderStudioSvg(data, DEFAULT_OPTIONS, "en", "", new Date(), assets).svg;
    const hidden = renderStudioSvg(
      data,
      { ...DEFAULT_OPTIONS, showTrophy: false, showPlate: false },
      "en",
      "",
      new Date(),
      assets
    ).svg;

    expect(shown).toContain("plateClip");
    expect(shown).toContain('fill="url(#trophyFill)"');
    expect(hidden).not.toContain("plateClip");
    expect(hidden).not.toContain("trophyFill");
  });

  it("truncates a full-width title to the card rather than past its edge", () => {
    // Counting characters treated a CJK glyph as narrow as an "i", so titles
    // overflowed. The classic card has 204px of text column at 21px type.
    const wide = {
      ...data,
      records: data.records.map((record) => ({ ...record, title: "オンソクラビットオンソクラビット" }))
    };
    const svg = renderStudioSvg(wide, DEFAULT_OPTIONS, "en").svg;
    const [, title] = svg.match(/font-weight="750">([^<]+)</)!;
    expect(title.endsWith("…")).toBe(true);
    expect([...title].length).toBeLessThan(12);
  });
});
