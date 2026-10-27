# P5-03: BOSS — legacy image repair batch (31)

**Phase:** P5 · **Status:** in review — PR #57 (wave `boss-wave-3`, T-2) · **Model:** build-strong

> The coordinator already ran `catalog:start` for `boss/boss-legacy-repair`
> (total 31). Do **not** run `catalog:start` again. Checkpoint inline after every
> item, finish with `catalog:finish`. This is the hard half of T-2.

## Goal

Repair the **31 existing BOSS items** that still carry a `legacy` /
`pending-replacement` image, without re-researching their facts and without
keeping any old planner asset. Replace both AVIF renditions and update the
existing raw records in place. One PR; no merge.

## Scope (exact 31)

`boss-ac-2-acoustic-simulator`, `boss-bf-2b-bass-flanger`,
`boss-ce-1-chorus-ensemble`, `boss-ce-2-chorus`, `boss-ce-2b-bass-chorus`,
`boss-ce-3-chorus`, `boss-cs-2-compression-sustainer`, `boss-dc-2-dimension-c`,
`boss-dc-3-digital-dimension`, `boss-dd-2-digital-delay`,
`boss-dd-5-digital-delay`, `boss-df-2-super-feedbacker-distortion`,
`boss-dm-2-delay`, `boss-dm-3-delay`, `boss-ds-1-4a-anniversary-distortion`,
`boss-ds-1-wh-distortion`, `boss-dsd-2-digital-sampler-delay`,
`boss-dsd-3-digital-sampler-delay`, `boss-eh-2-enhancer`,
`boss-es-5-effects-switching-system`, `boss-es-8-effects-switching-system`,
`boss-ev-1-wl-wireless-midi-expression-pedal`, `boss-ev-30-dual-expression-pedal`,
`boss-ev-5-expression-pedal`, `boss-fs-5l-foot-switch`, `boss-fs-5u-foot-switch`,
`boss-ft-2-dynamic-filter`, `boss-fv-100-guitar-volume`,
`boss-fv-500-volume-pedal`, `boss-fz-2-hyper-fuzz`, `boss-fz-3-fuzz`.

Expected `catalog:ci` on this branch: **270 pedals / 15 boards** (no new items;
31 images replaced). Final merged count is unchanged by this PR.

## Where these records live (do not duplicate them)

All 31 already have raw records in the earlier BOSS batches:

- `data/catalog/research/pedals/boss/boss-1.json`, `boss-2.json`, `boss-3.json`.

**Do not create a new `boss/legacy-repair.json` raw batch** — duplicate ids are
rejected by the build. **`catalog:promote-legacy` does not apply here** (it
refuses ids already present in a raw batch). Instead, update the existing records
in place (facts unchanged; image fields only) and replace the two AVIFs. Editing
these three same-brand raw files is the only cross-batch edit allowed in this
task; do not touch any other brand or feature code.

## Image source rule for this set (specific exception)

The 31 are the **legacy repair set**: repair them to **official → authorized
retailer → user/community (recorded) → generated flat art** (our own art, via
`docs/catalog/pedal-art.md`). **Do not use Pedalplayground/planner for these 31**
— the old planner/legacy asset must not survive, and T-1a names this set as the
exception. The general planner last-resort source is for normal gaps, not this
repair.

For each item:

1. **Official BOSS first.** Product gallery `_top_gal`/`_gal`/`_main_gal`, or the
   hi-res support zip `F`/`T` top face. ES-5/ES-8 already have an official top
   face but the earlier matte left a light-grey card/shadow — retry with a
   careful `--matte components`/crop/defringe; if still unclean, use generated art.
2. **Authorized retailer** (e.g. Cream City, Andertons, Sweetwater) if it has a
   clean top-down; record the URL.
3. **User/community** (Reverb/eBay seller photo) with the exact URL recorded;
   same clean-alpha gate. No bulk scraping; search endpoints may 403/429.
4. **Generated flat art** only if none of the above passes:
   `tools/asset-pipeline/pedal-art/specs/<id>.json` + `asset:pedal-art`; sample
   the body median from an official/retailer/community reference (never planner);
   `imageProvenance { kind: "own", status: "chosen", note, referenceUrl }`.
5. If an official/retailer/community image is shipped:
   `imageProvenance { kind: "official"|"retailer"|"community", sourceUrl, status: "chosen" }`.

Update the raw record's `imageProvenance` + `sources` (add the image source URL) +
`imageCandidates` (accepts/rejects/reasons). Keep every existing fact. If a
source also re-confirms dimensions/jacks, you may keep them; do not re-research
optional fields.

## Read first (context pack)

