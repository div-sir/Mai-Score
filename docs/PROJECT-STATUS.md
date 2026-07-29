# Project status and handoff

Written for another agent or developer picking this up cold. Covers what
exists, the decisions behind it that the code alone will not explain, what is
knowingly unverified, and what comes next.

Accurate as of the `v0.7.0` release prepared on July 29, 2026. Extension, manifest, lockfiles, and Studio all use version `0.7.0`.

## What this is

A Chrome/Edge MV3 extension that reads a player's own maimai DX NET Best 50
page and exports it as an image or JSON, plus **Studio** — a Next.js app at
`mai-score.milifix.com` that previews and restyles the export.

## Released in v0.7.0

The packaged GitHub release is `v0.7.0` (the release workflow builds and attaches the extension zip from the matching tag). It includes the v0.6.0 rating corrections plus the Studio, multilingual export, local-history, connection-registry, and experimental Drive work described below.

| Area | State |
| --- | --- |
| B50 collection from DX NET | International (`maimaidx-eng.com`) and Japan (`maimaidx.jp`) |
| Rating calculation | Matches the official formula — see the correction below |
| Image export | 3 layouts, 3 themes, PNG/SVG, tier-coloured rating badge with star sub-ranks |
| JSON export | dxrating, `mai-score/v1`, `mai-score/rhythm-record/v1` |
| Studio | Preview, restyle, local history with per-collection diffs, Web Share |
| Languages | English, 繁體中文, 日本語 throughout |
| Privacy policy | `studio/app/privacy/page.tsx`, live at `/privacy` |
| Store assets | `store/` — 1280×800 screenshots and listing copy in three languages |

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

## Experimental Google Drive sync in v0.7.0

Google Drive history sync is included in v0.7.0 but remains experimental. Only OAuth test users approved in Google Cloud can authorize it until sensitive-scope verification and the production Web Store OAuth client are complete. The local B50, image, JSON, Studio, and IndexedDB-history flows remain available without Drive.

### Architecture, and why

The OAuth client is a **Chrome Extension** credential, so only the extension
can obtain a token. But history lives in **Studio's IndexedDB**, a different
origin. Rather than duplicate the history schema into the extension or require
a second Web OAuth client, the extension acts as a **credential proxy**:

```
Studio (owns schema + merge)  --externally_connectable-->  Extension (owns token)
        history entries              opaque JSON string           Drive appDataFolder
```

The extension never parses the payload. Studio never sees a token.

| File | Role |
| --- | --- |
| `src/lib/drive-appdata.ts` | Drive v3 REST, confined to `appDataFolder`. `fetch` injected for tests. |
| `src/lib/drive-sync.ts` | Message protocol + `performDriveSync` orchestration. |
| `src/lib/drive-auth.ts` | Consent, connection state, revoke. `chrome.identity` injected. |
| `studio/lib/history-sync.ts` | Document format and `mergeHistories`. |
| `studio/lib/drive-client.ts` | Studio's side of the message protocol. |

### Merge semantics

Sync is always **pull → merge → push**, never one direction, so a device that
was offline contributes rather than being overwritten.

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

`chrome.identity.getAuthToken({ interactive: true })` needs a user gesture,
which a background worker woken by an external message does not have. So the
background only ever asks non-interactively and returns `needs-auth`; the
popup raises consent. Disconnect revokes at Google *then* clears Chrome's
cached token — cache-only leaves the grant live, revoke-only leaves Chrome
serving a dead token.

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
3. **Real Drive API behaviour.** Automated tests use a mocked `fetch`; the
   complete multi-profile real-service matrix has not been recorded in the
   repository. Follow [the real-service test plan](drive-real-api-test.md)
   before declaring Drive generally available.
4. **Collect latency.** The chart database was measured at ~95 ms and ruled
   out; the remaining cost is DX NET's own response time, which was never
   reachable from the dev environment.

## Traps

