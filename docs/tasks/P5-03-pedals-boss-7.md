# P5-03: BOSS — pedals batch 7

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** in review — PR #65 (T-3 wave 4, 3-wide) · **Model:** build-strong

> The `boss-wave-4` coordinator already ran `catalog:start` for `boss/boss-7`.
> **Do not run `catalog:start`/`catalog:resume`.** Checkpoint inline after every
> item and finish with `pnpm catalog:finish --batch boss/boss-7`.

## Goal

Research and deliver the seventh BOSS catalog batch: **26 net-new raw records +
hosted AVIF assets**, then open exactly one PR. BOSS inventory slice **156–181**
(0-based, alphabetical id order).

## Scope (exact 26)

`boss-re-2-space-echo`, `boss-re-20-space-echo`, `boss-re-202-space-echo`,
`boss-rt-2-rotary-ensemble`, `boss-rt-20-rotary`, `boss-rv-2-digital-reverb`,
`boss-rv-200-reverb`, `boss-rv-3-digital-reverb-delay`,
`boss-rv-5-digital-reverb`, `boss-rv-500-reverb`, `boss-rv-6-reverb`,
`boss-sd-1-super-overdrive`, `boss-sd-1-4a-anniversary-super-overdrive`,
`boss-sd-1w-super-overdrive-waza-craft`, `boss-sd-2-dual-overdrive`,
`boss-sde-3-dual-digital-delay`, `boss-sde-3000d-dual-digital-delay`,
`boss-sde-3000evh-dual-digital-delay`, `boss-sg-1-slow-gear`,
`boss-sl-2-slicer`, `boss-sl-20-slicer`, `boss-sp-1-spectrum`,
`boss-st-2-power-stack`, `boss-sy-1-synthesizer`,
`boss-sy-1000-guitar-synthesizer`, `boss-sy-200-synthesizer`.

Expected `catalog:ci` on this branch: **374 pedals / 15 boards** (main 322 + 26
for boss-6 + 26 for boss-7 if boss-6 has already merged; otherwise 348). Confirm
against the branch base and state the actual number.

## Non-stompbox / non-compact device types

Verify each unit against its official BOSS page; never invent a field. Use the
raw-schema enums only (`RAW_DEVICE_TYPES`, `RAW_FORM_FACTORS`, `EFFECT_TYPES`).

| Items | Guidance (verify) |
| --- | --- |
| RE-2 | `stompbox` / `compact` / `delay`, `reverb` |
| RE-20 | `stompbox` / `double` / `delay`, `reverb` |
| RE-202 | verify `standard`/`double` (19.2×13.28 cm) / `delay`, `reverb` |
| RT-2 | `stompbox` / `compact` / `rotary` |
| RT-20 | `stompbox` / `double` / `rotary` |
| RV-2, RV-5, RV-6 | `stompbox` / `compact` / `reverb` |
| RV-3 | `stompbox` / `compact` / `reverb`, `delay` |
| RV-200 | verify `standard` (10.16×13.82 cm) / `reverb` |
| RV-500 | verify `double` / `reverb` |
| SD-1, SD-1W, SD-1-4A, SD-2 | `stompbox` / `compact` / `overdrive` |
| SDE-3 | `stompbox` / `compact` / `delay` |
| SDE-3000D, SDE-3000EVH | verify `standard`/`double` (20×13.13 cm) / `delay` |
| SG-1 | verify `envelope` vs `utility` (Slow Gear volume swell) |
| SL-2 | `stompbox` / `compact` / verify `filter` (+ `tremolo` if official) |
| SL-20 | verify `double` / `filter` |
| SP-1 | verify `eq` vs `filter` (Spectrum) |
| ST-2 | `stompbox` / `compact` / `distortion` |
| SY-1 | `stompbox` / `compact` / `synth` |
| SY-200 | verify `standard` (10.16×13.82 cm) / `synth` |
| SY-1000 | verify deviceType (`synth`/`multi-fx`) and `standard`/`rack` (34.61×24.61 cm) |

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

1. Restate scope (26) and expected CI (confirm branch base + 26).
2. Write raw records under `data/catalog/research/pedals/boss/boss-7.json`.
3. **Do not run `catalog:start`/`catalog:resume`** — the coordinator started it.
   Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch boss/boss-7 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile app
   screenshots.

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
  the token-usage review. Wave-level token review verdict: `adjust` (2026-10-27) folded.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.
