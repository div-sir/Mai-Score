# Changelog

All notable changes to Mai-Score are documented here.

## [Unreleased]

## [0.18.1] — 2026-09-10

### Added

- Add an exact chart-constant filter to Level completion and display each known constant beside its chart level.
- Make the B50 chart dialog interactive: switch between collected difficulties in place, show the active chart, and close the dialog by clicking outside it.
- Streamline Studio navigation and common actions with a sticky desktop header, remembered section, always-visible export controls, a direct empty-state import action, collapsible display options, and progressive Full Records filters.

### Fixed

- Combine `maimai` and `maimai PLUS` into the real 真 plate scope and remove the nonexistent 真將 result. 真極, 真神, and 真舞舞 now use the combined totals from both releases.
- Recalculate normal plate progress from synchronized Full Records and version totals when available, so saved v0.18.0 snapshots receive the corrected 真 grouping without another collection.

## [0.18.0] — 2026-09-09

### Added

- Save Full Records and version totals with each local history snapshot and include them in Google Drive sync. Existing v1 cloud history remains readable, and a stored latest snapshot is upgraded without requiring another DX NET collection.
- Track best-score and chart Rating observations for every saved Full Records chart, including charts outside B50, from the first complete snapshot onward. Studio shows the exact start of Full Records coverage.
- Filter the International catalog by exact chart constant and show the constant beside each result.
- Switch plate progress to a MASTER-only practice view while keeping the normal BASIC-through-MASTER plate totals as the default.

### Changed

- Use the v2 history sync format with a shared Full Records pool. Unchanged chart observations are stored once and referenced by each snapshot, keeping long histories within the existing bounded sync payload.
- Prefer a complete Full Records copy when two devices hold the same collection time, preventing an older B50-only client copy from discarding richer history.

### Data limitation

- DX NET Full Records contains current best scores without first-play or score-update timestamps. Mai-Score therefore records observed best-score history from the first saved complete snapshot; it does not assign invented dates to earlier plays.

## [0.17.0] — 2026-09-08

### Added

- Recover once from DX NET application-session expiry code 200002 by refreshing the authenticated home page and retrying the interrupted request. Recovery is bounded, never attempts to enter credentials, and retains the existing sign-in guidance when DX NET still rejects the session.
- Add localized MASTER-only filtering, visual chart metrics, plate sorting, and an expandable list of unmatched Full Records charts in Studio.

### Fixed

- Preserve the catalog song whose title is U+3000 in Full Records and B50 parsing. Trimming this real title previously aborted the entire MASTER page as a layout error. Empty and ASCII-whitespace-only played titles still fail validation.
- Complete all required score requests before optional frame/nameplate requests, preventing optional collection pages from disturbing the shared score-collection session.
- Request authenticated pages with no-store, matching the user's successful BASIC fetch. Cache reuse is a suspected difference, not a confirmed root cause. Parser failures include structural counts and failures include the installed build version without player data.
- Detect DX NET application error pages even with HTTP 200. Report connection expiry code 200002 with sign-in/retry guidance instead of claiming the Full Records layout changed; retain other application error codes.
- Refresh the International catalog from 6,195 to 6,219 sheets. The six newly observed songs—STRAY, ZEUS, オールマスター, お返事まだカナ？おじさん構文！, クロノイデア, and 雑魚—now have BASIC through MASTER identities and constants.
- Upgrade Studio to Next.js 16.3.4 and the Extension test toolchain to Vitest 4.1.11, clearing the release dependency audit without a major-version migration.

### Verification

- The supplied MASTER record set previously produced 1,129 played records with six unmatched songs. Those six titles are now present in the bundled catalog; a fresh authenticated collection remains the release acceptance check for a zero-unmatched result and successful 200002 recovery.

## [0.16.2] — 2026-09-08

### Fixed

- Recognize Full Records song rows before checking for achievements, allowing a BASIC list with no played scores to continue to the other difficulties.
- Accept nested song-row wrappers, avoid duplicate rows, and prefer the achievement field over the DX score field. Unknown pages and invalid achievements still fail explicitly.

## [0.16.1] — 2026-09-07

### Fixed

- Serialize authenticated DX NET page requests and retry transient fetch/body failures once. Count optional frame/nameplate attempts in progress and keep decorative failures from aborting score collection.
- Preserve profile-page nameplate/frame URLs when optional collection pages fail; recognize equipped collection images independently of decorative wrapper classes.
- Retain Full Records combo/sync flags when the matching B50 record omits them.
- Render actual rank and FC/AP/FS labels when official badge images are unavailable, while respecting visibility switches in both exporters.
- Embed profile images during JSON import, reject non-image asset responses, and restore nameplate contrast.

