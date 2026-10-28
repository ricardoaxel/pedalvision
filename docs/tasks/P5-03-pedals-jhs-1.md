# P5-03: JHS — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #75 · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-2` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds (`jhs-3-series-screamer` already has a merged raw
> record). The `catalog:wave` wrapper starts `jhs/jhs-1` (total 26) at launch.
> **Never run `catalog:start`/`catalog:resume`.** Checkpoint inline after every
> item and finish with `pnpm catalog:finish --batch jhs/jhs-1`.

## Goal

Deliver JHS's first catalog batch: re-host and fully document the **19 existing
seed items** (12 hotlinked + 6 mock + 1 official/static) plus **7 new Tier A
items**, then open exactly one PR. This is the brand's cleanup batch — after it,
no JHS item may ship a hotlinked/mock/placeholder asset.

## Scope (exact 26; verify counts from the regenerated ledger)

### Existing 19 — re-host + document (18 raw scaffolds already written)

| # | id | Name | Current | Current asset |
|---|---|---|---|---|
| 1 | `jhs-1966-series-bender` | 1966 Series Bender | mock | mock art |
| 2 | `jhs-1966-series-boost` | 1966 Series Boost | mock | mock art |
| 3 | `jhs-1966-series-fuzz` | 1966 Series Fuzz | mock | mock art |
| 4 | `jhs-1966-series-italy` | 1966 Series Italy | mock | mock art |
| 5 | `jhs-3-series-bit-crusher` | 3 Series Bit Crusher | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-BitCrusher-Front.png?v=1779893287 |
| 6 | `jhs-3-series-chorus` | 3 Series Chorus | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-Chorus-front.png?v=1698427083 |
| 7 | `jhs-3-series-compressor` | 3 Series Compressor | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-Compressor-front.png?v=1698427156 |
| 8 | `jhs-3-series-delay` | 3 Series Delay | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-Delay-front.png?v=1698427313 |
| 9 | `jhs-3-series-distortion` | 3 Series Distortion | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-Distortion-front.png?v=1698427388 |
| 10 | `jhs-3-series-flanger` | 3 Series Flanger | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Serires-Flanger-Front.png?v=1698426709 |
| 11 | `jhs-3-series-fuzz` | 3 Series Fuzz | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-Fuzz-front.png?v=1698427447 |
| 12 | `jhs-3-series-glitch-delay` | 3 Series Glitch Delay | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Series-GlitchDelay-Front.png?v=1779893315 |
| 13 | `jhs-3-series-hall-reverb` | 3 Series Hall Reverb | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3-Serires-HallReverb-Front.png?v=1698426814 |
| 14 | `jhs-3-series-harmonic-trem` | 3 Series Harmonic Trem | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3Series-Harmonic-Trem-Front.png?v=1698426927 |
| 15 | `jhs-3-series-octave-reverb` | 3 Series Octave Reverb | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3Series-Octave-Reverb-Front.png?v=1698427649 |
| 16 | `jhs-3-series-oil-can-delay` | 3 Series Oil Can Delay | hotlinked | https://jhspedals.info/cdn/shop/files/JHS-Pedals-3Series-Oil-Can-Delay.png?v=1739461127 |
| 17 | `jhs-3-series-oil-can-delay-black` | 3 Series Oil Can Delay (Black) | mock | mock art |
| 18 | `jhs-3-series-overdrive` | 3 Series Overdrive | mock | mock art |
| 19 | `jhs-3-series-screamer` | 3 Series Screamer | official/static | merged raw record + hosted AVIF (verify, no change needed unless a better source is found) |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify
every dimension against the official JHS spec page/manual** (unit or receiver,
never an accessory), verify the effect tags, and add power + all connectors.
Screamer is already merged; only confirm it stays correct.

### New 7 (net-new)

Alphabetical Tier A order after the existing items (inventory order). Substitute
only with a recorded reason if an item has no verifiable source; do not invent
facts.

| # | id | Name |
|---|---|---|
| 20 | `jhs-3-series-phaser` | 3 Series Phaser |
| 21 | `jhs-3-series-reverb` | 3 Series Reverb |
| 22 | `jhs-3-series-ring-modulator` | 3 Series Ring Modulator |
| 23 | `jhs-3-series-rotary-chorus` | 3 Series Rotary Chorus |
| 24 | `jhs-3-series-tape-delay` | 3 Series Tape Delay |
| 25 | `jhs-424-gain-stage` | 424 Gain Stage |
| 26 | `jhs-808` | 808 |

Do not force 26: if a new item has no verifiable official source, record the gap,
keep it out of the shipped scope, state it in the PR, and do not invent facts.
The 19 existing items are mandatory.

## Expected CI

