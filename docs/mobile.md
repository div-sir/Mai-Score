# Mobile use

## Available now

Desktop Chrome/Edge can pass the captured B50 directly to Studio with **在網頁預覽並調整**. The handoff uses a single-use browser-local token and does not upload the score document.

The reliable phone workflow remains file-based:

1. Use Mai-Score on desktop Chrome or Edge to collect DX NET data.
2. Choose **Full JSON** or **Rhythm Record JSON** in the export selector.
3. Transfer the JSON privately with AirDrop, iCloud Drive, Google Drive, or another file service.
4. Open [Mai-Score Studio](https://mai-score-studio.solilium.chatgpt.site) on the phone, load the JSON from the system file picker, adjust the style, and download PNG or SVG.

Style links contain only the image preset, not player or score data.

## Browser limitations

Mobile Chrome's “Add to Desktop” flow installs a Web Store extension on the signed-in desktop browser; it does not run the desktop extension on the phone. Firefox for Android supports a catalog of compatible add-ons, but Mai-Score is not packaged or signed for that catalog yet.

On iPhone and iPad, direct DX NET collection requires a Safari Web Extension packaged through Xcode and distributed as an app. The current website remains usable for local JSON preview and image export.

## Planned direct-mobile paths

- Safari Web Extension wrapper for iOS/iPadOS.
- Signed Firefox Android build after compatibility testing.
- File/share-target import into Mai-Score Studio.
- Explicit opt-in APIs through versioned connection adapters.
