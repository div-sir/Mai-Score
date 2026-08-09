import type { ChartDataMetadata, LanguageId, PlateProgress, StudioData, StudioRecord } from "./types";

export interface HistoryEntry {
  /** When the collection was taken. Doubles as the store key, so re-saving
   *  the same collection updates one entry instead of adding another. */
  generatedAt: string;
  savedAt: string;
  source: string;
  language: LanguageId;
  playerName: string;
  playerTitle?: string;
  playerTitleColor?: string;
  playerIconUrl?: string;
  playerFrameUrl?: string;
  playerPlateUrl?: string;
  officialRating: number;
  b15Rating?: number;
  b35Rating?: number;
  b50Rating: number;
  plateProgress?: PlateProgress[];
  chartData?: ChartDataMetadata;
  /** Optional and backward compatible: older Drive documents remain valid. */
  provenance?: {
    sourceSchema: string;
    observedAt: string;
    importedAt: string;
  };
  /** Kept without cover art: assets are data URLs worth megabytes, and a
   *  history is only useful if a long one still fits. */
  records: StudioRecord[];
  /** Optional DX NET near-miss lists captured with this B50 snapshot. */
  candidateRecords?: StudioRecord[];
}

export interface ChartChange {
  record: StudioRecord;
  previousAchievement: number;
  achievementDelta: number;
  ratingDelta: number;
}

export interface HistoryDiff {
  from: HistoryEntry;
  to: HistoryEntry;
  ratingDelta: number;
  officialRatingDelta: number;
  entered: StudioRecord[];
  left: StudioRecord[];
  changed: ChartChange[];
}

// StudioRecord carries no sheet id, so identity comes from the fields that
// together pick out one chart. JSON encoding avoids both title collisions and
// control characters that HTML option values normalize.
export const chartKey = (record: StudioRecord) =>
  JSON.stringify([record.title, record.type, record.difficulty]);

export function toHistoryEntry(
  data: StudioData,
  source: string,
  language: LanguageId,
  savedAt = new Date().toISOString()
): HistoryEntry {
  return {
    generatedAt: data.exportedAt,
    savedAt,
    source,
    language,
    playerName: data.player.name,
    playerTitle: data.player.title,
    playerTitleColor: data.player.titleColor,
    playerIconUrl: data.player.iconUrl,
    playerFrameUrl: data.player.frameUrl,
    playerPlateUrl: data.player.plateUrl,
    officialRating: data.player.rating,
    b15Rating: data.b15Rating,
    b35Rating: data.b35Rating,
    b50Rating: data.b50Rating,
    plateProgress: data.plateProgress?.map((plate) => ({ ...plate })),
    chartData: data.chartData ? { ...data.chartData } : undefined,
    provenance: {
      sourceSchema: data.schema,
      observedAt: data.exportedAt,
      importedAt: savedAt
    },
    records: data.records.map((record) => ({ ...record })),
    ...(data.candidateRecords?.length
      ? { candidateRecords: data.candidateRecords.map((record) => ({ ...record })) }
      : {})
  };
}

/**
 * Turns a compact history point back into a previewable B50 document.
 * Older sync files do not carry profile metadata or bucket subtotals, so
 * those values are optional and the score totals are rebuilt from records.
 */
export function fromHistoryEntry(entry: HistoryEntry): StudioData {
  const sumBucket = (bucket: StudioRecord["bucket"]) => entry.records.reduce(
    (total, record) => total + (record.bucket === bucket && Number.isFinite(record.chartRating)
      ? Number(record.chartRating)
      : 0),
    0
  );
  const b15Rating = sumBucket("b15");
  const b35Rating = sumBucket("b35");

  return {
    schema: "mai-score/v1",
    exportedAt: entry.generatedAt,
    player: {
      name: entry.playerName,
      title: entry.playerTitle ?? "",
      titleColor: entry.playerTitleColor,
      rating: entry.officialRating,
      iconUrl: entry.playerIconUrl,
      frameUrl: entry.playerFrameUrl,
      plateUrl: entry.playerPlateUrl
    },
    records: entry.records.map((record) => ({ ...record })),
    candidateRecords: entry.candidateRecords?.map((record) => ({ ...record })),
    b15Rating,
    b35Rating,
    b50Rating: b15Rating + b35Rating,
    plateProgress: entry.plateProgress?.map((plate) => ({ ...plate })),
    chartData: entry.chartData ? { ...entry.chartData } : undefined
  };
}

export function diffHistory(from: HistoryEntry, to: HistoryEntry): HistoryDiff {
  const before = new Map(from.records.map((record) => [chartKey(record), record]));
  const after = new Map(to.records.map((record) => [chartKey(record), record]));

  const entered = to.records.filter((record) => !before.has(chartKey(record)));
  const left = from.records.filter((record) => !after.has(chartKey(record)));

  const changed: ChartChange[] = [];
  for (const [key, record] of after) {
    const previous = before.get(key);
    if (!previous || previous.achievementRate === record.achievementRate) continue;
    changed.push({
      record,
      previousAchievement: previous.achievementRate,
      achievementDelta: record.achievementRate - previous.achievementRate,
      ratingDelta: (record.chartRating ?? 0) - (previous.chartRating ?? 0)
    });
  }
  changed.sort((a, b) => b.ratingDelta - a.ratingDelta || b.achievementDelta - a.achievementDelta);

  return {
    from,
    to,
    ratingDelta: to.b50Rating - from.b50Rating,
    officialRatingDelta: to.officialRating - from.officialRating,
    entered,
    left,
    changed
  };
}

/** Newest first — the order the history list is read in. */
export function sortHistory(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
