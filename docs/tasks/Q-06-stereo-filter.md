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
- `docs/design.md` §Data model (catalog `jacks[].stereo`)
- `src/components/Picker.tsx`, `src/components/pickerFilter.ts`,
  `src/catalog/schema.ts` (`jackSchema.stereo`)
- `e2e/picker.spec.ts`, `e2e/picker-choka.spec.ts`

Read only the pointed sections; do not read whole docs.

## Data reality (investigate before UI)

`stereo` is **per jack** in the catalog (`Jack.stereo?: boolean`), not a
pedal-level flag. Current runtime catalog snapshot (picker total includes the
lazy planner overlay):

- **8,846** pedals in the picker (482 curated + 8,364 lazy planner-fill);
- 237 **curated** pedals have recorded jack data (planner-fill rows have none);
- **21** curated pedals have at least one `stereo: true` jack (14 with a stereo
  `in`, 21 with a stereo `out`).

So the filter can only surface **recorded** stereo capability. Do **not** infer
stereo from a pedal name, description or brand. Unmarked stereo pedals stay
invisible to the filter until catalog jack data is repaired (catalog lane is
paused — no catalog/data/tools edits in this task).

## Decisions (owner-approved 2026-11-05)

1. **Semantics — confirmed:** **any recorded `stereo: true` jack** = match
   (stereo in OR out). The filter reports recorded catalog data only; a pedal
   whose data says stereo is shown as stereo even if the real unit differs
   (catalog accuracy is out of scope while the lane is paused). A split
   “stereo in” / “stereo out” filter is a later extension.
2. **Control form/placement — approved: “Jack Probe”.** A distinct toggle
   (`aria-pressed` button, rounded-rect + dual-ring glyph + 1 px separator)
   is the **first child of the chip fieldset**, before the effect chips,
   labelled **“Stereo jack”**. It does not look like an effect chip; it stays
   first in the mobile horizontally scrolling band and wraps flush-left on
   desktop. No new color tokens. Hidden on the Boards tab. The fieldset legend
   is “Pedal filters” (so Stereo is not announced as an effect type), and the
   toggle has an accessible description stating it filters to recorded stereo
   jacks and that unrecorded jacks are not shown.
3. **Empty/unknown data:** never claim a pedal is mono when jack data is absent;
   the filter is “has recorded stereo jack”. Empty state names recorded stereo
   and adds a one-line “Stereo is only known where a jack is recorded.” note.
4. **Touch targets:** the new Stereo toggle is 44 px on mobile; existing effect
   chips stay 32 px (owner chose to keep this PR Stereo-only).

**Stable E2E fixtures:** `meris-enzo` (Meris, stereo in + out) is the positive
match; `boss-bd-2-blues-driver` (BOSS, recorded mono jacks) is the negative
match. No total-count assertions.

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file and
  `docs/screenshots/Q-06/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`; no catalog repair in this task.
- Separate branch/worktree; **one PR**; no merge.

## Acceptance (executable)

- A visible **Stereo** filter in the pedal picker with a clear active state and
  an accessible name; Clear filters resets it.
- Filtering is an additional axis (AND with query/brand/effect, boolean within
  stereo); a catalog pedal matches when **any** recorded catalog jack has
  `stereo: true`. Fallback anchors are mono by definition; do not infer stereo
  from a missing jack list.
- Pure filtering lives in `pickerFilter.ts` with unit tests using fixture items;
  no total-count E2E — filter a stable item/brand.
- Desktop + mobile: 44 px touch targets, keyboard reachable, focus-visible, no
  picker layout regression; dark + light.
- Empty state explains that no recorded stereo pedals match (never “none exist”).
- No catalog/shared edits, no new dependencies, no analytics/tracking.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; touched E2E
  desktop + mobile; performance numbers recorded.
- Docs hub: `/changelog`, `/features`, `/help` when the filter ships; update
  `docs/features/README.md` F-38/picker rows if the regression surface changes.
  State `Docs: hub <pages> | n/a — <reason> · map updated | n/a`.

## Design gate

Visible picker UI → run the `designer` first and get **owner approval** of the
control/placement direction before UI; then `design-reviewer` ≤2 passes on actual
desktop + mobile, dark + light. No hand-tuned colors without the designer.

## Notes

- Do not fold in unrelated picker follow-ups (first-row highlight, chip edge,
  etc.) unless the owner asks in the same task.
- Record billed tokens by class in the PR/session summary.
