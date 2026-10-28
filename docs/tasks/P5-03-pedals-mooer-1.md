# P5-03: Mooer — pedals batch 1 (cleanup)

**Phase:** P5 · **Status:** in review — PR #71 · **Model:** build-strong

> The `cleanup-wave-1` coordinator created this worktree and wrote the 18
> existing-item raw scaffolds. The `catalog:wave` wrapper starts `mooer/mooer-1`
> (total 26) at launch. **Never run `catalog:start`/`catalog:resume`.** Checkpoint
> inline after every item and finish with
> `pnpm catalog:finish --batch mooer/mooer-1`.

## Goal

Deliver Mooer's first catalog batch: re-host and fully document the **18 existing
seed items** (**17 hotlinked + 1 mock**) plus **8 new Tier A items**, then open
exactly one PR. After this batch no Mooer item may ship a hotlinked/mock asset —
including the `mooer-018-custom-100` mock, which needs a real/recorded source or
generated flat art only as the last resort.

## Scope (exact 26)

### Existing 18 — re-host + document (raw scaffolds already written)

Current hotlinked candidate (verify/replace; record the final source):

| # | id | Name | Current image candidate |
|---|---|---|---|
| 1 | `mooer-001-gas-station` | 001 Gas Station | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/4d329d2b-cb91-4991-a752-2379362505ca.jpg |
| 2 | `mooer-002-uk-gold-900` | 002 UK Gold 900 | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/7d5932a2-9a26-4e44-989b-4fb48fadb918.jpg |
| 3 | `mooer-003-power-zone` | 003 Power Zone | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/8e1842ea-10ba-4bdc-811a-3f6526a8fa2c.jpg |
| 4 | `mooer-004-day-tripper` | 004 Day Tripper | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/3df1c85c-740f-4dd0-8494-a63ae14b14c1.jpg |
| 5 | `mooer-005-brown-sound-3` | 005 Brown Sound 3 | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/0decd9b9-3c2a-4309-8622-c9b67d045a99.jpg |
| 6 | `mooer-006-us-classic-deluxe` | 006 US Classic Deluxe | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/aea9d1fd-ed22-4e16-9eb5-cbe7c51a5923.jpg |
| 7 | `mooer-007-regal-tone` | 007 Regal Tone | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/9cc25d62-1078-4aeb-819f-13d467043c98.jpg |
| 8 | `mooer-008-cali-mk3` | 008 Cali-MK3 | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/b3bac819-7803-40eb-abb1-f0700524a0dd.jpg |
| 9 | `mooer-009-black-knight` | 009 Black Knight | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/cbd774a0-adcd-4e83-a0bb-119785133a9a.jpg |
| 10 | `mooer-010-two-stones` | 010 Two Stones | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/3316e17a-6adc-43b9-8671-831e2f73bf2c.jpg |
| 11 | `mooer-011-cali-dual` | 011 Cali-Dual | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/461f4bfd-a0da-4205-bf46-c2fe4554345a.jpg |
| 12 | `mooer-012-us-gold-100` | 012 US Gold 100 | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/a0df8434-a4c6-4607-8c7a-e526e135978d.jpg |
| 13 | `mooer-013-matchbox` | 013 Matchbox | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/99c98c78-80a3-4097-bc3b-8b43dc22d05b.jpg |
| 14 | `mooer-014-taxidea-taxus` | 014 Taxidea Taxus | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/18a1a454-3e29-4ef2-871c-8c5eae919c5d.jpg |
| 15 | `mooer-015-brown-sound` | 015 Brown Sound | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/cd5c5788-1a35-49fb-8b71-9d5eadf344de.jpg |
| 16 | `mooer-016-phoenix-digital` | 016 Phoenix Digital | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/ab05ed1d-42c2-4ef9-bd3d-50d72c4dae2e.jpg |
| 17 | `mooer-017-cali-mkiv` | 017 Cali MKIV | https://omo-oss-image1.thefastimg.com/portal-saas/new2022113010221252588/cms/image/a8344f92-6eb5-4a39-a07b-426b5201ee0a.jpg |
| 18 | `mooer-018-custom-100` | 018 Custom 100 | **mock (no image)** — start from https://www.mooeraudio.com/product/018---CUSTOM-100-216.html |