### Added

- Click or keyboard-select any chart in the Export B50 preview to open observation history, the minimum achievement for +1 Rating, and 100%/100.5% gains. Hit areas follow all three export layouts; exported images remain static.

### Verification

- Regression tests cover request retry, optional-page failure, flag retention, missing-artwork fallbacks, layout hit areas, and the chart dialog.
- Real-account collection and equipped-nameplate markup still require confirmation on DX NET. No real player HTML is retained in fixtures.

## [0.16.0] — 2026-09-07

### Added

- Added an on-demand International chart catalog to Records with title, version, difficulty, goal, and completion-gap filters. The packaged catalog contains 6,195 charts from the source snapshot published on 2026-09-05.
- Added conservative catalog-to-score matching. Exact chart IDs take priority; ambiguous legacy title/type/difficulty matches stay unknown instead of being reported as unplayed.
- Added cross-difficulty song details, per-chart 100%/100.5% Rating targets, and B50 observation history for collected charts.
- Added a browser-local play queue with target achievements and notes. Its versioned data is validated before every read or write and is never uploaded or Drive-synced.
- Added selected-chart B50 simulation for catalog gaps. Results appear only with explicit B15/B35 eligibility, complete bucket membership, and a known chart constant.

### Changed

- Completion reports now distinguish completed, known below-target, unobserved, and ambiguous charts for SSS, SSS+, FC, and AP goals.
- Reworked the catalog, gap summary, simulator, and result rows for clearer desktop scanning and single-column mobile layouts.
- Updated the pinned International chart source to `2026-09-05T15:00:29.141287228+00:00` (SHA-256 `2d9ada482d178d9c43faa6f9316e68a15ab0fdf870aa11ca4f17f1f7fdb6065b`).

### Verification notes

- Catalog parity confirms equality with the fetched community source; it is not independent proof that SEGA's live International catalog is complete.
- The owner confirmed acceptance and authorized publication on 2026-09-07. Agent-run cloud-browser verification was blocked by Vercel Deployment Protection; this is not recorded as an automated browser pass.

## [0.15.0] — 2026-09-05

### Added

- Added a dedicated **Records** Studio tab for Full Records search, completion totals, and exact plate progress. Progress now stays focused on B50 Rating decisions and history.
- Studio now computes exact 極 / 将 / 神 / 舞舞 plate progress from collected Full Records when an adapter summary is unavailable.
- The Extension ships per-version, per-difficulty chart counts from its bundled catalog, so plate denominators include charts the player has never touched.
- Plate progress is grouped by version and leads with the closest plate instead of rendering one long flat list.

### Changed

- Simplified the Extension collection path into explicit **B50 only** and **B50 + Full Records** modes. The primary action now states the selected scope, and the result summary groups matching information under one data-health field.
- Moved Studio Export/Progress navigation into the persistent header and separated data management from transient status messages.
- Reorganized export controls into Appearance, Footer & metadata, grouped Visible content, and Output sections. JSON import, privacy, and destructive local-data removal now live in a dedicated Data menu.
- Removed the duplicate compact history list from Export. Progress is now the single place for history and rating analysis.
- Reordered Progress into numbered **Next plays**, **History**, and **Data details** sections so B50 recommendations and changes have a stable reading order.
- Moved plate progress out of Progress and into Records, alongside the Full Records data used to calculate it.
- Consolidated Upgrade targets, Potential entries, cutoff protection, and What-if into one **Next plays** workspace with four short action tabs instead of four competing panels.
- Collapsed source provenance into an advanced details control and added Records-specific search wording in all three languages.
- Replaced three equal-weight Progress metric cards with one B50 overview and a subordinate New B15 / Old B35 breakdown. Studio's dataset summary now shows snapshot time instead of repeating the official account Rating.

### Data notes

- Plate rules are transcribed from community sources and are **not verified in game**. They live in one table in `studio/lib/plates.ts`; correcting a rule is a data edit that requires no re-collection.
- A version is omitted rather than shown at a flattering percentage when its catalog totals are missing, and plate progress is withheld entirely from a B50-only document.
- Adapter-supplied plate summaries continue to take precedence over the computed fallback.

## [0.14.0] — 2026-08-10

### Added

- Added an explicit **Include Full Records (Beta)** option to the Extension. It reads the five International DX NET difficulty pages only after the player enables it.
- Full Records collection includes each played chart's achievement, displayed level, STD/DX type, FC/AP flag, and FS/FDX flag, then resolves constants, versions, chart IDs, and jacket IDs through the bundled catalog.
- Studio handoff, Mai-Score full JSON, and Rhythm Record JSON now carry the collected best-per-chart list. Rhythm Record keeps the exact B15/B35 grouping and omits grouping from all other charts.
- Added localized fetch progress and separate B50/Full Records matching totals in English, Traditional Chinese, and Japanese.

