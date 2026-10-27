# P5-03: BOSS — pedals batch 5

**Phase:** P5 · **Status:** in progress — batch delivered; PR pending — T-2 last batch, **solo single-batch wave** · **Model:** build-strong

> The coordinator ran `catalog:start` for `boss/boss-5` and **stopped** it at 0/26 on
> the third-slot gate. For this solo run the coordinator **must resume** it
> (`catalog:resume --batch boss/boss-5`, which clears the stop marker) before the
> session starts. Do **not** run `catalog:start` again. Checkpoint inline after
> every item, finish with `catalog:finish`.

## Goal

Research and deliver the fifth BOSS catalog batch (26 net-new raw records +
hosted AVIF assets) for `boss/boss-5`, then open exactly one PR. BOSS inventory
slice **104–129** (0-based, alphabetical id order). All 26 are net-new.

## Scope (exact 26)

`boss-md-2-mega-distortion`, `boss-md-200-modulation`, `boss-md-500-modulation`,
`boss-me-90-guitar-multiple-effects`, `boss-me-90b-guitar-multiple-effects`,
`boss-ml-2-metal-core`, `boss-mo-2-multi-overtone`, `boss-ms-3-multieffects-switcher`,
`boss-mt-2-3a-metal-zone-anniversary`, `boss-mt-2-metal-zone`,
`boss-mt-2w-metal-zone-waza-craft`, `boss-mz-2-digital-metalizer`,
`boss-nf-1-noise-gate`, `boss-ns-1x-noise-suppressor`, `boss-ns-2-noise-suppressor`,
`boss-oc-2-octave`, `boss-oc-20g-poly-octave`, `boss-oc-3-super-octave`,
`boss-oc-5-octave`, `boss-od-1-overdrive`, `boss-od-1x-overdrive`,
`boss-od-2-turbo-overdrive`, `boss-od-20-drive-zone`, `boss-od-200-hybrid-drive`,
`boss-od-2r-turbo-overdrive`, `boss-od-3-overdrive`.

Expected `catalog:ci` on this branch: **322 pedals / 15 boards** (main 296/15 +
26). Final after boss-5 merges: 322/15.

## Non-stompbox / non-compact device types

Verify each unit against its official BOSS page; never invent a field. Use the
raw-schema enums only.

| Items | Guidance (verify) |
| --- | --- |
| MD-2 | `stompbox` / `compact` / `distortion` |
| MD-200, MD-500 | `multi-fx` / `desktop` / core modulation effects (`chorus`, `flanger`, `phaser`, `tremolo`, `vibrato`, `rotary`, `filter` as applicable) |
| ME-90, ME-90B | `multi-fx` / `standard` / `amp-modeler` + relevant effects |
| ML-2 | `stompbox` / `compact` / `distortion` |
| MO-2 | `stompbox` / `compact` / `pitch`, `octave` |
| MS-3 | `switcher` / `standard` / `controller`, `multi-fx` (verify) |
| MT-2-3A, MT-2, MT-2w | `stompbox` / `compact` / `distortion` |
| MZ-2 | `stompbox` / `standard` or `double` per official photo / `distortion` (verify the enclosure) |
| NF-1, NS-1X, NS-2 | `stompbox` / `compact` / `gate` |
| OC-2, OC-3, OC-5 | `stompbox` / `compact` / `octave` |
| OC-20G | `stompbox` / `double` or `standard` per official photo / `octave` (verify) |
| OD-1, OD-1X, OD-2, OD-2R, OD-3 | `stompbox` / `compact` / `overdrive` |
| OD-20 | `stompbox` / `double` or `standard` per official photo / `overdrive`, `distortion` (verify) |
| OD-200 | `stompbox` / `double` or `standard` per official photo / `overdrive`, `distortion` (verify) |

`expression` is a `formFactor`, never a `deviceType`. Only `EFFECT_TYPES`
values are allowed.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and
  an uncommitted app-workspace runtime** for Playwright; the post-merge build
  commits mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. Generated pedal-art
  specs under `tools/asset-pipeline/pedal-art/specs/` are allowed when used.
- **Capture every connector with its position**; only audio I/O is a cable anchor.
- **Jack edges require a verified source** (official rear/top photo, support page
  or manual diagram, including scanned/image-only PDFs). Text-layer first; else
  one connector-strip crop inside the existing contact-sheet/vision pass. Omit
  the edge + `confidence: "unknown"` with a one-line reason if no official source
  shows the face. Never infer from a sibling model or form factor. Run
  `pnpm catalog:check-jacks`.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens.
- **Image policy (T-1a, planner last-resort):** official BOSS product gallery/
  support → authorized retailer → user/community (recorded URL) → **planner/
  Pedalplayground last resort (recorded + quality-gated)** → generated flat art
  only when none exists. Record `imageProvenance` for every item; never put a
  planner/community URL on the public page. Planner last-resort is a counted
  source gap (current ledger: 311 items = 89 own + 222 license-pending; 33 planner
  gaps; 0 legacy). **Planner-repeat guard (boss-4 correction cost 192k):** check
  `docs/catalog/image-source-registry.md` first; run the deterministic gate
  (alpha/aspect/bright/PSNR) **before** a candidate enters the contact sheet; after
  one rejected planner image go straight to generated art instead of re-sourcing;
  hard cap 2 vision passes.
