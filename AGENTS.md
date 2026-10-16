# Pedalvision — Agent Guide

2D true-scale guitar pedalboard planner. Web app, desktop + mobile responsive.

## Stack

React 19 · TypeScript · Vite · Konva (react-konva) · Zustand · pnpm · Vitest · Playwright · Biome
Hosting: Cloudflare Pages (app + v1 image assets, same-origin) · R2 deferred (ADR-002) · CI: GitHub Actions

## Commands

| Task                     | Command            |
| ------------------------ | ------------------ |
| Dev server               | `pnpm dev`         |
| Build                    | `pnpm build`       |
| Unit tests               | `pnpm test`        |
| Typecheck                | `pnpm typecheck`   |
| Lint + format            | `pnpm lint`        |
| E2E smoke                | `pnpm e2e`         |

> Deferred: `pnpm assets:sync` (R2-era image sync) does not exist until P2-07 — do not run it.

## Repo map

- `docs/requirements.md` — product spec (features, non-goals, acceptance criteria)
- `docs/design.md` — architecture & data model
- `docs/roadmap.md` — phases / epics / task index
- `docs/phase-guide.md` — what each phase does + which ones need owner action (and why)
- `docs/progress.md` — current status (**read first, update last**)
- `docs/decisions/` — ADRs (why things are the way they are)
- `docs/tasks/` — one self-contained file per task
- `src/` (from P0) — app code
- `public/pedal-assets/` — committed pedal/board images (v1, same-origin; ADR-002)
- `tools/` (from P0/P2) — dev tooling (asset pipeline, catalog transformer)

## Session protocol (MANDATORY)

1. Read `docs/progress.md` → find the current task.
2. Read the task file in `docs/tasks/` — it lists exactly which files/sections to read. Read **only** those.
3. Do the task. Verify its acceptance criteria by running them. Then run the **code review** (light model; see below) before opening the PR.
4. Update `docs/progress.md` (done / next / blockers) — this is the handoff memory for the next session.
5. One task per session. Commit per task (conventional commits).
6. **Owner-blocked tasks STOP the flow (owner instruction, 2026-09-29).** If the next task — or any step of the current task — requires an owner action (GitHub repo, Cloudflare account/secrets, R2 bucket, dataset, permissions, etc. — see `docs/progress.md` → Blockers), **STOP and report to the owner**. Do NOT skip ahead to an unblocked task to "fill the gap". Wait for the owner to complete the required action before continuing.
7. **Blockers always ship with full, concise owner instructions (owner instruction, 2026-09-29).** For every owner-blocker you report, write the complete step-by-step instructions for the owner — exactly what to click/create/enter, in order, in plain language — but keep them as short as possible. Every step must be actionable and unambiguous (e.g. "create a repo named `pedalvision` (public), then run `git remote add origin <url>` and `git push -u origin main`"). Record them in `docs/progress.md` → Blockers so any future session can re-surface them. When the owner unblocks a task, remove that blocker from `progress.md`.
8. **Design-affecting tasks are gated (owner instruction, 2026-10-12).** If the current task touches design (tokens, theming, colors, typography, spacing, layout, components, or anything visibly rendered in the UI), follow the **Design gate** below. Never hand-tune a palette or restyle on owner feedback without running the designer agent first.
9. **A task is not "done" until its PR is merged (owner instruction, 2026-10-13).** Because every PR requires the owner's approval before merge (below), a task with an open PR is **in review**, not done. While its PR is open: mark it **`in review — PR #N`** in `docs/progress.md`, `docs/roadmap.md`, and the task file; keep **Next** pointing at the same task (pending merge); and do **NOT** start the following task. Do **not** list it under `Done`. When the owner merges, the merge finalizes it: move it to `Done`, advance `Next`, and reconcile the three files in one commit. Rationale: marking a task done while its PR is open contradicts the review-before-merge rule and lets the next session build on unmerged work. (Convention introduced while fixing exactly that contradiction on P0-04 / PR #4.)

## Design gate (MANDATORY — owner instruction, 2026-10-12)

