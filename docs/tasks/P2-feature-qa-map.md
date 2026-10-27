# P2 — Feature inventory + E2E impact map

**Phase:** P2 follow-up · **Status:** in progress · **Model:** light · **Feature:** F-19

## Goal

Create the durable public/internal feature inventory and E2E impact map so every new
feature knows which existing workflows it can break. This is the F-19 guardrail: a
feature → workflow → E2E matrix, kept current by every feature PR.

**Deliverable:** `docs/features/README.md`.

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
   share/read-only, export, mobile/touch. **Done — `docs/features/README.md` §Feature
   inventory + §Workflow → code → data → E2E.**
2. For each, list the code modules, data/serialization paths and E2E specs that cover
   it; mark gaps. **Done — workflow table + §Known gaps.**
3. Add a **change-impact table**: feature area → affected workflows → minimum E2E.
   **Done — §Change-impact table.**
4. Add the rule to `feature-template.md`: every feature PR updates the map and names
   the E2E it ran. **Already present** — `docs/tasks/feature-template.md` →
   Constraints → “Docs update: update the public feature catalog/tutorial and the F-19
   QA impact map.” No template edit needed (and it is coordinator-only).
5. Add a short “new object type” checklist: scene codec, guards, history, persistence,
   backup, share, export, capacity, tests. **Done — §New object type checklist**
   (11 steps, including UI/read-only and docs).
6. Verify the map against the current suite; add missing E2E only where the gap is
   material. **Done — two targeted E2E gaps closed:**
   - `e2e/export.spec.ts` → “selected board includes an in-scope cable endpoint (no
     mid-air drop)” — guards the F9 scope rule + F-02 cable-aware bounds wiring
     (previously unit-only).
   - `e2e/share.spec.ts` → “share round-trips an inline custom board (size + finish)
     read-only” — guards A5 for custom boards + save-a-copy (previously unit-only).
   All other gaps are recorded in §Known gaps with their unit coverage and decision.

## Acceptance

- A single feature inventory + impact table exists and is linked from `docs/roadmap.md`.
  **Map exists.** The roadmap is coordinator-only in this workstream, so the exact
  one-line insertion is reported to the coordinator (below).
- Every feature area names its modules, tests and dependent workflows. **Done.**
- The feature template requires an update per feature. **Already required** (step 4).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; touched E2E green.
  **Recorded in the PR.**
- One PR; no merge.

## Verification (F-19)

- `pnpm lint` — clean (2 pre-existing warnings in `tools/asset-pipeline/analyze.ts`, untouched).
- `pnpm typecheck` — clean.
- `pnpm test` — **853 passed** (93 files).
- `pnpm build` — clean (main JS `295.71 kB` gzip, unchanged).
- `pnpm exec playwright test e2e/export.spec.ts e2e/share.spec.ts` — **41 passed / 1 skipped**
  (the skipped one is desktop-only `mobile: the export tray…`), chromium + mobile-chromium.
- Code review (light, 1 pass): **approve-with-changes**; all 5 findings folded (export
  exact bounds + far-endpoint drop + painted-cable pixel + height check; share reload +
  name/brand claim removed). No second pass (simple test-only fixes; the touched E2E
  was the re-check).

## Coordinator-only follow-ups (do not edit in this PR)

**`docs/roadmap.md`** — add under the P4/P5 feature section (next to
“**Feature roadmap proposal:**”):

```md
- **Feature QA map (F-19):** `docs/features/README.md` — feature inventory, workflow → module → E2E map, change-impact table and new-object-type checklist; every feature PR updates it.
```

**`docs/progress.md`** — when the PR opens:

```md
- **F-19 — Feature inventory + E2E impact map — in review — PR #N.** Added `docs/features/README.md` (feature inventory, workflow → code → data → E2E, change-impact table, new-object-type checklist, known-gap ledger, E2E suite map); added 2 targeted E2E gaps (cable-aware selected-board export; inline custom-board share/save-copy). No catalog/shared-doc edits. Checks: lint / typecheck / test / build; e2e export + share green.
```

and update the WS line to:

```md
**WS 2026-10-27:** feature F-19 — in review (PR #N) · catalog T-3 — next (3-wide) · awaiting review 1 (feature 1/catalog 0) · billed feature ≈<tokens> · gate: 1 feature PR (cap 1), 0 catalog PRs.
```

## Notes

- This is the F-19 task from the feature roadmap proposal.
- Do not turn this into a test rewrite; it is a map plus targeted gap fixes.
- Process/rule gaps are proposed to the coordinator, not edited here.
