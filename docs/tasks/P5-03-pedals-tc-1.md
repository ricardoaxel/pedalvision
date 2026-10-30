# P5-03: TC Electronic — pedals batch 1 (cleanup)

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** in review — PR #77 · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-2` coordinator created this worktree and wrote the 17
> existing-item raw scaffolds (Choka already has a merged raw record). The
> `catalog:wave` wrapper starts `tc-electronic/tc-1` (total 26) at launch.
> **Never run `catalog:start`/`catalog:resume`.** Checkpoint inline after every
> item and finish with `pnpm catalog:finish --batch tc-electronic/tc-1`.

## Goal

Deliver TC Electronic's first catalog batch: re-host and fully document the
**18 existing seed items** (13 hotlinked + 4 mock + 1 official/static) plus
**8 new Tier A items**, then open exactly one PR. This is the brand's cleanup
batch — after it, no TC item may ship a hotlinked/mock/placeholder asset.

## Scope (exact 26; verify counts from the regenerated ledger)

### Existing 18 — re-host + document (17 raw scaffolds already written)

| # | id | Name | Current | Current asset |
|---|---|---|---|---|
| 1 | `tc-electronic-2290-p-dynamic-digital-delay` | 2290 P Dynamic Digital Delay | hotlinked | https://cdn-media.empowertribe.com/107b2da708d14304a35dfe02361e8dc3/Image_TE_0709-AJO_2290-P-DYNAMIC-DIGITAL-DELAY_Mailchimp_2023-10-20_Rev.0.png |
| 2 | `tc-electronic-3rd-dimension-chorus` | 3rd Dimension Chorus | hotlinked | https://cdn-media.empowertribe.com/2b92db787a0a4ccc81317060876e3622/Image_TE_0709-AHN_3RD-DIMENSION-CHORUS_Left_XL.png |
| 3 | `tc-electronic-afterglow-chorus` | Afterglow Chorus | hotlinked | https://cdn-media.empowertribe.com/b77c59931cff470c9bac4cfd11732047/Image_TE_0709-AFD_AFTERGLOW-CHORUS_Left_XL.png |
| 4 | `tc-electronic-alter-ego-v2-vintage-echo` | Alter Ego v2 Vintage Echo | mock | mock art |
| 5 | `tc-electronic-alter-ego-x4-vintage-echo` | Alter Ego x4 Vintage Echo | mock | mock art |
| 6 | `tc-electronic-ampworx-550` | Ampworx 550 | hotlinked | https://cdn-media.empowertribe.com/53481ac78b9b4dd9ba5455449121a80b/Image_TE_0709-AJX_V550-PREAMP_Left_XL.png |
| 7 | `tc-electronic-ampworx-combo-deluxe-65` | Ampworx Combo Deluxe 65' | hotlinked | https://cdn-media.empowertribe.com/930cad4f3eda4d67a69894c125b98c44/Image_TE_0709-AJQ_COMBO-DELUXE-65-PREAMP_Catalog_B.png |
| 8 | `tc-electronic-ampworx-dc30` | Ampworx DC30 | hotlinked | https://cdn-media.empowertribe.com/605cb69ebae6447894f633b54c9796b7/Image_TE_0709-AJR_DC30-PREAMP_Catalog_B.png |
| 9 | `tc-electronic-ampworx-dual-wreck` | Ampworx Dual Wreck | hotlinked | https://cdn-media.empowertribe.com/e6103ee8e62548ec8420f3a73d3236d6/Image_TE_0709-AJS_DUAL-WRECK-PREAMP_Catalog_B.png |
| 10 | `tc-electronic-ampworx-jims-45` | Ampworx Jims 45 | hotlinked | https://cdn-media.empowertribe.com/7fb3bdfd0af542e1ba80baa36f012e4f/Image_TE_0709-AJM_JIMS-45-PREAMP_Left_XL.png |
| 11 | `tc-electronic-ampworx-jims-800` | Ampworx Jims 800 | hotlinked | https://cdn-media.empowertribe.com/b71b271dc6b4472fb069cae0777c7c0c/Image_TE_0709-AJV_JIMS-800-PREAMP_Left_XL.png |
| 12 | `tc-electronic-arena-reverb` | Arena Reverb | mock | mock art |
| 13 | `tc-electronic-blood-moon-phaser` | Blood Moon Phaser | hotlinked | https://cdn-media.empowertribe.com/33ff48a85ebf4aa5b7e1c19572ea2c8f/Image_TE_0709-AFE_BLOOD-MOON-PHASER_Left_XL.png |
| 14 | `tc-electronic-bodyrez-acoustic-pickup-enhancer` | BodyRez Acoustic Pickup Enhancer | hotlinked | https://cdn-media.empowertribe.com/7fed2fbde7e8427681e564c49b7c618e/Image_TE_0709-AHB_BODYREZ-ACOUSTIC-PICKUP-ENHANCER_Left_XL.png |
| 15 | `tc-electronic-bonafide-buffer` | Bonafide Buffer | hotlinked | https://cdn-media.empowertribe.com/6bf34328b06747de8e10277649dbc5ca/Image_TE_0709-AHC_BONAFIDE-BUFFER_Catalog%20B.png |
| 16 | `tc-electronic-brainwaves-pitch-shifter` | Brainwaves Pitch Shifter | hotlinked | https://cdn-media.empowertribe.com/9cb5114af4cf4089a3b7db746d30877a/Image_TE_0709-AIR_BRAINWAVES-PITCH-SHIFTER_Left_XL.png |
| 17 | `tc-electronic-bucket-brigade-analog-delay` | Bucket Brigade Analog Delay | mock | mock art |
| 18 | `tc-electronic-choka-tremolo` | Choka Tremolo | official/static | merged raw record + hosted AVIF (verify, no change needed unless a better source is found) |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify
every dimension against the official TC Electronic spec page/manual** (unit or
receiver, never an accessory), verify the effect tags, and add power + all
connectors. Choka is already merged; only confirm it stays correct.

