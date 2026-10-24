# UX-heavy rework playbook

The recipe that produced the P2-01 "Specimen Bench" result (owner-endorsed,
2026-10-17). Use it whenever a task is **UX/UI-concentrated** — a redesign, a
"this looks bad / could be much better" request, a visual overhaul, a new
component system, or any task where the *experience* is the deliverable.

It is the manual recall path (`/ux-polish`) and the automatic one (the
`ux-polish` skill surfaces it whenever a UX-heavy task is detected). It is
**additive** to the Design gate in `AGENTS.md`; where they differ, this playbook's
**~5-round budget** applies to a UX-heavy rework, and the owner confirms it per
task.

## The 7 phases

0. **Root-cause the real problems first (no guessing).**
   Read the task + the pointed docs/code. For every owner complaint, find the
   *actual* cause before proposing anything (e.g. verify a host's CORS headers,
   read the placement math, read the hover implementation). Write the findings
   down as a small table (symptom → verified cause → evidence `file:line`).
   A redesign that doesn't fix the real defects just moves them.

1. **Designer proposes a fresh/bolder direction → OWNER APPROVES BEFORE UI.**
   Run the `designer` for a *new* direction (not a restyle). It must follow its
   research protocol and return the full proposal (direction name, surfaces,
   token deltas, spacing/type, do/don't, ≤2 open questions). Present it to the
   owner **compactly** and get explicit approval + a decision on any open
   questions. Do not write UI code before the owner approves a direction.

2. **Implement the approved direction.**
   Tokens only (`src/styles/tokens.css` + `src/styles/theme.ts`), dark default +
   light override, one accent hue, AA contrast. No hardcoded visual values in
   components.

3. **Fold in the concrete UX/visual fixes from phase 0.**
   Placement, labels, hover, empty states, responsive chrome — everything the
   root-cause pass found. Same design gate applies.

4. **Expand the automated QA for the new surface.**
   Add Playwright coverage for the new interactions on **desktop AND mobile**
   (the repo's `mobile-chromium` project already runs picker-style specs).
   Cover happy paths + edge cases (empty, wrap/clip, keyboard, de-stack, image
   fallback). This is a deliverable, not an afterthought.

5. **Designer⇄reviewer loop until the reviewer approves (cap ~5 rounds).**
   - **Every round = reviewer feedback (on RENDERED pixels) → designer revision
     (exact values/tokens) → implementation in code → re-render → commit that
     round.**
   - The `design-reviewer` judges **screenshots**, never code — **desktop AND
     mobile, dark AND light.** Capture them with Playwright first.
   - Batch each round's findings into one change; implement it; re-render; only
     then run the next review. A round that only yields comments is **not** a
     round.
   - Commit **per round** so the owner can revert to any round.
   - Stop on a reviewer **approve**. At the cap with no approval, **STOP** and
     hand the open findings to the owner.

6. **Code review (light model, source-scoped) → fix findings.**
   `/code-review` (one pass; escalate to `/code-review-loop` only for high-risk
   changes). Scope to source. Fix blockers + should-fixes; nits only if trivial.
   ≤2 passes, then hand remaining findings to the owner.

7. **Ship one PR to the review standard.**
   Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
   Embed desktop + mobile screenshots inline (raw URL at the commit SHA). Include
   the **review-round digest** (one line per designer / design-reviewer /
   code-review pass: reviewer · verdict · what it changed). **Do not merge** —
   hand it to the owner with ≤3 specific review hints.

## Non-negotiables

- Owner approves the **direction** before any UI; owner approves the **final**
  result before merge.
- **Never eyeball pixels with a builder model** — delegate to `design-reviewer`.
- **Paid vision only (owner instruction, 2026-10-24):** reviewer runs `opencode/gemini-3.6-flash` (or another paid vision model). Never use a free vision model.
  If you can't see an image, say so; never invent a critique.
- **Never hand-tune colors/tokens without the designer.**
- One task = **one PR**.
- Record the direction name, the round count, the reviewer verdicts, and each
  reviewer's changes in `docs/progress.md`.

## Why these steps (what the P2-01 run proved)

- Root-causing first found the *real* bugs (a `crossOrigin` that would break
  non-CORS hosts; a `barRef` never attached; a placement that stacked), instead
  of polishing over them.
- Approve-the-direction-first stopped wasted implementation on a direction the
  owner didn't want.
- Pixel-first review with exact designer values turned vague "looks bad" into
  concrete, shippable fixes in ~4 rounds.
- Expanding QA in the same task kept the new surface honest.
