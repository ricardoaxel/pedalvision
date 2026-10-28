# P5-03: MXR — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #72 · **Model:** build-strong

> The `cleanup-wave-1` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds. The `catalog:wave` wrapper starts `mxr/mxr-1`
> (total 26) at launch. **Never run `catalog:start`/`catalog:resume`.** Checkpoint
> inline after every item and finish with
> `pnpm catalog:finish --batch mxr/mxr-1`.

## Goal

Deliver MXR's first catalog batch: re-host and fully document the **18 existing
seed items** (currently hotlinked) plus **8 new Tier A items**, then open exactly
one PR. After this batch no MXR item may ship a hotlinked/mock asset.

## Scope (exact 26)

### Existing 18 — re-host + document (raw scaffolds already written)

Current hotlinked candidate (verify/replace; record the final source):

| # | id | Name | Current image candidate |
|---|---|---|---|
| 1 | `mxr-a-b-box` | A/B Box | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/680/images/6691/13196000001.MAIN__61231.1663874799.386.513.jpg?c=2 |
| 2 | `mxr-analog-chorus` | Analog Chorus | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/629/images/6423/11234000001.MAIN__89220.1663874795.386.513.jpg?c=2 |
| 3 | `mxr-bass-chorus-deluxe` | Bass Chorus Deluxe | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/572/images/6097/11083000001.MAIN__53416.1663874792.386.513.jpg?c=2 |
| 4 | `mxr-bass-compressor` | Bass Compressor | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/575/images/10108/M87.MAIN__61433.1676394506.386.513.jpg?c=2 |
| 5 | `mxr-bass-di` | Bass DI+ | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/610/images/6317/11180000001.MAIN__98491.1663874794.386.513.jpg?c=2 |
| 6 | `mxr-bass-distortion` | Bass Distortion | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/574/images/6109/11085000001.MAIN__35105.1663874792.386.513.jpg?c=2 |
| 7 | `mxr-bass-envelope-filter` | Bass Envelope Filter | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/571/images/10098/M82.MAIN__91817.1676394282.386.513.jpg?c=2 |
| 8 | `mxr-bass-fuzz-deluxe` | Bass Fuzz Deluxe | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/573/images/6103/11084000001.MAIN__93896.1663874792.386.513.jpg?c=2 |
| 9 | `mxr-bass-octave-deluxe` | Bass Octave Deluxe | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/642/images/6499/11288000001.MAIN__08504.1663874796.386.513.jpg?c=2 |
| 10 | `mxr-bass-overdrive` | Bass Overdrive | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/576/images/6121/11089000001.MAIN__87674.1663874792.386.513.jpg?c=2 |
| 11 | `mxr-bass-preamp` | Bass Preamp | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/570/images/6085/11081000001.MAIN__33843.1663874792.386.513.jpg?c=2 |
| 12 | `mxr-bass-synth` | Bass Synth | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/2325/images/11620/M301.MAIN__82591.1746129775.386.513.jpg?c=2 |
| 13 | `mxr-blue-box-fuzz` | Blue Box Fuzz | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/592/images/6211/11103000001.MAIN__02046.1663874793.386.513.jpg?c=2 |
| 14 | `mxr-booster-mini` | Booster Mini | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/646/images/6521/11293000001.MAIN__23166.1663874797.386.513.jpg?c=2 |
| 15 | `mxr-cae-boost-line-driver` | CAE Boost/Line Driver | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/651/images/6550/11401000001.MAIN__73157.1663874797.386.513.jpg?c=2 |
| 16 | `mxr-cae-boost-overdrive` | CAE Boost/Overdrive | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/652/images/6556/11402000001.MAIN__49202.1663874797.386.513.jpg?c=2 |
| 17 | `mxr-cae-buffer` | CAE Buffer | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/655/images/6574/11406000001.MAIN__77746.1663874797.386.513.jpg?c=2 |
| 18 | `mxr-cae-power-system` | CAE Power System | https://cdn11.bigcommerce.com/s-n26aknlnlm/products/2112/images/10778/MC403.MAIN__04016.1702502300.386.513.jpg?c=2 |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify
every dimension against the official Dunlop/MXR spec sheet** (unit/receiver, never
an accessory), verify the effect tags, and add power + all connectors. The MXR
site and the official MXR manuals (`jimdunlop.com/content/manuals/<model>.pdf`)
are the primary sources.

### New 8 (net-new)

Alphabetical Tier A order after the existing 18:

| # | id | Name |
|---|---|---|
| 19 | `mxr-carbon-copy` | Carbon Copy |
| 20 | `mxr-carbon-copy-analog-10th-anniversary` | Carbon Copy Analog (10th Anniversary) |
| 21 | `mxr-carbon-copy-bright` | Carbon Copy Bright |
| 22 | `mxr-carbon-copy-deluxe` | Carbon Copy Deluxe |
| 23 | `mxr-carbon-copy-mini` | Carbon Copy Mini |
| 24 | `mxr-classic-108-fuzz` | Classic 108 Fuzz |
| 25 | `mxr-classic-108-fuzz-mini` | Classic 108 Fuzz Mini |
| 26 | `mxr-clone-looper` | Clone Looper |

Do not force 26: if one of the 8 new items has no verifiable official source,
record the gap, keep it out of the shipped scope, state it in the PR, and do not
invent facts. The 18 existing items are mandatory.

## Expected CI

