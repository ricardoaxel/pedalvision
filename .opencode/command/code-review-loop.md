---
description: Orchestrate the ≤2-round code review+fix loop on the current task before opening its PR. Reviewer = code-reviewer agent. Stops after round 2; escalates to the owner if issues remain.
agent: build
---

Run the **code review loop** for the task in `$ARGUMENTS` (default: the current task from `docs/progress.md`). Goal: the `code-reviewer` gets up to **two** passes, and you fix real findings between rounds.

Rules:
- **Max 2 rounds.** A round = reviewer feedback → you fix the real findings in code → re-review.
- **After round 2, STOP.** If blockers/should-fixes remain, do NOT open the PR as ready — tell the owner plainly what is still open and **propose more rounds**; wait for their decision.
- Only the reviewer's *real* findings get fixed. If you reject a finding, say why in one line.

Each round:
1. **Review** — run the code-reviewer on the current diff:
   `opencode run --agent code-reviewer "Review the current branch vs main. Task: <task file / summary>. Obey docs/requirements.md, docs/design.md, AGENTS.md. Output per your format."`
2. **Triage & fix** — for each blocker/should-fix: fix it in code (nits: fix if cheap, else justify deferring). Re-run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. **Commit** the fixes as their own commit (`fix: address code-review rN — <what>`), so rounds stay revertible.
4. If the reviewer's verdict is **approve** → stop early (success). Otherwise next round.

After the loop: report the final verdict, round count, and any remaining findings; record the outcome in `docs/progress.md`; then either open the PR (full 5-section standard) or, if unresolved, hand back to the owner.
