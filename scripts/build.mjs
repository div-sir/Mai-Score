import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

await build({
  entryPoints: ["src/content.ts", "src/popup.ts"],
  outdir: "dist",
  bundle: true,
  minify: true,
  sourcemap: true,
  target: "chrome120",
  format: "iife",
  logLevel: "info"
});
