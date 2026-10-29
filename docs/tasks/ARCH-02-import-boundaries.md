# ARCH-02 — Import-boundary checker

**Phase:** Architecture (cross-cutting) · **Status:** proposed — **deferred; not a
feature gate; must be re-checked and redefined before any action** · **Model:** light

> **This file is intent only — rewrite it before execution.** It was drafted on
> 2026-10-29 against the then-current code. ARCH-03b changes the layering it
> would enforce. Pick this up **only after ARCH-03b**; otherwise re-scope it and
> re-run the `token-usage-reviewer`. Before starting, re-read
> `docs/decisions/008-frontend-architecture.md`, inspect the actual import graph,
> and rewrite this task against the latest state.

## Goal (intent only)

Prevent the layer inversion from coming back. Add a zero-dependency check that
fails when:

- `src/domain/**` imports `state/`, `services/`, `canvas/`, `features/`,
  `components/` or `shared/`;
- `src/state/**` imports `canvas/`, `features/` or `components/`;
- `src/canvas/**` imports `features/` or `components/`;
- any relative import escapes its top-level layer (`../../` from inside a
  layer), and
- the four deleted barrel files are reintroduced.

The check should run in CI (e.g. `pnpm check:arch`).

## Why deferred

- The current code **already violates** the boundary (`src/lib/**` → `state/scene`),
  so enabling the rule now requires a grandfather allowlist that ARCH-03b then
  deletes. Running it after ARCH-03b is simpler and more meaningful.
- It is **not needed to continue feature work**. Strict mode (ARCH-01) is the
  only gate.
- ADR-008 requires every deferred item to be redefined against the latest
  codebase before scheduling.

## Re-scope checklist (when this is picked up)

1. Re-read ADR-008 and `docs/roadmap.md` → ARCH.
2. Run a fresh import-graph analysis; list current violations.
3. Decide: allowlist (if run before ARCH-03b) or zero-baseline (after).
4. Confirm no new dependency is needed (prefer a small `tools/architecture-check`
   script or a Vitest test over `dependency-cruiser`/`madge`).
5. Wire it into CI + `package.json` scripts.
6. Rewrite this task with the actual rules and file list.

## Non-goals

- No code moves, no refactors, no runtime changes.
- No new dependencies.
- No edits to catalog data/assets/tools.
