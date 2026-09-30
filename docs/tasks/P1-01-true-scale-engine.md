# P1-01: True-scale engine (geometry lib)

**Phase:** P1 · **Status:** todo · **Model:** build-cheap

## Goal
`src/lib/geometry.ts` implements the cm↔px mapping (`px = cm × PX_PER_CM × zoom`), `PX_PER_CM` constant, rotation-about-center math, board-relative ↔ world coordinate transforms, and cm↔in display conversion — fully unit-tested, no canvas code yet.

## Read first (context pack)
- `docs/design.md` §Canvas architecture, §Data model
- `AGENTS.md` §Hard constraints

## Constraints
- Pure functions, zero Konva/DOM imports (must stay testable in Vitest).
- No rounding at storage level — round only for display (2 decimals).

## Steps
1. `PX_PER_CM` constant + `cmToPx` / `pxToCm`
2. `rotatePoint(point, center, deg)`; `boardToWorld(item, board)`; `worldToBoard(point, board)`
3. `cmToDisplay(cm, units)` ('cm' | 'in')
4. Vitest: round-trips, rotation invariants, and the **A1 invariant**: item world position identical across different viewport sizes (simulate resize via transforms)

## Acceptance (executable)
- `pnpm test` covers all functions incl. A1 invariant test
- `pnpm typecheck` passes

## Notes
This is the guardrail module — every later canvas task depends on it. Keep it dependency-free.