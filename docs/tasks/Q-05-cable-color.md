# Q-05 — cable color picker

**Phase:** 1 · **Status:** todo · **Model:** light (escalate only for the persistence/share contract)

## Goal

Let the user give each patch cable a color so a rig reads at a glance (signal
groups, stereo pairs, power runs). Colors must persist in the scene document,
travel in share links, render in read-only previews, and reproduce in PNG/PDF
export. This closes Q-05 in `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1.

## The gap on `main` (`279796a3`)

Inspected `src/state/scene.ts`, `sceneDocument.ts`, `shareLink.ts`,
`exportScene.ts`, `canvas/CableLayer.tsx`, `canvas/exportStage.ts` and
`canvas/GraphActionBar.tsx`:

- `Cable` already carries an **optional `color?: string`** (declared for P4-02),
  and the **share v2/v3 wire schema already accepts it** (`optionalString(40)`).
  The scene-document guard and `pruneCableGraph` preserve it.
- `exportStage.ts` already draws `cable.color ?? theme.cable` for the trace and
  arrowhead.
- **There is no UI to set or clear a cable color.** `addCable` never writes it;
  `GraphActionBar` has only Delete.
- **The live canvas ignores the field**: `CableLayer` always draws
  `theme.cable` / `theme.selection`. A colored shared scene therefore shows
  default ink on screen but colored ink in the exported PNG/PDF — a real
  inconsistency.
- There is no palette, no validation, and no color test coverage.

## Decision: palette, not freeform

A fixed, theme-aware palette (plus a **Default** entry that clears the field).
Rationale: guarantees contrast on the dark canvas, the light canvas and the
white PDF page; keeps every swatch color-blind distinguishable by pairing hue
with a distinct value; avoids an arbitrary string becoming an unreadable stroke
or a low-contrast PDF line. Palette values are stored as hex strings in the
existing optional `Cable.color`.

## Decision: additive optional data, no version bump

`color` is already part of the frozen v2/v3 cable schema, so this task ships it
as **additive optional data**:

- No `SHARE_VERSION` bump. A Q-05 link with colors still decodes on an older v3
  client (the field is already in its strict schema); the older canvas just draws
  default ink. No data loss.
- Missing `color` remains valid everywhere → old scenes/links/backups stay
  readable, and **Default** means “omit the field”.
- The document guard stays permissive (any string) for forward compatibility;
  the UI only writes palette values.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 + §6
- `docs/design.md` → “Cable visuals (P4-02)” + “Persistence” / share v3
- `src/state/scene.ts`, `src/state/sceneDocument.ts`, `src/lib/shareLink.ts`,
  `src/lib/exportScene.ts`, `src/canvas/CableLayer.tsx`,
  `src/canvas/exportStage.ts`, `src/canvas/GraphActionBar.tsx`,
  `src/styles/theme.ts`, `src/styles/tokens.css`, `src/index.css`
- `e2e/cables.spec.ts`, `e2e/cables-touch.spec.ts`, `e2e/share.spec.ts`,
  `e2e/export.spec.ts`

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file,
  `docs/screenshots/Q-05/**`, and the docs hub.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, or shared coordinator docs/config.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- Preserve the approved **Patch Drafting** direction: the cable stays a thin ink
  trace over a theme-inverted knockout halo; color changes the trace + arrowhead
  ink, not the halo/width/arrow geometry.
- 44 px touch targets, visible focus, keyboard roving as in `ItemActionBar`.
- Desktop + mobile parity; light + dark contrast.
- cm source of truth unchanged; no new dependencies.
- **Visual verification is delegated** to the `design-reviewer` (vision model).
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.

## Steps

1. Record the before state (colored share link renders default on canvas but
   colored in export) on desktop + mobile, dark + light.
2. Run the `designer` for the palette + placement direction; get **owner
   approval** before UI.
3. Implement:
   - Palette module (fixed swatches + Default), shared by UI + tests.
   - `setCableColor(uid, color | null)` scene action: read-only no-op, no-op for
     missing cable, history step via the existing snapshot arrays, autosave.
   - `GraphActionBar`: color control (swatches) beside Delete, keyboard/focus
     behaviour, 44 px touch targets; hidden in read-only (no bar there).
   - `CableLayer`: trace + arrowhead use `cable.color ?? theme.cable`; selection
     stays on the accent halo (widened 7 → 9 px so it remains legible under the
     ink); the trace width and arrow geometry are unchanged.
   - Stage debug attribute for testability.
4. Tests: palette/action unit tests (set/clear, read-only, unknown uid),
   document + share round-trip with color, legacy document/link without color,
   render/export consistency, E2E select → color → persist → share → read-only.
5. Design-reviewer ≤2 passes on real desktop + mobile, dark + light before/after.
6. One light code-review pass on the source diff; escalate only for a blocker.
7. Docs hub: `/changelog`, `/features` (user-visible behavior), `/help` if the
   cable workflow changes; update `docs/features/README.md` rows/impact map only
   if the regression surface changes. State the `Docs:` line.
8. Required checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
   pnpm e2e`; record bundle delta, canvas frame time, heap, share/export size.
9. ONE PR with the standard sections, before/after artifacts, demo link; no merge.

## Acceptance (executable)

- A selected cable in the Patch view shows a palette control with a Default
  option; choosing a swatch changes the on-canvas trace and arrowhead color.
- Choosing **Default** removes `color` from the cable (no field stored).
- The change is one undoable history step and autosaves.
- Reload restores the color; `sceneDocument` round-trips it; old documents with
  no color still load.
- A share link with colors round-trips at v3 (no version bump), decodes on the
  legacy path, and renders colored in the read-only preview.
- PNG/PDF export uses the same color as the canvas; a colored cable is visibly
  distinct from Default in the artifact.
- Read-only previews never expose the color control and never mutate.
- 44 px targets, focus-visible, keyboard reachable; desktop + mobile.
- Contrast passes for every palette swatch on dark canvas, light canvas and the
  PDF paper page (design-reviewer verified).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green on desktop + mobile.
- Feature demo link (preview URL + `?share=1#s=…` where representable) and
  before/after screenshots (desktop + mobile, dark + light) in the PR.
- Performance numbers recorded; no regression beyond thresholds.
- No catalog/shared edits. One PR; no merge.

## Notes

- Q-04 follow-ups are **out of scope** (Margin Rule strip overflow 320–375,
  first picker row highlight, chip edge, “adds loosely” copy).
- Record billed tokens by class in the PR/session summary.
