# P5-03: Big Joe — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #84 · **Model:** deepseek-v4.1-flash

> The `cleanup-wave-4` coordinator created this worktree, wrote the existing-item
> raw scaffolds (`data/catalog/research/pedals/big-joe/big-joe-1.json`) and will
> start `big-joe/big-joe-1` (total **2**) via `catalog:wave`. **Never run
> `catalog:start`/`catalog:resume`.** Checkpoint **the first item immediately after
> setup**, then inline after every item, and finish with
> `pnpm catalog:finish --batch big-joe/big-joe-1`.

## Goal

Deliver Big Joe's first catalog batch: re-host and fully document the **2 existing
seed items** (both mock power supplies). Do **not** force 26. After this batch no
Big Joe item may ship a mock/placeholder asset.

## Scope (exact 2; verified from the ledger + inventory at T-7 handoff)

Base: `origin/main` at `46c03b5` = **468 pedals / 15 boards**, ledger **483**.
Big Joe Tier A inventory = **0 net-new**. The next Tier B/C items are **out of
scope**; adding them is an owner scope change, not a batch decision.

### Existing 2 — re-host + document (raw scaffolds already written)

| # | id | Name | Current | Hosting |
|---|---|---|---|---|
| 1 | `big-joe-pb-109-power-box-li2` | PB-109 Power Box Li2 | mock | mock |
| 2 | `big-joe-power-box-iso4` | Power Box ISO4 | mock | mock |

The scaffolds carry old approximate facts only. Verify the official dimensions
(unit, never an accessory), `deviceType` (power supply), voltage/current per output,
isolation, power input and battery/charging specs where applicable; capture every
connector. Replace each mock with a self-hosted 800/350 AVIF and record
`imageProvenance`.

## Expected CI

Base `468/15`; this batch re-hosts 2 existing items and adds **0 net-new** →
expected `catalog:ci` **468 pedals / 15 boards**. State the actual number in the PR.
Ledger stays **483** after merge.

## Form-factor guidance (verify each; never invent)

| Item | Guidance |
|---|---|
| PB-109 Power Box Li2 | Lithium battery power box; verify output count/voltage/current, USB/charging, enclosure dimensions and `deviceType: power-supply` |
| Power Box ISO4 | Isolated 4-output power supply; verify isolation, output specs, included adapter, dimensions and connectors |

These are **not** audio effects. Do not invent an effect type.

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
  `/Users/ashel/Documents/Programming/pedalvision-t7-baseline-big-joe` at
  `origin/main` (`46c03b5`), never from a dirty feature checkout or a shared dir.
- **Checkpoint-first (mandatory T-6 lesson):** checkpoint item 1 **immediately
  after setup**, then inline after every item. An `exit 75` /
  `per-item limit exceeded` checkpoint result is **advisory** (30-min limit) —
  keep going; do not stop and do not `catalog:resume` for it.
- **Budget edges:** 800k hard is far above a 2-item batch; stop discovery earlier,
  never verification. This is a small batch — use the budget for accurate specs and
  clean images, not extra searching.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an
  uncommitted app-workspace runtime** for Playwright; the post-merge build commits
  mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; never add it preemptively.
- **Evidence branch (mandatory):** the batch PR branch contains **raw records +
  assets + this task file only**. Put screenshots/contact sheets on
  `p5-03-pedals-big-joe-1-evidence` and embed the evidence-branch raw URLs in the
  PR, or `catalog:guard-batch-pr` fails.
- **Existing-item rule:** both raw scaffolds are `legacy`/`pending-replacement`.
  Replace each asset with a self-hosted 800/350 AVIF and update `imageProvenance` to
  the real final source (official/retailer/community/planner last-resort/generated),
  including source dimensions + upscale factor. Never keep the mock.
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
  halo/fringe gate; one sheet for both items; max **2 vision passes** total. Reject
  angled/high-res-but-not-flat images. Flatness is judged at 1:1: a bezel, inset
  faceplate or stepped chassis is not a side wall.
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or jagged
  edge. `--matte none` for an already-clean transparent PNG; never re-key a
  transparent source.
- **Resolution:** prefer the highest-resolution real source; upscale soft ceiling
  ≤2× (above that use generated art unless the single reviewer pass explicitly
  accepts it, recorded, and the item stays a counted gap). Gate the **final 800
  rendition**; record source URL, dimensions and upscale factor.
