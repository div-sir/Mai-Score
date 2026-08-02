export type ImageLayout = "classic" | "compact" | "landscape";
export type ImageTheme = "night" | "light" | "maimai";
export type TimestampMode = "off" | "date" | "datetime";
export type ImageScale = 1 | 1.5;
/** How far the accent colour reaches beyond its own dedicated elements. */
export type AccentScope = "minimal" | "outline" | "full";
/** Which chart difficulty figure the card metadata line carries. */
export type ChartValueMode = "none" | "level" | "constant" | "both";

export interface ImageOptions {
  version: 1;
  layout: ImageLayout;
  theme: ImageTheme;
  accentColor: string;
  accentScope: AccentScope;
  watermark: string;
  timestampMode: TimestampMode;
  scale: ImageScale;
  timestampFilename: boolean;
  showFrame: boolean;
  showIcon: boolean;
  showPlate: boolean;
  showCovers: boolean;
  showPlayerTitle: boolean;
  showRatingBreakdown: boolean;
  showAchievement: boolean;
  showChartRating: boolean;
  showAchievementRank: boolean;
  showComboBadge: boolean;
  showSyncBadge: boolean;
  chartValue: ChartValueMode;
  showBucketRank: boolean;
  showGeneratedBy: boolean;
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  version: 1,
  layout: "classic",
  theme: "night",
  accentColor: "#b89b72",
  accentScope: "outline",
  watermark: "",
  timestampMode: "datetime",
  scale: 1,
  timestampFilename: true,
  showFrame: true,
  showIcon: true,
  showPlate: true,
  showCovers: true,
  showPlayerTitle: true,
  showRatingBreakdown: true,
  showAchievement: true,
  showChartRating: true,
  showAchievementRank: true,
  showComboBadge: true,
  showSyncBadge: true,
  chartValue: "level",
  showBucketRank: true,
  showGeneratedBy: true
};

const layouts = new Set<ImageLayout>(["classic", "compact", "landscape"]);
const themes = new Set<ImageTheme>(["night", "light", "maimai"]);
const timestampModes = new Set<TimestampMode>(["off", "date", "datetime"]);
const accentScopes = new Set<AccentScope>(["minimal", "outline", "full"]);
const chartValues = new Set<ChartValueMode>(["none", "level", "constant", "both"]);

/**
 * `chartValue` replaced the independent `showLevel` / `showInternalLevel`
 * booleans, which could both be on and rendered a redundant `13+ · CONST 13.9`.
 * Presets saved before the change still carry the pair, so read them rather
 * than silently resetting someone's saved style to the default.
 */
export function chartValueFromLegacy(source: {
  showLevel?: unknown;
  showInternalLevel?: unknown;
}): ChartValueMode | undefined {
  const level = source.showLevel;
  const constant = source.showInternalLevel;
  if (typeof level !== "boolean" && typeof constant !== "boolean") return undefined;
  if (level !== false && constant === true) return "both";
  if (constant === true) return "constant";
  return level === false ? "none" : "level";
}

export function normalizeImageOptions(value: unknown): ImageOptions {
  if (!value || typeof value !== "object") return { ...DEFAULT_IMAGE_OPTIONS };
  const source = value as Partial<ImageOptions> & {
    showLevel?: unknown;
    showInternalLevel?: unknown;
    showScoreBadges?: unknown;
  };
  const boolean = <K extends keyof ImageOptions>(key: K) =>
    typeof source[key] === "boolean" ? source[key] as boolean : DEFAULT_IMAGE_OPTIONS[key] as boolean;
  const legacyScoreBadges = typeof source.showScoreBadges === "boolean" ? source.showScoreBadges : undefined;
  const badgeBoolean = (key: "showAchievementRank" | "showComboBadge" | "showSyncBadge") =>
    typeof source[key] === "boolean" ? source[key] : legacyScoreBadges ?? DEFAULT_IMAGE_OPTIONS[key];
  return {
    ...DEFAULT_IMAGE_OPTIONS,
    layout: layouts.has(source.layout as ImageLayout) ? source.layout as ImageLayout : DEFAULT_IMAGE_OPTIONS.layout,
    theme: themes.has(source.theme as ImageTheme) ? source.theme as ImageTheme : DEFAULT_IMAGE_OPTIONS.theme,
    accentColor: /^#[0-9a-f]{6}$/i.test(source.accentColor ?? "") ? source.accentColor! : DEFAULT_IMAGE_OPTIONS.accentColor,
    accentScope: accentScopes.has(source.accentScope as AccentScope)
      ? source.accentScope as AccentScope
      : DEFAULT_IMAGE_OPTIONS.accentScope,
    watermark: typeof source.watermark === "string" ? source.watermark.trim().slice(0, 48) : "",
    timestampMode: timestampModes.has(source.timestampMode as TimestampMode) ? source.timestampMode as TimestampMode : DEFAULT_IMAGE_OPTIONS.timestampMode,
    scale: source.scale === 1.5 ? 1.5 : 1,
    timestampFilename: boolean("timestampFilename"),
    showFrame: boolean("showFrame"),
    showIcon: boolean("showIcon"),
    showPlate: boolean("showPlate"),
    showCovers: boolean("showCovers"),
    showPlayerTitle: boolean("showPlayerTitle"),
    showRatingBreakdown: boolean("showRatingBreakdown"),
    showAchievement: boolean("showAchievement"),
    showChartRating: boolean("showChartRating"),
    showAchievementRank: badgeBoolean("showAchievementRank"),
    showComboBadge: badgeBoolean("showComboBadge"),
    showSyncBadge: badgeBoolean("showSyncBadge"),
    chartValue: chartValues.has(source.chartValue as ChartValueMode)
      ? source.chartValue as ChartValueMode
      : chartValueFromLegacy(source) ?? DEFAULT_IMAGE_OPTIONS.chartValue,
    showBucketRank: boolean("showBucketRank"),
    showGeneratedBy: boolean("showGeneratedBy")
  };
}

export function formatImageTimestamp(date: Date, options: ImageOptions, locale = "en"): string {
  if (options.timestampMode === "off") return "";
  const format: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    ...(options.timestampMode === "datetime" ? { timeStyle: "short" as const } : {})
  };
  return new Intl.DateTimeFormat(locale, format).format(date);
}

export function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}
