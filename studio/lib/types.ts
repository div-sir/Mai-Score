export type LayoutId = "classic" | "compact" | "landscape";
export type ThemeId = "night" | "light" | "maimai";
export type TimestampMode = "off" | "date" | "datetime";
export type LanguageId = "en" | "zh-Hant" | "ja";

export interface StudioOptions {
  layout: LayoutId;
  theme: ThemeId;
  accent: string;
  watermark: string;
  timestamp: TimestampMode;
  showFrame: boolean;
  showIcon: boolean;
  showCovers: boolean;
  showBreakdown: boolean;
  showAchievement: boolean;
  showChartRating: boolean;
  showConstant: boolean;
  showLevel: boolean;
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
}

export interface StudioData {
  schema: string;
  exportedAt: string;
  player: {
    name: string;
    title: string;
    rating: number;
    iconUrl?: string;
    frameUrl?: string;
  };
  records: StudioRecord[];
  b15Rating: number;
  b35Rating: number;
  b50Rating: number;
}

export interface StudioAssets {
  icon?: string;
  frame?: string;
  covers: Record<string, string>;
}

export const DEFAULT_OPTIONS: StudioOptions = {
  layout: "classic",
  theme: "night",
  accent: "#b89b72",
  watermark: "",
  timestamp: "datetime",
  showFrame: true,
  showIcon: true,
  showCovers: true,
  showBreakdown: true,
  showAchievement: true,
  showChartRating: true,
  showConstant: false,
  showLevel: true,
  showRank: true
};
