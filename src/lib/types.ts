export type ChartType = "std" | "dx";
export type Difficulty = "basic" | "advanced" | "expert" | "master" | "remaster";
export type Bucket = "b15" | "b35";

export interface SheetRecord {
  sheetId: string;
  songId: string;
  title: string;
  type: ChartType;
  difficulty: Difficulty;
  level: string;
  internalLevelValue: number;
  version: string;
  imageName: string;
}

export interface ParsedScore {
  title: string;
  type: ChartType;
  difficulty: Difficulty;
  displayedLevel: string;
  achievementRate: number;
  bucket: Bucket;
  comboFlag?: string;
  syncFlag?: string;
}

export interface ResolvedScore extends ParsedScore {
  sheetId?: string;
  songId?: string;
  internalLevelValue?: number;
  version?: string;
  imageName?: string;
  chartRating?: number;
  warning?: string;
}

export interface PlayerProfile {
  name: string;
  title: string;
  titleColor?: string;
  rating: number;
  stars?: number;
  iconUrl?: string;
  frameUrl?: string;
  plateUrl?: string;
  courseRankUrl?: string;
  classRankUrl?: string;
  ratingBaseUrl?: string;
}

export interface CollectionResult {
  schema: "mai-score/v1";
  exportedAt: string;
  source: string;
  connection?: {
    id: string;
    protocolVersion: number;
    region?: string;
  };
  player: PlayerProfile;
  records: ResolvedScore[];
  b15Rating: number;
  b35Rating: number;
  b50Rating: number;
  warnings: string[];
}
