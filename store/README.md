# Chrome Web Store listing assets

Everything needed to submit Mai-Score, plus the answers the submission form asks
for. Nothing here is bundled into the extension.

## Screenshots

`screenshots/` holds three 1280×800 PNGs, the size the Web Store expects:

| File | Shows |
| --- | --- |
| `1-collect.png` | The popup after a successful collection |
| `2-studio.png` | The Studio editor with demo data loaded |
| `3-export.png` | The rendered Best 50 image |

They use Studio's built-in demo data — invented song titles and a placeholder
player name, no real account and no third-party cover art. Regenerate them after
a UI change; `2-studio.png` is a plain 1280×800 capture of Studio at `/`.

## Icon

The 128×128 store icon is `public/icons/icon128.png`, the same file the extension
ships. All four PNG sizes are rasterized from `public/icons/icon.svg`, which is
the source of truth — re-render them from it if the artwork changes.

## Listing copy

**Single purpose.** Mai-Score exports a player's own maimai DX NET International
Best 50 as an image or a JSON file.

**Permission justifications:**

| Permission | Why |
| --- | --- |
| `storage` | Save the language preference, and hand collected data to Studio under a single-use session token. |
| `downloads` | Write the PNG, SVG, or JSON file the user asked to export. |
| `maimaidx-eng.com` | Read the user's own Best 50 pages — the data being exported. |
| `shama.dxrating.net` | Fetch song cover art so exported images include it. |

**Remote code:** none. Everything executed by the extension ships in the package.

**Data use.** Declare that scores are read and handled locally, and that nothing
is sold or transferred. The one server-side detail worth disclosing accurately:
when a JSON file is loaded into Studio manually, cover images are proxied through
`/api/asset`, so the server sees which covers were requested along with normal
request logs. Collected data never reaches the server on the extension path.

**Privacy policy URL:** `https://mai-score.milifix.com/privacy`

## Before submitting

- [ ] Register the developer account (one-time US$5 fee)
- [ ] Confirm the privacy policy URL is live and reachable
- [ ] State in the description that this is unofficial and not affiliated with SEGA
- [ ] Fill in every permission justification above
- [ ] Consider publishing unlisted first, then switching to public

Reading DX NET may sit uneasily with SEGA's terms of service, and reviewers do
sometimes weigh third-party terms. Worth deciding how you want to describe the
extension before you submit rather than after a rejection.
