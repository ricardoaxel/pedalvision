# P0-03: Design tokens

**Phase:** P0 · **Status:** done (Blueprint, merged 2026-10-13 in PR #2) · **Model:** build-cheap

## Revision (2026-10-12 — owner feedback, plan update)
The first delivered palette (dark slate + amber) was rejected by the owner as too close to generic pedal-planner sites. Plan updated per owner instruction: **visual direction is now gated** — the `designer` agent (`/design-review`, `.opencode/agent/designer.md`, ADR-005) researches current design trends, produces the proposal, and the owner approves it before any palette is coded. This task is re-run under that gate. Additional step added:
- Run the designer agent, get the owner-approved direction, then implement tokens/theme with those values.
- PR must state the designer review + verdict and the owner's approval.

## Goal
All visual values live in CSS custom properties (`src/styles/tokens.css`): colors (surface/ink/accent/warning/danger), spacing scale, radii, dot-grid color, typography sizes. Dark theme is the default; a light theme exists as a variables-only override. App chrome uses tokens exclusively.

## Read first (context pack)
- `docs/requirements.md` (competitor learnings: ugly-UI don't, themes like)
- `docs/design.md` §Folder structure, §Responsive approach

## Constraints
- No hardcoded hex/px values in components after this task (Biome can't enforce this — it's a review rule; note it in the PR description).
- No theming library, no CSS-in-JS. Plain CSS variables + a `data-theme` attribute on `<html>`.
- Don't build a theme switcher UI — just prove the override works (temporary toggle in App is fine, marked TODO).

## Steps
1. Create `tokens.css` with `:root` (dark) and `[data-theme='light']` scopes
2. Global reset (margin, box-sizing, font stack)
3. Dot-grid background as a reusable class using tokens
4. **`src/styles/theme.ts` (N1):** export the canvas-relevant values (grid dot color, selection/accent, cable color) as a JS object, sourced from the same token values — Konva can't read CSS variables, so canvas reads from this map. Include a Vitest test asserting theme.ts keys match tokens.css.
5. Wire into `App.tsx`; temporary theme toggle proving variables-only switch

## Acceptance (executable)
- `pnpm build` + `pnpm lint` pass
- Flipping `data-theme` changes all chrome colors with zero component edits (manual check, noted in PR)
- `grep -r "#[0-9a-fA-F]\{6\}" src/components src/App.tsx` returns nothing

## Notes
Palette direction is decided by the **designer agent** per the Design gate (AGENTS.md + ADR-005) and **approved by the owner before implementation**. The original "dark slate + amber (guitar-amp)" hint was rejected by the owner (2026-10-12) as clichéd — do not default to it.

## Delivered
Direction: **"Blueprint"** (neutral canvas, cool chrome, one cyan accent, mono for measurement labels, quiet tinted status pills; dark default + light override). Owner-approved after a designer⇄reviewer loop (R1–R7). `src/styles/tokens.css` + mirrored `src/styles/theme.ts` (sync-tested via `theme.test.ts`), demo chrome in `src/index.css` token-only. Merged in PR #2 (`5680567`).

## Follow-up (non-blocking, before P1)
- **`tsconfig.app.json` node-types leak:** `"node"` was added to the app's `types` so `theme.test.ts` can `import { readFileSync } from "node:fs"`. This lets browser code typecheck against Node globals. Clean up by scoping node types to the test (separate tsconfig) or reading `tokens.css` via a Vitest/Vite-friendly import. See `docs/progress.md` → Follow-ups.