---
description: ESCALATION — ≤2-pass code review+fix loop (pass 1 strong, pass 2 light) for a HIGH-RISK task. Default is the single strong /code-review pass. Stops after pass 2; escalates to the owner if issues remain.
agent: build
---

Run the **code review loop** for the task in `$ARGUMENTS` (default: the current task from `docs/progress.md`). **This is the escalation only** — use it when the change is high-risk (architecture, security, persistence/serialization, catalog schema, CI/build, new dependencies), or the strong `/code-review` pass 1 reported a blocker, or the owner asked. For everything else, run the single `/code-review` pass.

Goal: the `code-reviewer` gets up to **two passes**, and you fix real findings between them. **Pass 1 = strong model (`opencode-go/kimi-k3`); pass 2 = light model (`opencode-go/deepseek-v4.1-flash`)** — the test suite is the primary re-check (owner instruction, 2026-10-15).

Rules:
- **Max 2 passes.** A pass = reviewer feedback → you fix the real findings in code → re-review.
- **After pass 2, STOP.** If blockers/should-fixes remain, do NOT open the PR as ready — tell the owner plainly what is still open and **propose more passes**; wait for their decision.
- Only the reviewer's *real* findings get fixed. If you reject a finding, say why in one line.
- **Scope the diff to source only** (docs/screenshots/lockfiles excluded) to keep it cheap.

Each pass:
1. **Review** — source-only:
   - **Pass 1 (strong):** `opencode run --agent code-reviewer -m opencode-go/kimi-k3 "Review the current branch vs main, source-only (git diff main...HEAD -- src tools e2e .github playwright.config.ts vite.config.ts package.json). Task: <task file / summary>. Obey docs/requirements.md, docs/design.md, AGENTS.md. Keep findings to the blockers/should-fixes; output per your format."`
   - **Pass 2 (light):** the same command with `-m opencode-go/deepseek-v4.1-flash`.
2. **Triage & fix** — for each blocker/should-fix: fix it in code (nits: fix if cheap, else justify deferring). Re-run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. **Commit** the fixes as their own commit (`fix: address code-review pass N — <what>`), so passes stay revertible.
4. If the reviewer's verdict is **approve** → stop early (success). Otherwise next pass.

After the loop: report the final verdict, pass count, and any remaining findings; record the outcome in `docs/progress.md`; then either open the PR (full 5-section standard) or, if unresolved, hand back to the owner.
