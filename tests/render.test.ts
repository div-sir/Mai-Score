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
      timestampZone: "utc",
      showOfficialRating: false,
      showAchievement: false,
      showChartRating: false,
      showCovers: false
    }, {}, new Date("2026-07-27T06:30:45.000Z"), "en-US");
    expect(rendered.svg).toContain("&lt;private&gt;");
    expect(rendered.svg).toContain("UTC");
    expect(rendered.svg).not.toContain("ratingTierGradient");
    expect(rendered.svg).not.toContain("0.1234%");
  });

  it("draws the official rating as a tier-coloured badge, not plain text", () => {
    const goldPlayer: CollectionResult = { ...result, player: { ...result.player, rating: 14699 } };
    const rendered = renderB50Document(goldPlayer, { ...DEFAULT_IMAGE_OPTIONS, showOfficialRating: true });
    expect(rendered.svg).toContain("ratingTierGradient");
    expect(rendered.svg).toContain(">14699<");
    expect(rendered.svg).toContain(">RATING<");
    // 14699 falls in the gold band; its gradient colours must actually appear.
    expect(rendered.svg).toContain("#ffe9a8");
    expect(rendered.svg).toContain("#e8b23d");
  });
});