- `docs/tasks/P5-03-pilot-parallel-backfill.md` (execution, QA, controls)
- `docs/catalog/raw-research-record.md` + `src/catalog/rawSchema.ts` (contract)
- `docs/decisions/003-catalog-data.md` + `docs/catalog/image-source-registry.md`
- `docs/catalog/pedal-art.md` (generated-art SOP; style is frozen)
- `docs/tasks/P5-03-boss-image-provenance-repair.md` (why these 31 are pending)

Read only the sections the task file points to; do not read whole docs.

## Constraints

- **PR contents:** the three updated raw batch files + the replaced 800/350 AVIFs
  + this task file + any generated-art spec files. **No mapped/runtime edits**
  (`data/catalog/{pedals,boards}/**`, `src/catalog/data/**`), no ledger edits
  (`data/catalog/asset-ledger.json`), no feature code, no other brands.
- **Capture every connector with its position**; only audio I/O is a cable anchor.
  Jack edges unchanged from the existing records unless an official source in this
  repair actually shows the face; do not infer. `pnpm catalog:check-jacks` must be
  green.
- **Clean-alpha gate:** crisp alpha, no white/black/any-colour halo, fringe or
  jagged edge; prefer an already-clean transparent PNG and `--matte none` (never
  re-key a transparent source); for photos use flood/components/global as
  appropriate. **AVIF:** 800/350, q80 then PSNR ≥40 dB (q90 escalation), or keep
  PNG only if the AVIF gate fails.
- **Generated art:** one spec per item, deterministic `asset:pedal-art`; analyzer
  aspect/alpha/bright pass; 350 LOD is automatic; mark `imageFormat: "avif"`.
- **Budget:** billed non-cache soft **≤400k / hard ≤800k**; ≤2 contact-sheet
  vision passes (generated art + sourced photos can share the sheet; a second
  sheet is allowed inside pass 1 for 31 items); ≤1 light code review (skip if
  data/assets only); **4 h active hard**; 12 min/item first-8 heuristic.
- **Split trigger (owner rule):** after the **first 8 items**, if the average
  exceeds **~6 min/item** or the work needs a **third** contact sheet, stop
  cleanly at **item 16** (commit local work, no PR), report tokens/minutes, and
  the coordinator will split the remaining 15 into a follow-up. Do not push on
  past the 4 h cap.
- At 80% soft, checkpoint and log the projection; at hard, pause/stop and report.
- Status every 15 min; checkpoint after every item.
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Steps

1. Restate scope (31) and expected CI (270/15, no count change).
2. Locate each of the 31 records in boss-1/2/3; note the current image/provenance.
3. For each item, source the best image per the hierarchy; record candidates and
   reject reasons.
4. Process: analyze → process → AVIF 800/350 → PSNR (q90 if needed) → replace the
   existing assets; generate art only when no usable source exists.
5. Update the three raw files' `imageProvenance`/`sources`/`imageCandidates`; keep
   facts unchanged.
6. Contact sheet(s) for the shipped images (10–30 per sheet) + one vision pass;
   a second pass only for material fixes.
7. `pnpm catalog:check-images`, `pnpm catalog:check-jacks`, `pnpm catalog:ci`,
   `pnpm catalog:validate`, `pnpm catalog:guard-batch-pr`.
8. App QA (picker + placement, desktop + mobile Chromium); `pnpm lint &&
   pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
9. Demo link: `pnpm catalog:demo-link --batch boss/boss-1` (and boss-2/boss-3 if
   the helper supports only one batch, include all 31 across the three links or
   use a scene built from all 31 — report the counts). The PR must show **31
   repaired items**.
10. `pnpm catalog:finish`; open exactly one PR (no merge) with per-item
    source/provenance, accept/reject counts, the 31/31 status, tokens/minutes,
    and the review-round digest.

## Acceptance (executable)

- **31/31 repaired**: no `legacy`/`pending-replacement` imageProvenance remains
  for these ids; no old planner/legacy asset is kept.
- Every item has a recorded source (`official`/`retailer`/`community`/`own`) with
  the URL or reference; generated art has a spec + reference note.
- 62 AVIF renditions replaced (31 × 800/350); alpha/aspect/PSNR gates pass.
- Raw facts unchanged (no re-research); only image fields updated.
- `catalog:check-images` green; `catalog:check-jacks` green; `catalog:validate`
  green; `catalog:guard-batch-pr` green; PR contains no mapped/runtime or ledger
  edits.
- Playwright picker/place, image load, no console errors (desktop + mobile).
- Contact sheet + coverage/reject report in the PR.
- Billed tokens + minutes/item recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict: `adjust` — the
  no-duplicate raw rule, 4 h hard cap, first-8 split trigger and the PR-cap check
  are folded here.
- The 1 BOSS hotlinked seed (`boss-psm-5-power-supply-master-switch`) is **not**
  one of the 31 and is out of scope; it is cleared in T-7/T-3.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.
