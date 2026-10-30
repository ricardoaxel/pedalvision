# P5-03: BOSS — pedals batch 4

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** in review — PR #58 (wave `boss-wave-3`, T-2 calibration; image correction 2026-10-27) · **Model:** build-strong

> The coordinator already ran `catalog:start` for `boss/boss-4` (total 26). Do
> **not** run `catalog:start` again. Checkpoint inline after every item, finish
> with `catalog:finish`. This is also the **T-2 calibration batch** (record billed
> non-cache tokens and minutes per item).

## Goal

Research and deliver the fourth BOSS catalog batch (26 net-new raw records +
hosted AVIF assets) for `boss/boss-4`, then open exactly one PR. BOSS inventory
slice **78–103** (0-based, alphabetical id order). All 26 are net-new; none
replace a seed/legacy item.

## Scope (exact 26)

`boss-ga-fc-foot-controller`, `boss-ge-6-graphic-equalizer`,
`boss-ge-7-graphic-equalizer`, `boss-geb-7-bass-equalizer`,
`boss-gigmaster-5`, `boss-gigmaster-8`, `boss-gm-800-guitar-synthesizer`,
`boss-gp-10-guitar-processor`, `boss-gp-20-amp-factory`,
`boss-gt-1-guitar-effects-processor`, `boss-gt-1000-guitar-effects-processor`,
`boss-gt-1000core-guitar-effects-processor`, `boss-gt-8-guitar-effects-processor`,
`boss-gx-1-guitar-effects-processor`, `boss-gx-10-guitar-effects-processor`,
`boss-gx-100-guitar-effects-processor`, `boss-gx-1b-bass-effects-processor`,
`boss-hf-2-hi-band-flanger`, `boss-hm-2-heavy-metal`,
`boss-hm-2w-heavy-metal-waza-craft`, `boss-ir-2-amp-cabinet`,
`boss-ir-200-amp-ir-cabinet`, `boss-jb-2-angry-driver`, `boss-lm-2-limiter`,
`boss-lmb-3-bass-limiter-enhancer`, `boss-ls-2-line-selector`.

Expected `catalog:ci` on this branch: **296 pedals / 15 boards** (main 270/15 +
26). Final after boss-4 and boss-5 merge: 322/15.

## Non-stompbox device types

Most of this batch is not a compact stompbox. Verify each unit against its
official BOSS page; never invent a field. Use the raw-schema enums only.

| Items | Guidance (verify) |
| --- | --- |
| GA-FC | `controller` / `standard` (or `other` if the official unit is larger) / `controller` |
| GE-6, GE-7, GEB-7 | `stompbox` / `compact` / `eq` |
| Gigmaster 5/8 | **Verify the official name** — the inventory says "Gigmaster"; BOSS may list these as **Gigcaster 5/8** streaming mixers. Use the official name, `interface` (or `other`), `desktop`, `mixer`/`utility`. Keep the inventory id. |
| GM-800 | `other` (synth module) / `desktop` (or `rack` if the official unit is rack) / `synth` |
| GP-10, GP-20, GT-8, GX-1 | `multi-fx` / `standard` or `desktop` per official form factor / `amp-modeler` (+ relevant effects) |
| GT-1, GT-1000, GT-1000CORE, GX-10, GX-100, GX-1B | `multi-fx` / `standard` or `desktop` / `amp-modeler` (+ relevant effects) |
| IR-2 | `stompbox` / `compact` / `cab-sim`, `amp-modeler` |
| IR-200 | `multi-fx` or `other` / `desktop` / `amp-modeler`, `cab-sim` |
| HF-2 | `stompbox` / `compact` / `flanger` |
| HM-2, HM-2w | `stompbox` / `compact` / `distortion` |
| JB-2 | `stompbox` / `compact` / `overdrive`, `distortion` |
| LM-2 | `stompbox` / `compact` / `compressor` (limiter) |
| LMB-3 | `stompbox` / `compact` / `compressor`, `utility` |
| LS-2 | `stompbox` / `compact` / `utility` (line selector; `ab-box` if it fits) |

`expression` is a `formFactor`, never a `deviceType`. Only `EFFECT_TYPES`
values are allowed.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)
- `docs/catalog/image-source-registry.md` + `docs/catalog/pedal-art.md`
- `docs/catalog-backfill.md` §Runbook (only if the task points there)

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and
  an uncommitted app-workspace runtime** for Playwright; the post-merge build
  commits mapped/runtime. The only allowed batch-support code file is
  `tools/catalog-transform/curated.ts`, and only when the no-drift test actually
  requires a verified override; do not add it preemptively. No other `tools/`
  edits. Generated pedal-art specs under
  `tools/asset-pipeline/pedal-art/specs/` are allowed batch support when used.
