import { describe, expect, it } from "vitest";
import { assertSameOrigin, bearerToken, MAX_PASSPORT_REQUEST_BYTES, readPassportRequest } from "../studio/lib/passport-request";
import { normalizePassportSlug, suggestPassportSlug } from "../studio/lib/passport-slug";
import {
  createPassportEditToken,
  hashPassportEditToken,
  verifyPassportEditToken
} from "../studio/lib/passport-store";

describe("persistent Passport identity", () => {
  it("normalizes safe public profile names and rejects ambiguous routes", () => {
    expect(normalizePassportSlug("  Solilium-25 ")).toBe("solilium-25");
    expect(suggestPassportSlug("SOLILIUM player")).toBe("solilium-player");
    expect(() => normalizePassportSlug("passport")).toThrow(/reserved/);
    expect(() => normalizePassportSlug("two--hyphens")).toThrow(/single hyphens/);
    expect(() => normalizePassportSlug("玩家")).toThrow(/lowercase letters/);
  });

  it("creates an unguessable edit key and verifies only its one-way hash", () => {
    const token = createPassportEditToken();
    const hash = hashPassportEditToken(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(verifyPassportEditToken(token, hash)).toBe(true);
    const changed = `${token.slice(0, -1)}${token.endsWith("x") ? "y" : "x"}`;
    expect(verifyPassportEditToken(changed, hash)).toBe(false);
  });

  it("accepts bounded same-shape JSON and strict bearer edit keys", async () => {
    const token = createPassportEditToken();
    const request = new Request("https://mai-score.example/api/passports", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug: "solilium", passport: { schema: "example" } })
    });
    await expect(readPassportRequest(request.clone())).resolves.toEqual({
      slug: "solilium",
      passport: { schema: "example" }
    });
    expect(bearerToken(request)).toBe(token);
  });

  it("rejects oversized Passport writes before parsing", async () => {
    const request = new Request("https://mai-score.example/api/passports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "solilium", passport: "x".repeat(MAX_PASSPORT_REQUEST_BYTES) })
    });
    await expect(readPassportRequest(request)).rejects.toThrow(/too large/);
  });

  it("rejects browser writes initiated by another origin", () => {
    const request = new Request("https://mai-score.example/api/passports", {
      headers: { origin: "https://attacker.example" }
    });
    expect(() => assertSameOrigin(request)).toThrow(/Cross-origin/);
  });
});
