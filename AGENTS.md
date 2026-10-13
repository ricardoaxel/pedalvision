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

> Until P0 scaffold lands, this repo contains docs only (no package.json yet).

## Repo map

- `docs/requirements.md` — product spec (features, non-goals, acceptance criteria)
- `docs/design.md` — architecture & data model
- `docs/roadmap.md` — phases / epics / task index
- `docs/phase-guide.md` — what each phase does + which ones need owner action (and why)
- `docs/progress.md` — current status (**read first, update last**)
- `docs/decisions/` — ADRs (why things are the way they are)
- `docs/tasks/` — one self-contained file per task
- `src/` (from P0) — app code
- `tools/` (from P0/P2) — dev tooling (asset pipeline, catalog transformer)

## Session protocol (MANDATORY)

1. Read `docs/progress.md` → find the current task.
2. Read the task file in `docs/tasks/` — it lists exactly which files/sections to read. Read **only** those.
3. Do the task. Verify its acceptance criteria by running them.
4. Update `docs/progress.md` (done / next / blockers) — this is the handoff memory for the next session.
5. One task per session. Commit per task (conventional commits).
6. **Owner-blocked tasks STOP the flow (owner instruction, 2026-09-29).** If the next task — or any step of the current task — requires an owner action (GitHub repo, Cloudflare account/secrets, R2 bucket, dataset, permissions, etc. — see `docs/progress.md` → Blockers), **STOP and report to the owner**. Do NOT skip ahead to an unblocked task to "fill the gap". Wait for the owner to complete the required action before continuing.
7. **Blockers always ship with full, concise owner instructions (owner instruction, 2026-09-29).** For every owner-blocker you report, write the complete step-by-step instructions for the owner — exactly what to click/create/enter, in order, in plain language — but keep them as short as possible. Every step must be actionable and unambiguous (e.g. "create a repo named `pedalvision` (public), then run `git remote add origin <url>` and `git push -u origin main`"). Record them in `docs/progress.md` → Blockers so any future session can re-surface them. When the owner unblocks a task, remove that blocker from `progress.md`.
8. **Design-affecting tasks are gated (owner instruction, 2026-10-12).** If the current task touches design (tokens, theming, colors, typography, spacing, layout, components, or anything visibly rendered in the UI), follow the **Design gate** below. Never hand-tune a palette or restyle on owner feedback without running the designer agent first.

## Design gate (MANDATORY — owner instruction, 2026-10-12)

- **The `designer` agent is the design authority** — a staff-level UX/UI expert (`.opencode/agent/designer.md`). Every design-affecting task — tokens, theming, layout, components, canvas visuals, responsive chrome — must be **reviewed by the designer agent before commit**, and its findings folded in. Run it with `/design-review` (optionally `/design-review <PR|propose>`). Rationale: docs/decisions/005-design-governance.md.
- **If the owner does a design task manually** (e.g. "this looks bad, restyle it"), ALWAYS propose to run the designer agent first — never immediately hand-edit colors/tokens. Present the designer's proposal and get the owner's approval before implementing (owner chooses direction; agents do not).
- **New/changed visual directions are owner-approved.** The designer produces the proposal; the owner approves it; only then is it implemented. Record the approval + the direction name in `docs/progress.md`.
- Design PRs must state in the PR description which designer review ran and its verdict, and (for P1+ canvas/UI work) the owner's approval of the direction.

### Heavy design tasks → designer⇄reviewer loop (owner instruction, 2026-10-12)
- **A "heavy design task"** is any task that establishes or changes a visual direction: a new/redone palette or theme, a new component system, canvas visuals, or a page/chrome overhaul. Small token tweaks / bug-fixes inside an already-approved direction are NOT heavy — the designer review alone (above) is enough.
- **The `design-reviewer` agent (`.opencode/agent/design-reviewer.md`) reviews the actual rendered pixels** — it opens the screenshots with a vision model (default `opencode-go/deepseek-v4-flash-vision-exp`), not the code. Run it with `/visual-review <paths|PR n>`.
- **Heavy design tasks run a designer⇄reviewer loop of up to 3 iterations, only after the owner approves running it.** Each iteration: designer proposes/revises → implementing agent applies it to code → render screenshots (dark + light) → reviewer sees the screenshots and critiques → feed findings back. Stop early on an "approve". Orchestrate with `/design-loop` (or step through manually).
- **The loop is gated on owner approval before it starts**, and the final result still goes to the owner for approval. Record iteration count, reviewer verdict, and approval in `docs/progress.md`.
- The reviewer is authoritative only for *what is on screen*; the designer remains the design authority. If they conflict, present both to the owner.

## Phase gate (MANDATORY)

- When **all tasks of a phase** (per `docs/roadmap.md`) are committed, do NOT start the next phase directly.
- Run a **post-phase code review** in a NEW session on a strong model (plan tier — Kimi K3 or better): point it at the phase's merged PRs + `docs/design.md` + `docs/roadmap.md`, and ask it to flag contradictions, gaps, and regressions vs the docs (this replaced doc-only reviews after planning — see ADR-004).
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
4. **Screenshots** — attach Playwright screenshots whenever there is a visible UI change (canvas, panels, modals, theming). For P1+ canvas work this is expected on every PR. Use Playwright's screenshot API on the smoke flow and attach the images to the PR.
5. **Owner review hints** — the 3 (max) most important, specific things the owner should check before approving. NOT generic advice — the exact risks/edge cases of THIS PR (e.g. "verify rotated-board drop math on an actual device", "confirm the export on iOS doesn't come out blank", "check the new modal closes on Esc + tap-outside"). If fewer than 3 apply, list fewer — never pad.

**PRs are NOT auto-merged (owner instruction, 2026-09-30).** Every PR requires the owner's review and approval before merge. The session prepares the PR to the full standard above and then STOPS and hands it to the owner with the review hints. Sessions must NOT merge their own PRs. The owner reviews (using the hints as a checklist), and either merges or sends it back with feedback.