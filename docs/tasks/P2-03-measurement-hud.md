# F-03 / P2-03: Measurement HUD — viewport + grid readout

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Give the board a scale at a glance **without adding permanent chrome**. The
owner-approved final is a **viewport + grid readout**; the earlier “Drafting
Scale” bar was dropped because its length read as the dot pitch.

- **Always-visible readout**: `view W × H · grid N` + a compact **`cm | in`**
  toggle. It states how much real-world canvas is visible and the current dot
  cell (5 cm at 1×). View and grid both follow the active unit (`5 cm` / `2 in`);
  never a bar length, never a bare “5 dots”.
- **26 px bottom caption strip**: desktop bottom-left (16 px gutter); mobile
  bottom-right above the dock, kept visible while editing (lifted above the
  info peek). The mobile `view` subtracts the dock + peek, so it reports the
  actually visible canvas.
- **Always visible**, including an empty sheet and read-only shares; the mobile
  first-run note is lifted above it so it cannot occlude the readout.
- **The distance answer: a transient measure tool** (`M`/toolbar). Drag A→B;
  true-length dashed line + live cm/in chip (1 dp); snap to board/item corners &
  centres, jacks, endpoints, then the 5 cm grid; **Clear line**; Esc exits;
  read-only shares can measure; never persisted.
- **5 cm dot grid** at 1× (LOD 10/20/40).
- **No axis, ticks, world-coordinate labels, zoom %, fill, card or shadow.**
  Pan changes nothing; zoom re-steps the view/grid values.
- **Units** use the shared `Settings.units`; readout, chip and info panel follow.
  `cm` stays canonical; derived/view-only; never persisted/exported/shared.
- Endpoint placement stays stage-aligned; a placed endpoint does not auto-select.

Roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture / export scale bar notes
- `src/components/ScaleReadout.tsx`, `src/lib/measurementHud.ts`,
  `src/canvas/exportStage.ts` (`drawScaleBar`), `src/state/viewport.ts`,
  `src/state/settings.ts`, `src/canvas/Stage.tsx`,
  `src/styles/tokens.css`, `src/styles/theme.ts`

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/p2-03-measurement-hud/**`; update the editable rows in
  `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**; if this task needs one,
  **STOP** and report.
- Separate branch/worktree; **one PR (#67)**; no merge.

## Constraints

- **cm is the source of truth.** The readout derives from the stage/viewport;
  geometry/scene data are untouched. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (one app-wide setting); no second unit state.
- **No new dependencies.** DOM + CSS + existing React/Konva only.
- **Read-only shares** keep the readout; no edit affordances.
- **Design gate:** owner approved the viewport + grid readout; readout R1/R2
  folded (except the two known findings below); no third pass (cap).
- **Code review:** ≤1 light pass; tests are the re-check.
- **Budget:** the owner explicitly approved proceeding despite the task being far
  over its 1.1M hard cap after multiple direction changes.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share size; no regression.
- **Docs update:** public feature catalog + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Direction history: owner rejected chip/frame/axis/margin; “Drafting Scale”
   bar was implemented, then dropped after the bar length was confused with the
   dot pitch. **Owner approved the viewport + grid readout.**
2. Replace `ScaleBar` with `ScaleReadout`; always visible; remove the empty
   guard and the duplicate grid key from the measure status.
3. Readout R1 fixes: whole-number view, unit-bearing `grid`, mobile view
   subtracts dock + peek, first-run lifted, stronger active unit, readout ink.
4. Readout R2 fixes: view unit + converted grid (`5 cm` / `2 in`), measure chip
   1 dp + larger type + more offset, measure status edge/divider, mobile Clear
   line 44 px. Open: toolbar label squeeze at 1280 with the inspector open; two
   unit-toggle renderings (readout pill vs inspector segmented) — handed to the
   owner; no third visual pass.
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
6. Full E2E on a clean preview (desktop + mobile).
7. One light code-review pass; re-run the checks.
8. Keep **one PR (#67)** with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- Desktop and mobile show one **`scale-readout`** with
  `view {W} × {H} {units} · grid {N} {units}`; `data-view-width-cm`,
  `data-view-height-cm`, `data-grid-cm` are present; grid is `5 cm` / `2 in`
  at 1× and LODs to 10/20/40 cm; **no** `scale-bar`, edge/axis/ticks/world
  labels.
- The readout is visible on an empty sheet; mobile keeps it above the peek and
  it is not occluded by the first-run note; read-only shares keep it.
- Panning does **not** change the view values; zooming re-steps them.
- Mobile `view` height subtracts the 56 px dock + info peek height.
- The readout sits in the 26 px caption strip, 16 px from the desktop gutter;
  mobile bottom-right with 16 px inset.
- Switching units in the readout or the info panel updates view + grid + chip
  (`cm`/`in`); one shared setting.
- Measure: `M`/toolbar arms; drag snaps; chip 1 dp; Clear line; Esc exits;
  read-only can measure; no scene/codec/share/export changes.
- Endpoint capture stays stage-aligned; a placed endpoint does not auto-select.
- Unit tests cover readout math/snap/format; E2E covers readout, pan/zoom,
  units, empty, mobile peek, measure, read-only.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with exact steps (the readout
  reflects transient zoom/selection, so it is not shareable).
- **Before/after screenshots** embedded for desktop + mobile, dark + light, plus
  selected, measure, inches, and the empty mobile first-run case.
- Performance recorded; no regression; feature map updated.
- One PR; no merge.

## Design gate

- The owner rejected the chip/frame/axis/margin directions, approved the
  export-style bar, then replaced it with the **viewport + grid readout** after
  the bar/dot-pitch ambiguity. The measure tool and 5 cm grid are in this PR.
- **Readout R1** (design-reviewer, actual pixels): approve-with-changes —
  machine inches (`125.98 × 68.31`, `1.97 dots`), bare `dots 5`, faint active
  unit, empty mobile readout under START HERE, mobile view not subtracting the
  peek. Folded.
- **Readout R2** (design-reviewer, actual pixels): approve-with-changes —
  (1) active `in` still showed `grid 5 cm` and no view unit; (2) toolbar scene
  label squeezed at 1280 with the inspector open; (3) two unit-toggle
  renderings; (4) Clear line target/surface parity; (5) measure chip 2 dp and
  micro-type. **Folded (1), (4), (5); (2) and (3) deferred to the owner.**
  No third visual pass (hard cap); owner approval still required.
- Reviewer’s “what is good”: subtle/calm readout, legible in both themes,
  visible and un-occluded on mobile empty, re-anchors above the peek, and the
  readout tracks the real visible area (`view 103 × 162` → `103 × 196`).
- The owner’s rule applies: **subtle so it helps, never another purposeless
  element; never ambiguous numbers.**

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **870 passed** (96 files).
- `pnpm build` clean.
- Full E2E (clean preview, desktop + mobile): **286 passed / 11 skipped**.
- **Performance** (base `origin/main` 2bbc70b → this branch): main JS
  **304.71 → 306.65 kB gzip** (+1.94), CSS **12.07 → 12.61 kB gzip** (+0.54);
  wheel-zoom 61–62 fps; JS heap 12.8 MB; picker 54–67 ms; share **359 B**; the
  readout is one DOM line + two buttons; the measure overlay exists only while
  armed; export unchanged. Grid is 5 cm at 1× (LOD 10/20/40).
- Screenshots: desktop empty/full/selected/measure/inches, dark/light; mobile
  empty/full/selected/measure/inches, dark/light; base before shots.
- **Known open review findings:** desktop toolbar scene label squeeze at 1280
  with the inspector open; the readout pill and inspector segmented unit
  toggles use different visual languages (same shared setting). Owner to
  accept/defer.

## Notes

- The readout is DOM/CSS, **not** Konva and **not** exported; the true-scale dot
  grid remains the canvas surface. The readout states the visible extent + cell
  size; the measure line/chip answer the distance question.
- The old bar, axis/ruler logic and sheet tokens are gone; the 5 cm grid is the
  canvas surface and the measure tool snaps to it.
- The measure mode is transient and pointer-led; `M`/toolbar arms, Esc exits,
  Clear line clears; read-only shares can measure; no scene/codec/share/export
  changes.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Billed tokens by class are recorded in PR #67.