The scaffolds carry the old approximate dimensions/effect tags only. **Verify
every dimension against the official Mooer spec sheet** (unit/receiver, never an
accessory), verify the effect tags, and add power + all connectors. The Mooer
product pages and manuals are the primary source.

### New 8 (net-new)

Alphabetical Tier A order after the existing 18:

| # | id | Name |
|---|---|---|
| 19 | `mooer-019-uk-gold-plx` | 019 UK Gold PLX |
| 20 | `mooer-020-blueno` | 020 Blueno |
| 21 | `mooer-wah` | @Wah |
| 22 | `mooer-a7` | A7 |
| 23 | `mooer-acoustikar` | Acoustikar |
| 24 | `mooer-ana-echo` | Ana Echo |
| 25 | `mooer-audiofile` | Audiofile |
| 26 | `mooer-baby-bomb` | Baby Bomb |

Do not force 26: if one of the 8 new items has no verifiable official source,
record the gap, keep it out of the shipped scope, state it in the PR, and do not
invent facts. The 18 existing items are mandatory (including `mooer-018-custom-100`).

## Expected CI

Each batch branches from `main` (**399 pedals / 15 boards**). This branch adds
**8 net-new** → expected `catalog:ci` **407 pedals / 15 boards**. State the actual
number in the PR. Final after all T-4 merges: **423 pedals / 15 boards**.

## Non-stompbox / form-factor guidance (verify each; never invent)

| Items | Guidance (verify against the official page/manual) |
|---|---|
| 001–020 micro preamps | `stompbox` / `mini`; Mooer Micro footprint ~4.24×9.53 cm (verify each official spec) |
| `mooer-wah` (@Wah) | wah; verify form factor and whether it is micro or standard |
| `mooer-a7` | reverb (Ambiance); verify effect tags (`reverb` + ?) |
| `mooer-acoustikar` | acoustic simulator; verify effect tags/deviceType |
| `mooer-ana-echo` | analog delay; verify `delay` |
| `mooer-audiofile` | audio interface / utility; verify `deviceType` + `formFactor` |
| `mooer-baby-bomb` | 30 W power amp; verify `power-amp` deviceType and pedal form |
| `mooer-019-uk-gold-plx`, `020-blueno` | preamp/cab-sim micro pedals; verify |

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
- **Existing-item rule:** the 18 raw scaffolds are `legacy`/`pending-replacement`.
  For each, replace the asset with a self-hosted 800/350 AVIF and update
  `imageProvenance` to the real final source (official/retailer/community/planner
  last-resort/generated) including source dimensions + upscale factor. Never keep
  the hotlinked URL as the shipped image. `mooer-018-custom-100` is a mock: resolve
  it from an official/retailer/community source; generated flat art only if none
  exists, recorded as `own`.
- **Capture every connector with its position**; only audio I/O is a cable anchor.
- **Jack edges require a verified source** (official rear/top photo, support page,
  manual diagram, including scanned/image-only PDFs). Text-layer first; else one
  connector-strip crop inside the existing contact-sheet/vision pass. Omit the
  edge + `confidence: "unknown"` with a one-line reason if no official source
  shows the face. Never infer from a sibling model or form factor. Run
  `pnpm catalog:check-jacks`.
- **Optional fields only if found in the same base research** — no extra
  searches/tabs/tokens.
