import { describe, expect, it, vi } from "vitest";
import {
  REVOKE_ENDPOINT,
  connectDrive,
  disconnectDrive,
  driveConnection,
  type AuthDeps,
  type IdentityApi
} from "../src/lib/drive-auth";

function identityWith(tokens: Array<string | undefined>) {
  const removed: string[] = [];
  const calls: boolean[] = [];
  const identity: IdentityApi = {
    getAuthToken: ({ interactive }, cb) => {
      calls.push(interactive);
      cb(tokens.shift());
    },
    removeCachedAuthToken: ({ token }, cb) => {
      removed.push(token);
      cb();
    }
  };
  return { identity, removed, calls };
}

const depsWith = (identity: IdentityApi, fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response)): AuthDeps =>
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
  it("revokes at Google and then drops the cached token", async () => {
    const { identity, removed } = identityWith(["token"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    await disconnectDrive(depsWith(identity, fetchMock));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${REVOKE_ENDPOINT}?token=token`);
    expect(init.method).toBe("POST");
    // Cache-only removal would leave the grant live on the account.
    expect(removed).toEqual(["token"]);
  });

  it("still drops the local token when the revoke call fails", async () => {
    // Leaving a usable cached credential behind after the user asked to
    // disconnect is worse than a revoke that did not reach Google.
    const { identity, removed } = identityWith(["token"]);
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(disconnectDrive(depsWith(identity, fetchMock))).resolves.toBeUndefined();
    expect(removed).toEqual(["token"]);
  });

  it("does nothing when there was no grant to begin with", async () => {
    const { identity, removed } = identityWith([undefined]);
    const fetchMock = vi.fn();
    await disconnectDrive(depsWith(identity, fetchMock));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it("percent-encodes the token so an odd character cannot break the URL", async () => {
    const { identity } = identityWith(["a/b+c=d"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    await disconnectDrive(depsWith(identity, fetchMock));
    expect(fetchMock.mock.calls[0][0]).toBe(`${REVOKE_ENDPOINT}?token=a%2Fb%2Bc%3Dd`);
  });
});
