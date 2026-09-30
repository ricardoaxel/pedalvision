# P0-03: Design tokens

**Phase:** P0 · **Status:** todo · **Model:** build-cheap

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
Palette direction: dark slate surfaces, warm amber accent (guitar-amp vibe). Final values are owner's call — propose a set in the PR.