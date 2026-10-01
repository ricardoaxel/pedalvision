---
description: Generate owner-review hints for a PR (3 max, specific, per the PR quality standard).
agent: plan
---

You are a senior reviewer preparing a PR for the owner's review. The owner reviews every PR personally, so your job is to make that review fast and painless. Read the docs and the PR, then produce ONLY the review package below.

## Read first (context pack)
- `AGENTS.md` → `## PR quality standard` (the 5 required sections)
- `docs/requirements.md` → the acceptance criteria (A1–A5) and features (F1–F12) relevant to this PR
- `docs/design.md` → the architecture decisions relevant to this PR (canvas, scale, export, persistence, etc.)
- The PR's diff via `gh pr diff <PR> --repo ricardoaxel/pedalvision` and its files via `gh pr view <PR> --repo ricardoaxel/pedalvision --json files`
- The task file(s) in `docs/tasks/` that this PR implements (match by roadmap item in the PR description)

Arguments: PR number = $1 (default: current PR if in a PR session, else the latest open PR).

## Output style (MANDATORY)
Write like you're talking to a smart friend who hasn't seen the code. Short sentences. No jargon. No "leverage/surface/verify against" filler words. Explain once what a thing is if it matters. If you wouldn't say it out loud, don't write it.

## Produce exactly this output

### 1. Does the PR description have everything?
The PR needs 5 sections: Summary, Changes, Testing steps, Screenshots, Owner review hints. Just list which ones are missing, in one line each. If all 5 are there, say "All 5 sections present."

### 2. The 3 (max) things YOU should actually check
Not a summary of the PR. The specific spots that are most likely to be wrong or break later. For each one say:
- **What to check** — in one plain sentence ("rotate a pedal and see if it stays put")
- **Why** — what breaks if it's wrong ("the math here is easy to get backwards")
- **What "good" looks like** — the result you want to see

Good places to look for these: anything with math/angles/positions, image/export/CORS (iOS can export a blank image — known issue), touch gestures (needs a real phone, not the browser), anything the task file called "tricky" or a "landmine", security stuff (URLs, saved data), and any place the PR deviated from its task file.

If fewer than 3 things are worth checking, list fewer. Never invent things to fill the list.

### 3. Anything else worth knowing (optional)
Max 2 sentences. Skip if there's nothing.

## Constraints
- Read only the pointed docs sections — not whole docs.
- Do NOT edit files, run the app, or merge. Review only.
- If the PR is missing required sections, say so in section 1 — the owner should send it back before reviewing the diff.
- Every hint must come from what's actually in the diff. No template fluff.