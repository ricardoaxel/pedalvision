# P5-03: Pedaltrain — Nano family boards batch 1 (Nano / Nano+ / Nano MAX)

**Phase:** P5 · **Status:** in progress — PR pending · **Model:** build-strong

> Board research batch. This session writes the raw records + this task file only;
> image selection/hosting is left to the image scout (no images downloaded).

## Goal

Deliver one board research batch for the three Pedaltrain Nano-family sizes as a
strict raw board batch, with verified footprints, physical facts, lifecycle/price
observations and top-down/empty image candidates for the scout.

## Batch scope

- **Kind:** boards
- **Brand:** Pedaltrain
- **Batch id:** `pedaltrain/nano-1`
- **Items:** 3
  - `pedaltrain-nano` — Nano (35.56 × 13.97 cm; 3.5 cm frame)
  - `pedaltrain-nano-plus` — Nano+ (45.72 × 12.7 cm; 3.5 cm frame)
  - `pedaltrain-nano-max` — Nano MAX (71.12 × 13.97 cm; 3.5 cm frame)
- **Raw file:** `data/catalog/research/boards/pedaltrain/nano-1.json`
- **Assets:** deferred to the image scout/pipeline; no images downloaded or
  processed in this session. Candidate URLs are recorded in the raw file.
- **Footprint sources:** Pedaltrain official US product pages (no-case, soft-case
  and hard-case pages) — 14 × 5.5 × 1.4 in, 18 × 5 × 1.4 in and 28 × 5.5 × 1.4 in.
  The Nano+ official depth is **5 in (12.7 cm)**, not the brief's provisional
  13.97 cm; authorized retailer pages corroborate 18 × 5 in.
- **Family/physical:** flat two-rail Nano Series form factor, aircraft-grade
  aluminum, black, hook-and-loop surface, no handles, no case with the board-only
  SKUs; soft/hard case versions exist (PT-NANO/NPL/NMAX-SC/HC). Nano and Nano+
  weigh 0.3 kg (official); Nano MAX weight is not on the official US pages (see
  the record's `extra`). Nano MAX fits most low-profile power supplies underneath
  (authorized retailer); no dedicated Pedaltrain Nano-series mounting kit is
  listed.
- **Image decision:** candidates only. Official top-down empty-board images with
  measurement callouts are recorded as priority 1; scout must verify emptiness
  and crop the callouts. No planner images used.

## Read first

- `docs/catalog/raw-research-record.md`
- `src/catalog/rawSchema.ts`
- `docs/catalog-backfill.md` §Board images / §Quality gate
- `.opencode/agent/catalog-image-scout.md` + `catalog-image-reviewer.md`

## Constraints

- Raw records + this task file only; no mapped/runtime catalog, feature code,
  assets or other brands.
- cm only; no invented dimensions. Keep real size variants as separate records;
  `variantOf` links the Nano size family only.
- Every record needs authoritative sources actually verified. Optional facts only
  if they appeared in the same base pass.
- Image candidates must be direct https URLs for top-down, empty boards (no
  pedals); no downloading/processing.
- One batch = one branch/worktree = one PR. Do not merge the PR.
- **Budget:** 3 boards, 12 min per board initial, 4 h batch; lean calibration
  pass — stop on a real blocker.

## Steps

1. Confirm the batch scope and item order.
2. Research official Pedaltrain pages first; corroborate the Nano+ depth and the
   Nano MAX underside power fit with authorized retailers only where needed.
3. Write the raw batch and validate it against `RawBoardBatchSchema`.
4. Record image candidates + source pages.
5. Checkpoint after every item (`catalog:checkpoint`); stop on exit 75.
6. Run `catalog:check` and report the expected missing-asset state (assets are
   out of scope until the scout/pipeline stage).

## Acceptance

- Raw batch has 3 records and passes `RawBoardBatchSchema`.
- Mandatory footprint fields verified with `widthCm`/`heightCm` = footprint;
  thickness/max height separate. Optional fields only if found.
- Real size models kept separate; `variantOf` links the Nano family.
- At least one authoritative `sources` entry with `kind: "image"`; image
  candidates are top-down/empty and official-first.
- No mapped/runtime/generated edits, no assets, no PR merge.

## Results (wave 1 delivery)

- **Assets:** 3/3 real official top-down empty-board images (no generated art), cropped to the board bbox, AVIF q80 800/350. PSNR 49.05/46.79 (Nano), 51.02/48.47 (Nano+), 50.89/49.54 (Nano MAX); bright residual <0.11%, bright edge <1.53%, aspect within 2.1%. `catalog-image-reviewer` **accept** for all three.
- **Data:** 3 raw board records validate; Nano+ official depth is **12.7 cm** (inventory 13.97 cm provisional, noted); Nano MAX weight omitted (not published).
- **Build/QA:** `catalog:ci` **218 pedals / 15 boards**; `catalog:validate` green; guard clean; app QA **6/6** (desktop + mobile Chromium: board picker, 350 thumb, 800 specimen, placement, no console errors); full e2e **258 passed + 7 skipped**; unit tests **699**.
- **Demo link:** 3 boards (board-only scene).
- **PR:** one batch PR, no merge.
