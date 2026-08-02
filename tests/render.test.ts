import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_OPTIONS, type ImageOptions } from "../src/lib/image-options";
import { renderB50Document } from "../src/lib/render";
import type { CollectionResult } from "../src/lib/types";

const result: CollectionResult = {
  schema: "mai-score/v1",
  exportedAt: "2026-07-27T06:00:00.000Z",
  source: "https://maimaidx-eng.com/maimai-mobile/home/ratingTargetMusic/",
  connection: { id: "dxnet-intl", protocolVersion: 1 },
  player: { name: "TEST PLAYER", title: "TEST TITLE", rating: 0 },
  records: Array.from({ length: 50 }, (_, index) => ({
    title: `Song ${index + 1}`,
    type: "dx" as const,
    difficulty: index % 5 === 0 ? "expert" as const : "master" as const,
    displayedLevel: "13+",
    internalLevelValue: 13.9,
    achievementRate: 0.1234,
    bucket: index < 15 ? "b15" as const : "b35" as const,
    chartRating: 0,
    imageName: `cover-${index}`
  })),
  b15Rating: 0,
  b35Rating: 0,
  b50Rating: 0,
  warnings: []
};

describe("B50 image templates", () => {
  it.each([
    ["classic", 2000, 2650],
    ["compact", 1600, 1990],
    ["landscape", 3000, 1840]
  ] as const)("renders %s at its native dimensions", (layout, width, height) => {
    const rendered = renderB50Document(result, { ...DEFAULT_IMAGE_OPTIONS, layout });
    expect(rendered).toMatchObject({ width, height });
    expect(rendered.svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    expect(rendered.svg.match(/B(?:15|35) #\d+/g)).toHaveLength(50);
    expect(rendered.svg).toContain("NEW CHARTS · BEST 15");
    expect(rendered.svg).toContain("OLD CHARTS · BEST 35");
  });

  it("applies watermark, timestamp, and visibility settings", () => {
    const rendered = renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      watermark: "<private>",
      showAchievement: false,
      showChartRating: false,
      showCovers: false
    }, {}, new Date("2026-07-27T06:30:45.000Z"), "en-US");
    expect(rendered.svg).toContain("&lt;private&gt;");
    expect(rendered.svg).not.toContain("UTC");
    expect(rendered.svg).not.toContain("ratingTierGradient");
    expect(rendered.svg).not.toContain("0.1234%");
  });

  it("does not render an official rating row", () => {
    const goldPlayer: CollectionResult = { ...result, player: { ...result.player, rating: 14200 } };
    const rendered = renderB50Document(goldPlayer, DEFAULT_IMAGE_OPTIONS);
    expect(rendered.svg).not.toContain("OFFICIAL RATING");
    expect(rendered.svg).not.toContain(">14200<");
    expect(rendered.svg).not.toContain("ratingTierGradient");
    expect(rendered.svg).not.toContain("<polygon");
  });

  it("separates the total, new B15, and old B35 scores", () => {
    const scored: CollectionResult = {
      ...result,
      b15Rating: 4355,
      b35Rating: 10321,
      b50Rating: 14676
    };
    const rendered = renderB50Document(scored, {
      ...DEFAULT_IMAGE_OPTIONS,
      showRatingBreakdown: true
    });
    expect(rendered.svg).toContain("BEST 50 · TOTAL");
    expect(rendered.svg).toContain(">14676<");
    expect(rendered.svg).toContain(">4355<");
    expect(rendered.svg).toContain(">10321<");
  });

  it("renders official achievement, combo, and sync images when enabled", () => {
    const decorated: CollectionResult = {
      ...result,
      records: result.records.map((record, index) => index === 0
        ? { ...record, achievementRate: 100.5, comboFlag: "ap+", syncFlag: "fsd+" }
        : record)
    };
    const badges = {
      "music_icon_sssp.png": "data:image/png;base64,rank",
      "music_icon_app.png": "data:image/png;base64,combo",
      "music_icon_fsdp.png": "data:image/png;base64,sync"
    };
    const shown = renderB50Document(decorated, DEFAULT_IMAGE_OPTIONS, { badges }).svg;
    const hidden = renderB50Document(decorated, { ...DEFAULT_IMAGE_OPTIONS, showScoreBadges: false }, { badges }).svg;
    expect(shown).toContain("data:image/png;base64,rank");
    expect(shown).toContain("data:image/png;base64,combo");
    expect(shown).toContain("data:image/png;base64,sync");
    expect(hidden).not.toContain("data:image/png;base64,rank");
  });

  it("carries the chart figure chartValue selects, with no CONST prefix", () => {
    const render = (chartValue: ImageOptions["chartValue"]) =>
      renderB50Document(result, { ...DEFAULT_IMAGE_OPTIONS, chartValue }).svg;

    expect(render("level")).toContain("MASTER · 13+<");
    expect(render("constant")).toContain("MASTER · 13.9<");
    expect(render("both")).toContain("MASTER · 13+ · 13.9<");
    expect(render("none")).toContain("MASTER<");
    // The prefix was dropped along with the pair of booleans.
    for (const mode of ["level", "constant", "both", "none"] as const) {
      expect(render(mode)).not.toContain("CONST");
    }
  });

  it("falls back to the displayed level when a chart has no constant", () => {
    // An unresolved chart should still say how hard it is rather than losing
    // its difficulty figure entirely.
    const unresolved: CollectionResult = {
      ...result,
      records: result.records.map((record) => ({ ...record, internalLevelValue: undefined }))
    };
    const rendered = renderB50Document(unresolved, {
      ...DEFAULT_IMAGE_OPTIONS,
      chartValue: "constant"
    });
    expect(rendered.svg).toContain("MASTER · 13+<");
  });

  it("blends the accent into card borders only as far as accentScope allows", () => {
    // stroke-width="3" is the card outline; the first bare stroke= in the
    // document belongs to the header panel, which is accent-coloured always.
    const border = (accentScope: ImageOptions["accentScope"]) => renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      accentScope,
      accentColor: "#ff0000"
    }).svg.match(/stroke="(#[0-9a-f]{8})" stroke-width="3"/)![1];

    // minimal is the original look: the expert difficulty colour, untouched.
    expect(border("minimal")).toBe("#ff5b666b");
    expect(border("outline")).not.toBe(border("minimal"));
    expect(border("full")).not.toBe(border("outline"));
  });

  it("tints surfaces only at the full accent scope", () => {
    const background = (accentScope: ImageOptions["accentScope"]) => renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      accentScope,
      accentColor: "#ff0000"
    }).svg.match(/<rect width="2000" height="2650" fill="(#[0-9a-f]{6})"\/>/)![1];

    expect(background("minimal")).toBe("#0b1022");
    expect(background("outline")).toBe("#0b1022");
    expect(background("full")).not.toBe("#0b1022");
  });

  it("renders the trophy under the name, in its rarity colour", () => {
    const gold: CollectionResult = {
      ...result,
      player: { ...result.player, title: "TEST TITLE", titleColor: "gold" }
    };
    const rendered = renderB50Document(gold, DEFAULT_IMAGE_OPTIONS);
    const nameY = Number(rendered.svg.match(/y="(\d+)" font-size="49"/)![1]);
    const trophyY = Number(rendered.svg.match(/<g transform="translate\(\d+ (\d+)\)">\s*<rect width="\d+" height="36"/)![1]);

    expect(trophyY).toBeGreaterThan(nameY);
    expect(rendered.svg).toContain('stop-color="#f8e5a6"');
    expect(rendered.svg).toContain('fill="url(#trophyFill)"');
  });

  it("treats an unknown trophy rarity as normal rather than dropping it", () => {
    const unknown: CollectionResult = {
      ...result,
      player: { ...result.player, title: "TEST TITLE", titleColor: "hologram" }
    };
    const rendered = renderB50Document(unknown, DEFAULT_IMAGE_OPTIONS);
    expect(rendered.svg).toContain("TEST TITLE");
    expect(rendered.svg).toContain('stop-color="#eef1f7"');
  });

  it("hides the trophy and nameplate when their toggles are off", () => {
    const decorated: CollectionResult = {
      ...result,
      player: { ...result.player, title: "TEST TITLE" }
    };
    const assets = { plate: "data:image/png;base64,plate" };
    const shown = renderB50Document(decorated, DEFAULT_IMAGE_OPTIONS, assets);
    const hidden = renderB50Document(
      decorated,
      { ...DEFAULT_IMAGE_OPTIONS, showPlayerTitle: false, showPlate: false },
      assets
    );

    expect(shown.svg).toContain("plateClip");
    expect(shown.svg).toContain('fill="url(#trophyFill)"');
    expect(hidden.svg).not.toContain("plateClip");
    expect(hidden.svg).not.toContain("trophyFill");
  });

  it.each([
    ["classic", 312],
    ["compact", 242],
    ["landscape", 302]
  ] as const)("keeps the frame above the %s New B15 section", (layout, frameHeight) => {
    const rendered = renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      layout,
      showFrame: true
    }, { frame: "data:image/png;base64,frame" });
    expect(rendered.svg).toContain(`height="${frameHeight}"`);
  });

  it("styles every text element inline, since the stylesheet defeats fill=", async () => {
    // <style>text{fill:…}</style> outranks a fill="…" presentation attribute on
    // the same element, so a muted <text> written that way silently renders in
    // the foreground colour instead. <rect> is unaffected and keeps fill=.
    for (const path of ["src/lib/render.ts", "studio/lib/render.ts"]) {
      const source = await readFile(path, "utf8");
      const offenders = source.match(/<text[^>]*\sfill="/g) ?? [];
      expect(offenders, `${path} has <text> using fill= instead of style="fill:…"`).toEqual([]);
    }
  });
});
