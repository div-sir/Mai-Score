export const CONNECTION_PROTOCOL_VERSION = 1;

import type { RhythmGameId } from "./rhythm-record";

export type ConnectionId =
  | "dxnet-intl"
  | "rhythm-record-file"
  | "popn-konami"
  | "sdvx-konami"
  | "ddr-konami";
export type ConnectionTransport = "content-script" | "file" | "api";

export interface ConnectionDescriptor {
  id: ConnectionId;
  game: RhythmGameId;
  label: string;
  transport: ConnectionTransport;
  status: "active" | "planned";
  matches: readonly string[];
  capabilities: {
    profile: boolean;
    assets: boolean;
    best50: boolean;
    records: boolean;
  };
}

export interface CollectRequest {
  type: "MAI_SCORE_COLLECT";
  protocolVersion: number;
  connectionId: ConnectionId;
}

export const CONNECTIONS: readonly ConnectionDescriptor[] = [{
  id: "dxnet-intl",
  game: "maimai-dx",
  label: "maimai DX NET International",
  transport: "content-script",
  status: "active",
  matches: ["https://maimaidx-eng.com/maimai-mobile/"],
  capabilities: { profile: true, assets: true, best50: true, records: true }
}, {
  id: "rhythm-record-file",
  game: "maimai-dx",
  label: "Rhythm Record JSON",
  transport: "file",
  status: "planned",
  matches: [],
  capabilities: { profile: true, assets: true, best50: false, records: true }
}, {
  id: "popn-konami",
  game: "popn-music",
  label: "pop’n music record service",
  transport: "api",
  status: "planned",
  matches: [],
  capabilities: { profile: true, assets: false, best50: false, records: true }
}, {
  id: "sdvx-konami",
  game: "sound-voltex",
  label: "SOUND VOLTEX record service",
  transport: "api",
  status: "planned",
  matches: [],
  capabilities: { profile: true, assets: false, best50: false, records: true }
}, {
  id: "ddr-konami",
  game: "dance-dance-revolution",
  label: "DanceDanceRevolution record service",
  transport: "api",
  status: "planned",
  matches: [],
  capabilities: { profile: true, assets: false, best50: false, records: true }
}];

export function connectionForUrl(url: string): ConnectionDescriptor | undefined {
  return CONNECTIONS.find((connection) =>
    connection.status === "active" && connection.matches.some((prefix) => url.startsWith(prefix)));
}

export function createCollectRequest(connectionId: ConnectionId): CollectRequest {
  return {
    type: "MAI_SCORE_COLLECT",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId
  };
}

export function isCollectRequest(value: unknown): value is CollectRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CollectRequest>;
  return message.type === "MAI_SCORE_COLLECT"
    && message.protocolVersion === CONNECTION_PROTOCOL_VERSION
    && CONNECTIONS.some((connection) => connection.id === message.connectionId && connection.status === "active");
}
