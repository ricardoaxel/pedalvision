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

## Phase gate (MANDATORY)

- When **all tasks of a phase** (per `docs/roadmap.md`) are committed, do NOT start the next phase directly.
- Run a **post-phase code review** in a NEW session on a strong model (plan tier — Kimi K3 or better): point it at the phase's merged PRs + `docs/design.md` + `docs/roadmap.md`, and ask it to flag contradictions, gaps, and regressions vs the docs (this replaced doc-only reviews after planning — see ADR-004).
- Fold valid findings back into the docs/tasks **before** starting the next phase.
- Record the review outcome in `docs/progress.md`.

## Hard constraints

- **cm is the source of truth** for all geometry. Pixels exist only at render time: `px = cm × PX_PER_CM × zoom`.
- Apply zoom/pan to the **stage transform only**. Never scale pedal/board objects.
- Images must be same-origin (or CORS-enabled CDN) — cross-origin images break canvas export.
- No new runtime dependencies without a note in the task file or a new ADR.
- Do not read whole docs unless the task says so — read the pointed sections only.
- Code, comments, and UI text in English.
- Catalog/image provenance is documented in `docs/decisions/003-catalog-data.md` ONLY. Never reference external dataset sources in code, commits, filenames, or public assets.
- **NEVER run scaffolding/build tools with `--overwrite`/force flags in the repo root** — `docs/`, `AGENTS.md`, and the PDF are precious. Merge scaffold files manually. (This rule exists because `--overwrite` deleted the entire `docs/` tree on 2026-09-29.)

## Conventions

- Biome for lint/format — run `pnpm lint` before committing.
- Tests: Vitest for logic (geometry, scale, serialization), Playwright (chromium only) for canvas smoke flows.
- Keep PRs small: one task = one PR.