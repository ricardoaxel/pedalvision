# P5-03: Dunlop — pedals batch 1 (Tier A)

**Phase:** P5 · **Status:** in review — PR pending · **Model:** deepseek-v4.1-flash

> The `tier-a-wave-1` coordinator created this worktree and will start
> `dunlop/dunlop-1` (total 26) via `catalog:wave`. **Never run
> `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately after
> setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch dunlop/dunlop-1`.

## Goal

Deliver Dunlop's first catalog batch: **26 new Tier A items** (Dunlop has no
existing catalog seeds), then open exactly one PR. Every item must ship a
self-hosted 800/350 AVIF with recorded provenance.

## Scope (exact 26; verified from the inventory at T-8 launch)

Base: `origin/main` at `b4a70ba` = **468 pedals / 15 boards**, ledger **483**.
Dunlop Tier A inventory = **65**, existing seeds = **0**. This batch takes the first
26 in inventory order.

| # | id | Name |
|---|---|---|
| 1 | `dunlop-akira-takasaki-cry-baby-fuzz-wah` | Akira Takasaki Cry Baby Fuzz Wah |
| 2 | `dunlop-authentic-hendrix-68-shrine-series-band-of-gypsys` | Authentic Hendrix '68 Shrine Series Band of Gypsys |
| 3 | `dunlop-authentic-hendrix-68-shrine-series-fuzz-face` | Authentic Hendrix '68 Shrine Series Fuzz Face |
| 4 | `dunlop-authentic-hendrix-68-shrine-series-octavio` | Authentic Hendrix '68 Shrine Series Octavio |
| 5 | `dunlop-authentic-hendrix-68-shrine-series-uni-vibe` | Authentic Hendrix '68 Shrine Series Uni-Vibe |
| 6 | `dunlop-band-of-gypsys-fuzz-face` | Band of Gypsys Fuzz Face |
| 7 | `dunlop-buddy-guy-cry-baby-signature` | Buddy Guy Cry Baby Signature |
| 8 | `dunlop-cae-wah` | CAE Wah |
| 9 | `dunlop-clyde-mccoy-cry-baby-wah` | Clyde McCoy Cry Baby Wah |
| 10 | `dunlop-cry-baby-535q-multi-wah` | Cry Baby 535Q Multi-Wah |
| 11 | `dunlop-cry-baby-95q-wah` | Cry Baby 95Q Wah |
| 12 | `dunlop-cry-baby-bb535-wah-reissue` | Cry Baby BB535 Wah Reissue |
| 13 | `dunlop-cry-baby-bass-wah` | Cry Baby Bass Wah |
| 14 | `dunlop-cry-baby-custom-badass-dual-inductor-wah` | Cry Baby Custom Badass Dual-Inductor Wah |
| 15 | `dunlop-cry-baby-daredevil-fuzz-wah` | Cry Baby Daredevil Fuzz Wah |
| 16 | `dunlop-cry-baby-evh-wah` | Cry Baby EVH Wah |
| 17 | `dunlop-cry-baby-junior-wah` | Cry Baby Junior Wah |
| 18 | `dunlop-cry-baby-mini-535q-wah` | Cry Baby Mini 535Q Wah |
| 19 | `dunlop-cry-baby-mini-bass-wah` | Cry Baby Mini Bass Wah |
| 20 | `dunlop-cry-baby-mini-wah` | Cry Baby Mini Wah |
| 21 | `dunlop-cry-baby-q-mini-535q-auto-return-wah` | Cry Baby Q Mini 535Q Auto-Return Wah |
| 22 | `dunlop-cry-baby-q-zone-auto-wah` | Cry Baby Q Zone Auto Wah |
| 23 | `dunlop-cry-baby-q-zone-fixed-wah` | Cry Baby Q Zone Fixed Wah |
| 24 | `dunlop-cry-baby-rack-foot-controller` | Cry Baby Rack Foot Controller |
| 25 | `dunlop-cry-baby-standard-wah` | Cry Baby Standard Wah |
| 26 | `dunlop-dvp3-volume-x` | DVP3 Volume X |

Do not force 26: if an item has no verifiable official source, record the gap and
state it in the PR; do not invent facts. Substitute only with a recorded reason.

### Session outcome (2026-10-29) — 25 items shipped

- **Item 22 `dunlop-cry-baby-q-zone-auto-wah` dropped with a recorded reason.**
  No official Dunlop product by that name exists: the official product sitemap,
  the official product data (GraphQL) and one web search all resolve “Q Zone” to
  the `QZ1` **Fixed** Wah only (shipped as item 23). No facts were invented and no
  substitute was forced.
- **Images:** 24 official Jim Dunlop views (MAIN/TOPP) + **1 generated Catalog
  Specimen** (`dunlop-cry-baby-mini-bass-wah`: the white-on-white official photos
  fail the clean-alpha gate). Planner share **0/25 (0%)**, retailer/marketplace
  **0**. Provenance is recorded per item in the raw file.
