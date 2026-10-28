# F-03 / P2-03: Measurement HUD — “Sheet Margin”

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Make true scale legible without putting chrome on the drawing. The owner rejected
the first “Scale Rule” chip and then the heavier “Edge Rule” frame; this is the
owner-approved **“Sheet Margin”**:

1. **Left + bottom rulers only**, in a **24 px left / 24 px bottom gutter outside
   the stage** (same canvas colour, no filled band). One 1 px L hairline, short
   ticks and sparse 1-2-5 world-coordinate labels; unit `cm` once in the
   bottom-left corner.
2. A flat **bottom-right scale block** flush in the bottom margin: true-length
   bar → round length → quiet `cm · in` pair → zoom → grid cell. No fill, radius
   or shadow; it is a title block, not a card.
3. **No desktop chrome shift** (only left-anchored chrome aligns to the wider
   margin); the canvas keeps its base chrome offsets.
4. Mobile: no margins/rulers; a tiny **bottom-right one-line readout** above the
   dock, hidden while the info peek/action bar/trays are up.
5. Reuse `Settings.units`; cm stays canonical; derived/view-only; read-only
   shares keep the sheet; nothing is persisted, exported or shared.

Roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture (cm→px, zoom bounds 0.1×–8×)
- `src/lib/geometry.ts`, `src/state/viewport.ts`, `src/state/settings.ts`,
  `src/canvas/Stage.tsx`, `src/canvas/GridLayer.tsx`, `src/lib/grid.ts`,
  `src/lib/ruler.ts`, `src/lib/measurementHud.ts`,
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

- **cm is the source of truth.** The margins/tag mirror `cmToDisplay`; geometry
  and scene data are untouched. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (one app-wide setting); no second unit state.
- **No new dependencies.** DOM/SVG + existing React/Konva only.
- **Read-only shares** keep the sheet; no edit affordances are added.
- **Design gate:** designer proposal → owner approval → implement →
  ≤2 `design-reviewer` passes (desktop + mobile, dark + light) → fold findings.
- **Code review:** ≤1 light pass; reuse the reviewer session; tests are the
  re-check.
- **Budget:** the owner explicitly approved proceeding despite the task being
  over its 1.1M hard cap after two direction changes.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share size; no regression.
- **Docs update:** public feature catalog + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Designer “Sheet Margin” proposal; **owner approved** (left+bottom 16/24 →
   execution review widened the left to 24; corner label + block toggle;
   bottom-right mobile readout).
2. Implement: `lib/ruler.ts` left/bottom, `EdgeRules`, `ScaleTag`, stage inset,
   base chrome offsets, tokens/theme, tests.
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. Run the full E2E on a clean preview (desktop + mobile).
5. Run the ≤2 `design-reviewer` passes; fold findings.
6. Run one light code-review pass; re-run the checks + full E2E.
7. Keep **one PR (#67)** with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- **Left + bottom rulers** render outside the stage; `data-gutter-x/y = 24`,
  `data-major-label = 50` / `data-minor-label = 25` at 1× cm; labels are world
  coordinates (pan with content, `0` + U+2212 negatives); no top ruler.
- **No canvas occlusion:** the stage is inset by the gutters; a board/item at
  world (0,0) is fully visible.
- **Sparse cadence:** major 1-2-5 labels ≥120 px apart; minors at half; labels
  step with zoom and units.
- **Flat scale block:** true-length bar (`barPx = lengthCm × PX_PER_CM × scale`),
  round length, quiet `cm · in` pair, zoom, grid cell; no fill/radius/shadow;
  at 1× cm it reads **20 / cm · in / 100% / grid 6 cm**.
- **Grid relationship:** the block reads the same LOD math as `GridLayer`
  (`lib/grid.ts`), so the dots and the readout cannot disagree.
- **No desktop chrome shift:** scene plate/toolbar/first-run/panels keep their
  base top offsets; only left-anchored chrome aligns to the 24 px margin.
- **Mobile:** no rulers; compact bottom-right readout with the unit pair; hidden
  while the info peek/action bar/trays/first-run/picker are up.
- **Read-only shares:** desktop sheet + block, mobile readout; no edit
  affordances.
- Unit tests cover cadence/ticks/grid/scale-bar truth; E2E covers rulers,
  pan/zoom, units, mobile yield, read-only on desktop + mobile, filtering one
  stable item/brand.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with exact steps (the sheet
  reflects transient zoom/selection, so it is not shareable).
- **Before/after screenshots** embedded for the desktop + mobile, dark + light,
  plus pan/origin, zoom, first-run and read-only.
- Performance recorded; no regression; feature map updated.
- One PR; no merge.

## Design gate

- Owner rejected the first **“Scale Rule”** chip and then the **“Edge Rule”**
  frame; approved **“Sheet Margin”** (left + bottom, outside the canvas,
  discreet, no chrome shift).
- `design-reviewer` pass 1 (desktop + mobile, dark + light):
  **approve-with-changes** — left gutter too tight, light frame too faint, title
  bar heavy/off-baseline, unit toggle undiscoverable, mobile flush-right.
- Pass 2: **desktop dark approve**; **light / mobile approve-with-changes** —
  axis labels too faint, unit toggle absent on mobile, corner `cm` hugging the
  edge, two duplicate unit toggles with the info rail. Folded: left gutter
  24 px, light labels to ink, `cm · in` pair on mobile, corner unit aligned,
  static unit in the block when the info panel owns the toggle. The ≤2-pass cap
  was reached; no third pass. Remaining nits (title-block bar/axis near-double
  line; intentional L-shape) are disclosed in PR #67.

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **880 passed** (96 files).
- `pnpm build` clean.
- Full E2E (clean preview, desktop + mobile): **276 passed / 11 skipped**.
- **Performance** (same scene, base `a5c63aa` → this branch): main JS
  **303.16 → 305.14 kB gzip** (+1.98), CSS **12.07 → 12.75 kB gzip** (+0.68);
  canvas wheel-zoom **62 → 62 fps**; JS heap **12.8 → 13.6 MB** (GC variance);
  picker open median **57 → 54 ms**; share **358 → 359 B**; the frame is
  **21 tick nodes / 8 labels** (sparse 1-2-5). Export unchanged.
- Screenshots: desktop full-width + selected, dark/light; pan/origin; zoom;
  first-run; read-only; mobile no-selection + selected.

## Notes

- The sheet margins are DOM/SVG screen chrome, **not** Konva and **not**
  exported. The dot grid stays the canvas layer; the block reads its cell size
  from the shared pure helper.
- The grid cell stays world-cm (6 cm at 1×); in inch mode the block shows the
  equivalent (`2.36 in`) without changing the geometry.
- Endpoint placement no longer auto-selects the new endpoint (the delete bar
  could cover a nearby jack with the frame inset); select the tag to delete it.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Billed tokens by class are recorded in PR #67.
