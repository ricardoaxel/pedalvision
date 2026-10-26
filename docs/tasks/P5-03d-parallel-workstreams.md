# P5-03d — Parallel feature + catalog workstreams (T-0b)

**Phase:** P5 · **Status:** in review — PR #54 (docs-only) · **Type:** plan/rules (docs-only) · **Depends on:** T-0a (true billed token metric)

## Purpose

Allow **one feature task** to run alongside the catalog waves without breaking the
catalog isolation rules, while keeping the owner's serial-merge bottleneck under
control. Rules only — no code, data or assets.

## Enablement gate

- **Required:** **T-0a merged** (true billed token metric). Without it the budgets and
  the third-slot gate are unenforceable.
- **Calibration:** the first **T-2** batch (BOSS boss-4) records billed tokens and
  minutes per item; check the combined-window budgets against it. The owner may
  explicitly waive the calibration gate (accepting the uncalibrated 400k/800k baseline).
- Until both are satisfied, stay **catalog-only** (existing rules). This file is the
  ruleset; it launches nothing by itself.

## Workstream model

- **In flight:** 1 feature + **up to 3** catalog batches.
- **Start:** 1 feature + 2 catalog.
- **Third catalog slot** only when **all** are true:
  1. the existing `catalog:wave` true-token third-slot gate passes (first batch past
     midpoint, ≤40% of the soft budget, ≥2 items/h);
  2. **≤2 PRs are awaiting owner review across workstreams** (owner-set cap);
  3. the catalog wave has not exceeded its soft budget.
- The feature stream never counts toward the catalog 2/3-wide gate, and the catalog
  never blocks an already-started feature task (except the PR cap below).
- **Owner-set PR cap:** **≤2 PRs awaiting owner review across workstreams**, and at
  most **1** of those may be a feature PR. At the cap, start nothing new (no new
  feature task, no new catalog wave). A PR counts as "awaiting review" from push
  until merge.
- **Default remains serial.** Use the feature slot only for a task with a frozen /
  approved direction and zero catalog overlap. When in doubt, run it after the wave.

## Ownership matrix

| Area | Owner | Paths (examples) |
|---|---|---|
| **Catalog-only** | catalog batch session | `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`, `public/pedal-assets/{pedals,boards}/**`, its own `docs/tasks/P5-03-<kind>-<brand>-<batch>.md`, its worktree |
| **Feature-only** | feature session | `src/**` feature code, `e2e/**` (except the narrow catalog fixtures), `docs/tasks/<feature>.md`, `docs/screenshots/<task>/**` |
| **Generated — never hand-edited** | post-merge workflow | `data/catalog/{pedals,boards}/**`, `src/catalog/data/**` |
| **Narrow catalog-test fixtures** | shared coordinator only | catalog seed snapshots/fixtures and `src/catalog/**/*.test.ts` |
| **Shared schema/config/docs** | shared coordinator only | `src/catalog/schema.ts`, `src/catalog/rawSchema.ts`, `tools/catalog-transform/curated.ts`, `package.json` / lockfile, `.github/**`, `playwright.config.ts`, `vite.config.ts`, `AGENTS.md`, `docs/roadmap.md`, `docs/phase-guide.md`, `docs/progress.md`, task templates, `docs/catalog/**` process docs |

**Shared coordinator** = the session that owns the catalog wave (`catalog:wave`). It is
not a new agent; it only serializes the shared files above and verifies the post-merge
build. If a feature task needs one of those files, it **stops** and is rescheduled as a
serial coordinator task — it does not coordinate ad hoc.

## Hard rules

- Feature sessions **never** edit `data/catalog/**`, `public/pedal-assets/**`,
  `src/catalog/**` (including `src/catalog/data/**`) or `tools/catalog-*`.
- Catalog sessions **never** edit feature code (`src/**` outside `src/catalog/**`),
  `e2e/**` (outside the narrow fixtures) or feature docs.
- Shared schema/config/docs are **coordinator-only**. A feature task that needs one
  stops and becomes a serial coordinator task — never "just this once".
- Never hand-edit or hand-resolve conflicts in generated mapped/runtime files;
  regenerate after the merge.
- One PR per session; **no agent merges**; the owner merges serially.

## Budgets

Metric: **billed non-cache tokens** (`input + output + reasoning`); report the
cache-inclusive JSONL floor separately.

**Catalog — unchanged**

- Per batch: soft ≤400k / hard ≤800k; wave soft ≤1.2M / hard ≤2.4M.
- ≤2 vision passes, ≤1 light code review, 4 h active, 12 min/item.

