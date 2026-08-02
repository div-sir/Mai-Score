export type AchievementRank =
  | "d" | "c" | "b" | "bb" | "bbb" | "a" | "aa" | "aaa"
  | "s" | "s+" | "ss" | "ss+" | "sss" | "sss+";

const RANKS: ReadonlyArray<readonly [number, AchievementRank]> = [
  [0, "d"], [50, "c"], [60, "b"], [70, "bb"], [75, "bbb"],
  [80, "a"], [90, "aa"], [94, "aaa"], [97, "s"], [98, "s+"],
  [99, "ss"], [99.5, "ss+"], [100, "sss"], [100.5, "sss+"]
];

export function achievementRank(rate: number): AchievementRank {
  let rank: AchievementRank = "d";
  for (const [threshold, candidate] of RANKS) {
    if (rate < threshold) break;
    rank = candidate;
  }
  return rank;
}

export const officialMusicIconName = (value: string): string =>
  `music_icon_${value.toLowerCase().replaceAll("+", "p")}.png`;

export function recordBadgeNameSet(record: {
  achievementRate: number;
  comboFlag?: string;
  syncFlag?: string;
}): { rank: string; combo?: string; sync?: string } {
  return {
    rank: officialMusicIconName(achievementRank(record.achievementRate)),
    combo: record.comboFlag ? officialMusicIconName(record.comboFlag) : undefined,
    sync: record.syncFlag ? officialMusicIconName(record.syncFlag) : undefined
  };
}

export function recordBadgeNames(record: {
  achievementRate: number;
  comboFlag?: string;
  syncFlag?: string;
}): string[] {
  const badges = recordBadgeNameSet(record);
  return [badges.rank, badges.combo, badges.sync]
    .filter((value): value is string => Boolean(value));
}
