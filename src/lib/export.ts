import type { CollectionResult } from "./types";

export function toDxratingJson(result: CollectionResult): string {
  return JSON.stringify(
    result.records.filter((x) => x.sheetId).map((x) => ({
      sheetId: x.sheetId,
      achievementRate: x.achievementRate
    })),
    null,
    2
  );
}

export function toFullJson(result: CollectionResult): string {
  return JSON.stringify(result, null, 2);
}
