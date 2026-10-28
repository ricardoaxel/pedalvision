# F-03 / P2-03: Measurement HUD — “Pencil Margin”

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Make the scale readable **without adding a second screen element**. After two
rejected directions (the “Scale Rule” chip, then the “Edge Rule” frame), the
owner-approved final is **“Pencil Margin”**: a single faint bottom axis with a
few sparse unit-marked world labels, plus a tiny bottom-right **`[bar] 10 cm`**
readout on mobile only. Every mark must help or be deleted.

- **Desktop:** a 10 px left / 22 px bottom outside gutter; one faint bottom axis
  (no left ticks, no left hairline, no filled band); labels `0 / 100 / 200 / 300`
  at 1× (11 px), one unit at the axis end; no minor ticks; no desktop scale bar,
  no zoom %, no unit glyph, no grid line, no card.
- **Mobile:** no axis; a tiny bottom-right `[bar] 10 cm` readout above the dock,
  hidden while the info peek/action bar/trays/picker/first-run are up.
- **Units:** the app-wide `Settings.units` in the info panel; the axis and mobile
  readout follow it. `cm` stays canonical; the frame is derived/view-only and is
  never persisted, exported or shared.
- Endpoint placement is stage-aligned again (the inset needed the capture layer
  to match the stage) and a placed endpoint no longer auto-selects.

Roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture (cm→px, zoom bounds 0.1×–8×)
- `src/lib/geometry.ts`, `src/state/viewport.ts`, `src/state/settings.ts`,
  `src/canvas/Stage.tsx`, `src/lib/ruler.ts`, `src/lib/measurementHud.ts`,
  `src/components/EdgeRules.tsx`, `src/components/ScaleTag.tsx`,
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

- **cm is the source of truth.** The axis/readout mirror `cmToDisplay`; geometry
  and scene data are untouched. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (one app-wide setting); no second unit state.
- **No new dependencies.** DOM/SVG + existing React/Konva only.
- **Read-only shares** keep the axis/readout; no edit affordances are added.
- **Design gate:** the owner drove 3 review rounds (R1→R3); fold findings; no
  fourth pass. Every visual element must earn its place.
- **Code review:** ≤1 light pass; tests are the re-check.
- **Budget:** the owner explicitly approved proceeding despite the task being
  over its 1.1M hard cap after multiple direction changes.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share size; no regression.
- **Docs update:** public feature catalog + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Designer “Pencil Margin” proposal; owner-approved (the most discreet variant).
2. Implement: bottom-axis `ruler.ts`, `EdgeRules`, mobile-only `ScaleTag`, stage
   inset, endpoint-overlay alignment, tokens/theme, tests.
3. R1: delete the left tick ladder, bare `cm` glyph and `%`; add `0` + unit-marked
   axis labels.
4. R2: delete the lone left hairline; lift the readout off the label baseline;
   darken light ink/bump type; inset the origin.
5. R3: delete the duplicate desktop scale bar; run the axis to the edge with one
   unit at its end; drop the unlabelled minor ticks. No fourth pass.
6. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
7. Run the full E2E on a clean preview (desktop + mobile).
8. One light code-review pass; re-run the checks + full E2E.
9. Keep **one PR (#67)** with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- **Desktop:** one bottom axis (no left ticks/hairline), `data-gutter-x/y = 10/22`,
  `data-major-label = 100` / `data-minor-label = 50` at 1×; labels `0 / 100 / 200`
  (bare) with one `cm`/`in` at the axis end; no minor ticks; no desktop scale bar;
  no tag; labels pan with content and include U+2212 negatives.
- **No canvas occlusion:** the stage is inset by the gutters; a board at world
  (0,0) is visible; the endpoint capture layer matches the stage box.
- **Mobile:** `[bar] 10 cm` above the dock; hidden while the info peek/action
  bar/trays/picker/first-run are up; returns when nothing is selected.
- **Units:** the info panel toggle updates the axis unit and the mobile readout;
  `cm` stays canonical.
- **Read-only shares:** desktop axis + mobile readout, no edit affordances.
- Unit tests cover cadence/ticks/scale-bar truth; E2E covers the axis, pan/zoom,
  units, mobile yield/readout and read-only on desktop + mobile.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with exact steps (the axis
  reflects transient zoom/selection, so it is not shareable).
- **Before/after screenshots** embedded for desktop + mobile, dark + light, plus
  pan/origin, zoom, first-run and read-only.
- Performance recorded; no regression; feature map updated.
- One PR; no merge.

## Design gate (3 rounds, owner-authorized)

- Owner rejected the “Scale Rule” chip and the “Edge Rule” frame; approved the
  **Pencil Margin** and asked for 3 UX/visual rounds.
- **R1** (purpose): left tick ladder, bare `cm` glyph and `%` do not earn their
  place → deleted; axis labels get `0` + unit.
- **R2** (craft/contrast): light ink too faint, readout on the label baseline,
  origin cramped, left hairline dead weight → light ink darkened, type 11 px,
  bottom gutter 22, readout top row, left hairline deleted.
- **R3** (final): desktop bar duplicates the axis and the 1× label/bar mismatch →
  **desktop bar deleted**, axis runs to the edge with one unit at the end, origin
  inset, minor ticks dropped. **No fourth pass.** Mobile keeps the tiny bar as
  the only scale cue.
- The owner’s rule — “subtle so it helps, not another purposeless element” — is
  the acceptance line for every deletion.

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **875 passed** (96 files).
- `pnpm build` clean.
- Full E2E (clean preview, desktop + mobile): **276 passed / 11 skipped**.
- **Performance** (base `a5c63aa` → this branch): main JS **303.16 → 304.67 kB
  gzip** (+1.51), CSS **12.07 → 12.58 kB gzip** (+0.51); wheel-zoom **62 → 62
  fps**; JS heap **12.8 → 12.8 MB**; picker median **57 → 56 ms**; share
  **358 → 359 B**; the axis is **3 tick nodes / 3 labels**; export unchanged.
- Screenshots: desktop full-width + selected, dark/light; pan/origin; zoom;
  first-run; read-only; mobile readout + selected.

## Notes

- The axis is DOM/SVG screen chrome, **not** Konva and **not** exported. The dot
  grid stays the canvas layer; the grid-cell readout was removed because it did
  not help at a glance.
- Units change in the info panel; the axis/readout follow. The mobile readout is
  the only scale cue on a phone and hides while editing.
- Endpoint placement is stage-aligned; a placed endpoint no longer auto-selects.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Billed tokens by class are recorded in PR #67.