- **Capture every connector with its position**; only audio I/O (`in`/`out`/
  `send`/`return`) is a cable anchor today.
- **Jack edges require a verified source** (official rear/top photo, support page
  or manual diagram, including scanned/image-only PDFs). Text-layer first; else
  one connector-strip crop inside the existing contact-sheet/vision pass. Omit
  the edge + `confidence: "unknown"` with a one-line reason if no official source
  shows the face. Never infer from a sibling model or form factor. Run
  `pnpm catalog:check-jacks`.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens. For MIDI, include channel(s) + implementation-chart URL
  when the source already provides them.
- **Image policy (T-1a):** official BOSS product gallery/support → authorized
  retailer → user/community (recorded URL) → **planner/Pedalplayground last
  resort (recorded + quality-gated)** → generated flat art only when none exists.
  Record `imageProvenance { kind, sourceUrl/referenceUrl, status, note }` for
  every item; never put a planner/community URL on the public page. Planner
  last-resort is a counted source gap. Consult and append
  `docs/catalog/image-source-registry.md` (the coordinator owns that file — report
  additions in the PR, do not edit it from this worktree unless the coordinator
  asks).
- **Clean-alpha gate + AVIF quality gate:** 800/350 AVIF, aspect/alpha/bg pass,
  PSNR ≥40 dB (q90 escalation), `--matte none` for already-transparent sources,
  `--matte flood/components/global` per the template. Defringe/re-source if a
  halo appears.
- **Generated art:** use `docs/catalog/pedal-art.md`; one spec per item, sample
  the body median, no planner pixels as reference, no logo/shadow/gradient.
- **Budget (T-2 calibration):** billed non-cache soft **≤400k / hard ≤800k**;
  ≤2 contact-sheet vision passes; ≤1 light code review (data-only: normally skip
  unless `curated.ts` changed); **4 h active hard**; **12 min/item** is the
  first-8 heuristic. At 80% of soft, checkpoint and log the projection; at the
  hard cap, pause/stop and report — do not open a partial PR. This batch records
  billed tokens + minutes/item for the wave calibration.
- Status every 15 min; checkpoint after every item.
- **If a cap/limit is hit, stop and report; do not open the PR.**
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Steps

1. Restate scope (26) and expected CI (296/15).
2. Write raw records under `data/catalog/research/pedals/boss/boss-4.json`.
3. **Do not run `catalog:start`.** Checkpoint inline after every item with
   done/accepted/rejected/tokens.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR
   (q90 if <40 dB) → contact sheet (10–30 cells) → `asset:qa`; keep accepts,
   rejects and reasons in the raw file.
4a. Connector-face check (jack edges) inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch boss/boss-4 --origin <PR-preview-origin>`.
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
- Billed tokens + minutes/item recorded (calibration); one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict: `adjust` (mid-batch
  checkpoint/re-project, 4 h hard, PR-cap check, repair no-duplicate rule folded).
- The 1 BOSS hotlinked seed (`boss-psm-5-power-supply-master-switch`, inventory
  index 143) is **out of scope** for this batch; it is cleared in T-7/T-3.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.

## Image correction (owner-directed, 2026-10-27)

Policy: planner is a **recorded last-resort shipped source above generated art**;
generated art is last. Replaced 5 images with the mapped Pedalplayground 800 PNGs:

| id | before | after |
| --- | --- | --- |
| `boss-ge-6-graphic-equalizer` | generated | planner last-resort |
| `boss-hf-2-hi-band-flanger` | generated | planner last-resort |
| `boss-hm-2-heavy-metal` | generated | planner last-resort |
| `boss-lm-2-limiter` | generated | planner last-resort |
| `boss-jb-2-angry-driver` | official gallery card/caption | planner last-resort |

- `--matte none` (transparent source), no body crop; AVIF q80 PSNR **40.62–43.96 dB**;
  analyzer **accept**, `backgroundCard.suspected=false` for all 5.
- Raw records: `kind: planner`, `status: last-resort`, recorded `sourceUrl`; the
  last-resort gaps are counted (not gap-closed). Facts unchanged.
- Deleted the 4 now-unused generated specs (JB-2 had no spec).
- Gate fixes: `check-images` now accepts the planner's GitHub-raw mirror (same
  rule already used by `catalog:license`), and the `backgroundCard` heuristic is
  cutout-aware so bright-bodied transparent cutouts are not false-flagged.
- Final source mix: **21 official + 1 community + 5 planner last-resort + 0 generated**;
  52 AVIFs.
