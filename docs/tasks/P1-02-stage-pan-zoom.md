# P1-02: Stage — grid, pan, zoom, resize-proof

**Phase:** P1 · **Status:** todo · **Model:** build-strong

## Goal
A Konva Stage fills its container, shows a dot grid, pans via drag (mouse) and two-finger touch, zooms to the pointer via wheel and pinch, and survives window resize with all world positions unchanged.

## Read first (context pack)
- `docs/design.md` §Canvas architecture
- `docs/decisions/001-canvas-library.md` §Risks
- `src/lib/geometry.ts` (from P1-01)

## Constraints
- Zoom/pan mutate the **stage transform only** — never object props.
- Clamp zoom (0.1×–8×). Pan is unbounded (infinite canvas).
- Grid is rendered in screen space (dots recompute on transform) — not as canvas objects.
- Use ResizeObserver for stage sizing (Konva doesn't auto-resize).
- **Gesture priority (N4):** 1 pointer = select/drag on hit object; 2 pointers = pan/zoom regardless of target; never both in one gesture.

## Steps
1. `src/canvas/Stage.tsx` + `GridLayer` + viewport store (`state/viewport.ts`: scale, x, y)
2. Wheel: zoom-to-pointer. Drag on empty stage: pan. Touch: two-finger pinch-zoom + pan (`Konva.hitOnDragEnabled = true`)
3. ResizeObserver → stage.width/height; verify A1 manually (resize window: nothing moves relative to grid)
4. Vitest where logic permits (zoom clamp, pointer math)

## Acceptance (executable)
- `pnpm test` + `pnpm build` pass
- Manual checks in PR notes: wheel zoom centers on cursor; pinch works on a touch device; window resize doesn't shift the grid's world origin
- Playwright smoke: stage renders, wheel event changes transform

## Notes
Mobile gesture quality is ADR-001's main risk — test on a real phone, not just devtools emulation.