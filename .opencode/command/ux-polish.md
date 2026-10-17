---
description: Run the UX-heavy rework playbook (docs/design-playbook.md) for a UX/UI-concentrated task — root-cause, designer direction (owner-approved), implement, expand QA, designer⇄reviewer loop (~5 rounds), code review, one PR.
agent: build
---

Run the **UX-heavy rework playbook** for `$ARGUMENTS`.

Read `docs/design-playbook.md` and follow it end to end. It is the source of
truth for this flow; this command is the recall entry point.

**Before any UI code:** root-cause the real defects, then run the `designer`
for a **new/bolder direction** and get the **owner's explicit approval** of the
direction (and answers to its open questions). If the owner has not approved a
direction, STOP and ask.

**Round budget:** loop designer⇄reviewer **until the reviewer approves, hard cap
~5 rounds** (this playbook's budget supersedes the standing ≤2 cap for a
UX-heavy rework; confirm with the owner if unsure). Every round = reviewer
feedback on **rendered pixels (desktop + mobile, dark + light)** → designer
revision with exact values → implement in code → re-render → commit that round.

**Also required in the same task:** fold in the phase-0 UX/visual fixes, and
expand the Playwright QA for the new surface (desktop + mobile). End with a
light `/code-review`, the full checks, screenshots embedded at the commit SHA,
the review-round digest, and `docs/progress.md` updated. **One PR; do not
merge — hand it to the owner with ≤3 review hints.**
