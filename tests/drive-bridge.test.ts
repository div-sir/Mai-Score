import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDriveDisconnectRequest,
  createDriveStatusRequest,
  isDriveBridgeRequest,
  performDriveBridgeRequest
} from "../src/lib/drive-bridge";
import {
  DRIVE_ENABLED_STORAGE_KEY,
  type AuthDeps,
  type DrivePreferenceStorage,
  type IdentityApi
} from "../src/lib/drive-auth";
import {
  driveAuthorizationUrl,
  OFFICIAL_EXTENSION_ID,
  rememberExtensionId
} from "../studio/lib/drive-client";

function storageWith(enabled: boolean): {
  values: Record<string, unknown>;
  storage: DrivePreferenceStorage;
} {
  const values: Record<string, unknown> = { [DRIVE_ENABLED_STORAGE_KEY]: enabled };
  return {
    values,
    storage: {
      get: vi.fn(async (key: string) => ({ [key]: values[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(values, items); })
    }
  };
}

function authWith(token?: string, fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)) {
  const interactive: boolean[] = [];
  let clearCalls = 0;
  const identity: IdentityApi = {
    getAuthToken: (details, callback) => {
      interactive.push(details.interactive);
      callback(token);
    },
    removeCachedAuthToken: (_details, callback) => callback(),
    clearAllCachedAuthTokens: (callback) => {
      clearCalls += 1;
      callback();
    }
  };
  const auth: AuthDeps = {
    identity,
    fetch: fetchMock as unknown as typeof globalThis.fetch
  };
  return { auth, interactive, get clearCalls() { return clearCalls; } };
}

describe("Studio Drive bridge", () => {
  it("accepts only versioned status and disconnect requests", () => {
    expect(isDriveBridgeRequest(createDriveStatusRequest())).toBe(true);
    expect(isDriveBridgeRequest(createDriveDisconnectRequest())).toBe(true);
    expect(isDriveBridgeRequest({ type: "MAI_SCORE_DRIVE_STATUS", protocolVersion: 999 })).toBe(false);
    expect(isDriveBridgeRequest({ type: "MAI_SCORE_DRIVE_CONNECT", protocolVersion: 1 })).toBe(false);
    expect(isDriveBridgeRequest(null)).toBe(false);
  });

  it("does not silently acquire a token when Drive is explicitly disabled", async () => {
    const state = storageWith(false);
    const auth = authWith("cached-token");
    expect(await performDriveBridgeRequest(
      { storage: state.storage, auth: auth.auth },
      createDriveStatusRequest()
    )).toEqual({ ok: true, connected: false });
    expect(auth.interactive).toEqual([]);
  });

  it("reports an enabled cached grant without opening consent", async () => {
    const state = storageWith(true);
    const auth = authWith("cached-token");
    expect(await performDriveBridgeRequest(
      { storage: state.storage, auth: auth.auth },
      createDriveStatusRequest()
    )).toEqual({ ok: true, connected: true });
    expect(auth.interactive).toEqual([false]);
  });

  it("disconnects locally even when Google revocation fails", async () => {
    const state = storageWith(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response);
    const auth = authWith("cached-token", fetchMock);
    const result = await performDriveBridgeRequest(
      { storage: state.storage, auth: auth.auth },
      createDriveDisconnectRequest()
    );

    expect(result).toMatchObject({ ok: true, connected: false });
    expect(result).toHaveProperty("warning");
    expect(state.values[DRIVE_ENABLED_STORAGE_KEY]).toBe(false);
    expect(auth.clearCalls).toBe(1);
  });
});

describe("Studio authorization URL", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the pinned official extension ID on a direct Studio visit", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });

    expect(driveAuthorizationUrl("en")).toBe(
      `chrome-extension://${OFFICIAL_EXTENSION_ID}/drive-auth.html?lang=en`
    );
  });

  it("opens a remembered valid extension ID and carries the UI language", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });

    rememberExtensionId("bkdgjhjohcohclggjadimcamjcacfjpk");
    expect(driveAuthorizationUrl("zh-Hant")).toBe(
      "chrome-extension://bkdgjhjohcohclggjadimcamjcacfjpk/drive-auth.html?lang=zh-Hant"
    );
  });

  it("falls back to the official extension ID after malformed stored data", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });

    rememberExtensionId("../../not-an-extension");
    expect(driveAuthorizationUrl("en")).toBe(
      `chrome-extension://${OFFICIAL_EXTENSION_ID}/drive-auth.html?lang=en`
    );
  });
});
