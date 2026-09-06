# v0.16 Records Center verification

Development branch: `agent/v016-catalog-identity`

Review: [Draft PR #39](https://github.com/div-sir/Mai-Score/pull/39)

Release state: not merged or released.

## Scope status

- [x] Full pinned International catalog, including charts absent from the player's collected records.
- [x] Exact chart-ID matching with unique legacy fallback and ambiguous-match rejection.
- [x] Five-difficulty Records filtering, STD/DX and version filtering, sorting, reset, and empty states.
- [x] Cross-difficulty song details with STD/DX separation and B50 observation history.
- [x] Detailed SSS, SSS+, FC, and AP gaps split into known below-target, unobserved, and ambiguous rows.
- [x] Selected catalog chart simulation tied to explicit B15/B35 eligibility and each bucket's cutoff.
- [x] Browser-local play queue with validated targets, notes, edit, remove, and storage-failure feedback.
- [x] Responsive catalog controls, summaries, simulator, and result rows for desktop and narrow screens.
- [x] Automated interaction coverage for catalog loading, opt-in comparison, gap selection, simulation withholding, play queue, and song details.
- [x] Extension typecheck, tests, package build, Studio typecheck, and production build.
- [ ] Authenticated Preview browser verification at desktop and mobile viewport widths.

## Catalog evidence

`npm run sync-data` fetched the International source successfully on 2026-09-05. The pinned source has:

- update time: `2026-09-05T15:00:29.141287228+00:00`
- SHA-256: `2d9ada482d178d9c43faa6f9316e68a15ab0fdf870aa11ca4f17f1f7fdb6065b`
- International chart count: 6,195

Studio's `predev` and `prebuild` generate `/data/catalog.json` from the same pinned International source shipped with the Extension. Generation rejects count mismatches, missing identities, and duplicate sheet IDs. This proves parity with the fetched community source, not independent completeness of the live SEGA catalog.

## Rating and identity boundaries

- Unknown or ambiguous matches are never described as unplayed.
- Catalog comparison requires an explicit confirmation that the imported scores are International.
- A simulation is withheld unless the chart has a known constant, explicit imported B15/B35 eligibility, and a complete 15- or 35-chart bucket.
- Candidate gain subtracts that bucket's current cutoff; an existing B50 member uses its current chart Rating.
- History contains B50 observations, not individual play timestamps or full-record snapshots.
- The play queue stays in the current browser and is not uploaded or synchronized.

## Latest local verification

- 33 test files / 273 tests pass.
- Root TypeScript check passes.
- Extension package build passes.
- Studio TypeScript check passes.
- Studio Next.js production build passes.
- `git diff --check` passes.

## External verification blocker

The PR Preview is protected by Vercel Deployment Protection and redirects the available cloud browser to Vercel login. Desktop/mobile visual and navigation verification remains open until an authorized session is provided or protection is temporarily disabled. Automated tests and responsive CSS inspection are supporting evidence, not a substitute for that browser check.

No merge, release, account creation, or player-data upload is authorized. Community, friends, rankings, and external-account features remain separate backend work and are outside this v0.16 scope.
