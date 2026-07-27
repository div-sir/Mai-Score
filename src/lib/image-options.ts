export type ImageLayout = "classic" | "compact" | "landscape";
export type ImageTheme = "night" | "light" | "maimai";
export type TimestampMode = "off" | "date" | "datetime";
export type TimestampZone = "local" | "utc";
export type ImageScale = 1 | 1.5;

export interface ImageOptions {
  version: 1;
  layout: ImageLayout;
  theme: ImageTheme;
  accentColor: string;
  watermark: string;
  timestampMode: TimestampMode;
  timestampZone: TimestampZone;
  scale: ImageScale;
  timestampFilename: boolean;
  showFrame: boolean;
  showIcon: boolean;
  showCovers: boolean;
  showPlayerTitle: boolean;
  showOfficialRating: boolean;
  showRatingBreakdown: boolean;
  showAchievement: boolean;
  showChartRating: boolean;
  showLevel: boolean;
  showBucketRank: boolean;
  showGeneratedBy: boolean;
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  version: 1,
  layout: "classic",
  theme: "night",
  accentColor: "#6e67ff",
  watermark: "",
  timestampMode: "datetime",
  timestampZone: "local",
  scale: 1,
  timestampFilename: true,
  showFrame: true,
  showIcon: true,
  showCovers: true,
  showPlayerTitle: true,
  showOfficialRating: true,
  showRatingBreakdown: true,
  showAchievement: true,
  showChartRating: true,
  showLevel: true,
  showBucketRank: true,
  showGeneratedBy: true
};

const layouts = new Set<ImageLayout>(["classic", "compact", "landscape"]);
const themes = new Set<ImageTheme>(["night", "light", "maimai"]);
const timestampModes = new Set<TimestampMode>(["off", "date", "datetime"]);
const timestampZones = new Set<TimestampZone>(["local", "utc"]);

export function normalizeImageOptions(value: unknown): ImageOptions {
  if (!value || typeof value !== "object") return { ...DEFAULT_IMAGE_OPTIONS };
  const source = value as Partial<ImageOptions>;
  const boolean = <K extends keyof ImageOptions>(key: K) =>
    typeof source[key] === "boolean" ? source[key] as boolean : DEFAULT_IMAGE_OPTIONS[key] as boolean;
  return {
    ...DEFAULT_IMAGE_OPTIONS,
    layout: layouts.has(source.layout as ImageLayout) ? source.layout as ImageLayout : DEFAULT_IMAGE_OPTIONS.layout,
    theme: themes.has(source.theme as ImageTheme) ? source.theme as ImageTheme : DEFAULT_IMAGE_OPTIONS.theme,
    accentColor: /^#[0-9a-f]{6}$/i.test(source.accentColor ?? "") ? source.accentColor! : DEFAULT_IMAGE_OPTIONS.accentColor,
    watermark: typeof source.watermark === "string" ? source.watermark.trim().slice(0, 48) : "",
    timestampMode: timestampModes.has(source.timestampMode as TimestampMode) ? source.timestampMode as TimestampMode : DEFAULT_IMAGE_OPTIONS.timestampMode,
    timestampZone: timestampZones.has(source.timestampZone as TimestampZone) ? source.timestampZone as TimestampZone : DEFAULT_IMAGE_OPTIONS.timestampZone,
    scale: source.scale === 1.5 ? 1.5 : 1,
    timestampFilename: boolean("timestampFilename"),
    showFrame: boolean("showFrame"),
    showIcon: boolean("showIcon"),
    showCovers: boolean("showCovers"),
    showPlayerTitle: boolean("showPlayerTitle"),
    showOfficialRating: boolean("showOfficialRating"),
    showRatingBreakdown: boolean("showRatingBreakdown"),
    showAchievement: boolean("showAchievement"),
    showChartRating: boolean("showChartRating"),
    showLevel: boolean("showLevel"),
    showBucketRank: boolean("showBucketRank"),
    showGeneratedBy: boolean("showGeneratedBy")
  };
}

export function formatImageTimestamp(date: Date, options: ImageOptions, locale = "zh-TW"): string {
  if (options.timestampMode === "off") return "";
  const format: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    ...(options.timestampMode === "datetime" ? { timeStyle: "short" as const } : {}),
    ...(options.timestampZone === "utc" ? { timeZone: "UTC" } : {})
  };
  const formatted = new Intl.DateTimeFormat(locale, format).format(date);
  return options.timestampZone === "utc" ? `${formatted} UTC` : formatted;
}

export function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}
