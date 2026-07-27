# Mai-Score

Mai-Score is a privacy-first Chrome/Edge extension for the **maimai DX International** version. It reads the official Best 50 page, calculates each chart's rating, and exports a B50 image or JSON.

## Features

- Reads B15 + B35 from the official `ratingTargetMusic` page.
- Calculates chart rating from international internal levels.
- Captures player name, title, icon, equipped frame, course rank, class rank, stars, and official rating where available.
- Exports dxrating-compatible JSON: `[{ "sheetId", "achievementRate" }]`.
- Exports a richer `mai-score/v1` JSON document and a cross-game `mai-score/rhythm-record/v1` document.
- Generates PNG locally with Night, Light, and maimai themes.
- Provides Classic 5×10, Compact 5×10, and Landscape 10×5 image templates.
- Keeps image choices for timestamp, timezone, watermark, accent color, assets, and score fields in the Studio.
- Uses a simple primary flow: collect B50, then open [Mai-Score Studio](https://mai-score-studio.solilium.chatgpt.site) with the result already loaded.
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

### Automatic Studio handoff in v0.3.1

After collection, choose **在網頁預覽並調整**. The extension stores the result behind a random, single-use transfer token for up to five minutes, opens Studio with the token and extension ID in the URL fragment, and removes the staged result as soon as Studio receives it. The score document is not placed in the URL or sent to the Studio server.

Studio is intentionally a compact preview tool: data controls, style controls, the live B50 preview, and PNG/SVG export. Quick PNG and dxrating/full/Rhythm Record JSON remain available under **直接匯出**.

The first connection adapter is `dxnet-intl`. Future sources can register a new connection ID, game ID, transport, URL matcher, and capabilities without changing the shared Rhythm Record or image pipelines.

See [Mobile use](docs/mobile.md), [Rhythm Record v1](docs/rhythm-record-v1.md), and [Connection adapters](docs/connection-adapters.md) for the workflow, shared record contract, and security boundaries.

### “Failed to fetch” in v0.1.0

Version 0.1.0 tried to load the compressed chart database directly from a content script, which Chrome blocks unless the file is exposed to the page. Version 0.1.1 loads it inside the extension service worker instead. After updating, reload the extension from `chrome://extensions` and refresh DX NET once.

This project is not affiliated with SEGA. maimai is a trademark of SEGA. dxrating and its data are used under their respective MIT-licensed project terms.

## License

MIT
