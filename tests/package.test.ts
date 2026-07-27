import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

describe("extension package", () => {
  it("registers the background resolver", async () => {
    const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
    expect(manifest.version).toBe("0.2.0");
    expect(manifest.background.service_worker).toBe("background.js");
    expect(manifest.permissions).toContain("storage");
    expect(manifest.web_accessible_resources).toBeUndefined();
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
