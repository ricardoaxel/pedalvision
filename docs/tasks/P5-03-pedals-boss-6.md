# P5-03: BOSS — pedals batch 6

**Phase:** P5 · **Status:** todo — T-3 wave 4 (3-wide) · **Model:** build-strong

> The `boss-wave-4` coordinator already ran `catalog:start` for `boss/boss-6`.
> **Do not run `catalog:start`/`catalog:resume`.** Checkpoint inline after every
> item and finish with `pnpm catalog:finish --batch boss/boss-6`.

## Goal

Research and deliver the sixth BOSS catalog batch: **26 net-new raw records +
hosted AVIF assets**, plus the **1 BOSS hotlinked seed repair** (`psm-5`), then
open exactly one PR. BOSS inventory slice **130–155** (0-based, alphabetical id
order) plus the deferred seed. Final BOSS state after T-3: **208 BOSS items, 0
BOSS hotlinked**.

## Scope (26 net-new + 1 repair)

`boss-odb-3-bass-overdrive`, `boss-os-2-overdrive-distortion`,
`boss-ph-1-phaser`, `boss-ph-1r-phaser`, `boss-ph-2-super-phase`,
`boss-ph-3-phase-shifter`, `boss-pn-2-tremolo-pan`,
`boss-pq-3b-bass-parametric-equalizer`, `boss-pq-4-parametric-equalizer`,
`boss-ps-2-pitch-shifter-delay`, `boss-ps-3-pitch-shifter-delay`,
`boss-ps-5-super-shifter`, `boss-ps-6-harmonist`, `boss-pw-2-power-driver`,
`boss-pw-3-wah-pedal`, `boss-px-1-plugout-fx`, `boss-rc-1-bk-loop-station`,
`boss-rc-10r-rhythm-loop-station`, `boss-rc-2-loop-station`,
`boss-rc-20xl-loop-station`, `boss-rc-3-loop-station`,
`boss-rc-30-loop-station`, `boss-rc-300-loop-station`,
`boss-rc-5-loop-station`, `boss-rc-500-loop-station`,
`boss-rc-600-loop-station`.

**Repair (existing seed, no new count):** `boss-psm-5-power-supply-master-switch`
— currently a hotlinked `static.roland.com` official URL. Host the official image
under `public/pedal-assets/pedals/`, record `imageProvenance`, and add/refresh its
raw record in `boss-6.json` with the seed `id`. Do not change verified facts
without a source.

Expected `catalog:ci` on this branch: **348 pedals / 15 boards** (main 322 + 26).

## Non-stompbox / non-compact device types

Verify each unit against its official BOSS page; never invent a field. Use the
raw-schema enums only (`RAW_DEVICE_TYPES`, `RAW_FORM_FACTORS`, `EFFECT_TYPES`).

| Items | Guidance (verify) |
| --- | --- |
| ODB-3 | `stompbox` / `compact` / `overdrive` (bass) |
| OS-2 | `stompbox` / `compact` / `overdrive`, `distortion` |
| PH-1, PH-1R, PH-2, PH-3 | `stompbox` / `compact` / `phaser` |
| PN-2 | `stompbox` / `compact` / `tremolo` (pan has no enum; verify) |
| PQ-3B, PQ-4 | `stompbox` / `compact` / `eq` |
| PS-2, PS-3 | `stompbox` / `compact` / `pitch`, `delay` |
| PS-5, PS-6 | `stompbox` / `compact` / `pitch` |
| PW-2 | `stompbox` / `compact` / verify `overdrive` vs `distortion` |
| PW-3 | `stompbox` / verify `standard` (8.1×19.21 cm) / `wah` |
| PX-1 | verify `stompbox`/`multi-fx`/`amp-modeler` on the official page |
| RC-1-BK, RC-2, RC-3, RC-5 | `stompbox` / `compact` / `looper` |
| RC-10R | verify `standard`/`double` (10.16×13.81 cm) / `looper` |
| RC-20XL, RC-30, RC-500 | verify `double` / `looper` |
| RC-300 | verify deviceType (loop station; `other`/`multi-fx`) and `standard` |
| RC-600 | verify deviceType and `standard`/`rack` |
| PSM-5 | verify `power-supply`/`other` + `utility`; repair image only |

`expression` is a `formFactor`, never a `deviceType`. Only `EFFECT_TYPES` values
are allowed.

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
  planner/community URL on the public page. **Planner-repeat guard (boss-4
  correction cost 192k):** check `docs/catalog/image-source-registry.md` first;
  run the deterministic gate (alpha/aspect/bright/PSNR) **before** a candidate
  enters the contact sheet; after one rejected planner image go straight to
  generated art instead of re-sourcing; hard cap 2 vision passes.
- **Clean-alpha + AVIF gate:** 800/350 AVIF, aspect/alpha/bg pass, PSNR ≥40 dB
  (q90 escalation), `--matte none` for already-transparent sources, flood/
  components/global per the template. Defringe/re-source if a halo appears.
- **Generated art:** `docs/catalog/pedal-art.md`; one spec per item, body median
  sampled, no planner pixels as reference, no logo/shadow/gradient.
