import { readFile, writeFile } from "node:fs/promises";

const PRODUCTION_STUDIO = "https://mai-score.milifix.com";
const previewOrigin = process.argv[2];

if (!previewOrigin || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(previewOrigin)) {
  throw new Error("Pass one exact https://<deployment>.vercel.app origin.");
}

const manifestPath = "dist/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const matches = new Set(manifest.externally_connectable?.matches ?? []);
matches.add(`${previewOrigin}/*`);
manifest.externally_connectable = { ...manifest.externally_connectable, matches: [...matches] };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

let replacements = 0;
for (const path of ["dist/background.js", "dist/popup.js"]) {
  const source = await readFile(path, "utf8");
  const occurrences = source.split(PRODUCTION_STUDIO).length - 1;
  if (occurrences === 0) throw new Error(`${path} does not contain the production Studio origin.`);
  replacements += occurrences;
  await writeFile(path, source.split(PRODUCTION_STUDIO).join(previewOrigin));
}

await writeFile(
  "dist/PREVIEW_BUILD.txt",
  [
    "Mai-Score preview testing build",
    `Studio origin: ${previewOrigin}`,
    "Not for release or Chrome Web Store submission.",
    "The production source manifest remains restricted to mai-score.milifix.com.",
    ""
  ].join("\n")
);

console.log(`Prepared preview build for ${previewOrigin}; replaced ${replacements} bundled origin reference(s).`);
