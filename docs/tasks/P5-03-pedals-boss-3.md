# P5-03: BOSS — pedals batch 3

**Phase:** P5 · **Status:** in review (wave `boss-wave-2`) · **Model:** build-strong

> The coordinator already ran `catalog:start` for `boss/boss-3`. Do **not** run
> `catalog:start` again. Checkpoint inline after every item, finish with
> `catalog:finish`. Full research/QA/gates/PR.

## Goal

Research and deliver the third BOSS catalog batch (26 raw records + hosted AVIF assets) for `boss/boss-3`, then open exactly one PR for this batch. Slot 3 of the split BOSS backfill (slot 1 = `boss/boss-1` PR #46, slot 2 = `boss/boss-2`).

## Scope

26 BOSS inventory items, all net-new (none replace a seed item):

`boss-dsd-3-digital-sampler-delay`, `boss-eh-2-enhancer`, `boss-eq-20-advanced-eq`, `boss-eq-200-graphic-equalizer`, `boss-es-5-effects-switching-system`, `boss-es-8-effects-switching-system`, `boss-ev-1-wl-wireless-midi-expression-pedal`, `boss-ev-30-dual-expression-pedal`, `boss-ev-5-expression-pedal`, `boss-fb-2-feedbacker-booster`, `boss-fbm-1-59-fender-bassman`, `boss-fdr-1-fender-65-deluxe-reverb`, `boss-frv-1-63-fender-reverb`, `boss-fs-1-wl-wireless-footswitch`, `boss-fs-5l-foot-switch`, `boss-fs-5u-foot-switch`, `boss-fs-6-dual-foot-switch`, `boss-fs-7-dual-foot-switch`, `boss-ft-2-dynamic-filter`, `boss-fv-100-guitar-volume`, `boss-fv-30-foot-volume`, `boss-fv-500-volume-pedal`, `boss-fz-1w-fuzz`, `boss-fz-2-hyper-fuzz`, `boss-fz-3-fuzz`, `boss-fz-5-fuzz`.

Expected `catalog:ci` count: **261 pedals / 15 boards** (main is 235/15).

### Non-stompbox device types

Several items are not stompboxes. Keep `category: "pedal"` but set the correct
`deviceType` and `formFactor` from the raw schema enums:

| Items | deviceType | formFactor | effectTypes (allowed vocabulary only) |
| --- | --- | --- | --- |
| ES-5, ES-8 | `switcher` | `standard` / `rack` per unit | `controller`, `utility` |
| EV-1-WL, EV-30, EV-5 | `controller` | `expression` | `controller` |
| FS-1-WL, FS-5L, FS-5U, FS-6, FS-7 | `controller` | `standard` / `other` | `controller` |
| FV-100, FV-30, FV-500 | `controller` | `expression` | `utility` (volume is not an effect type) |
| EH-2 | `stompbox` | `compact` | `utility` (enhancer) |
| EQ-20, EQ-200 | `stompbox` | `standard` / `double` | `eq` |
| FB-2 | `stompbox` | `compact` | `boost` |
| FBM-1, FDR-1 | `stompbox` | `standard` | `amp-modeler` (FDR-1 may also be `reverb`) |
| FRV-1 | `stompbox` | `compact` | `reverb` |
| FT-2 | `stompbox` | `compact` | `filter` |
| DSD-3 | `stompbox` | `compact` | `delay` |
| FZ-1W, FZ-2, FZ-3, FZ-5 | `stompbox` | `compact` | `fuzz` |

`expression` is **not** a valid `deviceType` (it is a `formFactor`); use
`controller`. Never invent an effect type — only `EFFECT_TYPES` values.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` (policy/provenance)

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **Raw records + assets** in the PR; CI runs `catalog:build` to a temp dir **and an uncommitted app-workspace runtime** for Playwright; the post-merge build commits mapped/runtime. The only allowed batch-support code file is `tools/catalog-transform/curated.ts`, and only when the no-drift test actually requires a verified override; do not add it preemptively. No other `tools/` edits.
- **Capture every connector with its position** (audio I/O, aux, expression/CV, MIDI, USB, power); only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor today. Other connectors are future-feature data.
- **Jack edges require a verified source:** set `edge` only when an official rear/top photo, support page or manual diagram — **including image-only/scanned PDFs** — shows the connector face; record `jackLayout: { source, confidence: "verified" }`. **Text-layer first:** grep the manual; only if the face is not named, render the panel/connection page and judge a connector-strip crop in the existing contact-sheet/vision step (never per item, never a 3rd vision pass). Never infer an edge from form factor or a sibling model. The ES-5/ES-8 and EV/FV/FS units are **not** automatically side-jack — verify their actual connector face. If no official source shows the face, omit the edge, set `confidence: "unknown"` and record why. Run `pnpm catalog:check-jacks`; it fails an unverified edge.
- **Optional fields only if found in the same base research** — no extra searches/tabs/tokens for serials, videos, artist, price, jacks, MIDI/USB, board extras. For MIDI, include **MIDI channel(s)** and the **MIDI implementation chart URL** when the source already provides them.
- **Images:** official BOSS product pages/manuals first. BOSS `_main`/`_top_gal` images are 3/4-perspective and fail the analyzer's perspective gate; authorized-retailer listings reuse the same BOSS press assets. Use the owner-approved Pedalplayground flat cutouts only as the documented last resort (`public-asset` tag + provenance note). Process with `--matte none`, AVIF 800/350, PSNR ≥ 40 dB (q90 escalation), one contact sheet per 10–30 flagged images, max 2 vision passes total.
- No edits to feature code, generated mapped/runtime catalog, or other brands' batches.
- **Budget:** soft ≤400k / hard ≤800k tokens, ≤2 contact-sheet vision passes, ≤1 light code-review pass (only if curated/tooling changes), 4 h active, 12 min/item. Stop and report if a cap is hit; do not open a PR.

## Steps

1. Restate the exact batch scope and expected item count (26; expected CI 261/15).
2. Write raw records under `data/catalog/research/pedals/boss/boss-3.json`.
3. **Do not run `catalog:start`** — the coordinator already started this batch. Checkpoint **inline after every item** with done/accepted/rejected/tokens.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR (q90 if <40 dB) → contact sheet; record `asset:qa`.
4a. **Connector-face check (jack edges):** grep the official manual text for the panel/jacks; for items still unknown, render the panel/connection page (`pdftoppm`) and add connector-strip crops to the existing contact sheet — this stays inside the 2-pass cap. If the face is not visible, omit the edge with `confidence: "unknown"`; do not loop or infer from form factor.
5. Run `catalog:check-jacks`, `catalog:ci`, `catalog:validate`, `catalog:guard-batch-pr`.
6. App QA (picker/place, desktop + mobile Chromium), `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Build the demo link: `catalog:demo-link --batch boss/boss-3 --origin https://p5-03-pedals-boss-3.pedalvision.pages.dev`.
8. `catalog:finish`; open exactly one PR (no merge) with coverage, accept/reject counts, demo link and review digest. This session hands off with the PR.

## Acceptance (executable)

- 26 raw records; mandatory fields present; optional fields only if found.
- Correct `deviceType`/`formFactor` for switchers, expression/volume pedals, footswitches and wireless units; only `EFFECT_TYPES` values.
- Images: 800/350 AVIF, alpha/background/aspect pass, same-origin; no placeholders.
- `catalog:check-jacks` green; `catalog:validate` green; `catalog:guard-batch-pr` green; PR contains no mapped/runtime edits.
- Playwright picker search/brand/effect, image load, canvas placement, no console errors (desktop + mobile).
- Contact sheet (10–30 images) + coverage/reject report in the PR.
- Demo share link with every batch item on one board + illustrative cables; verify counts.
- Per-batch token/time budget recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from the token-usage review.
- If this batch uncovers a process/rule gap, do not edit the rules in this PR; propose the change + token review to the owner first.

## Results (data-reuse session, 2026-10-26)

The 26 verified raw records and the 800/350 renditions were produced by the earlier stopped worktree; this session re-checked them, fixed two image-quality defects, ran the gates, app QA and opened the single PR. No facts were re-researched.

- **Records:** 26/26 validate; `catalog:check-jacks` green. **12 verified** jack layouts (audio/power face confirmed in official manuals/photos); **14 `unknown`** — edges omitted with a one-line reason, app falls back to assumed anchors.
- **Counts:** `catalog:ci` / `catalog:validate` **261 pedals / 15 boards** (main 235/15 + 26 net-new). Caps: pedals 158 items / 334 files / **18.0 MB**; boards 15 / 30 files / 2.0 MB.
- **Assets:** **52 AVIF** (26 × 800 + 26 × 350). No placeholders.
- **Image defects fixed (vision pass 1 → pass 2):** pass 1 reported **24 accept / 2 reject** — `boss-fv-100-guitar-volume` (grey/white residual + shadow) and `boss-fz-5-fuzz` (drop shadow). Both were re-processed from the clean transparent planner variant (`--matte none --body-crop`), replacing the shadowed download. FV-100 now also clears the AVIF gate (**PSNR 41.59 dB**) and ships as AVIF instead of a PNG fallback; FZ-5 **PSNR 42.28 dB**. Pass 2 (final contact sheet) → **26 accept / 0 flag / 0 reject**. Two vision passes total, within the cap.
- **Source:** all 26 are Pedalplayground flat cutouts (documented last resort after official/authorized top-down art was exhausted), tagged `public-asset` with per-item provenance. Sources are 597–1149 px and upscaled to the 800 long edge by the pipeline (same convention as the other planner-derived batches).
- **App QA (desktop + mobile Chromium):** 2/2 — FZ-5 picker search + BOSS brand + Fuzz chip, AVIF thumbnail, ES-8 and EV-30 placement, `data-item-images="loaded:3 failed:0"`, no console/page errors.
- **Checks:** `pnpm lint` (3 pre-existing warnings, no fixes), `pnpm typecheck` green, `pnpm test` **721 passed**, `pnpm build` green, `pnpm e2e` **258 passed + 7 skipped** (with the uncommitted batch runtime).
- **Demo link:** 1 custom board (100 × 90 cm) / **26 items** / **22 cables** / **3 unconnected** (`EV-1-WL`, `EV-30`, `FS-7` expose no audio in/out anchor — controllers/footswitches). Illustrative cables only.
- **Batch-support code:** `tools/catalog-transform/curated.ts` only — verified effect types for EH-2, ES-5/8, EV-1-WL/EV-30/EV-5, FBM-1, FDR-1, FV-100/30/500. No feature code, runtime or mapped files.
- **Budget:** cumulative ≈460k tokens of the 800k hard cap (soft 400k exceeded before this session; calibration note for the wave); ~45 min wall clock this session; 2 contact-sheet vision passes; no code-review pass (data/assets + one verified curated file; the 721-test suite is the re-check).
