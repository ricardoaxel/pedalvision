# ADR-006: Code review governance — external reviewer, light by default

**Status:** Accepted (2026-10-13; revised 2026-10-15 — cost)

## Context
The design work gained an external, adversarial reviewer with self-correcting rounds (ADR-005), and it caught real problems before they reached the owner. Code work had **no equivalent**: a task was implemented, its acceptance criteria run, and the PR handed straight to the owner (plus Copilot) — the owner was the first real reviewer. That surfaced avoidable issues in-loop-for-the-owner (e.g. the P0-04 progress/roadmap/status contradiction, PR #4) that an adversarial code pass should have caught.

## Decision
1. **An external `code-reviewer` agent is the code-review authority.** A staff-level software engineer lives in `.opencode/agent/code-reviewer.md`, run via `/code-review`. It reviews the diff (not the author) across: correctness & acceptance, architecture & structure (`docs/design.md`), security, tests, plan/doc consistency, and minimalism/conventions. It is **read-only** — never edits or merges.
2. **Default is ONE lightweight pass (no loop), on a fast/cheap model.** Before a PR, the changed **source** is reviewed once (`/code-review`, model `opencode-go/deepseek-v4.1-flash`), scoped to source paths (docs/screenshots/lockfiles excluded), with output capped to a verdict + ≤5 findings + a round signal. *(Revised 2026-10-15: the original always-on 2-round plan-tier loop cost too many tokens for routine 15–45 min tasks.)*
3. **Escalate to the 2-round loop on a plan-tier model only when risk warrants it:** architecture, security, persistence/serialization, catalog schema, CI/build, new dependencies, a blocker from the light pass, or the owner asks. Then: round = reviewer findings → fix → re-review; **max 2 rounds**, each round's fixes committed separately (revertible). After round 2, if blockers/should-fixes remain, the builder must **not** open the PR as ready — it tells the owner plainly what is still open and **proposes more rounds**, then waits. (Same escalation spirit as the owner-blocked rule.)
4. **Division of authority:** the code-reviewer owns *code / architecture / security / correctness*; the design gate (ADR-005) owns *visual direction*. They are independent and both apply when a task touches both — but the visual check runs **only when pixels actually changed**.
5. **Skip the review** for docs-only / screenshot-only / pure-formatting changes.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Rely on Copilot + owner PR review only | Owner becomes the first real reviewer; bookkeeping/consistency slips reach the owner (P0-04) |
| Full unlimited review loop | Unbounded cost/time for 15–45 min tasks |
| Always-on 2-round plan-tier loop | Too many tokens/rounds for routine tasks; a light pass + risk-based escalation gets most of the value at a fraction of the cost (revision 2026-10-15) |
| Reviewer that edits code directly | Blurs author/reviewer; keeps a single accountable builder and a clean, revertible diff |
| Phase-gate review only (ADR-004) | Too late — catches drift a whole phase later; per-task review catches it while the diff is small |

## Consequences
- Every task's flow becomes: implement → verify acceptance → **light code review (one pass)** → open PR (5-section standard) → owner reviews/merges. High-risk tasks additionally run the ≤2-round loop.
- Orchestrate with `/code-review` (single light pass, the default) or `/code-review-loop` (the escalation, ≤2 rounds).
- The reviewer's verdict and any remaining findings are recorded in `docs/progress.md` (the PR description notes the review ran).
- Cost stays bounded: scoped source-only diff, capped output, fast default model.
