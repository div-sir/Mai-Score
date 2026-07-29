import { describe, expect, it, vi } from "vitest";
import { CONNECTION_PROTOCOL_VERSION } from "../src/lib/connections";
import {
  DRIVE_HISTORY_FILE,
  MAX_SYNC_PAYLOAD_BYTES,
  createDrivePullRequest,
  createDrivePushRequest,
  isDriveSyncRequest,
  payloadBytes,
  performDriveSync
} from "../src/lib/drive-sync";

describe("Drive sync messages", () => {
  it("round-trips both request kinds through the guard", () => {
    expect(isDriveSyncRequest(createDrivePullRequest())).toBe(true);
    expect(isDriveSyncRequest(createDrivePushRequest('{"entries":[]}'))).toBe(true);
  });

  it("rejects anything that is not a well-formed request", () => {
    expect(isDriveSyncRequest(null)).toBe(false);
    expect(isDriveSyncRequest("MAI_SCORE_DRIVE_PULL")).toBe(false);
    expect(isDriveSyncRequest({ type: "MAI_SCORE_DRIVE_PULL" })).toBe(false);
    expect(isDriveSyncRequest({ ...createDrivePullRequest(), protocolVersion: CONNECTION_PROTOCOL_VERSION + 1 })).toBe(false);
    // A push with no payload, or a non-string one, must not reach Drive.
    expect(isDriveSyncRequest({ type: "MAI_SCORE_DRIVE_PUSH", protocolVersion: CONNECTION_PROTOCOL_VERSION })).toBe(false);
    expect(isDriveSyncRequest({ type: "MAI_SCORE_DRIVE_PUSH", protocolVersion: CONNECTION_PROTOCOL_VERSION, payload: { a: 1 } })).toBe(false);
  });

  it("does not confuse a Studio import request for a sync request", () => {
    expect(isDriveSyncRequest({ type: "MAI_SCORE_STUDIO_IMPORT", protocolVersion: CONNECTION_PROTOCOL_VERSION, token: "x" })).toBe(false);
  });

  it("refuses an oversized payload before any network call", () => {
    const tooBig = "x".repeat(MAX_SYNC_PAYLOAD_BYTES + 1);
    expect(isDriveSyncRequest(createDrivePushRequest(tooBig))).toBe(false);
    expect(isDriveSyncRequest(createDrivePushRequest("x".repeat(MAX_SYNC_PAYLOAD_BYTES)))).toBe(true);
  });

  it("measures the payload in bytes, not characters", () => {
    // Song titles are routinely CJK; a character-count limit would let a
    // payload roughly three times the intended size through.
    expect(payloadBytes("abc")).toBe(3);
    expect(payloadBytes("宴会場")).toBe(9);

    const justOverInBytes = "宴".repeat(Math.floor(MAX_SYNC_PAYLOAD_BYTES / 3) + 1);
    expect(justOverInBytes.length).toBeLessThan(MAX_SYNC_PAYLOAD_BYTES);
    expect(isDriveSyncRequest(createDrivePushRequest(justOverInBytes))).toBe(false);
  });
});

const response = (body: unknown, text?: string, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => text ?? JSON.stringify(body)
}) as unknown as Response;

const listing = (files: unknown[]) => response({ files });

const contextWith = (fetchMock: ReturnType<typeof vi.fn>) =>
  ({ token: "t", fetch: fetchMock as unknown as typeof globalThis.fetch });

describe("performDriveSync", () => {
  it("treats an empty app-data folder as a normal first pull, not an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(listing([]));
    expect(await performDriveSync(contextWith(fetchMock), createDrivePullRequest())).toEqual({ ok: true });
    // Nothing to download, so no second call should have been attempted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the stored document and its timestamp on pull", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(listing([{ id: "f1", name: DRIVE_HISTORY_FILE, modifiedTime: "2026-07-29T00:00:00.000Z" }]))
      .mockResolvedValueOnce(response({}, '{"entries":[1]}'));

    expect(await performDriveSync(contextWith(fetchMock), createDrivePullRequest())).toEqual({
      ok: true,
      payload: '{"entries":[1]}',
      modifiedTime: "2026-07-29T00:00:00.000Z"
    });
  });

  it("creates the document on first push and updates it thereafter", async () => {
    const first = vi.fn()
      .mockResolvedValueOnce(listing([]))
      .mockResolvedValueOnce(response({ id: "new", name: DRIVE_HISTORY_FILE }));
    await performDriveSync(contextWith(first), createDrivePushRequest("{}"));
    expect(first.mock.calls[1][1].method).toBe("POST");

    const again = vi.fn()
      .mockResolvedValueOnce(listing([{ id: "existing", name: DRIVE_HISTORY_FILE }]))
      .mockResolvedValueOnce(response({ id: "existing", name: DRIVE_HISTORY_FILE }));
    await performDriveSync(contextWith(again), createDrivePushRequest("{}"));
    expect(again.mock.calls[1][1].method).toBe("PATCH");
    // Updating in place is what stops every push adding another copy.
    expect(again.mock.calls[1][0]).toContain("existing");
  });

  it("reports a revoked grant as needs-auth so Studio can send the user to the popup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({}, "", 401));
    expect(await performDriveSync(contextWith(fetchMock), createDrivePullRequest()))
      .toEqual({ ok: false, reason: "needs-auth" });
  });

  it("reports other failures as errors, keeping them distinct from needs-auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({}, "backend hiccup", 500));
    const result = await performDriveSync(contextWith(fetchMock), createDrivePullRequest());
    expect(result).toMatchObject({ ok: false, reason: "error" });
    expect(result).not.toMatchObject({ reason: "needs-auth" });
  });
});
