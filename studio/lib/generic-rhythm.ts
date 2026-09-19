import type { RhythmGameId, RhythmRecordEnvelope } from "../../src/lib/rhythm-record";

const RHYTHM_RECORD_SCHEMA = "mai-score/rhythm-record/v1";

const SUPPORTED_GAMES = new Set<RhythmGameId>(["beatmania-iidx", "sound-voltex"]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

const optionalString = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const optionalNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function isGenericRhythmRecord(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = (value as { source?: unknown }).source;
  return (value as { schema?: unknown }).schema === RHYTHM_RECORD_SCHEMA
    && Boolean(source && typeof source === "object" && !Array.isArray(source)
      && SUPPORTED_GAMES.has((source as { game?: RhythmGameId }).game as RhythmGameId));
}

export function parseGenericRhythmRecord(value: unknown): RhythmRecordEnvelope {
  const input = object(value, "The JSON root");
  if (input.schema !== RHYTHM_RECORD_SCHEMA) throw new Error("Unsupported Rhythm Record schema.");
  const source = object(input.source, "source");
  const game = string(source.game, "source.game") as RhythmGameId;
  if (!SUPPORTED_GAMES.has(game)) throw new Error(`Studio does not yet have a ${game} dashboard.`);
  const connectionId = string(source.connectionId, "source.connectionId");
  const generatedAt = string(input.generatedAt, "generatedAt");
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error("generatedAt must be an ISO date-time.");
  if (!Array.isArray(input.records) || input.records.length === 0) throw new Error("records must be a non-empty array.");

  const recordIds = new Set<string>();
  const records: RhythmRecordEnvelope["records"] = input.records.map((candidate, index) => {
    const record = object(candidate, `records[${index}]`);
    const recordId = string(record.recordId, `records[${index}].recordId`);
    if (recordIds.has(recordId)) throw new Error(`Duplicate recordId: ${recordId}`);
    recordIds.add(recordId);
    const song = object(record.song, `records[${index}].song`);
    const chart = object(record.chart, `records[${index}].chart`);
    const result = object(record.result, `records[${index}].result`);
    const rawScore = optionalNumber(result.rawScore);
    if (rawScore === undefined || rawScore < 0) throw new Error(`records[${index}].result.rawScore is invalid.`);
    return {
      recordId,
      ...(optionalString(record.playedAt) ? { playedAt: optionalString(record.playedAt) } : {}),
      song: {
        id: string(song.id, `records[${index}].song.id`),
        title: string(song.title, `records[${index}].song.title`),
        ...(optionalString(song.artist) ? { artist: optionalString(song.artist) } : {})
      },
      chart: {
        id: string(chart.id, `records[${index}].chart.id`),
        ...(optionalString(chart.type) ? { type: optionalString(chart.type) } : {}),
        difficulty: string(chart.difficulty, `records[${index}].chart.difficulty`),
        ...(optionalString(chart.level) ? { level: optionalString(chart.level) } : {})
      },
      result: {
        rawScore,
        ...(optionalString(result.grade) ? { grade: optionalString(result.grade) } : {}),
        ...(optionalString(result.clearStatus) ? { clearStatus: optionalString(result.clearStatus) } : {}),
        ...(optionalNumber(result.missCount) !== undefined ? { missCount: optionalNumber(result.missCount) } : {})
      },
      ...(record.gameSpecific && typeof record.gameSpecific === "object" && !Array.isArray(record.gameSpecific)
        ? { gameSpecific: record.gameSpecific as Record<string, unknown> } : {})
    };
  });

  const player = input.player && typeof input.player === "object" && !Array.isArray(input.player)
    ? input.player as Record<string, unknown> : undefined;
  return {
    schema: RHYTHM_RECORD_SCHEMA,
    generatedAt,
    source: {
      game,
      connectionId,
      ...(optionalString(source.region) ? { region: optionalString(source.region) } : {}),
      ...(optionalString(source.gameVersion) ? { gameVersion: optionalString(source.gameVersion) } : {})
    },
    ...(player ? { player: {
      ...(optionalString(player.displayName) ? { displayName: optionalString(player.displayName) } : {}),
      ...(optionalString(player.title) ? { title: optionalString(player.title) } : {}),
      ...(optionalNumber(player.rating) !== undefined ? { rating: optionalNumber(player.rating) } : {})
    } } : {}),
    records,
    summaries: Array.isArray(input.summaries) ? input.summaries as RhythmRecordEnvelope["summaries"] : undefined
  };
}

export const rhythmGameLabel = (game: RhythmGameId) => game === "beatmania-iidx"
  ? "beatmania IIDX"
  : game === "sound-voltex" ? "SOUND VOLTEX" : game;
