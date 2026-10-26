# P5-03: Parallel wave runner (`catalog:wave`)

**Phase:** P5 · **Status:** in review — PR (pending) · **Model:** build-strong

## Goal

Add the missing glue for the P5 parallel mechanism: launch **2–3 independent
batch sessions**, supervise them through the existing control plane, and produce
one consolidated report — so the coordinator (and owner) get a report back
instead of fire-and-forget background processes.

## Why

`catalog-runner` already owns state/caps/pause/stop and `catalog-coordinator`
owns the wave policy, but there was no CLI to spawn sessions + aggregate their
results. Raw background `opencode run` sessions write a log and open a PR but
cannot report into a finished session.

## What

- `tools/catalog-wave/` + `pnpm catalog:wave`:
  - plan JSON (1–3 batches; `batch/kind/brand/total/worktree/branch/prompt|promptFile`),
  - validates max 3, unique ids/branches, worktree + branch, no active batch,
  - `run` (detached by default) starts `catalog:start` + `opencode run --auto
    --format json` under `catalog-runner supervise`; JSONL per batch,
  - starts **2-wide**; the third only when `canStartNext` passes (midpoint,
    ≤40% soft budget, ≥2 items/h); max 3 enforced by the runner,
  - `status --wait` / `report`; one-line-per-batch `report.md` + `state.json`
    with items/images/checkpoint tokens/main-session token floor/minutes/PR/CI
    and the session's final text,
  - tolerant JSONL aggregation (`partial` on missing `step_finish`, error events
    fail the batch; root-session tokens are a **floor**), best-effort `gh` PR/CI.
- Rule/plan updates so future waves use it: `AGENTS.md` (canonical), `docs/catalog-backfill.md`
  (runbook), `docs/tasks/P5-03-pilot-parallel-backfill.md`, `docs/tasks/P5-batch-template.md`
  (skip `catalog:start` when launched by the wrapper), `.opencode/agent/catalog-coordinator.md`,
  `docs/phase-guide.md`.

## Non-goals

- No new agents/dependencies, no model calls in the wrapper.
- No auto-merge and no PR creation (each session owns its PR).
- No change to per-batch/wave budgets or the 2-vision/1-code-review caps.

## Acceptance

- `pnpm catalog:wave run --plan <file> --dry-run` prints the planned launches and starts nothing.
- A fake-session integration run produces `report.md` with per-batch status/tokens/PR columns and the session text.
- Unit tests: plan validation, `canStartNext` boundaries, JSONL aggregation (garbage/dup/partial/error), report formatting.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Token-usage-reviewer verdict recorded; findings folded.
- One PR; no merge.

## Token-usage review (2026-10-25)

Verdict **`adjust`**; folded:

- label root-session tokens/cost as a **floor** (subagent sessions excluded);
  cap decisions stay on the checkpoint ledger;
- tolerant parser + `partial` on missing `step_finish`, error events fail the run;
- **detached by default** + `status`/`report` (a foreground 4 h runner is not viable);
- reuse `catalog-runner supervise` for stop/kill; validate worktree/branch and
  no active batch before launch;
- canonical budget numbers in `AGENTS.md`, one-line pointers elsewhere;
  `canStartNext` is the single executable gate.

## Notes

- The wrapper is coordinator-side only: zero added model calls, no new deps.
- `opencode run --format json` is an external contract; the aggregator is
  defensive and reports parse drift instead of a silent success.
- Root-session token totals do not include child reviewer sessions; the report
  labels them explicitly.

## Review round (light code-reviewer, pass 1)

Verdict **changes-required**; fixed:

- **Blocker — stop could still start a queued batch.** `refresh` now receives
  `stopping`, marks queued batches `not-started` before any launch, and never
  starts after SIGINT/SIGTERM (`startDecision`). Covered by the fake-session
  stop test (2 running → SIGTERM → third stays `not-started`).
- **CI column blind on failure/pending** (`gh pr checks` exits 1/8): `gh` now
  parses stdout regardless of exit code; `summarizeChecks` unit-tested.
- **Wave budget not enforced:** `estimateWaveTokens` uses the higher of the
  checkpoint ledger and the parsed JSONL floor per batch; `startDecision` stops
  launching at the wave soft/hard budgets. Unit-tested.
- **No lifecycle test:** added a fake-session integration test (happy path) and
  a second one for the stop path; the stop test asserts the queued third batch
  is `not-started`.
- **Duplicate wave id clobber:** `run` refuses a live wave (state + pid) and uses
  an `O_EXCL` lock with stale-lock recovery; a completed/stale wave can be reused.

Checks after fixes: lint / typecheck / test **718** / build green.