- **The `designer` agent is the design authority** — a staff-level UX/UI expert (`.opencode/agent/designer.md`). Every design-affecting task — tokens, theming, layout, components, canvas visuals, responsive chrome — must be **reviewed by the designer agent before commit**, and its findings folded in. Run it with `/design-review` (optionally `/design-review <PR|propose>`). Rationale: docs/decisions/005-design-governance.md.
- **If the owner does a design task manually** (e.g. "this looks bad, restyle it"), ALWAYS propose to run the designer agent first — never immediately hand-edit colors/tokens. Present the designer's proposal and get the owner's approval before implementing (owner chooses direction; agents do not).
- **New/changed visual directions are owner-approved.** The designer produces the proposal; the owner approves it; only then is it implemented. Record the approval + the direction name in `docs/progress.md`.
- Design PRs must state in the PR description which designer review ran and its verdict, and (for P1+ canvas/UI work) the owner's approval of the direction.
- **Owner-directed simple changes skip the designer/reviewer too** (owner instruction, 2026-10-15) — see Code review → "Owner-directed simple changes skip review". A typo/one-line tweak inside an approved direction needs implementation + the checks, not a design pass.

### Heavy design tasks → designer⇄reviewer loop (owner instruction, 2026-10-12)
- **A "heavy design task"** is any task that establishes or changes a visual direction: a new/redone palette or theme, a new component system, canvas visuals, or a page/chrome overhaul. Small token tweaks / bug-fixes inside an already-approved direction are NOT heavy — the designer review alone (above) is enough.
- **The `design-reviewer` agent (`.opencode/agent/design-reviewer.md`) reviews the actual rendered pixels** — it opens the screenshots with a vision-capable model (default `opencode/nemotron-3.5-super-vl-free`), not the code. Run it with `/visual-review <paths|PR n>`.
- **Delegate ALL visual verification to the `design-reviewer` agent (owner instruction, 2026-10-15).** Any time rendered pixels must be judged — PR screenshots, a visual claim, "does this look right" — run the `design-reviewer` (or `/visual-review`). **Never eyeball images with the builder model:** builder models may be text-only and genuinely cannot see pixels, so a builder "description" of a screenshot would be inferred from context/filenames/code, not seen. If you cannot actually see an image, say so and delegate — do not invent a critique. This applies to every UI/canvas task, not only heavy design tasks.
- **Screenshots for the visual review cover desktop AND mobile (owner instruction, 2026-10-15).** Capture and review **both** a desktop viewport and a narrow/mobile viewport for any UI/canvas change, so the responsive chrome + touch layout are actually verified. The P1-03/P1-04 PRs ran desktop-only — that is the **last** exception; from the next design-affecting PR on, a review with only desktop renders is incomplete.
- **One visual review per frozen UI; hard cap ≤2 `design-reviewer` passes per task (owner instruction, 2026-10-15).** Freeze the UI, then run the `design-reviewer` **once**. **Batch every visual finding into a single change**, re-render, and re-run it **only when a fix materially changes the rendered result** (a layout/contrast/touch-visible change) — never per nit, and never for internal refactors or value tweaks inside an approved look (those need the checks, not a review). When a re-run is warranted, pass **explicit questions in one call** instead of reviewing repeatedly. The heavy-loop's 2 iterations count toward this cap. **At the cap with no approval, STOP** and hand the open findings to the owner.
- **Heavy design tasks run a designer⇄reviewer loop of up to 2 iterations (the same ≤2 `design-reviewer` cap above), only after the owner approves running it.** **Every iteration = reviewer feedback (on the rendered pixels) → designer revision → the change implemented in code → re-render (dark + light, desktop + mobile).** A round that only produces comments is NOT a round — implementation is mandatory each time. Stop early only on a reviewer "approve". Orchestrate with `/design-loop` (or step through manually).
- **The loop is gated on owner approval before it starts**, and the final result still goes to the owner for approval. Record iteration count, reviewer verdict, and approval in `docs/progress.md`.
- **Commit per round (owner instruction, 2026-10-13).** Each loop iteration is its own commit (round 1, round 2, …), so the owner can revert to any round ("go back to round X") with a simple `git revert`/checkout. Never squash multiple rounds into one commit.
- The reviewer is authoritative only for *what is on screen*; the designer remains the design authority. If they conflict, present both to the owner.

## Code review (MANDATORY — owner instructions 2026-10-13; revised 2026-10-15 — light model for every pass)

