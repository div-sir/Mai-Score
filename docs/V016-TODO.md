# v0.16 implementation checkpoint

Branch: agent/v0.16-records-center. Not released. Package versions remain 0.15.0 until release preparation.

## Implemented
- All-level selection fix; all five difficulties.
- Achievement/title/constant sorting; unknown constants last.
- Type, version, FC/AP and below-SSS filters; reset and empty state.
- Pure record search with four regression tests.
- On-demand song details with collected sibling difficulties and STD/DX separation.
- Existing B50 history connected to Records details; missing observations are explicitly not unplayed evidence.
- 100/100.5 target chart Rating (not B50 gain).

## Remaining
- Catalog UI checkpoint: on-demand International catalog browsing, title/version/difficulty search, 50-row incremental rendering and explicit International score-comparison confirmation are connected to Records, including its empty state. Filtered completion summaries distinguish completed/below-target/unknown. Detailed gap selection and next-play integration are still pending.
- Verification for this UI checkpoint: root and Studio typechecks pass; 269 tests pass including catalog loading and unavailable-response interaction tests. Browser visual verification and fresh CI remain pending. React review kept network loading in explicit user actions and memoized catalog joins.
- Complete regional catalog including unplayed charts; explicit catalog/score identity matching.
- Connect next-play simulation to selected song with valid B15/B35 eligibility.
- Local persistent play queue and notes with storage validation.
- Completion gaps based on actual eligible catalog members, not counts alone.
- Unified desktop/mobile navigation and browser interaction verification.
- Add interaction coverage for song details and remaining features.
- Build and document final verification, then prepare reviewable PR.

## Self-check checkpoint: 2026-09-05
- Remote records-center head: 23e358b24afb4bf1b3dceca7a632b13033e87e37.
- GitHub Actions returned no runs for that head. Vercel Preview Comments succeeded; this is not application CI evidence.
- Isolated catalog-identity checkpoint adds joinCatalogRecords with exact-ID matching, unique legacy fallback, ambiguous-match rejection, and explicit unobserved records. Four focused tests pass.
- This is a data-layer foundation only. Catalog loading, UI, regional eligibility, and completion gaps remain pending.
- Separate worktree/branch avoids touching the existing records-center worktree. Integrate this checkpoint before continuing catalog UI.
- Follow-up self-check: records-center head is unchanged; Actions still has no runs for that head.
- Added versioned local play-queue storage helpers: immutable goal updates, duplicate/size/range validation, and explicit storage-failure propagation. Queue UI and integration remain pending.
- Focused verification: 11 tests pass across play-queue, catalog-records, and record-search. This does not replace browser or complete application verification.
- Queue UI checkpoint: Records now includes a collapsible local queue with chart selection, target achievement, notes, edit and remove. Explicitly browser-wide across imported players; no synchronization or upload. Mutations reread validated storage and report failures without claiming success.
- React review: storage only after hydration or user actions; no automatic write effect; labels and status feedback included. Desktop/mobile browser interaction verification remains pending.
- Latest check: records-center head remains unchanged with no Actions runs. Studio TypeScript and 11 focused tests pass. Broader run: 251 tests passed in 29 suites, but parser suite could not load jsdom; this is NOT a full test pass. Production build verification was interrupted by environment network approval cancellation and remains pending.
- Superseding test checkpoint: repaired isolated-worktree dependency resolution. All 31 suites / 264 tests now pass, including four new jsdom queue interaction tests (save/reload/edit/remove, invalid stored data, quota failure, and preserving another tab's saved goal). Root TypeScript and diff checks pass.
- Added explicit root React test dependencies, reusing the exact versions and integrity entries already pinned by Studio, plus JSX typechecking. Clean npm installation still needs CI verification; local runs use existing installed dependencies.
- Records-center head and Actions remain unchanged. Production build was retried but again interrupted by environment network approval cancellation. Browser layout and end-to-end verification are still pending; jsdom is not desktop/mobile visual evidence.
- Completion-gap foundation: accepts actual eligible catalog rows and returns completed, below-target, and unknown observations separately for SSS/SSS+/FC/AP. Unknown records are not called unplayed. Duplicate denominator IDs are rejected; catalog matching now withholds duplicate catalog IDs as ambiguous.
- Latest verification: 32 suites / 267 tests pass, root TypeScript and diff checks pass. Three new completion tests cover member identity, thresholds, inclusive badges, missing/ambiguous scores, and duplicate IDs. Regional catalog loading and UI connection remain pending, so completion-gap functionality is not yet complete for users. Records-center head is unchanged and still has no Actions runs.
- Draft PR #39 now tracks the isolated checkpoint: https://github.com/div-sir/Mai-Score/pull/39. This opens CI verification before remaining implementation is complete. It is not release-ready; no merge or release is authorized. Inspect Actions on the PR's latest head, not only the unchanged records-center branch.
- Catalog source inspection confirms the existing sync script filters `regions.intl` and applies international overrides. Its bundled metadata is dated 2026-08-09; this is not proof of current completeness. Studio catalog delivery and freshness verification remain pending.
- CI evidence now confirmed for PR head 3469e1838ab7b21e7a3eaaee620037b455b7a5ec: https://github.com/div-sir/Mai-Score/actions/runs/33981285582. Extension clean install/verify/package and Studio clean install/typecheck/production build all succeeded. This supersedes the prior build/clean-install evidence gap for that head, not browser verification.
- Studio predev/prebuild now generates `/data/catalog.json` from the same pinned international catalog as Extension, with region/source metadata and count/identity checks. Local generation verified 6195 rows with no player scores. Generated output is ignored by Git. Client loading, catalog UI and freshness checks remain pending. This new code still needs its own CI run.

Do not claim all competitor features are covered. Community, friends, rankings and external account integration require separate backend and authorization work. Do not publish or merge automatically.

Hourly self-check is scheduled. Inspect actual files/tests/CI; do not mark pending work done merely because a timer ran. Avoid concurrent edits if another active worker owns this branch.
