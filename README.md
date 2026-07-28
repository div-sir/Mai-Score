# Mai-Score

Mai-Score is a privacy-first Chrome/Edge extension for the **maimai DX International** version. It reads the official Best 50 page, calculates each chart's rating, and exports a B50 image or JSON.

> **Status:** the extension and Studio implementation described below is currently developed on the `agent/initial-mvp` branch ([PR #1](https://github.com/div-sir/Mai-Score/pull/1), draft, unmerged, targeting v0.5.0). `main` does not yet contain the source code — this README documents the project's intended scope so it can be reviewed ahead of merge.

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
- Supports English (default), Traditional Chinese, and Japanese in the popup, Studio, timestamps, and exported image labels.
- Keeps image choices for timestamp, timezone, watermark, accent color, assets, and score fields in the Studio.
- Uses a simple primary flow: collect B50, then open [Mai-Score Studio](https://mai-score.milifix.com) with the result already loaded.
- Keeps quick PNG and JSON downloads under a secondary direct-export selector.
- Uses a versioned connection registry so future file/API/site adapters can share the same popup and export pipeline.
- Does not transmit login details or score data to a third-party server.

## Install from source

Requires Node.js 22 or newer.

```sh
npm install
npm run sync-data
npm run verify
```

Then open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the generated `dist` directory. Log in to [maimai DX NET International](https://maimaidx-eng.com/maimai-mobile/home/), then click the Mai-Score icon.

## Data and compatibility

The compact international chart dataset is generated from [gekichumai/dxrating](https://github.com/gekichumai/dxrating) `dxdata`. Run `npm run sync-data` after game/data updates. Sheet IDs use dxrating's canonical `songId__dxrt__type__dxrt__difficulty` format.

The exporter intentionally uses the official Rating Target page's first 15 / remaining 35 ordering. Unmatched charts remain in the full JSON and image with a warning, but are omitted from dxrating JSON.

## Development

```sh
npm test
npm run typecheck
npm run build
```

### Automatic Studio handoff

After collection, choose **在網頁預覽並調整**. The extension stores the result behind a random, single-use transfer token for up to five minutes, opens Studio with the token and extension ID in the URL fragment, and removes the staged result as soon as Studio receives it. The score document is not placed in the URL or sent to the Studio server.

The handoff also embeds the equipped frame, icon, and resolved song covers as image data. This lets the browser preview and PNG export render authenticated DX NET assets without uploading them or depending on cross-origin image requests.

Studio is public at `mai-score.milifix.com` and does not require an account. After a successful transfer or JSON import, the latest B50 and its images are stored in that browser's IndexedDB so the preview can be restored later. Style preferences are stored separately in localStorage. No server-side score database is used, and the saved local copy can be cleared from Studio.

Studio is intentionally a compact preview tool: data controls, style controls, the live B50 preview, and PNG/SVG export. Quick PNG and dxrating/full/Rhythm Record JSON remain available under **直接匯出**.

The first connection adapter is `dxnet-intl`. Future sources can register a new connection ID, game ID, transport, URL matcher, and capabilities without changing the shared Rhythm Record or image pipelines.

See `docs/mobile.md`, `docs/rhythm-record-v1.md`, and `docs/connection-adapters.md` in PR #1 for the workflow, shared record contract, and security boundaries once merged.

This project is not affiliated with SEGA. maimai is a trademark of SEGA. dxrating and its data are used under their respective MIT-licensed project terms.

## License

MIT
