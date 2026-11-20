import { describe, expect, it } from "vitest";
import {
  createPassport,
  decodePassport,
  encodePassport,
  maimaiPassportSummary,
  parsePassport
} from "../studio/lib/passport";
import type { StudioData } from "../studio/lib/types";

const maimai = {
  schema: "mai-score/v1",
  exportedAt: "2026-10-28T12:00:00.000Z",
  player: { name: "SOLILIUM", title: "", rating: 15000 },
  records: Array.from({ length: 50 }, (_, index) => ({
    title: `Song ${index}`, type: "dx" as const, difficulty: "master" as const,
    displayedLevel: "13", achievementRate: 100, bucket: index < 15 ? "b15" as const : "b35" as const
  })),
  fullRecords: Array.from({ length: 120 }, (_, index) => ({
    title: `Full ${index}`, type: "dx" as const, difficulty: "master" as const,
    displayedLevel: "13", achievementRate: 100
  })),
  b15Rating: 4500,
  b35Rating: 10500,
  b50Rating: 15000
} satisfies StudioData;

describe("public Passport", () => {
  it("projects only public maimai summary values", () => {
    expect(maimaiPassportSummary(maimai)).toEqual({
      game: "maimai-dx",
      playerName: "SOLILIUM",
      rating: 15000,
      playedCharts: 120,
      updatedAt: "2026-10-28T12:00:00.000Z",
      source: "mai-score"
    });
  });

  it("adds best-known DX Score totals without double-counting the same chart", () => {
    const summary = maimaiPassportSummary({
      ...maimai,
      recentPlays: [
        { ...maimai.records[0], playedAt: "2026-10-28T10:00", track: 1, newAchievement: false, dxScore: 2500, dxScoreMax: 3000 },
        { ...maimai.records[0], playedAt: "2026-10-28T11:00", track: 1, newAchievement: false, dxScore: 2700, dxScoreMax: 3000 },
        { ...maimai.records[1], playedAt: "2026-10-28T12:00", track: 2, newAchievement: false, dxScore: 1800, dxScoreMax: 2000 }
      ]
    });
    expect(summary).toMatchObject({ dxScore: 4500, dxScoreMax: 5000, dxScoreCharts: 2 });
  });

  it("keeps older Passport payloads compatible and drops incomplete DX Score totals", () => {
    const profile = createPassport("PLAYER", "", [maimaiPassportSummary(maimai)]);
    expect(parsePassport(profile).games[0].dxScore).toBeUndefined();
    expect(parsePassport({
      ...profile,
      games: [{ ...profile.games[0], dxScore: 100, dxScoreMax: 200 }]
    }).games[0].dxScore).toBeUndefined();
  });

  it("round-trips Unicode through a URL-safe payload", () => {
    const profile = createPassport("玩家 ソリリウム", "四機種を遊びます", [maimaiPassportSummary(maimai)]);
    const encoded = encodePassport(profile);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodePassport(encoded)).toEqual(profile);
  });

  it("rejects profiles without visible game summaries", () => {
    expect(() => parsePassport({
      schema: "mai-score/passport/v1",
      publishedAt: "2026-10-28T12:00:00.000Z",
      profile: { displayName: "PLAYER" },
      games: []
    })).toThrow(/between one and five games/);
  });
});
