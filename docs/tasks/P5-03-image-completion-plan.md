# P5-03 — Image completion plan (T-0)

**Phase:** P5 · **Status:** merged — PR #52 (squash `4a6f1e7`); T-0a merged (PR #53, `dee8b39`); T-0b merged (docs-only, PR #54); T-1 merged (PR #55); T-1a merged (PR #56); T-2 wave 3 merged (#57/#58); boss-5 merged (PR #59, `424bc2c`; post-merge `123df52`, 322/15); **T-2c/T-2d merged (PR #62); 3-wide default (no flag); T-3 next** · **Type:** plan/index (docs-only)

## Purpose

One durable plan for finishing the catalog images without Pedalplayground pixels,
completing BOSS, clearing the legacy hotlinked/mock images, and continuing the
remaining brands. Every later session reads this file, `docs/progress.md`, and its
own task file — no need to re-paste the whole plan.

## Current state (2026-10-27)

- `#50` (BOSS image repair) and `#51` (image licensing ledger) are merged; **T-2 boss-4
  (#58) and the 31-item BOSS legacy repair (#57) are merged**; post-merge build
  `1c93cf5` verified: **296 pedals / 15 boards**.
- Ledger (`data/catalog/asset-ledger.json`): **311 items**
  - **222 license-pending** = 184 official + 33 planner last-resort + 1 community +
    4 archive
  - **89 own** = 74 mock/static placeholder pedals + 15 boards
  - **0 replacement-needed / 0 legacy** (all 31 BOSS legacy repaired)
  - 0 licensed · 0 none
- BOSS: **105/208 covered, 103 remaining** (boss-5 = 26, then boss-6/7/8 ≈ 77). The
  31 legacy BOSS items are repaired; **boss-5 is the next and last T-2 batch**.
- Hotlinked by brand: EHX 18, MXR 18, Mooer 17 (+1 mock), TC 13 (+4 mock/static),
  JHS 12 (+6 mock/static), Walrus 7 (+11 mock), Joyo 5 (+13 mock), BOSS 1,
  Behringer 1.
- Mock/static placeholder by brand: Keeley 18, EQD 18, Joyo 13, Walrus 11, JHS 6,
  TC 4, Big Joe 2, Mooer 1, Effects Bakery 1. Boards: 10 placeholder.

## Decisions

- **D1 — Source hierarchy (amended 2026-10-27).** For pedals: official/authorized
  top-down → authorized retailer → user/community (recorded) → **planner/
  Pedalplayground last-resort (recorded + quality-gated)** → **generated flat art
  only when none of the above exists/passes**. Generated art is `own`; planner
  last-resort is a recorded source gap to improve. The **31 BOSS legacy** stay
  `pending-replacement` and use the **same order** (official → retailer →
  community → **recorded planner last-resort** → generated only if none) — never
  keep their old unrecorded planner asset. Boards keep generated
  flat art by default; planner pixels are never used for boards.
- **D2 — BOSS first.** T-0a gate fix → T-1 pedal-art + promote-legacy → T-2 BOSS
  wave 3 (boss-4 + legacy repair + boss-5) → T-3 BOSS wave 4 (boss-6/7/8) → BOSS
  complete.
- **D3 — Cleanup happens in each brand's first batch.** Every brand's first batch
  includes all of that brand's existing seed items (hotlinked/mock) **plus** new
  Tier A items to 24–28. No separate rehost PR.
- **D4 — 3-wide batches, one agent each.** One batch = branch/worktree/session/PR.
  **Owner override: catalog waves start 3-wide by default (T-2d)**; the start is
  logged. `--allow-third` is a deprecated no-op. The true-token metric remains the
  budget/stop guard; soft over-usage is logged, hard 2.4M refuses. Same-brand BOSS
  waves are fine (different files); the coordinator serializes shared
  `curated.ts`/test edits.
- **D5 — Licensing.** Official/retailer/community/archive images stay
  `license-pending`; planner last-resort is also `license-pending` and counted as a
  source gap. The owner sends the 13 brand emails and records responses in
  `image-licenses.json`. Generated art is `own`. `licensed` only with written
  permission. **Always record the source in the private raw catalog/ledger**
  (`imageProvenance` + `sourceUrl`/`referenceUrl`), never on the public page; run
  `pnpm catalog:asset-ledger` after status changes.
- **D6 — Boards.** Audit/repair the existing 15 boards (10 placeholders + the 5
  generated) and add new boards to 150, all with our generated flat board art.
  Boards run 3-wide by default after T-2c/T-2d.
- **D7 — Token metric.** Report **billed non-cache tokens** (input + output +
  reasoning) for the 400k/800k and **1.6M/2.4M** budgets, and the **cache-inclusive
  JSONL floor** separately. T-0a makes the wave gate/report use a true metric and
  stop active batches at the hard cap. The old runner self-reported `.tokens` is not
  trustworthy (boss-3 recorded 4.21M synthetic; boss-2 39k).
- **D8 — One parallel feature workstream (T-0b).** One feature task may run alongside
  the catalog wave (1 feature + up to 3 catalog batches; **3-wide default after T-2c/T-2d**).
  **≤3 PRs awaiting owner review across workstreams** (≤1 feature); with a feature
  open: 1 feature + 2 catalog, third waits. Feature budgets: builder soft ≤400k /
  hard ≤800k, review allowance ≤300k, task hard ≤1.1M, 6 h; combined window **soft
  2.2M / hard 3.4M** billed non-cache. Catalog budgets: 400k/800k per batch; wave
  1.6M/2.4M. **Armed after the T-2 calibration** (T-0a merged; owner may waive).
  Full rules + matrix: `docs/tasks/P5-03d-parallel-workstreams.md`.

## Parallel workstreams (T-0b) — ownership matrix

| Area | Owner | Paths (examples) |
|---|---|---|
| Catalog-only | catalog batch session | `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`, `public/pedal-assets/{pedals,boards}/**`, its batch task file, its worktree |
| Feature-only | feature session | `src/**` feature code, `e2e/**` (except narrow catalog fixtures), `docs/tasks/<feature>.md`, `docs/screenshots/<task>/**` |
| Generated — never hand-edited | post-merge workflow | `data/catalog/{pedals,boards}/**`, `src/catalog/data/**` |
| Narrow catalog-test fixtures | shared coordinator only | catalog seed snapshots/fixtures + `src/catalog/**/*.test.ts` |
| Shared schema/config/docs | shared coordinator only | `src/catalog/schema.ts`, `src/catalog/rawSchema.ts`, `tools/catalog-transform/curated.ts`, `package.json`/lockfile, `.github/**`, `playwright.config.ts`, `vite.config.ts`, `AGENTS.md`, roadmap/phase-guide/progress, templates, `docs/catalog/**` process docs |

Hard: a feature session never edits `data/catalog/**`, `public/pedal-assets/**`,
`src/catalog/**` or `tools/catalog-*`; a catalog session never edits feature code or
`e2e/**`; shared files only the coordinator; if a feature needs one, STOP → serial
coordinator task. Separate worktrees; owner merges serially; after a catalog merge wait
for the verified post-merge build and never hand-resolve generated conflicts.

## Token review verdict (2026-10-26)

`token-usage-reviewer`: **`adjust`**. Folded:

- **Blocker:** the wave gate/report used self-reported runner tokens; the third-slot
  gate was effectively always open and active batches were never stopped at a token
  cap. **T-0a** fixes the gate/report to use the true metric and stop at the hard cap.
- **Promote-legacy:** T-4…T-7 need a deterministic legacy→raw scaffold; added to
  T-1 (`catalog:promote-legacy`). Counts below are derived from the ledger, not
  hand-written.
- **T-1 style:** one frozen template family + per-item art-spec JSON; the model
  writes specs, not per-asset SVG. One style approval; no per-batch designer loop.
- **Routing:** batches on the light model by default; data-only PRs skip code review;
  keep code review for T-0a, T-1 and any `curated.ts` change.
- **Reconcile** `phase-guide.md`; audit the existing 15 boards; add a cost/item
  go/no-go before T-8 and a launch gate on `hotlinked + mock = 0`.
- **Budget note:** the measured boss-wave-2 floor was **25.63M cache-inclusive**
  (≈0.98M billed non-cache) for 52 items. Keep the existing 400k/800k **billed**
  budgets until T-0a + the T-2 calibration; if the true metric is 10× over or cannot
  be enforced, STOP and ask the owner to re-baseline (reviewer suggests 6M/12M per
  batch / 12M/24M wave cache-inclusive, or 3-wide × 40 for the long tail). Any
  re-baseline is an owner decision.

### T-0b parallel workstreams (2026-10-26)

`token-usage-reviewer`: **`adjust`** — folded: enablement gate after T-0a + the T-2
calibration (blocker: unvalidated billed baseline / unmerged true metric);
class-structured feature budget; third catalog slot behind both the true-token gate
and the PR cap; coordinator narrowed to shared files only; per-class token logging.
Not adopted (owner-set, recorded): flat 1 feature + 2 catalog and class-split PR caps
(owner later overrode this on 2026-10-27: 3-wide default after T-2c/T-2d, no flag; ≤3 PRs; true-token metric remains the budget/stop guard).
See `docs/tasks/P5-03d-parallel-workstreams.md`.

## Task / PR index

| # | Task | Scope | Depends on |
|---|---|---|---|
| **T-0** | This plan (docs-only) | **Merged (PR #52, squash `4a6f1e7`).** Plan + T-0a/T-1 task files; reconcile progress/roadmap/phase-guide/#50/#51 statuses; record token verdict. One PR. | — |
| **T-0a** | Wave true-token gate | **Merged (PR #53, squash `dee8b39`).** `catalog:wave`/runner gate + report use true billed tokens; stop active batches at hard caps; third-slot gate on the true metric; tests; README. One PR. Code review (high-risk) pass 1 changes-required → pass 2 approve. | T-0 |
| **T-0b** | Parallel feature + catalog workstreams (docs-only) | **Merged (PR #54, squash `89c6a38`).** Rules + ownership matrix + `docs/tasks/feature-template.md`; 1 feature + up to 3 catalog batches; **owner override 2026-10-27: 3-wide default, ≤3 PRs awaiting review (max 1 feature)**. Feature/combined budgets; gated on the T-2 calibration (T-0a merged). One PR. | T-0a |
| **T-1** | Pedal flat-art + promote-legacy | **Merged (PR #55, squash `66222d4`).** Template family + art-spec schema + `asset:pedal-art` + `catalog:promote-legacy` + tests + `docs/catalog/pedal-art.md`; 2–3 pilots. Owner-approved "Catalog Specimen"; design-reviewer 2/2; code review 2/2. | T-0 |
| **T-1a** | Image source policy (planner last-resort + recorded sources) | **Merged (PR #56, squash `ea20b02`).** Reverse the planner ban: official → retailer → community → planner **last-resort** → generated art only if none; 31 BOSS legacy remain repair-set. Always record source in the private raw catalog/ledger; ledger source-gap report. Docs/AGENTS/ADR-003/schema/gate/ledger + 26-record provenance backfill. One PR; token-reviewed. | T-1 |
| **T-2** | BOSS wave 3 | **COMPLETE — boss-4 + legacy repair + boss-5 merged.** boss-4 (26 new, 52 AVIFs: 20 official + 1 community + 5 planner + 0 generated; `catalog:ci` 296/15) and legacy repair (31/31: 3 official + 28 planner + 0 generated/legacy) merged; boss-5 (26 new, `md-2`…`od-3`) merged as PR #59 (`424bc2c`; post-merge `123df52`, 322/15; 52 AVIFs = 18 official + 8 planner + 0 generated; billed ≈579k / 42 min). T-2 calibration: boss-4 ≈724k/66 min. **T-3 next; T-2c/T-2d merged.** | T-0a, T-1, T-1a |
| **T-2c** | [Wrapper 3-wide true-token fix](T-2c-wrapper-3-wide.md) | **Merged (PR #62, squash `50025c8`).** Fixed the free-slot auto-start and stopped-batch/`.stop`/resume collision; explicit `--resume` (original wave id) clears stale markers and preserves progress; fresh start refuses existing state; supervisor-finalize guard; true-token budgets/stops preserved. Tests added. **Required before T-3.** Token review `adjust` folded; high-risk code review 2/2. | T-0a |
| **T-2d** | [Catalog waves start 3-wide by default](T-2d-default-3-wide.md) | **Merged (PR #62, squash `50025c8`; folded into T-2c).** Default `min(3, maxParallel, batchCount)` with no flag; `--allow-third` deprecated no-op; soft budget logged without shrinking (owner accepts over-soft), hard 2.4M still refuses; docs/tests updated. **Required before T-3.** Token review; high-risk code review. | T-2c |
| **T-3** | BOSS wave 4 | boss-6 + boss-7 + boss-8 (77 items). **3-wide by default (T-2d, no flag)**; logged start; true-token budgets/stops. Re-baseline budgets from T-2. One PR per batch. | T-2, T-2c, T-2d |
| **T-4** | Cleanup wave 1 | EHX-1 (18 existing + 8 new) + MXR-1 (18 + 8) + Mooer-1 (18 [17 hotlinked + 1 mock] + 8) = 78 items; 54 existing (53 hotlinked + 1 mock). **3-wide (default); one PR per batch.** | T-1, T-2c, T-2d |
| **T-5** | Cleanup wave 2 | TC-1 (18 + 8) + JHS-1 (19 + 7) + Walrus-1 (18 + 8) = 78; 55 existing (32 hotlinked + 2 official static + 21 mock/static). **3-wide (default); one PR per batch.** | T-1, T-2c, T-2d |
| **T-6** | Cleanup wave 3 | Joyo-1 (18 + 8) + Keeley-1 (18 + 8) + EQD-1 (18 + 8) = 78; 54 existing (5 hotlinked + 49 mock/static). **3-wide (default); one PR per batch.** | T-1, T-2c, T-2d |
| **T-7** | Cleanup wave 4 | Behringer-1 (1 hotlinked + new) + Big Joe-1 (2 mock + new) + Effects Bakery-1 (1 mock + new). Small batches; fill from their own Tier A; never force 26 if the brand has fewer. **3-wide (default); one PR per batch.** | T-1, T-2c, T-2d |
| **T-8** | Remaining Tier A | Continuous waves of the remaining brands (Catalinbread, Dunlop, Fender, Strymon, Wampler, DigiTech, etc.) to **1,850 pedals**. Measured cost/item go/no-go first; **3-wide default (T-2d)**; 26 items (consider 40 after calibration). Token review each new wave. | T-3…T-7, T-2c, T-2d |
| **T-9** | Boards | Audit/repair the existing 15 boards (10 placeholders) + new board batches to **150**; generated flat board art; **3-wide by default (T-2d)**. | T-1, T-2c, T-2d |
| **T-10** | P5-04 final QA / launch | Full validation, provenance, attribution, caps, demo links, licensing; launch gate `hotlinked + mock = 0`, planner last-resort counted as a source gap (owner may waive it), 31 BOSS legacy repaired. | T-8, T-9 |
| — | Licensing ops (owner) | Send the 13 brand emails; update `image-licenses.json`; run `pnpm catalog:asset-ledger`; `licensed` only with written permission. No PR unless statuses change docs. | — |

**T-2c/T-2d gate:** merged; T-3 and later 3-wide waves can start now. Waves start 3-wide by default (no flag); the true-token metric remains the budget/stop metric; the third-slot start gate is retired. Log every 3-wide start and any budget over-soft (soft does not shrink the wave; hard 2.4M refuses).

## Wave launch matrix

| Wave | Width | Gate |
|---|---|---|
| **T-2b boss-5** | 1 (done) | PR #59 merged |
| **T-2c/T-2d wrapper fix** | merged | PR #62 (`50025c8`); 3-wide default |
| **T-3 BOSS wave 4** | **3-wide (default, no flag)** | after T-2c/T-2d (merged); 3-wide default; ≤3 PRs |
| **T-4…T-7 cleanup** | **3-wide (default)** | after T-2c/T-2d; one PR per batch |
| **T-8 Tier A** | **3-wide (default)** | after T-2c/T-2d; wave budgets/stops |
| **T-9 boards** | **3-wide (default)** | after T-2c/T-2d; board budget |
| **Feature lane** | **1 feature** | 1 feature + 2 catalog max at 3 PRs |

**Launch rules:** `catalog:wave` only; no raw background sessions; one PR per batch; coordinator opens no PR; owner merges serially. With a feature PR open: 1 feature + 2 catalog; the third catalog waits for a PR slot. After every merge: verify post-merge build, update progress, rebase, refill.

## Next-wave coordinator protocol (mandatory)

1. Fetch/rebase; read `docs/progress.md`, this plan and T-0b.
2. Run `pnpm catalog:status`; `pnpm catalog:wave report --wave <last>`; read the
   latest `work/catalog/waves/<id>/report.md`/`state.json`; check open PRs,
   post-merge build and ledger. Do **not** re-read raw logs.
3. Classify each batch: merged / in review / running / failed-stopped / queued.
   Never redo merged; resume/repair failed-stopped once; never duplicate.
4. Select the next **uncompleted** batches from the plan order (T-3 boss-6/7/8 →
   T-4…T-7 → T-8 → T-9), no overlap.
5. Start the next wave **3-wide by default (no flag; after T-2c/T-2d)** via
   `catalog:wave`; the start is logged. Do not start a batch unless a PR slot will exist at completion.
6. Token-review a new wave; one PR per batch; coordinator opens no PR.
7. After any merge: verify the post-merge build, update progress, rebase open
   branches, then refill. Max 3 refills per wave; one WS line per checkpoint.
8. Stop on 3 PRs awaiting, wrapper-bypass risk, generated conflict, 2 failed resumes,
   hard budget, or any model/provider failure.

## Wave order

1. **T-0** (merged) → **T-0a** (merged) → **T-0b** (merged) → **T-1** (merged) →
   **T-1a** (planner last-resort + recorded sources) → **T-2**.
2. **T-2 BOSS wave 3:** boss-4 + BOSS legacy repair **merged**. **boss-5 completed
   solo 26/26 in PR #59** (CI green); it never needed the third-slot gate and no
   feature stream ran alongside it. Owner merges.
3. **T-2c** wrapper 3-wide fix; then **T-3 BOSS wave 4** boss-6/7/8 **3-wide**;
   BOSS complete.
4. **T-4…T-7 cleanup waves:** each brand's first batch includes all its existing
   seed items + new; **3-wide**; clear the current 92 hotlinked + 84 mock (verify
   the ledger; boss-5 adds 8 planner gaps).
5. **T-8 remaining Tier A:** continuous **3-wide** waves to 1,850.
6. **T-9 boards** + **T-10** final QA.

## Budgets / guards

- Per batch: **billed non-cache** soft ≤400k / hard ≤800k; wave **soft 1.6M / hard
  2.4M**; 3-wide default (T-2d); log over-soft without shrinking; report the
  cache-inclusive JSONL floor.
- **Feature stream (T-0b):** builder soft ≤400k / hard ≤800k + review allowance
  ≤300k; task hard ≤1.1M; 6 h. Combined feature + catalog window: **soft 2.2M / hard
  3.4M** billed non-cache; the combined hard is a coordinator-side check (with a
  feature active, subtract feature spend from the wave’s fixed 2.4M cap). Log billed
  tokens by class.
- ≤2 vision passes/batch; ≤1 light code review (only T-0a/T-1/`curated.ts`;
  data-only batches skip); 4 h active; 12 min/item.
- **3-wide by default (T-2d, no flag)**; the start is logged. Soft is logged and
  does not shrink the wave; hard 2.4M refuses. The true-token metric is the
  budget/stop guard, not a third-slot start gate. Do not raw-launch sessions.
  With a feature PR open: 1 feature + 2 catalog; the third catalog waits.
- **Source gap gate:** planner last-resort and legacy/mock/hotlinked items are
  counted by `catalog:license-report`; target 0 at T-10, but the owner may waive
  planner last-resort items (they are recorded + quality-gated).
- Stop: any 429/401/quota/timeout/empty response (report model + operation + exact
  error; never substitute); wave true tokens at hard cap (pause/stop active); batch
  >2× soft or >4 h; third vision pass needed; generated art fails clean-alpha/aspect/
  bright after 2 renders (mark pending); no verified jack face (omit edge, unknown);
  **3 PRs awaiting owner review across workstreams** (start nothing new; ≤1 feature);
  post-merge build unverified or a generated-file conflict; a feature needs a shared/
  generated file (stop → serial coordinator task); hotlinked+mock ≠ 0 at T-10; 2,000
  hosted pedals before Tier A.
- Owner merges serially; ~70 batch PRs are the real bottleneck.

## Owner actions

1. **Approve the generated flat-pedal-art visual direction at T-1** (designer
   proposal; the strategy is decided, the look is owner-approved).
2. **Send the 13 brand permission emails** from `docs/catalog/image-licensing.md`;
   update `data/catalog/image-licenses.json`; run `pnpm catalog:asset-ledger`.
3. **Merge** the PRs; approve any budget re-baseline after T-2; optionally waive the
   T-2 calibration gate for T-0b (accepting the uncalibrated feature budget).

## Acceptance

- T-0 docs merged; T-0a gate green; T-0b rules + feature template merged; T-1
  generator + promote-legacy merged.
- BOSS complete (boss-4…boss-8 + the 31 legacy repaired).
- All brand first batches replace their hotlinked/mock seeds; ledger
  `hotlinked + mock = 0` at T-10.
- Tier A: 1,850 pedals + 150 boards; caps respected.
- Planner only as a recorded last-resort (pedals) above generated art; the 31
  BOSS legacy repaired; generated art is `own`; official/retailer/community/
  archive images tracked `license-pending` until written permission; every
  shipped image has a private `imageProvenance` source record.
- One PR per task/batch; no merge by agents.
