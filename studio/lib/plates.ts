import type { PlateProgress, StudioChartRecord, VersionChartTotals } from "./types";

/**
 * Which difficulties a version plate counts, and what each chart must reach.
 *
 * NOT VERIFIED AGAINST A LIVE ACCOUNT, but corroborated by reading a working
 * implementation: TrueRou/maimai.py, a library players use for exactly this.
 * Its `MaimaiPlates` drops Re:MASTER for every plate whose version is not the
 * classic aggregate 舞 or 霸 — so every DX version plate spans BASIC through
 * MASTER, which is what PLATE_DIFFICULTIES says. Its per-kind conditions read
 * `rate <= SSS`, `fc <= FC`, and `fc <= AP` against enums ordered best-first,
 * which is 将 / 極 / 神 exactly as written below.
 *
 * The one place we deliberately differ is 舞舞. That library tests
 * `fs <= FSD` against an FSType ordered weakest-first, so it would admit FS and
 * FS+ while rejecting FSD+ — the strongest lamp — which cannot be the rule.
 * 舞舞 wants FSD or better, and that is what isFullSyncDx implements.
 *
 * So the residual risk is narrow, not broad: a rule could still be wrong in a
 * way both this file and that library share. Treat the table as the thing to
 * fix first if a player reports a wrong "N remaining" — every rule lives here,
 * and correcting one is a data edit that needs no re-collection.
 *
 * `者` (clear, A or better) is absent because StudioData's PlateProgress kind
 * union covers only the four skill plates the Progress panel renders; adding it
 * would be one more entry here plus one more union member.
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

// The first two arcade releases share one 真 plate set. There is no 真将;
// 真極, 真神 and 真舞舞 cover maimai and maimai PLUS together.
const SHIN_VERSIONS = ["maimai", "maimai PLUS"] as const;

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
  versionTotals: readonly VersionChartTotals[] | undefined,
  difficulties: readonly PlateDifficulty[] = PLATE_DIFFICULTIES
): PlateProgress[] {
  if (!fullRecords?.length || !versionTotals?.length) return [];

  const played = new Map<string, StudioChartRecord[]>();
  for (const record of fullRecords) {
    if (!record.version || !countsAsPlateDifficulty(record.difficulty)) continue;
    const bucket = played.get(record.version);
    if (bucket) bucket.push(record); else played.set(record.version, [record]);
  }

  const totalsByVersion = new Map(versionTotals.map(totals => [totals.version, totals]));
  const scopes: Array<{
    label: string;
    totals: VersionChartTotals;
    records: StudioChartRecord[];
    excludedKinds?: ReadonlySet<PlateProgress["kind"]>;
  }> = [];
  const shinTotals = SHIN_VERSIONS.flatMap(version => {
    const totals = totalsByVersion.get(version);
    return totals ? [totals] : [];
  });
  // A partial catalog would understate the real 真 denominator, so do not
  // show this aggregate unless both constituent releases are present.
  if (shinTotals.length === SHIN_VERSIONS.length) {
    scopes.push({
      label: "真",
      totals: {
        version: "真",
        basic: shinTotals.reduce((sum, totals) => sum + totals.basic, 0),
        advanced: shinTotals.reduce((sum, totals) => sum + totals.advanced, 0),
        expert: shinTotals.reduce((sum, totals) => sum + totals.expert, 0),
        master: shinTotals.reduce((sum, totals) => sum + totals.master, 0),
        remaster: shinTotals.reduce((sum, totals) => sum + totals.remaster, 0)
      },
      records: SHIN_VERSIONS.flatMap(version => played.get(version) ?? []),
      excludedKinds: new Set(["shou"])
    });
  }
  for (const totals of versionTotals) {
    if ((SHIN_VERSIONS as readonly string[]).includes(totals.version)) continue;
    scopes.push({ label: totals.version, totals, records: played.get(totals.version) ?? [] });
  }

  const progress: PlateProgress[] = [];
  for (const scope of scopes) {
    if (!scope.records.length) continue;
    for (const rule of PLATE_RULES) {
      if (scope.excludedKinds?.has(rule.kind)) continue;
      const includedDifficulties = rule.difficulties.filter(difficulty => difficulties.includes(difficulty));
      const total = denominator(scope.totals, includedDifficulties);
      if (total === 0) continue;
      const completed = scope.records.filter(
        (record) => countsAsPlateDifficulty(record.difficulty)
          && includedDifficulties.includes(record.difficulty)
          && rule.satisfied(record)
      ).length;
      progress.push({ kind: rule.kind, version: scope.label, completed, total });
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
