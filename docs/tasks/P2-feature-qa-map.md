# P2 — Feature inventory + E2E impact map

**Phase:** P2 follow-up · **Status:** proposed · **Model:** light

## Goal

Create the durable public/internal feature inventory and E2E impact map so every new
feature knows which existing workflows it can break. This is the F-19 guardrail: a
feature → workflow → E2E matrix, kept current by every feature PR.

## Read first

- `docs/requirements.md` (F1–F12, A1–A5)
- `docs/design.md` (canvas, persistence, share, export, capacity)
- `docs/tasks/P5-03d-parallel-workstreams.md` (feature boundaries)
- `docs/progress.md`, existing `e2e/**`

## Workstream / boundaries

- Feature-safe: own `docs/features/**` (new), this task file, and `e2e/**`; never edit
  catalog data/assets/runtime/tools or shared docs/config/deps.
- One PR; no merge; no total-count E2E; filter stable items.

## Steps

1. Inventory the main user workflows: add/place/move/rotate, picker/search, custom
   parts, boards, layers, cables, power (future), save/load/backup, undo/redo,
   share/read-only, export, mobile/touch.
2. For each, list the code modules, data/serialization paths and E2E specs that cover
   it; mark gaps.
3. Add a **change-impact table**: feature area → affected workflows → minimum E2E.
4. Add the rule to `feature-template.md`: every feature PR updates the map and names
   the E2E it ran.
5. Add a short “new object type” checklist: scene codec, guards, history, persistence,
   backup, share, export, capacity, tests.
6. Verify the map against the current suite; add missing E2E only where the gap is
   material.

## Acceptance

- A single feature inventory + impact table exists and is linked from `docs/roadmap.md`.
- Every feature area names its modules, tests and dependent workflows.
- The feature template requires an update per feature.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; touched E2E green.
- One PR; no merge.

## Notes

- This is the F-19 task from the feature roadmap proposal.
- Do not turn this into a test rewrite; it is a map plus targeted gap fixes.
