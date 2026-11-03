# Q-01 — rotate-shadow flicker

**Phase:** 1 · **Status:** in progress · **Model:** light (escalate to strong only for architecture/security/high-risk)

## Goal

Fix the selection halo that stays behind a pedal while it is being rotated with
the Konva `Transformer`. During rotation the halo (a canvas-coloured rounded
rect, read as a "shadow") keeps its committed angle while the pedal rotates
live, then snaps on release. This is a correctness/polish bug inside the
approved **Blueprint** direction: the halo must follow the live transform so the
pedal reads as one object while rotating.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 (Phase 1, Q-01)
- `docs/design.md` §Canvas architecture → SelectionLayer / free rotation
- `src/canvas/PedalNode.tsx`, `src/canvas/SelectionOutline.tsx`,
  `src/canvas/BoardNode.tsx`, `src/canvas/ItemNodes.tsx`,
  `src/canvas/ItemTransformer.tsx`
- `e2e/selection.spec.ts`, `e2e/touch.spec.ts`

Read only the pointed sections; do not read whole docs.

## Reproduction (2026-11-03)

Reproduced against `main` (`3189f6e4`, then `714dd852`) in the production
preview build, desktop (1280×900) and mobile (390×844), dark and light:

1. Add a BOSS BCB-1000 board and a BD-2 Blues Driver on it.
2. Select the pedal and drag the Transformer rotate handle.

Observed: a static, axis-aligned rounded rectangle (the canvas-coloured
selection halo) stays under the rotating pedal and snaps to the new angle on
release. It is most visible in the light theme (a white block behind the
rotating pedal) and on mobile. The same happens for a loose pedal.

**Cause:** `SelectionOutline` is rendered as a sibling from the committed
`item.rotationDeg` (and committed board-local x/y). The Transformer mutates the
Konva item node live; React state is only updated on `transformend`, so the
sibling halo lags for the whole gesture.

## Workstream / boundaries

- **Feature workstream:** own `src/canvas/**`, `e2e/**`, this task file and
  `docs/screenshots/Q-01/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: if this task needs one, **STOP**
  and report — it becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.
- No visual-direction change, no shadow-semantics change, no new dependency.

## Fix

Render the selection halo **inside the item's own Konva group** (a child of
`PedalNode`) so it inherits the live Transformer transform (position + rotation)
for board-attached, loose and lifted items. Remove the sibling halos from
`BoardNode` and `ItemNodes`; pass a `selected` flag into `PedalNode`. Keep the
halo hidden while that item is in jack-proof mode (matching the loose-item
behaviour).

## Steps

1. Reproduce in the preview build on desktop + mobile, dark + light (done).
2. Implement the minimal fix (halo child of the item group).
3. Add a regression E2E: freeze a mid-rotation screenshot, release at the same
   handle position, and assert the post-commit render matches the mid-drag
   render (the old sibling halo changes angle on commit).
4. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
5. Design review: rendered pixels change (halo now rotates); run
   `design-reviewer` ≤2 passes on desktop + mobile, dark + light with
   before/after evidence.
6. One light `code-review` pass on the source diff.
7. Open exactly one PR; do not merge.

## Acceptance (executable)

- During rotation the halo is aligned with the rotating pedal (mid-drag vs
  post-commit pixel comparison test passes).
- The halo still shows on selected board-attached, loose and lifted items, and
  is hidden in jack-proof mode.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green (desktop + mobile).
- Before/after screenshots (desktop + mobile, dark + light) and a short
  rotation video/GIF are attached.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*` or other shared/coordinator-only files.
- One PR; no merge.

## Notes

- The lift shadow (`theme.itemShadow`) is unchanged; it still only appears while
  an item is lifted in the DragLayer.
- Record billed tokens by class in the PR/session summary.
