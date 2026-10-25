# P5-03: <brand> — <pedals|boards> batch <n>

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Research and deliver one catalog batch (raw records + hosted assets) for `<brand>` / `<batch scope>`, then open exactly one PR for this batch.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an uncommitted app-workspace runtime** for Playwright; the post-merge build commits mapped/runtime. The one allowed batch-support code file is `tools/catalog-transform/curated.ts` (verified effect-type overrides for creatively-named pedals); never other `tools/` edits.
- **Capture every connector with its position** (audio I/O, aux, expression/CV, MIDI, USB, power); only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor today. Other connectors are future-feature data.
- **Jack edges require a verified source:** set `edge` only when an official rear/top photo, support page or manual diagram shows the connector face; record `jackLayout: { source, confidence: "verified" }` on the record. Never infer an edge from a sibling model or “compact layout”. If unknown, omit the edge (the app uses its assumed anchors) and set `confidence: "unknown"`. Run `pnpm catalog:check-jacks`; it fails an unverified edge.
- **Optional fields only if found in the same base research** — no extra searches/tabs/tokens for serials, videos, artist, price, jacks, MIDI/USB, board extras. For MIDI, include **MIDI channel(s)** and the **MIDI implementation chart URL** when the source already provides them.
- One batch = one branch/worktree = **one PR**. Max 3 batch sessions in flight.
- Tier A board cap: exactly **150 total**; the final partial batch may be smaller. Board images count against the separate board budget.
- 2,000 hosted-pedal safety cap; stop at the Tier A target unless the owner says otherwise.
- No edits to feature code, generated mapped/runtime catalog, or other brands' batches.
- **Side-jack images:** if jack barrels/feet protrude beyond the enclosure, use `asset:process --body-crop` (then analyze the processed output) so the true-scale width is the enclosure, not the connectors. Use a dedicated 2-cell identical-coordinate PNG-vs-AVIF crop for the quality gate.
- **Background rule:** remove **all non-product background-coloured areas** (white, black, any sampled background colour), including enclosed slots/holes — not just the border. Use `--matte global` for boards/slotted objects; `--matte components` for pedals with enclosed background regions; `--matte flood` for a plain cutout; **`--matte none` for an already-clean transparent PNG** (never re-key a transparent source — a black object on transparent-black corners gets erased). Never key product lettering/knobs that merely match the background.
- **Clean-alpha gate:** the final cutout must have crisp alpha with **no white/black/any-colour halo, fringe or jagged edge**; prefer an already-clean top-down transparent planner PNG over a glossy photo, and defringe/re-source if a photo leaves a halo.
- **AVIF quality gate:** encode q80, then run `pnpm asset:psnr --png <reference.png> --avif <800 asset> --min 40` against a PNG cutout generated in a temporary dir. If it fails, re-encode at q90/q100 or keep PNG for that item.
- **Cleaning generated files:** use targeted `git restore data/catalog src/catalog/data`; never `rm -rf data/catalog/pedals` (it can delete tracked mapped files from `main`).
- **Budget:** per batch soft **≤400k tokens / hard ≤800k**, ≤2 contact-sheet vision passes, ≤1 light code-review pass, 4 h active. A wave of 3: soft **≤1.2M / hard ≤2.4M tokens**; abort and report at 2× a batch budget or the wave hard cap. BOSS 209 → **6 batches of ~35 in 2 waves of 3**. Record tokens in checkpoints when the harness reports them.
- Status every 15 min; per-item 12 min initial; per-batch 4 h; checkpoint after every item.

## Steps

1. Restate the exact batch scope and expected item count.
2. Create/confirm the raw records under `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`.
3. Run `pnpm catalog:start` and checkpoint after every item.
4. Run the image scout/analyzer/processor/QA; keep candidates, accepts, rejects and reasons
   (`pnpm asset:analyze`, `pnpm asset:process`, `pnpm asset:contact-sheet`, `pnpm asset:qa`).
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci` (CI temp build) and the Playwright picker/render check.
6. Run `pnpm catalog:guard-batch-pr`; the PR must contain raw records + assets + this task file only.
7. Produce the contact sheet + coverage report (covered, unresolved, duplicates, image pass/reject).
8. **Build the demo share link:** after `catalog:ci` (step 5), run
   `pnpm catalog:demo-link --batch <brand>/<batch> --origin <PR-preview-origin>
   --out work/catalog/<batch>-demo.txt`. It packs every pedal batch item onto one board (or a
   custom board), adds illustrative patch cables between consecutive items, and prints the
   read-only `?share=1#s=…` URL. Board batches use `--kind boards` and produce a board-only
   scene. Open it and verify the expected board/item/cable counts.
9. Finish the batch, then open exactly one PR; do not merge. The coordinator runs the
   post-merge build (the GitHub workflow commits mapped/runtime). **The PR description must
   include the demo share link** (see acceptance).

## Acceptance (executable)

- Raw records cover the batch; mandatory fields present; optional fields only if found.
- Images: 800/350, alpha/background/aspect pass, same-origin; no placeholder in shipped scope.
- `catalog:check-jacks` green; `catalog:validate` green in CI temp build; `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright: picker search/brand/effect, image load, canvas/board placement, no console errors.
- Contact sheet (10–30 images per sheet) + coverage/reject report in the PR.
- Per-batch token/time budget recorded; no wave starts above the soft budget without owner approval.
- **Demo share link in the PR description** (`?share=1#s=…`) that opens a pedalboard (or
  boards) containing every item added by this batch, with the batch items connected by
  illustrative patch cables (not a true audio-flow model) and the expected board/item
  counts verified. This is a per-batch PR requirement (owner instruction, 2026-10-25).
- One PR; no merge.

## Notes

- Copy this file to `docs/tasks/P5-03-<kind>-<brand>-<batch>.md` for the batch session.
