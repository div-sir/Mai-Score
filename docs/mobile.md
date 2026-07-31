# Mobile use

## Available now

Desktop Chrome/Edge can pass the captured B50 directly to Studio with **在網頁預覽並調整**. The handoff uses a single-use browser-local token and does not upload the score document.

Studio can synchronize history directly from a phone after Google web sync is
configured for the deployment:

1. Open [Mai-Score Studio](https://mai-score.milifix.com) in the phone's normal browser.
2. Choose **Connect Google Drive** and select the same Google account used on desktop.
3. Choose **Sync history**. Studio pulls, merges, and pushes the shared
   `mai-score-history.json` in Drive `appDataFolder`.
4. The synchronized entries are copied into that phone browser's IndexedDB and
   remain available after the short-lived Google access token expires.

No Mai-Score account is created. The web access token stays in page memory, so
after a reload or token expiry the user may need to choose **Connect Google
Drive** again. This does not remove local or cloud history.

The file-based workflow remains available:

1. Use Mai-Score on desktop Chrome or Edge to collect DX NET data.
2. Choose **Full JSON** or **Rhythm Record JSON** in the export selector.
3. Transfer the JSON privately with AirDrop, iCloud Drive, Google Drive, or another file service.
4. Open [Mai-Score Studio](https://mai-score.milifix.com) on the phone, load the JSON from the system file picker, adjust the style, and download PNG or SVG.

Style links contain only the image preset, not player or score data.

Studio does not require an account. The latest imported B50 and its images are kept in that browser's IndexedDB, while style preferences use localStorage. Clearing site data, using private browsing, or choosing **Clear local B50 data** removes the saved copy.

## Browser limitations

Mobile Chrome's “Add to Desktop” flow installs a Web Store extension on the signed-in desktop browser; it does not run the desktop extension on the phone. Direct Studio web sync does not require a mobile extension. Firefox for Android supports a catalog of compatible add-ons, but Mai-Score is not packaged or signed for that catalog yet.

On iPhone and iPad, direct DX NET collection requires a Safari Web Extension packaged through Xcode and distributed as an app. The current website remains usable for local JSON preview and image export.

## Planned direct-mobile paths

- Safari Web Extension wrapper for iOS/iPadOS.
- Signed Firefox Android build after compatibility testing.
- File/share-target import into Mai-Score Studio.
- Explicit opt-in APIs through versioned connection adapters.
