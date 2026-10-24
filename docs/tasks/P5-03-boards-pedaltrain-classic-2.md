# P5-03: Pedaltrain — boards batch 1 (Classic 2)

**Phase:** P5 · **Status:** in review — PR #39 · **Model:** build-strong

## Goal

Deliver the **board pilot** after the Choka + JHS pedal pilots: one raw board
record + hosted AVIF 800/350 assets for the **Pedaltrain Classic 2**
(`pedaltrain-classic-2`), then open exactly one PR. This proves the board path
(footprint, top-down/empty image, board picker/placement) before the parallel
waves.

## Batch scope

- **Kind:** boards
- **Brand:** Pedaltrain
- **Batch id:** `pedaltrain/classic-2`
- **Items:** 1 — `pedaltrain-classic-2` (Classic 2)
- **Raw file:** `data/catalog/research/boards/pedaltrain/classic-2.json`
- **Assets:** `public/pedal-assets/boards/{800,350}/pedaltrain-classic-2.avif`
- **Footprint:** **60.96 × 31.75 cm** (24 × 12.5 in), frame height 8.9 cm
  (3.5 in), 1.42 kg (official), aircraft-grade aluminum, angled four-rail/open
  front, hook-and-loop surface, no case included (available with soft/tour case).
- **Image:** **self-drawn flat vector board** from the official 60.96×31.75 cm
  footprint and the Classic 2 four-rail/three-open-slot layout; proportions
  measured from the source board reference (**34px side columns, slots
  x 34→766, rail/slot bands 67 / 50 / 67 / 49 / 67 / 50 / 67**) and the
  **board color is sampled from that reference (`#151515`)**, but **no planner
  pixels or image are used**. **No third-party image.** Generated only because
  the real Pedaltrain photos were unusable; real images remain first. Source SVG:
  `tools/asset-pipeline/board-art/pedaltrain-classic-2.svg`; rendered to
  800×417 / 350×182, **AVIF q90**. Aspect 1.918465 vs 1.920 (0.08% pass),
  rotation 0, perspective 0, bright residual 0%, bright edge 0%; transparent
  slots, 4px outer corners, subtle gray outline, no brand line; **no
  white/background/shadow/fringe**; approved by the design reviewer.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/tasks/P5-01-policy-inventory.md` (data contract, optional-field rule)
- `docs/tasks/P5-02-quality-pipeline-control.md` (tooling, caps, build flow)
- `docs/catalog-backfill.md` (board contract, image pipeline)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts`
- `docs/decisions/003-catalog-data.md` (policy/provenance)

## Constraints

- **Raw records + assets only** in the PR; CI runs `catalog:build` to a temp dir
  **and an uncommitted app-workspace runtime** for Playwright; the post-merge
  build commits mapped/runtime.
- **Board image must be top-down and empty** (no pedals, no case/accessories,
  no angled hero shot); aspect vs the footprint (≤10% pass, 10–15% flag, >15%
  reject); perspective is a reject signal.
- **Capture every verified board fact** found in the same base research:
  footprint, thickness/max height, weight, material, type/tiers, surface,
  bag/case, power mount, cable routing, max pedal height, lifecycle, price
  observations, sources.
- One batch = one branch/worktree = **one PR**. This board pilot runs alone.
- Board budget: **150 Tier A boards / ~300 files / ~20 MB**, independent of the
  2,000 hosted-pedal cap.
- No edits to feature code, generated mapped/runtime catalog, or other brands'
  batches.
- Status every 15 min; per-item 12 min; per-batch 4 h; checkpoint after every
  item.
- **Cleaning generated files:** use targeted `git restore data/catalog
  src/catalog/data`; never `rm -rf data/catalog/{pedals,boards}` (tracked mapped
  files may exist from `main`).

## Steps

1. Restate the exact batch scope and expected item count (1 board).
2. Create the raw record under
   `data/catalog/research/boards/pedaltrain/classic-2.json` from the official
   Pedaltrain page/manual and the authorized retailer page; capture every
   verified fact found in the same base pass.
3. Run `pnpm catalog:start --batch pedaltrain/classic-2 --kind boards --brand "Pedaltrain" --total 1`
   and checkpoint after the item.
4. Run the image analyzer/QA on the self-drawn flat board; render the source
   SVG to 800/350 AVIF q90, analyze the output, and run the
   `catalog-image-reviewer` clean-alpha quality gate (full + 3× crops).
5. Run `pnpm catalog:ci` and the Playwright board picker/placement/rotate/export
   check.
6. Run `pnpm catalog:guard-batch-pr`; the PR must contain raw records + assets +
   this task file only.
7. Produce the contact sheet + coverage report (covered, unresolved, duplicates,
   image pass/reject).
8. Finish the batch (`pnpm catalog:finish --batch pedaltrain/classic-2`), then
   open exactly one PR; do not merge. The coordinator runs the post-merge build.

## Acceptance (executable)

- Raw record covers the board; mandatory fields present; optional fields only if
  found.
- Image: 800/350 AVIF, top-down/empty, alpha/background/aspect pass or
  documented flag, same-origin; **clean crisp alpha with no white/black/any
  halo, fringe or jagged edge**; no placeholder in shipped scope.
- `catalog:validate` green in CI temp build; `catalog:guard-batch-pr` green; PR
  contains no mapped/runtime edits.
- Playwright: board picker search/brand, image load, board placement/rotation,
  no console errors.
- Contact sheet + coverage/reject report in the PR.
- One PR; no merge.
