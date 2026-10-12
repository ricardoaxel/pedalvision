---
description: Run the designer agent on the current design or a design PR — propose direction or review before committing design work.
agent: designer
---

You are being asked to review or shape the design for Pedalvision. Follow the context and produce exactly the deliverable the owner asked for.

Context to start from — read:
- `AGENTS.md` → the design gate rules and any design-task rule
- `src/styles/tokens.css`, `src/styles/theme.ts`, `src/index.css`, `src/App.tsx` — the current visual state
- The task file that produced the current design (match by roadmap item), e.g. `docs/tasks/P0-03-design-tokens.md`
- If a PR number is given ($ARGUMENTS), read the PR diff and its task file too.

Work to run:
- $ARGUMENTS is the scope. If it says "propose": follow deliverable A (design-direction / palette proposal) and end with the owner-approval questions.
- If it says "review", "PR <n>", or nothing specific: follow deliverable B (design review) on the current design.

Do not edit files. End your output with a 3–5 word headline verdict the owner can read at a glance.