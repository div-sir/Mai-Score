import { describe, expect, it, vi } from "vitest";
import {
  DRIVE_ENABLED_STORAGE_KEY,
  REVOKE_ENDPOINT,
  connectDrive,
  disconnectDrive,
  driveConnection,
  driveEnabled,
  setDriveEnabled,
  type AuthDeps,
  type IdentityApi
} from "../src/lib/drive-auth";

function identityWith(tokens: Array<string | undefined>) {
  const removed: string[] = [];
  const calls: boolean[] = [];
  let clearAllCalls = 0;
  const identity: IdentityApi = {
    getAuthToken: ({ interactive }, cb) => {
      calls.push(interactive);
      cb(tokens.shift());
    },
    removeCachedAuthToken: ({ token }, cb) => {
      removed.push(token);
      cb();
    },
    clearAllCachedAuthTokens: (cb) => {
      clearAllCalls += 1;
      cb();
    }
  };
  return { identity, removed, calls, get clearAllCalls() { return clearAllCalls; } };
}

const depsWith = (identity: IdentityApi, fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)): AuthDeps =>
  ({ identity, fetch: fetchMock as unknown as typeof globalThis.fetch });

describe("Drive connection state", () => {
  it("reports connected only when a token comes back without prompting", async () => {
    const granted = identityWith(["token"]);
    expect(await driveConnection(depsWith(granted.identity))).toBe("connected");
    expect(granted.calls).toEqual([false]);

    const denied = identityWith([undefined]);
    expect(await driveConnection(depsWith(denied.identity))).toBe("disconnected");
  });

  it("treats an empty-string token as no token", async () => {
    const blank = identityWith([""]);
    expect(await driveConnection(depsWith(blank.identity))).toBe("disconnected");
  });

  it("clears Chrome's pending error so it is not reported against a later call", async () => {
    const clearLastError = vi.fn();
    const { identity } = identityWith([undefined]);
    await driveConnection({ identity, fetch: vi.fn() as unknown as typeof globalThis.fetch, clearLastError });
    expect(clearLastError).toHaveBeenCalled();
  });
});

describe("connecting", () => {
  it("prompts interactively and succeeds when consent is given", async () => {
    const { identity, calls } = identityWith(["token"]);
    expect(await connectDrive(depsWith(identity))).toEqual({ ok: true });
    expect(calls).toEqual([true]);
  });

  it("treats a refused or closed consent window as cancelled, not a failure", async () => {
    const { identity } = identityWith([undefined]);
    expect(await connectDrive(depsWith(identity))).toEqual({ ok: false, error: "cancelled" });
  });
});

describe("disconnecting", () => {
  it("revokes at Google and clears all Chrome Identity state", async () => {
    const state = identityWith(["token"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    await disconnectDrive(depsWith(state.identity, fetchMock));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${REVOKE_ENDPOINT}?token=token`);
    expect(init).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    expect(state.clearAllCalls).toBe(1);
  });

  it("reports a failed Google revoke but still clears local identity state", async () => {
    const state = identityWith(["token"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response);
    await expect(disconnectDrive(depsWith(state.identity, fetchMock)))
      .rejects.toThrow("Google authorization revocation failed (400).");
    expect(state.clearAllCalls).toBe(1);
  });

  it("reports a network failure but still clears local identity state", async () => {
    const state = identityWith(["token"]);
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(disconnectDrive(depsWith(state.identity, fetchMock))).rejects.toThrow("offline");
    expect(state.clearAllCalls).toBe(1);
  });

  it("clears Chrome Identity state even when there was no grant", async () => {
    const state = identityWith([undefined]);
    const fetchMock = vi.fn();
    await disconnectDrive(depsWith(state.identity, fetchMock));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.clearAllCalls).toBe(1);
  });

  it("percent-encodes the token so an odd character cannot break the URL", async () => {
    const state = identityWith(["a/b+c=d"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    await disconnectDrive(depsWith(state.identity, fetchMock));
    expect(fetchMock.mock.calls[0][0]).toBe(`${REVOKE_ENDPOINT}?token=a%2Fb%2Bc%3Dd`);
  });
});


describe("Drive enablement preference", () => {
  function preferenceStorage(initial: unknown = undefined) {
    const values: Record<string, unknown> = {};
    if (initial !== undefined) values[DRIVE_ENABLED_STORAGE_KEY] = initial;
    return {
      values,
      storage: {
        get: vi.fn(async (key: string) => ({ [key]: values[key] })),
        set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(values, items); })
      }
    };
  }

  it("defaults to disabled until the user explicitly connects", async () => {
    const state = preferenceStorage();
    expect(await driveEnabled(state.storage)).toBe(false);
  });

  it("persists connect and disconnect choices", async () => {
    const state = preferenceStorage();
    await setDriveEnabled(state.storage, true);
    expect(await driveEnabled(state.storage)).toBe(true);
    await setDriveEnabled(state.storage, false);
    expect(await driveEnabled(state.storage)).toBe(false);
    expect(state.values[DRIVE_ENABLED_STORAGE_KEY]).toBe(false);
  });

  it("does not treat truthy legacy values as explicit consent", async () => {
    const state = preferenceStorage("true");
    expect(await driveEnabled(state.storage)).toBe(false);
  });
});
