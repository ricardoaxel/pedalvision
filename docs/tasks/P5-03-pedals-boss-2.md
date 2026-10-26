# P5-03: BOSS — pedals batch 2

**Phase:** P5 · **Status:** in review — PR #48 (wave `boss-wave-2`) · **Model:** build-strong

> **Data reused — do NOT re-research.** The previous stopped boss-2 worktree
> (`../pedalvision-p5-03-boss-2`) produced the 26 verified raw records and 52
> AVIFs; the coordinator copied them into this worktree and already ran
> `catalog:start`. Validate, QA, run the gates, and open the PR.

## Goal

Deliver the second BOSS split-test catalog batch (26 raw records + hosted AVIF assets) for `boss/boss-2`, then open exactly one PR for this batch. This is slot 2 of the 2-wide BOSS parallel test (slot 1 = `boss/boss-1`, PR #46).

## Scope

26 BOSS inventory items, indices 26–51:

`boss-dc-2-dimension-c`, `boss-dc-2w-dimension-c-waza-craft`, `boss-dc-3-digital-dimension`, `boss-dd-2-digital-delay`, `boss-dd-20-giga-delay`, `boss-dd-200-digital-delay`, `boss-dd-3-digital-delay`, `boss-dd-3t-digital-delay`, `boss-dd-5-digital-delay`, `boss-dd-500-digital-delay`, `boss-dd-6-digital-delay`, `boss-dd-7-digital-delay`, `boss-dd-8-digital-delay`, `boss-df-2-super-feedbacker-distortion`, `boss-dm-101-delay-machine`, `boss-dm-2-delay`, `boss-dm-2w-delay-waza-craft`, `boss-dm-3-delay`, `boss-dn-2-dyna-drive`, `boss-ds-1-distortion`, `boss-ds-1-4a-anniversary-distortion`, `boss-ds-1-wh-distortion`, `boss-ds-1x-distortion`, `boss-ds-1w-distortion`, `boss-ds-2-turbo-distortion`, `boss-dsd-2-digital-sampler-delay`.

17 ids replace existing seed items; 9 are net-new (`dc-2w`, `dm-2w`, all five DS variants, `ds-2`, `dsd-2`). Expected `catalog:ci` count: **244 pedals / 15 boards** (main is 235/15).

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an uncommitted app-workspace runtime** for Playwright; the post-merge build commits mapped/runtime. The only allowed batch-support code file is `tools/catalog-transform/curated.ts`, and only when the no-drift test actually requires a verified override; do not add it preemptively. No other `tools/` edits.
- **Jack edges require a verified source (owner correction 2026-10-25):** text-layer first — grep the official manual for the panel/connector face; if the text does not name the face, render the manual panel/connection page with `pdftoppm` and judge a **connector-strip crop** in the single contact-sheet vision pass. Image-only/scanned manuals and official photos count. A missing PDF text layer is **not** an unknown edge. Never infer an edge from form factor or a sibling model. If no official source shows the face, omit the edge, set `jackLayout.confidence: "unknown"`, and record why. `jackLayout: { source, confidence: "verified" }` for every asserted edge.
- **Images:** official BOSS product pages/manuals first. BOSS `_main`/`_top_gal` images are 3/4-perspective and fail the analyzer's perspective gate; authorized-retailer listings reuse the same BOSS press assets. Use the owner-approved Pedalplayground flat cutouts only as the documented last resort (`public-asset` tag + provenance note). Process with `--matte none`, AVIF 800/350, PSNR ≥ 40 dB (q90 escalation), one contact sheet per 10–30 flagged images, max 2 vision passes total.
- **Optional fields only if found in the same base research.**
- **Seed replacements:** replacing a seed item with real power/jacks can make seed-state test fixtures stale; the owner approved minimal data-driven test updates in a batch PR. Include only what the data requires, list them in the PR.
- No edits to feature code, generated mapped/runtime catalog, or other brands' batches.
- **Budget:** soft ≤400k / hard ≤800k tokens, ≤2 contact-sheet vision passes, ≤1 light code-review pass (only if curated/tooling changes), 4 h active, 12 min/item. Stop and report if a cap is hit; do not open a PR.

## Steps

1. **Do not run `catalog:start`** — the coordinator already started this batch. Checkpoint **inline after every item** with done/accepted/rejected/tokens.
2. **Raw records already present** at `data/catalog/research/pedals/boss/boss-2.json` (26 records, all `jackLayout` verified). Validate them against `rawSchema.ts`; fix only schema-level defects — do not re-research facts.
3. **Assets already present** (800/350 AVIF, 26 + 26). Re-run the deterministic checks: `asset:psnr` ≥ 40 dB, aspect/alpha/background, `asset:qa`; build the contact sheet and run the single vision pass. Reject/replace only items that fail a gate.
4. Run `catalog:check-jacks`, `catalog:ci`, `catalog:validate`, `catalog:guard-batch-pr`.
5. Build the demo link: `catalog:demo-link --batch boss/boss-2 --origin https://p5-03-pedals-boss-2-v2.pedalvision.pages.dev`.
6. App QA (picker/place, desktop + mobile Chromium), `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. `catalog:finish`; open exactly one PR (no merge) with coverage, accept/reject counts, demo link and review digest. This session hands off with the PR.

## Acceptance (executable)

- 26 raw records; mandatory fields present; optional fields only if found.
- Images: 800/350 AVIF, alpha/background/aspect pass, same-origin; no placeholders.
- `catalog:check-jacks` green; `catalog:validate` green; `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright picker search/brand/effect, image load, canvas placement, no console errors (desktop + mobile).
- Contact sheet (10–30 images) + coverage/reject report in the PR.
- Demo share link with every batch item on one board + illustrative cables; verify counts.
- Per-batch token/time budget recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from the token-usage review.
- If this batch uncovers a process/rule gap, do not edit the rules in this PR; propose the change + token review to the owner first.

## Data-reuse session (2026-10-26)

The earlier `boss-2` worktree produced the 26 verified raw records and 52 AVIFs; this session
validated them, re-ran the deterministic image checks, ran the gates, did app QA and opened the
single PR. No facts were re-researched.

- **Records:** 26/26 validate against `RawPedalBatchSchema`; all 26 carry
  `jackLayout: { confidence: "verified" }`; `catalog:check-jacks` green (no unverified edges).
- **Assets:** 26 × 800 + 26 × 350 AVIF. Re-ran the deterministic checks: long edge 800/350,
  alpha present + transparent background, aspect vs cm footprint ≤10%, pipeline PSNR (fresh PNG
  cutout vs AVIF q80) **41.99–44.01 dB** (all ≥40). `boss-dd-20-giga-delay` shipped without
  body-crop and matches the fresh render exactly (IoU 0.9998); the other compacts match at
  IoU ≥0.995 (sub-pixel body-crop difference).
- **Vision QA:** one `catalog-image-reviewer` pass over a 26-cell contact sheet → **26 accept /
  0 flag / 0 reject**.
- **Gates:** `catalog:ci` / `catalog:validate` **244 pedals / 15 boards** (main 235 + 9 net-new;
  17 ids replace seed entries). `catalog:guard-batch-pr` reports exactly the 3 owner-approved
  data-driven test files below; no feature code, runtime or mapped files.
- **App QA:** 4/4 — DD-8 picker search + BOSS brand filter, AVIF thumbnail loaded
  (`naturalWidth` 181), placement (`data-items=1`), canvas present, no console errors
  (desktop + mobile, dark + light).
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` **721 passed**, `pnpm build`,
  `pnpm e2e` **258 passed + 7 skipped** (with the uncommitted batch runtime).
- **Demo link:** 1 custom board (93 × 49 cm) / **26 items / 25 cables / 0 unconnected**.
- **Owner-approved batch-support test changes (3 files):** replacing the seed `boss-dc-2` with
  verified jacks makes the fallback-anchor fixtures stale, and the Waza reissues link across
  enclosure generations:
  - `src/lib/jackAnchor.test.ts` + `src/lib/cableSummary.test.ts` — fallback-anchor fixture moved
    from `boss-dc-2-dimension-c` to `red-panda-rd-1-pitch-delay` (still no jack data, and its
    batch is complete so it stays stable).
  - `tools/catalog-transform/effects.test.ts` — the colorway-footprint assertion skips the two
    Waza Craft reissues (`dc-2w`, `dm-2w`), whose vintage-vs-modern enclosures genuinely differ
    (70 × 125 mm vs 73 × 129 mm).
- **Budget:** ~17 min wall clock, ~0.65 min/item (data-reuse session); 39k tokens recorded via
  inline checkpoints (floor). One contact-sheet vision pass; no code-review pass (only
  owner-approved test fixtures; the test suite is the re-check).
