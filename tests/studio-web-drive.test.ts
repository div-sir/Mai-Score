import { describe, expect, it, vi } from "vitest";
import {
  GOOGLE_DRIVE_APPDATA_SCOPE,
  WebGoogleDriveClient
} from "../studio/lib/google-drive-web";

function connectedClient(options: {
  now?: () => number;
  fetch?: typeof globalThis.fetch;
} = {}) {
  let callback: ((response: {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  }) => void) | undefined;
  const requestAccessToken = vi.fn();
  const revoke = vi.fn((_token: string, done: (result: { successful: boolean }) => void) => {
    done({ successful: true });
  });
  const oauth = {
    initTokenClient: vi.fn((config: { callback: typeof callback }) => {
      callback = config.callback;
      return { requestAccessToken };
    }),
    revoke
  };
  const fetchMock = options.fetch ?? vi.fn();
  const client = new WebGoogleDriveClient({
    clientId: "web-client.apps.googleusercontent.com",
    fetch: fetchMock,
    oauth: () => oauth,
    now: options.now,
    randomUUID: () => "test-boundary"
  });

  const connect = async () => {
    const pending = client.connect();
    callback?.({
      access_token: "access-token",
      expires_in: 3600,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE
    });
    expect(await pending).toEqual({ ok: true, connected: true });
  };

  return { client, connect, fetchMock, oauth, requestAccessToken, revoke };
}

describe("Studio web Google Drive client", () => {
  it("requires a configured Web OAuth client", async () => {
    const client = new WebGoogleDriveClient({
      clientId: "",
      fetch: vi.fn(),
      oauth: () => undefined
    });

    expect(client.configured()).toBe(false);
    expect(await client.connect()).toEqual({
      ok: false,
      reason: "error",
      error: "Google Drive web sync is not configured."
    });
  });

  it("uses an explicit account chooser and keeps the grant in memory", async () => {
    const fixture = connectedClient();
    await fixture.connect();

    expect(fixture.oauth.initTokenClient).toHaveBeenCalledWith(expect.objectContaining({
      client_id: "web-client.apps.googleusercontent.com",
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      include_granted_scopes: false,
      prompt: "select_account"
    }));
    expect(fixture.requestAccessToken).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(fixture.client.connectionStatus()).toEqual({ ok: true, connected: true });
  });

  it("pulls the same appDataFolder history file used by the extension", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        files: [{ id: "history-file", name: "mai-score-history.json", modifiedTime: "2026-07-31T00:00:00Z" }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{\"schema\":\"mai-score/history-sync/v1\",\"entries\":[]}", { status: 200 }));
    const fixture = connectedClient({ fetch: fetchMock as typeof globalThis.fetch });
    await fixture.connect();

    expect(await fixture.client.pull()).toEqual({
      ok: true,
      payload: "{\"schema\":\"mai-score/history-sync/v1\",\"entries\":[]}",
      modifiedTime: "2026-07-31T00:00:00Z"
    });
    expect(fetchMock.mock.calls[0][0]).toContain("spaces=appDataFolder");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { authorization: "Bearer access-token" }
    });
  });

  it("creates a bounded history file in appDataFolder", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "new-file",
        name: "mai-score-history.json",
        modifiedTime: "2026-07-31T01:00:00Z"
      }), { status: 200 }));
    const fixture = connectedClient({ fetch: fetchMock as typeof globalThis.fetch });
    await fixture.connect();

    expect(await fixture.client.push("{\"entries\":[]}")).toEqual({
      ok: true,
      modifiedTime: "2026-07-31T01:00:00Z"
    });
    const [, request] = fetchMock.mock.calls[1];
    expect(request.method).toBe("POST");
    expect(String(request.body)).toContain("\"parents\":[\"appDataFolder\"]");
    expect(String(request.body)).toContain("{\"entries\":[]}");
  });

  it("expires the in-memory token and asks for another user gesture", async () => {
    let now = 1_000;
    const fixture = connectedClient({ now: () => now });
    await fixture.connect();
    now += 3_700_000;

    expect(fixture.client.connectionStatus()).toEqual({ ok: true, connected: false });
    expect(await fixture.client.pull()).toEqual({ ok: false, reason: "needs-auth" });
  });

  it("revokes the web grant without touching cloud or local history", async () => {
    const fixture = connectedClient();
    await fixture.connect();

    expect(await fixture.client.disconnect()).toEqual({ ok: true, connected: false });
    expect(fixture.revoke).toHaveBeenCalledWith("access-token", expect.any(Function));
    expect(fixture.client.connectionStatus()).toEqual({ ok: true, connected: false });
  });
});
