import { describe, expect, it } from "vitest";
import { buildLatestSession, buildPracticeList, buildWeaknessPrescriptions } from "../studio/lib/session";
import type { StudioData, StudioRecentPlay } from "../studio/lib/types";

const play = (title: string, playedAt: string, achievementRate: number, extra: Partial<StudioRecentPlay> = {}): StudioRecentPlay => ({
  title, playedAt, achievementRate, type: "dx", difficulty: "master", displayedLevel: "13+",
  track: 1, newAchievement: false, ...extra
});

const data = (recentPlays: StudioRecentPlay[]): StudioData => ({
  schema: "mai-score/v1", exportedAt: "2026-09-18T21:00:00Z",
  player: { name: "PLAYER", title: "", rating: 15000 },
  records: Array.from({ length: 50 }, (_, index) => ({
    title: `B50 ${index}`, type: "dx" as const, difficulty: "master" as const,
    displayedLevel: "13+", achievementRate: 100.5, chartRating: 300,
    bucket: index < 15 ? "b15" as const : "b35" as const
  })),
  fullRecords: [
    play("Precision", "2026-09-18T20:00", 100.2),
    play("Accuracy", "2026-09-18T20:00", 98.8),
    play("Combo", "2026-09-18T20:00", 99.8)
  ],
  recentPlays, b15Rating: 4500, b35Rating: 10500, b50Rating: 15000
});

describe("play sessions", () => {
  it("groups the latest visit by adjacent play gaps", () => {
    const session = buildLatestSession([
      play("Newest", "2026-09-18T20:30", 100.1, { newAchievement: true }),
      play("Repeat", "2026-09-18T20:10", 99.5),
      play("Repeat", "2026-09-18T20:00", 99.4),
      play("Old visit", "2026-09-18T14:00", 100)
    ]);
    expect(session).toMatchObject({
      startedAt: "2026-09-18T20:00", endedAt: "2026-09-18T20:30",
      uniqueCharts: 2, personalBests: 1, repeatedCharts: 1
    });
    expect(session?.plays).toHaveLength(3);
  });

  it("turns best scores and stalled repeats into prioritized prescriptions", () => {
    const recent = [
      play("Accuracy", "2026-09-18T20:10", 98.7),
      play("Accuracy", "2026-09-18T20:00", 98.6)
    ];
    const source = data(recent);
    const prescriptions = buildWeaknessPrescriptions(source, buildLatestSession(recent));
    expect(prescriptions.map((item) => item.kind)).toContain("consistency");
    expect(prescriptions.map((item) => item.kind)).toContain("combo");
    expect(buildPracticeList(prescriptions).map((item) => item.record.title)).toContain("Accuracy");
  });
});
