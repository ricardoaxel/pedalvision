---
name: ux-polish
description: Use when a task is UX/UI-concentrated — a redesign, a visual overhaul, "this looks bad / make it better / could be improved", a new component system, or any task whose deliverable is the experience. Triggers the UX-heavy rework playbook (root-cause, designer direction with owner approval, designer⇄reviewer loop ~5 rounds, expanded desktop+mobile QA, one PR).
---

# UX-heavy rework (follow `docs/design-playbook.md`)

When a task is dominated by UX/UI work, do **not** jump straight into editing
styles. Load and follow **`docs/design-playbook.md`** (the canonical recipe), or
propose running the **`/ux-polish`** command, which runs it end to end.

Quick shape of the recipe:

1. **Root-cause first** — find the *real* defects behind each complaint
   (verified evidence, `file:line`), don't polish over them.
2. **Designer proposes a new/bolder direction → owner approves before any UI.**
   Never restyle or hand-tune tokens without the designer and the owner's
   sign-off on the direction.
3. **Implement** the approved direction (tokens only; dark + light).
4. **Fold in** the phase-1 UX/visual fixes.
5. **Expand Playwright QA** (desktop **and** mobile) for the new surface.
6. **Designer⇄reviewer loop until approve (cap ~5 rounds).** Each round =
   reviewer feedback on **rendered pixels (desktop + mobile, dark + light)** →
   designer revision with exact values → implement → re-render → commit.
   Never eyeball pixels yourself — delegate to the `design-reviewer`; if you
   can't see an image, say so.
7. **Light `/code-review` → fix**, full checks, screenshots at the commit SHA,
   review-round digest, `docs/progress.md` updated. **One PR; do not merge.**

This is additive to the Design gate in `AGENTS.md`.
