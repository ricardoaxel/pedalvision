---
description: Orchestrate the designer⇄reviewer design loop (max 3 iterations) on a design task. EVERY round = reviewer feedback + designer revision + code implementation + re-render. Owner-approved before start.
agent: build
---

Run the **design loop** for the design task in `$ARGUMENTS`. This is heavy design work — before starting, confirm the owner has approved running the loop and has named (or approved) the starting direction. If not, ask and STOP.

**A round is only complete when the change is IMPLEMENTED IN CODE and RE-RENDERED.** Comments alone do not count as a round. Max **3** rounds; stop early only if the reviewer says "approve".

Each round does ALL of:
1. **Reviewer feedback (sees the current pixels):** run the design-reviewer on the current screenshots.
   `opencode run --agent design-reviewer -m opencode-go/deepseek-v4-flash-vision-exp -f <png paths...> "<review the attached renders>"`
2. **Designer revision (authority):** give the designer the reviewer's findings; get the revised direction/values.
   `opencode run --agent designer "<current direction + reviewer findings → revised tokens/type/layout>"`
3. **Implement:** apply the revision to code yourself (all visual values in `src/styles/tokens.css` + `src/styles/theme.ts`; components use tokens only).
4. **Re-render:** build and capture fresh screenshots (dark + light) with Playwright into `docs/screenshots/<task>/`.
5. **Commit this round** as its own commit (`feat: <task> round N — <what changed>`), so any round can be reverted individually later.
6. If the reviewer's last verdict was **approve** → stop; otherwise next round.

After the loop: report the final reviewer verdict, iteration count, and diffs; **do not merge**. Record the outcome + owner approval in `docs/progress.md`.

Never hand-tune colors without the designer; never accept a reviewer verdict without seeing the same screenshots it saw; never end a round without the code change and the new render.