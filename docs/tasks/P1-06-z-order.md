# P1-06: Z-order controls

**Phase:** P1 · **Status:** todo · **Model:** build-cheap

## Goal
Selected item can be brought forward / sent back one step, and brought to front / sent to back, within its parent board's item stack (loose items have their own stack). Order persists in the scene (`z` field) and survives save/reload (verified with a temporary localStorage save — full save system is P3-02).

## Read first (context pack)
- `docs/design.md` §Data model (PlacedItem.z)
- `docs/requirements.md` F5 (free z-order — no fixed slots)
- P1-04/05 files (items slice, action bar)

## Constraints
- **Z is per-container (B1):** board-attached pedals reorder within their board's group; loose items reorder within `LooseItemLayer`. There is NO global z — a pedal's z only competes with other items in the same container.
- `z` is a dense integer per container (re-normalize on change — no floats).
- Controls live in the P1-05 action bar (icons: forward/back/front/back).
- No drag-on-canvas reordering (that's layer-panel territory, not v1).

## Steps
1. Items slice: `reorder(uid, 'forward'|'back'|'front'|'bottom')` with per-container normalization
2. Action bar buttons + disabled states at extremes
3. Render: within each board's group, sort children by `z`; within `LooseItemLayer`, sort loose items by `z`
4. Temporary localStorage persist of scene on change; reload check

## Acceptance (executable)
- `pnpm test`: reorder ops incl. extremes and normalization; persist round-trip
- Manual: two overlapping pedals swap order; reload → order preserved
- Playwright smoke: reorder → reload → order unchanged

## Notes