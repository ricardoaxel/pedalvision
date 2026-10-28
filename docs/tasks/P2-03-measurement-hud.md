# F-03 / P2-03: Measurement HUD (live dimensions + scale reference)

**Phase:** 1 · **Status:** in review — PR pending · **Model:** light

## Goal

Make true scale legible while working. Today the selected part's real W×H only
appears in the info panel, and nothing on the canvas says what the current zoom
means in centimetres. This task adds a small, non-modal **measurement HUD**:

1. a **live readout** of the selected item's actual footprint (W × H) and the
   current zoom/scale, following `Settings.units` (cm default, in optional);
2. a **screen-edge scale reference** (a drafted length bar / unit indicator) so
   the user can judge approximate size at the current zoom without leaving the
   canvas.

It delivers roadmap item **F-03** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — F2 (true scale), Settings unit toggle
- `docs/design.md` — §Canvas architecture (cm→px mapping, zoom bounds) and
  §Data model (`Settings.units`)
- `src/lib/geometry.ts` (`PX_PER_CM`, `cmToPx`, `cmToDisplay`),
  `src/state/viewport.ts` (`MIN_SCALE`/`MAX_SCALE`, `scale`),
  `src/state/settings.ts` (`units`), `src/state/selection.ts`,
  `src/state/scene.ts` (`resolveItem`, `itemFootprint`),
  `src/canvas/Stage.tsx` (HUD overlay sibling), `src/components/InfoPanel.tsx`
  (existing dimension formatting + units toggle), `src/lib/partInfo.ts`
  (`formatDimensions`), `src/canvas/exportStage.ts` (`drawScaleBar`, the existing
  drafting scale-bar reference).

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/p2-03-measurement-hud/**`; update the editable rows in
  `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: if this task needs one,
  **STOP** and report — it becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- **cm is the source of truth.** The HUD mirrors `cmToDisplay`; it never stores
  or mutates geometry. Zoom/pan stay on the stage transform only.
- **Reuse `Settings.units`** (single app-wide toggle); do not add a second unit
  state. A unit change updates the info panel and the HUD together.
- **No new dependencies.** CSS + existing React/Konva only.
- **Read-only shares** keep the HUD (measurement is useful on a shared layout);
  it must not imply editability.
- **Design gate:** designer proposal → owner approval → implement →
  ≤2 `design-reviewer` passes on desktop + mobile (dark + light) → fold findings.
- **Code review:** ≤1 light pass (≤2 only for high-risk / a blocker); reuse the
  reviewer session; the test suite is the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review allowance
  ≤300k; task hard cap ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, picker/canvas frame time,
  memory and share/export size; no regression beyond thresholds.
- **Docs update:** public feature catalog/tutorial entry + the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Restate the scope and executable acceptance criteria.
2. Run the designer proposal; **STOP for owner approval** before code.
3. Implement in the feature worktree (canvas HUD overlay + pure formatting helper).
4. Add/keep tests; run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. Run the touched E2E flow on desktop + mobile.
6. Rebase onto the verified post-merge `main`; re-run the affected checks.
7. Open exactly one PR with the standard sections, including the **feature demo
   link**; do not merge.

## Acceptance (executable)

- With an item selected, the HUD shows its actual W × H computed from
  `itemFootprint` (catalog → custom → unknown fallback), formatted with
  `Settings.units`; switching units updates HUD + info panel together.
- The HUD shows the live zoom/scale (e.g. `1.0×`, `250%`) and updates on
  wheel/pinch zoom without touching item props.
- A screen-edge scale reference renders a true-length bar at the current zoom
  (bar screen length = `cm × PX_PER_CM × scale`) and is readable in both themes
  and at both viewports; it does not overlap the toolbar, info panel, or mobile
  dock.
- Read-only share previews show the HUD; no edit affordances are added.
- No geometry, scene document, share payload, export output or capacity path
  changes (HUD is derived, view-only).
- Unit tests cover the formatter/scale math; E2E covers select + units + zoom on
  desktop + mobile, filtering one stable item/brand.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green (desktop + mobile).
- **Feature demo link** opens the final PR preview with the feature applied
  (preview URL + exact steps; the HUD state is not shareable), desktop + mobile.
- **Before/after screenshots** embedded for the visible change: same
  viewport/theme/state on base `main` and the PR preview, desktop + mobile;
  video/GIF for the zoom/units interaction.
- Performance numbers recorded; no regression beyond thresholds; feature catalog
  + F-19 map updated.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*` or other shared/coordinator-only files.
- One PR; no merge.

## Notes

- **Design direction is owner-approved before implementation.** The designer owns
  the HUD's placement, typography (mono instrument voice), scale-bar form, and
  how it coexists with the toolbar/info panel/mobile dock.
- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit the rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the
  PR/session summary. Demo links are required; screenshots alone are not enough
  for interaction features.

## Design gate

- Designer direction **"Scale Rule"** proposed 2026-10-27; **owner approved before
  implementation** (item-only v1, integer-percent zoom).
- `design-reviewer` pass 1 (desktop + mobile, dark + light): **approve-with-changes**
  — mobile duplicate size line, inverted hierarchy, mobile balance, dark edge,
  unlabelled mid tick.
- Pass 2 (same four + zoomed / no-selection / expanded-yield evidence):
  **approve-with-changes, no blockers** — mobile chip-to-peek gap, desktop bar
  weight, light border, label/zoom separation, and corrected no-selection
  evidence. Findings folded as value tweaks inside the approved look; the ≤2-pass
  cap was reached, so the final renders were verified by the checks (no third
  pass).

## Verification evidence

- `pnpm lint` clean (2 pre-existing `tools/asset-pipeline/analyze.ts` warnings).
- `pnpm typecheck` clean.
- `pnpm test` **861 passed** (94 files) — includes 6 new `measurementHud` tests.
- `pnpm build` clean.
- `pnpm exec playwright test e2e/measurement-hud.spec.ts e2e/smoke.spec.ts
  e2e/info-panel.spec.ts` **38 passed / 1 skipped** (desktop + mobile).
- Performance (same scene, 1 board + 1 pedal): JS gzip **295.71 → 296.15 kB**
  (+0.44), CSS gzip **12.07 → 12.38 kB** (+0.31); canvas wheel-zoom **62 → 62 fps**;
  JS heap **13.6 → 13.6 MB**; picker open median **56 → 59 ms** (5 samples);
  share link **360 → 358 bytes** (codec untouched). HUD is not on the export
  stage, so export output is unchanged.
