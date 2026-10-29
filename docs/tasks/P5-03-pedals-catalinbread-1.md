# P5-03: Catalinbread — pedals batch 1 (Tier A)

**Phase:** P5 · **Status:** in review — PR pending (blocked on coordinator-only `curated.ts` effect overrides) · **Model:** deepseek-v4.1-flash

> The `tier-a-wave-1` coordinator created this worktree and will start
> `catalinbread/catalinbread-1` (total 26) via `catalog:wave`. **Never run
> `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately after
> setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch catalinbread/catalinbread-1`.

## Goal

Deliver Catalinbread's first catalog batch: **26 new Tier A items** (Catalinbread has
no existing catalog seeds), then open exactly one PR. Every item must ship a
self-hosted 800/350 AVIF with recorded provenance.

## Scope (exact 26; verified from the inventory at T-8 launch)

Base: `origin/main` at `b4a70ba` = **468 pedals / 15 boards**, ledger **483**.
Catalinbread Tier A inventory = **65**, existing seeds = **0**. This batch takes the
first 26 in inventory order.

| # | id | Name |
|---|---|---|
| 1 | `catalinbread-adineko` | Adineko |
| 2 | `catalinbread-adineko-70s-collection` | Adineko ('70s Collection) |
| 3 | `catalinbread-adineko-ghost` | Adineko Ghost |
| 4 | `catalinbread-airstrip` | Airstrip |
| 5 | `catalinbread-antichthon` | Antichthon |
| 6 | `catalinbread-antichthon-deluxe` | Antichthon Deluxe |
| 7 | `catalinbread-belle-epoch` | Belle Epoch |
| 8 | `catalinbread-belle-epoch-plus` | Belle Epoch + |
| 9 | `catalinbread-belle-epoch-deluxe` | Belle Epoch Deluxe |
| 10 | `catalinbread-bicycle-delay` | Bicycle Delay |
| 11 | `catalinbread-bitters` | Bitters |
| 12 | `catalinbread-blood-donor` | Blood Donor |
| 13 | `catalinbread-cb-paint` | CB Paint |
| 14 | `catalinbread-cb-tap` | CB Tap |
| 15 | `catalinbread-cbx` | CBX |
| 16 | `catalinbread-csidman` | CSIDMAN |
| 17 | `catalinbread-csidman-ghost` | CSIDMAN Ghost |
| 18 | `catalinbread-callisto` | Callisto |
| 19 | `catalinbread-callisto-mkii` | Callisto MKII |
| 20 | `catalinbread-carbide` | Carbide |
| 21 | `catalinbread-clean-little-secret` | Clean Little Secret |
| 22 | `catalinbread-cloak` | Cloak |
| 23 | `catalinbread-coriolis-effect` | Coriolis Effect |
| 24 | `catalinbread-dirty-little-secret` | Dirty Little Secret |
| 25 | `catalinbread-dirty-little-secret-deluxe` | Dirty Little Secret Deluxe |
| 26 | `catalinbread-dreamcoat` | Dreamcoat |

Do not force 26: if an item has no verifiable official source, record the gap and
state it in the PR; do not invent facts. Substitute only with a recorded reason.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance |
|---|---|
| Adineko / Adineko '70s / Ghost | Oil-can delay; verify the exact enclosure size and control set per version — do not reuse a sibling's footprint |
| Belle Epoch / Belle Epoch + / Belle Epoch Deluxe | Delay/echo; the Deluxe is a larger enclosure than the standard — verify each unit's official dimensions |
| Antichthon / Antichthon Deluxe | Fuzz; verify whether the Deluxe is a larger enclosure |
| CBX / Callisto / Callisto MKII / CSIDMAN / Bicycle Delay / Dreamcoat | Verify whether the unit is the standard compact or a larger enclosure (e.g. CBX, Dreamcoat) from the official spec |
| All others | Standard Catalinbread compact enclosures; verify dimensions, controls, effect tag, power and jacks independently |

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
  `/Users/ashel/Documents/Programming/pedalvision-t8-baseline-catalinbread` at
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
  `p5-03-pedals-catalinbread-1-evidence` and embed the evidence-branch raw URLs in
  the PR, or `catalog:guard-batch-pr` fails.
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
- **Before/after screenshots (desktop + mobile)** are mandatory: same
  viewport/theme/state on `main` and on this branch, both embedded inline in the PR.
  This is a new-brand batch (no prior UI row for these items), so show the closest
  baseline (the picker/canvas before these items existed) and say why.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light code
  review (data-only may skip; a `curated.ts` change needs one); 4 h active hard stop
  (240 min → stop and report, no partial PR). The wave soft is 1.6M / hard 2.4M.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch catalinbread/catalinbread-1 --origin <PR-preview-origin>
  --out work/catalog/catalinbread-1-demo.txt`; verify board/item/cable counts on the
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
9. Finish the batch (`pnpm catalog:finish --batch catalinbread/catalinbread-1`), then
   open exactly one PR with the required sections (summary, changes, testing steps,
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

## Session log — 2026-10-29 (batch session, tier-a-wave-1)

- **Scope:** 26/26 new Tier A items shipped; 52 AVIFs (26 × 800/350). Expected
  `catalog:ci` = **494 pedals / 15 boards** (468 + 26). Ledger unchanged until merge.
- **Images:** **18 official** Catalinbread product renders (1080–1500 px,
  transparent PNG, `--matte none` + `--body-crop`, AVIF q95) + **8 planner
  last-resort** (Pedalplayground GitHub raw, 350/500 px, 1.37–1.6× upscale).
  **Planner share 8/26 = 31%** — just above the ≤30% target, below the >50%
  waiver threshold; all 8 are counted source gaps.
- **Source discovery:** registry first; Catalinbread Shopify `products.json`
  (one brand index fetch, reused for all 19 current items) + official spec
  tables/manuals; Pedalplayground planner data (one index) for the 7
  discontinued models + CB Tap; Google/Bing Images **not used** (zero-yield
  avoided); `catalinbread.com` HTML product pages rate-limited (429) on direct
  curl — read via `r.jina.ai` where needed. No marketplace pixels shipped.
- **Dimensions:** official unit spec tables (2.36 × 4.33 × 1.96 in standard;
  4.68 × 3.66 × 2.4 in Deluxe landscape; CSIDMAN 2.48 × 4.48 × 1.29 in;
  Callisto 2.37 × 4.37 × 1.87 in). Antichthon Deluxe, CB Tap and Coriolis have
  no official unit table — planner rectangle used and recorded.
- **Jacks:** no official connector-face photo/manual diagram verified → every
  record omits `edge` with `jackLayout.confidence: "unknown"`; `catalog:check-jacks`
  green. No connector-strip crop was needed because no edge is asserted.
- **Image QA:** deterministic analyzer on the final 800 — all `accept` after
  body-crop except 6 `flag` (perspective/shape-taper on the 4 landscape units +
  CB Tap; clean-little-secret false-positive white-enclosure "card", verified
  transparent source border 0/3000). PSNR **41.94–51.05 dB** (all ≥40). One
  `catalog-image-reviewer` pass on the dual-tone sheet: **approve-with-flags,
  0 rejects**.
- **Blocker — `curated.ts` (coordinator-only):** the batch cannot be merged until
  the coordinator adds `CURATED_EFFECTS` entries. The no-drift test requires the
  runtime `effectTypes` to equal `deriveEffectTypes`; the name classifier returns
  `[]` for every item except `catalinbread-bicycle-delay`. Verified types (already
  in each raw record and in `extra.verifiedEffectTypes`):
  `catalinbread-adineko` delay,vibrato,reverb · `catalinbread-adineko-70s-collection`
  delay,vibrato,reverb · `catalinbread-adineko-ghost` delay,vibrato,reverb ·
  `catalinbread-airstrip` preamp,boost · `catalinbread-antichthon` fuzz,tremolo ·
  `catalinbread-antichthon-deluxe` fuzz,tremolo · `catalinbread-belle-epoch` delay ·
  `catalinbread-belle-epoch-plus` delay · `catalinbread-belle-epoch-deluxe` delay ·
  `catalinbread-bicycle-delay` delay (classifier already matches) ·
  `catalinbread-bitters` distortion,phaser,bitcrusher,ring-mod ·
  `catalinbread-blood-donor` fuzz,distortion · `catalinbread-cb-paint` reverb ·
  `catalinbread-cb-tap` controller · `catalinbread-cbx` reverb,gate ·
  `catalinbread-csidman` delay,bitcrusher · `catalinbread-csidman-ghost`
  delay,bitcrusher · `catalinbread-callisto` chorus,vibrato ·
  `catalinbread-callisto-mkii` chorus,vibrato · `catalinbread-carbide` distortion ·
  `catalinbread-clean-little-secret` overdrive,eq · `catalinbread-cloak` reverb ·
  `catalinbread-coriolis-effect` filter,pitch,wah · `catalinbread-dirty-little-secret`
  overdrive · `catalinbread-dirty-little-secret-deluxe` overdrive,distortion ·
  `catalinbread-dreamcoat` preamp,fuzz,boost.
  Official wording source: each item's Catalinbread product page/manual (recorded
  in `sources[]` and `notes`).
- **Checks:** `catalog:ci` green (494/15, 128 planner gaps); `catalog:check-jacks`
  green; `pnpm typecheck` + `pnpm build` green; `pnpm test` **892/893** — only the
  no-drift test fails on the uncommitted 494 runtime (expected blocker above);
  `pnpm lint` fails on `tools/asset-pipeline/analyze.ts` (2 pre-existing
  `noUnusedVariables` warnings, also red on `origin/main` b4a70ba).
- **Screenshots:** desktop + mobile before (`origin/main`, 0 Catalinbread results)
  and after (26 results, effect filter, Belle Epoch Deluxe on canvas) on the
  evidence branch.
