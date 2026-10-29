import type { RhythmGameId, RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import type { ExternalGameDataset } from "./local-store";
import type { StudioData } from "./types";
import { rhythmRecordFromKonamiPages } from "./rhythm-insights";

export const PASSPORT_SCHEMA = "mai-score/passport/v1" as const;

export interface PassportGameSummary {
  game: RhythmGameId;
  playerName?: string;
  rating?: number;
  playedCharts: number;
  updatedAt: string;
  source: "mai-score" | "rhythm-record" | "konami-pages";
}

export interface PublicPassport {
  schema: typeof PASSPORT_SCHEMA;
  publishedAt: string;
  profile: {
    displayName: string;
    bio?: string;
  };
  games: PassportGameSummary[];
}

const MAX_PROFILE_BYTES = 12_000;
const GAME_IDS = new Set<RhythmGameId>([
  "maimai-dx", "beatmania-iidx", "popn-music", "sound-voltex", "dance-dance-revolution"
]);

const clean = (value: unknown, max: number) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
  : "";

export function maimaiPassportSummary(data: StudioData): PassportGameSummary {
  return {
    game: "maimai-dx",
    playerName: clean(data.player.name, 40) || undefined,
    rating: Number.isFinite(data.b50Rating) ? Math.max(0, Math.round(data.b50Rating)) : undefined,
    playedCharts: data.fullRecords?.length ?? data.records.length,
    updatedAt: Number.isFinite(Date.parse(data.exportedAt)) ? data.exportedAt : new Date().toISOString(),
    source: "mai-score"
  };
}
function rhythmSummary(data: RhythmRecordEnvelope, source: PassportGameSummary["source"]): PassportGameSummary {
  return {
    game: data.source.game,
    playerName: clean(data.player?.displayName, 40) || undefined,
    rating: Number.isFinite(data.player?.rating) ? Number(data.player?.rating) : undefined,
    playedCharts: new Set(data.records.map((record) => record.chart.id)).size,
    updatedAt: data.generatedAt,
    source
  };
}
export function externalPassportSummary(dataset: ExternalGameDataset): PassportGameSummary {
  if (dataset.kind === "rhythm-record") return rhythmSummary(dataset.data, "rhythm-record");
  const normalized = rhythmRecordFromKonamiPages(dataset.data);
  return {
    game: dataset.game,
    playerName: clean(normalized.player?.displayName, 40) || undefined,
    rating: Number.isFinite(normalized.player?.rating) ? Number(normalized.player?.rating) : undefined,
    playedCharts: new Set(normalized.records.map((record) => record.chart.id)).size,
    updatedAt: dataset.data.generatedAt,
    source: "konami-pages"
  };
}

export function createPassport(
  displayName: string,
  bio: string,
  games: readonly PassportGameSummary[],
  publishedAt = new Date().toISOString()
): PublicPassport {
  const unique = new Map<RhythmGameId, PassportGameSummary>();
  for (const game of games) unique.set(game.game, game);
  return parsePassport({
    schema: PASSPORT_SCHEMA,
    publishedAt,
    profile: { displayName: clean(displayName, 40), bio: clean(bio, 160) || undefined },
    games: [...unique.values()]
  });
}

export function encodePassport(passport: PublicPassport): string {
  const bytes = new TextEncoder().encode(JSON.stringify(parsePassport(passport)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function decodePassport(value: string): PublicPassport {
  if (!value || value.length > MAX_PROFILE_BYTES * 2) throw new Error("The Passport link is invalid or too large.");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_PROFILE_BYTES) throw new Error("The Passport profile is too large.");
  return parsePassport(JSON.parse(new TextDecoder().decode(bytes)));
}

export function parsePassport(value: unknown): PublicPassport {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Passport profile.");
  const input = value as Record<string, unknown>;
  if (input.schema !== PASSPORT_SCHEMA) throw new Error("Unsupported Passport version.");
  const publishedAt = clean(input.publishedAt, 40);
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error("Passport publish date is invalid.");
  const profile = input.profile as Record<string, unknown> | undefined;
  const displayName = clean(profile?.displayName, 40);
  if (!displayName) throw new Error("Passport display name is required.");
  if (!Array.isArray(input.games) || !input.games.length || input.games.length > 5) {
    throw new Error("Passport must contain between one and five games.");
  }
  const games = input.games.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Invalid game summary.");
    const game = candidate as Record<string, unknown>;
    if (!GAME_IDS.has(game.game as RhythmGameId)) throw new Error("Unsupported Passport game.");
    const playedCharts = Number(game.playedCharts);
    const updatedAt = clean(game.updatedAt, 40);
    if (!Number.isInteger(playedCharts) || playedCharts < 0 || !Number.isFinite(Date.parse(updatedAt))) {
      throw new Error("Invalid Passport game values.");
    }
    const rating = Number(game.rating);
    return {
      game: game.game as RhythmGameId,
      playerName: clean(game.playerName, 40) || undefined,
      rating: Number.isFinite(rating) && rating >= 0 ? rating : undefined,
      playedCharts,
      updatedAt,
      source: game.source === "mai-score" || game.source === "rhythm-record" || game.source === "konami-pages"
        ? game.source : "rhythm-record"
    } satisfies PassportGameSummary;
  });
  return {
    schema: PASSPORT_SCHEMA,
    publishedAt,
    profile: { displayName, bio: clean(profile?.bio, 160) || undefined },
    games
  };
}