- **Discovery:** official product gallery + product data only; two generic web
  searches (one to confirm the missing Q Zone Auto Wah, one to confirm unit
  dimensions); no retailer/marketplace page fetches. Bounded pass well under the
  20-fetch limit; no planner fallback was needed.
- **Dimensions:** official per-model unit specs where published (DVP3 manual,
  MXR mini housing, standard rocker housing); each record names its source.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance |
|---|---|
| Cry Baby wahs (standard / 535Q / 95Q / BB535 / Bass / Custom Badass / EVH / Junior / Q Zone / Clyde McCoy / Buddy Guy / CAE / Akira Takasaki / Daredevil) | Treadle wah enclosures; verify the exact official footprint per unit. **Mini** wahs are a different, smaller enclosure — never reuse the standard wah footprint. |
| Fuzz Face / Band of Gypsys / Shrine Series Fuzz Face / Octavio / Uni-Vibe | Round or larger enclosures; verify each official footprint. Uni-Vibe is not a standard compact |
| Cry Baby Rack Foot Controller | Rack accessory / controller, **not** a stompbox effect; verify `deviceType`, connectors and whether it belongs in the pedal catalog |
| DVP3 Volume X | Volume/treadle pedal; verify `deviceType`, power and jacks |
| All others | Verify dimensions, controls, effect tag, power and jacks independently |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/tasks/T-4b-source-discovery.md` (bounded discovery + planner-share guard)

Read only the sections the task file points to; do not read whole docs.

## Coordinator / routing (T-6/T-7 lessons folded)

- **Model routing:** only `opencode-go/deepseek-v4.1-flash` for reasoning and the
  single vision pass. On 429/401/quota/timeout/empty, STOP and report the model +
  operation + exact error; never substitute.
- **Feature lane:** F-05 (#81) is a separate feature PR. A catalog batch never
  touches feature paths. Log billed tokens by class at each checkpoint.
- **`curated.ts` is COORDINATOR-ONLY.** Never edit `tools/`. If the no-drift test
  needs an effect override, stop and hand the exact key + official wording to the
  coordinator; the coordinator makes the shared-file edit.
- **Baseline:** take the before screenshots from your own clean detached worktree
  `/Users/ashel/Documents/Programming/pedalvision-t8-baseline-dunlop` at
  `origin/main` (`b4a70ba`), never from a dirty feature checkout or a shared dir.
- **Checkpoint-first (mandatory):** checkpoint item 1 **immediately after setup**,
  then inline after every item. An `exit 75` / `per-item limit exceeded` checkpoint
  result is **advisory** (30-min limit) — keep going; do not stop and do not
  `catalog:resume` for it.
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
  `p5-03-pedals-dunlop-1-evidence` and embed the evidence-branch raw URLs in the PR,
  or `catalog:guard-batch-pr` fails.
- **Image hierarchy:** official brand/press/support → authorized retailer → recorded
  community/aggregator → recorded planner last-resort → generated flat art only if
  none exists/passes. The owner's explicit list overrides the agent. Planner is a
  counted source gap. Boards are out of scope.
- **Bounded discovery (T-4b):** registry-first; ≤2 search-engine pages + **≤20
  source-page fetches per batch** (≤3/item); deterministic curl+regex, never dump
  HTML into context; log queries/candidates/accept-reject/zero-yield. Marketplace
  pixels are `kind: "retailer"` + `license-pending` + counted gaps, self-hosted,
  product page + resolved URL recorded, never hotlinked.
- **One dual-tone contact sheet** (diagonal white/dark or checkerboard) for the
  halo/fringe gate; one sheet per 10–30 cells; max **2 vision passes** total; run the
  visual review as ONE `catalog-image-reviewer` call (dual-tone sheet +
  connector-strip crop + up to ~10 3× crops for analyzer-flagged cells). No
  design-reviewer, no per-item vision.
- **Planner-share guard:** target ≤30%; if >50% after one documented discovery round,
  ship with the share + a waiver line for the owner (owner decides at merge).
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or jagged
  edge. `--matte none` for an already-clean transparent PNG; never re-key a
  transparent source. Treadle wah photos often leave a shadow — re-source or
  process it out; never ship a shadow.
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
- **Before/after screenshots (desktop + mobile)** are mandatory: same
  viewport/theme/state on `main` and on this branch, both embedded inline in the PR.
  This is a new-brand batch (no prior UI row for these items), so show the closest
  baseline (the picker/canvas before these items existed) and say why.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light code
  review (data-only may skip; a `curated.ts` change needs one); 4 h active hard stop
  (240 min → stop and report, no partial PR). The wave soft is 1.6M / hard 2.4M.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch dunlop/dunlop-1 --origin <PR-preview-origin>
  --out work/catalog/dunlop-1-demo.txt`; verify board/item/cable counts on the
  **PR preview** (never production).
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Steps

1. Restate the exact 26-item scope.
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
9. Finish the batch (`pnpm catalog:finish --batch dunlop/dunlop-1`), then open
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
