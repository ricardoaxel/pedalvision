# P4-05: Cable phase-gate follow-ups (read-only jack ticks + export cable bounds)

**Phase:** P4 · **Status:** in review — PR #63 (feature lane, 2026-10-27) · **Model:** light

## Goal

Close the two real code gaps found by the P4 post-phase review without expanding the docs-only gate PR:

1. **Read-only share previews must show jack sockets.** The recipient sees cables and AMP/INSTR tags, but `PedalNode` hides all jack ticks when `readOnly` is true, so traces terminate on blank pedal edges and the read-only tick-tap cue is unreachable. `docs/design.md` §Canvas architecture says read-only previews always show the graph (cables + jack ticks + endpoints).
2. **Selected-board export bounds must include the cable curve.** The export content rect unions boards, items and endpoint chips, but not the cubic cable path; with outward handles (up to 24 cm) a long cable can bulge past the 4 cm export padding and be clipped in PNG/PDF, breaking the “export matches the on-screen curve” promise.

## Read first (context pack)

- `docs/design.md` §Canvas architecture (Cable visuals), §Export scope
- `docs/requirements.md` F12, A4/A5
- `src/canvas/PedalNode.tsx` (jack-tick render gate + read-only cue)
- `src/canvas/useCableDrag.ts` (`CABLE_SNAP_MOUSE_PX` / `CABLE_SNAP_TOUCH_PX`)
- `src/lib/exportScene.ts` (selected-board content bounds), `src/lib/cablePath.ts` (`cableCurveCm` handles), `src/canvas/exportStage.ts` (curve drawing)
- `src/lib/exportScene.test.ts`, `e2e/cables.spec.ts`, `e2e/export.spec.ts`

## Constraints

- No new dependencies; cm stays the source of truth.
- Do not change cable geometry, the 150/300 graph cap, share payload/version, or the approved visual direction.
- Exactly one PR for this task; do not merge. Two light-model review passes max if a blocker appears.

## Steps

1. **Read-only ticks:** change the jack-tick gate so ticks render when the patch is visible **or** the canvas is read-only (`showCables || readOnly`), while keeping hit discs non-mutating and the existing read-only tap cue. Confirm selection/info-sheet behavior on touch is unchanged.
2. **Export bounds:** union the sampled/control-point bounds of every in-scope `cableCurveCm` into the selected-board content rect (and verify the “all content” path is already complete). Keep the 4 cm padding and the 16.7 MP / 8192 px clamp.
3. **Tests:** unit test for a long outward-handled cable extending the selected-board export plan; e2e for a read-only share rendering jack ticks + the read-only cue; confirm no normal-scene bounds regression.
4. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
5. One PR (full standard; desktop + mobile screenshots for the read-only tick change); mark `in review — PR #N`.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
- A read-only share renders jack ticks (hollow for fallback jacks) and the tick tap shows the read-only cue; no mutation is possible.
- The selected-board export includes a long cable’s full curve/arrowhead (unit bounds test + visual check).
- Baseline 568 unit / 257 passed + 7 skipped e2e stays green (counts may rise with the new tests).
- Exactly one PR, not merged.

## Notes

- Found by the P4 phase gate review (2026-10-21): `src/canvas/PedalNode.tsx:394` and `src/lib/exportScene.ts:360-369`; the docs were corrected in the gate PR (snap radius 18/44 px, `Cable.from` typed as `CableEnd`).
- Not a P5 blocker; schedule before the launch gate or when cable exports/read-only previews are next touched.

## Implementation record (2026-10-27)

- Branch `feat/p4-05-cable-followups`, based on verified main `c3e0a7d`. One PR (#63), not merged.
- Tick gate `showCables || readOnly`; hit discs/cue/selection unchanged.
- `cableCurveBoundsCm` (exact extrema + endpoints + arrow) unions into selected-board and all-content bounds; anchor index built only when cables exist; 4 cm padding + clamps unchanged.
- Checks: lint / typecheck / test **841** / build; `e2e/cables.spec.ts` + `e2e/export.spec.ts` **49 passed, 1 skipped** (desktop + mobile). Demo selected-board export **2496 × 1430** (pre-fix 1056 tall) and 10,383 non-bg pixels above the board.
- Performance: +0.59 kB gzip; read-only frame p50/p95 16.70 ms unchanged; 60-cable export plan 0.18 ms (main 0.06 ms, one-off action).
- Reviews: `design-reviewer` approve-with-changes → **approve** (same session); light `code-reviewer` **approve** (nits folded: cable-less guard, dead helper removal, direct bounds tests, hollow-fallback E2E).
- Feature catalog + F-19 QA map updated in `docs/features/README.md` (F-02). `docs/progress.md` intentionally untouched (coordinator-owned).

## Workstream / boundaries (T-0b)

- Feature-safe: own `src/canvas/PedalNode.tsx`, `src/lib/exportScene.ts`, tests and
  this task file.
- Never edit catalog data/assets/runtime/tools or shared docs/config/deps.
- One PR; no merge; no total-count E2E; rebase after catalog merges.
- **Demo link:** full PR-preview read-only `?share=1#s=…` scene showing jack ticks and
  the long cable; 1 desktop + 1 mobile screenshot; export bounds unit proof.
- **Performance:** record bundle delta and export bounds; no regression.
- **Docs:** update the feature catalog/tutorial.
