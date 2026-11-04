# Q-04 — Mobile add (+)

**Phase:** 1 · **Status:** in review · **Model:** light

## Goal

Make the mobile add affordance explicit and fix the narrow-width toolbar
collision that clips the scene plate next to it.

On mobile (<1024 px) the desktop **Add pedal** / **Add board** (+) toolbar
buttons are intentionally hidden; the approved add path is the persistent bottom
tab bar (`Pedals` / `Boards` / `Custom`). That path works, but the dock tabs read
only as navigation/filtering — they have no "+" cue and no "add" wording. On a
populated canvas the only remaining "add" teaching is gone, so a returning user
has no visible signal that the tabs add gear.

At the same narrow widths (360 px and below) the top-right toolbar's leftmost
control (endpoint / add amp-or-instrument) overlaps the top-left scene-name
trigger: at 360 px the trigger ends at 107.4 px while the toolbar starts at
98 px (9.4 px overlap); at 320 px the overlap is 42 px. The scene plate's right
rounded corner and chevron are covered. This is the toolbar-crowding part of the
same mobile chrome.

This task adds a small "+" to the **Pedals** and **Boards** dock icons (closed
sheet only — the in-sheet tabs are switchers, not add actions), keeps the
existing approved tab-bar/picker direction, and caps the scene trigger so it
always keeps an 8 px gutter from the toolbar. The mobile measure button becomes
a 44 px icon-only control (its label is already hidden there), which is what
creates the room. No new dependency, no picker redesign.

## Gap found (production preview, `main` `db213c8e`)

| Width | Scene trigger right | Toolbar left | Gap | Result |
|---:|---:|---:|---:|---|
| 320 | 100 | 58 | −42 | endpoint button covers the trigger |
| 360 | 107.4 | 98 | −9.4 | right corner + chevron clipped |
| 375 | 107.4 | 113 | +5.6 | tight but OK |
| 412 (Pixel 7) | 139.4 | 150 | +10.6 | OK |
| 667×375 (landscape) | 139.4 | 405 | +265.6 | OK |

Mobile dock at 360: `Pedals` / `Boards` / `Custom` + undo/redo, 90 px each. The
tabs are reachable (56 px tall) but carry only noun labels and glyphs; the "+"
is absent from every mobile screen.

Out of scope (observed, not changed here): the first picker row's initial
highlight, the chip-row edge treatment, and the "No board — adds loosely" copy.
They are logged as follow-ups in `docs/progress.md`.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-template.md`
- `docs/tasks/P2-01-picker-modal.md` → approved mobile tab-bar direction
- `docs/requirements.md` → responsive / mobile / picker rows
- `docs/design.md` → toolbar + mobile chrome / Picker
- `src/App.tsx`, `src/components/Picker.tsx`, `src/index.css` (toolbar + mobile
  dock rules)

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/Q-04/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are coordinator-only; this task needs none.
- One PR; no merge.

## Constraints

- cm is the source of truth; no canvas geometry change.
- Keep the approved "Specimen Bench" picker + mobile tab-bar direction. The only
  new visual element is a small "+" next to the Pedals/Boards dock glyphs.
- Preserve 44 px touch targets, focus order/return, and desktop rendering.
- Design gate: small fix inside the approved direction → `design-reviewer`
  (≤2 passes; R1 diagnostic already run, R2 on the frozen after pixels) on
  desktop + mobile, dark + light.
- Code review: ≤1 light pass on the source diff.
- Budget: builder 400k/800k billed non-cache; review ≤300k; task hard ≤1.1M.

## Implementation

1. `Picker.tsx` — in the closed dock variant only, render a small `PlusIcon`
   after the `PedalIcon` / `BoardIcon` inside a flex icon frame. The in-sheet
   bar keeps its plain switcher glyphs.
2. `index.css` — dock icon frame + plus sizing; mobile measure trigger 44 px
   icon-only (centered); scene-trigger max-width reserves the full 5×44 px
   toolbar + 8 px gutter (`calc(100vw - 276px)`), so the plate ellipsizes rather
   than colliding.
3. `e2e/picker.spec.ts` — mobile assertions: the two dock "+" cues are visible,
   the in-sheet bar has none, and at 360/320 the scene trigger keeps ≥8 px
   clearance from the toolbar.
4. Screenshots + docs hub.

## Acceptance (executable)

- At 360×800, the scene trigger's right edge is ≤ toolbar left − 8 px; same at
  320×640. Page horizontal scroll width equals the viewport.
- The closed mobile dock shows a "+" cue on **Pedals** and **Boards**; the open
  in-sheet tab bar does not.
- Mobile add still works: tapping Pedals/Boards opens the correct picker tab and
  an item can be placed; the 44 px tab targets are unchanged.
- Desktop (≥1024 px) renders identically (the two toolbar Add buttons are the
  add path; no dock).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- `pnpm e2e` green (desktop + mobile); touched picker/first-run/export flows
  green.
- Before/after screenshots embedded for desktop + mobile, dark + light.
- Performance numbers recorded (bundle delta, picker/canvas frame time, memory,
  share/export unchanged) with no regression.
- Docs hub updated (`/changelog`; `/help` only if the workflow changes).
- One PR; no merge.

## Notes

- R1 `design-reviewer` (diagnostic, before pixels) found: (1) no permanent add
  signal on mobile chrome → add "+"; (2) scene trigger collides at 360 → cap +
  gutter; (3) other picker nits are out of scope. It did **not** confirm the
  claimed "two active tab idioms"; computed styles show only the active tab is
  accented, so that finding is not being implemented.
- R2 `design-reviewer` (after pixels) **approve-with-changes**. It approved the
  "+" cue and the plate fix. Its one blocker (a bottom status strip overflowing)
  was a **stale-baseline false positive**: that false blocker was captured from
  an old `dist` (3 Nov) that lacked the current Margin Rule. A fresh build of
  the true baseline (`db213c8e`) shows the same 401.5 px strip overflowing at
  320/360/375 **before and after**, so Q-04 does not introduce it. The valid nit
  (360 shows `Sce…`) was fixed by tightening only the toolbar gap to 2 px at
  ≤374 px, which gives the plate 92 px at 360 (full `Scene 1`). At 320 the plate
  is 52 px (`S…`); that edge is accepted, no overlap. The pre-existing strip
  overflow is logged as a follow-up, not fixed here.
- Follow-ups (out of scope): the Margin Rule strip is 401.5 px wide at 320–375
  and clips its ends; the first picker row opens pre-highlighted; the mobile chip
  row can cut a pill at the right edge; the "No board — adds loosely" copy is
  jargon.
- Performance: no canvas/share/export code path changed; record measured
  bundle/CSS deltas and a picker-open frame-time sample.
