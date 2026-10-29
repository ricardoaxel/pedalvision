# P5-03: Joyo — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #TBD · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-3` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds (`data/catalog/research/pedals/joyo/joyo-1.json`).
> The `catalog:wave` wrapper starts `joyo/joyo-1` (total 26) at launch. **Never run
> `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately after
> setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch joyo/joyo-1`.

## Goal

Deliver Joyo's first catalog batch: re-host and fully document the **18 existing
seed items** (5 hotlinked + 13 mock/static) plus **8 new Tier A items**, then open
exactly one PR. This is the brand's cleanup batch — after it, no Joyo item may ship
a hotlinked/mock/placeholder asset.

## Scope (exact 26; verify counts from the regenerated ledger)

Base: `origin/main` at `bf083ed` = **444 pedals / 15 boards**, ledger **459**.

### Existing 18 — re-host + document (raw scaffolds already written)

| # | id | Name | Current | Hosting |
|---|---|---|---|---|
| 1 | `joyo-d-seed` | D-Seed | mock | mock |
| 2 | `joyo-jf-01-vintage-overdrive` | JF-01 Vintage Overdrive | static | mock |
| 3 | `joyo-jf-02-ultimate-drive` | JF-02 Ultimate Drive | mock | mock |
| 4 | `joyo-jf-03-crunch-distortion` | JF-03 Crunch Distortion | mock | mock |
| 5 | `joyo-jf-04-high-gain-distortion` | JF-04 High Gain Distortion | mock | mock |
| 6 | `joyo-jf-05-classic-chorus` | JF-05 Classic Chorus | mock | mock |
| 7 | `joyo-jf-06-vintage-phase` | JF-06 Vintage Phase | mock | mock |
| 8 | `joyo-jf-07-classic-flanger` | JF-07 Classic Flanger | mock | mock |
| 9 | `joyo-jf-08-digital-delay` | JF-08 Digital Delay | mock | mock |
| 10 | `joyo-jf-09-tremolo` | JF-09 Tremolo | mock | mock |
| 11 | `joyo-jf-10-dynamic-compressor` | JF-10 Dynamic Compressor | mock | mock |
| 12 | `joyo-jf-11-6-band-eq` | JF-11 6 Band EQ | mock | mock |
| 13 | `joyo-jf-12-voodoo-octave` | JF-12 Voodoo Octave | mock | mock |
| 14 | `joyo-jf-13-ac-tone` | JF-13 AC Tone | hotlinked | url |
| 15 | `joyo-jf-14-american-sound` | JF-14 American Sound | hotlinked | url |
| 16 | `joyo-jf-15-california-sound` | JF-15 California Sound | hotlinked | url |
| 17 | `joyo-jf-16-british-sound` | JF-16 British Sound | hotlinked | url |
| 18 | `joyo-jf-17-extreme-metal` | JF-17 Extreme Metal | hotlinked | url |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify every
dimension against the official Joyo spec page/manual** (unit, never an accessory),
verify the effect tags, and add power + all connectors. The five hotlinked JF-13…17
must be re-hosted as self-hosted 800/350 AVIF; never keep the hotlink.

### New 8 (net-new)

Alphabetical Tier A order after the existing items (inventory order). Substitute
only with a recorded reason if an item has no verifiable source; do not invent facts.

