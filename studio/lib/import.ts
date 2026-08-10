import type {
  PlateProgress,
  StudioData,
  StudioFullRecord,
  StudioRecord
} from "./types";

const DIFFICULTIES = new Set(["basic", "advanced", "expert", "master", "remaster"]);
const PLATE_KINDS = new Set(["kiwami", "shou", "kami", "maimai"]);
const COMBO_FLAGS = new Set(["fc", "fc+", "ap", "ap+"]);
const SYNC_FLAGS = new Set(["fs", "fs+", "fsd", "fsd+", "fdx", "fdx+"]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function parsePlateProgress(value: unknown): PlateProgress[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const entry = candidate as Record<string, unknown>;
    const completed = Number(entry.completed);
    const total = Number(entry.total);
    if (!PLATE_KINDS.has(String(entry.kind))
      || !Number.isInteger(completed)
      || !Number.isInteger(total)
      || completed < 0
      || total < completed) return [];
    return [{
      kind: String(entry.kind) as PlateProgress["kind"],
      ...(optionalString(entry.version) ? { version: optionalString(entry.version)!.slice(0, 48) } : {}),
      completed,
      total
    }];
  });
  return entries.length ? entries : undefined;
}

const chartRatingOf = (record: StudioRecord) =>
  Number.isFinite(Number(record.chartRating)) ? Number(record.chartRating) : 0;

export function normalizeB50(data: StudioData): StudioData {
  const b15Candidates = data.records.filter((record) => record.bucket === "b15");
  const b35Candidates = data.records.filter((record) => record.bucket === "b35");
  if (b15Candidates.length !== 15 || b35Candidates.length !== 35) {
    throw new Error(`Expected 15 new and 35 old charts, found ${b15Candidates.length} and ${b35Candidates.length}.`);
  }
  const topOf = (candidates: StudioRecord[]) => [...candidates]
    .sort((a, b) => chartRatingOf(b) - chartRatingOf(a));
  const b15 = topOf(b15Candidates);
  const b35 = topOf(b35Candidates);
  const sum = (records: StudioRecord[]) => records.reduce((total, record) => total + chartRatingOf(record), 0);
  const b15Rating = sum(b15);
  const b35Rating = sum(b35);
  return {
    ...data,
    records: [...b15, ...b35],
    candidateRecords: data.candidateRecords?.filter((record) => record.bucket === "b15" || record.bucket === "b35"),
    b15Rating,
    b35Rating,
    b50Rating: b15Rating + b35Rating
  };
}

