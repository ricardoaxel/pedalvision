# P5-03: BOSS — pedals batch 8

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** todo — T-3 wave 4 (3-wide) · **Model:** build-strong

> The `boss-wave-4` coordinator already ran `catalog:start` for `boss/boss-8`.
> **Do not run `catalog:start`/`catalog:resume`.** Checkpoint inline after every
> item and finish with `pnpm catalog:finish --batch boss/boss-8`.

## Goal

Research and deliver the eighth and final BOSS catalog batch: **25 net-new raw
records + hosted AVIF assets**, then open exactly one PR. BOSS inventory slice
**182–206** (0-based, alphabetical id order). This completes BOSS (208 items).

## Scope (exact 25)

`boss-sy-300-guitar-synthesizer`, `boss-syb-3-bass-synthesizer`,
`boss-syb-5-bass-synthesizer`, `boss-tb-2w-tone-bender-waza-craft`,
`boss-te-2-tera-echo`, `boss-tr-2-tremolo`, `boss-tu-12ex-chromatic-tuner`,
`boss-tu-12h-chromatic-tuner`, `boss-tu-3-chromatic-tuner`,
`boss-tu-3s-chromatic-tuner`, `boss-tu-3w-chromatic-tuner-waza-craft`,
`boss-tw-1-t-wah`, `boss-vb-2-vibrato`, `boss-vb-2w-vibrato-waza-craft`,
`boss-ve-20-vocal-processor`, `boss-ve-22-vocal-performer`,
`boss-ve-500-vocal-performer`, `boss-ve-8-acoustic-singer`,
`boss-vg-800-v-guitar-processor`, `boss-vo-1-vocoder`, `boss-wl-50-wireless-system`,
`boss-wl-60-wireless-system`, `boss-wp-20g-wave-processor`,
`boss-xs-1-pitch-shifter`, `boss-xs-100-poly-shifter`.

Expected final `catalog:ci` after all of T-3 merges: **399 pedals / 15 boards**
(main 322 + 77). On this branch use the actual base + 25; state the number.

## Non-stompbox / non-compact device types

Verify each unit against its official BOSS page; never invent a field. Use the
raw-schema enums only (`RAW_DEVICE_TYPES`, `RAW_FORM_FACTORS`, `EFFECT_TYPES`).

| Items | Guidance (verify) |
| --- | --- |
| SY-300 | verify `synth`/`multi-fx` + `standard` (25.48×18.21 cm) |
| SYB-3, SYB-5 | `stompbox` / `compact` / `synth` (bass) |
| TB-2w | `stompbox` / `compact` / `fuzz` |
| TE-2 | `stompbox` / `compact` / `delay` |
| TR-2 | `stompbox` / `compact` / `tremolo` |
| TU-12EX, TU-12H | verify deviceType (`other`) + `desktop` (14.76×5.36 / 5.23 cm) / `tuner` |
| TU-3, TU-3w | `stompbox` / `compact` / `tuner` |
| TU-3s | `stompbox` / `compact`/`mini` (7.3×8.41 cm) / `tuner` |
| TW-1 | `stompbox` / `compact` / `wah` (T Wah) |
| VB-2, VB-2w | `stompbox` / `compact` / `vibrato` |
| VE-20 | verify deviceType (`multi-fx`/`vocoder`) + `double` / vocal effects |
| VE-22 | verify deviceType + `standard` (21.92×14.15 cm) |
| VE-500 | verify deviceType + `standard` / vocal effects |
| VE-8 | verify deviceType + `standard` (21.75×16.19 cm) / vocal + acoustic |
| VG-800 | verify deviceType (`amp-modeler`/`synth`/`multi-fx`) + `standard` |
| VO-1 | `stompbox` / `compact` / verify `synth`/`filter` (vocoder) |
| WL-50 | verify deviceType (`other`/`interface`) + `compact` / `utility` |
| WL-60 | verify deviceType + `standard`/`desktop` / `utility` |
| WP-20G | verify deviceType (`multi-fx`?) + `double` / effect types |
| XS-1 | `stompbox` / `compact` / `pitch` |
| XS-100 | verify `standard`/`double` (14.71×22.53 cm) / `pitch` |

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
  planner/community URL on the public page. **Resolution is not a rejection
  reason (rule PR #69):** process the highest-resolution real source to the
  800/350 master and gate the **final 800 rendition** (soft ceiling ≤2×); prefer
  it over generated art. **Planner-repeat guard (boss-4 correction cost 192k):**
  check `docs/catalog/image-source-registry.md` first; run the deterministic gate
  (alpha/aspect/bright/PSNR) on the processed output before a candidate enters
  the contact sheet; after one rejected planner image try the planner host /
  retailer before generated art; hard cap 2 vision passes (+ one owner-approved
  correction pass).
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

1. Restate scope (25) and expected CI (actual branch base + 25; final 399/15).
2. Write raw records under `data/catalog/research/pedals/boss/boss-8.json`.
3. **Do not run `catalog:start`/`catalog:resume`** — the coordinator started it.
   Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch boss/boss-8 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile app
   screenshots.

## Acceptance (executable)

- 25 raw records; mandatory fields present; optional fields only if found.
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

## Delivery (2026-10-27, corrected)

- **25 raw records / 50 AVIF pairs (800/350).** Image mix: **20 official + 5
  planner last-resort + 0 generated** (was 19 official + 6 generated). The five
  planner last-resort items are recorded source gaps: SYB-3, TW-1, VB-2,
  WP-20G, TU-12H.
- **Real-image correction:** replaced the 6 generated “Catalog Specimen” assets
  with real sources and removed their art specs. Planner-host 2× sources
  (596×1057 / 1000×896 / 1272×451) are downscaled to the 800 master; WL-50 uses
  the official 626×1050 top-down. Analyzer accept **6/6**; PSNR **42.96–46.88 dB**.
  Correction vision pass (owner-approved): **6/6 product accept** (WL-50 official
  chosen over the softer planner mirror) and **4/4 connector crops accept**.
- **WL-50 factual correction:** receiver footprint **7.2 × 12.1 cm** (official
  spec 72×121×56 mm; the earlier 2.2 cm was the transmitter depth). Power and
  jacks corrected to the receiver: INPUT/OUTPUT audio + DC IN/DC OUT power;
  the WL-T transmitter charges from its own DC IN 5 V micro-USB. The TRANSMITTER
  TRS jack is on the top face, not an edge, so it is omitted from the edge map.
- **Rule:** the resolution policy is in docs-only PR #69 (real sub-800 images
  are processed and gated on the final 800 rendition; planner remains above
  generated art).
- **Checks:** `catalog:ci` **399 pedals / 15 boards** on this branch (merged main
  374 + 25); `catalog:validate`, `check-jacks`,
  `check-images` (46 planner source gaps catalog-wide), `guard-batch-pr` **clean**
  (raw + assets + task only; evidence on `p5-03-pedals-boss-8-evidence`); lint
  (2 pre-existing warnings), typecheck green, **test 853**, build green, **e2e
  266 passed + 7 skipped**. Demo link: **25 items / 24 cables**.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict: `adjust` (2026-10-27) folded.
- This batch completes BOSS; after merge the BOSS catalog is 208 items.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.
