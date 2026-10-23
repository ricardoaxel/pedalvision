# P5-03: JHS — pedals batch 1 (3 Series Screamer)

**Phase:** P5 · **Status:** done — merged PR #38 · **Model:** build-strong

## Goal

Deliver one **second singular pedal** validation batch after the Choka pilot:
one raw record + hosted AVIF 800/350 assets for the **JHS 3 Series Screamer**
(`jhs-3-series-screamer`), then open exactly one PR. This exercises a different
brand, **side-mounted I/O**, and the now-merged AVIF pipeline before the board
pilot and the full parallel waves.

## Batch scope

- **Kind:** pedals
- **Brand:** JHS
- **Batch id:** `jhs/3-series-screamer-1`
- **Items:** 1 — `jhs-3-series-screamer` (3 Series Screamer)
- **Raw file:** `data/catalog/research/pedals/jhs/3-series-screamer-1.json`
- **Assets:** `public/pedal-assets/pedals/{800,350}/jhs-3-series-screamer.avif`
- **I/O:** input on the **right side**, output on the **left side**, power on the
  **top edge** (9 V DC, 2.1 × 5.5 mm, no battery). Positions estimated from the
  official top-down image/manual (`approximate: true`); only audio I/O is a
  cable anchor today.
- **Image:** official JHS `Front` top-down PNG (2500×2500, transparent padding),
  processed to a shadow-free AVIF q80 800/350.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/tasks/P5-01-policy-inventory.md` (data contract, optional-field rule)
- `docs/tasks/P5-02-quality-pipeline-control.md` (tooling, caps, build flow)
- `docs/catalog-backfill.md` (pedal contract, image pipeline)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts`
- `docs/decisions/003-catalog-data.md` (policy/provenance)

## Constraints

- **Raw records + assets only** in the PR; CI runs `catalog:build` to a temp dir
  **and an uncommitted app-workspace runtime** for Playwright; the post-merge
  build commits mapped/runtime.
- **Capture every connector with its position** (audio I/O, aux, expression/CV,
  MIDI, USB, power); only audio I/O (`in`/`out`/`send`/`return`) is a cable
  anchor today. Other connectors are future-feature data.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens for serials, videos, artist, price, jacks, MIDI/USB,
  board extras.
- One batch = one branch/worktree = **one PR**. This pedal validation runs alone.
- 2,000 hosted-pedal safety cap; stop at the Tier A target unless the owner says
  otherwise.
- No edits to feature code, generated mapped/runtime catalog, or other brands'
  batches.
- Status every 15 min; per-item 12 min; per-batch 4 h; checkpoint after every
  item.

## Steps

1. Restate the exact batch scope and expected item count (1 pedal).
2. Create the raw record under
   `data/catalog/research/pedals/jhs/3-series-screamer-1.json` from
   manufacturer-first sources; capture every verified fact found in the same
   base pass.
3. Run `pnpm catalog:start --batch jhs/3-series-screamer-1 --kind pedals --brand "JHS" --total 1`
   and checkpoint after the item.
4. Run the image scout/analyzer/processor/QA; keep candidates, accepts, rejects
   and reasons (`pnpm asset:analyze`, `pnpm asset:process`,
   `pnpm asset:contact-sheet`, `pnpm asset:qa`). For this single-item batch the
   contact sheet may be the single image if a multi-image sheet is not
   meaningful.
5. Run `pnpm catalog:ci` (CI temp build) and the Playwright picker/render check.
6. Run `pnpm catalog:guard-batch-pr`; the PR must contain raw records + assets +
   this task file only.
7. Produce the contact sheet + coverage report (covered, unresolved, duplicates,
   image pass/reject).
8. Finish the batch (`pnpm catalog:finish --batch jhs/3-series-screamer-1`), then
   open exactly one PR; do not merge. The coordinator runs the post-merge build
   (the GitHub workflow commits mapped/runtime).

## Acceptance (executable)

- Raw record covers the batch item; mandatory fields present; optional fields
  only if found.
- Image: 800/350 AVIF, alpha/background/aspect pass or documented flag,
  same-origin; no placeholder in shipped scope.
- `catalog:validate` green in CI temp build; `catalog:guard-batch-pr` green; PR
  contains no mapped/runtime edits.
- Playwright: picker search/brand/effect, image load, canvas placement, no
  console errors.
- Contact sheet + coverage/reject report in the PR.
- One PR; no merge.
