# Mai-Score

Mai-Score is a privacy-first Chrome/Edge extension for the **maimai DX International** version. It reads the official Best 50 page, calculates each chart's rating, and exports a B50 image or JSON.

## Install

1. Download the latest `mai-score-vX.Y.Z.zip` from [Releases](https://github.com/div-sir/Mai-Score/releases).
2. Unzip it.
3. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the unzipped folder.
4. Log in to [maimai DX NET International](https://maimaidx-eng.com/maimai-mobile/home/).

Building from source instead? See [Development](#development).

## Features

- Reads B15 + B35 from the official `ratingTargetMusic` page.
- Reads only the first two official target sections (New B15 and Old B35); rating candidates are excluded from the total.
- Calculates chart rating from international internal levels.
- Captures player name, title, icon, equipped frame, course rank, class rank, stars, and official rating where available.
- Exports dxrating-compatible JSON: `[{ "sheetId", "achievementRate" }]`.
- Exports a richer `mai-score/v1` JSON document and a cross-game `mai-score/rhythm-record/v1` document.
- Generates PNG locally with Night, Light, and maimai themes.
- Provides Classic 5×10, Compact 5×10, and Landscape 10×5 image templates.
- Separates New B15 and Old B35 into labeled image regions with chart counts and subtotals.
- Supports English (default), 繁體中文 (Traditional Chinese), and 日本語 (Japanese) — switch anytime from the language picker at the top of the popup; the choice also carries over to Studio, timestamps, and exported image labels.
- Keeps image choices for timestamp, timezone, watermark, accent color, assets, and score fields in the Studio.
- Uses a simple primary flow: collect B50, then open [Mai-Score Studio](https://mai-score.milifix.com) with the result already loaded.
- Keeps quick PNG and JSON downloads under a secondary direct-export selector.
- Uses a versioned connection registry so future file/API/site adapters can share the same popup and export pipeline.
- Does not transmit login details or score data to a third-party server.

## Usage

1. Log in to [maimai DX NET International](https://maimaidx-eng.com/maimai-mobile/home/) in the same browser.
2. Click the Mai-Score icon in the toolbar. If needed, pick your language from the dropdown at the top (**English**, **繁體中文**, or **日本語**) — this also carries over to Studio and exported images.
3. Click **Collect B50**. The popup fetches your profile and rating-target page and shows your official rating, B50 total, and how many charts resolved against the local chart database.
4. Choose how to use the result:
   - **Preview and customize online** opens [Mai-Score Studio](https://mai-score.milifix.com) with the result already loaded, for choosing a layout/theme and exporting PNG or SVG.
   - **Direct export** (collapsed section below the buttons) downloads a quick PNG in the default style, or JSON in the dxrating, Mai-Score full, or Rhythm Record format, without leaving the popup.

Nothing is sent anywhere in this flow except the one-time, five-minute Studio transfer token described below — your login and score data stay in the browser unless you explicitly export a file.

## Data and compatibility

The compact international chart dataset is generated from [gekichumai/dxrating](https://github.com/gekichumai/dxrating) `dxdata`, which is itself based on data from [zetaraku/arcade-songs](https://github.com/zetaraku/arcade-songs). Run `npm run sync-data` after game/data updates. Sheet IDs use dxrating's canonical `songId__dxrt__type__dxrt__difficulty` format. See [`public/THIRD_PARTY_NOTICES.md`](public/THIRD_PARTY_NOTICES.md) for both projects' MIT license text, reproduced as required by that license and shipped in every build under `THIRD_PARTY_NOTICES.md`.

The exporter intentionally uses the official Rating Target page's first 15 / remaining 35 ordering. Unmatched charts remain in the full JSON and image with a warning, but are omitted from dxrating JSON.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run sync-data
npm test
npm run typecheck
npm run build
```

`npm run build` writes the unpacked extension to `dist/` — open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select that directory.

### Releases

Pushing a tag matching `v*` (e.g. `v0.5.0`) runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds the extension, zips `dist/`, and publishes it as a GitHub Release asset.

### Automatic Studio handoff in v0.5.0

After collection, choose **Preview and customize online**. The extension stores the result behind a random, single-use transfer token for up to five minutes, opens Studio with the token and extension ID in the URL fragment, and removes the staged result as soon as Studio receives it. The score document is not placed in the URL or sent to the Studio server.

The handoff also embeds the equipped frame, icon, and resolved song covers as image data. This lets the browser preview and PNG export render authenticated DX NET assets without uploading them or depending on cross-origin image requests.

Studio is public at `mai-score.milifix.com` and does not require an account. After a successful transfer or JSON import, the latest B50 and its images are stored in that browser's IndexedDB so the preview can be restored later. Style preferences are stored separately in localStorage. No server-side score database is used, and the saved local copy can be cleared from Studio.

Version 0.4.0 fixes inflated B50 totals caused by accidentally including the two candidate sections found after the official New B15 and Old B35 sections. Both the extension and Studio now enforce exactly 15 new charts and 35 old charts, then recompute all three totals from those displayed records.

Studio is intentionally a compact preview tool: data controls, style controls, the live B50 preview, and PNG/SVG export. Quick PNG and dxrating/full/Rhythm Record JSON remain available under **Direct export** in the popup.

The first connection adapter is `dxnet-intl`. Future sources can register a new connection ID, game ID, transport, URL matcher, and capabilities without changing the shared Rhythm Record or image pipelines.

See [Mobile use](docs/mobile.md), [Rhythm Record v1](docs/rhythm-record-v1.md), and [Connection adapters](docs/connection-adapters.md) for the workflow, shared record contract, and security boundaries.

### “Failed to fetch” in v0.1.0

Version 0.1.0 tried to load the compressed chart database directly from a content script, which Chrome blocks unless the file is exposed to the page. Version 0.1.1 loads it inside the extension service worker instead. After updating, reload the extension from `chrome://extensions` and refresh DX NET once.

This project is not affiliated with SEGA. maimai is a trademark of SEGA. dxrating, arcade-songs, and their data are used under their respective MIT-licensed project terms.

## License

MIT