### New 8 (net-new)

Alphabetical Tier A order after the existing items (inventory order). Substitute
only with a recorded reason if an item is not a standalone catalog unit or has no
verifiable source; do not invent facts.

| # | id | Name |
|---|---|---|
| 19 | `tc-electronic-cinders-overdrive` | Cinders Overdrive |
| 20 | `tc-electronic-corona-chorus` | Corona Chorus |
| 21 | `tc-electronic-corona-chorus-plus-trichorus-toneprint` | Corona Chorus+ Trichorus & Toneprint |
| 22 | `tc-electronic-corona-mini-chorus` | Corona Mini Chorus |
| 23 | `tc-electronic-crescendo-auto-swell` | Crescendo Auto Swell |
| 24 | `tc-electronic-dark-matter-distortion` | Dark Matter Distortion |
| 25 | `tc-electronic-ditto-2-looper` | Ditto 2 Looper |
| 26 | `tc-electronic-ditto-jam-x2-looper` | Ditto Jam X2 Looper |

Do not force 26: if a new item has no verifiable official source, record the gap,
keep it out of the shipped scope, state it in the PR, and do not invent facts.
The 18 existing items are mandatory.

## Expected CI

Each batch branches from `main` (**423 pedals / 15 boards**, ledger 438). This
branch adds **8 net-new** → expected `catalog:ci` **431 pedals / 15 boards**.
State the actual number in the PR. Final after all T-5 merges: **446 / 15**.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance (verify against the official page/manual) |
|---|---|
| 2290 P Dynamic Digital Delay | Desktop/rack-style delay; verify `deviceType`/`formFactor`, 18 V? and desktop footprint |
| AmpWorx 550 / Combo Deluxe 65 / DC30 / Dual Wreck / Jims 45 / Jims 800 | Preamp/amp-in-a-box; verify `deviceType` (`preamp`/`amp`), form factor, power |
| Brainwaves Pitch Shifter | Verify form factor + power |
| BodyRez, Bonafide | Acoustic enhancer / buffer; verify `effectTypes` |
| Alter Ego v2 / x4 | Delay; x4 is a larger desktop unit — verify footprint/power |
| Ditto 2 / Ditto Jam X2 | Looper; verify footswitch count, I/O, power |
| Corona family / Cinders / Crescendo / Dark Matter | Standard stompbox; verify dimensions/power/jacks |

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
- **Existing-item rule:** the 17 raw scaffolds are `legacy`/`pending-replacement`
  and Choka is already official. For each, replace the asset with a self-hosted
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
  `pnpm catalog:demo-link --batch tc-electronic/tc-1 --origin <PR-preview-origin>
  --out work/catalog/tc-1-demo.txt`; verify board/item/cable counts.
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Steps

1. Restate the exact 26-item scope; confirm the 17 raw scaffolds.
2. Verify dimensions/effect tags/power/connectors per item; capture all connectors.
3. Run the deterministic image scripts per item (process → analyze → psnr →
   dual-tone contact sheet); record provenance + source dimensions/upscale.
