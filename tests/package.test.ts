import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CONNECTIONS } from "../src/lib/connections";

describe("extension package", () => {
  it("registers the background resolver", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    expect(manifest.version).toBe("0.5.0");
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.externally_connectable.matches).toEqual([
      "https://mai-score.milifix.com/*"
    ]);
    expect(manifest.web_accessible_resources).toBeUndefined();
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