- **Image policy (T-1a, planner last-resort):** official Mooer product
  gallery/support → authorized retailer → user/community (recorded URL) →
  **planner/Pedalplayground last resort (recorded + quality-gated)** → generated
  flat art only when none exists. Record `imageProvenance` for every item; never
  put a planner/community URL on the public page. **Resolution is not a rejection
  reason (rule PR #69):** process the highest-resolution real source to the
  800/350 master and gate the **final 800 rendition** (soft ceiling ≤2×); prefer
  it over generated art. Check the source registry first; gate the processed
  output before it enters the contact sheet. Hard cap 2 vision passes.
- **Clean-alpha + AVIF gate:** 800/350 AVIF, aspect/alpha/bg pass, PSNR ≥40 dB
  (q90 escalation), `--matte none` for already-transparent sources, flood/
  components/global per the template. Defringe/re-source if a halo appears.
- **Generated art:** `docs/catalog/pedal-art.md`; one spec per item, body median
  sampled, no planner pixels as reference, no logo/shadow/gradient.
- **Budget (T-4 lane):** billed non-cache soft **≤400k / hard ≤800k**; ≤2
  contact-sheet vision passes; ≤1 light code review (data-only: normally skip
  unless `curated.ts` changed); **4 h active hard**; 12 min/item is a per-item
  stall threshold. At 80% of soft (320k), checkpoint + log the projection; at the
  hard cap (800k), pause/stop and report — do not open a partial PR. Wave: soft
  1.6M / hard 2.4M billed non-cache.
- Status every 15 min; checkpoint after every item.
- If any model/provider call fails (429/401/quota/timeout/empty), STOP and report
  the model, operation and exact error — never substitute another model.

## Wave token-review adjustments (folded 2026-10-27)

- **One vision call:** all 26 cells + connector strips in a single contact-sheet
  call. A second pass (same session) is only for rejected/fixed cells; never
  vision-judge the Playwright app screenshots.
- **Billed ledger:** report root + vision + code-review spend. Root sub-cap
  **700k**; real batch hard **800k**; wave real hard **2.4M**; combined
  `min(2.4M, 3.4M − feature spend)`. The coordinator checks this at every poll.
- **Checks:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + one
  targeted Playwright picker/placement flow (desktop + mobile) for the
  screenshots; the full `pnpm e2e` suite runs in CI.
- **No refills while 3 catalog PRs await.** After an owner merge frees a slot,
  the coordinator verifies the post-merge build and coordinates the rebase/refill.
- **`curated.ts`:** prefer a raw no-drift override; at most one verified hunk per
  batch; a shared hunk is reviewed once across the wave.

## Steps

1. Restate scope (26) and expected CI (407/15); take the **before** screenshots
   (current hotlinked/mock assets in the app, desktop + mobile) before editing data.
2. The raw file `data/catalog/research/pedals/mooer/mooer-1.json` already has the
   18 scaffolds. Add the 8 new records.
3. **Never run `catalog:start`/`catalog:resume`** — the `catalog:wave` wrapper
   starts this batch. Checkpoint inline after every item.
4. Deterministic image work: download → analyze → process AVIF 800/350 → PSNR →
   contact sheet (10–30 cells) → `asset:qa`; keep accepts/rejects/reasons.
4a. Connector-face check inside the existing sheet/pass.
5. `pnpm catalog:check-jacks`, `pnpm catalog:ci`, `pnpm catalog:validate`,
   `pnpm catalog:guard-batch-pr`.
6. App QA (picker/place + before/after, desktop + mobile Chromium), then
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; CI runs the full
   `pnpm e2e`.
7. Demo link: `pnpm catalog:demo-link --batch mooer/mooer-1 --origin <PR-preview-origin>`.
8. `pnpm catalog:finish`; open exactly one PR (no merge) with coverage,
   accept/reject counts, demo link, billed tokens + minutes/item, the review-round
   digest, and **visual evidence**: inline contact sheet plus desktop + mobile
   **before/after** screenshots of the re-hosted seed images.

## Acceptance (executable)

- 26 raw records (18 re-hosted + 8 new); mandatory fields present; optional fields
  only if found.
- Correct `deviceType`/`formFactor`/`effectTypes` (only raw-schema enums).
- Images 800/350 AVIF, alpha/background/aspect pass, same-origin, no placeholders;
  every item has recorded `imageProvenance`; **no Mooer hotlinked/mock item
  remains** (including `mooer-018-custom-100`).
- `catalog:check-jacks` green; `catalog:validate` green; `catalog:guard-batch-pr`
  green; PR contains no mapped/runtime edits.
- Playwright picker search/brand/effect, image load, canvas placement, no console
  errors (desktop + mobile).
- Contact sheet (10–30 images) + coverage/reject report in the PR.
- Demo share link with every batch item on one board + illustrative cables;
  counts verified.
- Before/after screenshots (desktop + mobile) for the seeded replacements.
- Billed tokens + minutes/item recorded; one PR; no merge.

## Notes

- Created from `docs/tasks/P5-batch-template.md`; per-batch copy is exempt from
  the token-usage review. Wave-level token review verdict recorded by the
  coordinator.
- If this batch uncovers a process/rule gap, do not edit the rules in the PR;
  propose the change + token review to the owner first.
