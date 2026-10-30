# P5-03: Temple Audio — Duo 24 board batch

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** done (merged 2026-10-25, PR #41, squash `ea628fb`; post-merge `fbd0869`) · **Model:** build-strong

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
  (`#3a3c3b`)**. **P5-03b repair (2026-10-24):** the first generated art
  (PR #40) was asymmetric — a vertical Temple Audio logo overlapped the right
  perforation/end cap and the staggered columns were clipped into the right
  cap. The rebuilt art has mirrored 22px end caps (`#444643`, sampled from the
  Sweetwater side panel), mirrored black handle pulls and 2 mini + 1 Micro
  module slot per side, a **centred, unclipped staggered perforation grid**
  (8 pill rows at 121/47.3px pitch; 49×25 small-hole grid at 15.46/15.75px
  pitch; 59/59px pill envelope), **no logo overlay**, and opaque dark
  perforations/slots (no white/checker bleed; the only transparency is the
  0.5px outer cutout edge). Rendered **800×408 / 350×178 AVIF q90**
  (27.4 / 11.8 KB); aspect **1.9608 vs 1.96 (0.04%)**, perspective 0.02%,
  **bright 0% / edge 0%**, no shadow; no white/background/fringe; no reference
  pixels. Source SVG: `tools/asset-pipeline/board-art/temple-audio-duo-24.svg`
  (on `main`). Evidence:
  `docs/screenshots/P5-03-temple-audio-duo-24-fix/` (evidence branch).

## Repair (P5-03b)

The owner flagged the merged PR #40 art as asymmetric/overlaid:

- vertical TEMPLE AUDIO logo overlapped the right perforation/end-cap area;
- the left handle read as mirrored but the right did not (logo/perf overlap);
- the rightmost perforation column was clipped/merged into the end cap;
- end caps/module slots did not read as mirrored;
- the PG reference shows a symmetric layout.

**Root cause:** the perforation field was a fixed 7-column grid starting at
x=64 (pitch 102) rather than a centred field, so the last column crossed the
right cap; the 50px caps were also wider than the official 1.65cm/side
mountable-surface margin (~21px at 800w), and the vertical logo was drawn over
the right cap.

**Fix:** official 62.23×31.75cm footprint; 22px mirrored end caps
(`#444643`, sampled from the Sweetwater left side panel); mirrored black
handle pulls; 2 mini + 1 Micro module slot per side; centred staggered
perforation field measured from the PG plan reference for **proportions only**
(no planner pixels shipped); no logo; body `#3a3c3b` (Sweetwater median,
239,602 samples); opaque dark perforations/slots to avoid white/checker bleed
and halos; 0.5px outer cutout edge only.

**Review + QA:** DeepSeek `design-reviewer` pass 1 on the old art → **redo**
(asymmetric, clipped, logo overlay, transparent holes/checker bleed); pass 2
on the fixed art → **approve-with-changes** (white slot notches, off-centre
grid, 3x sheet not on checker); fixes applied; confirmation pass →
**approve** ("ship this asset"), with a non-blocking value-step suggestion
(dot/pill separation + stronger cap seam) folded in. `asset:analyze`: aspect
pass, perspective 0.02%, bright 0%/edge 0%, no shadow (flag only for the
mandatory contact-sheet reviewer). App QA: picker, placement, rotation,
selected-board PNG export and read-only share pass on Chromium desktop,
mobile Chromium, WebKit and Firefox. Pre-existing picker/search defects found
during QA (duplicate clear glyph, "1 boards", dim micro-labels, bright
specimen card) are **out of scope** for this data/art fix and are reported to
the owner as deferred.

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
- Symmetric mirrored end caps/handles/module slots; centred, unclipped
  perforation grid; no logo overlay; no white/background/shadow/halo/fringe at
  1x or 3x on dark/light/checker.
- `catalog:validate` green in the CI temp build; guard clean; no mapped/runtime
  edits.
- Playwright: board picker search/brand, image load, placement/rotation,
  selected-board PNG export, read-only share; no console errors.
- Design reviewer asset + app QA; contact sheet/quality evidence in the PR.
- One PR; no merge.
