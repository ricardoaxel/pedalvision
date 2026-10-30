# P5-03a — Wave true-token gate (T-0a)

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** in review — PR #53 · **Type:** tooling (high-risk) · **Depends on:** T-0

> **Updated by T-2c/T-2d (2026-10-27).** The true billed-token metric and wave
> budgets/stops remain authoritative; the **third-slot gate is retired**. Waves
> start 3-wide by default (T-2d, no flag); `--allow-third` is a deprecated no-op;
> a freed slot never auto-starts a queued batch. See
> `docs/tasks/T-2c-wrapper-3-wide.md` and `docs/tasks/T-2d-default-3-wide.md`.

## Why

The wave runner/report currently mixes two token sources: the runner checkpoint
ledger (self-reported by the batch session) and the session JSONL. `canStartNext`
reads `BatchState.tokens`, so the third-slot gate is effectively always open, and a
batch can keep running past the wave hard cap. The measured boss-wave-2 run recorded
**39k** in the checkpoint ledger but **25.63M cache-inclusive** (≈0.98M billed
non-cache) in the JSONL; boss-3 recorded 4.21M of synthetic cumulative values.

## Goal

Make the gate and report use a **true token metric**, and enforce the hard caps.

## Scope

- `tools/catalog-wave/aggregate.ts`: expose **billed non-cache** tokens
  (input + output + reasoning) and **cache-inclusive** tokens separately, while
  keeping the existing total for compatibility.
- `tools/catalog-wave/gate.ts`: `canStartNext` / `startDecision` / `waveBudget`
  accept the true per-batch tokens; the third-slot gate uses the true metric.
- `tools/catalog-wave/index.ts`: on each refresh, compute each active batch's true
  tokens from its JSONL + checkpoint ledger (`max`), not only the checkpoint; if the
  wave hard cap is reached, request stop for active batches, mark queued as
  not-started, and report.
- `tools/catalog-wave/report.ts` + README: show **billed non-cache** and
  **cache-inclusive floor** columns; keep the session final text/PR/CI.
- Tests: non-cache aggregation; third-slot gate with true tokens; hard-cap stop;
  missing/partial JSONL; existing tests updated.
- Do **not** change the numeric budgets in this task (per batch 400k/800k billed;
  wave 1.2M/2.4M; cache-inclusive floor reported separately). The T-2 calibration
  provides the re-baseline data; any change is an owner decision after a token
  review.

## Implementation (PR #53)

- `aggregate.ts` exposes `billedTokens` (input + output + reasoning) and keeps
  `tokens` as the cache-inclusive floor; derived totals cover steps without
  `total`.
- `gate.ts` has one `resolveBatchTokens` path: JSONL billed → JSONL total as a
  conservative billed upper bound → checkpoint ledger only when the JSONL has no
  token numbers. `canStartNext` requires the resolved billed map and fails closed
  when an entry is missing.
- `index.ts` refreshes each active batch's JSONL every poll, stops active batches
  at the wave hard cap, marks queued batches `not-started`, and only stops
  launching (not active batches) at the soft cap.
- `report.ts` shows **Billed non-cache** and **Cache-incl. floor**, labels
  ledger/upper-bound fallbacks, and keeps `unknown` when a batch has no token
  data. `README.md` documents the metric.
- Tests: aggregate separation/fallbacks, true-metric gate, soft cap, hard cap,
  third-slot wiring, missing/truncated JSONL, report labels. Checks: lint /
  typecheck / test **754** / build.

## Acceptance

- A batch that exceeds the hard cap cannot be counted as under budget because its
  checkpoint ledger is low.
- The third-slot gate uses the true token metric.
- The report shows both metrics; the wave report remains the coordinator's single
  source.
- `pnpm lint && pnpm typecheck && pnpm test`; code review (high-risk, ≤2 light
  passes); one PR; no merge.
