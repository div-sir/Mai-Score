import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGE_OPTIONS } from "../src/lib/image-options";
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

  it("shows the chart constant only when enabled", () => {
    const hidden = renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      showInternalLevel: false
    });
    const visible = renderB50Document(result, {
      ...DEFAULT_IMAGE_OPTIONS,
      showInternalLevel: true
    });
    expect(hidden.svg).not.toContain("CONST 13.9");
    expect(visible.svg).toContain("CONST 13.9");
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
});
