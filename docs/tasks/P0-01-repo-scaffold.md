# P0-01: Repo scaffold

**Phase:** P0 · **Status:** done · **Model:** build-cheap

## Goal
A Vite + React 19 + TypeScript project exists with the folder structure from design.md, pnpm as package manager, base scripts wired, and a minimal dark-themed App rendering "Pedalvision" — ready for P0-02..05.

## Read first (context pack)
- `docs/design.md` §Folder structure, §Stack
- `docs/tasks/README.md`
- `AGENTS.md` §Commands, §Conventions

## Constraints
- **NEVER run `create vite` with `--overwrite`/force flags in the repo root** — it deletes `docs/`, `AGENTS.md`, and the PDF (this happened on 2026-09-29). The docs tree already exists here; scaffold INTO a temp dir and merge manually, or run `pnpm create vite .` and let it refuse (it will, because the dir is non-empty) and then copy the generated files in by hand.
- No UI framework, no router, no CSS framework.
- Dependencies: only `react`, `react-dom`, `konva`, `react-konva`, `zustand`, `zod` (+ dev: vite, @vitejs/plugin-react, typescript, vitest, biome, types). Pin with pnpm. **Pre-authorized for later phases (N7):** `idb` (P3 persistence) and `fflate` (P3 share codec) — note them in the PR so the "no new deps without asking" rule doesn't stall future sessions.
- Don't implement any canvas logic — scaffold only.
- Node ≥ 20.

## Steps
1. Scaffold Vite react-ts **without clobbering docs/**: `mkdir -p /tmp/pv-scaffold && pnpm create vite /tmp/pv-scaffold --template react-ts`, then copy `package.json`, `index.html`, `tsconfig*.json`, `vite.config.ts`, `src/`, `public/` into the repo root (merge `.gitignore` entries manually — keep `dev-assets` + `dev-seed.json` ignored).
2. Add deps; create folders per design.md (empty `index.ts` barrels are fine)
3. `package.json` scripts: `dev`, `build`, `test` (vitest run), `typecheck` (tsc --noEmit), `lint` (biome ci), `e2e` (placeholder: echo "todo" until P0-02)
4. Biome init with sane defaults (no custom rules yet)
5. Minimal `App.tsx`: dark background, "Pedalvision" heading; one dummy Vitest test
6. **Git (N5):** ensure `.gitignore` covers node_modules, dist, .env, dev-assets, dev-seed.json. **The repo is already a git repo (init'd 2026-09-29)** — do NOT `git init` again; just commit. Required so P0-02's PR flow can start.

## Acceptance (executable)
- `pnpm install` clean
- `pnpm dev` serves the page
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass
- `git status` clean after commit; `docs/`, `AGENTS.md` all still present (untouched by the scaffold)

## Notes
Commit as `chore: scaffold vite + react + ts project`. Update `docs/progress.md` when done.