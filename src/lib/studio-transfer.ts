import type { CollectionResult } from "./types";

export const STUDIO_URL = "https://mai-score-studio.solilium.chatgpt.site";
export const STUDIO_TRANSFER_TTL_MS = 5 * 60 * 1000;
export const STUDIO_TRANSFER_PREFIX = "studioTransfer:";

export interface StudioTransfer {
  data: CollectionResult;
  expiresAt: number;
}

export interface StudioImportRequest {
  type: "MAI_SCORE_STUDIO_IMPORT";
  token: string;
}

export const studioTransferKey = (token: string) => `${STUDIO_TRANSFER_PREFIX}${token}`;

export function isStudioImportRequest(value: unknown): value is StudioImportRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<StudioImportRequest>;
  return message.type === "MAI_SCORE_STUDIO_IMPORT"
    && typeof message.token === "string"
    && /^[0-9a-f-]{36}$/i.test(message.token);
}

export function isStudioSender(url?: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === STUDIO_URL;
  } catch {
    return false;
  }
}
