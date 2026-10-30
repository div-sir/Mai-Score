import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir(new URL("../public/collector/", import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL("../collector/bookmarklet.ts", import.meta.url).pathname],
  outfile: new URL("../public/collector/v0.1.0.js", import.meta.url).pathname,
  bundle: true,
  minify: true,
  target: ["safari16.4", "chrome120"],
  format: "iife",
  legalComments: "none"
});
