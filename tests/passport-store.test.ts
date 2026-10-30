import { beforeEach, describe, expect, it } from "vitest";
import { createPassport } from "../studio/lib/passport";

import {
  createPublishedPassport,
  deletePublishedPassport,
  getPublishedPassport,
  PassportAuthorizationError,
  PassportConflictError,
  type PassportObjectStorage,
  updatePublishedPassport
} from "../studio/lib/passport-store";

const entries = new Map<string, { body: string; etag: string }>();
let sequence = 0;
const storage: PassportObjectStorage = {
  async read(path) {
    return entries.get(path);
  },
  async create(path, body) {
    if (entries.has(path)) throw new PassportConflictError();
    entries.set(path, { body, etag: `etag-${++sequence}` });
  },
  async update(path, body, etag) {
    if (entries.get(path)?.etag !== etag) throw new PassportConflictError();
    entries.set(path, { body, etag: `etag-${++sequence}` });
  },
  async delete(path, etag) {
    if (entries.get(path)?.etag !== etag) throw new PassportConflictError();
    entries.delete(path);
  }
};

const summary = (rating: number) => createPassport("SOLILIUM", "Arcade profile", [{
  game: "maimai-dx",
  rating,
  playedCharts: 1920,
  updatedAt: "2026-10-30T00:00:00.000Z",
  source: "mai-score"
}], "2026-10-30T00:00:00.000Z");

describe("persistent Passport storage", () => {
  beforeEach(() => {
    entries.clear();
    sequence = 0;
  });

  it("creates, updates, reads, and deletes one stable profile", async () => {
    const created = await createPublishedPassport("solilium", summary(15091), "2026-10-30T01:00:00.000Z", storage);
    expect(created.slug).toBe("solilium");
    expect(await getPublishedPassport("solilium", storage)).toEqual(summary(15091));
    expect([...entries.values()][0].body).not.toContain(created.editToken);

    await expect(createPublishedPassport("solilium", summary(15092), undefined, storage)).rejects.toBeInstanceOf(PassportConflictError);
    await expect(updatePublishedPassport("solilium", "x".repeat(43), summary(15092), undefined, storage))
      .rejects.toBeInstanceOf(PassportAuthorizationError);

    await updatePublishedPassport("solilium", created.editToken, summary(15092), "2026-10-30T02:00:00.000Z", storage);
    expect((await getPublishedPassport("solilium", storage))?.games[0].rating).toBe(15092);

    await deletePublishedPassport("solilium", created.editToken, storage);
    expect(await getPublishedPassport("solilium", storage)).toBeUndefined();
  });
});
