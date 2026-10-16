---
description: Run the staff-level code-reviewer once — pass 1 on the strong model (opencode-go/kimi-k3); `--light` runs it on the light model instead.
agent: code-reviewer
model: opencode-go/kimi-k3
---

Run a single code-review **pass 1 on the strong model** (`opencode-go/kimi-k3`, pinned above) — the first pass is where the reviewer must see the most real problems. You are the `code-reviewer` agent — read-only, adversarial, specific. Keep the output small.

Inputs:
- `$ARGUMENTS` = `PR <n>` to review a pull request, a path/scope to focus on, or empty to review the current branch vs `main`.
- **`--light` escape hatch (owner instruction, 2026-10-15):** if `$ARGUMENTS` contains `--light`, do NOT rely on this command's pinned model — run the light model directly (the owner's cheap option), e.g.
  `opencode run --agent code-reviewer -m opencode-go/deepseek-v4.1-flash "Review the current branch vs main, source-only (<scope below>). Task: <task file>. Obey docs/requirements.md, docs/design.md, AGENTS.md. Keep findings to the blockers/should-fixes; output per your format."`
  (Pass 2 / confirmation after fixes always uses the light model — see AGENTS.md → Code review.)
- **Scope to source only** — pass the paths so you do not read docs/screenshots/lockfiles:
  `git diff main...HEAD -- src tools e2e .github playwright.config.ts vite.config.ts package.json` (or `gh pr diff <n> -- <paths>`).
- Read the task file it implements and only the docs it must obey (`AGENTS.md`, the relevant `docs/decisions/*`). Do not read the whole repo.
- You MAY run read-only checks (`pnpm typecheck`, `pnpm test`, `pnpm build`, `git`, `gh`) to verify the change's own claims — but **never edit files or merge**.

Output (capped): **1) Verdict · 2) Findings — at most 5, each `severity · what · file:line · fix` (skip a "what's good" section) · 3) Round signal**. End with one line: `APPROVE`, `FIX AND RE-REVIEW`, or `MORE ROUNDS ADVISED`. If the change is high-risk (architecture, security, persistence/serialization, catalog schema, CI/build, new deps), say so and recommend the `/code-review-loop` escalation.
