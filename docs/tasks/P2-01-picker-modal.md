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
  (`addItem`/`addBoard`) and stays cm-native. Placement now **de-stacks** via a
  pure `lib/geometry.ts` `placeItem()` (owner-approved, 2026-10-17: repeated adds
  must not stack on top of each other — see Notes); it scans a grid of spots from
  the centred base and falls back to the centred base when a bounded container is
  full. No pixels in geometry.
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
- **Approved direction: "Specimen Bench"** (designer proposal, owner-approved
  2026-10-17 — extends "Parts Bin", supersedes its card grid). Desktop = a
  top-anchored **two-pane instrument**: a dense keyboard-first **ledger** of rows
  on the left (thumb · name · brand · dims; ↑↓ browse, ↵ place; one neutral
  hover, accent reserved for the **active** row) and a **specimen** pane on the
  right (the active item on a lit photographic plate over the bench dot grid,
  identity + a placement CTA). Mobile (<1024px) = a persistent ~56px bottom tab
  bar + a compact dismissible sheet (specimen hidden). Placement stays implicit
  (pedal → selected board, board → viewport centre) and the header hint states
  it. New tokens: `--color-specimen-bg`, `--color-specimen-dot`,
  `--color-item-label-bg/ink`, `--shadow-plate`, `--radius-row`, `--radius-key`,
  `--font-size-2xs`, `--tracking-caps`, `--leading-tight` (+ the earlier
  `--color-surface-elevated`, `--color-scrim`, `--color-input-bg`,
  `--color-border-strong`, `--color-thumb-bg`).
- **Canvas polish folded in (owner instruction, 2026-10-17):**
  `PedalNode` gains an **always-on name chip** inside the pedal's bottom edge
  (screen-constant via `ITEM_LABEL` in `theme.ts`; hidden below 52 screen px;
  full opacity when hovered/selected). The desktop hover is now four neutral
  **corner brackets** (`SelectionLayer`), replacing the dashed inset ring that
  read as odd padding.
- **Board rows use a glyph tile, not the board art** — the catalog board images
  are wide, mostly-transparent top-down outlines that shrink to an invisible
  sliver at tile scale; the specimen pane still shows the real board art at size.
- **Picker thumbnails load CORS-first, then fall back to no-CORS** (owner bug,
  2026-10-17 — "the BOSS CE-20 shows in the picker but never loads on the
  canvas"). Root cause: the picker's plain no-CORS `<img>` cached a response
  **without** `Access-Control-Allow-Origin`; the canvas's `crossOrigin` request
  then reused that cached copy and failed the CORS check for hosts that only send
  ACAO when the request carries an `Origin` (e.g. `static.roland.com`). Fix:
  `PickerThumb` requests with `crossOrigin="anonymous"` first (so the CORS-clean
  response is what gets cached) and retries once **without** CORS only if that
  fails (keeps hotlinked no-CORS hosts visible in the DOM picker). The canvas
  loader stays `crossOrigin`-only (export must stay untainted). Regression e2e:
  `picker.spec.ts` "no cache poisoning". **Catalog follow-up:** the `url` contract
  is CORS-clean (design.md §Assets), so the ~20 entries on non-CORS hosts
  (`cdn-media.empowertribe.com`, `img201.yun300.cn`) should be re-sourced or
  re-tagged — they render in the picker but fall back on the canvas.
- **Filter row wraps** (desktop + mobile); only short landscape
  (`max-height:520px`) falls back to a single scrolling strip to protect the
  results height.
- First approved sub-direction (superseded): **"Parts Bin"** (2026-10-17) — a
  drafting parts drawer. Direction evolved to "Specimen Bench" after owner
  feedback that the card grid was too plain and the desktop experience needed
  more.
- Supersedes the temporary `BoardPicker`/`PedalPicker` from P1-03/P1-04.
- **Owner polish round (2026-10-17, after PR review).** (1) The brand `<select>`
  gained a custom chevron (new `--icon-chevron` token, `appearance: none`, right
  padding) so the arrow no longer hugs the edge. (2) **Board rows show the real
  board preview image again** (dark top-down plan on the light tile; 52×32
  desktop / 64×40 mobile) — the earlier glyph-only call was wrong (the board art
  is 60–100% opaque, not a sliver); the glyph is now only the failure fallback,
  and its colour moved `ink-muted`→`border-strong` (1.8:1 → 3:1; it was
  effectively invisible). (3) The Pedals | Boards switcher is framed
  (`--color-border-strong`), carries the tab-bar icons, and the selected segment
  is an accent-tinted pill with an accent outline (was a faint raised fill).
  (4) The toolbar "Add" button became two icon buttons — pedal glyph + "+" (Add
  pedal) and board glyph + "+" (Add board); the mobile tab bar remains the
  trigger `<1024px`. `design-reviewer` **approve** (desktop + mobile, dark +
  light).
- The modal/sheet is shared by boards + pedals; more tabs (Cables/Custom/More from
  design.md §Responsive approach) arrive with their own tasks (P2-02, P4) — do not
  stub them here beyond what P2-01 needs.
