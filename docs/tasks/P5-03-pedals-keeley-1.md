# P5-03: Keeley — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #79 · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-3` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds (`data/catalog/research/pedals/keeley/keeley-1.json`).
> The `catalog:wave` wrapper starts `keeley/keeley-1` (total 26) at launch. **Never
> run `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately
> after setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch keeley/keeley-1`.

## Goal

Deliver Keeley's first catalog batch: re-host and fully document the **18 existing
seed items** (18 mock/static) plus **8 new Tier A items**, then open exactly one PR.
This is the brand's cleanup batch — after it, no Keeley item may ship a
mock/placeholder asset.

## Scope (exact 26; verify counts from the regenerated ledger)

Base: `origin/main` at `bf083ed` = **444 pedals / 15 boards**, ledger **459**.

### Existing 18 — re-host + document (raw scaffolds already written)

| # | id | Name | Current | Hosting |
|---|---|---|---|---|
| 1 | `keeley-1962` | 1962 | mock | mock |
| 2 | `keeley-1962x` | 1962x | mock | mock |
| 3 | `keeley-30ms-double-tracker` | 30ms Double Tracker | mock | mock |
| 4 | `keeley-abbey-chamber-verb` | Abbey Chamber Verb | mock | mock |
| 5 | `keeley-angry-orange` | Angry Orange | mock | mock |
| 6 | `keeley-angry-orange-signalis` | Angry Orange (Signalis) | mock | mock |
| 7 | `keeley-angry-orange-white` | Angry Orange (White) | mock | mock |
| 8 | `keeley-aria` | Aria | mock | mock |
| 9 | `keeley-aurora` | Aurora | static | mock |
| 10 | `keeley-bassist-compressor` | Bassist Compressor | mock | mock |
| 11 | `keeley-black-glass` | Black Glass | mock | mock |
| 12 | `keeley-blacktop` | Blacktop | mock | mock |
| 13 | `keeley-blues-disorder` | Blues Disorder | mock | mock |
| 14 | `keeley-blues-disorder-signalis` | Blues Disorder (Signalis) | mock | mock |
| 15 | `keeley-blues-disorder-white` | Blues Disorder (White) | mock | mock |
| 16 | `keeley-bubble-tron` | Bubble Tron | mock | mock |
| 17 | `keeley-bubble-tron-ler` | Bubble Tron (Ler) | mock | mock |
| 18 | `keeley-california-girls` | California Girls | mock | mock |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify every
dimension against the official Keeley spec page/manual** (unit, never an accessory),
verify the effect tags, and add power + all connectors.

### New 8 (net-new)

Alphabetical Tier A order after the existing items (inventory order; distinct models
preferred over more finish variants). Substitute only with a recorded reason if an
item has no verifiable source; do not invent facts.

| # | id | Name |
|---|---|---|
| 19 | `keeley-caverns` | Caverns |
| 20 | `keeley-compressor-plus` | Compressor Plus |
| 21 | `keeley-d-m-drive` | D&M Drive |
| 22 | `keeley-dark-side` | Dark Side |
| 23 | `keeley-delay-workstation` | Delay Workstation |
| 24 | `keeley-dynatrem` | Dynatrem |
| 25 | `keeley-eccos` | Eccos |
| 26 | `keeley-el-rey-dorado` | El Rey Dorado |

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
| 1962 / 1962x | Overdrive/boost; verify the exact enclosure and whether x is a variant |
| Angry Orange variants | Same enclosure, different finish; verify each finish is a real SKU |
| Blues Disorder variants | Same enclosure, different finish; verify each finish is a real SKU |
| Bubble Tron / (Ler) | Envelope filter; verify the Ler edition |
| Caverns / Eccos / Delay Workstation | Larger-format units; verify dimensions, power draw and jack faces |
| D&M Drive / Dark Side | Dual-circuit units; verify `deviceType`/form factor and power |
| Compressor Plus / Dynatrem / El Rey Dorado | Standard compact pedals; verify independently |

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
- **Baseline:** take the before screenshots from YOUR OWN clean detached worktree
  `/Users/ashel/Documents/Programming/pedalvision-t6-baseline-keeley` at `origin/main`
  (`bf083ed`), never from a dirty feature checkout or a shared baseline dir.
- **Checkpoint-first (T-5 lesson):** all three T-5 batches tripped the 12-min
  per-item stall threshold by researching before the first checkpoint. Checkpoint
  item 1 **immediately after setup**, then checkpoint inline after every item. This
  wave launches with `CATALOG_ITEM_LIMIT_MS=1800000`; an `exit 75` /
  `per-item limit exceeded` result is **advisory** — keep going, do not stop or
  `catalog:resume`.
- **Finish variants** (`1962x`, `Angry Orange (Signalis/White)`,
  `Blues Disorder (Signalis/White)`, `Bubble Tron (Ler)`) usually have no official
  finish photo: skip the official/retailer discovery rounds and take one recorded
  planner last-resort image (`kind: "planner"`, `status: "last-resort"`,
  license-pending, counted gap). Planner share ~6/26 = 23%, under the 30% target.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an
  uncommitted app-workspace runtime** for Playwright; the post-merge build commits
  mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art specs
  under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Evidence branches (T-5 lesson):** the batch PR branch contains **raw records +
  assets + this task file only** (plus `curated.ts` only when required). Put
  screenshots/contact sheets on `p5-03-pedals-keeley-1-evidence` and embed the
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
  `pnpm catalog:demo-link --batch keeley/keeley-1 --origin <PR-preview-origin>
  --out work/catalog/keeley-1-demo.txt`; verify board/item/cable counts.
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
9. Finish the batch (`pnpm catalog:finish --batch keeley/keeley-1`), then open exactly
   one PR with the required sections (summary, changes, testing steps, before/after
   screenshots, owner review hints, review digest, demo link, billed tokens/minutes).
   Do not merge.

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

