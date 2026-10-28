# F-03 / P2-03: Measurement HUD — “Drafting Scale”

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Give the board a scale at a glance **without adding a screen element**. After the
rejected “Scale Rule” chip, “Edge Rule” frame, “Sheet Margin” and “Pencil Margin”
axis, the owner-approved final is **“Drafting Scale”**: the app’s own **export
scale bar**, used as the only on-canvas measurement.

- **One true-length scale bar**: `0 — 20 cm` end labels, 1 px line + 8 px caps,
  11 px mono, with a segmented **`cm | in`** control — the app’s export language.
- **26 px bottom caption strip outside the stage**: desktop **bottom-left**
  (16 px gutter); mobile **bottom-right** above the dock, kept visible while
  editing (lifted above the info peek).
- **The actual distance answer: a transient measure tool** (`M`/toolbar). Drag
  A→B; true-length dashed line + live cm/in chip; snap to board/item corners &
  centres, jacks, endpoints, then the current grid cell; **Clear line**; Esc
  exits; read-only shares can measure; never persisted.
- **5 cm dot grid** at 1× (LOD 10/20/40); the measure status carries the live
  grid key.
- **No axis, ticks, world-coordinate labels, zoom %, fill, card or shadow.**
  Pan changes nothing; zoom re-steps the bar/labels. The bar hides on an empty
  scene; mobile hides it only for picker/trays/first-run/graph cues.
- **Units** use the shared `Settings.units`; the bar, chip and info panel follow.
  `cm` stays canonical; derived/view-only; never persisted/exported/shared.
- Endpoint placement stays stage-aligned; a placed endpoint does not auto-select.

Roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture / export scale bar notes
- `src/components/ScaleBar.tsx`, `src/lib/measurementHud.ts`,
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

- **cm is the source of truth.** The bar mirrors `cmToPx`; geometry/scene data are
  untouched. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (one app-wide setting); no second unit state.
- **No new dependencies.** DOM + CSS + existing React/Konva only.
- **Read-only shares** keep the bar; no edit affordances.
- **Design gate:** designer “Drafting Scale”; owner approved; bar R1/R2 and
  measure-UI R1/R2 folded; no third.
- **Code review:** ≤1 light pass; tests are the re-check.
- **Budget:** the owner explicitly approved proceeding despite the task being far
  over its 1.1M hard cap after multiple direction changes.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share size; no regression.
- **Docs update:** public feature catalog + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Designer “Drafting Scale” (one export-style bar) proposed; **owner approved**
   (desktop bottom-left, 22 px caption strip).
2. Implement `ScaleBar`; delete the ruler axis/`ruler.ts`, the left gutter and
   the sheet-axis tokens; keep the endpoint-overlay/auto-select fix.
3. R1: line/caps full ink-muted + optical center; 16 px desktop gutter; 16 px
   mobile insets; hide on an empty scene.
4. R2: faint stage-bottom edge to define the caption strip; lift the desktop bar
   inside it; normalize label tracking. No third round.
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
6. Full E2E on a clean preview (desktop + mobile).
7. One light code-review pass; re-run the checks.
8. Keep **one PR (#67)** with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- Desktop shows **one** `scale-bar` with a true-length track and a
  `20 cm`-format label at 1× (`data-bar-px = lengthCm × PX_PER_CM × scale`);
  **no** `edge-rules`/axis/ticks/world labels; no grid/zoom/unit chrome.
- Panning does **not** change the bar; zooming re-steps the round label/bar.
- The bar sits in the 22 px bottom margin, aligned to the 16 px chrome gutter;
  mobile sits 16 px above the dock and 16 px from the right.
- Switching units in the info panel updates the bar label (`cm`/`in`); no second
  unit state.
- The bar is hidden on an empty scene and in read-only shares it is visible with
  no edit affordances.
- Mobile keeps the bar visible while a part is selected (lifted above the peek)
  and hides it only for the picker/trays/first-run/graph cues.
- Endpoint capture stays stage-aligned; a placed endpoint does not auto-select.
- Unit tests cover true-length/scale-bar truth; E2E covers the bar, pan/zoom,
  units, empty, mobile yield, read-only, endpoint-at-tap.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with exact steps (the bar
  reflects transient zoom/selection, so it is not shareable).
- **Before/after screenshots** embedded for desktop + mobile, dark + light, plus
  pan/zoom, first-run and read-only.
- Performance recorded; no regression; feature map updated.
- One PR; no merge.

## Design gate

- Owner rejected the chip/frame/axis directions and asked for the lightest,
  most site-native result. Designer proposed **“Drafting Scale”**; **owner
  approved** (one export-style bar, desktop bottom-left, 22 px caption strip).
- **R1** approve-with-changes: bar line/caps weaker than the label (light nearly
  invisible); desktop bar 6 px off the app gutter; mobile tight/right inset;
  label optically low; empty sheet shows a phantom scale.
  Folded: full ink-muted 1.5 px line + centered caps, 16 px gutters, mobile
  breathing, empty-scene suppression.
- **R2** approve-with-changes: desktop bar hugging the viewport bottom; mobile
  right inset; the 22 px strip invisible; unit parity; mobile hide vs desktop.
  Folded: bar lifted within the strip, faint stage-bottom edge to define it,
  label tracking normalized. **No third round.**
- **Post-R2 product review:** the `pedal-user` and `designer` agents agreed the
  bar is a **scale/trust cue**, not the answer to “how much gap/distance?”. The
  owner then **included the measure tool + 5 cm grid + cm/in control in this
  PR**. The bar is a `0 — 20 cm` scale key; the measure tool answers the actual
  distance question.
- **Measure UI reviews:** R1 (status under toolbar, selection overlap, unit
  control, mobile Esc, line weight) and R2 (bar meaning, edge inset, copy/clear,
  mobile wrap) were folded. The bar/measure stay subtle; the line/chip are the
  only active-tool chrome.
- The owner’s rule applies: **subtle so it helps, never another purposeless
  element.**

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **871 passed** (96 files).
- `pnpm build` clean.
- Full E2E (clean preview, desktop + mobile): **286 passed / 11 skipped**.
- **Performance** (base `a5c63aa` → this branch): main JS **303.16 → 305.23 kB
  gzip** (+2.07), CSS **12.07 → 12.70 kB gzip** (+0.63); wheel-zoom 61–62 fps;
  JS heap 12.8 MB; picker 54–67 ms across runs; share **359 B**; the bar is one
  DOM track + labels; the measure overlay exists only while armed; export
  unchanged. Grid is 5 cm at 1× (LOD 10/20/40).
- Screenshots: desktop full-width + selected, dark/light; pan/zoom; first-run;
  read-only; mobile idle + selected (dark/light).

## Notes

- The bar is DOM/CSS, **not** Konva and **not** exported; the true-scale dot grid
  remains the canvas surface. The bar is the key that makes the grid legible.
- Units change in the info panel; the bar follows. The mobile bar is the only
  scale cue on a phone and hides while editing.
- The old axis/ruler logic and sheet tokens were deleted; the 5 cm grid is the
  canvas surface and the measure tool snaps to it. The bar is a cheap
  “roughly life-size” key; the measure line/chip answer the distance question.
- The measure mode is transient and pointer-led; `M`/toolbar arms, Esc exits,
  Clear line clears; read-only shares can measure; no scene/codec/share/export
  changes.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Billed tokens by class are recorded in PR #67.
