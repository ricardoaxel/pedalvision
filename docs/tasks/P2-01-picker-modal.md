# P2-01: Picker modal

**Phase:** P2 · **Status:** in review — PR #17 · **Model:** build-cheap

## Goal
Replace the two temporary side-panel pickers (`src/components/BoardPicker.tsx` +
`PedalPicker.tsx`) with the real picker: a searchable, filterable catalog browser
(search + brand/effect-type filters) that places a board or pedal onto the canvas.
Desktop presents it as a **modal**; mobile (`<1024px`) presents it as a
**bottom-tab**-driven full-screen sheet (Pedals / Boards at minimum), per F11 and
design.md §Responsive approach. The picker must keep a **small on-screen
footprint on mobile** so the working canvas stays visible.

## Read first (context pack)
- `docs/roadmap.md` P2-01 (+ the small-footprint note)
- `docs/requirements.md` F4, F11, N7/N8, and the "overcomplicated modal stack" don't
- `docs/design.md` §Responsive approach, §Data model (`CatalogPedal.brand` / `effectTypes` / `category`, `CatalogBoard.brand`)
- `docs/tasks/README.md` (task format + PR standard)
- `src/components/BoardPicker.tsx`, `src/components/PedalPicker.tsx` (code being replaced)
- `src/state/scene.ts` (`addBoard`/`addItem`), `src/state/selection.ts`, `src/state/viewport.ts` (`viewportCenterCm`)
- `src/catalog/schema.ts` (`EFFECT_TYPES`), `src/styles/tokens.css` (tokens only — no hardcoded colors)

## Constraints
- **Heavy design task — Design gate applies.** Run the `designer` agent for a
  direction proposal; the owner approves the direction **before** any UI code.
  After implementation: `designer` review + `design-reviewer` on **desktop AND
  mobile** screenshots (hard cap ≤2 `design-reviewer` passes).
- **Zero new deps by default.** A searchable list over ~207 pedals needs no
  library — justify any exception in this file or a new ADR.
- cm stays the source of truth — placement reuses the existing store actions
  (board/pedal dropped at viewport centre / selected-board centre); no new geometry.
- Keep the **on-screen footprint small on mobile** (owner instruction, 2026-10-15):
  the sheet is dismissible and does not permanently cover the canvas.
- Do **not** widen the `jacks.kind` vocabulary or touch P2-02 concerns (that is a
  separate gated task).
- Catalog provenance stays confined to ADR-003 — no external dataset names/URLs
  in code, filenames, commits, or UI.
- Tokens only for styling (no hardcoded colors); follows `data-theme` dark/light.
- No `dangerouslySetInnerHTML`; React escaping for catalog strings (design.md §Security).

## Steps
1. Designer direction proposal → owner approval (record direction name in `docs/progress.md`).
2. Build the picker surface: shared catalog list (pedals/boards) with search input
   + brand filter + effect-type filter; item rows show brand, name, dims, and image
   thumb; click places via the existing scene actions and closes/dismisses.
3. Responsive chrome: desktop modal (top toolbar trigger), mobile bottom tabs +
   full-screen sheet; dismiss on Esc / backdrop tap / explicit close.
4. Remove `BoardPicker.tsx` + `PedalPicker.tsx`; wire the new picker into `App.tsx`;
   keep the existing remove-selected-board affordance available somewhere sensible
   (modal action or selection chrome).
5. a11y: dialog `role` + focus management; keyboard-reachable filters/items
   (design.md §Accessibility — catalog mirrored in HTML).
6. Tests: filter/search pure logic (Vitest); Playwright smoke for open → filter →
   place board + pedal → dismiss, on desktop + mobile.

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: search + brand/effect filter functions (match/no-match, empty query,
  category split pedal/supply) pass.
- Playwright: open picker → search → place a board and a pedal; mobile project
  opens the bottom-tab sheet and places an item; all dismiss paths (Esc, backdrop, close) work.
- Manual: on a narrow viewport the picker never permanently covers the canvas
  (small footprint); dark + light both render from tokens only.
- `grep`/review confirms no hardcoded colors and no external catalog provenance leaked.

## Notes
- **Approved direction: "Parts Bin"** (designer proposal, owner-approved 2026-10-17) — a drafting parts drawer inside the Blueprint direction. Desktop = centered modal (top toolbar trigger); mobile = ~56px bottom tab bar + transient sheet with a ~15vh canvas peek. **Card grid** is the desktop results default. **Placement is implicit** (pedal → selected board, board → viewport centre) with a read-only footer hint (no explicit target control). New tokens only: `--color-surface-elevated`, `--color-scrim`, `--color-input-bg`, `--color-border-strong`.
- Supersedes the temporary `BoardPicker`/`PedalPicker` from P1-03/P1-04.
- The modal/sheet is shared by boards + pedals; more tabs (Cables/Custom/More from
  design.md §Responsive approach) arrive with their own tasks (P2-02, P4) — do not
  stub them here beyond what P2-01 needs.
