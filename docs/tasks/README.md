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
- **Owner-blocked tasks STOP the flow (owner instruction, 2026-09-29):** if the next task needs an owner action (GitHub/Cloudflare accounts, secrets, dataset, permissions), STOP and report what's needed — do NOT skip to another task to "fill the gap".
- **NEVER run scaffolding/build tools with `--overwrite`/force flags in the repo root** — `docs/`, `AGENTS.md`, and the PDF are precious. Merge scaffold files manually.