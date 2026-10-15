---
description: Run the design-reviewer agent on ACTUAL rendered screenshots (pixels) — per-option verdicts, ranked, with a preferred pick.
agent: design-reviewer
---

You are running the visual design review. You must inspect real screenshots — never the code alone.

**Both viewports are required (owner instruction, 2026-10-15):** the review must include a **desktop** AND a **narrow/mobile** render for any UI/canvas change. If only one viewport is provided, say so explicitly and flag the responsive side as unverified — a desktop-only review is incomplete.

Inputs:
- $ARGUMENTS = screenshot file paths (space-separated), OR `PR <n>` to review a PR's committed screenshots, OR empty to auto-discover.
- If `PR <n>`: run `gh pr view <n> --json files` and `gh pr diff <n> --name-only`, then open the PNG files (they exist on the PR branch; if needed `gh pr checkout <n>` is NOT allowed — instead read them from the branch with `git show <branch>:<path> > /tmp/<name>.png`).
- If empty: look for `docs/screenshots/**/*.png` (latest task folder) and review those.

Then: Read every screenshot with the Read tool and produce the exact output format defined in your agent prompt (per-option verdict · findings · ranking + PREFERRED pick · cross-option gaps). End with a one-line headline: `PREFERRED: <option>`.

If you cannot see any image, reply `CANNOT_SEE` and stop.