### Data and privacy notes

- Full Records is off by default and currently enabled only for the verified International connection. It makes five sequential, authenticated, same-origin requests and does not retain raw DX NET HTML or session credentials.
- The full chart list remains local to the latest Studio snapshot and is still excluded from compact local/Drive history.

## [0.13.0] — 2026-08-10

### Added

- Studio now validates and imports maimai `mai-score/rhythm-record/v1` Full Records files while extracting the explicit New B15 and Old B35 subset for image export.
- Full Records retain one best result per chart and power a searchable level-completion grid with SSS, SSS+, FC/AP, and FS/FDX totals.
- Exact `maimai-plate-progress` summaries from an adapter appear beside the completion data; Studio never guesses plate completion from B50.
- Added parser fixtures for malformed records, duplicate record IDs, unsupported games, invalid achievements, B50 grouping, best-result deduplication, and plate summaries.

### Data and privacy notes

- Full Records file import is local and user initiated. v0.13.0 does not scrape DX NET `/record/` pages without verified authenticated fixtures.
- The newest Full Records dataset remains in the browser's local snapshot. Compact B50 history and exact plate summaries can sync through Drive, but the full chart list is intentionally excluded from history sync.

## [0.12.1] — 2026-08-10

### Added

- Popup and Studio provenance now show the packaged chart-catalog date and sheet count.
- Full JSON and saved local/Drive snapshots retain the exact catalog source, timestamp, hash, and sheet count used for Rating resolution.
- A weekly GitHub Actions job synchronizes dxrating data, verifies the project, and opens or refreshes a reviewable data PR when the catalog changes.

### Changed

- Updated the international catalog from 5,865 to 6,195 sheets using dxrating data published on 2026-08-09.
- End-user mismatch guidance now points to updating Mai-Score or reporting the discrepancy instead of suggesting a developer-only npm command.

### Data notes

- The refreshed catalog adds 330 international sheets across 78 song titles compared with v0.12.0 and incorporates current constant, displayed-level, and version metadata.
- Authenticated DX NET collection remains the final check for upstream international-region changes before each data PR is merged.

## [0.12.0] — 2026-08-02

### Added

- Studio can retain DX NET's New/Old candidate sections separately from the official B50 and show reachable songs that can beat the current B15 or B35 cutoff.
- Achievement-rank, FC/AP, and FS/FDX artwork now have independent Visible content switches.

### Changed

- Achievement-rank artwork is larger and uses the open right side of each export card; combo and sync badges remain compact beside the jacket.
- The player-title switch is labelled **Title** instead of the misleading **Trophy**.
- Upgrade targets now present `Needed`, `To 100%`, and `To 100.5%` in that order.
- What-if now has a chart picker, milestone shortcuts, exact numeric input, a slider, and a more prominent B50 impact.
- Chart history now uses search plus a chart picker, selected-chart summary, and chronological observation cards.

### Removed

- Removed Progress-to-Export chart locating, highlighted export cards, and all **View in export** actions.

## [0.11.0] — 2026-08-02

### Added

- Official DX NET achievement-rank, FC/AP, and FS badge artwork in Extension and Studio exports, with a dedicated visibility option.
- Progress B15/B35 cutoff values and at-risk charts, plus direct navigation from Progress to the matching export card.
- An interactive achievement what-if simulator that recalculates chart Rating and B50 immediately.
- A real B50/B15/B35 timeline with date axes, pointer/keyboard inspection, and exact observation values.
- Searchable single-chart history and difficulty/level filters for upgrade targets.
- A versioned `maimai-plate-progress` summary contract and Studio plate-progress UI for future Full Records adapters.

### Changed

- Full Combo parsing now preserves FC and FC+ in addition to AP and AP+.
- Historical charts default to recent Rating improvement instead of title order.

### Data notes

- Plate completion cannot be derived from a 50-chart Rating Target snapshot. Studio explicitly asks for Full Records unless an adapter supplies exact plate-progress entries.

## [0.9.1] — 2026-08-02

### Changed

- B50 upgrade targets now show song jackets, larger target figures, the Rating gained at the next achievement threshold, and the total potential gain through 100.5%.
- Upgrade target cards label the next achievement threshold as **To**, making `To 100%` and `To 100.5%` easier to scan.

## [0.9.0] — 2026-08-02

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
