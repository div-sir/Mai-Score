import type { CollectionResult } from "./types";

export const RHYTHM_RECORD_SCHEMA = "mai-score/rhythm-record/v1" as const;
export type RhythmGameId = "maimai-dx" | "popn-music" | "sound-voltex" | "dance-dance-revolution";

export interface RhythmRecordEnvelope {
  schema: typeof RHYTHM_RECORD_SCHEMA;
  generatedAt: string;
  source: {
    game: RhythmGameId;
    connectionId: string;
    region?: string;
    gameVersion?: string;
    url?: string;
  };
  player?: {
    displayName?: string;
    title?: string;
    rating?: number;
    identifiers?: Record<string, string>;
    assets?: Record<string, string>;
  };
  records: Array<{
    recordId: string;
    playedAt?: string;
    song: {
      id: string;
      title: string;
      artist?: string;
      jacketId?: string;
      jacketUrl?: string;
    };
    chart: {
      id: string;
      type?: string;
      difficulty: string;
      level?: string;
      levelValue?: number;
    };
    result: {
      rawScore?: number;
      achievementRate?: number;
      grade?: string;
      clearStatus?: string;
      combo?: number;
      missCount?: number;
      rating?: {
        value: number;
        system: string;
      };
      judgments?: Record<string, number>;
    };
    grouping?: {
      bucket?: string;
      rank?: number;
    };
    gameSpecific?: Record<string, unknown>;
  }>;
  summaries?: Array<{
    system: string;
    value?: number;
    groups?: Record<string, number>;
    entries?: Array<{
      kind: "kiwami" | "shou" | "kami" | "maimai";
      version?: string;
      completed: number;
      total: number;
    }>;
  }>;
}

export function toRhythmRecord(result: CollectionResult): RhythmRecordEnvelope {
  const ranks = { b15: 0, b35: 0 };
  const chartIdOf = (record: CollectionResult["records"][number] | NonNullable<CollectionResult["fullRecords"]>[number]) => record.sheetId
    ?? `${record.title}__mai-score__${record.type}__mai-score__${record.difficulty}`;
  const b50Keys = new Set(result.records.map(chartIdOf));
  const exportedRecords = [
    ...result.records,
    ...(result.fullRecords ?? []).filter((record) => !b50Keys.has(chartIdOf(record)))
  ];
  return {
    schema: RHYTHM_RECORD_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: {
      game: "maimai-dx",
      connectionId: result.connection?.id ?? "dxnet-intl",
      region: result.connection?.region ?? "intl",
      url: result.source
    },
    player: {
      displayName: result.player.name,
      title: result.player.title,
      rating: result.player.rating,
      assets: Object.fromEntries(Object.entries({
        icon: result.player.iconUrl,
        frame: result.player.frameUrl,
        courseRank: result.player.courseRankUrl,
        classRank: result.player.classRankUrl,
        ratingBase: result.player.ratingBaseUrl
      }).filter((entry): entry is [string, string] => Boolean(entry[1])))
    },
    records: exportedRecords.map((record, index) => {
      const bucket = "bucket" in record && (record.bucket === "b15" || record.bucket === "b35")
        ? record.bucket
        : undefined;
      if (bucket) ranks[bucket] += 1;
      const chartId = chartIdOf(record);
      return {
        recordId: `${chartId}__${index + 1}`,
        song: {
          id: record.songId ?? record.title,
          title: record.title,
          ...(record.imageName ? { jacketId: record.imageName } : {})
        },
        chart: {
          id: chartId,
          type: record.type,
          difficulty: record.difficulty,
          level: record.displayedLevel,
          ...(record.internalLevelValue !== undefined ? { levelValue: record.internalLevelValue } : {})
        },
        result: {
          achievementRate: record.achievementRate,
          ...(record.chartRating !== undefined
            ? { rating: { value: record.chartRating, system: "maimai-dx-rating" } }
            : {})
        },
        ...(bucket ? { grouping: { bucket, rank: ranks[bucket] } } : {}),
        gameSpecific: {
          comboFlag: record.comboFlag,
          syncFlag: record.syncFlag,
          version: record.version
        }
      };
    }),
    summaries: [{
      system: "best50",
      value: result.b50Rating,
      groups: {
        b15: result.b15Rating,
        b35: result.b35Rating
      }
    }]
  };
}
