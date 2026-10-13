# ADR-006: Code review governance — external reviewer + 2-round loop

**Status:** Accepted (2026-10-13)

## Context
The design work gained an external, adversarial reviewer with self-correcting rounds (ADR-005), and it caught real problems before they reached the owner. Code work had **no equivalent**: a task was implemented, its acceptance criteria run, and the PR handed straight to the owner (plus Copilot) — the owner was the first real reviewer. That surfaced avoidable issues in-loop-for-the-owner (e.g. the P0-04 progress/roadmap/status contradiction, PR #4) that an adversarial code pass should have caught.

## Decision
1. **An external `code-reviewer` agent is the code-review authority.** A staff-level software engineer lives in `.opencode/agent/code-reviewer.md`, run via `/code-review`. It reviews the diff (not the author) across: correctness & acceptance, architecture & structure (`docs/design.md`), security, tests, plan/doc consistency, and minimalism/conventions. It is **read-only** — never edits or merges.
2. **Every task runs a code review loop before its PR is opened.** Up to **2 rounds**: round = reviewer findings → builder fixes the real findings → re-review. Stop early on "approve". Each round's fixes are committed separately (revertible).
3. **After round 2, stop.** If blockers/should-fixes remain, the builder must **not** open the PR as ready — it tells the owner plainly what is still open and **proposes more rounds**, then waits. (Same escalation spirit as the owner-blocked rule.)
4. **Division of authority:** the code-reviewer owns *code / architecture / security / correctness*; the design gate (ADR-005) owns *visual direction*. They are independent and both apply when a task touches both.
5. **Model:** run the reviewer on a strong plan-tier model (Kimi K3 or better). It is a review, so a strong model pays for itself.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Rely on Copilot + owner PR review only | Owner becomes the first real reviewer; bookkeeping/consistency slips reach the owner (P0-04) |
| Full unlimited review loop | Unbounded cost/time for 15–45 min tasks; 2 rounds + owner escalation is the right cap |
| Reviewer that edits code directly | Blurs author/reviewer; keeps a single accountable builder and a clean, revertible diff |
| Phase-gate review only (ADR-004) | Too late — catches drift a whole phase later; per-task review catches it while the diff is small |

## Consequences
- Every task's flow becomes: implement → verify acceptance → **code review loop (≤2 rounds)** → open PR (5-section standard) → owner reviews/merges.
- Orchestrate with `/code-review-loop`; a single pass is `/code-review`.
- The reviewer's findings + round count/verdict are recorded in `docs/progress.md` (and the PR description notes the loop ran).
- Tasks get a bit slower/costlier; the payoff is fewer issues reaching the owner and a small, clean, self-reviewed diff.
