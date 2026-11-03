# Q-01 — rotate-shadow flicker

**Phase:** 1 · **Status:** in review — PR #98 · **Model:** light (escalate to strong only for architecture/security/high-risk)

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

Keep the halo as the existing sibling node and **mirror the item node's live
transform onto it during the gesture**:

- `SelectionOutline` gets `name="selection-halo"`.
- `ItemTransformer` finds that node at `transformstart` and, on every
  `onTransform`, copies the item node's local `x`/`y`/`rotation` onto the halo
  (they share the parent frame for board-attached, loose and lifted items) and
  requests a layer redraw. The ref is re-resolved if the node was detached.
- No change to the Transformer's attached node set, so its `getClientRect`
  bounds — and therefore the cyan border/rotate handle geometry — stay
  identical.

**Rejected alternative:** rendering the halo as a child of the item group. It
inherits the transform for free, but the 2 px outset + ring stroke enters the
group's `getClientRect`, growing the Transformer bounding box by ~4 px and
shifting the border/rotate handle (measured: 29.2 × 52.08 → 33.2 × 56.08 px).
That is a selection-chrome change outside this bug fix.

## Steps

1. Reproduce in the preview build on desktop + mobile, dark + light (done).
2. Implement the minimal fix (sibling halo + imperative live-transform sync).
3. Add a regression E2E: read the live Konva halo/item nodes mid-drag, assert
   `x`/`y`/`rotation` and absolute rotation match, then re-read after release
   and assert the committed re-render still matches.
4. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
5. Design review: rendered pixels change (halo now rotates); run
   `design-reviewer` ≤2 passes on desktop + mobile, dark + light with
   before/after evidence.
6. One light `code-review` pass on the source diff.
7. Open exactly one PR; do not merge.

## Acceptance (executable)

- During rotation the halo is aligned with the rotating pedal (the E2E asserts
  live + post-commit halo/item transforms match).
- The halo still shows on selected board-attached, loose and lifted items;
  jack-proof behaviour is unchanged.
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
