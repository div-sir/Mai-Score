import type { RhythmGameId, RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import { konamiDataTables, parseKonamiNumber } from "./konami-analysis";
import type { KonamiPageSnapshot } from "./konami-page";

export interface InsightScore {
  id: string;
  title: string;
  difficulty?: string;
  level?: number;
  score: number;
  grade?: string;
  clear?: string;
  style?: string;
  ratingMilli?: number;
}

export interface LevelInsight {
  level: string;
  count: number;
  average: number;
  best: number;
  clearRate?: number;
}

export interface IidxLevelSummary {
  style: string;
  level: string;
  count: number;
  aaa: number;
  hardOrBetter: number;
  cleared: number;
  failed: number;
}

export interface SdvxVolforceEntry extends InsightScore {
  vfMilli: number;
  counted: boolean;
}

export interface SdvxPotential extends SdvxVolforceEntry {
  targetScore: number;
  projectedMilli: number;
  gainMilli: number;
}

type KonamiTable = ReturnType<typeof konamiDataTables>[number];
const IIDX_WIDE_SCORE_HEADER = /^(SP|DP)(BEGINNER|NORMAL|HYPER|ANOTHER|LEGGENDARIA)(?:EX)?(?:SCORE|スコア)$/;

const clean = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const compact = (value: string) => clean(value).toUpperCase().replace(/[\s_・/()\-.．]/g, "");

function column(headers: string[], patterns: RegExp[]): number | undefined {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(compact(header))));
  return index < 0 ? undefined : index;
}

