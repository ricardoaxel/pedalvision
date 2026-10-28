# P5-03: Electro-Harmonix — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #70 (T-4 cleanup wave 1, 3-wide) · **Model:** build-strong

> The `cleanup-wave-1` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds. The `catalog:wave` wrapper starts `ehx/ehx-1`
> (total 26) at launch. **Never run `catalog:start`/`catalog:resume`.** Checkpoint
> inline after every item and finish with
> `pnpm catalog:finish --batch ehx/ehx-1`.

## Goal

Deliver Electro-Harmonix's first catalog batch: re-host and fully document the
**18 existing seed items** (currently hotlinked) plus **8 new Tier A items**, then
open exactly one PR. This is the brand's cleanup batch — after it, no EHX item may
ship a hotlinked/mock asset.

## Scope (exact 26)

### Existing 18 — re-host + document (raw scaffolds already written)

Current hotlinked candidate (verify/replace; record the final source):

| # | id | Name | Current image candidate |
|---|---|---|---|
| 1 | `electro-harmonix-1-echo` | #1 Echo | https://www.ehx.com/wp-content/uploads/2020/10/echo1-v.jpg |
| 2 | `electro-harmonix-1440-stereo-looper` | 1440 Stereo Looper | https://www.ehx.com/wp-content/uploads/2020/10/1440looper-1.jpg |
| 3 | `electro-harmonix-15watt-howitzer` | 15Watt Howitzer | https://www.ehx.com/wp-content/uploads/2021/03/15w-howitzer-1.jpg |
| 4 | `electro-harmonix-2020-tuner` | 2020 Tuner | https://www.ehx.com/wp-content/uploads/2020/10/ehxminituner-1.jpg |
| 5 | `electro-harmonix-2020-tuner-v2` | 2020 Tuner v2 | https://www.ehx.com/wp-content/uploads/2024/12/20202.jpeg |
| 6 | `electro-harmonix-22500-dual-stereo-looper` | 22500 Dual Stereo Looper | https://www.ehx.com/wp-content/uploads/2020/10/22500-1.jpg |
| 7 | `electro-harmonix-22500-foot-controller` | 22500 Foot Controller | https://www.ehx.com/wp-content/uploads/2020/10/22500FC-1.jpg |
| 8 | `electro-harmonix-44-magnum-power-amp` | 44 Magnum Power Amp | https://www.ehx.com/wp-content/uploads/2020/12/44-mag-1.jpg |
| 9 | `electro-harmonix-5mm-power-amp` | 5mm Power Amp | https://www.ehx.com/wp-content/uploads/2020/10/5mmamp-1.jpg |
| 10 | `electro-harmonix-720-stereo-looper` | 720 Stereo Looper | https://www.ehx.com/wp-content/uploads/2020/10/720-1.jpg |
| 11 | `electro-harmonix-8-step-program` | 8 Step Program | https://www.ehx.com/wp-content/uploads/2020/10/8-step-program-zoom.jpg |
| 12 | `electro-harmonix-95000-performance-loop-laboratory` | 95000 Performance Loop Laboratory | https://www.ehx.com/wp-content/uploads/2020/10/95000-1.jpg |
| 13 | `electro-harmonix-analogizer` | Analogizer | https://www.ehx.com/wp-content/uploads/2020/10/analogizer-1.jpg |
| 14 | `electro-harmonix-attack-decay` | Attack Decay | https://www.ehx.com/wp-content/uploads/2020/10/attackdecay-1.jpg |
| 15 | `electro-harmonix-b9-organ-machine` | B9 Organ Machine | https://www.ehx.com/wp-content/uploads/2020/11/B9-1.jpg |
| 16 | `electro-harmonix-bad-stone` | Bad Stone | https://www.ehx.com/wp-content/uploads/2020/10/badstone-f-1.jpg |
| 17 | `electro-harmonix-bass-big-muff-pi` | Bass Big Muff Pi | https://www.ehx.com/wp-content/uploads/2020/10/bassbm-v-1.jpg |
| 18 | `electro-harmonix-bass-big-muff-pi-2` | Bass Big Muff Pi 2 | https://www.ehx.com/wp-content/uploads/2026/02/bbm2-0-2.jpg |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify
every dimension against the official EHX spec sheet** (unit/receiver, never an
accessory), verify the effect tags, and add power + all connectors.

### New 8 (net-new)

Alphabetical Tier A order after the existing 18:

| # | id | Name |
|---|---|---|
| 19 | `electro-harmonix-bass-clone` | Bass Clone |
| 20 | `electro-harmonix-bass-micro-synth` | Bass Micro Synth |
| 21 | `electro-harmonix-bass-mono-synth` | Bass Mono Synth |
| 22 | `electro-harmonix-bass-preacher` | Bass Preacher |
| 23 | `electro-harmonix-bass-soul-food` | Bass Soul Food |
| 24 | `electro-harmonix-bass9-bass-machine` | Bass9 Bass Machine |
| 25 | `electro-harmonix-bassballs` | Bassballs |
| 26 | `electro-harmonix-battalion` | Battalion |

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
| 22500 Foot Controller | `controller`; not a stompbox — verify deviceType/formFactor |
| 8 Step Program | `controller`/sequencer; `standard` or `double` |
| 95000 Performance Loop Laboratory | desktop looper; verify `standard` and 32.39×14.99 (seed approx) |
| 1440/720 Stereo Looper, 22500 | pedal looper; verify compact vs double vs standard |
| 15Watt Howitzer, 44 Magnum, 5mm Power Amp | power amp; verify `deviceType` `power-amp` and pedal form |
| 2020 Tuner / v2 | mini tuner; verify `tuner` + `mini` |
| Bass Micro Synth / Bass Mono Synth / Bass9 | synth; verify form factor (`standard`/`double`) |
| Bass Clone, Bass Preacher, Bass Soul Food, Bassballs, Battalion | compact bass pedal; verify effect tags |

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
- **Image policy (T-1a, planner last-resort):** official EHX product gallery/
  support → authorized retailer → user/community (recorded URL) → **planner/
  Pedalplayground last resort (recorded + quality-gated)** → generated flat art
  only when none exists. Record `imageProvenance` for every item; never put a
  planner/community URL on the public page. **Resolution is not a rejection
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
2. The raw file `data/catalog/research/pedals/electro-harmonix/ehx-1.json`
   already has the 18 scaffolds. Add the 8 new records.
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
7. Demo link: `pnpm catalog:demo-link --batch ehx/ehx-1 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile
   **before/after** screenshots of the re-hosted seed images.

## Acceptance (executable)

- 26 raw records (18 re-hosted + 8 new); mandatory fields present; optional fields
  only if found.
- Correct `deviceType`/`formFactor`/`effectTypes` (only raw-schema enums).
- Images 800/350 AVIF, alpha/background/aspect pass, same-origin, no placeholders;
  every item has recorded `imageProvenance`; **no EHX hotlinked/mock item remains**.
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
