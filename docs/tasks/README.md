# Task files

One file per task. A fresh agent session must be able to execute it reading **only** this file + the files it points to. See decisions/004 for the strategy.

## Format
```markdown
# P#-##: Title
**Phase:** P# · **Status:** todo · **Model:** build-cheap | build-strong | plan
## Goal
The end state, one short paragraph. Not the steps.
## Read first (context pack)
Exact files/sections to read. Nothing more.
## Constraints
What NOT to do / touch / add.
## Steps
Numbered, minimal.
## Acceptance (executable)
Runnable commands or observable checks. ALL must pass.
## Notes
Optional.
```

## Rules
- Scope: 15–45 min of agent work. Bigger → split.
- One concern per task.
- If acceptance criteria can't be written as runnable checks, the task is too vague — refine before starting.
- Model tiers: `build-cheap` (Kimi K2.7 Code / DeepSeek V4 Flash) · `build-strong` (Kimi K3) · `plan` (Kimi K3+).
- When done: update the task Status, update `docs/progress.md`, commit (conventional commits).
- **Code review (light by default — owner instruction, revised 2026-10-15 for token cost):** before opening the PR, run **ONE** `code-reviewer` pass (`/code-review`) on the **source-only** diff (`git diff main...HEAD -- src tools e2e .github playwright.config.ts vite.config.ts package.json`) on a fast model, with a capped output (verdict + ≤5 findings + signal). Fix blockers/should-fixes. **Escalate to the ≤2-round loop** on a plan-tier model (`/code-review-loop`) only for high-risk changes (architecture, security, persistence/serialization, catalog schema, CI/build, new deps) or if the light pass reports a blocker. **Skip** for docs-only / screenshot-only changes. Record the verdict in `docs/progress.md`. See AGENTS.md → Code review + `docs/decisions/006-code-review-governance.md`.
- **PR description standard (owner instruction, 2026-09-30):** every PR must include 5 sections — **Summary** (what/why, tie to task+roadmap), **Changes** (files + decisions + deviations), **Testing steps** (exact commands run + results, mapped to acceptance criteria), **Screenshots** (Playwright screenshots whenever there's a visible UI change — required for canvas/panel/modal/theming work), **Owner review hints** (the 3 max most important, specific things for the owner to verify — exact risks/edge cases of THIS PR, never generic advice, never padded).
- **Visual verification is delegated (owner instruction, 2026-10-15):** whenever rendered pixels must be judged (the Screenshots section, a visual claim), run the `design-reviewer` agent (`/visual-review`) — never judge images with the builder model, which may be text-only. See AGENTS.md → Design gate. State the reviewer's verdict in the PR.
- **PRs are NOT auto-merged (owner instruction, 2026-09-30):** the owner reviews and approves every PR before merge. Sessions prepare the PR to the full standard, STOP, and hand it to the owner with the review hints — sessions must NOT merge their own PRs. The owner merges or sends it back with feedback.
- **Owner-blocked tasks STOP the flow (owner instruction, 2026-09-29):** if the next task needs an owner action (GitHub/Cloudflare accounts, secrets, dataset, permissions), STOP and report what's needed — do NOT skip to another task to "fill the gap".
- **Owner instructions must be full + concise (owner instruction, 2026-09-29):** when reporting a blocker, write the complete step-by-step instructions for the owner — exactly what to click/create/enter, in order, plain language, as short as possible, every step actionable and unambiguous. Record them in `docs/progress.md` → Blockers.
- **NEVER run scaffolding/build tools with `--overwrite`/force flags in the repo root** — `docs/`, `AGENTS.md`, and the PDF are precious. Merge scaffold files manually.