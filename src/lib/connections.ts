export const CONNECTION_PROTOCOL_VERSION = 1;

export type ConnectionId = "dxnet-intl";
export type ConnectionTransport = "content-script" | "file" | "api";

export interface ConnectionDescriptor {
  id: ConnectionId;
  label: string;
  transport: ConnectionTransport;
  matches: readonly string[];
  capabilities: {
    profile: boolean;
    assets: boolean;
    best50: boolean;
  };
}

export interface CollectRequest {
  type: "MAI_SCORE_COLLECT";
  protocolVersion: number;
  connectionId: ConnectionId;
}

export const CONNECTIONS: readonly ConnectionDescriptor[] = [{
  id: "dxnet-intl",
  label: "maimai DX NET International",
  transport: "content-script",
  matches: ["https://maimaidx-eng.com/maimai-mobile/"],
  capabilities: { profile: true, assets: true, best50: true }
}];

export function connectionForUrl(url: string): ConnectionDescriptor | undefined {
  return CONNECTIONS.find((connection) => connection.matches.some((prefix) => url.startsWith(prefix)));
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
    && CONNECTIONS.some((connection) => connection.id === message.connectionId);
}