Each batch branches from `main` (**423 pedals / 15 boards**, ledger 438). This
branch adds **7 net-new** → expected `catalog:ci` **430 pedals / 15 boards**.
State the actual number in the PR. Final after all T-5 merges: **446 / 15**.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance (verify against the official page/manual) |
|---|---|
| 1966 Series (Bender/Boost/Fuzz/Italy) | Standard compact pedals; verify dimensions/power/jacks and the correct Series naming |
| All 3 Series (existing + new) | Same compact enclosure; verify each control set/effect tags; the oil-can variants differ only in finish |
| 424 Gain Stage | Desktop/utility preamp; verify `deviceType`/form factor/power |
| 808 | Overdrive; verify whether it is a current/reissued unit and its exact dimensions |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/tasks/T-4b-source-discovery.md` (bounded discovery + planner-share guard)

Read only the sections the task file points to; do not read whole docs.

## Coordinator / routing (folded from the token review, 2026-10-28)

- **Model routing:** use only `opencode-go/deepseek-v4.1-flash` for reasoning and
  the single vision pass. If the session is on another model, or the model
  returns 429/401/quota/timeout/empty, STOP and report the model + operation +
  exact error; never substitute.
- **Combined window:** F-04 is paused dirty WIP (0 billed catalog spillover). Log
  feature spend at each checkpoint and start no new wave if feature + wave billed
  reaches 3.4M; the wave hard cap stays 2.4M.
- **`curated.ts`:** batches never edit `tools/`. If the no-drift test needs a
  verified override, stop and hand it to the coordinator serially.
- **Baseline:** take the before screenshots and verify the post-merge build from
  the clean detached worktree `/Users/ashel/Documents/Programming/pedalvision-t5-baseline`
  at `origin/main` (`41f21d0`), never from the dirty feature checkout.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and
  an uncommitted app-workspace runtime** for Playwright; the post-merge build
  commits mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art
  specs under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Existing-item rule:** the 18 raw scaffolds are `legacy`/`pending-replacement`
  and Screamer is already official. For each, replace the asset with a self-hosted
  800/350 AVIF and update `imageProvenance` to the real final source
  (official/retailer/community/planner last-resort/generated) including source
  dimensions + upscale factor. Never keep the hotlinked URL as the shipped image.
- **Bounded discovery (T-4b):** official first; then at most **one** Google/Bing
  Images attempt per batch and ≤20 source-page fetches (≤3/item), only for items
  whose official candidate failed. Record the source-discovery log (queries,
  candidate URLs, accept/reject, zero-yield). Marketplace images are locators
  first; ship them only when no official asset exists, as `kind: "retailer"` +
  `license-pending`, with the product-page URL and resolved CDN URL. Never
  hotlink.
- **One dual-tone contact sheet** (diagonal white/dark or checkerboard) so a
  white **or** black halo is visible. One sheet per 10–30 cells, max 2 vision
  passes. Reject angled/high-res-but-not-flat images.
- **Planner-share guard:** target ≤30% of new/replaced items; if >50%, run one
  documented discovery round; if still >50%, ship with the share + a waiver line
  for the owner. Never a silent majority-planner batch.
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or
  jagged edge. Use `--matte none` for an already-clean transparent PNG; never
  re-key a transparent source.
- **Resolution is not a rejection reason:** upscale soft ceiling ≤2× (above that
  use generated art unless the single reviewer pass accepts it, recorded). Gate
  the **final 800 rendition**; record source URL, dimensions and upscale factor.
- **Jack edges require a verified source** (official rear/top photo, support page
  or manual diagram — including image-only/scanned PDFs). Text-layer first; if no
  official source shows the face, omit the edge with `confidence: "unknown"` and
  record why. Never infer from a sibling model or form factor.
- **Footprint dimensions come from the official unit/receiver spec, never an
  accessory;** record the dimension source before the aspect gate.
- **Analyzer:** process to the 800/350 master first, then `pnpm asset:analyze`
  with `--source photo|planner|generated`; `asset:psnr` ≥40 dB.
- **Before/after screenshots (desktop + mobile)** are mandatory for the seeded
  image replacements: capture the same viewport/theme/state on `main` and on this
  branch, embed both inline in the PR, and add a before/after contact-sheet crop
  for the image replacements.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light
  code review (data-only may skip); 4 h active; 12 min/item. Checkpoint after
  every item.
- Status every 15 min; per-item 12 min initial. Stop on any provider failure
  (429/401/quota/timeout/empty) and report model + operation + exact error —
  never substitute.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch jhs/jhs-1 --origin <PR-preview-origin>
  --out work/catalog/jhs-1-demo.txt`; verify board/item/cable counts.
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Batch outcome (2026-10-28)