- **SVG `fill=` loses to the stylesheet.** Both renderers emit
  `<style>text{fill:…}</style>`, which outranks a `fill="…"` presentation
  attribute on the same element — confirmed in both Chromium and librsvg. The
  rating badge uses `style="fill:…"` for this reason. **12 other text elements
  in `src/lib/render.ts` and 13 in `studio/lib/render.ts` still use the
  attribute form.** They remain visible (they are not on a fixed-colour
  background like the badge was) but do not render in the intended muted tone.
  Unfixed; a mechanical but wide change.
- **Three tables are duplicated by hand**, because Studio cannot import from
  the extension package. Each has a test asserting the copies agree —
  keep them:
  - `rating-tier.ts` in `src/lib/` and `studio/lib/`
  - `SYNC_PROTOCOL_VERSION` (Studio) vs `CONNECTION_PROTOCOL_VERSION`
  - `manifest.json` host permissions vs the endpoints the code calls
- **`manifest.json` has a `key` field** pinning the unpacked extension ID to
  `bkdgjhjohcohclggjadimcamjcacfjpk`, which the OAuth client is registered
  against. Chrome ignores it for a Web Store build and assigns its own ID.
- **`.summary[hidden]{display:none}`** in `popup.css` exists because an author
  `display:grid` rule outranks the `hidden` attribute. Do not remove it.

## Next

In rough priority order.

### 1. Progress tracking (the repo owner's stated next feature)

The merged timeline is complete and ordered newest-first, which is what this
builds on. Nothing in the data model needs to change: each `HistoryEntry`
already carries every record's `achievementRate` and `chartRating`.

Likely shape: a rating-over-time chart, per-chart improvement history, and
"charts closest to the next grade". `diffHistory` in `studio/lib/history.ts`
already computes entered/left/improved between two points.

Consider whether history needs a cap. Entries are roughly 7–8 KB each and the
sync payload is bounded at 4 MB, which is around 500 collections — fine for
years of weekly play, but unbounded growth is worth a decision before it
matters, and downsampling old entries would conflict with long-range progress
tracking.

### 2. Finish Drive general availability after v0.7.0

- The source privacy policy and store permission documentation were updated for v0.7.0. Confirm the production policy deployment after the release merge.
- Studio has a separately confirmed **Delete cloud history** action. It deletes only the Drive `appDataFolder` history file and leaves local IndexedDB history intact; Disconnect remains OAuth-only. Verify the complete real-service matrix before removing the experimental label.
- `drive.appdata` is a Google-classified sensitive scope. Publishing to users
  beyond the Cloud Console test-user list requires OAuth verification: the
  privacy policy URL, a demo video, and a review that can take weeks.
- A Web Store build gets a different extension ID than the pinned dev one, so
  a second OAuth client (or an updated item ID) is needed at upload.

### 3. Web Store submission

`store/README.md` holds the checklist, permission justifications, and listing
copy in three languages. Outstanding: the US$5 developer registration, live
privacy policy URL, and the permission updates above.

The listing copy is deliberately framed as *exporting your own profile* — a
better version of the screenshot players already share — rather than as a tool
for reaching maimai data. Reading DX NET may sit uneasily with SEGA's terms,
and reviewers do weigh third-party terms; the framing keeps the listing on
defensible ground. Publish unlisted first.

### 4. Smaller things

- Test coverage for `content.ts` — it has none, needing live `chrome.*` and
  DOM mocking this repo has no harness for. The pure parts were extracted to
  `collect-progress.ts` to make them testable; the rest was verified with
  ad-hoc Playwright harnesses rather than committed tests.
- Surface the chart database's sync date in the UI. When the game updates,
  `resolved` silently drops below 50/50 and users have no way to know the fix
  is `npm run sync-data`.
- Firefox is **not** viable without redesign: `externally_connectable` has no
  Firefox equivalent, so the Studio handoff and all of Drive sync would need a
  different mechanism.

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
