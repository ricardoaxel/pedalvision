# P5-03: Meris — pedals batch 1

**Phase:** P5 · **Status:** in review — PR #42 · **Model:** build-strong

## Goal

Deliver one catalog batch for **Meris** (the first 10 pedal/inventory items) as
raw research records + hosted 800/350 AVIF assets, then open exactly one PR for
this batch. This is the Meris leg of the P5-03 small-brand parallel test.

## Batch scope

- **Kind:** pedals
- **Brand:** Meris
- **Batch id:** `meris/meris-1`
- **Raw file:** `data/catalog/research/pedals/meris/meris-1.json`
- **Assets:** `public/pedal-assets/pedals/{800,350}/<id>.avif`
- **Items:** 10, in this order:

| # | id | Name | Verified footprint | deviceType / formFactor | effectTypes |
| --- | --- | --- | --- | --- | --- |
| 1 | `meris-enzo` | Enzo | 10.8 × 11.43 cm | stompbox / compact | synth, pitch, filter, ring-mod, delay, chorus, compressor |
| 2 | `meris-enzo-x` | Enzo X | 18.42 × 11.43 cm | stompbox / double | synth, pitch, filter, ring-mod, delay, reverb, chorus, flanger, phaser, vibrato, bitcrusher, overdrive, compressor, sequencer, tuner |
| 3 | `meris-hedra` | Hedra | 10.8 × 11.43 cm | stompbox / compact | pitch, delay |
| 4 | `meris-lvx` | LVX | 18.42 × 11.43 cm | stompbox / double | delay, looper, pitch, filter, preamp, bitcrusher, tuner |
| 5 | `meris-midi-i-o` | MIDI I/O | 9.4 × 6.6 cm | **interface** / mini | `utility` (not an effect; non-effect utility role) |
| 6 | `meris-mercury7` | Mercury7 | 10.8 × 11.43 cm | stompbox / compact | reverb |
| 7 | `meris-mercuryx` | MercuryX | 18.42 × 11.43 cm | stompbox / double | reverb, chorus, vibrato, tremolo, tuner |
| 8 | `meris-ottobit-jr` | Ottobit Jr. | 10.8 × 11.43 cm | stompbox / compact | bitcrusher, filter, sequencer, pitch |
| 9 | `meris-ottobit-x` | Ottobit X | 18.42 × 11.43 cm | stompbox / double | bitcrusher, filter, pitch, ring-mod, tremolo, delay, reverb, looper, sequencer, preamp, vibrato, tuner |
| 10 | `meris-polymoon` | Polymoon | 10.8 × 11.43 cm | stompbox / compact | delay, phaser, flanger |

- **Dimensions verified against the official Meris product pages/manuals**, not
  the inventory estimates: standard enclosure **10.80 × 11.43 × 5.08 cm**
  (4.25 × 4.5 × 2 in); X-series **18.42 × 11.43 × 5.08 cm** (7.25 × 4.5 × 2 in);
  MIDI I/O **9.40 × 6.60 × 3.81 cm** (3.7 × 2.6 × 1.5 in — the inventory's
  6.76 cm depth was a provisional value; the official depth is 6.60 cm).
- **MIDI I/O representation:** kept in the batch as `category: "pedal"` +
  `deviceType: "interface"` + `effectTypes: ["utility"]` (the UI has no separate
  interface category today; `utility` is the documented non-effect taxonomy
  role, and the runtime requires at least one effectType for a pedal). No
  substitution was needed.
- **Deferred, not in this batch:** `meris-preset-switch` and the four colour
  variants (`meris-enzo-x-black`, `meris-lvx-black`, `meris-mercuryx-black`,
  `meris-ottobit-x-pink`).
- **Cable anchors:** only audio I/O (`in`/`out`) is connectable today. Compact
  pedals: input on the **right** edge, output on the **left** edge, EXP + 9V DC
  on the rear/top edge. X-series: separate L/R audio I/O, EXP, DIN MIDI in/out,
  USB-C and 9V DC all on the rear/top panel. Positions are recorded by **edge
  only** (no invented `pos`), so the resolver uses its approximate layout.
- **Images:** the nine pedal images are official Meris transparent top-down
  renders, processed with `--matte none` (never re-keyed). The MIDI I/O's official
  photos were below the 800 px analyzer minimum or angled, so the authorized
  retailer Cream City Music top-down photo (1000×1000, white background) was
  processed with `--matte flood`. All assets are AVIF q80 800/350; **Enzo and
  Hedra were escalated to q90** because q80 measured below the 40 dB PSNR gate.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/tasks/P5-01-policy-inventory.md` (data contract, optional-field rule)
- `docs/tasks/P5-02-quality-pipeline-control.md` (tooling, caps, build flow)
- `docs/catalog-backfill.md` (pedal contract, image pipeline)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts`
- `docs/decisions/003-catalog-data.md` (policy/provenance)

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir
  **and an uncommitted app-workspace runtime** for Playwright; the post-merge
  build commits mapped/runtime.
- **Owner-approved deviation (2026-10-25):** this PR also carries verified
  Meris `effectTypes` overrides in `tools/catalog-transform/curated.ts`. The
  no-drift test requires every runtime `effectTypes` to equal the curated +
  classifier derivation; Meris names are creative (Enzo, Hedra, LVX, Polymoon…)
  and classify as empty, so the documented verified-override table is the only
  correct fix. Run `pnpm catalog:guard-batch-pr --allow-pipeline` for this batch
  only; no generated/mapped/runtime file is included.
