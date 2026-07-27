# Mai-Score

Mai-Score is a privacy-first Chrome/Edge extension for the **maimai DX International** version. It reads the official Best 50 page, calculates each chart's rating, and exports a B50 image or JSON.

## Features

- Reads B15 + B35 from the official `ratingTargetMusic` page.
- Calculates chart rating from international internal levels.
- Captures player name, title, icon, equipped frame, course rank, class rank, stars, and official rating where available.
- Exports dxrating-compatible JSON: `[{ "sheetId", "achievementRate" }]`.
- Exports a richer `mai-score/v1` JSON document.
- Generates a 2000 × 2550 PNG locally with Night and Light themes.
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

### “Failed to fetch” in v0.1.0

Version 0.1.0 tried to load the compressed chart database directly from a content script, which Chrome blocks unless the file is exposed to the page. Version 0.1.1 loads it inside the extension service worker instead. After updating, reload the extension from `chrome://extensions` and refresh DX NET once.

This project is not affiliated with SEGA. maimai is a trademark of SEGA. dxrating and its data are used under their respective MIT-licensed project terms.

## License

MIT
