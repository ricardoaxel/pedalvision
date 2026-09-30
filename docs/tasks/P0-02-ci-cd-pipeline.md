# P0-02: CI/CD pipeline

**Phase:** P0 · **Status:** todo · **Model:** build-strong

## Goal
GitHub Actions runs lint → typecheck → unit tests → build → Playwright smoke on every PR and push to main, and deploys to Cloudflare Pages (PR = preview URL, main = production).

## Read first (context pack)
- `docs/design.md` §CI/CD
- `docs/decisions/002-hosting-and-assets.md`
- `AGENTS.md` §Commands

## Constraints
- Playwright: chromium only; cache browsers keyed by Playwright version.
- pnpm cache enabled (`actions/setup-node` `cache: pnpm`).
- Cloudflare secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) via GitHub Secrets — never in repo. Document setup in the workflow file comments.
- No test sharding/matrix — suite is tiny.

## Steps
1. `.github/workflows/ci.yml`: install → `biome ci` → `tsc --noEmit` → `vitest run` → `vite build` → Playwright (`vite preview` as webServer) → `cloudflare/wrangler-action` `pages deploy dist --project-name=pedalvision`
2. Add a trivial Playwright smoke test (page loads, heading visible)
3. `package.json`: real `e2e` script (replaces P0-01 placeholder)
4. Verify: push a PR, confirm preview URL appears; merge, confirm production deploy

## Acceptance (executable)
- Workflow green on a test PR and on main
- PR shows a preview deployment URL; main deploys to production
- Failed lint/type/test blocks the deploy (verified by a deliberately broken commit that is then reverted)

## Notes
Owner must add the two Cloudflare secrets before the deploy step can pass — document the full step-by-step owner instructions in `docs/progress.md` → Blockers (owner instruction 2026-09-29: blockers always ship with complete, concise, actionable instructions). This task stays **owner-blocked** until then — do NOT start P0-03 to "fill the gap".