- **Capture every connector with its position** when the source exposes it;
  only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor today. No
  invented positions.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens for serials, videos, artist, price, jacks, MIDI/USB,
  board extras.
- One batch = one branch/worktree = **one PR**. Max 3 batch sessions in flight.
- 2,000 hosted-pedal safety cap; stop at the Tier A target unless the owner says
  otherwise.
- No edits to feature code, generated mapped/runtime catalog, other brands'
  batches, or the merged Temple/Pedaltrain board work.
- Status every 15 min; per-item 12 min; per-batch 4 h; checkpoint after every
  item.
- Do not merge the PR; hand it to the owner.

## Steps

1. Restate the exact batch scope and expected item count (10).
2. Create the raw record under
   `data/catalog/research/pedals/meris/meris-1.json` from manufacturer-first
   sources; capture every verified fact found in the same base pass.
3. Run `pnpm catalog:start --batch meris/meris-1 --kind pedals --brand Meris
   --total 10` and checkpoint after every item.
4. Run the image scout/analyzer/processor/QA; keep candidates, accepts, rejects
   and reasons (`pnpm asset:analyze`, `pnpm asset:process`,
   `pnpm asset:contact-sheet`, `pnpm asset:qa`).
5. Run `pnpm catalog:ci` (CI temp build) and the Playwright picker/render check.
6. Run `pnpm catalog:validate` and `pnpm catalog:guard-batch-pr
   --allow-pipeline` (owner-approved curated-override exception); the PR must
   contain raw records + assets + this task file + `curated.ts` only.
7. Produce the contact sheet + coverage report (covered, unresolved, duplicates,
   image pass/reject).
8. Finish the batch (`pnpm catalog:finish --batch meris/meris-1`), then open
   exactly one PR; do not merge. The coordinator runs the post-merge build.

## Acceptance (executable)

- Raw records cover all 10 items; mandatory fields present; optional fields only
  if found; `category`/`deviceType` correct (MIDI I/O is an interface, not an
  effect).
- Images: 800/350 AVIF, alpha/background/aspect pass, same-origin; no
  placeholder in shipped scope; clean-alpha gate + AVIF PSNR ≥40 dB + 2× crop
  review passed.
- `catalog:validate` green in CI temp build; `catalog:ci` reports **218 pedals /
  12 boards** (208 + 10; boards unchanged); `catalog:guard-batch-pr
  --allow-pipeline` green; PR contains no mapped/runtime edits.
- `pnpm test` remains **676 passed** (the curated overrides satisfy the
  effectTypes no-drift test).
- Playwright: picker search/brand/effect, image load, canvas placement, no
  console errors (desktop Chromium, mobile Chromium, WebKit, Firefox).
- Contact sheet + coverage/reject report in the PR.
- One PR; no merge.

## Results (2026-10-25)

- **Coverage:** 10/10 items; no unresolved duplicates. Deferred: Preset Switch +
  4 colour variants.
- **Raw data:** all 10 records validate against `RawPedalBatchSchema`; dimensions
  verified against official Meris pages/manuals; every record has `sources`,
  `confidence`, `lastVerified` and `dimensionsSource`.
- **Images:** 20/20 AVIF files (800/350) hosted; analyzer **accept** for all 10
  (aspect 1.31–3.29%, rotation ≤0.23°, perspective ≤0.43%, no shadow); PSNR
  40.89–45.73 dB (Enzo/Hedra q90, rest q80); contact sheet and dedicated
  2× PNG-vs-AVIF crop sheet vision-accepted.
- **Pipeline:** `catalog:ci` **218 pedals / 12 boards**; `catalog:validate`
  green (101 hosted pedals / 202 files / 12.2 MB); `catalog:guard-batch-pr
  --allow-pipeline` clean.
- **Checks:** lint / typecheck / test **676** / build / e2e **258 passed +
  7 skipped**; app QA **44/44** (desktop Chromium, mobile Chromium, WebKit,
  Firefox) with no console errors.
- **Reviews:** `catalog-image-reviewer` pass 1 accept (q80), pass 2 flagged
  Enzo/Hedra only pending the dedicated 2× crop, pass 3 accept 20/20; code
  review skipped (data/assets + the owner-approved `curated.ts` override).
- **Evidence:** branch `p5-03-pedals-meris-1-evidence` (commit `204ae68`),
  `docs/screenshots/P5-03-meris-1/`.
- **Demo share link:** a read-only scene on the PR preview with all 10 batch
  pedals laid out on one Aclam Smart Track L2 board (4 X-series + 5 compact +
  MIDI I/O); verified 1 board / 10 items. URL in the PR description.

## Demo share link rule

Every batch PR description must include a `?share=1#s=…` demo link that opens
one pedalboard (or several when a single board is too small) containing **every
item added by that batch**. Verify the link loads the expected board/item counts
before opening the PR. Codified in `docs/tasks/P5-batch-template.md`,
`docs/tasks/P5-03-pilot-parallel-backfill.md` and
`docs/catalog-backfill.md` (owner instruction, 2026-10-25).

## Notes

- The rich official manuals are the source for audio I/O, power, MIDI/USB and
  physical facts; the hosted image is the official transparent top-down render
  (plus one authorized-retailer MIDI I/O image).
- Deferred: Preset Switch + 4 colour variants.
- Owner-approved deviation: verified Meris `effectTypes` live in
  `tools/catalog-transform/curated.ts` because the no-drift test requires the
  runtime types to equal the curated/classifier derivation. This is the only
  non-data file in the PR; no generated/mapped/runtime file is included.
