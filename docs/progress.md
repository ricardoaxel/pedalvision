# Progress

**Current phase:** P0 — Foundation
**Next task:** ⛔ P0-02 → `docs/tasks/P0-02-ci-cd-pipeline.md` is **OWNER-BLOCKED** (GitHub repo + Actions secrets). Per owner instruction (2026-09-29), the flow **STOPS here** — do NOT start P0-03 or any other task until the owner completes the required setup.
**Last updated:** 2026-09-29 (P0-01 done; owner-blocked stop at P0-02)

> See `docs/phase-guide.md` for what each phase does and which ones need owner action (and why).

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
- ⛔ **P0-02 — GitHub repo + Actions secrets** (owner action; flow stops here). **Owner must do exactly this:**
  1. Go to https://github.com/new → name it `pedalvision` (Public) → **Create repository** (don't add README/gitignore/license — this repo already has files).
  2. In the local terminal, from `/Users/ashel/Documents/Programming/Pedalvision`, run:
     ```
     git remote add origin https://github.com/<your-username>/pedalvision.git
     git push -u origin main
     ```
  3. Create a Cloudflare account at https://dash.cloudflare.com/sign-up (if you don't have one).
  4. Open https://dash.cloudflare.com/profile/api-tokens → **Create Token** → use the **"Edit Cloudflare Workers"** template (or "Read all resources" template) → set your account/zone as applicable → **Create** → copy the token value.
  5. Find your Cloudflare **Account ID**: https://dash.cloudflare.com → left sidebar shows it (or check the URL: `dash.cloudflare.com/<ACCOUNT_ID>`).
  6. On GitHub: open the `pedalvision` repo → **Settings → Secrets and variables → Actions → New repository secret** → add `CLOUDFLARE_API_TOKEN` = the token from step 4, then `CLOUDFLARE_ACCOUNT_ID` = the ID from step 5.
  7. Tell the agent P0-02 is unblocked. When unblocked, remove this blocker from `progress.md`.
- P0-05 transformer input (the external catalog dataset): exists only on owner machine — needed when running the transformer; synthetic seed (committed) covers fresh clones/CI
- **Sequencing note (S7):** P0-02 waits on the owner. **Owner-blocked rule (owner instruction, 2026-09-29):** when the next task is owner-blocked, agents STOP and wait for the owner — they do NOT skip ahead to unblocked tasks.

## Session log
- 2026-09-22 — Planning session: created AGENTS.md + full docs/ (requirements, design, roadmap, 4 ADRs, task system, P0–P1 tasks)
- 2026-09-22 — Review rounds 1–6 applied; plan frozen. **Next: P0-01 (repo scaffold).** Stop doc-only reviews; switch to post-phase code reviews.
- 2026-09-29 — P0-01 attempt wiped docs via `--overwrite`; docs restored; git init'd; P0-01 revised to forbid `--overwrite`.
- 2026-09-29 — **P0-01 done:** Vite react-ts scaffold, deps (konva, react-konva, zustand, zod; dev: vitest, @biomejs/biome), folder structure per design.md, dark App + dummy test, scripts wired, Biome configured (includes/excludes patterns for 2.x), `@rolldown/binding-darwin-arm64` added (rolldown optional dep not auto-installed on pnpm). Acceptance all green: install/build/typecheck/lint/test + dev serves. Commit: `chore: scaffold vite + react + ts project`.
- 2026-09-29 — **Owner-blocked STOP at P0-02.** Owner instruction: agents must NOT skip ahead to unblocked tasks (e.g. P0-03) when the next task is owner-blocked. The builder session had jumped to P0-03; corrected back to stop. Waiting on owner: GitHub repo + Actions secrets.

## Deps note (N7 pre-authorization)
- `idb` (P3 persistence) and `fflate` (P3 share codec) are pre-authorized — install without a new ADR when those tasks land.