- **Default = ONE pass on the light model (owner instruction, 2026-10-15).** Before a task's PR, the changed **source** is reviewed once by the `code-reviewer` agent on the **light model** (`opencode-go/deepseek-v4.1-flash`, via `/code-review`) — **every** review pass uses the light model (the strong plan-tier model proved too expensive). The test suite is the primary re-check. Rationale: docs/decisions/006-code-review-governance.md.
- **Scope the diff to source only**: `git diff main...HEAD -- src tools e2e .github playwright.config.ts vite.config.ts package.json` — `docs/`, screenshots, and lockfiles are **out of scope**. Hand the reviewer the task-file path, not the repo; it reads only what it needs.
- **Cap the output**: verdict + at most **5** findings (blocker / should-fix / nit) + a one-line round signal. No "what's good" prose. This keeps the review small and the token cost bounded.
- **Fix blockers + should-fixes** (nits only if trivial); then re-run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- **Escalate to the ≤2-pass loop** (`/code-review-loop`, light model) **only when:** the change is high-risk (architecture, security, persistence/serialization, catalog schema, CI/build, new dependencies), OR pass 1 reports a blocker that needs a re-check, OR the owner asks. A pass = reviewer findings → fix in code → re-review; **max 2 passes**, commit each pass's fixes separately (revertible); after pass 2 with blockers/should-fixes open, STOP, tell the owner plainly, and propose more passes.
- **Reuse the reviewer's session for re-checks (owner instruction, 2026-10-15).** A fresh `code-reviewer` subagent starts with an **empty context** (opencode subagents don't inherit the parent), so it re-reads and re-caches the diff/docs — extra tokens. The **first pass** gets a clean slate (that's the independence you want), but a **second/confirmation pass must resume the *same* reviewer session** so it reuses its context and cache instead of paying for a fresh one: with the Task tool, pass the returned `task_id`; on the CLI, `opencode run -s <session-id> …` (capture the id from pass 1).
- **Skip the review entirely** for docs-only / screenshot-only / pure-formatting changes (say so in the PR).
- **Owner-directed simple changes skip review (owner instruction, 2026-10-15).** When the owner asks for a small, low-risk change — or explicitly says to keep it light / skip the reviews — do **not** run the `code-reviewer`, `designer`, or `design-reviewer` at all. Just implement and run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then say so in the PR. Examples: one-line/typo fixes, comment/doc tweaks, a small defensive guard, config or CSS value tweaks inside an already-approved direction. When in doubt, ask the owner rather than spending tokens.
- **Re-reviews are conditional, not automatic (owner instruction, 2026-10-15).** After fixing findings, re-run the checks — but run **another reviewer pass only when it's worth it**: the change is high-risk (architecture/security/persistence/serialization/catalog schema/CI/deps), or a *blocker's* fix substantially changed logic. A pass's `FIX AND RE-REVIEW` signal does **not** obligate a second full pass for simple fixes — the test suite is the re-check (and any second pass is the **light** model).
- Record the outcome (passes, verdict, remaining findings) in `docs/progress.md`.
- **Reply in the review thread — never a separate PR comment (owner instruction, 2026-10-15).** When addressing a review finding (Copilot, owner, `code-reviewer`, `design-reviewer`), reply **inside that finding's own thread** and resolve it: GitHub `POST /repos/{owner}/{repo}/pulls/{n}/comments/{comment_id}/replies` (or GraphQL `addPullRequestReviewThreadReply` + `resolveReviewThread`). Do **not** post a separate top-level PR comment summarizing the fixes. One finding → one threaded reply + resolve.
- Scope vs the **Design gate**: the code-reviewer owns code/architecture/security/correctness; the `designer`/`design-reviewer` own visual direction (ADR-005). Both apply when a task touches both — but **the visual check runs only when pixels actually changed**.

## Phase gate (MANDATORY)

- When **all tasks of a phase** (per `docs/roadmap.md`) are committed, do NOT start the next phase directly.
- Run a **post-phase code review** in a NEW session on the **light model** (`opencode-go/deepseek-v4.1-flash`) — every review pass uses the light model (owner instruction, 2026-10-15): point it at the phase's merged PRs + `docs/design.md` + `docs/roadmap.md`, and ask it to flag contradictions, gaps, and regressions vs the docs (this replaced doc-only reviews after planning — see ADR-004).
- Fold valid findings back into the docs/tasks **before** starting the next phase.
- Record the review outcome in `docs/progress.md`.

## Hard constraints

- **cm is the source of truth** for all geometry. Pixels exist only at render time: `px = cm × PX_PER_CM × zoom`.
- Apply zoom/pan to the **stage transform only**. Never scale pedal/board objects.
- Images must be same-origin (or CORS-enabled CDN) — cross-origin images break canvas export.
- **Minimal dependencies (owner instruction, 2026-10-12).** The project must stay easy to update and maintain, without constant dependency churn. Prefer **zero new dependencies**; every new dependency (runtime or dev) must earn its place and be justified with a note in the task file or a new ADR. When a dep is unavoidable, prefer ones that are stable/evergreen (small surface, few transitive deps, old code moves slowly) over hot churn. Re-evaluate existing deps for removal when they stop paying for themselves.
- No new runtime dependencies without a note in the task file or a new ADR.
- Do not read whole docs unless the task says so — read the pointed sections only.
- Code, comments, and UI text in English.
- Catalog/image provenance is documented in `docs/decisions/003-catalog-data.md` ONLY. Never reference external dataset sources in code, commits, filenames, or public assets.
- **Catalog images (owner decision, 2026-10-15):** where a direct official brand image URL is recorded in `sources`, render it (`imageSource: "url"`) — the procedural mock is the **fallback only** (items with no usable URL). No scraping/download; hotlink the recorded URL. Prefer top-down cropped cutouts (true-scale). See ADR-003 §Brand image URLs.
- **NEVER run scaffolding/build tools with `--overwrite`/force flags in the repo root** — `docs/`, `AGENTS.md`, and the PDF are precious. Merge scaffold files manually. (This rule exists because `--overwrite` deleted the entire `docs/` tree on 2026-09-29.)

## Conventions

- Biome for lint/format — run `pnpm lint` before committing.
- Tests: Vitest for logic (geometry, scale, serialization), Playwright (chromium only) for canvas smoke flows.
- Keep PRs small: one task = one PR.

## PR quality standard (MANDATORY — owner instruction, 2026-09-30)

Every PR description MUST include all five sections:
1. **Summary** — what changed and why (tie back to the task + roadmap item).
2. **Changes** — files/folders touched and the key decisions taken (incl. any deviations from the task file, and why).
3. **Testing steps** — exactly what was run to verify (commands + their results), plus any manual checks performed. Must map to the task's acceptance criteria.
4. **Screenshots** — attach Playwright screenshots whenever there is a visible UI change (canvas, panels, modals, theming). For P1+ canvas work this is expected on every PR. Use Playwright's screenshot API on the smoke flow and **embed them inline as Markdown images**, e.g. `![desktop dark](https://raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/docs/screenshots/<task>/<file>.png)` — a bare filename/path renders as text, not an image, so listing paths is NOT a screenshot section. Use the **commit SHA** (not the branch) in the URL so the images survive a branch deletion after merge. (Owner instruction, 2026-10-15 — PR #14 listed paths instead of embedding them.)
5. **Owner review hints** — the 3 (max) most important, specific things the owner should check before approving. NOT generic advice — the exact risks/edge cases of THIS PR (e.g. "verify rotated-board drop math on an actual device", "confirm the export on iOS doesn't come out blank", "check the new modal closes on Esc + tap-outside"). If fewer than 3 apply, list fewer — never pad.
6. **Review-round digest (owner instruction, 2026-10-15).** Every PR description — and the final session summary to the owner — must include a **one-line-per-round digest** of every review that ran for the task (the `designer`, **each** `design-reviewer` pass, **each** `code-review` pass, and any Copilot review): **reviewer · verdict · what it changed** (fixed / deferred / no action). One line each, so the owner can judge whether each round was worth calling. If no review ran, state that in one line. Keep it terse — it is a ledger, not prose.

**PRs are NOT auto-merged (owner instruction, 2026-09-30).** Every PR requires the owner's review and approval before merge. The session prepares the PR to the full standard above and then STOPS and hands it to the owner with the review hints. Sessions must NOT merge their own PRs. The owner reviews (using the hints as a checklist), and either merges or sends it back with feedback.