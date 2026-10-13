---
description: Orchestrate the designer⇄reviewer design loop (max 3 iterations) on a design task, then stop for owner approval.
agent: build
---

Run the **design loop** for the design task in `$ARGUMENTS`. This is heavy design work — before starting, confirm the owner has approved running the loop (if not, ask and STOP).

Loop (max **3** iterations; stop early if the reviewer approves):
1. **Designer (authority):** run the designer agent to get the direction / the changes for this iteration.
   `opencode run --agent designer -m <vision-or-plan model> "<task + reviewer comments from last round>"`
2. **Implement:** apply the designer's direction to code (tokens/theme/components) yourself. Keep all visual values in `src/styles/tokens.css` + `src/styles/theme.ts`.
3. **Render:** build and capture screenshots of the result (dark + light) with Playwright into `docs/screenshots/<task>/`.
4. **Reviewer (sees pixels):** run the visual reviewer on those screenshots.
   `opencode run --agent design-reviewer -m opencode-go/deepseek-v4-flash-vision-exp -f <png paths...> "<review the attached renders>"`
5. If the reviewer says **approve** → stop. Otherwise feed its findings to the next designer iteration (go to step 1).

After the loop: report to the owner the final reviewer verdict, the iteration count, and the diffs; **do not merge**. Record the outcome + the owner's approval in `docs/progress.md`.

Never hand-tune colors without the designer; never accept a reviewer verdict without seeing the same screenshots it saw.