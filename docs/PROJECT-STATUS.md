# Project status and handoff

Written for another agent or developer picking this up cold. Covers what
exists, the decisions behind it that the code alone will not explain, what is
knowingly unverified, and what comes next.

Accurate as of August 1, 2026. The latest packaged GitHub release is `v0.7.1`; Extension, manifest, lockfiles, and Studio release metadata still use `0.7.1`. Production `main` is `559722e` (PR #21). Draft PR #22 is `76cd99d`; its CI and Vercel Preview pass, but its code is not released or deployed to production.

## What this is

A Chrome/Edge MV3 extension that reads a player's own maimai DX NET Best 50
page and exports it as an image or JSON, plus **Studio** — a Next.js app at
`mai-score.milifix.com` that previews and restyles the export.

## Released in v0.7.0

The `v0.7.0` GitHub release introduced the v0.6.0 rating corrections plus the Studio, multilingual export, local-history, connection-registry, and underlying experimental Drive work. The current packaged release is `v0.7.1`, described below.

## Released in v0.7.1

- Studio always renders a Drive card and uses the pinned official Extension ID when no prior handoff ID is stored.
- Connect launches a web-accessible Extension authorization page; the actual interactive `chrome.identity` call remains inside the Extension origin.
- Studio verifies the Drive grant before showing Sync, Disconnect, and Delete cloud history.
- Returning focus to Studio refreshes the visible connection state.

## Current development flow

| Phase | Git / deployment state | Status | Exit criterion / next action |
| --- | --- | --- | --- |
| Packaged Extension baseline | Release `v0.7.1` | Done | Keep installable release stable while post-release Studio work settles. |
| Cross-device Studio + UI pass | PRs #17–#21 on `main`; production Studio at `559722e` | Done and deployed | Production smoke-test mobile Drive sync with an approved Google account. |
| Export/style synchronization pass | Draft PR #22 at `76cd99d` | Automated verification complete | Review the visual choices, test the live nameplate page, then merge. The shared-`appDataFolder` test is a Drive-GA gate, not something CI can prove. |
| Next packaged release | Not started | Blocked on PR #22 | Merge the accepted draft, update versions and release notes, package the Extension, and tag the next release. |
| Drive general availability | Experimental | Blocked on real services | Prove both OAuth clients see the same app-data file, complete the real-service matrix, register the Web Store client, and finish Google sensitive-scope verification. |
| Progress dashboard | Planned | Next product phase | Decide history retention, then add rating-over-time, per-chart history, and next-grade targets. |
| Chrome Web Store | Assets and copy prepared | Later release phase | Refresh screenshots, pay the developer fee, publish unlisted first, and finish OAuth/store review gates. |
| pop'n / SDVX / DDR connections | Schema and adapter IDs reserved | Future | Implement one user-approved file/API transport with fixtures before adding further games. |

PR #22's automated gate is strong: 184 tests across 21 files, Extension verification, Studio typecheck/build, desktop and 390 px Chromium checks, and Vercel Preview all pass. It deliberately remains a draft because nameplate parsing and cross-provider Drive behavior need real authenticated services.

## Capability snapshot

| Area | Packaged `v0.7.1` | Production `main` | Draft PR #22 |
| --- | --- | --- | --- |
| B50 collection | International active; Japan adapter present but unverified | Same | Adds fail-safe equipped-nameplate collection; live page shape unverified |
| Rating calculation | Official chart formula; exact B15/B35 recomputation | Same | Same |
| Image export | 3 layouts × 3 themes, PNG/SVG | Adds clearer score blocks, local timestamps, chart constants, elegant accents, and frame/B15 separation | Adds accent reach, one difficulty-figure control, trophy/nameplate controls, and CJK-safe title measurement |
| JSON export | dxrating, `mai-score/v1`, `mai-score/rhythm-record/v1` | Same | Same |
| Studio | Preview, restyle, local history, Web Share | Latest synced B50 opens automatically; mobile/web Drive, dark/light UI, curated accents | Syncs style, watermark, and language; iconised appearance/language controls |
| Google Drive | Experimental Extension proxy | Also supports direct mobile/web Google Identity Services | Adds convergent optional settings sync and provider-dispatch tests |
| Languages | English, 繁體中文, 日本語 | Same | Same |
| Store readiness | Listing copy and assets exist | Privacy URL deployed | Screenshots must be regenerated after the current UI stabilizes |

### The rating bug that was fixed

Worth knowing because it silently produced wrong numbers for every user before
`v0.6.0`:

1. `calculateChartRating` added `+1` per AP/AP+ chart. **maimai DX has no
   full-combo bonus** — that is a CHUNITHM mechanic. The total ran above the
   official rating by exactly the number of AP charts in the B50.
2. The coefficient table carried entries at band *tops* (`99.9999`,
   `100.4999`, …) with values from a different convention, so hitting one
   awarded a higher coefficient than the band itself.

The popup now shows the signed difference beside the B50 total when it
disagrees with the official rating, so any remaining gap is visible instead of
silent.

## Experimental Google Drive sync

The Extension-proxy Drive path ships in `v0.7.1`. Production Studio on `main` also supports direct Google Identity Services authorization for mobile and extension-free browsers. Both remain experimental: only approved OAuth test users can authorize them until the real-service matrix, shared-app-data assumption, sensitive-scope verification, and production Web Store OAuth client are complete. Local B50 collection, image/JSON export, Studio, and IndexedDB history do not require Drive.

### Architecture, and why

Studio owns the history schema and merge logic. Two credential providers feed the same provider-neutral sync path:

| Client | Credential owner | Token handling | Intended use |
| --- | --- | --- | --- |
| Desktop Extension | `chrome.identity` inside the Extension origin | Studio never receives the token | Installed Chrome/Edge Extension |
| Studio Web | Google Identity Services in `mai-score.milifix.com` | Short-lived token stays only in page memory | Mobile Chrome/Safari and extension-free browsers |

Both providers read and write `mai-score-history.json` in Drive `appDataFolder`. The two OAuth clients are in the same Google Cloud project, but whether Google exposes the same app-data space across those client types is still a blocking real-service question; see the test plan before treating cross-provider sync as guaranteed.

```
Extension token ─┐
                 ├─> Studio merge ─> Drive appDataFolder
Web token ───────┘
```

| File | Role |
| --- | --- |
| `src/lib/drive-appdata.ts` | Drive v3 REST, confined to `appDataFolder`; `fetch` injected for tests. |
| `src/lib/drive-sync.ts` | Extension message protocol and sync orchestration. |
| `src/lib/drive-auth.ts` | Extension consent, connection state, and revoke. |
| `studio/lib/google-drive-web.ts` | Direct web/mobile Google Identity Services provider. |
| `studio/lib/history-sync.ts` | Shared document format, history merge, and optional settings merge. |
| `studio/lib/drive-client.ts` | Studio-to-Extension credential-provider bridge. |

### Merge semantics

Sync is always **pull → merge → push**, never one direction, so a device that
was offline contributes rather than being overwritten.

The document also carries an optional `settings` block — export style,
watermark, and language. It was added after `v1` shipped, so it is optional and
the schema string is unchanged: an older Studio ignores the key rather than
rejecting the file. `mergeSettings` takes the later `updatedAt`, with the same
content-derived tiebreak the entries use. A device stamps `updatedAt` only when
the person changes something, never when a sync applies an incoming style —
otherwise every device would look like the newest one and the merge could never
settle.

`mergeHistories` unions by `generatedAt` (collection time), preferring the
later `savedAt` — a re-save usually means it was resolved against a newer
chart database. The tiebreak is **derived from content, not argument order**.
This matters more than it looks: without it, two devices each prefer their own
copy and re-push forever. Commutativity, associativity, and idempotency are
covered as explicit test properties.

Entries returning from Drive are re-parsed, so their JSON key order can differ
from locally built ones. The comparison canonicalizes keys first; there is a
test for it.

### Consent

Extension consent stays inside an Extension-owned page because `chrome.identity.getAuthToken({ interactive: true })` needs a direct user gesture. Background messages ask only non-interactively and return `needs-auth`; Disconnect revokes at Google before clearing Chrome's cached token.

The Studio-web provider always invokes Google's account chooser from a user action. Its access token is short-lived, remains only in page memory, and disappears on reload. Neither provider stores a password, cookie, or refresh token in Mai-Score.

## Knowingly unverified

Everything here is flagged in-code too. None of it can be checked from a
sandbox without the real services.

1. **Rating tiers below 13000** (`src/lib/rating-tier.ts`). 13000 and up were
   transcribed from the official in-game table the repo owner supplied.
   White through bronze are community guesswork.
2. **The Japan adapter's page structure** (`docs/connection-adapters.md`).
   `dxnet-jp` reuses the international parser on the assumption both regions
   share a template. Never run against a live logged-in `maimaidx.jp`. If the
   markup differs, `parser.ts` throws its existing "couldn't find player data"
   errors rather than returning wrong data — a safety net, not verification.
3. **The nameplate collection page** (`src/lib/parser.ts`, `src/content.ts`).
   `parseCurrentPlate` assumes `/collection/plate/` has the same shape as the
   frame page and serves `/img/Plate/` images. Never run against a live
   logged-in account. It is fetched on a 5 s deadline, separately from the
   three pages the export needs, and both a failed request and an unrecognized
   page yield "no nameplate" rather than failing the collection — so the cost
   of the guess being wrong is a missing decoration, not a lost B50.
4. **Whether the two OAuth clients share one `appDataFolder`.** This is the
   load-bearing assumption of the whole two-provider design, and nothing in
   the repository establishes it. The extension and Studio-web paths use
   different client IDs in one Google Cloud project. If `appDataFolder` is
   scoped per project they share a document and cross-device sync works; if
   per client ID, a user who connects via the extension on desktop and the
   web client on mobile gets two separate histories, **both reporting
   successful syncs**. Verify this before anything else —
   [the test plan](drive-real-api-test.md) opens with the procedure and what
   to do if it fails.
5. **Real Drive API behaviour.** Automated tests use a mocked `fetch`; the
   complete multi-profile real-service matrix has not been recorded in the
   repository. Follow [the real-service test plan](drive-real-api-test.md)
   before declaring Drive generally available.
6. **Collect latency.** The chart database was measured at ~95 ms and ruled
   out; the remaining cost is DX NET's own response time, which was never
   reachable from the dev environment.

## Traps

- **SVG `fill=` loses to the stylesheet.** Both renderers emit
  `<style>text{fill:…}</style>`, which outranks a `fill="…"` presentation
  attribute on the same element — confirmed in both Chromium and librsvg. All
  `<text>` elements in both renderers now use `style="fill:…"`; a test asserts
  none regress to the attribute form. **`<rect>` elements are unaffected** and
  correctly keep `fill=`, since the stylesheet rule only targets `text` — do
  not "fix" those.
- **Three tables are duplicated by hand**, because Studio cannot import from
  the extension package. Each has a test asserting the copies agree —
  keep them:
  - `rating-tier.ts` in `src/lib/` and `studio/lib/`
  - `accentReach`, the trophy rarity table, and the text-measurement constants
    in both `render.ts` files
  - `SYNC_PROTOCOL_VERSION` (Studio) vs `CONNECTION_PROTOCOL_VERSION`
  - `manifest.json` host permissions vs the endpoints the code calls
- **`manifest.json` has a `key` field** pinning the unpacked extension ID to
  `bkdgjhjohcohclggjadimcamjcacfjpk`, which the OAuth client is registered
  against. Studio uses the same ID as its direct-visit fallback. Chrome ignores
  the key for a Web Store build and assigns its own ID, so update that fallback
  when a store item ID is available; handoffs already remember a valid runtime
  ID and override the fallback.
- **Text is measured in units, not characters.** One unit is one full-width
  glyph, and `UNIT_EM` converts units to pixels. Counting characters treats a
  CJK glyph as no wider than an `i`, which is what used to push full-width song
  titles past the card edge. Size any new box with `textWidth`, and budget any
  new truncation with `widthUnits`.
- **`.summary[hidden]{display:none}`** in `popup.css` exists because an author
  `display:grid` rule outranks the `hidden` attribute. Do not remove it.

## Next

Follow the development-flow table above; these are the implementation notes behind its remaining phases.

### 1. Finish and merge Draft PR #22

- Review accent reach, trophy/nameplate placement, and the combined difficulty-figure control in the Vercel Preview.
- Test `/collection/plate/` on a real logged-in DX NET account. Failure is non-blocking for B50 collection by design, but the feature should not be advertised until its source is confirmed.
- Keep the shared-`appDataFolder` question visible as a Drive general-availability gate. It does not need to block safe UI work from merging while Drive remains explicitly experimental.
- After acceptance, mark the PR ready, merge, verify production, then prepare the next packaged Extension release instead of silently leaving release metadata at `0.7.1`.

### 2. Prove Drive cross-device behavior

The first test is desktop Extension provider → mobile Studio-web provider using the same approved Google account. Confirm both see one `mai-score-history.json`, including PR #22's optional settings block. If they do not, stop: the two providers need a different shared-storage design before any other Drive matrix result matters.

Then complete create, repeat sync, bidirectional merge, deletion, disconnect, reauthorization, token expiry, account choice, offline failure, and old-client compatibility. Only after that should the project begin Google sensitive-scope verification or remove the experimental label.

### 3. Build progress tracking

The timeline is already newest-first and each `HistoryEntry` contains every chart's achievement and rating. The first useful view should include:

1. B50 rating over time, split into New B15 and Old B35.
2. Per-chart achievement/rating history.
3. Charts closest to the next grade or rating gain.
4. A simple collection-to-collection change list using `diffHistory`.

Decide retention before implementation. At roughly 7–8 KB per collection, the 4 MB sync limit is about 500 snapshots. Weekly use is safe for years, but silent downsampling would damage long-range charts; prefer an explicit policy.

### 4. Prepare the Store release

- Regenerate all store screenshots; the built-in demo was removed and the Studio UI has changed substantially.
- Test the Japan adapter against a real logged-in `maimaidx.jp` account.
- Register the Web Store account and production Extension OAuth client.
- Keep the listing framed as a user-initiated export of the player's own profile and publish unlisted first.

### 5. Add other rhythm games through adapters

Do not add pop'n, SOUND VOLTEX, and DDR as one large scraper project. Start with one explicit file import or documented user-authorized API, normalize it into `mai-score/rhythm-record/v1`, and require schema validation plus parser fixtures. Once that transport boundary is proven, reuse it for the other reserved adapters.

### 6. Smaller quality work

- Add committed coverage around the remaining `content.ts` browser/DOM path.
- Surface the chart database sync date when fewer than 50 charts resolve.
- Keep Firefox out of scope until Studio handoff and Drive sync have a replacement for `externally_connectable`.

## Conventions

- `npm run verify` = typecheck + test + build. Studio is a separate package
  with its own `tsc`/`build`.
- Every user-facing string goes through the i18n tables in `src/lib/i18n.ts`
  and `studio/lib/i18n.ts`, in all three languages. `content.ts` used to
  hardcode Traditional Chinese error strings regardless of the selected
  language; that was fixed, do not reintroduce it.
- Comments explain *why*, not what. Several in this codebase document
  non-obvious failure modes — the SVG cascade, the merge tiebreak, the
  auth ordering — and are load-bearing.
