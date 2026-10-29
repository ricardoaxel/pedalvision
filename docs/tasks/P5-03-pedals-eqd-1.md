# P5-03: EarthQuaker Devices — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** todo · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-3` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds (`data/catalog/research/pedals/earthquaker/eqd-1.json`).
> The `catalog:wave` wrapper starts `earthquaker/eqd-1` (total 26) at launch. **Never
> run `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately
> after setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch earthquaker/eqd-1`.

## Goal

Deliver EarthQuaker Devices' first catalog batch: re-host and fully document the **18
existing seed items** (18 mock/static) plus **8 new Tier A items**, then open exactly
one PR. This is the brand's cleanup batch — after it, no EQD item may ship a
mock/placeholder asset.

## Scope (exact 26; verify counts from the regenerated ledger)

Base: `origin/main` at `bf083ed` = **444 pedals / 15 boards**, ledger **459**.

### Existing 18 — re-host + document (raw scaffolds already written)

| # | id | Name | Current | Hosting |
|---|---|---|---|---|
| 1 | `earthquaker-a-b-box` | A/B Box | mock | mock |
| 2 | `earthquaker-acapulco-gold` | Acapulco Gold | mock | mock |
| 3 | `earthquaker-afterneath` | Afterneath | mock | mock |
| 4 | `earthquaker-afterneath-v3` | Afterneath V3 | mock | mock |
| 5 | `earthquaker-afterneath-v3-pastel-purple` | Afterneath V3 (Pastel Purple) | mock | mock |
| 6 | `earthquaker-afterneath-v3-raw` | Afterneath V3 (Raw) | mock | mock |
| 7 | `earthquaker-aqueduct` | Aqueduct | static | mock |
| 8 | `earthquaker-arpanoid` | Arpanoid | mock | mock |
| 9 | `earthquaker-arrows` | Arrows | mock | mock |
| 10 | `earthquaker-arrows-v2` | Arrows V2 | mock | mock |
| 11 | `earthquaker-astral-destiny` | Astral Destiny | mock | mock |
| 12 | `earthquaker-aurelius` | Aurelius | mock | mock |
| 13 | `earthquaker-avalanche-run` | Avalanche Run | mock | mock |
| 14 | `earthquaker-avalanche-run-v2` | Avalanche Run V2 | mock | mock |
| 15 | `earthquaker-avalanche-run-v2-black` | Avalanche Run V2 (Black) | mock | mock |
| 16 | `earthquaker-avalanche-run-v2-mint` | Avalanche Run V2 (Mint) | mock | mock |
| 17 | `earthquaker-avalanche-run-v2-purple-sparkle` | Avalanche Run V2 (Purple Sparkle) | mock | mock |
| 18 | `earthquaker-barrows-fuzz` | Barrows Fuzz | mock | mock |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify every
dimension against the official EQD spec page/manual** (unit, never an accessory),
verify the effect tags, and add power + all connectors.

### New 8 (net-new)

Alphabetical Tier A order after the existing items (inventory order; distinct models
preferred over finish variants). Substitute only with a recorded reason if an item has
no verifiable source; do not invent facts.

| # | id | Name |
|---|---|---|
| 19 | `earthquaker-bellows` | Bellows |
| 20 | `earthquaker-bit-commander` | Bit Commander |
| 21 | `earthquaker-black-ash` | Black Ash |
| 22 | `earthquaker-black-eye` | Black Eye |
| 23 | `earthquaker-blumes` | Blumes |
| 24 | `earthquaker-bows` | Bows |
| 25 | `earthquaker-cloven-hoof` | Cloven Hoof |
| 26 | `earthquaker-data-corrupter` | Data Corrupter |

Do not force 26: if a new item has no verifiable official source, record the gap,
keep it out of the shipped scope, state it in the PR, and do not invent facts. The
18 existing items are mandatory.

## Expected CI

