import { konamiDataTables, parseKonamiNumber } from "./konami-analysis";
import type { KonamiPageSnapshot } from "./konami-page";

export type DdrPlayStyle = "SINGLE" | "DOUBLE";
export type DdrFlareCategory = "CLASSIC" | "WHITE" | "GOLD";

export interface DdrFlareChart {
  id: string;
  title: string;
  style: DdrPlayStyle;
  category?: DdrFlareCategory;
  difficulty?: string;
  level?: string;
  flareSkill: number;
  sourceUrl: string;
}

export interface DdrFlareCategorySummary {
  category: DdrFlareCategory;
  charts: DdrFlareChart[];
  counted: DdrFlareChart[];
  candidates: Array<DdrFlareChart & { needed: number }>;
  total: number;
  cutoff?: number;
}

export interface DdrFlareAnalysis {
  charts: DdrFlareChart[];
  styles: DdrPlayStyle[];
  unknownCategoryCount: number;
}

const categories: DdrFlareCategory[] = ["CLASSIC", "WHITE", "GOLD"];
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
const compact = (value: string) => normalized(value).replace(/[\s_・/()-]/g, "");

function column(headers: string[], patterns: RegExp[]): number | undefined {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(compact(header))));
  return index < 0 ? undefined : index;
}

function styleOf(value: string): DdrPlayStyle | undefined {
  const source = normalized(value);
  if (/\b(?:SP|SINGLE)\b|シングル/.test(source)) return "SINGLE";
  if (/\b(?:DP|DOUBLE)\b|ダブル/.test(source)) return "DOUBLE";
  return undefined;
}

function categoryOf(value: string): DdrFlareCategory | undefined {
  const source = normalized(value);
  return categories.find((category) => new RegExp(`\\b${category}\\b`).test(source));
}

function skillOf(value: string): number | undefined {
  const parsed = parseKonamiNumber(value);
  return parsed !== undefined && parsed >= 0 && Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * Reads only values the collected page states explicitly. In particular, it
 * never estimates Flare Skill from score, level, or gauge.
 */
export function analyzeDdrFlare(snapshot: KonamiPageSnapshot): DdrFlareAnalysis {
  if (snapshot.source.game !== "dance-dance-revolution") {
    return { charts: [], styles: [], unknownCategoryCount: 0 };
  }

  const found = konamiDataTables(snapshot).flatMap((table) => {
    const titleIndex = column(table.headers, [/^(?:曲名|楽曲名|タイトル|TITLE|MUSIC|SONG)$/]);
    const skillIndex = column(table.headers, [/(?:フレアスキル|FLARESKILL)/]);
    if (titleIndex === undefined || skillIndex === undefined) return [];
    const styleIndex = column(table.headers, [/(?:プレースタイル|スタイル|PLAYSTYLE|STYLE)/]);
    const categoryIndex = column(table.headers, [/(?:カテゴリ|カテゴリー|CATEGORY)/]);
    const difficultyIndex = column(table.headers, [/(?:難易度|DIFFICULTY|譜面)/]);
    const levelIndex = column(table.headers, [/^(?:LEVEL|LV|レベル)$/]);
    const context = `${table.pageTitle} ${table.title}`;
    const contextStyle = styleOf(context);
    const contextCategory = categoryOf(context);

    return table.rows.flatMap((row, rowIndex) => {
      const title = row[titleIndex]?.trim();
      const flareSkill = skillOf(row[skillIndex] ?? "");
      const style = styleIndex === undefined ? contextStyle : styleOf(row[styleIndex] ?? "") ?? contextStyle;
      if (!title || flareSkill === undefined || !style) return [];
      const category = categoryIndex === undefined
        ? contextCategory
        : categoryOf(row[categoryIndex] ?? "") ?? contextCategory;
      const difficulty = difficultyIndex === undefined ? undefined : row[difficultyIndex]?.trim() || undefined;
      const level = levelIndex === undefined ? undefined : row[levelIndex]?.trim() || undefined;
      return [{
        id: `${table.id}-${rowIndex}`,
        title,
        style,
        ...(category ? { category } : {}),
        ...(difficulty ? { difficulty } : {}),
        ...(level ? { level } : {}),
        flareSkill,
        sourceUrl: table.sourceUrl
      } satisfies DdrFlareChart];
    });
  });

  // The target page can repeat a chart in overview and detail tables. Keep the
  // strongest explicit value so it cannot occupy two Top-30 slots.
  const deduplicated = new Map<string, DdrFlareChart>();
  for (const chart of found) {
    const key = [normalized(chart.title), chart.style, chart.category ?? "", normalized(chart.difficulty ?? "")].join("\u0000");
    const previous = deduplicated.get(key);
    if (!previous || chart.flareSkill > previous.flareSkill) deduplicated.set(key, chart);
  }
  const charts = [...deduplicated.values()];
  return {
    charts,
    styles: (["SINGLE", "DOUBLE"] as const).filter((style) => charts.some((chart) => chart.style === style)),
    unknownCategoryCount: charts.filter((chart) => !chart.category).length
  };
}

export function ddrFlareForStyle(analysis: DdrFlareAnalysis, style: DdrPlayStyle): DdrFlareCategorySummary[] {
  return categories.map((category) => {
    const charts = analysis.charts
      .filter((chart) => chart.style === style && chart.category === category)
      .sort((left, right) => right.flareSkill - left.flareSkill || left.title.localeCompare(right.title));
    const counted = charts.slice(0, 30);
    const cutoff = counted.length === 30 ? counted[29].flareSkill : undefined;
    return {
      category,
      charts,
      counted,
      total: counted.reduce((sum, chart) => sum + chart.flareSkill, 0),
      ...(cutoff !== undefined ? { cutoff } : {}),
      candidates: cutoff === undefined ? [] : charts.slice(30, 40).map((chart) => ({
        ...chart,
        needed: Math.max(1, cutoff + 1 - chart.flareSkill)
      }))
    };
  });
}
