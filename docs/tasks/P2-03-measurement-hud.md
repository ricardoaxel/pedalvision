# F-03 / P2-03: Measurement HUD — “Drafting Scale”

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Give the board a scale at a glance **without adding a screen element**. After the
rejected “Scale Rule” chip, “Edge Rule” frame, “Sheet Margin” and “Pencil Margin”
axis, the owner-approved final is **“Drafting Scale”**: the app’s own **export
scale bar**, used as the only on-canvas measurement.

- **One true-length bar**: line + 8 px end caps + one explicit `= 20 cm` label, 11 px mono,
  `--color-ink-muted` — the same geometry/ink/font/label as the PNG/PDF export.
- **22 px bottom caption strip outside the stage**: desktop **bottom-left**
  (16 px gutter); mobile **bottom-right** above the dock (16 px inset), and it
  stays visible while editing (lifted above the info peek).
- **No axis, ticks, world-coordinate labels, grid readout, zoom %, unit glyph,
  left gutter, fill, card or shadow.** Pan changes nothing; zoom re-steps the
  label/bar. The bar is hidden on an empty scene (nothing to measure).
- **Units** live in the info panel; the bar follows `Settings.units`. `cm` stays
  canonical; derived/view-only; never persisted, exported or shared.
- Endpoint placement stays stage-aligned; a placed endpoint does not auto-select.
- Mobile hides the bar only for the picker/trays/first-run/graph cues; the scale
  stays visible while a part is selected.

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
- **Design gate:** designer “Drafting Scale”; owner approved; 2 review rounds
  (R1/R2) folded; no third.
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
- **Post-R2 product review:** the `pedal-user` and `designer` agents reviewed the
  concept. Both agree the bar is a **scale/trust cue**, not the answer to “how
  much gap/distance?”. The real next feature is an on-demand **measure tool**
  (snap edge/centre/jack, live cm/in, ephemeral) plus a readable 5 cm grid key;
  that is a **new feature task**, not this PR. The bar is kept as an explicit
  `= 20 cm` scale key and stays visible while editing on mobile.
- The owner’s rule applies: **subtle so it helps, never another purposeless
  element.**

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **863 passed** (95 files).
- `pnpm build` clean.
- Full E2E (clean preview, desktop + mobile): **276 passed / 11 skipped**.
- **Performance** (base `a5c63aa` → this branch): main JS **303.16 → 303.57 kB
  gzip** (+0.41), CSS **12.07 → 12.39 kB gzip** (+0.32); wheel-zoom 61–62 fps;
  JS heap 12.8 MB; picker median 67 ms this run (58–75 samples; prior 54–57;
  the bar is outside the picker path); share **359 B**; the bar is a single DOM
  track + label (no SVG axis); export unchanged.
- Screenshots: desktop full-width + selected, dark/light; pan/zoom; first-run;
  read-only; mobile idle + selected (dark/light).

## Notes

- The bar is DOM/CSS, **not** Konva and **not** exported; the true-scale dot grid
  remains the canvas surface. The bar is the key that makes the grid legible.
- Units change in the info panel; the bar follows. The mobile bar is the only
  scale cue on a phone and hides while editing.
- The old axis/ruler logic and sheet tokens were deleted; the grid LOD helper
  stays only for `GridLayer`.
- **Next feature (recommended):** a temporary measure tool + 5 cm grid key. It
  answers the actual “does it fit / how much gap?” question the bar cannot; the
  bar remains a cheap “roughly life-size” key. Do not add it to this PR.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Billed tokens by class are recorded in PR #67.
