# Progress

**Current phase:** P0 — Foundation
**Next task:** P0-03 → `docs/tasks/P0-03-design-tokens.md` (P0-02 is owner-blocked — GitHub repo + secrets; sequencing note below)
**Last updated:** 2026-09-29 (P0-01 done)

## Done
- [x] Plan v1: requirements, design, roadmap, ADRs, task system created
- [x] Plan passed 6 external review rounds — all valid findings folded in (R1–R6); docs now internally consistent, plan **frozen for implementation**
- [x] R6 closes: custom pedals travel inline (A5), boot reconcile, supply category, first-run empty-state, a11y scope, share-cap interplay
- [x] R5 closes: detached offscreen export Stage, endpoint margin, SVG font determinism + pinned sharp, fit-capped "all content", pan-interrupt drop-in-place

## In progress
- [x] **2026-09-29 INCIDENT:** `pnpm create vite . --overwrite` deleted `docs/`, `AGENTS.md`, and the Notion PDF (repo wasn't a git repo → no recovery from git). Docs fully restored from planning-session context; **git repo initialized** (root commit `fe22a1c`). PDF must be re-exported from Notion.

## Blockers / external
- Catalog uses a dev placeholder dataset (see `docs/decisions/003-catalog-data.md`) — **must be swapped before any public launch**
- Permission request to the dataset maintainer: not yet sent (owner action; draft can be prepared by an agent on request)
- GitHub repo + Actions secrets: needed for P0-02 (owner action)
- P0-05 transformer input (the external catalog dataset): exists only on owner machine — needed when running the transformer; synthetic seed (committed) covers fresh clones/CI
- **Sequencing note (S7):** P0-02 waits on the owner. P0-04 (Pages-shipped assets) and P1-01 (pure geometry) have **zero owner deps — schedule them to fill the gap.**

## Session log
- 2026-09-22 — Planning session: created AGENTS.md + full docs/ (requirements, design, roadmap, 4 ADRs, task system, P0–P1 tasks)
- 2026-09-22 — Review rounds 1–6 applied; plan frozen. **Next: P0-01 (repo scaffold).** Stop doc-only reviews; switch to post-phase code reviews.
- 2026-09-29 — P0-01 attempt wiped docs via `--overwrite`; docs restored; git init'd; P0-01 revised to forbid `--overwrite`.
- 2026-09-29 — **P0-01 done:** Vite react-ts scaffold, deps (konva, react-konva, zustand, zod; dev: vitest, @biomejs/biome), folder structure per design.md, dark App + dummy test, scripts wired, Biome configured (includes/excludes patterns for 2.x), `@rolldown/binding-darwin-arm64` added (rolldown optional dep not auto-installed on pnpm). Acceptance all green: install/build/typecheck/lint/test + dev serves. Commit: `chore: scaffold vite + react + ts project`.

## Deps note (N7 pre-authorization)
- `idb` (P3 persistence) and `fflate` (P3 share codec) are pre-authorized — install without a new ADR when those tasks land.