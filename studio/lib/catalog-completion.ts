import type { CatalogRecord } from "./catalog-records";

export type CompletionGoal = "sss" | "sssPlus" | "fc" | "ap";
export interface CompletionGap {
  chart: CatalogRecord;
  reason: "below-target" | "unobserved" | "ambiguous";
}

/** Call only with actual eligible catalog members, not aggregate version totals.
 * Unknown observations stay unknown: they are never labelled unplayed or failed.
 */
export function catalogCompletion(eligible: readonly CatalogRecord[], goal: CompletionGoal) {
  const seen = new Set<string>();
  let completed = 0;
  let unknown = 0;
  const gaps: CompletionGap[] = [];
  for (const chart of eligible) {
    if (!chart.sheet.sheetId || seen.has(chart.sheet.sheetId)) throw new Error("Eligible catalog must have unique chart IDs");
    seen.add(chart.sheet.sheetId);
    const score = chart.score;
    if (chart.status !== "matched" || !score || !Number.isFinite(score.achievementRate) || score.achievementRate < 0 || score.achievementRate > 101) {
      unknown++;
      gaps.push({ chart, reason: chart.status === "unobserved" ? "unobserved" : "ambiguous" });
      continue;
    }
    const achieved = goal === "sss" ? score.achievementRate >= 100
      : goal === "sssPlus" ? score.achievementRate >= 100.5
      : goal === "fc" ? ["fc", "fc+", "ap", "ap+"].includes(score.comboFlag ?? "")
      : ["ap", "ap+"].includes(score.comboFlag ?? "");
    if (achieved) completed++;
    else gaps.push({ chart, reason: "below-target" });
  }
  return { total: eligible.length, completed, unknown, belowTarget: eligible.length - completed - unknown, gaps };
}
