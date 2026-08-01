import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CONNECTIONS } from "../src/lib/connections";

// Chrome derives an unpacked extension's ID from the SHA-256 of this DER
// public key, mapping each hex nibble to a-p. Pinned so Load-unpacked keeps
// producing the same ID (needed for the OAuth client registered against it)
// instead of one that depends on the machine's checkout path.
function extensionIdFromKey(base64Key: string): string {
  const digest = createHash("sha256").update(Buffer.from(base64Key, "base64")).digest("hex");
  return [...digest.slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

describe("extension package", () => {
  it("registers the background resolver", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.externally_connectable.matches).toEqual([
      "https://mai-score.milifix.com/*"
    ]);
    expect(manifest.web_accessible_resources).toEqual([
      {
        resources: ["drive-auth.html", "drive-auth.css", "drive-auth.js"],
        matches: ["https://mai-score.milifix.com/*"]
      }
    ]);
    const authPage = await readFile("public/drive-auth.html", "utf8");
    expect(authPage).toContain('src="drive-auth.js"');
  });

  it("keeps the unpacked extension ID pinned for local OAuth testing", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    expect(typeof manifest.key).toBe("string");
    expect(extensionIdFromKey(manifest.key)).toBe("bkdgjhjohcohclggjadimcamjcacfjpk");
  });

  it("requests only the Drive app-data scope, not full Drive access", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    expect(manifest.permissions).toContain("identity");
    expect(manifest.oauth2.client_id).toMatch(/^\d+-[0-9a-z]+\.apps\.googleusercontent\.com$/);
    // drive.appdata is the least-privilege scope: it can only see files this
    // app itself created, hidden from the user's own Drive view. The full
    // "drive" or "drive.file" scopes are broader than history sync needs.
    expect(manifest.oauth2.scopes).toEqual(["https://www.googleapis.com/auth/drive.appdata"]);
  });

  it("declares PNG icons at every size the Web Store requires", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    const sizes = ["16", "32", "48", "128"];
    expect(Object.keys(manifest.icons).sort()).toEqual([...sizes].sort());
    expect(Object.keys(manifest.action.default_icon).sort()).toEqual([...sizes].sort());

    for (const size of sizes) {
      const path = manifest.icons[size];
      expect(path).toBe(`icons/icon${size}.png`);
      // Chrome rejects SVG here, so assert the shipped file really is a PNG.
      const header = await readFile(`public/${path}`);
      expect(header.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
  });

  it("grants a host permission and content script for every active DX NET region", async () => {
    // connections.ts and manifest.json name the same hosts independently —
    // nothing generates one from the other — so a region added to one and
    // forgotten in the other would inject on the wrong pages or, worse,
    // silently lack the permission to read them at all.
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    const activeMatches = CONNECTIONS
      .filter((connection) => connection.status === "active" && connection.transport === "content-script")
      .flatMap((connection) => connection.matches);

    expect(activeMatches.length).toBeGreaterThan(0);
    for (const prefix of activeMatches) {
      const wildcard = `${prefix}*`;
      expect(manifest.host_permissions).toContain(wildcard);
      expect(manifest.content_scripts[0].matches).toContain(wildcard);
    }
  });

  it("grants host permissions for every Google endpoint the code calls", async () => {
    // Without these, MV3 treats the Drive and revoke calls as ordinary
    // cross-origin requests and CORS can block them — the whole sync feature
    // fails at runtime while every unit test still passes.
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    const [{ DRIVE_FILES_API, DRIVE_UPLOAD_API }, { REVOKE_ENDPOINT }] = await Promise.all([
      import("../src/lib/drive-appdata"),
      import("../src/lib/drive-auth")
    ]);

    for (const endpoint of [DRIVE_FILES_API, DRIVE_UPLOAD_API, REVOKE_ENDPOINT]) {
      const origin = new URL(endpoint).origin;
      const covered = (manifest.host_permissions as string[]).some((pattern) => pattern.startsWith(`${origin}/`));
      expect(covered, `${origin} is fetched but not in host_permissions`).toBe(true);
    }
  });

  it("contains a valid international chart database", async () => {
    const compressed = await readFile("public/data/sheets.json.gz");
    const sheets = JSON.parse(gunzipSync(compressed).toString("utf8"));
    expect(sheets.length).toBeGreaterThan(5000);
    expect(sheets[0]).toMatchObject({
      sheetId: expect.stringContaining("__dxrt__"),
      internalLevelValue: expect.any(Number)
    });
  });
});