- **26/26 items** shipped: 19 existing JHS seeds + 7 net-new. `catalog:ci` validated **430 pedals / 15 boards** (expected 430/15).
- **Images:** 21 official JHS (19 3 Series incl. the merged Screamer + 424 + 808), 4 PedalFilter community cutouts (1966 Series, license-pending), 1 generated Catalog Specimen (3 Series Oil Can Delay Black). **Planner share 0% (0/26)**; community 15.4%; generated 3.8%.
- **Upscales:** 1966 Bender/Boost/Italy 2.04x and 808 2.25x (above the 2x soft ceiling) were explicitly accepted in the single contact-sheet vision pass and are recorded as counted source gaps. 1966 Fuzz 1.39x.
- **Jack edges:** 14 3 Series models verified from their official JHS manuals (INPUT right, OUTPUT left, POWER top); 424 verified from the official product page (INPUT top-right, OUTPUT top-left, XLR left). Edges omitted (`confidence: unknown`) where no official connector-face source exists: 5 3 Series models, the 4 1966 Series, the Black variant and 808.
- **Effect tags:** `jhs-424-gain-stage` and `jhs-808` needed verified `curated.ts` overrides (official page wording) because the name classifier cannot derive them; `jhs-3-series-rotary-chorus` is tagged `chorus` to avoid a second override. No other shared code touched.
- **Checks:** `catalog:check-jacks`, `catalog:check-images`, `catalog:validate`, `catalog:ci`, `catalog:guard-batch-pr`, `lint`, `typecheck`, `test` (96 files/872 tests), `build` all green. `test` must run with `env -u CATALOG_WORK_DIR -u CATALOG_BATCH_ID` when executed inside a live `catalog:wave` (the wrapper exports the shared control-plane dir and the runner tests legitimately collide with the 3 active batches).
- **Vision:** one `catalog-image-reviewer` pass (26 cells + a 1:1 upscale-crop sheet) — 25 accept, 1 flag (424 "white card" is printed artwork on the official top-down; analyzer `backgroundCard.suspected: false`, accepted).

## Source-discovery log (T-4b)

- **Registry first:** JHS Shopify CDN row reused (official transparent Front renders, 2500x2500). `products.json` pages 1–2 enumerated the 3 Series/424/808 official images.
- **One search-engine attempt (Bing Images, query "JHS 1966 Series Bender pedal"):** yielded PedalFilter, Reverb, Sweetwater, Audiofanzine and press candidates. No official 1966 page exists (retired; Wayback offline).
- **Source-page fetches (content):** JHS products.json x3, Bing x1, PedalFilter x4 (1966 models), Sweetwater x2 (403 captcha), Guitar World x1, Gearnews x1, RockBoard PedalPedia x2, Wayback CDX x1 (offline 503), JHS sitemaps/search x4, JHS Japan products x1 = 18 content fetches. Additional aggregator slug probes were deterministic HEAD/404 checks (no HTML read).
- **Accepted:** PedalFilter 1966 cutouts (recorded `kind: community`, license-pending, counted source gap) and the official 3 Series/424/808 renders.
- **Rejected:** Sweetwater Italy (opaque, angled/side walls), the 1966 group press shots (~190 px per pedal), Audiofanzine/Zikinf (tiny or angled), Reverb/community seller photos (angled), planner (not needed), generated art (only the Black finish variant, no official black photo).
- **Manual PDFs (spec research, not image discovery):** 14 English 3 Series manuals + 3 newer EN/DE/FR manuals, text-layer jack verification.

## Steps

1. Restate the exact 26-item scope; confirm the 18 raw scaffolds.
2. Verify dimensions/effect tags/power/connectors per item; capture all connectors.
3. Run the deterministic image scripts per item (process → analyze → psnr →
   dual-tone contact sheet); record provenance + source dimensions/upscale.
4. Connector-face check for jack edges (`catalog:check-jacks`); omit unknown edges.
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci`, and the Playwright
   picker/render check.
6. Run `pnpm catalog:guard-batch-pr`; PR = raw records + assets + task file only.
7. Produce the contact sheet + coverage/planner-share report.
8. Build the demo share link (above) and verify counts.
9. Finish the batch (`pnpm catalog:finish --batch jhs/jhs-1`), then open exactly
   one PR with the required sections (summary, changes, testing steps,
   before/after screenshots, owner review hints, review digest, demo link,
   billed tokens/minutes). Do not merge.

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

## Owner correction — 2026-10-28 (planner images)

The owner reviewed the batch and reported the 1966 Series image was the wrong pedal.
`jhs-1966-series-fuzz` was showing a 3 Series Fuzz; it now uses the Pedalplayground
cutout (`https://pedalplayground.com/app/images/pedals/jhs-1966-fuzz.png`, 235×392,
body-cropped, 2.04× upscale, planner last-resort). The black Oil Can Delay
(`jhs-3-series-oil-can-delay-black`) now uses the planner cutout
(`https://pedalplayground.com/app/images/pedals/jhs-3-series-oil.png`, 460×758,
1.06×) instead of generated art, and its generated spec is removed. Bender/Boost/
Italy keep their PedalFilter community art (the planner art is identical; community
is higher in the hierarchy). Planner share **2/26 = 7.7 %**. `catalog:ci` **430/15**;
guard clean; tests **872**.
