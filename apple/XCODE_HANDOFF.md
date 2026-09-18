# Mai-Score Apple platform handoff

This directory contains one Apple project with shared Safari Web Extension resources and four targets:

- `Mai-Score (macOS)`
- `Mai-Score Extension (macOS)`
- `Mai-Score (iOS)`
- `Mai-Score Extension (iOS)`

Open `Mai-Score/Mai-Score.xcodeproj` in Xcode. The project was generated with Apple's Safari Web Extension converter in Xcode 26.5. Both platforms use the Swift files under `Shared (App)` and `Shared (Extension)`, and reference the compiled Web Extension files in the repository's root `dist/` directory. The Safari-specific manifest is `apple/manifest.json`.

## Before opening Xcode

From the repository root, run:

```sh
npm install
npm run build:apple
```

Run that build again whenever TypeScript, popup HTML/CSS, icons, or the chart catalog changes. Do not edit generated JavaScript in `dist/`; edit the root sources instead.

## Xcode assistant continuation brief

1. Select the developer team for all four targets and confirm these bundle identifiers remain paired:
   - `com.milifix.maiscore`
   - `com.milifix.maiscore.Extension`
2. Replace the converter's placeholder container UI and generated app icons with Mai-Score production assets while preserving the shared macOS/iOS structure.
3. Run the macOS app, enable the extension in Safari Settings, and verify login detection, B50-only collection, Full Records collection, and the one-click Studio handoff on International DX NET.
4. Run the iOS app on a physical device, enable the extension in Settings → Apps → Safari → Extensions, grant both DX NET domains, and repeat the same flows. A real device is the acceptance environment because DX NET authentication cannot be meaningfully validated in an unsigned simulator build.
5. Verify external messaging from `https://mai-score.milifix.com` before relying on the current single-use Studio transfer. If Safari rejects website-to-extension messaging, replace only the handoff transport; keep the versioned data format and five-minute expiry.
6. Configure App Store signing, privacy answers, screenshots, version/build numbers, and an archive only after the functional checks pass.

## Known Safari differences

- Safari does not support the Chromium manifest keys `identity`, `oauth2`, or `downloads`. They are intentionally absent from `apple/manifest.json`.
- The Safari popup hides Chromium-only direct downloads and Extension-owned Google Drive authorization. Image export remains available in Studio; Google Drive should use Studio's web OAuth flow.
- Automatic DX NET collection remains user-initiated. The extension does not store a SEGA ID or password and does not schedule background scraping.
- The TypeScript sources still use the `chrome.*` WebExtensions namespace accepted by Safari. Keep feature detection around APIs that Safari may omit.

## Command-line verification

Use the full Xcode developer directory when the machine is still pointed at Command Line Tools:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project apple/Mai-Score/Mai-Score.xcodeproj \
  -scheme 'Mai-Score (macOS)' CODE_SIGNING_ALLOWED=NO build

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project apple/Mai-Score/Mai-Score.xcodeproj \
  -scheme 'Mai-Score (iOS)' -sdk iphonesimulator \
  -derivedDataPath /tmp/mai-score-ios-derived CODE_SIGNING_ALLOWED=NO build
```

The generated project currently targets iOS 15.0 and macOS 10.14. Raise these only when a required Safari API makes the older deployment target impossible.
