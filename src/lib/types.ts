export type ChartType = "std" | "dx";
export type Difficulty = "basic" | "advanced" | "expert" | "master" | "remaster";
export type Bucket = "b15" | "b35";
export type ComboFlag = "fc" | "fc+" | "ap" | "ap+";
export type SyncFlag = "fs" | "fs+" | "fsd" | "fsd+" | "fdx" | "fdx+";

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

export interface ParsedChartScore {
  title: string;
  type: ChartType;
  difficulty: Difficulty;
  displayedLevel: string;
  achievementRate: number;
  comboFlag?: ComboFlag;
  syncFlag?: SyncFlag;
}

export interface ParsedScore extends ParsedChartScore {
  bucket: Bucket;
}

export type ParsedFullScore = ParsedChartScore;

export interface ResolvedChartScore extends ParsedChartScore {
  sheetId?: string;
  songId?: string;
  internalLevelValue?: number;
  version?: string;
  imageName?: string;
  chartRating?: number;
  warning?: string;
}

export interface ResolvedScore extends ResolvedChartScore {
  bucket: Bucket;
}

export type ResolvedFullScore = ResolvedChartScore;

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
  /** Optional best-per-chart results collected from all five DX NET difficulty pages. */
  fullRecords?: ResolvedFullScore[];
  /** Number of Full Records entries the bundled chart catalog could not resolve. */
  fullRecordsUnmatched?: number;
  /** DX NET's own near-miss lists from the Rating Target page, when present. */
  candidateRecords?: ResolvedScore[];
  b15Rating: number;
  b35Rating: number;
  b50Rating: number;
  warnings: string[];
}