Base `444/15`; this branch adds **8 net-new** → expected `catalog:ci`
**452 pedals / 15 boards**. State the actual number in the PR. Final after all
T-6 merges: **468 / 15** (ledger 483).

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance (verify against the official page/manual) |
|---|---|
| A/B Box | Utility switcher; verify `deviceType`, form factor and passive/powered status |
| Afterneath variants | Same enclosure, different finish; verify each finish is a real SKU |
| Avalanche Run variants | Same enclosure, different finish; verify each finish is a real SKU |
| Arrows / Arrows V2 | Verify the V2 differences and exact dimensions |
| Bit Commander / Data Corrupter | Larger-format units; verify dimensions, power draw and jack faces |
| Black Ash / Black Eye / Cloven Hoof | Fuzz/overdrive; verify each independently (Black Ash is a limited run) |
| Bellows / Blumes / Bows | Standard compact pedals; verify independently |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/tasks/T-4b-source-discovery.md` (bounded discovery + planner-share guard)

Read only the sections the task file points to; do not read whole docs.

## Coordinator / routing (folded from the token review, 2026-10-28)

- **Model routing:** use only `opencode-go/deepseek-v4.1-flash` for reasoning and the
  single vision pass. If the session is on another model, or it returns
  429/401/quota/timeout/empty, STOP and report the model + operation + exact error;
  never substitute.
- **Feature lane:** F-05 is a separate dirty WIP feature branch (0 catalog overlap).
  Log feature spend at each checkpoint; start no new wave if feature + wave billed
  reaches 3.4M; the wave hard cap stays 2.4M.
- **`curated.ts`:** batches never edit `tools/`. If the no-drift test needs a verified
  override, stop and hand it to the coordinator serially.
- **Baseline:** take the before screenshots and verify the post-merge build from the
  clean detached worktree `/Users/ashel/Documents/Programming/pedalvision-t6-baseline`
  at `origin/main` (`bf083ed`), never from a dirty feature checkout.
- **Checkpoint-first (T-5 lesson):** all three T-5 batches tripped the 12-min per-item
  stall threshold by researching before the first checkpoint. Checkpoint item 1
  **immediately after setup**, then checkpoint inline after every item.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an
  uncommitted app-workspace runtime** for Playwright; the post-merge build commits
  mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art specs
  under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Evidence branches (T-5 lesson):** the batch PR branch contains **raw records +
  assets + this task file only** (plus `curated.ts` only when required). Put
  screenshots/contact sheets on `p5-03-pedals-eqd-1-evidence` and embed the
  evidence-branch raw URLs in the PR, or `catalog:guard-batch-pr` fails.
- **Existing-item rule:** the 18 raw scaffolds are `legacy`/`pending-replacement`.
  For each, replace the asset with a self-hosted 800/350 AVIF and update
  `imageProvenance` to the real final source (official/retailer/community/planner
  last-resort/generated) including source dimensions + upscale factor.
- **Bounded discovery (T-4b):** official first; then at most **one** Google/Bing
  Images attempt per batch and ≤20 source-page fetches (≤3/item), only for items whose
  official candidate failed. Record the source-discovery log (queries, candidate URLs,
  accept/reject, zero-yield). Marketplace images are locators first; ship them only
  when no official asset exists, as `kind: "retailer"` + `license-pending`, with the
  product-page URL and resolved CDN URL. Never hotlink.
- **One dual-tone contact sheet** (diagonal white/dark or checkerboard) so a white
  **or** black halo is visible. One sheet per 10–30 cells, max 2 vision passes. Reject
  angled/high-res-but-not-flat images.
- **Planner-share guard:** target ≤30% of new/replaced items; if >50%, run one
  documented discovery round; if still >50%, ship with the share + a waiver line for
  the owner. Never a silent majority-planner batch.
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or jagged
  edge. Use `--matte none` for an already-clean transparent PNG; never re-key a
  transparent source.
- **Resolution is not a rejection reason:** upscale soft ceiling ≤2× (above that use
  generated art unless the single reviewer pass accepts it, recorded). Gate the
  **final 800 rendition**; record source URL, dimensions and upscale factor.
- **Jack edges require a verified source** (official rear/top photo, support page or
  manual diagram — including image-only/scanned PDFs). Text-layer first; if no
  official source shows the face, omit the edge with `confidence: "unknown"` and
  record why. Never infer from a sibling model or form factor.
- **Footprint dimensions come from the official unit spec, never an accessory;**
  record the dimension source before the aspect gate.
- **Analyzer:** process to the 800/350 master first, then `pnpm asset:analyze` with
  `--source photo|planner|generated`; `asset:psnr` ≥40 dB.
- **Before/after screenshots (desktop + mobile)** are mandatory for the seeded image
  replacements: capture the same viewport/theme/state on `main` and on this branch,
  embed both inline in the PR, and add a before/after contact-sheet crop.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light code
  review (data-only may skip); 4 h active; 12 min/item stall threshold. Checkpoint
  after every item.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch earthquaker/eqd-1 --origin <PR-preview-origin>
  --out work/catalog/eqd-1-demo.txt`; verify board/item/cable counts.
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Steps

1. Restate the exact 26-item scope; confirm the 18 raw scaffolds.
2. Checkpoint item 1 immediately, then verify dimensions/effect tags/power/connectors
   per item and checkpoint inline after each item.
3. Run the deterministic image scripts per item (process → analyze → psnr → dual-tone
   contact sheet); record provenance + source dimensions/upscale.
4. Connector-face check for jack edges (`catalog:check-jacks`); omit unknown edges.
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci`, and the Playwright
   picker/render check (desktop + mobile).
6. Run `pnpm catalog:guard-batch-pr`; PR = raw records + assets + this task file only.
7. Produce the contact sheet + coverage/planner-share report.
8. Build the demo share link and verify counts.
9. Finish the batch (`pnpm catalog:finish --batch earthquaker/eqd-1`), then open
   exactly one PR with the required sections (summary, changes, testing steps,
   before/after screenshots, owner review hints, review digest, demo link, billed
   tokens/minutes). Do not merge.

## Acceptance (executable)

- Raw records cover the 26; mandatory fields present; optional only if found.
- Images: 800/350, alpha/background/aspect pass, same-origin; no placeholder in
  shipped scope; planner share recorded (≤30% target, waiver if >50%).
- `catalog:check-jacks` green; `catalog:validate` green in CI temp build;
  `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright: picker search/brand/effect, image load, canvas placement, no console
  errors; desktop + mobile before/after screenshots in the PR.
- Contact sheet + coverage/reject report in the PR; demo share link verified.
- One PR; no merge.