Each batch branches from `main` (**399 pedals / 15 boards**). This branch adds
**8 net-new** → expected `catalog:ci` **407 pedals / 15 boards**. State the actual
number in the PR. Final after all T-4 merges: **423 pedals / 15 boards**.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance (verify against the official page/manual) |
|---|---|
| CAE Power System | power supply; verify `category` (`supply`?) + `deviceType` and the 34.29×10.16 seed footprint |
| A/B Box | `ab-box`; verify `deviceType` and 12.07×9.27 |
| Bass DI+ | has DI; verify XLR + audio jacks and the larger enclosure |
| CAE Buffer | small/standard; verify 6.96×7.29 |
| Booster Mini | `mini`; verify 4.42×9.4 |
| Carbon Copy family | compact delay; verify each variant's controls/spec, 10th Anniversary vs standard, and Mini form factor |
| Classic 108 Fuzz / Mini | fuzz; verify standard vs mini form factor |
| Clone Looper | looper; verify standard vs double |
| All others | MXR standard 6.78×11.43 (verify, do not copy blindly) |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and
  an uncommitted app-workspace runtime** for Playwright; the post-merge build
  commits mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art
  specs under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Existing-item rule:** the 18 raw scaffolds are `legacy`/`pending-replacement`.
  For each, replace the asset with a self-hosted 800/350 AVIF and update
  `imageProvenance` to the real final source (official/retailer/community/planner
  last-resort/generated) including source dimensions + upscale factor. Never keep
  the hotlinked URL as the shipped image.
- **Capture every connector with its position**; only audio I/O is a cable anchor.
- **Jack edges require a verified source** (official rear/top photo, support page,
  manual diagram, including scanned/image-only PDFs). Text-layer first; else one
  connector-strip crop inside the existing contact-sheet/vision pass. Omit the
  edge + `confidence: "unknown"` with a one-line reason if no official source
  shows the face. Never infer from a sibling model or form factor. Run
  `pnpm catalog:check-jacks`.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens.
- **Image policy (T-1a, planner last-resort):** official MXR/Dunlop product
  gallery/support → authorized retailer → user/community (recorded URL) →
  **planner/Pedalplayground last resort (recorded + quality-gated)** → generated
  flat art only when none exists. Record `imageProvenance` for every item; never
  put a planner/community URL on the public page. **Resolution is not a rejection
  reason (rule PR #69):** process the highest-resolution real source to the
  800/350 master and gate the **final 800 rendition** (soft ceiling ≤2×); prefer
  it over generated art. Check the source registry first; gate the processed
  output before it enters the contact sheet. Hard cap 2 vision passes.
- **Clean-alpha + AVIF gate:** 800/350 AVIF, aspect/alpha/bg pass, PSNR ≥40 dB
  (q90 escalation), `--matte none` for already-transparent sources, flood/
  components/global per the template. Defringe/re-source if a halo appears.
- **Generated art:** `docs/catalog/pedal-art.md`; one spec per item, body median
  sampled, no planner pixels as reference, no logo/shadow/gradient.
- **Budget (T-4 lane):** billed non-cache soft **≤400k / hard ≤800k**; ≤2
  contact-sheet vision passes; ≤1 light code review (data-only: normally skip
  unless `curated.ts` changed); **4 h active hard**; 12 min/item is a per-item
  stall threshold. At 80% of soft (320k), checkpoint + log the projection; at the
  hard cap (800k), pause/stop and report — do not open a partial PR. Wave: soft
  1.6M / hard 2.4M billed non-cache.
- Status every 15 min; checkpoint after every item.
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Wave token-review adjustments (folded 2026-10-27)

- **One vision call:** all 26 cells + connector strips in a single contact-sheet
  call. A second pass (same session) is only for rejected/fixed cells; never
  vision-judge the Playwright app screenshots.
- **Billed ledger:** report root + vision + code-review spend. Root sub-cap
  **700k**; real batch hard **800k**; wave real hard **2.4M**; combined
  `min(2.4M, 3.4M − feature spend)`. The coordinator checks this at every poll.
- **Checks:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + one
  targeted Playwright picker/placement flow (desktop + mobile) for the
  screenshots; the full `pnpm e2e` suite runs in CI.
- **No refills while 3 catalog PRs await.** After an owner merge frees a slot,
  the coordinator verifies the post-merge build and coordinates the rebase/refill.
- **`curated.ts`:** prefer a raw no-drift override; at most one verified hunk per
  batch; a shared hunk is reviewed once across the wave.

## Steps

1. Restate scope (26) and expected CI (407/15); take the **before** screenshots
   (current hotlinked assets in the app, desktop + mobile) before editing data.
2. The raw file `data/catalog/research/pedals/mxr/mxr-1.json` already has the 18
   scaffolds. Add the 8 new records.
3. **Never run `catalog:start`/`catalog:resume`** — the `catalog:wave` wrapper
   starts this batch. Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place + before/after, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; CI runs the full
   `pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch mxr/mxr-1 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile
   **before/after** screenshots of the re-hosted seed images.

## Acceptance (executable)

- 26 raw records (18 re-hosted + 8 new); mandatory fields present; optional fields
  only if found.
- Correct `deviceType`/`formFactor`/`effectTypes` (only raw-schema enums).
- Images 800/350 AVIF, alpha/background/aspect pass, same-origin, no placeholders;
  every item has recorded `imageProvenance`; **no MXR hotlinked/mock item remains**.
- `catalog:check-jacks` green; `catalog:validate` green; `catalog:guard-batch-pr`
  green; PR contains no mapped/runtime edits.
- Playwright picker search/brand/effect, image load, canvas placement, no console
  errors (desktop + mobile).
- Contact sheet (10–30 images) + coverage/reject report in the PR.
- Demo share link with every batch item on one board + illustrative cables;
  counts verified.
- Before/after screenshots (desktop + mobile) for the seeded replacements.
- Billed tokens + minutes/item recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict recorded by the
  coordinator.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.
