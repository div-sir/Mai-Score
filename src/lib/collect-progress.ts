import { CONNECTION_PROTOCOL_VERSION } from "./connections";

export const FETCH_TIMEOUT_MS = 20_000;

export interface CollectProgressMessage {
  type: "MAI_SCORE_PROGRESS";
  protocolVersion: number;
  stage: "fetch" | "matching";
  done?: number;
  total?: number;
}

export function createFetchProgress(done: number, total: number): CollectProgressMessage {
  return { type: "MAI_SCORE_PROGRESS", protocolVersion: CONNECTION_PROTOCOL_VERSION, stage: "fetch", done, total };
}

export function createMatchingProgress(): CollectProgressMessage {
  return { type: "MAI_SCORE_PROGRESS", protocolVersion: CONNECTION_PROTOCOL_VERSION, stage: "matching" };
}

export function isCollectProgressMessage(value: unknown): value is CollectProgressMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CollectProgressMessage>;
  return message.type === "MAI_SCORE_PROGRESS"
    && message.protocolVersion === CONNECTION_PROTOCOL_VERSION
    && (message.stage === "fetch" || message.stage === "matching");
}

// AbortSignal.timeout() rejects with a DOMException named "TimeoutError"; a
// dropped connection or DNS failure instead rejects with a plain TypeError.
// Telling them apart lets the message name the actual cause instead of a
// generic "request failed" that reads the same whether DX NET is unreachable
// or just slow to answer.
export function describeFetchError(
  error: unknown,
  label: string,
  translate: (key: string, ...values: Array<string | number>) => string
): Error {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new Error(translate("fetchTimeout", label));
  }
  return new Error(translate("fetchFailed", label));
}
