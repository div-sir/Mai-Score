import type { PlateProgress, StudioChartRecord, VersionChartTotals } from "./types";

/**
 * Which difficulties a version plate counts, and what each chart must reach.
 *
 * TRANSCRIBED FROM COMMUNITY SOURCES, NOT VERIFIED IN GAME. Two independent
 * write-ups agree that DX version plates span BASIC through MASTER and exclude
 * Re:MASTER, but no primary SEGA page states it in a form this repository could
 * quote, so treat the table as the thing to fix first if a player reports a
 * wrong "N remaining" — every rule lives here, and correcting one is a data
 * edit that needs no re-collection.
 *
 * `者` (clear) is deliberately absent: StudioData's PlateProgress kind union
 * covers only the four skill plates the Progress panel renders.
 */
export const PLATE_DIFFICULTIES = ["basic", "advanced", "expert", "master"] as const;

export type PlateDifficulty = typeof PLATE_DIFFICULTIES[number];

export interface PlateRule {
  kind: PlateProgress["kind"];
  difficulties: readonly PlateDifficulty[];
  /** True when this one chart satisfies the plate. */
  satisfied: (record: StudioChartRecord) => boolean;
}

const isFullCombo = (record: StudioChartRecord) =>
  record.comboFlag === "fc" || record.comboFlag === "fc+"
  || record.comboFlag === "ap" || record.comboFlag === "ap+";

const isAllPerfect = (record: StudioChartRecord) =>
  record.comboFlag === "ap" || record.comboFlag === "ap+";

// FDX is the DX-era name for what older charts call FSD; DX NET reports both
// spellings, so a plate that accepts one has to accept the other.
const isFullSyncDx = (record: StudioChartRecord) =>
  record.syncFlag === "fsd" || record.syncFlag === "fsd+"
  || record.syncFlag === "fdx" || record.syncFlag === "fdx+";

export const PLATE_RULES: readonly PlateRule[] = [
  { kind: "shou", difficulties: PLATE_DIFFICULTIES, satisfied: (record) => record.achievementRate >= 100 },
  { kind: "kiwami", difficulties: PLATE_DIFFICULTIES, satisfied: isFullCombo },
  { kind: "kami", difficulties: PLATE_DIFFICULTIES, satisfied: isAllPerfect },
  { kind: "maimai", difficulties: PLATE_DIFFICULTIES, satisfied: isFullSyncDx }
];

const countsAsPlateDifficulty = (difficulty: string): difficulty is PlateDifficulty =>
  (PLATE_DIFFICULTIES as readonly string[]).includes(difficulty);

function denominator(totals: VersionChartTotals, difficulties: readonly PlateDifficulty[]): number {
  return difficulties.reduce((sum, difficulty) => sum + (totals[difficulty] ?? 0), 0);
}

/**
 * Plate completion per version, computed from played charts against catalog
 * totals.
 *
 * The denominator has to come from `versionTotals` rather than from the
 * records: a plate asks how many of a version's charts are done, and charts
 * the player has never touched are exactly the ones missing from a collection.
 * Counting only played charts would show 100% to someone who has played four
 * songs. A version with no totals is therefore omitted entirely rather than
 * reported against a denominator that would flatter.
 */
export function buildPlateProgress(
  fullRecords: readonly StudioChartRecord[] | undefined,
  versionTotals: readonly VersionChartTotals[] | undefined
): PlateProgress[] {
  if (!fullRecords?.length || !versionTotals?.length) return [];

  const played = new Map<string, StudioChartRecord[]>();
  for (const record of fullRecords) {
    if (!record.version || !countsAsPlateDifficulty(record.difficulty)) continue;
    const bucket = played.get(record.version);
    if (bucket) bucket.push(record); else played.set(record.version, [record]);
  }

  const progress: PlateProgress[] = [];
  for (const totals of versionTotals) {
    const records = played.get(totals.version);
    if (!records?.length) continue;
    for (const rule of PLATE_RULES) {
      const total = denominator(totals, rule.difficulties);
      if (total === 0) continue;
      const completed = records.filter(
        (record) => countsAsPlateDifficulty(record.difficulty)
          && rule.difficulties.includes(record.difficulty)
          && rule.satisfied(record)
      ).length;
      progress.push({ kind: rule.kind, version: totals.version, completed, total });
    }
  }
  return progress;
}

export interface VersionPlateGroup {
  version: string;
  plates: PlateProgress[];
  /** Fewest charts still needed for any one plate of this version. */
  nearest: number;
}

/**
 * One row per version instead of one per plate, ordered by what the player can
 * realistically finish next.
 *
 * A collection that covers every version produces 27 versions × 4 plates, and
 * a flat list of 108 bars answers no question anyone asks. Sorting by the
 * closest plate puts "three charts from PRiSM 極" at the top, which is the
 * reason to open this panel at all. Ties fall back to the version name so the
 * order is stable between collections.
 */
export function groupPlatesByVersion(progress: readonly PlateProgress[]): VersionPlateGroup[] {
  const byVersion = new Map<string, PlateProgress[]>();
  for (const plate of progress) {
    const version = plate.version ?? "";
    const bucket = byVersion.get(version);
    if (bucket) bucket.push(plate); else byVersion.set(version, [plate]);
  }

  const order = new Map(PLATE_RULES.map((rule, index) => [rule.kind, index]));
  return [...byVersion.entries()]
    .map(([version, plates]) => ({
      version,
      plates: [...plates].sort((a, b) => (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0)),
      // A finished plate is not something still to chase, so it does not win
      // the top of the list; only outstanding work competes for attention.
      nearest: Math.min(...plates.map((plate) => plate.total - plate.completed).filter((left) => left > 0), Infinity)
    }))
    .sort((a, b) => a.nearest - b.nearest || a.version.localeCompare(b.version));
}
