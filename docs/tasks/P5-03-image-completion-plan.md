# P5-03 — Image completion plan (T-0)

**Phase:** P5 · **Status:** merged — PR #52 (squash `4a6f1e7`); T-0a merged (PR #53, `dee8b39`); T-0b merged (docs-only, PR #54); T-1 in review (PR #55) · **Type:** plan/index (docs-only)

## Purpose

One durable plan for finishing the catalog images without Pedalplayground pixels,
completing BOSS, clearing the legacy hotlinked/mock images, and continuing the
remaining brands. Every later session reads this file, `docs/progress.md`, and its
own task file — no need to re-paste the whole plan.

## Current state (2026-10-26)

- `#50` (BOSS image repair) and `#51` (image licensing ledger) are merged; post-merge
  build is current: **270 pedals / 15 boards**.
- Ledger (`data/catalog/asset-ledger.json`): **285 items**
  - **165 license-pending** = 73 self-hosted official + **92 hotlinked legacy**
  - **31 replacement-needed** = BOSS legacy (no recorded source)
  - **89 own** = 74 mock/static placeholder pedals + 15 boards (5 generated, 10 placeholder)
  - 0 licensed · 0 none
- BOSS: **79/208 covered, 129 remaining** (5 batches of 24–28). The 31 legacy BOSS
  items are the `replacement-needed` set.
- Hotlinked by brand: EHX 18, MXR 18, Mooer 17 (+1 mock), TC 13 (+4 mock/static),
  JHS 12 (+6 mock/static), Walrus 7 (+11 mock), Joyo 5 (+13 mock), BOSS 1,
  Behringer 1.
- Mock/static placeholder by brand: Keeley 18, EQD 18, Joyo 13, Walrus 11, JHS 6,
  TC 4, Big Joe 2, Mooer 1, Effects Bakery 1. Boards: 10 placeholder.

## Decisions

- **D1 — Generated flat pedal art for no-official sources.** Official/authorized
  top-down photos stay first. For the 31 BOSS legacy, BOSS vintage items in the new
  batches, and any future gap: generate a faithful flat top-down from official/
  authorized/user **reference** photos. Reference only; no reference pixels; no
  planner. Generated art is `own`.
- **D2 — BOSS first.** T-0a gate fix → T-1 pedal-art + promote-legacy → T-2 BOSS
  wave 3 (boss-4 + legacy repair + boss-5) → T-3 BOSS wave 4 (boss-6/7/8) → BOSS
  complete.
- **D3 — Cleanup happens in each brand's first batch.** Every brand's first batch
  includes all of that brand's existing seed items (hotlinked/mock) **plus** new
  Tier A items to 24–28. No separate rehost PR.
- **D4 — 3-wide batches, one agent each.** One batch = branch/worktree/session/PR.
  The wrapper starts 2; the third starts only on the true-token gate (past midpoint,
  ≤40% soft budget, ≥2 items/h). Same-brand BOSS waves are fine (different files);
  the coordinator serializes shared `curated.ts`/test edits.
- **D5 — Licensing.** Official images stay `license-pending`; the owner sends the
  13 brand emails and records responses in `image-licenses.json`. Generated art is
  `own`. `licensed` only with written permission. Run `pnpm catalog:asset-ledger`
  after status changes.
- **D6 — Boards.** Audit/repair the existing 15 boards (10 placeholders + the 5
  generated) and add new boards to 150, all with our generated flat board art.
  Boards can use the third slot.
- **D7 — Token metric.** Report **billed non-cache tokens** (input + output +
  reasoning) for the 400k/800k and 1.2M/2.4M budgets, and the **cache-inclusive
  JSONL floor** separately. T-0a makes the wave gate/report use a true metric and
  stop active batches at the hard cap. The old runner self-reported `.tokens` is not
  trustworthy (boss-3 recorded 4.21M synthetic; boss-2 39k).
- **D8 — One parallel feature workstream (T-0b).** One feature task may run alongside
  the catalog wave (1 feature + up to 3 catalog batches; start 1+2; the third catalog
  needs the true-token gate **and** the PR cap). **≤2 PRs awaiting owner review across
  workstreams** (≤1 feature). Feature budgets: builder soft ≤400k / hard ≤800k, review
  allowance ≤300k, task hard ≤1.1M, 6 h; combined window soft ≤1.6M / hard ≤3.2M
  billed non-cache. Catalog budgets unchanged. **Armed after the T-2 calibration**
  (T-0a is merged; owner may waive the calibration). Full rules + matrix:
  `docs/tasks/P5-03d-parallel-workstreams.md`.

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
  batch / 12M/24M wave cache-inclusive, or 2-wide × 40 for the long tail). Any
  re-baseline is an owner decision.

### T-0b parallel workstreams (2026-10-26)

`token-usage-reviewer`: **`adjust`** — folded: enablement gate after T-0a + the T-2
calibration (blocker: unvalidated billed baseline / unmerged true metric);
class-structured feature budget; third catalog slot behind both the true-token gate
and the PR cap; coordinator narrowed to shared files only; per-class token logging.
Not adopted (owner-set, recorded): flat 1 feature + 2 catalog and class-split PR caps
(owner allows up to 3 catalog on the gate and keeps ≤2 PRs across, the stricter rule).
See `docs/tasks/P5-03d-parallel-workstreams.md`.

## Task / PR index

