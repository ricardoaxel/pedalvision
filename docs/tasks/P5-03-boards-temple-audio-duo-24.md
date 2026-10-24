# P5-03: Temple Audio — Duo 24 board batch

**Phase:** P5 · **Status:** in progress — PR pending · **Model:** build-strong

## Goal

Deliver one **board batch** for the **Temple Audio Duo 24** (`temple-audio-duo-24`, batch `temple-audio/duo-24`): a strict raw board record + hosted 800/350 AVIF + this task file, then exactly one PR. This is the **second-brand validation** of the board pipeline and the **real-first** image rule.

## Batch scope

- **Kind:** boards
- **Brand:** Temple Audio
- **Batch id:** `temple-audio/duo-24`
- **Items:** 1 — `temple-audio-duo-24` (Duo 24, gunmetal)
- **Raw file:** `data/catalog/research/boards/temple-audio/duo-24.json`
- **Assets:** `public/pedal-assets/boards/{800,350}/temple-audio-duo-24.avif`
- **Footprint:** **62.23 × 31.75 cm** (24.5 × 12.5 in, including handles/end caps);
  mountable surface **58.93 × 31.75 cm** (23.2 × 12.5 in); front/back height
  **3.81 / 6.35 cm** (1.5 / 2.5 in); **1.54 kg** (3.4 lb); lightweight aluminum;
  gunmetal; perforated top; two rows; two MOD + one Micro MOD slot per side;
  handle pulls; feet; no case (soft case optional); **Quick Release Pedal Plates
  sold separately**; power-supply mounting bracket included.
- **Image:** **real images first**. The authorized-retailer (Sweetwater) images
  are all angled, white-background, shadowed and non-transparent, so the
  real-first gate rejected them. **Generated flat art** from the official
  dimensions/layout, with the **board color sampled from the reference
  (`#373737`)**: perforated top, side handles, end-cap module slots, vertical
  Temple Audio logo. Rendered **800×408 / 350×178 AVIF q90** (14.0 / 6.4 KB);
  aspect **1.9608 vs 1.96 (0.04%)**, rotation 0, perspective 0, **bright 0% /
  edge 0%**; transparent perforations; no white/background/shadow/fringe; no
  reference pixels or third-party image. Source SVG:
  `tools/asset-pipeline/board-art/temple-audio-duo-24.svg` (on `main`).

## Read first

- `docs/tasks/P5-03-pilot-parallel-backfill.md`
- `docs/tasks/P5-03-boards-pedaltrain-classic-2.md` (generated board pilot)
- `docs/tasks/P5-03-board-image-repair.md` (real-first policy)
- `docs/catalog-backfill.md` (board contract, image pipeline)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts`
- `docs/decisions/003-catalog-data.md`

## Constraints

- **Real image first.** Keep a clean official/authorized image whenever it
  passes. Generate only when the real image is genuinely unusable (this case:
  angled/shadowed/non-transparent). Generated art must faithfully represent the
  board and **sample its color from the reference**; no reference/planner
  pixels.
- **Raw records + assets only** in the PR; the source SVG stays on `main`.
  CI builds the uncommitted runtime for Playwright; the post-merge build commits
  mapped/runtime.
- One batch = one branch = **one PR**. No feature code, no generated
  runtime/mapped edits, no new dependencies.
- Board budget: 150 Tier A boards / ~300 files / ~20 MB.
- Status every 15 min; per-item 12 min; per-batch 4 h; checkpoint after the item.

## Steps

1. Confirm the batch scope and the one item.
2. Start the catalog runner (`catalog:start`) and checkpoint after the item.
3. Image: real-first gate → the real Temple images fail → render the approved
   flat SVG to 800/350 AVIF q90; analyze; design-reviewer; app QA.
4. `pnpm catalog:ci` and the Playwright board picker/placement/rotation/export/
   share flow (desktop + mobile; WebKit/Firefox for this pilot).
5. `pnpm catalog:guard-batch-pr`; raw + assets + task file only.
6. Finish the runner (`catalog:finish`); open exactly one PR; do not merge.

## Acceptance

- Raw record covers the board; mandatory fields present; optional fields only
  if found; `surface: other` + `extra.surfaceType: perforated`.
- Image: 800/350 AVIF, top-down/empty, real-first decision documented, generated
  color sampled from the reference, bright residual **<1%**, bright edge
  **<2%**, aspect pass, no shadow; same-origin.
- `catalog:validate` green in the CI temp build; guard clean; no mapped/runtime
  edits.
- Playwright: board picker search/brand, image load, placement/rotation,
  selected-board PNG export, read-only share; no console errors.
- Design reviewer asset + app QA; contact sheet/quality evidence in the PR.
- One PR; no merge.
