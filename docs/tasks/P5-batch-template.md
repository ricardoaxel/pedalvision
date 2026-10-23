# P5-03: <brand> — <pedals|boards> batch <n>

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Research and deliver one catalog batch (raw records + hosted assets) for `<brand>` / `<batch scope>`, then open exactly one PR for this batch.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/tasks/P5-01-policy-inventory.md` (data contract, optional-field rule)
- `docs/tasks/P5-02-quality-pipeline-control.md` (tooling, caps, build flow)
- `docs/catalog-backfill.md` (pedal/board contract, image pipeline)
- `docs/decisions/003-catalog-data.md` (policy/provenance)

## Constraints

- **Raw records + assets only** in the PR; CI runs `catalog:build` to a temp dir **and an uncommitted app-workspace runtime** for Playwright; the post-merge build commits mapped/runtime.
- **Capture every connector with its position** (audio I/O, aux, expression/CV, MIDI, USB, power); only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor today. Other connectors are future-feature data.
- **Optional fields only if found in the same base research** — no extra searches/tabs/tokens for serials, videos, artist, price, jacks, MIDI/USB, board extras.
- One batch = one branch/worktree = **one PR**. Max 3 batch sessions in flight.
- Tier A board cap: exactly **150 total**; the final partial batch may be smaller. Board images count against the separate board budget.
- 2,000 hosted-pedal safety cap; stop at the Tier A target unless the owner says otherwise.
- No edits to feature code, generated mapped/runtime catalog, or other brands' batches.
- Status every 15 min; per-item 12 min initial; per-batch 4 h; checkpoint after every item.

## Steps

1. Restate the exact batch scope and expected item count.
2. Create/confirm the raw records under `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`.
3. Run `pnpm catalog:start` and checkpoint after every item.
4. Run the image scout/analyzer/processor/QA; keep candidates, accepts, rejects and reasons
   (`pnpm asset:analyze`, `pnpm asset:process`, `pnpm asset:contact-sheet`, `pnpm asset:qa`).
5. Run `pnpm catalog:ci` (CI temp build) and the Playwright picker/render check.
6. Run `pnpm catalog:guard-batch-pr`; the PR must contain raw records + assets + this task file only.
7. Produce the contact sheet + coverage report (covered, unresolved, duplicates, image pass/reject).
8. Finish the batch, then open exactly one PR; do not merge. The coordinator runs the
   post-merge build (the GitHub workflow commits mapped/runtime).

## Acceptance (executable)

- Raw records cover the batch; mandatory fields present; optional fields only if found.
- Images: 800/350, alpha/background/aspect pass, same-origin; no placeholder in shipped scope.
- `catalog:validate` green in CI temp build; `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright: picker search/brand/effect, image load, canvas/board placement, no console errors.
- Contact sheet + coverage/reject report in the PR.
- One PR; no merge.

## Notes

- Copy this file to `docs/tasks/P5-03-<kind>-<brand>-<batch>.md` for the batch session.
