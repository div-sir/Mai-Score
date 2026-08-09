export type LayoutId = "classic" | "compact" | "landscape";
export type ThemeId = "night" | "light" | "maimai";
export type TimestampMode = "off" | "date" | "datetime";
export type LanguageId = "en" | "zh-Hant" | "ja";
/** How far the accent colour reaches beyond its own dedicated elements. */
export type AccentScope = "minimal" | "outline" | "full";
/** Which chart difficulty figure the card metadata line carries. */
export type ChartValueMode = "none" | "level" | "constant" | "both";

export interface StudioOptions {
  layout: LayoutId;
  theme: ThemeId;
  accent: string;
  accentScope: AccentScope;
  watermark: string;
  timestamp: TimestampMode;
  showFrame: boolean;
  showIcon: boolean;
  showPlate: boolean;
  showPlayerTitle: boolean;
  showCovers: boolean;
  showBreakdown: boolean;
  showAchievement: boolean;
  showChartRating: boolean;
  showAchievementRank: boolean;
  showComboBadge: boolean;
  showSyncBadge: boolean;
  chartValue: ChartValueMode;
  showRank: boolean;
}

export interface StudioRecord {
  title: string;
  type: "std" | "dx";
  difficulty: "basic" | "advanced" | "expert" | "master" | "remaster";
  displayedLevel: string;
  achievementRate: number;
  bucket: "b15" | "b35";
  internalLevelValue?: number;
  chartRating?: number;
  imageName?: string;
  comboFlag?: "fc" | "fc+" | "ap" | "ap+";
  syncFlag?: "fs" | "fs+" | "fsd" | "fsd+";
}

export interface PlateProgress {
  kind: "kiwami" | "shou" | "kami" | "maimai";
  version?: string;
  completed: number;
  total: number;
}

export interface ChartDataMetadata {
  source: string;
  updateTime: string;
  sha256: string;
  sheets: number;
}

export interface StudioData {
  schema: string;
  exportedAt: string;
  source?: string;
  chartData?: ChartDataMetadata;
  player: {
    name: string;
    title: string;
    /** DX NET's trophy rarity class (normal / bronze / silver / gold / rainbow). */
    titleColor?: string;
    rating: number;
    iconUrl?: string;
    frameUrl?: string;
    plateUrl?: string;
  };
  records: StudioRecord[];
  /** Resolved charts from DX NET's candidate sections, outside the current B50. */
  candidateRecords?: StudioRecord[];
  b15Rating: number;
  b35Rating: number;
  b50Rating: number;
  plateProgress?: PlateProgress[];
}

export interface StudioAssets {
  icon?: string;
  frame?: string;
  plate?: string;
  covers: Record<string, string>;
  badges?: Record<string, string>;
}

export const DEFAULT_OPTIONS: StudioOptions = {
  layout: "classic",
  theme: "night",
  accent: "#b89b72",
  accentScope: "outline",
  watermark: "",
  timestamp: "datetime",
  showFrame: true,
  showIcon: true,
  showPlate: true,
  showPlayerTitle: true,
  showCovers: true,
  showBreakdown: true,
  showAchievement: true,
  showChartRating: true,
  showAchievementRank: true,
  showComboBadge: true,
  showSyncBadge: true,
  chartValue: "level",
  showRank: true
};

const layouts = new Set<LayoutId>(["classic", "compact", "landscape"]);
const themes = new Set<ThemeId>(["night", "light", "maimai"]);
const timestamps = new Set<TimestampMode>(["off", "date", "datetime"]);
const accentScopes = new Set<AccentScope>(["minimal", "outline", "full"]);
const chartValues = new Set<ChartValueMode>(["none", "level", "constant", "both"]);

export const LANGUAGES: readonly LanguageId[] = ["en", "zh-Hant", "ja"];

export function normalizeLanguage(value: unknown): LanguageId {
  return LANGUAGES.includes(value as LanguageId) ? value as LanguageId : "en";
}

/**
 * `chartValue` replaced the independent `showLevel` / `showConstant` booleans,
 * which could both be on and rendered a redundant `13+ · CONST 13.9`. Styles
 * saved before the change — in localStorage, a shared preset link, or a synced
 * settings document — still carry the pair, so read them instead of silently
 * resetting to the default.
 */
function chartValueFromLegacy(source: { showLevel?: unknown; showConstant?: unknown }): ChartValueMode | undefined {
  const level = source.showLevel;
  const constant = source.showConstant;
  if (typeof level !== "boolean" && typeof constant !== "boolean") return undefined;
  if (level !== false && constant === true) return "both";
  if (constant === true) return "constant";
  return level === false ? "none" : "level";
}

/** Fills in anything a stored or shared style is missing, and drops the rest. */
export function normalizeStudioOptions(value: unknown): StudioOptions {
  if (!value || typeof value !== "object") return { ...DEFAULT_OPTIONS };
  const source = value as Partial<StudioOptions> & {
    showLevel?: unknown;
    showConstant?: unknown;
    showTrophy?: unknown;
    showScoreBadges?: unknown;
  };
  const boolean = <K extends keyof StudioOptions>(key: K) =>
    typeof source[key] === "boolean" ? source[key] as boolean : DEFAULT_OPTIONS[key] as boolean;
  const legacyScoreBadges = typeof source.showScoreBadges === "boolean" ? source.showScoreBadges : undefined;
  const badgeBoolean = (key: "showAchievementRank" | "showComboBadge" | "showSyncBadge") =>
    typeof source[key] === "boolean" ? source[key] : legacyScoreBadges ?? DEFAULT_OPTIONS[key];
  return {
    layout: layouts.has(source.layout as LayoutId) ? source.layout as LayoutId : DEFAULT_OPTIONS.layout,
    theme: themes.has(source.theme as ThemeId) ? source.theme as ThemeId : DEFAULT_OPTIONS.theme,
    accent: /^#[0-9a-f]{6}$/i.test(String(source.accent ?? "")) ? String(source.accent) : DEFAULT_OPTIONS.accent,
    accentScope: accentScopes.has(source.accentScope as AccentScope)
      ? source.accentScope as AccentScope
      : DEFAULT_OPTIONS.accentScope,
    watermark: typeof source.watermark === "string" ? source.watermark.slice(0, 48) : "",
    timestamp: timestamps.has(source.timestamp as TimestampMode)
      ? source.timestamp as TimestampMode
      : DEFAULT_OPTIONS.timestamp,
    showFrame: boolean("showFrame"),
    showIcon: boolean("showIcon"),
    showPlate: boolean("showPlate"),
    showPlayerTitle: typeof source.showPlayerTitle === "boolean"
      ? source.showPlayerTitle
      : typeof source.showTrophy === "boolean" ? source.showTrophy : DEFAULT_OPTIONS.showPlayerTitle,
    showCovers: boolean("showCovers"),
    showBreakdown: boolean("showBreakdown"),
    showAchievement: boolean("showAchievement"),
    showChartRating: boolean("showChartRating"),
    showAchievementRank: badgeBoolean("showAchievementRank"),
    showComboBadge: badgeBoolean("showComboBadge"),
    showSyncBadge: badgeBoolean("showSyncBadge"),
    chartValue: chartValues.has(source.chartValue as ChartValueMode)
      ? source.chartValue as ChartValueMode
      : chartValueFromLegacy(source) ?? DEFAULT_OPTIONS.chartValue,
    showRank: boolean("showRank")
  };
}
