import { beforeEach, describe, expect, it, vi } from "vitest";

// drive-provider decides which of two OAuth-backed implementations handles
// every sync call, using module-level state set by driveConnectionStatus.
// Mock both sides so the dispatch itself is what is under test.
const extension = {
  driveConnectionStatus: vi.fn(),
  pullFromDrive: vi.fn(),
  pushToDrive: vi.fn(),
  deleteFromDrive: vi.fn(),
  disconnectGoogleDrive: vi.fn()
};

const web = {
  configured: vi.fn(),
  connectionStatus: vi.fn(),
  connect: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  delete: vi.fn(),
  disconnect: vi.fn()
};

vi.mock("../studio/lib/drive-client", () => ({
  driveConnectionStatus: (...args: unknown[]) => extension.driveConnectionStatus(...args),
  pullFromDrive: (...args: unknown[]) => extension.pullFromDrive(...args),
  pushToDrive: (...args: unknown[]) => extension.pushToDrive(...args),
  deleteFromDrive: (...args: unknown[]) => extension.deleteFromDrive(...args),
  disconnectGoogleDrive: (...args: unknown[]) => extension.disconnectGoogleDrive(...args),
  driveAuthorizationUrl: () => "https://example.invalid/auth",
  rememberExtensionId: () => {}
}));

vi.mock("../studio/lib/google-drive-web", () => ({
  webGoogleDrive: {
    configured: (...args: unknown[]) => web.configured(...args),
    connectionStatus: (...args: unknown[]) => web.connectionStatus(...args),
    connect: (...args: unknown[]) => web.connect(...args),
    pull: (...args: unknown[]) => web.pull(...args),
    push: (...args: unknown[]) => web.push(...args),
    delete: (...args: unknown[]) => web.delete(...args),
    disconnect: (...args: unknown[]) => web.disconnect(...args)
  }
}));

async function freshProvider() {
  // Reset the module so activeProvider starts undefined, as on a page load.
  vi.resetModules();
  return import("../studio/lib/drive-provider");
}

const connected = { ok: true as const, connected: true };
const disconnected = { ok: true as const, connected: false };
const noExtension = { ok: false as const, reason: "no-extension" as const };

beforeEach(() => {
  for (const fn of [...Object.values(extension), ...Object.values(web)]) fn.mockReset();
  web.configured.mockReturnValue(false);
  web.connectionStatus.mockReturnValue(disconnected);
  extension.driveConnectionStatus.mockResolvedValue(disconnected);
});

describe("choosing a provider", () => {
  it("prefers the extension when it holds a live grant", async () => {
    const provider = await freshProvider();
    extension.driveConnectionStatus.mockResolvedValue(connected);
    web.configured.mockReturnValue(true);
    web.connectionStatus.mockReturnValue(connected);

    expect(await provider.driveConnectionStatus()).toEqual(connected);

    extension.pullFromDrive.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    expect(extension.pullFromDrive).toHaveBeenCalled();
    expect(web.pull).not.toHaveBeenCalled();
  });

  it("falls back to web when the extension has no grant", async () => {
    const provider = await freshProvider();
    web.configured.mockReturnValue(true);
    web.connectionStatus.mockReturnValue(connected);

    expect(await provider.driveConnectionStatus()).toEqual(connected);

    web.pull.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    expect(web.pull).toHaveBeenCalled();
    expect(extension.pullFromDrive).not.toHaveBeenCalled();
  });

  it("reports a plain disconnected state when web is configured but unconnected", async () => {
    // Mobile and extension-free browsers are valid disconnected clients, not
    // an "extension unavailable" dead end.
    const provider = await freshProvider();
    extension.driveConnectionStatus.mockResolvedValue(noExtension);
    web.configured.mockReturnValue(true);

    expect(await provider.driveConnectionStatus()).toEqual(disconnected);
  });

  it("surfaces the extension failure when web is not configured", async () => {
    const provider = await freshProvider();
    extension.driveConnectionStatus.mockResolvedValue(noExtension);
    web.configured.mockReturnValue(false);

    expect(await provider.driveConnectionStatus()).toEqual(noExtension);
  });
});

describe("dispatching sync calls", () => {
  it("routes every operation to the same provider the status resolved to", async () => {
    const provider = await freshProvider();
    web.configured.mockReturnValue(true);
    web.connectionStatus.mockReturnValue(connected);
    await provider.driveConnectionStatus();

    web.pull.mockResolvedValue({ ok: true });
    web.push.mockResolvedValue({ ok: true });
    web.delete.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    await provider.pushToDrive("{}");
    await provider.deleteFromDrive();

    expect([web.pull, web.push, web.delete].every((fn) => fn.mock.calls.length === 1)).toBe(true);
    expect(extension.pullFromDrive).not.toHaveBeenCalled();
    expect(extension.pushToDrive).not.toHaveBeenCalled();
    expect(extension.deleteFromDrive).not.toHaveBeenCalled();
  });

  it("passes the payload through unchanged on push", async () => {
    const provider = await freshProvider();
    extension.driveConnectionStatus.mockResolvedValue(connected);
    await provider.driveConnectionStatus();

    extension.pushToDrive.mockResolvedValue({ ok: true });
    await provider.pushToDrive('{"entries":[1]}');
    expect(extension.pushToDrive).toHaveBeenCalledWith('{"entries":[1]}');
  });

  it("defaults to the extension before any status call has run", async () => {
    // Studio gates the Sync control behind a resolved status, so this is not
    // reachable today — pinned because the fallback is silent, and a future
    // caller reaching these directly would otherwise pick a provider by
    // accident rather than by decision.
    const provider = await freshProvider();
    extension.pullFromDrive.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    expect(extension.pullFromDrive).toHaveBeenCalled();
    expect(web.pull).not.toHaveBeenCalled();
  });
});

describe("connecting and disconnecting", () => {
  it("makes web the active provider after a successful web connect", async () => {
    const provider = await freshProvider();
    web.connect.mockResolvedValue(connected);
    await provider.connectGoogleDriveWeb();

    web.push.mockResolvedValue({ ok: true });
    await provider.pushToDrive("{}");
    expect(web.push).toHaveBeenCalled();
  });

  it("leaves the provider unset when a web connect fails", async () => {
    const provider = await freshProvider();
    web.connect.mockResolvedValue({ ok: false, reason: "needs-auth" });
    await provider.connectGoogleDriveWeb();

    extension.pullFromDrive.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    expect(web.pull).not.toHaveBeenCalled();
  });

  it("clears the active provider on disconnect, so the next call re-resolves", async () => {
    const provider = await freshProvider();
    web.configured.mockReturnValue(true);
    web.connectionStatus.mockReturnValue(connected);
    await provider.driveConnectionStatus();

    web.disconnect.mockResolvedValue(disconnected);
    await provider.disconnectGoogleDrive();

    // Without the reset this would still be routed to web after disconnecting.
    extension.pullFromDrive.mockResolvedValue({ ok: true });
    await provider.pullFromDrive();
    expect(extension.pullFromDrive).toHaveBeenCalled();
    expect(web.pull).not.toHaveBeenCalled();
  });

  it("disconnects through whichever provider was active", async () => {
    const provider = await freshProvider();
    extension.driveConnectionStatus.mockResolvedValue(connected);
    await provider.driveConnectionStatus();

    extension.disconnectGoogleDrive.mockResolvedValue(disconnected);
    await provider.disconnectGoogleDrive();
    expect(extension.disconnectGoogleDrive).toHaveBeenCalled();
    expect(web.disconnect).not.toHaveBeenCalled();
  });
});
