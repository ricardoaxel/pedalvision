# Q-06 — picker stereo filter

**Phase:** 1 · **Status:** todo · **Model:** light (escalate only for a high-risk change)

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
pedal-level flag. Current runtime catalog snapshot:

- 482 pedals;
- 237 have recorded jack data;
- **21** have at least one `stereo: true` jack (14 with a stereo `in`, 21 with a
  stereo `out`).

So the filter can only surface **recorded** stereo capability. Do **not** infer
stereo from a pedal name, description or brand. Unmarked stereo pedals stay
invisible to the filter until catalog jack data is repaired (catalog lane is
paused — no catalog/data/tools edits in this task).

## Open decisions (owner/designer)

1. **Semantics:** recommend **any `stereo: true` jack** = stereo-capable. A
   split “stereo in” / “stereo out” filter is a later extension unless the owner
   asks now.
2. **Control form/placement:** a filter chip/switch near the effect chips vs a
   separate toggle. Design-gated — the `designer` proposes, the owner approves
   before UI.
3. **Empty/unknown data:** never claim a pedal is mono when jack data is absent;
   the filter is “has recorded stereo jack”.

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