4. Connector-face check for jack edges (`catalog:check-jacks`); omit unknown edges.
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci`, and the Playwright
   picker/render check.
6. Run `pnpm catalog:guard-batch-pr`; PR = raw records + assets + task file only.
7. Produce the contact sheet + coverage/planner-share report.
8. Build the demo share link (above) and verify counts.
9. Finish the batch (`pnpm catalog:finish --batch tc-electronic/tc-1`), then open
   exactly one PR with the required sections (summary, changes, testing steps,
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

## Session result (2026-10-28)

**Shipped scope: 23 records** in this batch = **17 existing seeds re-hosted + 6 new**.
Choka is verified unchanged in `choka-1.json` (official/static, already merged).
Two of the 8 planned new items are recorded gaps (not invented, not forced):

- `tc-electronic-corona-chorus-plus-trichorus` — **not shipped: no verifiable standalone
  unit.** The official TC product index/sitemap, PedalBro and All The Pedals have no
  separate "Corona Chorus+" entry (the Corona Chorus entry already lists SCF/Tri-Chorus
  modes). Substituting a duplicate would invent a product.
- `tc-electronic-crescendo-auto-swell` — **not shipped in this batch: taxonomy/tooling
  gap.** The image and facts are complete (official page + Top render accepted), but the
  deterministic classifier derives no effect type for the creative name ("auto-swell"
  has no taxonomy keyword) and a `curated.ts` override is coordinator-only, so the
  no-drift test would fail. Follow-up: coordinator adds
  `"tc-electronic-crescendo-auto-swell": ["utility"]` to `tools/catalog-transform/curated.ts`,
  then a tiny follow-up task ships the record + the two AVIFs (kept staged in `work/`).

### Counts

- `catalog:ci` → **429 pedals / 15 boards** (423 + 6), jack + image provenance verified.
- Images: **23 × 800/350 AVIF** (46 files) = **18 official** + **5 community** +
  **0 planner** + **0 generated**. Planner share **0 %**; aggregator share **21.7 %**
  (target ≤30 %). No hotlinked/mock/legacy asset remains in the TC slice.
- PSNR 40.93–47.23 dB on all 23 renditions; analyzer accept on 22, one documented flag
  (`alter-ego-x4`, perspective 16 % from the analyzer's trapezoid metric; aspect 0.3 %
  and the vision pass confirm flat).
- Jacks: **14** records with a verified connector face (official rear-panel image);
  **9** records omit edges (`jackLayout.confidence: "unknown"`) because no source shows
  the connector face (no rear render for those models) — the app uses assumed anchors.

### Source-discovery log (T-4b, bounded)

- Registry first (TC/e mpower tribe `_Top_XL` official pattern already known).
- Official: product pages for the 17 live models + 4 sitemap-only models; Top/Rear XL
  renders and QSG PDFs fetched from `cdn-media.empowertribe.com`.
- One search-engine attempt: a text search located the official QSG specs and the
  PedalBro/MusicStore cross-check; no Google/Bing Images pass was needed (official
  tops found for 18 of 23). No captcha/429.
- Discontinued models with retired official pages: Wayback CDX for the CDN produced
  `0709-AFR` (Corona Chorus, only a 318 px `Catalog_B` render — below the 2× upscale
  ceiling). Aggregator pass: **PedalBro** product pages + 1200 px CDN images for
  Alter Ego v2/x4, Arena Reverb, Corona Chorus and Ditto Jam X2 (all
  `kind: "community"`, license-pending, counted source gaps). All The Pedals images
  returned 404 on this network.
- Zero-yield logged once: `corona-chorus-plus-trichorus` (official index, PedalBro,
  All The Pedals sitemap — no standalone unit).

### QA

- One dual-tone (light/dark) contact-sheet vision pass: **23/23 accept, 0 flag, 0 reject**
  (plus the connector strips: all 16 shown connector panels are the top/rear face,
  confirming the recorded edge). Choka included in the sheet for continuity.
- `catalog:check-jacks` green (16 raw files); `catalog:guard-batch-pr` clean.
- `lint`, `typecheck`, `test` (872), `build` green; targeted Playwright
  `picker` + `picker-choka` desktop + mobile green (32 passed, 5 skipped).
- Demo link: 23 items / 22 illustrative cables / 0 unconnected.

## Owner correction — 2026-10-28 (deskew)

The owner reported that **BodyRez**, **Corona Mini** and **Bonafide Buffer** looked
slightly rotated clockwise. The official top renders are mildly **sheared** (the
sides lean while the top edge stays level), and the earlier batch rendering had
rotated them to force the analyzer's side-slope metric, which tilted the top edge.
They were re-rendered from the same official TC `Top_XL` source with a
**horizontal shear** (not a rotation): alpha threshold to remove the drop shadow,
shear by the measured source slope, trim, 800/350 AVIF q90. Result: analyzer
rotation **0.02–0.18°**, aspect **0.4–1.1 %**, PSNR **41.75–47.09 dB**; the
`catalog-image-reviewer` deskew pass confirmed all three straight, clean-alpha and
shippable. Only these three `imageProvenance` notes and their AVIFs changed.
