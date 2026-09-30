# ADR-001: Canvas rendering — react-konva

**Status:** Accepted (2026-09-22)

## Context
2D top-down canvas: drag/drop images, free rotation (any angle), z-order layers, pan/zoom (mouse + touch), true-scale units, image export, React integration, responsive from day 1.

## Decision
**Konva 10 + react-konva 19** (React bindings are official; major versions must match React's).

## Alternatives considered
| Option | Why rejected |
|---|---|
| Fabric.js | Capable, but weaker React story (no official bindings) and historically weak touch/gesture support |
| PixiJS | WebGL perf we don't need (~100 static images); all editor UX (drag/rotate handles, selection) must be built from scratch |
| Plain DOM/CSS | Image export unreliable on iOS/Safari (html-to-image/html2canvas blank-canvas bugs) — export is a core feature (F9) |
| tldraw SDK | Source-available license: production use needs paid key (~$6k/yr) or watermark |
| Excalidraw | A whole whiteboard app, not an embeddable toolkit |
| LeaferJS | Interesting (MIT, built-in editor+gestures) but thin ecosystem/docs/React story |

Supporting evidence: multiple open-source true-scale planners (floor-plan apps with the same requirements: world units, drag/rotate, pan/zoom, export) run React+Vite+react-konva+Zustand. Polotno (Canva-clone SDK) is built on Konva.

## Risks & mitigations
1. **Touch rotate UX not turnkey** → enlarged custom Transformer anchors + action buttons under selection (stompboxgarden pattern); prototype early (P1-05).
2. **iOS canvas export caps / silent blank** → clamp `pixelRatio` ≤2, crop to board region, verify on real device (launch gate).
3. **CORS-tainted images break `toDataURL`** → all images same-origin or CORS-enabled CDN (hard rule, see AGENTS.md + ADR-002).
4. **Stage doesn't auto-resize** → ResizeObserver in P1-02.
5. **Canvas has no a11y semantics** → all controls mirrored in HTML (design.md).
6. **Transformer under a rotated parent** → for board-attached pedals the Transformer lives inside the board's group (B2); never a world-space Transformer over a rotated board group.