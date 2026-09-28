import { describe, expect, it } from "vitest";
import { renderScoreShareCard } from "../studio/lib/score-card";
import type { InsightScore } from "../studio/lib/rhythm-insights";

const records: InsightScore[] = [
  { id: "a", title: "A & <B>", difficulty: "EXHAUST", level: 18.3, score: 9_923_042, clear: "EXCESSIVE RATE CLEAR" },
  { id: "b", title: "Second Song", difficulty: "MAXIMUM", level: 19, score: 9_780_000, clear: "ULTIMATE CHAIN" }
];

describe("DDR and SDVX insight share cards", () => {
  it("renders a local SDVX card with VF, target gaps, and escaped titles", () => {
    const card = renderScoreShareCard("sound-voltex", records, 10_000_000, "en", "2026-09-28T00:00:00Z");
    expect(card).toMatchObject({ width: 1080, height: 1350 });
    expect(card.svg).toContain("SOUND VOLTEX");
    expect(card.svg).toContain("Estimated VOLFORCE");
    expect(card.svg).toContain("A &amp; &lt;B&gt;");
    expect(card.svg).toContain("Generated locally by Mai-Score");
  });

  it("renders localized DDR cards without a VOLFORCE claim", () => {
    const card = renderScoreShareCard("dance-dance-revolution", records.map((record) => ({ ...record, score: 950_000 })), 990_000, "zh-Hant");
    expect(card.svg).toContain("成績分析卡");
    expect(card.svg).toContain("DanceDanceRevolution");
    expect(card.svg).not.toContain("VOLFORCE");
  });
});
