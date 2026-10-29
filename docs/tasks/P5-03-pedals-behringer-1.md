# P5-03: Behringer — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in progress — cleanup-wave-4 · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-4` coordinator created this worktree, wrote the existing-item
> raw scaffold (`data/catalog/research/pedals/behringer/behringer-1.json`) and
> will start `behringer/behringer-1` (total 26) via `catalog:wave`. **Never run
> `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately after
> setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch behringer/behringer-1`.

## Goal

Deliver Behringer's first catalog batch: re-host and fully document the **1
existing seed item** (hotlinked Powerplay P1) plus **25 new Tier A items**, then
open exactly one PR. After this batch no Behringer item may ship a
hotlinked/mock/placeholder asset.

## Scope (exact 26; verified from the ledger + inventory at T-7 handoff)

Base: `origin/main` at `46c03b5` = **468 pedals / 15 boards**, ledger **483**.
Behringer Tier A inventory = **52** including the existing Powerplay P1, so
**51 net-new** are available; this batch takes the first 25 in inventory order.

### Existing 1 — re-host + document (raw scaffold already written)

| # | id | Name | Current | Hosting |
|---|---|---|---|---|
| 1 | `behringer-powerplay-p1` | Powerplay P1 | hotlinked | url |

The scaffold carries old approximate facts only. Verify the official dimensions
(unit, never an accessory), effect/device type, power and every connector. Replace
the hotlink with a self-hosted 800/350 AVIF and record `imageProvenance`.

### New 25 (net-new, inventory order)

| # | id | Name |
|---|---|---|
| 2 | `behringer-69-vibe` | 69 Vibe |
| 3 | `behringer-adi21-acoustic-di-box` | ADI21 Acoustic DI Box |
| 4 | `behringer-b-tron-iii-envelope-filter` | B-Tron III Envelope Filter |
| 5 | `behringer-bdi21-bass-di-box` | BDI21 Bass DI Box |
| 6 | `behringer-beq700-bass-graphic-equalizer` | BEQ700 Bass Graphic Equalizer |
| 7 | `behringer-ble400-bass-limiter-enhancer` | BLE400 Bass Limiter Enhancer |
| 8 | `behringer-bm-11m-low-pass-filter` | BM-11M Low Pass Filter |
| 9 | `behringer-bm-12-ring-modulator` | BM-12 Ring Modulator |
| 10 | `behringer-bm-15m-resonance-filter` | BM-15M Resonance Filter |
| 11 | `behringer-bod400-bass-overdrive` | BOD400 Bass Overdrive |
| 12 | `behringer-bass-brassmaster-fuzz` | Bass Brassmaster Fuzz |
| 13 | `behringer-cc300-chorus-space-c` | CC300 Chorus Space-C |
| 14 | `behringer-cl9-compressor-limiter` | CL9 Compressor/Limiter |
| 15 | `behringer-cs400-compressor-sustainer` | CS400 Compressor Sustainer |
| 16 | `behringer-centara-overdrive` | Centara Overdrive |
| 17 | `behringer-centaur-overdrive` | Centaur Overdrive |
| 18 | `behringer-chorus-symphony` | Chorus Symphony |
| 19 | `behringer-dd600-digital-delay` | DD600 Digital Delay |
| 20 | `behringer-dr600-digital-reverb` | DR600 Digital Reverb |
| 21 | `behringer-dual-phase` | Dual-Phase |
| 22 | `behringer-eq700-graphic-equalizer` | EQ700 Graphic Equalizer |
| 23 | `behringer-fc600` | FC600 |
| 24 | `behringer-fcv100` | FCV100 |
| 25 | `behringer-fd300-ultra-feedback-distortion` | FD300 Ultra Feedback/Distortion |
| 26 | `behringer-fs112bv-dual-footswitch` | FS112BV Dual Footswitch |

Do not force 26: if a new item has no verifiable official source, record the gap,
keep it out of scope, state it in the PR and do not invent facts. The 25 listed
items are the planned replacement; substitute only with a recorded reason.

## Expected CI