- **Jack edges require a verified source.** For power supplies, verify the **power
  input** connector and output sockets from an official photo/manual; audio I/O does
  not apply. Omit an unverified edge with `confidence: "unknown"` and record why.
- **Footprint dimensions come from the official unit spec, never an accessory;**
  record the dimension source before the aspect gate.
- **Analyzer:** process to the 800/350 master first, then `pnpm asset:analyze` with
  `--source photo|planner|generated`; `asset:psnr` ≥40 dB.
- **Before/after screenshots (desktop + mobile)** are mandatory: same
  viewport/theme/state on `main` and on this branch, both embedded inline in the PR,
  plus a before/after contact-sheet crop.
- **Budget:** soft ≤400k / hard ≤800k billed tokens; ≤2 vision passes; ≤1 light code
  review (data-only may skip); 4 h active. The wave soft is 1.6M / hard 2.4M.
- **Demo share link:** run `catalog:ci` first, then
  `pnpm catalog:demo-link --batch big-joe/big-joe-1 --origin <PR-preview-origin>
  --out work/catalog/big-joe-1-demo.txt`; verify board/item/cable counts. With only
  2 items the illustrative cable count may be 1 — state the exact counts.
- **Next-wave:** the coordinator owns the next wave; do not launch siblings.

## Steps

1. Restate the exact 2-item scope; confirm the raw scaffolds.
2. Checkpoint item 1 immediately, then verify dimensions/device type/power/
   connectors per item and checkpoint inline after each item.
3. Run the deterministic image scripts per item (process → analyze → psnr → dual-tone
   contact sheet); record provenance + source dimensions/upscale.
4. Connector-face check for the power input/outputs (`catalog:check-jacks`); omit
   unknown edges.
5. Run `pnpm catalog:check-jacks`, `pnpm catalog:ci`, and the Playwright
   picker/render check (desktop + mobile).
6. Run `pnpm catalog:guard-batch-pr`; PR = raw records + assets + this task file only.
7. Produce the contact sheet + coverage/planner-share report.
8. Build the demo share link and verify counts.
9. Finish the batch (`pnpm catalog:finish --batch big-joe/big-joe-1`), then open
   exactly one PR with the required sections (summary, changes, testing steps,
   before/after screenshots, owner review hints, review digest, demo link, billed
   tokens/minutes). Do not merge.

## Acceptance (executable)

- Raw records cover the 2; mandatory fields present; optional only if found.
- Images: 800/350, alpha/background/aspect pass, same-origin; no mock/placeholder in
  shipped scope; planner share recorded.
- `catalog:check-jacks` green; `catalog:validate` green in CI temp build;
  `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright: picker search/brand, image load, canvas placement, no console errors;
  desktop + mobile before/after screenshots in the PR.
- Contact sheet + coverage report in the PR; demo share link verified.
- One PR; no merge.

## Session log — 2026-10-29 (coordinator owner correction)

- **Owner instruction:** use the PedalPlayground production assets for Big Joe
  (`https://github.com/PedalPlayground/pedalplayground/tree/production/public`):
  `public/images/pedals/big-joe-li2.png` and `big-joe-iso4.png`.
- Replaced both generated Catalog Specimen AVIFs with the PedalPlayground cutouts
  (258×529 RGBA → **1.51×** upscale to the 800 master; 350 rendition regenerated).
  The two generated-art specs were removed.
- **Orientation:** the planner art is portrait, so the footprint is stored portrait
  (**Li2 4.1275 × 8.255 cm**; **ISO4 4.2164 × 8.509 cm**). The physical rectangle is
  unchanged (official spec); only the canonical orientation matches the art.
- **Provenance:** `kind: planner`, `status: last-resort`, exact GitHub raw
  `sourceUrl`, repo tree `referenceUrl`, owner instruction + **planner share 2/2 =
  100%** (owner override) recorded.
- **Gates:** analyzer on the final 800 — **accept** both (aspect 2.5%/1.6%, rotation
  0°, bright edge 0, no background card); PSNR **47.81 / 46.25 dB**; one
  `catalog-image-reviewer` pass — **FLAG** both (faint left-edge rim + soft small
  lettering from the 1.51× upscale; no reject-level halo/shadow/background card),
  accepted as a recorded planner **source gap**.
- **Checks:** `catalog:ci` **468/15** (120 planner source gaps, +2); tests
  **893/893**; lint/typecheck/build + `catalog:guard-batch-pr` clean.
