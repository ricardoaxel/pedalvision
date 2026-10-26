# catalog-wave

Launch and supervise up to **3 independent batch sessions** from one wave plan,
and produce a single report the coordinator can read instead of raw logs.

## Why

The batch sessions are separate `opencode run` processes. Launching them by hand
in the background gives no consolidated status and no report-back. `catalog:wave`
wraps that missing glue, while `catalog-runner` remains the single control plane
(state, caps, pause/stop, SIGTERM fallback).

## Usage

```bash
# 1. Write a plan (1–3 batches; prompt xor promptFile)
cat > work/catalog/waves/boss-wave-2.json <<'JSON'
{
  "id": "boss-wave-2",
  "maxParallel": 3,
  "batches": [
    {
      "batch": "boss/boss-2",
      "kind": "pedals",
      "brand": "BOSS",
      "total": 26,
      "worktree": "../pedalvision-p5-03-boss-2",
      "branch": "p5-03-pedals-boss-2",
      "promptFile": "../prompts/boss-2.md"
    }
  ]
}
JSON

pnpm catalog:wave run --plan work/catalog/waves/boss-wave-2.json   # detached
pnpm catalog:wave status --wave boss-wave-2 --wait
pnpm catalog:wave report --wave boss-wave-2
```

`--foreground` keeps the runner attached (useful in tests/CI); `--dry-run`
validates the plan and prints what would launch.

## Contract

- The wrapper runs `catalog:start` for each batch, so the **prompt must not call
  `catalog:start`**. The prompt must checkpoint inline after every item and
  finish with `catalog:finish`.
- Starts **2** batches. A third starts only when the first is past midpoint, has
  used ≤40% of the 400k **billed** soft budget and is sustaining ≥2 items/h
  (`canStartNext`). The gate and the 1.2M/2.4M wave budgets use the true
  **billed non-cache** metric (`input + output + reasoning` from each session's
  JSONL), never the self-reported runner `.tokens`. Max 3 in flight, enforced by
  `catalog-runner`.
- On every refresh the runner recomputes each active batch from its JSONL; the
  checkpoint ledger is only a fallback when the JSONL has no `step_finish` yet.
  At the wave **hard** cap the runner requests stop for every active batch and
  marks queued batches `not-started`; at the soft cap it stops launching, without
  killing healthy active batches.
- Each session runs as
  `opencode run --auto --format json` under
  `catalog-runner supervise --batch <id> -- …`, so pause/stop and SIGTERM/SIGKILL
  stay in the tested runner.
- JSONL is captured per batch. The report shows **billed non-cache** (gated) and
  the **cache-inclusive JSONL floor** (reported separately, not gated). Both are
  **root-session floors**: subagent sessions (image/code reviewers) are not in
  this stream. A run with no `step_finish` is `partial`, never a success; error
  events are reported.
- PR/CI lookup is best-effort via `gh`; a missing PR or unauthenticated `gh` is
  reported as unknown, never assumed.
- The wrapper **never merges** and never opens PRs. Each session owns exactly one
  PR in its own branch/worktree.

## Token metric

`opencode` `step_finish` events carry `tokens.{input,output,reasoning,cache.read,cache.write,total}`.

- **Billed non-cache** = `input + output + reasoning`. This is the value the
  per-batch (400k/800k) and wave (1.2M/2.4M) budgets use.
- **Cache-inclusive floor** = `total` (summed over steps), reported separately as
  context, never gated.
- If a step omits `total`, the floor is derived by summing the recognised fields.
- If the JSONL has a total but the step omits `input`/`output`/`reasoning`, the
  total is used as a conservative billed **upper bound** (labelled
  `(upper bound)`) so the budget can never under-count.
- Only when the JSONL has no token numbers at all is the checkpoint ledger used,
  labelled `(ledger)`; totals that include either fallback say so.

## Files

```text
work/catalog/waves/<id>/state.json     # live wave state
work/catalog/waves/<id>/report.md      # one line per batch + session report backs
work/catalog/waves/<id>/runner.log     # detached runner output
work/catalog/waves/<id>/<brand>__<batch>.jsonl
```