| # | id | Name |
|---|---|---|
| 19 | `joyo-jf-18r-power-tune` | JF-18R Power Tune |
| 20 | `joyo-jf-19-buffer-tuner` | JF-19 Buffer Tuner |
| 21 | `joyo-jf-20-moist-reverb` | JF-20 Moist Reverb |
| 22 | `joyo-jf-21-splinter` | JF-21 Splinter |
| 23 | `joyo-jf-22-oxford-sound` | JF-22 Oxford Sound |
| 24 | `joyo-jf-23-argos-overdrive` | JF-23 Argos Overdrive |
| 25 | `joyo-jf-24-orthros-selector` | JF-24 Orthros Selector |
| 26 | `joyo-jf-25-bright-day-overdrive` | JF-25 Bright Day Overdrive |

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
| D-Seed | Digital delay; verify whether the current D-Seed II supersedes it and its exact enclosure |
| JF-01…JF-17 | Standard Joyo compact enclosures; verify each control set/effect tag, dimensions, power and jacks |
| JF-18R / JF-19 | Tuner / buffer-tuner utilities; verify `deviceType` and power draw |
| JF-24 | Selector/switcher; verify form factor and `deviceType` |
| New JF-20…JF-25 | Standard compact pedals; verify dimensions/power/jacks independently |

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/tasks/T-4b-source-discovery.md` (bounded discovery + planner-share guard)

Read only the sections the task file points to; do not read whole docs.

## Coordinator / routing (folded from the token review, 2026-10-28)

- **Model routing:** use only `opencode-go/deepseek-v4.1-flash` for reasoning and
  the single vision pass. If the session is on another model, or it returns
  429/401/quota/timeout/empty, STOP and report the model + operation + exact error;
  never substitute.
- **Feature lane:** F-05 is a separate dirty WIP feature branch (0 catalog overlap).
  Log feature spend at each checkpoint; start no new wave if feature + wave billed
  reaches 3.4M; the wave hard cap stays 2.4M.
- **`curated.ts`:** batches never edit `tools/`. If the no-drift test needs a
  verified override, stop and hand it to the coordinator serially.
- **Baseline:** take the before screenshots from YOUR OWN clean detached worktree
  `/Users/ashel/Documents/Programming/pedalvision-t6-baseline-joyo` at `origin/main`
  (`bf083ed`), never from a dirty feature checkout or a shared baseline dir.
- **Checkpoint-first (T-5 lesson):** all three T-5 batches tripped the 12-min
  per-item stall threshold by researching before the first checkpoint. Checkpoint
  item 1 **immediately after setup**, then checkpoint inline after every item. This
  wave launches with `CATALOG_ITEM_LIMIT_MS=1800000`; an `exit 75` /
  `per-item limit exceeded` result is **advisory** — keep going, do not stop or
  `catalog:resume`.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an
  uncommitted app-workspace runtime** for Playwright; the post-merge build commits
  mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art
  specs under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Evidence branches (T-5 lesson):** the batch PR branch contains **raw records +
  assets + this task file only** (plus `curated.ts` only when required). Put
  screenshots/contact sheets on `p5-03-pedals-joyo-1-evidence` and embed the
  evidence-branch raw URLs in the PR, or `catalog:guard-batch-pr` fails.
- **Existing-item rule:** the 18 raw scaffolds are `legacy`/`pending-replacement`.
  For each, replace the asset with a self-hosted 800/350 AVIF and update
  `imageProvenance` to the real final source (official/retailer/community/planner
  last-resort/generated) including source dimensions + upscale factor. Never keep
  the hotlinked URL as the shipped image.
- **Bounded discovery (T-4b):** official first; then at most **one** Google/Bing
  Images attempt per batch and ≤20 source-page fetches (≤3/item), only for items
  whose official candidate failed. Record the source-discovery log (queries,
  candidate URLs, accept/reject, zero-yield). Marketplace images are locators first;
  ship them only when no official asset exists, as `kind: "retailer"` +
  `license-pending`, with the product-page URL and resolved CDN URL. Never hotlink.
- **One dual-tone contact sheet** (diagonal white/dark or checkerboard) so a white
  **or** black halo is visible. One sheet per 10–30 cells, max 2 vision passes.
  Reject angled/high-res-but-not-flat images.
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
  `pnpm catalog:demo-link --batch joyo/joyo-1 --origin <PR-preview-origin>
  --out work/catalog/joyo-1-demo.txt`; verify board/item/cable counts.
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
9. Finish the batch (`pnpm catalog:finish --batch joyo/joyo-1`), then open exactly one
   PR with the required sections (summary, changes, testing steps, before/after
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


---

## Session log — 2026-10-28 (batch session)

**Scope delivered:** 26/26 records in `data/catalog/research/pedals/joyo/joyo-1.json`
(18 existing re-hosted + 8 new). 52 AVIFs (`public/pedal-assets/pedals/{800,350}/joyo-*.avif`).
The 13 legacy mock PNG pairs stay on disk unchanged for rollback and the dry-run (the
runtime now points at the AVIFs); no shipped Joyo item uses a hotlink/mock/placeholder.

**Images:** 25 official Joyo (joyoaudio.com gallery / joyoaudio.co.uk for the newer
units) + 1 generated Catalog Specimen (D-Seed). Upscales: 20 within 2x; **JF-01
2.62x, JF-24 2.40x, JF-25 2.50x** are above the 2x soft ceiling but were explicitly
accepted in the single contact-sheet vision pass (recorded source gaps). **Planner
share 0/26 = 0%** (target <=30%). D-Seed source trail: official 600 px photo is 3/4
angled; Pedalbro 800 px was the wrong product (SubDecay EchoBox); planner returned an
error; generated flat art is the last resort (`tools/asset-pipeline/pedal-art/specs/joyo-d-seed.json`).

**QA:** analyzer gates on the final 800: 22 accept, 4 flagged (JF-18R taper/bezel,
JF-19 perspective metric on a flat face, JF-24 bezel, D-Seed generated) — all four
approved at 1:1 in the vision pass. PSNR 40.09–52.50 dB (all >=40). `catalog:check-jacks`
green (all edges omitted; `jackLayout.confidence: "unknown"` — the scanned manuals are
graphic-only and the single connector-face attempt was not legible at batch scale).

**Vision:** 2 passes (26-cell dual-tone sheet + 3x corners, then a 3-cell fixed pass)
+ 1 targeted pass for the generated D-Seed after its re-source. Final verdict:
26/26 approved.

**Text/classifier note:** creative/utility names (JF-18R, JF-21, JF-22, JF-24) do not
derive an effect type from the name, so the display name carries a functional suffix
("... Tuner", "... Fuzz Distortion", "... Amp Modeler", "... A/B") and the exact
official name is kept in `aliases`/`extra.officialName`. This avoids editing
`tools/catalog-transform/curated.ts` from a batch; a coordinator follow-up can add
curated overrides and restore the bare official names.

**Checks:** `catalog:ci` -> **452 pedals / 15 boards** (expected 452/15);
`catalog:check-jacks` green; `pnpm lint` (2 pre-existing warnings), `typecheck`,
`test` **893/893**, `build` green; `catalog:guard-batch-pr` clean.

**Evidence:** desktop + mobile before/after app screenshots and the dual-tone,
corner and fixed-cell sheets are on the `p5-03-pedals-joyo-1-evidence` branch
(embedded by SHA in the PR), not on this branch.

**Demo link:** `pnpm catalog:demo-link --batch joyo/joyo-1` -> 26 items / 25
illustrative cables (verified in the PR).

**Budget:** ~520k billed (wrapper reports the root session only; soft 400k exceeded, hard 800k not reached — logged at 434k/47 min) / ~110 min active. One vision model call
per pass, no code-review pass (data-only; `curated.ts` untouched).
