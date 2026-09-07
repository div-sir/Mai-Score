import type { SheetRecord } from "../../src/lib/types";
import type { StudioChartRecord } from "./types";

export interface CatalogRecord {
  sheet: SheetRecord;
  score?: StudioChartRecord;
  status: "matched" | "unobserved" | "ambiguous";
}

const identity = (title: string, type: string, difficulty: string) => JSON.stringify([title, type, difficulty]);

/** Absence of a score is not proof of an unplayed chart. Never fabricate zero scores. */
export function joinCatalogRecords(catalog: readonly SheetRecord[], scores: readonly StudioChartRecord[]): CatalogRecord[] {
  const byId = new Map<string, StudioChartRecord[]>();
  const byIdentity = new Map<string, StudioChartRecord[]>();
  const counts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  for (const sheet of catalog) {
    idCounts.set(sheet.sheetId, (idCounts.get(sheet.sheetId) ?? 0) + 1);
    const key = identity(sheet.title, sheet.type, sheet.difficulty);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const score of scores) {
    if (score.chartId) {
      const list = byId.get(score.chartId) ?? [];
      list.push(score);
      byId.set(score.chartId, list);
    } else {
      const key = identity(score.title, score.type, score.difficulty);
      const list = byIdentity.get(key) ?? [];
      list.push(score);
      byIdentity.set(key, list);
    }
  }
  return catalog.map(sheet => {
    if (idCounts.get(sheet.sheetId) !== 1) return { sheet, status: "ambiguous" };
    const key = identity(sheet.title, sheet.type, sheet.difficulty);
    const exact = byId.get(sheet.sheetId);
    const candidates = exact ?? byIdentity.get(key) ?? [];
    if (!candidates.length) return { sheet, status: "unobserved" };
    if (candidates.length !== 1 || (!exact && counts.get(key) !== 1)) return { sheet, status: "ambiguous" };
    const score = candidates[0];
    if (score.type !== sheet.type || score.difficulty !== sheet.difficulty) return { sheet, status: "ambiguous" };
    return { sheet, score, status: "matched" };
  });
}
