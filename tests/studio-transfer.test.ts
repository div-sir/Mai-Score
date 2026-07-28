import { describe, expect, it } from "vitest";
import {
  consumeStudioTransfer,
  isStudioImportRequest,
  isStudioSender,
  studioTransferKey,
  type StudioTransfer
} from "../src/lib/studio-transfer";

const TOKEN = "123e4567-e89b-12d3-a456-426614174000";

function storeWith(transfer?: StudioTransfer) {
  const entries = new Map<string, unknown>();
  if (transfer) entries.set(studioTransferKey(TOKEN), transfer);
  return {
    entries,
    get: async (key: string) => entries.has(key) ? { [key]: entries.get(key) } : {},
    remove: async (key: string) => { entries.delete(key); }
  };
}

const transferAt = (expiresAt: number) => ({
  data: { schema: "mai-score/v1" },
  assets: { covers: {} },
  language: "en",
  expiresAt
} as unknown as StudioTransfer);

describe("Studio transfer", () => {
  it("accepts only a UUID-shaped one-time request", () => {
    const token = "123e4567-e89b-12d3-a456-426614174000";
    expect(isStudioImportRequest({ type: "MAI_SCORE_STUDIO_IMPORT", token })).toBe(true);
    expect(isStudioImportRequest({ type: "MAI_SCORE_STUDIO_IMPORT", token: "short" })).toBe(false);
    expect(studioTransferKey(token)).toBe(`studioTransfer:${token}`);
  });

  it("accepts only the deployed Studio origin", () => {
    expect(isStudioSender("https://mai-score.milifix.com/")).toBe(true);
    expect(isStudioSender("https://mai-score.milifix.com.fake.example/")).toBe(false);
    expect(isStudioSender("https://example.com/")).toBe(false);
  });

  it("returns a staged transfer once and then spends the token", async () => {
    const store = storeWith(transferAt(2_000));

    await expect(consumeStudioTransfer(store, TOKEN, 1_000)).resolves.toMatchObject({ expiresAt: 2_000 });
    expect(store.entries.size).toBe(0);
    await expect(consumeStudioTransfer(store, TOKEN, 1_000)).resolves.toBeUndefined();
  });

  it("rejects an expired transfer and still spends the token", async () => {
    const store = storeWith(transferAt(1_000));

    await expect(consumeStudioTransfer(store, TOKEN, 1_000)).resolves.toBeUndefined();
    expect(store.entries.size).toBe(0);
  });

  it("returns nothing for an unknown token", async () => {
    await expect(consumeStudioTransfer(storeWith(), TOKEN, 1_000)).resolves.toBeUndefined();
  });
});