Base `468/15`; this branch adds **25 net-new** → expected `catalog:ci`
**493 pedals / 15 boards**. State the actual number in the PR. Expected final
ledger after merge: **508**.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance |
|---|---|
| Powerplay P1 | Personal in-ear monitor / headphone amp; verify `deviceType`, power, ins/outs and whether it is a belt-pack form factor |
| ADI21 / BDI21 / GDI21 | DI boxes; verify balanced XLR out, ground lift, `deviceType` |
| BM-11M / BM-12 / BM-15M | Behringer modular-synth-style stompboxes; verify enclosure + CV/audio connectors |
| FC600 / FCV100 / FS112BV | Foot controller / volume / dual footswitch; verify `deviceType`, jacks and that they are not audio effects |
| All others | Standard Behringer compact enclosures; verify dimensions, controls, effect tag, power and jacks independently |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/tasks/T-4b-source-discovery.md` (bounded discovery + planner-share guard)

Read only the sections the task file points to; do not read whole docs.

## Coordinator / routing (T-6 lessons folded)

- **Model routing:** only `opencode-go/deepseek-v4.1-flash` for reasoning and the
  single vision pass. On 429/401/quota/timeout/empty, STOP and report the model +
  operation + exact error; never substitute.
- **Feature lane:** F-05 (#81) is a separate feature PR. A catalog batch never
  touches feature paths. Log billed tokens by class at each checkpoint.
- **`curated.ts` is COORDINATOR-ONLY.** Never edit `tools/`. If the no-drift test
  needs an effect override, stop and hand the exact key + official wording to the
  coordinator; the coordinator makes the shared-file edit.
- **Baseline:** take the before screenshots from your own clean detached worktree
  `/Users/ashel/Documents/Programming/pedalvision-t7-baseline-behringer` at
  `origin/main` (`46c03b5`), never from a dirty feature checkout or a shared dir.
- **Checkpoint-first (mandatory T-6 lesson):** checkpoint item 1 **immediately
  after setup**, then inline after every item. An `exit 75` /
  `per-item limit exceeded` checkpoint result is **advisory** (30-min limit) —
  keep going; do not stop and do not `catalog:resume` for it.
- **Budget edges:** 800k is the hard brake; 2.4M is an owner-escalation trigger at a
  checkpoint. At 320k trim discovery, not verification.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an
  uncommitted app-workspace runtime** for Playwright; the post-merge build commits
  mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; never add it preemptively. Generated pedal-art specs
  under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Evidence branch (mandatory):** the batch PR branch contains **raw records +
  assets + this task file only**. Put screenshots/contact sheets on
  `p5-03-pedals-behringer-1-evidence` and embed the evidence-branch raw URLs in the
  PR, or `catalog:guard-batch-pr` fails.
- **Existing-item rule:** the raw scaffold is `legacy`/`pending-replacement`. Replace
  the asset with a self-hosted 800/350 AVIF and update `imageProvenance` to the real
  final source (official/retailer/community/planner last-resort/generated), including
  source dimensions + upscale factor. Never keep the hotlink.
- **Image hierarchy:** official brand/press/support → authorized retailer → recorded
  community/aggregator → recorded planner last-resort → generated flat art only if
  none exists/passes. The owner's explicit list overrides the agent. Planner is a
  counted source gap. Boards are out of scope.
- **Bounded discovery (T-4b):** registry-first; ≤2 search-engine pages + ≤20
  source-page fetches per batch (≤3/item); deterministic curl+regex, never dump HTML
  into context; log queries/candidates/accept-reject/zero-yield. Marketplace pixels
  are `kind: "retailer"` + `license-pending` + counted gaps, self-hosted, product
  page + resolved URL recorded, never hotlinked.
- **One dual-tone contact sheet** (diagonal white/dark or checkerboard) for the
  halo/fringe gate; one sheet per 10–30 cells; max **2 vision passes** total. Reject
  angled/high-res-but-not-flat images. Flatness is judged at 1:1: a bezel, inset
  faceplate or stepped chassis is not a side wall.
- **Planner-share guard:** target ≤30%; if >50% after one documented discovery round,
  ship with the share + a waiver line for the owner (owner decides at merge).
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or jagged
  edge. `--matte none` for an already-clean transparent PNG; never re-key a
  transparent source.
- **Resolution:** prefer the highest-resolution real source; upscale soft ceiling
  ≤2× (above that use generated art unless the single reviewer pass explicitly
  accepts it, recorded, and the item stays a counted gap). Gate the **final 800
  rendition**; record source URL, dimensions and upscale factor.
- **Jack edges require a verified source** (official rear/top photo, support page or
  manual diagram — including image-only/scanned PDFs). **Text-layer first**; if no
  official source shows the face, omit the edge with `confidence: "unknown"` and
  record why. Never infer from a sibling model or form factor. The owner may direct
  an assumed edge — then record the owner instruction as the source and state it is
  assumed.
- **Footprint dimensions come from the official unit spec, never an accessory;**
  record the dimension source before the aspect gate.
- **Analyzer:** process to the 800/350 master first, then `pnpm asset:analyze` with
  `--source photo|planner|generated`; `asset:psnr` ≥40 dB.
- **Before/after screenshots (desktop + mobile)** are mandatory for the seeded image
  replacement: same viewport/theme/state on `main` and on this branch, both embedded
  inline in the PR, plus a before/after contact-sheet crop.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light code
  review (data-only may skip; a `curated.ts` change needs one); 4 h active. The wave
  soft is 1.6M / hard 2.4M.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch behringer/behringer-1 --origin <PR-preview-origin>
  --out work/catalog/behringer-1-demo.txt`; verify board/item/cable counts.
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Steps

1. Restate the exact 26-item scope; confirm the existing raw scaffold.
2. Checkpoint item 1 immediately, then verify dimensions/effect/device type/power/
   connectors per item and checkpoint inline after each item.
3. Run the deterministic image scripts per item (process → analyze → psnr → dual-tone
   contact sheet); record provenance + source dimensions/upscale.
4. Connector-face check for jack edges (`catalog:check-jacks`); omit unknown edges.
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci`, and the Playwright
   picker/render check (desktop + mobile).
6. Run `pnpm catalog:guard-batch-pr`; PR = raw records + assets + this task file only.
7. Produce the contact sheet + coverage/planner-share report.
8. Build the demo share link and verify counts.
9. Finish the batch (`pnpm catalog:finish --batch behringer/behringer-1`), then open
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