function parseRhythmRecord(input: Record<string, unknown>): StudioData {
  const source = object(input.source, "source");
  if (source.game !== "maimai-dx") {
    throw new Error("Mai-Score Studio currently supports only maimai-dx Rhythm Record files.");
  }
  requiredString(source.connectionId, "source.connectionId");
  const generatedAt = requiredString(input.generatedAt, "generatedAt");
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error("generatedAt must be an ISO date-time.");
  if (!Array.isArray(input.records) || input.records.length === 0) throw new Error("records must be a non-empty array.");

  const recordIds = new Set<string>();
  const fullByChart = new Map<string, StudioFullRecord>();
  const b50: StudioRecord[] = [];

  for (const [index, value] of input.records.entries()) {
    const record = object(value, `records[${index}]`);
    const recordId = requiredString(record.recordId, `records[${index}].recordId`);
    if (recordIds.has(recordId)) throw new Error(`Duplicate recordId: ${recordId}`);
    recordIds.add(recordId);
    const song = object(record.song, `records[${index}].song`);
    const chart = object(record.chart, `records[${index}].chart`);
    const result = object(record.result, `records[${index}].result`);
    const gameSpecific = record.gameSpecific && typeof record.gameSpecific === "object" && !Array.isArray(record.gameSpecific)
      ? record.gameSpecific as Record<string, unknown>
      : {};
    const chartId = requiredString(chart.id, `records[${index}].chart.id`);
    const type = chart.type === "std" || chart.type === "dx" ? chart.type : undefined;
    if (!type) throw new Error(`records[${index}].chart.type must be std or dx.`);
    const difficulty = String(chart.difficulty ?? "");
    if (!DIFFICULTIES.has(difficulty)) throw new Error(`records[${index}].chart.difficulty is not supported.`);
    const achievementRate = optionalNumber(result.achievementRate);
    if (achievementRate === undefined || achievementRate < 0 || achievementRate > 101) {
      throw new Error(`records[${index}].result.achievementRate must be between 0 and 101.`);
    }
    const rating = result.rating && typeof result.rating === "object" && !Array.isArray(result.rating)
      ? optionalNumber((result.rating as Record<string, unknown>).value)
      : undefined;
    const comboFlag = COMBO_FLAGS.has(String(gameSpecific.comboFlag))
      ? String(gameSpecific.comboFlag) as StudioFullRecord["comboFlag"]
      : undefined;
    const syncFlag = SYNC_FLAGS.has(String(gameSpecific.syncFlag))
      ? String(gameSpecific.syncFlag) as StudioFullRecord["syncFlag"]
      : undefined;
    const parsed: StudioFullRecord = {
      chartId,
      songId: requiredString(song.id, `records[${index}].song.id`),
      title: requiredString(song.title, `records[${index}].song.title`),
      type,
      difficulty: difficulty as StudioFullRecord["difficulty"],
      displayedLevel: optionalString(chart.level) ?? "?",
      achievementRate,
      internalLevelValue: optionalNumber(chart.levelValue),
      chartRating: rating,
      imageName: optionalString(song.jacketId),
      comboFlag,
      syncFlag,
      grade: optionalString(result.grade),
      clearStatus: optionalString(result.clearStatus),
      version: optionalString(gameSpecific.version)
    };
    const current = fullByChart.get(chartId);
    if (!current || parsed.achievementRate > current.achievementRate
      || (parsed.achievementRate === current.achievementRate && Number(parsed.chartRating ?? 0) > Number(current.chartRating ?? 0))) {
      fullByChart.set(chartId, parsed);
    }

    const grouping = record.grouping && typeof record.grouping === "object" && !Array.isArray(record.grouping)
      ? record.grouping as Record<string, unknown>
      : undefined;
    if (grouping?.bucket === "b15" || grouping?.bucket === "b35") {
      if (rating === undefined) throw new Error(`B50 record ${recordId} is missing result.rating.value.`);
      b50.push({ ...parsed, bucket: grouping.bucket });
    }
  }

  const summaries = Array.isArray(input.summaries)
    ? input.summaries.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
  const plateSummary = summaries.find((item) => item.system === "maimai-plate-progress");
  const player = input.player && typeof input.player === "object" && !Array.isArray(input.player)
    ? input.player as Record<string, unknown>
    : {};

  return normalizeB50({
    schema: "mai-score/rhythm-record/v1",
    exportedAt: generatedAt,
    source: optionalString(source.url),
    player: {
      name: optionalString(player.displayName) ?? "PLAYER",
      title: optionalString(player.title) ?? "",
      rating: optionalNumber(player.rating) ?? 0
    },
    records: b50,
    fullRecords: [...fullByChart.values()],
    b15Rating: 0,
    b35Rating: 0,
    b50Rating: 0,
    plateProgress: parsePlateProgress(plateSummary?.entries)
  });
}

export function parseMaiScore(input: unknown): StudioData {
  const value = object(input, "The JSON root");
  if (value.schema === "mai-score/rhythm-record/v1") return parseRhythmRecord(value);

  const player = value.player as StudioData["player"] | undefined;
  const records = value.records;
  if (!player || !Array.isArray(records)) throw new Error("Missing player or records. Select a Mai-Score full JSON file.");
  if (records.length < 50) throw new Error(`Found ${records.length} records; B50 preview requires 50.`);
  return normalizeB50({
    schema: String(value.schema ?? "mai-score/v1"),
    exportedAt: String(value.exportedAt ?? new Date().toISOString()),
    source: typeof value.source === "string" ? value.source : undefined,
    chartData: value.chartData as StudioData["chartData"],
    player: {
      name: String(player.name ?? "PLAYER"),
      title: String(player.title ?? ""),
      titleColor: player.titleColor,
      rating: Number(player.rating ?? 0),
      iconUrl: player.iconUrl,
      frameUrl: player.frameUrl,
      plateUrl: player.plateUrl
    },
    records: (records as StudioRecord[]).map((record) => ({
      ...record,
      internalLevelValue: optionalNumber(record.internalLevelValue)
    })),
    candidateRecords: Array.isArray(value.candidateRecords)
      ? (value.candidateRecords as StudioRecord[]).map((record) => ({
          ...record,
          internalLevelValue: optionalNumber(record.internalLevelValue)
        }))
      : undefined,
    fullRecords: Array.isArray(value.fullRecords) ? value.fullRecords as StudioFullRecord[] : undefined,
    b15Rating: Number(value.b15Rating ?? 0),
    b35Rating: Number(value.b35Rating ?? 0),
    b50Rating: Number(value.b50Rating ?? 0),
    plateProgress: parsePlateProgress(value.plateProgress)
  });
}
