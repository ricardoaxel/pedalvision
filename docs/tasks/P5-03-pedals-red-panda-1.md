# P5-03: Red Panda — pedals batch 1

**Phase:** P5 · **Status:** in review — PR #44 · **Model:** build-strong

## Goal

Research and deliver one catalog batch (raw records) for **Red Panda** / 14 pedals and utility devices, then hand the batch to the coordinator for exactly one PR. This session writes raw records only; the image scout/pipeline and the coordinator handle assets, build and PR.

## Batch scope

- **Kind:** pedals
- **Brand:** Red Panda
- **Batch id:** `red-panda/red-panda-1`
- **Items:** 14
  - `red-panda-bitmap` — Bitmap (V1)
  - `red-panda-bitmap-2` — Bitmap 2
  - `red-panda-buffer` — Buffer (Bit Buffer)
  - `red-panda-context` — Context (V1)
  - `red-panda-context-2` — Context 2
  - `red-panda-mixer` — Mixer (Bit Mixer)
  - `red-panda-particle` — Particle (V1)
  - `red-panda-particle-v2` — Particle 2 (Particle V2)
  - `red-panda-rd-1-pitch-delay` — RD-1 Pitch Delay
  - `red-panda-radius` — Radius
  - `red-panda-raster` — Raster (V1)
  - `red-panda-raster-2` — Raster 2
  - `red-panda-remote-4` — Remote 4
  - `red-panda-tensor` — Tensor
- **Raw file:** `data/catalog/research/pedals/red-panda/red-panda-1.json`
- **Assets:** image candidates only in the raw file (2 per item); the image scout downloads/processes the hosted 800/350 AVIF renditions.
- **Budget:** per batch soft ≤400k tokens / hard ≤800k; 4 h active; per-item 12 min initial.
- **Progress:** 14/14 records written; checkpoints recorded per item. No PR opened by this session (coordinator owns the PR).

## Dimension findings vs the provisional inventory

The provisional `data/catalog/inventory.json` values were checked against official manufacturer pages/manuals and archived official listings:

| Item | Inventory (cm) | Official (cm) | Note |
| --- | --- | --- | --- |
| Bitmap (V1) | 8.38 × 11.18 | 8.38 × 11.18 | Matches |
| Bitmap 2 | 7.75 × 12.19 | 7.75 × 12.07 | Official depth 4.75 in, not 4.8 in |
| Buffer | 6.35 × 3.81 | 5.08 × 3.81 | Inventory width appears to include jack barrels |
| Context (V1) | 9.40 × 11.94 | 9.40 × 11.94 | Matches |
| Context 2 | 7.75 × 12.19 | 7.75 × 12.07 | Official depth 4.75 in |
| Mixer | 11.18 × 6.60 | 11.18 × 6.60 | Matches |
| Particle (V1) | 8.38 × 11.18 | 9.40 × 11.94 | Official V1 is 4.7 × 3.7 in |
| Particle 2 | 7.75 × 12.19 | 7.75 × 12.07 | Official depth 4.75 in |
| RD-1 Pitch Delay | 7.29 × 11.43 | 6.10 × 11.18 | Official 2.4 × 4.4 in |
| Radius | 7.75 × 12.19 | 7.87 × 12.07 | Official 3.1 × 4.75 in |
| Raster (V1) | 8.38 × 11.18 | 8.38 × 11.18 | Matches |
| Raster 2 | 7.75 × 12.19 | 7.75 × 12.07 | Official depth 4.75 in |
| Remote 4 | 25.40 × 7.49 | 25.40 × 6.99 | Official depth 2.75 in |
| Tensor | 7.75 × 12.19 | 7.75 × 12.07 | Official depth 4.75 in |

## Jack-edge policy for this batch

- `edge` is set only where an official product page/manual/rear-view image shows the connector face. Record-level `jackLayout: { source, confidence: "verified" }` is present on every record that asserts an edge.
- **Verified from official rear/top images:** Context (V1), Mixer, Particle (V1) and Remote 4 joined the top-edge set; estimated `pos` values are marked `approximate: true`.
- **Still omitted:** Buffer and RD-1 Pitch Delay (no official connector-face source); they use the app's assumed anchors. Remote 4 is a controller (not audio), so it has no audio cable anchor.
- No exact `pos` values are claimed; positions estimated from the official image are marked approximate.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)

## Constraints

- Raw record only in this session; no image download/commit, no generated mapped/runtime files, no feature code.
- Optional fields captured only when encountered during the same base research pass.
- Jack edges require a verified source; run `pnpm catalog:check-jacks`.
- One batch = one branch/worktree = one PR (coordinator opens it).
- No edits to feature code, generated mapped/runtime catalog, or other brands' batches.
- Status every 15 min; checkpoint after every item.

## Steps

1. Restated the batch scope and expected item count (14).
2. Researched Red Panda official product pages, owner's manuals, archived official listings and one authorized-retailer corroboration (RD-1).
3. Wrote the 14 raw records to `data/catalog/research/pedals/red-panda/red-panda-1.json`.
4. Checkpointed after every item with the catalog runner.
5. Validated against `RawPedalBatchSchema`; ran `pnpm catalog:check-jacks` (green).
6. Handed the batch to the coordinator for the image scout/pipeline, catalog build/CI, demo link and the single PR.

## Acceptance (executable)

- Raw records cover all 14 batch items; mandatory fields present; optional fields only if found.
- Schema validation green; `catalog:check-jacks` green.
- No mapped/runtime/feature edits in this batch.
- Image candidates/source URLs recorded per item; known image gaps reported.
- One PR (coordinator), no merge.

## Notes

- V1 Bitmap/Context/Particle/Raster are discontinued and their original CDN imagery has been removed. Their raw records use verified Wayback captures of the official product images (1000x1000) so the image scout still has usable candidates.
- Bitmap 2 / Context 2 / Raster 2 / Particle 2 / Tensor use the official 3.05 × 4.75 in enclosure; Radius uses 3.1 × 4.75 in.

## Results (wave 1 delivery)

- **Assets:** 14/14 items delivered as 800/350 AVIF (`public/pedal-assets/pedals/**`); q90 was used for 9 items after q80 PSNR <40 dB; all 14 accepted by `catalog-image-reviewer` (no visible perspective/shadow/halo). Analyzer accepts after the straight-on judgement; V1 images are verified official Wayback captures.
- **Data:** 14 raw records validate; `catalog:check-jacks` green; 6 utility/legacy items omit unverified edges.
- **Curated effect types:** verified Red Panda overrides added to `tools/catalog-transform/curated.ts` (batch-support file; no-drift test green).
- **Build/QA:** `catalog:ci` **232 pedals / 12 boards**; `catalog:validate` green; guard clean; app QA **30/30** (desktop + mobile Chromium: brand filter, 350 thumb, 800 specimen, canvas placement, no console errors); full e2e **258 passed + 7 skipped**; unit tests **699**.
- **Demo link:** 1 board / 14 items / 12 illustrative cables; Remote 4 is reported unconnected (controller, no audio).
- **PR:** one batch PR, no merge.
