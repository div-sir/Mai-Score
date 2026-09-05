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
- Complete regional catalog including unplayed charts; explicit catalog/score identity matching.
- Connect next-play simulation to selected song with valid B15/B35 eligibility.
- Local persistent play queue and notes with storage validation.
- Completion gaps based on actual eligible catalog members, not counts alone.
- Unified desktop/mobile navigation and browser interaction verification.
- Add interaction coverage for song details and remaining features.
- Build and document final verification, then prepare reviewable PR.

Do not claim all competitor features are covered. Community, friends, rankings and external account integration require separate backend and authorization work. Do not publish or merge automatically.

Hourly self-check is scheduled. Inspect actual files/tests/CI; do not mark pending work done merely because a timer ran. Avoid concurrent edits if another active worker owns this branch.
