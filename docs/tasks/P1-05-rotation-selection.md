# P1-05: Free rotation + selection UX

**Phase:** P1 · **Status:** todo · **Model:** build-strong

## Goal
Click/tap selects an item (hover outline on desktop), a Konva Transformer enables rotation to **any angle**, and a small action bar appears under the selection (rotate, duplicate, delete — stompboxgarden pattern) sized for touch.

## Read first (context pack)
- `docs/decisions/001-canvas-library.md` §Risks (touch rotate is the big one)
- `docs/requirements.md` F4, F6
- P1-03/04 files (nodes, scene store)

## Constraints
- Rotation stored in degrees, any value (no snap; Shift = 15° snap).
- Transformer anchors enlarged for touch (custom anchor style ~28px hit area).
- Selection state in a dedicated `state/selection.ts` store (uid, kind) — not on the nodes.
- Stage click/tap on empty space clears selection.
- Action bar is HTML positioned from the node's screen coords (recomputed on stage transform) — not a Konva shape.
- **Rotated-parent landmine (S3):** rotating a pedal that sits inside a rotated board group is the classic broken-anchor case. **Transformer placement (B2):** for board-attached pedals the Transformer is added as a **sibling inside the board's group** (same coordinate frame as the pedal — correct under a rotated parent); only loose items use the `SelectionLayer` Transformer. Rotation math must not fight the parent transform. Covered explicitly in Acceptance below.
- **Hover outline recompute (N3):** the hover outline lives in `SelectionLayer` (world coords), but board-attached pedals store board-relative cm — so the outline must be recomputed via `boardToWorld` whenever the board or stage transform changes. Do NOT assume the outline inherits the board transform "for free" (only the pedal's own render does).

## Steps
1. Selection store + hover outline (desktop pointermove)
2. `SelectionLayer`: Transformer for **loose items only**; board-attached pedals get their Transformer inside their board's group (see B2 constraint)
3. HTML action bar under selection (buttons wired to store ops)
4. Touch check on a real device: select, rotate, delete all doable with thumbs
5. Rotated-parent check: rotate a pedal on a board rotated to e.g. 30° — anchors track correctly, pedal stays on the board

## Acceptance (executable)
- `pnpm test`: selection store transitions; rotation write path (deg normalization to 0–360)
- Manual: mouse rotate with handle; Shift-snap; touch rotate on device; action bar follows zoom/pan
- **Playwright/Vitest (S3):** rotate a pedal on a rotated board → pedal rotation is correct relative to the pedal; board transform unaffected; anchors track the rotated parent

## Notes
If touch rotation feels bad in practice, note it in the PR — fallback is a two-finger-rotate gesture on the selected node (known Konva recipe), not a slider.