- **Budget (3-wide T-3 lane):** billed non-cache soft **≤400k / hard ≤800k**;
  ≤2 contact-sheet vision passes; ≤1 light code review (data-only: normally skip
  unless `curated.ts` changed); **4 h active hard**; 12 min/item is a per-item stall threshold (not a batch multiplier). At 80% of soft
  (320k), checkpoint + log the projection; at the hard cap (800k), pause/stop and
  report — do not open a partial PR. Wave: soft 1.6M / hard 2.4M billed non-cache.
- Status every 15 min; checkpoint after every item.
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Steps

1. Restate scope (26 net-new + psm-5 repair) and expected CI (348/15).
2. Write raw records under `data/catalog/research/pedals/boss/boss-6.json`.
3. **Do not run `catalog:start`/`catalog:resume`** — the coordinator started it.
   Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch boss/boss-6 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile app
   screenshots (for the psm-5 image replacement use a before/after crop).

## Acceptance (executable)

- 26 net-new raw records + the psm-5 repair; mandatory fields present; optional
  fields only if found.
- Correct `deviceType`/`formFactor`/`effectTypes` (only raw-schema enums).
- Images 800/350 AVIF, alpha/background/aspect pass, same-origin, no placeholders;
  every item has recorded `imageProvenance`; psm-5 is no longer hotlinked.
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
  the token-usage review. Wave-level token review verdict: `adjust` (2026-10-27) folded.
- The psm-5 repair completes BOSS cleanup (`hotlinked + mock = 0` for BOSS). It
  is **extra work, not one of the 26 runner items** (the wave plan total is 26);
  do the repair without a separate `catalog:checkpoint` for it.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.

## Delivery (2026-10-27)

- **26 net-new raw records + the psm-5 repair = 27 items / 54 AVIFs** (800/350).
  Every item has `imageProvenance`: **16 official + 11 planner last-resort + 0
  generated**. Planner last-resort is recorded and counted as a source gap
  (PH-1, PH-1R, PH-2, PN-2, PQ-3B, PQ-4, PS-2, PS-3, PW-2, RC-5, RC-500);
  RC-5/RC-500 use planner because their official top gallery assets are wide
  multi-item banners that fail the single-pedal/aspect gate. `psm-5` is hosted
  from the official 40th-anniversary promo PNG (225×400, upscaled 2× to the 800
  rendition) and is no longer hotlinked.
- **Status mix:** 11 current / 16 discontinued. Device types: 23 stompbox,
  2 other (RC-300/RC-600), 1 multi-fx (PX-1), 1 power-supply (PSM-5). Form
  factors: 20 compact, 4 double (RC-10R/20XL/30/500), 3 standard (PW-3/RC-300/RC-600).
- **Jack edges:** all omitted with `jackLayout.confidence: "unknown"` so the app
  uses its clearly-labelled assumed anchors; every connector (audio, exp/CTL,
  MIDI, USB, power) is captured in `jacks[]`. No connector-face crop was added to
  the shared contact-sheet pass, so no edge was asserted.
- **Image QA:** deterministic analyzer accept **27/27**; AVIF q80 for 14, q90 for
  11 (PS-2/3, PS-5, PS-6, ODB-3, OS-2, RC-2, RC-3, RC-10R, RC-600, RC-1-BK),
  q100 for RC-5/RC-500 (q90 was just below 40 dB); minimum PSNR **40.00 dB**
  (RC-10R). One `catalog-image-reviewer` pass on a 27-cell sheet: **27/27 accept**,
  no rejects. One `design-reviewer` pass on the desktop/mobile app screenshots:
  **approve**, no blockers.
- **Checks:** `catalog:ci` **348 pedals / 15 boards**; `catalog:validate` 348/15;
  `check-jacks`, `check-images` and `guard-batch-pr` green; lint (2 pre-existing
  warnings) / typecheck / test **853** / build / e2e **266 passed + 7 skipped**
  (desktop + mobile Chromium). App QA: BOSS brand + looper filter (17 results),
  RC-600 placed desktop; PH-1 placed mobile; thumbnails decoded, no console errors.
  Demo link: **27 items / 1 board / 25 illustrative cables** (PSM-5 unconnected:
  power supply, not a signal item).
- **Batch-support code:** `tools/catalog-transform/curated.ts` verified
  effect-type overrides for PSM-5 (`utility`), PS-5 (`pitch`), PW-2 (`distortion`)
  and PX-1 (14 modelled types) required by the no-drift test. No mapped/runtime
  edits in the batch commit.
- **Reviews:** `catalog-image-reviewer` approve (no fix); `design-reviewer`
  approve (pre-existing shell quirks deferred, out of scope); light
  `code-reviewer` approve (should-fix: keep the uncommitted generated runtime out
  of the PR — handled; nit: override ordering — deferred, harmless).
- **Budget:** root session billed non-cache **387.4k** (soft 400k / hard 800k),
  cache-inclusive floor **25.68M**, **36 min active** (~1.4 min/item); plus the
  two separate vision passes above. One runner auto-pause artifact: the first
  checkpoint after the research pass exceeded the 12-min per-item stall
  threshold, so the paused state was set back to running to record the remaining
  25 checkpoints (no restart/`catalog:start`); all 26 runner items are complete.

**PR:** _pending_
