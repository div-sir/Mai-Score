export type ChartType = "std" | "dx";
export type Difficulty = "basic" | "advanced" | "expert" | "master" | "remaster";
export type Bucket = "b15" | "b35";
export type ComboFlag = "fc" | "fc+" | "ap" | "ap+";
export type SyncFlag = "fs" | "fs+" | "fsd" | "fsd+";

export interface ChartDataMetadata {
  source: string;
  updateTime: string;
  sha256: string;
  sheets: number;
}

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
  comboFlag?: ComboFlag;
  syncFlag?: SyncFlag;
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
  /** Exact chart catalog used to resolve constants, versions, and jackets. */
  chartData?: ChartDataMetadata;
  player: PlayerProfile;
  records: ResolvedScore[];
  /** DX NET's own near-miss lists from the Rating Target page, when present. */
  candidateRecords?: ResolvedScore[];
  b15Rating: number;
  b35Rating: number;
  b50Rating: number;
  warnings: string[];
}
