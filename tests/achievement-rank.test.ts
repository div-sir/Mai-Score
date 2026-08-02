import { describe, expect, it } from "vitest";
import {
  achievementRank as extensionAchievementRank,
  officialMusicIconName as extensionOfficialMusicIconName,
  recordBadgeNames as extensionRecordBadgeNames
} from "../src/lib/achievement-rank";
import {
  achievementRank as studioAchievementRank,
  officialMusicIconName as studioOfficialMusicIconName,
  recordBadgeNames as studioRecordBadgeNames
} from "../studio/lib/achievement-rank";

describe("official maimai score badges", () => {
  it.each([
    [0, "d"], [50, "c"], [60, "b"], [70, "bb"], [75, "bbb"],
    [80, "a"], [90, "aa"], [94, "aaa"], [97, "s"], [98, "s+"],
    [99, "ss"], [99.5, "ss+"], [100, "sss"], [100.5, "sss+"]
  ] as const)("maps %s%% to %s", (rate, rank) => {
    expect(extensionAchievementRank(rate)).toBe(rank);
    expect(studioAchievementRank(rate)).toBe(rank);
  });

  it("uses the official DX NET icon filenames", () => {
    expect(extensionOfficialMusicIconName("SSS+")).toBe("music_icon_sssp.png");
    expect(studioOfficialMusicIconName("AP+")).toBe("music_icon_app.png");
    expect(extensionRecordBadgeNames({ achievementRate: 100.5, comboFlag: "ap+", syncFlag: "fsd+" }))
      .toEqual(["music_icon_sssp.png", "music_icon_app.png", "music_icon_fsdp.png"]);
    expect(studioRecordBadgeNames({ achievementRate: 100.5, comboFlag: "ap+", syncFlag: "fsd+" }))
      .toEqual(["music_icon_sssp.png", "music_icon_app.png", "music_icon_fsdp.png"]);
  });
});