function numericLevel(value?: string): number | undefined {
  if (!value) return undefined;
  const matched = clean(value).match(/\d+(?:\.\d+)?/);
  const parsed = matched ? Number(matched[0]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function iidxWideScores(table: KonamiTable, titleIndex: number): InsightScore[] {
  const scoreColumns = table.headers.flatMap((header, index) => {
    const match = compact(header).match(IIDX_WIDE_SCORE_HEADER);
    return match ? [{ index, style: match[1], difficulty: match[2], prefix: `${match[1]}${match[2]}` }] : [];
  });
  const sibling = (prefix: string, patterns: RegExp[]) => table.headers.findIndex((header) => {
    const normalized = compact(header);
    return normalized.startsWith(prefix) && patterns.some((pattern) => pattern.test(normalized.slice(prefix.length)));
  });
  return table.rows.flatMap((row, rowIndex) => scoreColumns.flatMap((scoreColumn) => {
    const title = clean(row[titleIndex] ?? "");
    const score = parseKonamiNumber(row[scoreColumn.index] ?? "");
    if (!title || score === undefined || score <= 0) return [];
    const levelIndex = sibling(scoreColumn.prefix, [/^(?:LEVEL|LV|レベル)$/]);
    const gradeIndex = sibling(scoreColumn.prefix, [/^(?:DJLEVEL|DJレベル|GRADE|ランク)$/]);
    const clearIndex = sibling(scoreColumn.prefix, [/^(?:CLEAR|CLEARTYPE|クリア|クリアタイプ|クリアランプ)$/]);
    return [{
      id: `${table.id}-${rowIndex}-${scoreColumn.style}-${scoreColumn.difficulty}`,
      title,
      difficulty: scoreColumn.difficulty,
      style: scoreColumn.style,
      ...(levelIndex < 0 ? {} : { level: numericLevel(row[levelIndex]) }),
      score,
      ...(gradeIndex < 0 || !row[gradeIndex] ? {} : { grade: clean(row[gradeIndex]) }),
      ...(clearIndex < 0 || !row[clearIndex] ? {} : { clear: clean(row[clearIndex]) })
    } satisfies InsightScore];
  }));
}

export function scoresFromRhythmRecord(data: RhythmRecordEnvelope): InsightScore[] {
  return data.records.flatMap((record) => {
    const score = record.result.rawScore;
    if (score === undefined || !Number.isFinite(score)) return [];
    const rating = record.result.rating;
    const isVf = rating?.system.toLowerCase().includes("volforce") || rating?.system.toLowerCase() === "vf";
    const comboFlag = ["fullComboType", "comboFlag", "comboStatus"].map((key) => record.gameSpecific?.[key])
      .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
    return [{
      id: record.chart.id || record.recordId,
      title: record.song.title,
      difficulty: record.chart.difficulty,
      level: record.chart.levelValue ?? numericLevel(record.chart.level),
      score,
      grade: record.result.grade,
      clear: record.result.clearStatus ?? comboFlag,
      style: record.chart.type,
      ...(isVf && rating ? { ratingMilli: rating.value < 10 ? Math.floor(rating.value * 1000) : Math.floor(rating.value) } : {})
    }];
  });
}

export function scoresFromKonamiPages(data: KonamiPageSnapshot): InsightScore[] {
  const records = konamiDataTables(data).flatMap((table) => {
    const titleIndex = column(table.headers, [/^(?:曲名|楽曲名|タイトル|TITLE|MUSIC|SONG)$/]);
    if (titleIndex === undefined) return [];
    const scoreIndex = column(table.headers, [/^(?:EXスコア|スコア|分數|分数|得点|EXSCORE|SCORE|BESTSCORE|ハイスコア)$/]);
    if (scoreIndex === undefined) return data.source.game === "beatmania-iidx" ? iidxWideScores(table, titleIndex) : [];
    const difficultyIndex = column(table.headers, [/(?:難易度|DIFFICULTY|譜面)/]);
    const levelIndex = column(table.headers, [/^(?:LEVEL|LV|レベル)$/]);
    const gradeIndex = column(table.headers, [/(?:クリアランク|成績|等級|GRADE|RANK)/]);
    const clearIndex = column(table.headers, [/(?:クリアタイプ|CLEARSTATUS|CLEAR|LAMP)/]);
    const comboIndex = column(table.headers, [/(?:フルコンボ|FULLCOMBO|COMBOTYPE|FCタイプ)/]);
    const styleIndex = column(table.headers, [/(?:プレースタイル|PLAYSTYLE|STYLE)/]);
    const vfIndex = column(table.headers, [/(?:VOLFORCE|VF値|VFPOINT|単曲VF)/]);
    return table.rows.flatMap((row, rowIndex) => {
      const title = clean(row[titleIndex] ?? "");
      const score = parseKonamiNumber(row[scoreIndex] ?? "");
      if (!title || score === undefined) return [];
      const vf = vfIndex === undefined ? undefined : parseKonamiNumber(row[vfIndex] ?? "");
      return [{
        id: `${table.id}-${rowIndex}`,
        title,
        ...(difficultyIndex === undefined || !row[difficultyIndex] ? {} : { difficulty: clean(row[difficultyIndex]) }),
        ...(levelIndex === undefined ? {} : { level: numericLevel(row[levelIndex]) }),
        score,
        ...(gradeIndex === undefined || !row[gradeIndex] ? {} : { grade: clean(row[gradeIndex]) }),
        ...((clearIndex === undefined || !row[clearIndex]) && (comboIndex === undefined || !row[comboIndex])
          ? {} : { clear: clean(row[clearIndex ?? comboIndex!] || row[comboIndex!] || "") }),
        ...(styleIndex === undefined || !row[styleIndex] ? {} : { style: clean(row[styleIndex]) }),
        ...(vf === undefined ? {} : { ratingMilli: vf < 10 ? Math.floor(vf * 1000) : Math.floor(vf) })
      } satisfies InsightScore];
    });
  });

  const best = new Map<string, InsightScore>();
  for (const record of records) {
    const key = [compact(record.title), compact(record.difficulty ?? ""), compact(record.style ?? "")].join("\u0000");
    const previous = best.get(key);
    if (!previous || record.score > previous.score) best.set(key, record);
  }
  return [...best.values()];
}

export function rhythmRecordFromKonamiPages(data: KonamiPageSnapshot): RhythmRecordEnvelope {
  return {
    schema: "mai-score/rhythm-record/v1",
    generatedAt: data.generatedAt,
    source: { game: data.source.game, connectionId: data.source.connectionId, region: data.source.region, url: data.source.startUrl },
    records: scoresFromKonamiPages(data).map((record) => {
      const chartId = [record.title, record.difficulty ?? "", record.style ?? ""].join("\u0000");
      return {
        recordId: record.id,
        song: { id: record.title, title: record.title },
        chart: {
          id: chartId,
          ...(record.style ? { type: record.style } : {}),
          difficulty: record.difficulty ?? "UNKNOWN",
          ...(record.level === undefined ? {} : { level: String(record.level), levelValue: record.level })
        },
        result: {
          rawScore: record.score,
          ...(record.grade ? { grade: record.grade } : {}),
          ...(record.clear ? { clearStatus: record.clear } : {}),
          ...(record.ratingMilli === undefined ? {} : { rating: { value: record.ratingMilli, system: "volforce-milli" } })
        },
        ...(record.style ? { gameSpecific: { style: record.style } } : {})
      };
    })
  };
}

const failed = (value?: string) => Boolean(value && /FAILED|FAIL|CRASH|TRACK CRASH|落ち/i.test(value));

export function levelInsights(records: readonly InsightScore[]): LevelInsight[] {
  const groups = new Map<string, InsightScore[]>();
  for (const record of records) {
    if (record.level === undefined) continue;
    const label = Number.isInteger(record.level) ? String(record.level) : record.level.toFixed(1);
    groups.set(label, [...(groups.get(label) ?? []), record]);
  }
  return [...groups].map(([level, entries]) => ({
    level,
    count: entries.length,
    average: Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length),
    best: Math.max(...entries.map((entry) => entry.score)),
    ...(entries.some((entry) => entry.clear) ? { clearRate: entries.filter((entry) => !failed(entry.clear)).length / entries.length } : {})
  })).sort((left, right) => Number(left.level) - Number(right.level));
}

export function distribution(records: readonly InsightScore[], key: "grade" | "clear"): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = clean(record[key] ?? "") || "—";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

const iidxLampRank = (clear?: string): number => {
  const value = compact(clear ?? "");
  if (/FULLCOMBO|FC/.test(value)) return 7;
  if (/EXHARD/.test(value)) return 6;
  if (/HARD/.test(value)) return 5;
  if (/^CLEAR$/.test(value)) return 4;
  if (/EASYCLEAR/.test(value)) return 3;
  if (/ASSISTCLEAR/.test(value)) return 2;
  if (/FAILED|FAIL/.test(value)) return 1;
  return 0;
};

export function iidxLevelSummaries(records: readonly InsightScore[], style?: string): IidxLevelSummary[] {
  const groups = new Map<string, InsightScore[]>();
  for (const record of records) {
    const recordStyle = clean(record.style ?? "—").toUpperCase();
    if (style && recordStyle !== style) continue;
    if (record.level === undefined) continue;
    const level = Number.isInteger(record.level) ? String(record.level) : record.level.toFixed(1);
    const key = `${recordStyle}\u0000${level}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  return [...groups].map(([key, entries]) => {
    const [recordStyle, level] = key.split("\u0000");
    return {
      style: recordStyle,
      level,
      count: entries.length,
      aaa: entries.filter((entry) => compact(entry.grade ?? "") === "AAA").length,
      hardOrBetter: entries.filter((entry) => iidxLampRank(entry.clear) >= 5).length,
      cleared: entries.filter((entry) => iidxLampRank(entry.clear) >= 3).length,
      failed: entries.filter((entry) => iidxLampRank(entry.clear) === 1).length
    };
  }).sort((left, right) => left.style.localeCompare(right.style) || Number(right.level) - Number(left.level));
}

export function iidxReviewCandidates(records: readonly InsightScore[], options: { style?: string; level?: string; limit?: number } = {}) {
  return records.filter((record) => {
    const style = clean(record.style ?? "—").toUpperCase();
    const level = record.level === undefined ? "" : Number.isInteger(record.level) ? String(record.level) : record.level.toFixed(1);
    return (!options.style || style === options.style)
      && (!options.level || level === options.level)
      && iidxLampRank(record.clear) < 7;
  }).map((record) => ({ ...record, lampRank: iidxLampRank(record.clear) }))
    .sort((left, right) => (right.level ?? 0) - (left.level ?? 0) || left.lampRank - right.lampRank || right.score - left.score)
    .slice(0, options.limit ?? 12);
}

export function targetScoreCandidates(records: readonly InsightScore[], target: number, limit = 10): Array<InsightScore & { gap: number }> {
  return records.filter((record) => record.score < target)
    .map((record) => ({ ...record, gap: target - record.score }))
    .sort((left, right) => left.gap - right.gap || right.score - left.score)
    .slice(0, limit);
}

const gradeFactors = [
  { minimum: 9_900_000, factor: 1.05 }, { minimum: 9_800_000, factor: 1.02 },
  { minimum: 9_700_000, factor: 1.00 }, { minimum: 9_500_000, factor: 0.97 },
  { minimum: 9_300_000, factor: 0.94 }, { minimum: 9_000_000, factor: 0.91 },
  { minimum: 8_700_000, factor: 0.88 }, { minimum: 7_500_000, factor: 0.85 },
  { minimum: 6_500_000, factor: 0.82 }, { minimum: 0, factor: 0.80 }
] as const;

function clearFactor(clear?: string): number | undefined {
  if (!clear) return undefined;
  const value = compact(clear);
  if (/PUC|PERFECTULTIMATECHAIN/.test(value)) return 1.10;
  if (/UC|ULTIMATECHAIN/.test(value)) return 1.06;
  if (/MAXXIVE/.test(value)) return 1.04;
  if (/EXCESSIVE|HARD/.test(value)) return 1.02;
  if (/EFFECTIVE|CLEAR|COMPLETE/.test(value)) return 1.00;
  if (/CRASH|FAILED|FAIL/.test(value)) return 0.50;
  return undefined;
}

export function sdvxVfMilli(record: InsightScore, score = record.score): number | undefined {
  if (score === record.score && record.ratingMilli !== undefined) return record.ratingMilli;
  const clear = clearFactor(record.clear);
  if (record.level === undefined || clear === undefined || score < 0 || score > 10_000_000) return undefined;
  const grade = gradeFactors.find((entry) => score >= entry.minimum)?.factor;
  if (grade === undefined) return undefined;
  return Math.floor(record.level * (score / 10_000_000) * grade * clear * 20);
}

export function sdvxVolforce(records: readonly InsightScore[]) {
  const entries: SdvxVolforceEntry[] = records.flatMap((record) => {
    const vfMilli = sdvxVfMilli(record);
    return vfMilli === undefined ? [] : [{ ...record, vfMilli, counted: false } satisfies SdvxVolforceEntry];
  }).sort((left, right) => right.vfMilli - left.vfMilli || right.score - left.score);
  const countedIds = new Set(entries.slice(0, 50).map((entry) => entry.id));
  entries.forEach((entry) => { entry.counted = countedIds.has(entry.id); });
  const counted = entries.filter((entry) => entry.counted);
  const cutoff = counted.length === 50 ? counted[49].vfMilli : 0;
  const targets = [9_500_000, 9_700_000, 9_800_000, 9_900_000, 10_000_000];
  const potential = entries.flatMap((entry) => {
    const targetScore = targets.find((target) => target > entry.score && (sdvxVfMilli(entry, target) ?? 0) > (entry.counted ? entry.vfMilli : cutoff));
    if (!targetScore) return [];
    const projectedMilli = sdvxVfMilli(entry, targetScore)!;
    const gainMilli = projectedMilli - (entry.counted ? entry.vfMilli : cutoff);
    return [{ ...entry, targetScore, projectedMilli, gainMilli } satisfies SdvxPotential];
  }).sort((left, right) => right.gainMilli - left.gainMilli || left.targetScore - right.targetScore);
  return {
    entries,
    counted,
    total: counted.reduce((sum, entry) => sum + entry.vfMilli, 0) / 1000,
    cutoff,
    potential
  };
}

export const scoreTargetPresets = (game: RhythmGameId): number[] => game === "sound-voltex"
  ? [9_500_000, 9_700_000, 9_800_000, 9_900_000]
  : game === "dance-dance-revolution" ? [800_000, 900_000, 950_000, 990_000] : [800_000, 900_000, 950_000];
