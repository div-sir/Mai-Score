# Changelog

All notable changes to Mai-Score are documented here.

## [0.7.0] — 2026-07-29

### Added

- Mai-Score Studio at `mai-score.milifix.com` with live B50 preview and PNG/SVG export.
- Classic 5×10, Compact 5×10, and Landscape 10×5 layouts with Night, Light, and maimai themes.
- Timestamp, timezone, watermark, accent, frame, icon, cover, rating, achievement, level, and rank controls.
- Clearly labeled New B15 and Old B35 image regions with chart counts and subtotals.
- English, Traditional Chinese, and Japanese interfaces; English remains the default.
- Browser-local B50 snapshots and history with cross-collection differences.
- `mai-score/rhythm-record/v1` as a versioned cross-game record format and a connection registry for future game adapters.
- Optional experimental Google Drive `appDataFolder` history sync, explicit account-profile guidance, Disconnect, and separately confirmed cloud-history deletion.
- GitHub Actions verification for the Extension and Studio, plus installable preview artifacts on pull requests.

### Changed

- Studio now opens from a single-use Extension transfer token and receives embedded player/frame/cover assets without putting score data in the URL.
- Studio starts with an empty state rather than demo scores and restores the last local B50 when a one-time transfer expires.
- Direct PNG and JSON exports are grouped under a secondary selector while the primary flow opens Studio.
- B50 totals are recalculated from the highest 15 New and 35 Old chart ratings when importing data.
- Drive authorization is explicitly opt-in and remains disabled after Disconnect; background sync cannot silently reacquire access.

### Fixed

- Corrected maimai chart-rating coefficient boundaries and removed the incorrect AP/AP+ bonus.
- Excluded candidate sections after the official B15/B35 targets.
- Preserved authenticated frame, icon, and jacket images in Studio exports.
- Prevented language changes from overwriting the live Drive connection label.
- Made local-history deletion and cloud-history deletion disclose their exact, separate effects.

### Known limitations

- Google Drive sync is experimental and limited to approved OAuth test users until Google sensitive-scope verification and a production Web Store OAuth client are complete.
- The Japan-domestic adapter still needs validation against a real logged-in `maimaidx.jp` account.
- Chrome/Edge desktop is the supported Extension environment; mobile Chrome does not support desktop extensions.

## [0.6.0]

- Corrected core B50 rating calculations and added the packaged GitHub release workflow.
