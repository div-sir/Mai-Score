import { describe, expect, it, vi } from "vitest";
import {
  APPDATA_SPACE,
  DriveAuthError,
  DriveRequestError,
  findAppDataFile,
  readAppDataFile,
  writeAppDataFile
} from "../src/lib/drive-appdata";

const ok = (body: unknown, text?: string) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => text ?? JSON.stringify(body)
}) as unknown as Response;

const failure = (status: number, detail = "") => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => detail
}) as unknown as Response;

const contextWith = (fetchMock: ReturnType<typeof vi.fn>) =>
  ({ token: "test-token", fetch: fetchMock as unknown as typeof globalThis.fetch });

describe("Drive app-data client", () => {
  it("sends the bearer token on every request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ files: [] }));
    await findAppDataFile(contextWith(fetchMock), "history.json");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer test-token");
  });

  it("confines the search to the hidden app-data space", async () => {
    // Without spaces=appDataFolder this would search — and later write to —
    // the user's visible Drive, which the requested scope does not even cover.
    const fetchMock = vi.fn().mockResolvedValue(ok({ files: [] }));
    await findAppDataFile(contextWith(fetchMock), "history.json");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("spaces")).toBe(APPDATA_SPACE);
    expect(url.searchParams.get("q")).toContain("name = 'history.json'");
    expect(url.searchParams.get("q")).toContain("trashed = false");
  });

  it("escapes quotes in a filename so the query cannot be broken out of", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ files: [] }));
    await findAppDataFile(contextWith(fetchMock), "it's.json");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("q")).toContain("it\\'s.json");
  });

  it("returns the first match, or undefined when there is none", async () => {
    const found = vi.fn().mockResolvedValue(ok({ files: [{ id: "abc", name: "history.json" }] }));
    expect(await findAppDataFile(contextWith(found), "history.json")).toMatchObject({ id: "abc" });

    const empty = vi.fn().mockResolvedValue(ok({ files: [] }));
    expect(await findAppDataFile(contextWith(empty), "history.json")).toBeUndefined();

    // Drive omits `files` entirely rather than sending [] in some responses.
    const absent = vi.fn().mockResolvedValue(ok({}));
    expect(await findAppDataFile(contextWith(absent), "history.json")).toBeUndefined();
  });

  it("downloads raw content with alt=media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}, '{"entries":[]}'));
    const content = await readAppDataFile(contextWith(fetchMock), "file-id");
    expect(content).toBe('{"entries":[]}');
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("alt")).toBe("media");
  });

  it("creates a new file as multipart, parented to the app-data folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "new-id", name: "history.json" }));
    await writeAppDataFile(contextWith(fetchMock), "history.json", '{"entries":[]}');

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(new URL(url).searchParams.get("uploadType")).toBe("multipart");

    const boundary = init.headers["content-type"].match(/boundary=(.+)$/)[1];
    expect(init.body).toContain(`--${boundary}`);
    expect(init.body).toContain(`--${boundary}--`);
    // The metadata part is what places the file out of the visible Drive.
    expect(init.body).toContain(`"parents":["${APPDATA_SPACE}"]`);
    expect(init.body).toContain('"name":"history.json"');
    expect(init.body).toContain('{"entries":[]}');
  });

  it("replaces an existing file in place instead of creating a duplicate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "existing-id", name: "history.json" }));
    await writeAppDataFile(contextWith(fetchMock), "history.json", '{"entries":[1]}', "existing-id");

    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(url).toContain("existing-id");
    expect(new URL(url).searchParams.get("uploadType")).toBe("media");
    // A plain media update sends the body as-is, with no multipart wrapper.
    expect(init.body).toBe('{"entries":[1]}');
  });

  it("routes an expired or revoked grant to re-auth rather than a raw status", async () => {
    for (const status of [401, 403]) {
      const fetchMock = vi.fn().mockResolvedValue(failure(status));
      await expect(findAppDataFile(contextWith(fetchMock), "history.json")).rejects.toBeInstanceOf(DriveAuthError);
    }
  });

  it("surfaces other failures with their status for diagnosis", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(507, "quota exceeded"));
    const error = await findAppDataFile(contextWith(fetchMock), "history.json").catch((e) => e);
    expect(error).toBeInstanceOf(DriveRequestError);
    expect(error.status).toBe(507);
    expect(error.message).toContain("quota exceeded");
  });
});
