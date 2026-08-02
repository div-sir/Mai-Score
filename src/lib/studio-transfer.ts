import type { CollectionResult } from "./types";
import type { PopupLanguage } from "./i18n";

export const STUDIO_URL = "https://mai-score.milifix.com";
export const STUDIO_TRANSFER_TTL_MS = 5 * 60 * 1000;
export const STUDIO_TRANSFER_PREFIX = "studioTransfer:";

export interface StudioTransferAssets {
  icon?: string;
  frame?: string;
  plate?: string;
  covers: Record<string, string>;
  badges?: Record<string, string>;
}

export interface StudioTransfer {
  data: CollectionResult;
  assets: StudioTransferAssets;
  language: PopupLanguage;
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

export interface StudioTransferStore {
  get(key: string): Promise<Record<string, unknown>>;
  remove(key: string): Promise<void>;
}

/**
 * Reads a staged transfer and spends its token. The stored entry is removed
 * before the expiry check, so a token is single-use even when it is stale.
 * Returns undefined when the token is unknown, already spent, or expired.
 */
export async function consumeStudioTransfer(
  store: StudioTransferStore,
  token: string,
  now = Date.now()
): Promise<StudioTransfer | undefined> {
  const key = studioTransferKey(token);
  const stored = await store.get(key);
  await store.remove(key);
  const transfer = stored[key] as StudioTransfer | undefined;
  return transfer && transfer.expiresAt > now ? transfer : undefined;
}

export function isStudioSender(url?: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === STUDIO_URL;
  } catch {
    return false;
  }
}
