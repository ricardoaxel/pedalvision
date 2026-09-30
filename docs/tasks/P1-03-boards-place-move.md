# P1-03: Boards — place / move / rotate

**Phase:** P1 · **Status:** todo · **Model:** build-cheap

## Goal
User can pick a pedalboard from a temporary HTML list, it appears centered in the current viewport, and can be dragged and rotated anywhere on the infinite canvas. Multiple boards coexist. State lives in the scene store (cm, world coordinates).

## Read first (context pack)
- `docs/design.md` §Canvas architecture, §Data model (PlacedBoard)
- `src/lib/geometry.ts`, `src/canvas/Stage.tsx` (P1-01/02)
- `src/catalog/load.ts` + seed (P0-05)

## Constraints
- Board positions/sizes in cm only; pixels computed at render.
- Temporary plain HTML list for picking (real picker is P2-01) — no modal work.
- Board rotation: any angle via a rotate handle (basic Transformer ok here; polished touch UX is P1-05).
- No pedals yet.

## Steps
1. `state/scene.ts`: boards slice (add/move/rotate/remove)
2. `BoardNode`: Konva Group at world cm position; image layer via `use-image` from `src/lib/cdn.ts` (P0-04 — same-origin `/pedal-assets/`)
3. Temporary `BoardPicker` (HTML list from catalog boards) → adds board at viewport center (world coords)
4. Drag bound to stage (don't fight stage pan: drag starts on the board, pan starts on empty space)

## Acceptance (executable)
- `pnpm test`: scene store add/move/rotate; viewport-center world-position calculation
- Manual: two boards placed, moved, rotated; zoom in/out — sizes stay true relative to each other
- Playwright smoke: add board → node exists on stage

## Notes
Board images come from the synthetic seed (P0-05); fall back to a drawn rectangle with dimensions label if image missing.