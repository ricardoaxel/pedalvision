# Progress

**Current phase:** P0 — Foundation
**Next task:** P0-03 → `docs/tasks/P0-03-design-tokens.md` (**UNBLOCKED**)
**Last updated:** 2026-09-30 (P0-02 done)

> See `docs/phase-guide.md` for what each phase does and which ones need owner action (and why).

## Done
- [x] P0-02 — CI/CD pipeline: GitHub Actions runs lint → typecheck → unit tests → build → Playwright smoke (chromium, `vite preview`, port 4174) on every PR/push to main; deploys to Cloudflare Pages (PR = preview URL, main = production). Pipeline is self-bootstrapping (creates the `pedalvision` Pages project on first deploy) and posts the preview URL as a PR comment.
- [x] Plan v1: requirements, design, roadmap, ADRs, task system created
- [x] Plan passed 6 external review rounds — all valid findings folded in (R1–R6); docs now internally consistent, plan **frozen for implementation**
- [x] R6 closes: custom pedals travel inline (A5), boot reconcile, supply category, first-run empty-state, a11y scope, share-cap interplay
- [x] R5 closes: detached offscreen export Stage, endpoint margin, SVG font determinism + pinned sharp, fit-capped "all content", pan-interrupt drop-in-place

## In progress
- [x] **2026-09-29 INCIDENT:** `pnpm create vite . --overwrite` deleted `docs/`, `AGENTS.md`, and the Notion PDF (repo wasn't a git repo → no recovery from git). Docs fully restored from planning-session context; **git repo initialized** (root commit `fe22a1c`). PDF must be re-exported from Notion.

## Blockers / external
- Catalog uses a dev placeholder dataset (see `docs/decisions/003-catalog-data.md`) — **must be swapped before any public launch**
- Permission request to the dataset maintainer: not yet sent (owner action; draft can be prepared by an agent on request)
- P0-05 transformer input (the external catalog dataset): exists only on owner machine — needed when running the transformer; synthetic seed (committed) covers fresh clones/CI
- **Sequencing note (S7):** P0-02 is done (2026-09-30). **Owner-blocked rule (owner instruction, 2026-09-29):** when the next task is owner-blocked, agents STOP and wait for the owner — they do NOT skip ahead to unblocked tasks. Remaining owner actions: P0-05 dataset, P2-06 outreach, launch gate (see `docs/phase-guide.md`). P0-03/P0-04 are NOT owner-blocked.

## Session log
- 2026-09-22 — Planning session: created AGENTS.md + full docs/ (requirements, design, roadmap, 4 ADRs, task system, P0–P1 tasks)
- 2026-09-22 — Review rounds 1–6 applied; plan frozen. **Next: P0-01 (repo scaffold).** Stop doc-only reviews; switch to post-phase code reviews.
- 2026-09-29 — P0-01 attempt wiped docs via `--overwrite`; docs restored; git init'd; P0-01 revised to forbid `--overwrite`.
- 2026-09-29 — **P0-01 done:** Vite react-ts scaffold, deps (konva, react-konva, zustand, zod; dev: vitest, @biomejs/biome), folder structure per design.md, dark App + dummy test, scripts wired, Biome configured (includes/excludes patterns for 2.x), `@rolldown/binding-darwin-arm64` added (rolldown optional dep not auto-installed on pnpm). Acceptance all green: install/build/typecheck/lint/test + dev serves. Commit: `chore: scaffold vite + react + ts project`.
- 2026-09-29 — **Owner-blocked STOP at P0-02.** Owner instruction: agents must NOT skip ahead to unblocked tasks (e.g. P0-03) when the next task is owner-blocked. The builder session had jumped to P0-03; corrected back to stop. Waiting on owner: GitHub repo + Actions secrets.
- 2026-09-30 — **P0-02 UNBLOCKED.** GitHub repo created + pushed (`ricardoaxel/pedalvision`); `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` set as Actions secrets (owner did Option A). Next: run P0-02 (CI/CD pipeline).
- 2026-09-30 — **P0-02 done.** Added `.github/workflows/ci.yml` (install → biome ci → tsc --noEmit → vitest run → vite build → Playwright smoke → wrangler-action Pages deploy), `playwright.config.ts` (chromium only, `vite preview` on port 4174 — 4173 was taken by a local Python server), `e2e/smoke.spec.ts`, real `e2e` script, vitest excludes `e2e/**`. Two CI fixes during verification: `comment` input is not valid on wrangler-action v3 (removed; now posts preview URL via `actions/github-script` + `gitHubToken` for GitHub Deployments), and `pages deploy` no longer auto-creates the project — added an idempotent `preCommands` create (`--production-branch main`). Acceptance verified end-to-end: PR preview URL `https://2a4bfc13.pedalvision.pages.dev`, production `https://pedalvision.pages.dev`, and a deliberately broken test commit failed the pipeline before deploy (then reverted). Merged as squash PR #1. Commits: `ci: add GitHub Actions pipeline…`, `ci: self-bootstrap Pages project…`.

## Deps note (N7 pre-authorization)
- `idb` (P3 persistence) and `fflate` (P3 share codec) are pre-authorized — install without a new ADR when those tasks land.