# Q-06 — picker stereo filter

**Phase:** 1 · **Status:** in review — PR #102 · **Model:** light (escalate only for a high-risk change)

## Goal

Let users filter the pedal picker to **stereo-capable pedals** in the browser, so
a stereo rig can be planned without opening every item. This is an owner request
(2026-11-05) added to the Phase 1 feature lane.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 + §6
- `docs/tasks/feature-template.md`
- `docs/design.md` §Data model
- `src/components/Picker.tsx`, `src/components/pickerFilter.ts`,
  `src/catalog/schema.ts` (pedal-level `stereo`), `src/catalog/rawSchema.ts`
  (`io.stereo`)
- `e2e/picker.spec.ts`, `e2e/picker-choka.spec.ts`

Read only the pointed sections; do not read whole docs.

## Data reality (investigate before UI)

The **raw research archive** already records the pedal-level spec
(`io.stereo`), but the runtime projection used to drop it and kept only per-jack
`jacks[].stereo`. That jack-based view undercounts badly (21 vs 108) and is
misleading — **do not use it for this filter**. Owner decision (2026-11-05):
filter on the recorded **product spec** only.

Current runtime catalog after adding the projection (picker total includes the
lazy planner overlay):

- **8,846** pedals in the picker (482 curated + 8,364 lazy planner-fill);
- **108** curated pedals have `stereo: true`;
- 268 have explicit `stereo: false`;
- 106 are **unknown** (no spec value);
- planner-fill rows have no stereo field.

A match means `pedal.stereo === true` (the projected `io.stereo`). Ignore
`jacks[].stereo` entirely: a stereo pedal can have unrecorded/mono-labelled
jacks, and a jack flag must never override the spec. Missing data is **unknown**,
never mono. No inference from names, descriptions or brands.

## Decisions (owner-approved 2026-11-05)

1. **Semantics — corrected:** match when the recorded **pedal-level spec**
   (`io.stereo` → runtime `stereo`) is `true`. Ignore per-jack `stereo` flags.
   A split “stereo in” / “stereo out” filter is a later extension.
2. **Control form/placement — approved: “Jack Probe” form with the label
   “Stereo”.** A distinct toggle (`aria-pressed` button, rounded-rect + dual-ring
   glyph + 1 px separator) is the **first child of the chip fieldset**, before
   the effect chips. It does not look like an effect chip; it stays first in the
   mobile horizontally scrolling band and wraps flush-left on desktop. No new
   color tokens. Hidden on the Boards tab. The fieldset legend is “Pedal filters”
   (so Stereo is not announced as an effect type), and the toggle has an
   accessible description stating it filters to pedals whose catalog spec records
   stereo and that unrecorded pedals are not shown.
3. **Empty/unknown data:** never claim a pedal is mono when the spec is absent;
   the filter is “spec records stereo”. Empty state names recorded stereo and adds
   “Stereo is only known where the catalog records it.”
4. **Touch targets:** the new Stereo toggle is 44 px on mobile; existing effect
   chips stay 32 px (owner chose to keep this PR Stereo-only).
5. **Catalog exception (owner-approved 2026-11-05):** add the pedal-level
   `stereo` field to the runtime schema and projection (`io.stereo`), then
   regenerate the mapped/runtime catalog. This is the only catalog-lane change in
   this PR; no raw research, images, or other catalog data changes.

**Stable E2E fixtures:** `meris-enzo` (`stereo: true`) is the positive match;
`boss-bd-2-blues-driver` (`stereo: false`) is the negative match. No total-count
assertions. Unit fixtures also prove that a `stereo: false` pedal with a stereo
jack and an unknown pedal with a stereo jack are **not** matches.

## Workstream / boundaries

- Feature workstream: `src/**` (feature code + the approved catalog schema
  projection), `e2e/**`, this task file and `docs/screenshots/Q-06/**`.
- **Owner-approved catalog exception:** `src/catalog/schema.ts`,
  `tools/catalog-pipeline/project.ts`, and the deterministically regenerated
  `data/catalog/pedals/**` + `src/catalog/data/pedals.json`. No raw research,
  images, assets, or batch data changes.
- Separate branch/worktree; **one PR**; no merge.

## Acceptance (executable)

- A visible **Stereo** filter in the pedal picker with a clear active state and
  an accessible name; Clear filters resets it.
- Filtering is an additional axis (AND with query/brand/effect, boolean within
  stereo); a catalog pedal matches when the recorded pedal-level `stereo` spec is
  `true`. Jack flags and missing specs are never used.
- Pure filtering lives in `pickerFilter.ts` with unit tests using fixture items;
  no total-count E2E — filter a stable item/brand.
- Desktop + mobile: 44 px touch targets, keyboard reachable, focus-visible, no
  picker layout regression; dark + light.
- Empty state explains that no recorded-stereo pedals match (never “none exist”).
- No new dependencies, no analytics/tracking. Catalog changes limited to the
  approved spec projection.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; `catalog:ci`
  green; touched E2E desktop + mobile; performance numbers recorded.
- Docs hub: `/changelog`, `/features`, `/help` when the filter ships; update
  `docs/features/README.md` F-38/Q-06/picker rows if the regression surface
  changes. State `Docs: hub <pages> | n/a — <reason> · map updated | n/a`.

## Design gate

Visible picker UI → `designer` direction approved before UI; `design-reviewer`
≤2 passes on actual desktop + mobile, dark + light. The label changed from
“Stereo jack” to “Stereo” after the owner corrected the data source; the approved
control form is unchanged.

## Notes

- Do not fold in unrelated picker follow-ups (first-row highlight, chip edge,
  etc.) unless the owner asks in the same task.
- Record billed tokens by class in the PR/session summary.