**Feature — new**

- Builder: soft ≤400k / hard ≤800k.
- Review allowance: ≤300k (design/vision ≤80k per pass; light code review ≤100k per pass).
- Task hard cap: **≤1.1M**; **6 h** active.
- Design gate only if design-affecting; ≤2 vision passes; ≤1 code review (2 only for
  high-risk / a blocker).

**Combined in-flight window**

- Soft **≤1.6M** / hard **≤3.2M** billed non-cache (whichever cap binds first).
- Log billed tokens **by class** (feature builder / vision / code review; each catalog
  batch) at every checkpoint.

## Merge / rebase protocol

1. Separate branch + worktree per session (feature and each catalog batch).
2. The owner merges serially; no agent merges.
3. After **any catalog PR merges**: do not continue until the **post-merge build commit
   is verified on `main`** (mapped/runtime regenerated; CI / `catalog:status` green).
4. Rebase/merge `main` into the open branch before continuing. If a conflict touches
   `data/catalog/{pedals,boards}/**` or `src/catalog/data/**`, **stop** — regenerate,
   never hand-resolve.
5. Re-run the affected checks after the rebase (feature: lint/typecheck/test/build +
   the touched e2e; catalog: `catalog:ci` / guard).
6. A catalog merge that changes seeded items re-runs the feature's catalog-dependent
   Playwright before its PR.

## Observability

- `pnpm catalog:status` is the source of truth for batches; `pnpm catalog:wave report
  --wave <id>` for the wave.
- **One `docs/progress.md` workstream note per checkpoint** (format below).
- **Stop immediately and report** on: a feature task needing a shared/generated file;
  2 PRs awaiting review (start nothing new); post-merge build unverified or a
  generated-file conflict; the combined hard cap or any class hard cap; a feature task
  >6 h or >2× class soft; any model/provider failure (429/401/quota/timeout/empty) —
  report model + operation + exact error, never substitute.

## Workstream note (one line, in `docs/progress.md`)

```
WS <date>: feature <branch> — <phase/step> · catalog <batch(es)> — <phase> · awaiting review <n> (feature <n>/catalog <n>) · billed <feature>/<wave> · gate <armed|blocked: reason>
```

## Feature task template

Copy `docs/tasks/feature-template.md` to `docs/tasks/<task>.md` and fill it in.

## Feature-agent prompt (copy-paste)

```
You are the feature workstream for <task> in Pedalvision.
Read: docs/progress.md, docs/tasks/<task>.md, docs/tasks/P5-03d-parallel-workstreams.md.
Worktree/branch: <path>/<branch>. One PR; never merge.
Own only feature paths. Never edit data/catalog/**, public/pedal-assets/**,
src/catalog/** or tools/catalog-*; if you need a shared file, STOP and report.
Run the design gate only if the task is design-affecting (designer →
owner-approved direction → ≤2 design-reviewer passes on desktop + mobile).
Run ≤1 light code review (≤2 only for high-risk/blocker); tests are the re-check.
Budget: builder soft 400k / hard 800k; review ≤300k; task hard 1.1M; 6 h.
Before the PR: rebase onto post-merge main, run lint/typecheck/test/build.
Report: branch, PR, billed tokens by class, checks, blockers.
```

## Token review verdict (2026-10-26)

`token-usage-reviewer`: **`adjust`**. Folded:

- **Enablement gate** after T-0a + the T-2 calibration (blocker: unvalidated billed
  baseline / unmerged true metric).
- **Class-structured feature budget** (builder + review allowance + task hard cap) so a
  design loop does not trip false stops.
- **Third catalog slot behind both the true-token gate and the PR cap** (owner allows
  up to 3 catalog batches).
- **Coordinator narrowed to shared files only**; feature sessions stop instead of
  coordinating ad hoc.
- **Per-class token logging** in the wave report / checkpoints.
- Not adopted (owner-set, recorded for transparency): flat 1 feature + 2 catalog
  (owner allows up to 3 on the gate); class-split PR caps of 2 catalog + 1 feature
  (owner keeps ≤2 across, which is stricter).

## Acceptance

- Rules, matrix, caps, merge protocol and the feature template landed **docs-only**
  (no code/data/assets).
- Enablement gate (T-0a + T-2 calibration), budgets and stop conditions are explicit.
- `AGENTS.md`, `docs/roadmap.md`, `docs/phase-guide.md`, `docs/progress.md` and
  `docs/tasks/P5-03-image-completion-plan.md` reconciled.
- One PR; no merge.