| # | Task | Scope | Depends on |
|---|---|---|---|
| **T-0** | This plan (docs-only) | **Merged (PR #52, squash `4a6f1e7`).** Plan + T-0a/T-1 task files; reconcile progress/roadmap/phase-guide/#50/#51 statuses; record token verdict. One PR. | — |
| **T-0a** | Wave true-token gate | **Merged (PR #53, squash `dee8b39`).** `catalog:wave`/runner gate + report use true billed tokens; stop active batches at hard caps; third-slot gate on the true metric; tests; README. One PR. Code review (high-risk) pass 1 changes-required → pass 2 approve. | T-0 |
| **T-0b** | Parallel feature + catalog workstreams (docs-only) | **Merged (PR #54, squash `89c6a38`).** Rules + ownership matrix + `docs/tasks/feature-template.md`; 1 feature + up to 3 catalog batches; ≤2 PRs awaiting review; feature/combined budgets; gated on the T-2 calibration (T-0a merged). One PR. | T-0a |
| **T-1** | Pedal flat-art + promote-legacy | **In review (PR #55).** Template family + art-spec schema + `asset:pedal-art` + `catalog:promote-legacy` + tests + `docs/catalog/pedal-art.md`; 2–3 pilots. Designer proposal → owner approval → ≤2 visual passes → 1 light code review. One PR. | T-0 |
| **T-2** | BOSS wave 3 | boss-4 (26 new) + boss/legacy-repair (31 existing) + boss-5 (26 new). 2-wide start (boss-4 + repair); boss-5 third on the true gate. Split repair 16+15 only if the first 8 items exceed ~6 min or need a third sheet. Include the 1 BOSS hotlinked seed if it falls in scope; otherwise clear it in T-7. One PR per batch. | T-0a, T-1 |
| **T-3** | BOSS wave 4 | boss-6 + boss-7 + boss-8 (77 items). 3-wide, third on gate. Re-baseline budgets from T-2 before launching. One PR per batch. | T-2 |
| **T-4** | Cleanup wave 1 | EHX-1 (18 existing + 8 new) + MXR-1 (18 + 8) + Mooer-1 (18 [17 hotlinked + 1 mock] + 8) = 78 items; 54 existing (53 hotlinked + 1 mock). One PR per batch. | T-1 |
| **T-5** | Cleanup wave 2 | TC-1 (18 + 8) + JHS-1 (19 + 7) + Walrus-1 (18 + 8) = 78; 55 existing (32 hotlinked + 2 official static + 21 mock/static). One PR per batch. | T-1 |
| **T-6** | Cleanup wave 3 | Joyo-1 (18 + 8) + Keeley-1 (18 + 8) + EQD-1 (18 + 8) = 78; 54 existing (5 hotlinked + 49 mock/static). One PR per batch. | T-1 |
| **T-7** | Cleanup wave 4 | Behringer-1 (1 hotlinked + new) + Big Joe-1 (2 mock + new) + Effects Bakery-1 (1 mock + new). Small batches; fill from their own Tier A; never force 26 if the brand has fewer. One PR per batch (or a smaller final batch). | T-1 |
| **T-8** | Remaining Tier A | Continuous waves of the remaining brands (Catalinbread, Dunlop, Fender, Strymon, Wampler, DigiTech, etc.) to **1,850 pedals**. Measured cost/item go/no-go first; 2-wide default; 3-wide only on the true gate; 26 items (consider 40 after calibration). Token review each new wave. | T-3…T-7 |
| **T-9** | Boards | Audit/repair the existing 15 boards (10 placeholders) + new board batches to **150**; generated flat board art; third slot. | T-1 (pedal-art not required) |
| **T-10** | P5-04 final QA / launch | Full validation, provenance, attribution, caps, demo links, licensing; launch gate `hotlinked + mock = 0`. | T-8, T-9 |
| — | Licensing ops (owner) | Send the 13 brand emails; update `image-licenses.json`; run `pnpm catalog:asset-ledger`; `licensed` only with written permission. No PR unless statuses change docs. | — |

## Wave order

1. **T-0** (merged) → **T-0a** (merged) → **T-0b** (parallel-workstream rules,
   armed after the T-2 calibration) → **T-1** (pedal-art + promote-legacy).
2. **T-2 BOSS wave 3:** boss-4 + BOSS legacy repair start 2-wide; boss-5 third on the
   gate. The repair is the hard part; split it 16+15 if the first 8 items exceed
   ~6 min or need a third vision sheet.
3. **T-3 BOSS wave 4:** boss-6/7/8; BOSS complete.
4. **T-4…T-7 cleanup waves:** each brand's first batch includes all its existing
   seed items + new; the 92 hotlinked and 74 mock are cleared.
5. **T-8 remaining Tier A:** continuous 3-wide/2-wide waves to 1,850.
6. **T-9 boards** + **T-10** final QA.

## Budgets / guards

- Per batch: **billed non-cache** soft ≤400k / hard ≤800k; wave soft ≤1.2M / hard
  ≤2.4M; report the cache-inclusive JSONL floor separately.
- **Feature stream (T-0b):** builder soft ≤400k / hard ≤800k + review allowance
  ≤300k; task hard ≤1.1M; 6 h. Combined feature + catalog window: soft ≤1.6M / hard
  ≤3.2M billed non-cache. Log billed tokens by class.
- ≤2 vision passes/batch; ≤1 light code review (only T-0a/T-1/`curated.ts`;
  data-only batches skip); 4 h active; 12 min/item.
- Start 2-wide; third only on the true-token gate. Do not raw-launch sessions.
- Stop: any 429/401/quota/timeout/empty response (report model + operation + exact
  error; never substitute); wave true tokens at hard cap (pause/stop active); batch
  >2× soft or >4 h; third vision pass needed; generated art fails clean-alpha/aspect/
  bright after 2 renders (mark pending); no verified jack face (omit edge, unknown);
  **2 PRs awaiting owner review across workstreams** (start nothing new; ≤1 feature);
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
- No Pedalplayground pixels; generated art is `own`; official images tracked
  `license-pending` until written permission.
- One PR per task/batch; no merge by agents.
