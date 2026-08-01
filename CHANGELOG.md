# Changelog

All notable changes to Mai-Score are documented here.

## [Unreleased]

### Added

- Studio now has a dedicated **Progress** view with B50, New B15, and Old B35 timelines built from locally saved or Drive-synced snapshots.
- Added practical achievement targets for charts already present in the current B50, including the next threshold, required achievement gain, and potential chart-rating gain.
- Added per-chart observed history, latest B50 membership changes, and explicit source, schema, observation time, import time, and rating-model provenance.

### Data notes

- Progress timestamps describe when a B50 snapshot was observed; they are not presented as individual play timestamps.
- Upgrade targets intentionally use only charts in the current B50. Candidate songs outside the official B50 are not available in a B50 snapshot and are not guessed.

## [0.8.0] — 2026-08-01

### Added

- Exports show the equipped trophy under the player name in its in-game rarity colour, and the equipped nameplate behind the name block. Both have their own visibility toggles.
- New **Accent reach** setting extends the accent colour from its own elements to card borders and, at the widest setting, to page and card surfaces.
- A single **Difficulty figure** setting replaces the separate chart-level and chart-constant switches: level, constant, both, or neither.
- Export style, watermark, and language now sync through Google Drive alongside history, so a phone and a desktop agree on how exports look. The later edit wins.
- The Extension reads the equipped nameplate from DX NET and passes it to Studio with the icon and frame.
- Studio can authorize Google Drive directly with Google Identity Services on mobile and extension-free browsers.
- Desktop Extension sync and Studio web sync share the existing `mai-score-history.json` app-data document and pull → merge → push behavior.
- Synced history now carries compact player metadata so future snapshots can restore the equipped icon and frame without storing large image data in Drive.
- Added explicit mobile, cross-device, account-choice, and token-expiry cases to the real-service test plan.

### Changed

- Appearance and Language in the Studio top bar are now an icon toggle and an icon-led dropdown instead of labelled fields.
- The chart constant renders as a bare `13.9` rather than `CONST 13.9`.
- Studio automatically opens the newest synchronized B50 in Live preview and restores public song jackets.
- Studio language is now a global control in the top bar rather than an export-style field.
- Google Drive now sits in the main Studio toolbar instead of occupying a separate row.
- Studio provides independent dark and light interface modes plus six curated export accent presets.
- Visible-content controls are now always exposed as high-contrast switch cards.
- Export timestamps now always use the device's local time zone.
- The export header separates the B50 total, New B15, and Old B35 into distinct score blocks without thousands separators.
- The Official Rating row and its visibility control have been removed from exported images.
- Google Drive controls are now a compact sync bar, with destructive and account-management actions moved into a secondary menu.
- Studio now uses the Milifix dark palette, ambient grid, subtle glass surfaces, and reduced-motion-safe transitions.

### Fixed

- Full-width song titles no longer run past the edge of their card. Both renderers measured text by counting characters, which treated a CJK glyph as no wider than an `i`.
- Fixed mobile Drive sync reporting successful history while leaving Live preview empty.
- Preview and downloaded exports now use the same B50 collection timestamp.
- Equipped frames now end above the New B15 section in every export layout instead of covering its label.

### Privacy

- Web OAuth access tokens are short-lived and kept only in page memory; they are never stored by Mai-Score or sent to the Studio server.

## [0.7.1] — 2026-07-30

### Changed

- Studio now always shows a Google Drive card with explicit unavailable, disconnected, checking, and connected states.
- **Connect Google Drive** in Studio opens an Extension-owned authorization window, preserving the `chrome.identity` user-gesture requirement without exposing OAuth tokens to the website.
- Studio refreshes Drive state after the authorization window closes or the user returns to the page.
- Sync, Disconnect, and Delete cloud history appear only after a confirmed connection.
- Direct Studio visits use the pinned official Extension ID, so an installed Mai-Score build can be detected without a previous B50 handoff.
- The account hint now clearly states that Chrome uses the current profile's Google account and that another account requires switching Chrome profiles before connecting.

### Fixed

- Added the missing Google authorization entry point to Studio.
- Prevented Studio from presenting cloud actions before it has verified both the Extension bridge and the Drive grant.
- Disconnect now remains visibly disconnected even if Google cannot confirm remote token revocation.

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
