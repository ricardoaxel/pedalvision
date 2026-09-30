# ADR-004: Agent context strategy (token-efficient sessions)

**Status:** Accepted (2026-09-22)

## Context
The owner works with AI coding agents across many sessions on a metered plan. A planning session like the one that produced these docs is expensive by nature (research, media) — **implementation sessions must be cheap**. Agents must pick the project up cold without loading the whole repo/docs each time.

## Decision: "map, not manual" + task-file protocol
1. **AGENTS.md ≤ ~100 lines** — project map, commands, hard constraints, pointers. Never an encyclopedia. (Bloated instruction files get ignored and burn context.)
2. **docs/progress.md** — the handoff memory. Read first, update last, every session. Contains: done / next / blockers.
3. **docs/tasks/*.md** — one self-contained file per task with a **context pack** ("Read first" section listing exact files/sections). The agent reads only those.
4. **Detail follows schedule**: only current + next phase get detailed task files; later phases stay as roadmap one-liners until scheduled.
5. **One task per session, commit per task.** Sessions stay short; state lives in git + docs, not chat history.
6. **Model routing**: cheap model for build tasks (Kimi K2.7 Code / DeepSeek V4 Flash); strong model (Kimi K3 or better) only for planning, architecture, and gnarly debugging. Task files declare a suggested tier.
7. **Deterministic guardrails over prose**: lint/type/tests in CI encode conventions (Biome, tsc, zod, Vitest). Don't repeat in docs what a tool enforces.
8. **Review cadence = post-phase, on code, not prose**: after planning, doc-only review rounds were exhausted (R1–R6, diminishing returns). Reviews now happen **per phase completion** — a fresh agent reviews the phase's merged PRs against `docs/design.md` + `docs/roadmap.md` (see AGENTS.md §Phase gate). This catches real code/doc drift where prose review can't.

## Task file format (see docs/tasks/README.md)
Goal (end state) · Read first (context pack) · Constraints (what NOT to touch) · Steps · Acceptance (executable checks) · Model tier.

## Consequences
- A cold session costs: AGENTS.md (~100 lines) + progress.md (~40 lines) + one task file (~50 lines) + pointed code only.
- If an agent drifts, the fix goes into the task file or CI — not into more prose.
- This ADR itself is the reference when adding new docs: ask "does the next agent need this to avoid a mistake?" If not, don't add it.