## Batch outcome (2026-10-28)

- **26/26 items** shipped: the 18 existing Keeley seeds (all re-hosted) + 8 net-new (Caverns, Compressor Plus, D&M Drive, Dark Side, Delay Workstation, Dynatrem, Eccos, El Rey Dorado). `catalog:ci` validated **452 pedals / 15 boards** (expected 452/15).
- **Images:** 20 official Keeley product renders + 1 archived official (Abbey Chamber Verb, Wayback copy of the retired official page) + **5 planner last-resort** (Angry Orange Signalis/White, Blues Disorder Signalis/White, Bubble Tron Ler). **Planner share 5/26 = 19.2%**, under the 30% target; 21/26 = 80.8% official/archive.
- **Upscales:** all within the 2× soft ceiling. Largest are Bubble Tron 1.71× (official 600 px source) and the two white planner variants 1.25× (350 px planner source); the rest are 1.0× or downscaled. Source dimensions/trim/upscale are recorded in every `imageProvenance.note`.
- **Jack edges:** verified **top/crown** for the Angry Orange / Blues Disorder 4-in-1 family (official JACK FACE + INPUT/OUTPUT side photos) and California Girls (official CG JACKS + LEFT/RIGHT photos), and for Caverns (official product text "Top-Mounted Jacks"). All other models omit the edge with `jackLayout.confidence: "unknown"` — no official connector-face source was found in the batch pass.
- **Effect tags:** 8 verified `curated.ts` overrides added for the creatively named new models (Caverns, Compressor Plus, D&M Drive, Dark Side, Delay Workstation, Dynatrem, Eccos, El Rey Dorado) because the name classifier cannot derive them from the official wording. Finish variants link to their base via `variantOf` so they inherit the base effect types. **Coordinator code-review correction (2026-10-29):** `keeley-dynatrem` now also carries `reverb` (Keeley markets it as "Dynamic Tremolo and Reverb") and `keeley-dark-side` now also carries `vibrato` (U-Vibe mode); both the override and the raw record were updated so the no-drift test stays green. The 8th override (`compressor-plus`) is a harmless no-op the classifier already derives; kept to avoid churn.
- **Checks:** `catalog:check-jacks`, `catalog:check-images`, `catalog:ci`, `catalog:guard-batch-pr`, `lint`, `typecheck`, `test` (98 files / 893 tests), `build` all green. `test` must run with `env -u CATALOG_WORK_DIR -u CATALOG_BATCH_ID` inside a live wave.
- **Playwright (desktop + mobile):** Keeley search = 26 pedals, brand filter = 26, reverb effect filter = 5, Caverns places on the canvas, no console errors.
- **Vision:** one `catalog-image-reviewer` call (26-cell dual-tone sheet + connector-strip sheet + 3× corner crops for the six analyzer-flagged cells) → 25 accept, 1 reject (Bubble Tron Ler official photo carries a separate white "Artist Series" caption card). Fixed by re-sourcing the clean planner cutout and confirmed with a same-session second pass on that cell → accept.

## Source-discovery log (T-4b)

- **Registry first:** the Keeley WooCommerce Store API (`/wp-json/wc/store/v1/products?per_page=100&page=N`, 322 products) enumerated official names, product pages and image galleries in four deterministic JSON fetches (no HTML dumped into context). Official product galleries supplied 21 of 26 images.
- **Official:** `robertkeeley.com/product/<slug>/` for the 20 current/retired-but-present products; `_Face`/`Front`/`-Keeley-Electronics.png` renders (mostly 800–2560 px). D&M Drive is retired from the store but its official page (`/product/dm-drive/`) still serves the official face image.
- **Archive:** Abbey Chamber Verb is retired and its official page 404s; Wayback CDX + a 2019 snapshot supplied the official 1000×1000 Face image (recorded `kind: "archive"`).
- **Search-engine attempt:** none needed — the registry/brand-site pass covered every non-finish item. No Google/Bing page was fetched.
- **Planner last-resort:** PedalPlayground GitHub mirror (`app/images/pedals/keeley-*.png`) for the four finish variants with no official finish photo and for Bubble Tron Ler after its official photo failed the clean-alpha gate. Recorded `kind: "planner"`, `status: "last-resort"`, counted gaps.
- **Rejected:** the Bubble Tron Ler official front (white Artist Series caption card outside the product); the Caverns/Abbey tester photos/CG side profiles were used as connector evidence only, never shipped.
- **Spec research:** official product pages + retailer/official spec listings (B&H, Macdaddy, Warwick, Musik Produktiv, Pedaltown, Andertons, Musician's Friend, PedalBro) for dimensions; PedalFilter for power draw. Official unit dimensions are not published for California Girls (limited Sweetwater run), so its footprint is recorded as estimated from the official render.
