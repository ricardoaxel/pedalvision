# F-03 / P2-03: Measurement HUD — “Edge Rule”

**Phase:** 1 · **Status:** in review — PR #67 · **Model:** light

## Goal

Make true scale legible while working. The original bottom-left “Scale Rule”
chip was **rejected by the owner** as low-value; this direction replaces it with
a drafting-mat frame:

1. **Reactive top + left rulers** that show the viewport's cm/in span and update
   live with pan and zoom (1-2-5 cadence, world coordinates, origin + negatives).
2. A **bottom-right Scale Tag** (flush title block) with a true-length rule, the
   round length, a quiet **cm/in toggle**, the live zoom, and the current
   **grid-cell size** (“Grid 6 cm”) so the dot grid relates to real scale.
3. Mobile is **corner-only**; the tag hides while the info peek/action bar/trays
   are up. Read-only shares keep the frame. `Settings.units` is reused; cm stays
   canonical; nothing is persisted, exported or shared.

Roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture (cm→px, zoom bounds 0.1×–8×)
- `src/lib/geometry.ts`, `src/state/viewport.ts`, `src/state/settings.ts`,
  `src/canvas/Stage.tsx`, `src/canvas/GridLayer.tsx`, `src/lib/grid.ts`,
  `src/lib/ruler.ts`, `src/lib/measurementHud.ts`,
  `src/components/EdgeRules.tsx`, `src/components/ScaleTag.tsx`

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

- **cm is the source of truth.** Rulers/tag mirror `cmToDisplay`; geometry and
  scene data are untouched. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (one app-wide setting); no second unit state.
- **No new dependencies.** DOM/SVG + existing React/Konva only.
- **Read-only shares** keep the frame; no edit affordances are added.
- **Design gate:** designer proposal → owner approval → implement →
  ≤2 `design-reviewer` passes (desktop + mobile, dark + light) → fold findings.
- **Code review:** ≤1 light pass; reuse the reviewer session; tests are the
  re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, picker/canvas frame time,
  memory and share/export size; no regression.
- **Docs update:** public feature catalog + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Restate scope + executable acceptance criteria.
2. Run the designer proposal; **owner approved “Edge Rule”** (mobile hide-when-
   selected; quiet cm/in toggle) before implementation.
3. Implement: `lib/grid.ts`, `lib/ruler.ts`, `EdgeRules`, `ScaleTag`; refactor
   `GridLayer` to share the grid-cell math; replace the old chip; shift desktop
   chrome clear of the frame.
4. Add tests; run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. Run the touched E2E on desktop + mobile.
6. Run the ≤2 `design-reviewer` passes on rendered desktop + mobile, dark +
   light; fold findings.
7. Rebase onto the verified post-merge `main`; re-run checks.
8. Keep **one PR (#67)** with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- **Rulers** render on the top + left desktop edges and update on pan and zoom;
  `data-major-label`/`data-minor-label` follow the 1-2-5 cadence (e.g. 20/5 cm at
  1×, 10/2 cm at ~2×, 200/50 cm at 0.1×); labels are world coordinates, include
  `0` and negatives (U+2212), and step with the active unit.
- **Scale Tag** shows a true-length rule (`barPx = lengthCm × PX_PER_CM × scale`),
  a round length, a quiet cm/in toggle, the live zoom, and the grid-cell size.
  At 1× cm it reads **20 cm / 100% / Grid 6 cm**.
- **Grid relationship:** the tag's grid value is derived from the same
  level-of-detail math as `GridLayer` (`lib/grid.ts`), so the readout and the
  dots cannot disagree.
- **Mobile:** rulers hidden; compact tag above the dock; hidden while the info
  peek/action bar/trays/first-run are present; returns when nothing is selected.
- **Read-only shares:** rulers (desktop) + tag remain; no edit affordances.
- No geometry, scene document, share payload, export output or capacity path
  changes (the frame is derived, view-only).
- Unit tests cover ruler cadence/ticks/grid math and scale-bar truth; E2E covers
  rulers, tag, units, pan/zoom, mobile yield and read-only on desktop + mobile,
  filtering one stable item/brand.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with exact steps (the frame
  reflects transient zoom/selection, so it is not shareable), desktop + mobile.
- **Before/after screenshots** embedded for every visible change: same
  viewport/theme/state on base `main` and the PR preview, desktop + mobile;
  video/GIF for the pan/zoom/units interaction.
- Performance numbers recorded; no regression; docs/feature map updated.
- One PR; no merge.

## Design gate

- The owner **rejected the first “Scale Rule” chip** and asked for reactive edge
  rulers + a bottom-right scale corner, using a UX/UI proposal.
- Designer proposed **“Edge Rule”**; **owner approved** (top+left rulers, corner
  tag, drop the duplicate W×H, mobile hides the tag when a part is selected,
  cm/in as a quiet secondary toggle).
- `design-reviewer` pass 1 (rendered desktop + mobile, dark + light):
  **approve-with-changes** — ruler/tag measurement agreement, trailing-label
  clipping, light-theme contrast, tag padding.
- Pass 2 (full-width/no-selection, pan/origin, zoom, first-run, read-only,
  mobile selected): **approve-with-changes, no blockers** — trailing label
  clipping, left-axis optical weight, light minor ticks, tag inset, high-zoom
  corner content. The ≤2-pass cap was reached; the objective fixes (label
  visibility in the tick model, ink labels, tick hierarchy, 44 px unit target,
  action-bar yield) were folded and the remaining nits are disclosed in PR #67
  (no third pass).
- **Mobile omission:** the tag hides while a part is selected because the info
  peek already owns the bottom band (owner-approved).

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **879 passed** (96 files) — 26 new ruler/grid/scale-bar tests.
- `pnpm build` clean.
- `pnpm exec playwright test e2e/measurement-hud.spec.ts e2e/smoke.spec.ts
  e2e/info-panel.spec.ts` (desktop + mobile): **38 passed / 5 skipped**
  (the skips are the deliberate desktop/mobile `test.skip` branches).
- **Performance** (same scene, base `83ef9b0` → this branch): main JS
  **303.16 → 305.03 kB gzip** (+1.87), CSS **12.07 → 12.69 kB gzip** (+0.62);
  canvas wheel-zoom **62 → 62 fps**; JS heap **12.8 → 9.5 MB** (lower; GC
  variance); picker open median **57 → 59 ms** (5 samples); share link
  **358 → 359 B**; the frame adds **102 tick nodes / 25 labels**. Export is
  unchanged (the frame is not on the export stage).
- Screenshots: desktop selected + full-width, dark/light; pan/origin; zoom;
  first-run; read-only; mobile no-selection + selected.

## Notes

- The frame is DOM/SVG screen chrome, **not** Konva and **not** exported; the
  grid remains the canvas layer and the tag reads its cell size from the shared
  pure helper.
- The grid cell stays world-cm (6 cm at 1×); in inch mode the tag shows the
  equivalent (e.g. `2.36 in`) without changing the geometry.
- **Process/rule gaps:** propose to the owner + `token-usage-reviewer` first; do
  not edit shared rules in this PR.
- Record billed tokens by class (builder / design+vision / code review).