- **Clean-alpha + AVIF gate:** 800/350 AVIF, aspect/alpha/bg pass, PSNR ≥40 dB
  (q90 escalation), `--matte none` for already-transparent sources, flood/
  components/global per the template. Defringe/re-source if a halo appears.
- **Generated art:** `docs/catalog/pedal-art.md`; one spec per item, body median
  sampled, no planner pixels as reference, no logo/shadow/gradient.
- **Budget (boss-5 solo lane):** billed non-cache soft **≤600k / hard ≤800k**
  (owner-set; the token reviewer suggested 900k but that was **not adopted**). The
  600/800 lines are **not enforced by tooling** for a solo run, so the coordinator
  checks billed tokens every 15 min and stops manually at 800k. The **3.2M
  combined hard stop** is non-binding with 0 feature streams; the **≤2 PRs awaiting
  review** cap still applies. ≤2 contact-sheet vision passes; ≤1 light code review
  (data-only: normally skip unless `curated.ts` changed); **4 h active hard**; 12
  min/item first-8 heuristic. At 80% soft (480k), log the projection; at the hard
  cap, pause/stop and report — do not open a partial PR. Boss-5 runs **solo**: no
  third slot, no feature stream.
- Status every 15 min; checkpoint after every item.
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Steps

1. Restate scope (26) and expected CI (322/15).
2. Write raw records under `data/catalog/research/pedals/boss/boss-5.json`.
3. **Do not run `catalog:start`** — the run was resumed for this solo batch.
   Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch boss/boss-5 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, and the
   review-round digest.

## Acceptance (executable)

- 26 raw records; mandatory fields present; optional fields only if found.
- Correct `deviceType`/`formFactor`/`effectTypes` (only raw-schema enums).
- Images 800/350 AVIF, alpha/background/aspect pass, same-origin, no placeholders;
  every item has recorded `imageProvenance`.
- `catalog:check-jacks` green; `catalog:validate` green; `catalog:guard-batch-pr`
  green; PR contains no mapped/runtime edits.
- Playwright picker search/brand/effect, image load, canvas placement, no console
  errors (desktop + mobile).
- Contact sheet (10–30 images) + coverage/reject report in the PR.
- Demo share link with every batch item on one board + illustrative cables;
  counts verified.
- Billed tokens + minutes/item recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict: `adjust`.
- The 1 BOSS hotlinked seed (`boss-psm-5-power-supply-master-switch`, inventory
  index 143) is **out of scope**; it is cleared in T-7/T-3. Do not add it here.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.

## Delivery (2026-10-27)

- **26 raw records / 52 AVIFs** (800/350), all with `imageProvenance`: **18 official
  BOSS + 8 planner last-resort + 0 generated**. Planner last-resort is counted as a
  source gap (not gap-closed): MT-2-3A, MZ-2, NF-1, OC-2, OC-20G, OD-1, OD-2, OD-2R.
- **Status mix:** 16 current / 10 discontinued. Non-stompbox types verified against
  official pages: MD-200/MD-500 `multi-fx`/`desktop`, ME-90/ME-90B `multi-fx`/
  `standard`, MS-3 `switcher`/`standard`, OC-20G `double`, OD-20/OD-200 `standard`.
- **Jack edges:** verified rear-panel photos for MD-200, MD-500 and OD-200 (all on
  the `top`/rear edge); MS-3 rear face was not legible → unknown. All other edges
  omitted with `jackLayout.confidence: "unknown"` (app uses assumed anchors).
- **Image QA:** deterministic analyzer accept **26/26**; contact sheet **30 cells**
  (26 cutouts + 4 rear-panel connector crops) reviewed in one `catalog-image-reviewer`
  pass → **26/26 cutouts accept**, jack faces verified **3/4**. AVIF q80 for 18,
  q90 escalation for 7, q92 for MD-200; minimum PSNR **40.12 dB** (MD-200).
- **Connector-face process note:** the first 30-cell reviewer call hit the model’s
  reasoning limit and returned empty; the same session was resumed with an
  output-only instruction and returned the full JSON. No model substitution.
- **Checks:** `catalog:ci` **322 pedals / 15 boards**; `catalog:validate` green
  (296/15 committed); `check-jacks`, `check-images` and `guard-batch-pr` green;
  lint / typecheck / test **832** / build / e2e **264 passed + 7 skipped** (desktop
  and mobile Chromium). Demo link: **26 items / 25 illustrative cables**.
- **Batch-support code:** `tools/catalog-transform/curated.ts` verified effect-type
  overrides for the 12 creative/multi-effect names (required by the no-drift test),
  plus aliases for the ME-90B/ MS-3 inventory-vs-official name mismatch. No mapped
  or runtime files in the PR.
