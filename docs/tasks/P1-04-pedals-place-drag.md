# P1-04: Pedals — place / drag / duplicate / delete

**Phase:** P1 · **Status:** todo · **Model:** build-cheap

## Goal
User can add a catalog pedal onto a board (position stored in cm relative to the board, unrotated frame), drag it within/across boards, duplicate it, and delete it. Pedals render at true scale from catalog dimensions.

## Read first (context pack)
- `docs/design.md` §Canvas architecture, §Data model (PlacedItem)
- `src/lib/geometry.ts` (`boardToWorld`, `worldToBoard`)
- P1-03 files (scene store, BoardNode)

## Constraints
- Position math via geometry lib only — no ad-hoc transforms in components.
- Pedal images same-origin only (`src/lib/cdn.ts` from P0-04); fallback: labeled rectangle.
- Drop outside any board → item becomes "loose" (world coords), allowed (power supplies will need this).
- No rotation in this task (P1-05), no z-order (P1-06).

## Steps
1. Scene store: items slice (add/duplicate/remove/move; re-parent boardUid on drop)
2. `PedalNode` inside each board's Konva Group (inherits board transform for free)
3. Temporary pedal list UI (HTML) → add to selected board at its center
4. **Cross-board drag (S2):** on `dragstart`, detach the pedal from its board's group into the **DragLayer** (transient world-space layer); on `dragend`, reparent via `worldToBoard` hit-test against boards (or to loose layer if it lands outside any board). This keeps the pedal unskewed mid-drag over a rotated board and makes the drop hit-test run against a stable target. **Pan interrupt (R6/N3):** if a two-finger pan starts mid-drag, the pedal drops in place (reparents at its current position).

## Acceptance (executable)
- `pnpm test`: re-parenting math (drop point → correct board-relative cm under rotated board), duplicate/delete store ops
- Manual: pedal on a rotated board follows it when board moves/rotates; pedal dropped outside becomes loose
- Playwright smoke: add board + pedal → both visible
- **Playwright (N4):** with a selected pedal, drag it across boards → the Transformer follows into the DragLayer and back, and re-selection is clean after reparenting (no stale Transformer, no dropped selection)

## Notes
The rotated-board drop test is the tricky part — it's exactly the pedalplayground-bug class of error; cover it in Vitest.