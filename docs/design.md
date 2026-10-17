# Pedalvision — Design

Decisions are recorded in `docs/decisions/` (001 canvas, 002 hosting/assets, 003 catalog data, 004 agent context, 005 design governance, 006 code review governance, 007 mobile/touch testing). This file describes the target architecture.

## Stack
React 19 · TypeScript · Vite · react-konva (Konva 10) · Zustand · zod · pnpm · Biome · Vitest · Playwright · Cloudflare Pages (v1; R2 deferred — ADR-002)

## Folder structure (created in P0)
```
src/
  components/     # DOM UI: toolbar, picker, panels, modals, bottom tabs
  canvas/         # Konva layer: Stage, GridLayer, BoardNode, PedalNode, CableLayer, SelectionLayer
  state/          # Zustand stores: scene, selection, viewport, settings
  lib/            # geometry (cm↔px, rotation), scale, units, serialization, share codec
  catalog/        # catalog types, schema (zod), loaders
  assets/         # local static (icons, board textures)
public/
  pedal-assets/   # (P0-04) v1 images — same-origin, ship with Pages deployment
tools/
  asset-pipeline/ # (P2) image processing: bg removal, trim, resize, JSON draft
  catalog-transform/ # (P0) one-off external catalog → our schema
docs/             # this documentation
scripts/          # dev tooling entrypoints (deferred: R2-era assets:sync; not created in v1)
```

## Canvas architecture (the core)
- One Konva `Stage`. Layer order: `GridLayer` (dot grid) → `BoardLayer` (one Konva Group per board, containing that board's attached pedals — NOT a flat PedalLayer) → `LooseItemLayer` (items not on any board: supplies, detached pedals) → `CableLayer` → `DragLayer` → `SelectionLayer` (Transformer, hover outlines). **Each board's group owns its pedals**, so z-order is scoped per-container (see P1-06): reorder within a board's group, or within the loose-item layer — never a global `z`. **CableLayer sits above BOTH board and loose items** (S5), so cables always render above all pedals. **Boards stack by array order** — later-placed boards render on top; user board-to-board stacking is v2 (S6).
- **DragLayer (N2):** a transient world-space layer that holds a pedal while it's lifted during a cross-board drag (P1-04) — sits above `CableLayer` so the dragged pedal never dips below cables. While the pedal is lifted, the **single top-level Transformer** (B2, §Free rotation) is **detached** from it (`SelectionLayer` clears its attach uid), so no Transformer is shown mid-drag; on dragend the pedal reparents into the destination board's group (or `LooseItemLayer`) and the Transformer re-attaches to it if it is still selected. **Pan interrupt (R6/N3):** if a two-finger pan begins mid-drag, the lifted pedal **drops in place** (reparents at its current position) — it does NOT return to its origin.
- **World units = cm.** Render mapping: `px = cm × PX_PER_CM × stage.scale`. `PX_PER_CM` is a constant (start: 4). Zoom = stage scale; pan = stage position.
- **Zoom/pan mutate the stage transform only** — objects are never rescaled. Positions are stored in cm, so viewport resize cannot move anything (A1).
- Pedal positions are stored **relative to their board's origin** (cm), in the board's unrotated frame; rendering applies the board transform to the group. Loose items (power supplies, pedals not yet on a board) use world coordinates and live in `LooseItemLayer`.
- **Gesture priority (N4):** 1 pointer = select/drag on the hit object; 2 pointers = pan/zoom **regardless of target** (pan always wins on two-finger). Never both in one gesture.
- **Theming (N1):** Konva shapes can't read CSS variables → a JS theme map (`src/styles/theme.ts`) mirrors the token values for canvas (grid dots, selection, cables); components + canvas read from the same source. All visual values live in `src/styles/tokens.css` (dark default, `[data-theme="light"]` override). **Design governance (ADR-005):** visual direction is owned by the `designer` agent (`.opencode/agent/designer.md`, run via `/design-review`) and every new direction is owner-approved; heavy design work also runs a designer⇄reviewer loop where the `design-reviewer` agent inspects the rendered screenshots (vision model) — see AGENTS.md → Design gate.
- Free rotation: Konva `Transformer`, any angle (no snap by default; optional 15° snap with Shift). Touch: enlarged custom anchors + action buttons under selection (stompboxgarden pattern). **Transformer placement (B2, revised in P1-05):** Konva positions a Transformer in **absolute coordinates** (its `getAbsoluteTransform` ignores ancestor transforms), and an interactive Transformer nested *inside* the board group did not receive pointer events (the press landed on the stage), so there is **one top-level Transformer** for the selected item, in `SelectionLayer`, attached to the item's node via a uid registry (`canvas/itemNodeRegistry.ts`) — correct for board-attached and loose items alike. Konva's `_fitNodesInto` decomposes the parent transform, so rotating a pedal on a rotated board stores the rotation **relative to the pedal** and never touches the board transform (covered by `state/rotation.test.ts` + the S3 Playwright test). The selected item's **halo** still renders inside its container (inheriting the board transform); the **hover** outline lives in world coords and recomputes via `boardToWorld` (N3).
- Export (S1): export does **not** rasterize the live stage (which at high zoom × pixelRatio exceeds iOS's canvas ceiling and clips off-canvas content). Instead, build a **detached offscreen Konva Stage** — NOT a layer on the live stage (a layer inherits the stage zoom/pan and clips to the viewport-sized canvas, so it would rasterize wrong). Clone the export content onto it, size the stage to `contentBounds × pixelRatio`, leave its transform at identity (scale 1, no offset), then `toDataURL({ pixelRatio: ≤2 })` on it.
- **Export scope:** selectable — (a) *selected board* = the board + its attached pedals + their **in-scope cables**; or (b) *all content* = bounds of everything (boards, loose items, cables, endpoints). Non-selected content is excluded in scope (a).
- **Out-of-scope cable rule (S1):** in scope (a), a cable is included **only if BOTH endpoints are in scope** (pedal↔pedal both on this board, or pedal → endpoint within **board bounds + a defined margin**, e.g. +30 cm — so the amp/instrument signal cables that sit beside the board are NOT dropped from the headline export). A cable to anything out of scope is **dropped** — never clipped mid-air. Endpoints are included in scope (a) only as the far end of an in-scope cable within the inflated bounds.
- **Scope (b) bounds cap (N2):** if "all content" bounds balloon (e.g. one loose item dropped far from the boards), don't export a mostly-empty image — cap to a fit window (crop to the bounding box of content within X cm of a board) or offer a "fit visible" option alongside.
- **Export background (N2):** fill the offscreen stage with the app's **surface color** (not transparent) — exported PNGs get shared into unknown light/dark contexts.
- **All images must be same-origin / CORS-clean** or export throws (ADR-002). **Clamp total output pixels** (~4096×4096 max): if contentBounds × pixelRatio exceeds it, reduce pixelRatio/fit-scale — the iOS Safari silent-blank guard.
- Accessibility (N3): canvas has no DOM semantics → catalog, selection controls, and scene list are always mirrored in HTML. This covers **panels and item actions** (delete/duplicate/undo/redo); it does NOT claim full spatial-editor equivalence — keyboard placement/moving/rotating of items on the canvas is out of v1 scope.

## Data model (Zustand; persisted slice)
```ts
// catalog (static data, shipped as JSON)
type CatalogPedal = {
  id: string            // stable slug: "boss-tr-2"
  brand: string
  name: string
  widthCm: number       // footprint incl. jacks
  heightCm: number
  image: string         // filename (mock/static) or URL (url) — see imageSource
  imageSource: 'mock' | 'static' | 'url' // HOW the image is provided: mock=procedural placeholder; static=committed file under /pedal-assets/{kind}/{size}/; url=deferred same-origin/CDN (ADR-002). Orthogonal to `source` (rights).
  effectTypes: EffectType[] // OUR taxonomy enum (EFFECT_TYPES): sound effects + non-effect roles ("delay", "preamp", "buffer", …); see ADR-003 §Effect taxonomy
  category: 'pedal' | 'supply'  // R6/N1 — lets the picker + custom creator distinguish pedals from power supplies
  jacks?: { kind: 'in'|'out'|'exp'|'power', edge: 'top'|'right'|'bottom'|'left', pos: number }[] // pos = 0..1 position ALONG the edge (e.g. 0.5 = centered) — required so cable attach points + length calc have a concrete coordinate (S3)
  power?: { voltage: 9|12|18|number, acDc: 'DC'|'AC', currentMa: number }
  variantOf?: string    // model id for colorways (avoid catalog bloat)
  source: SourceTag     // provenance tag — zod enum: licensed | brand-assets | community | own | placeholder | synthetic (ADR-003; never a name/URL)
  sources?: { url: string, kind: ('info' | 'image')[] }[] // per-item source links a fact/image was verified against (manufacturer preferred; a link may be both; ADR-003 §Per-item sources)
  links?: { label: string, url: string }[] // v2 affiliate (locale-aware)
}
type CatalogBoard = { id: string, brand: string, name: string, widthCm: number, heightCm: number, image: string, imageSource: 'mock'|'static'|'url', source: SourceTag, sources?: { url: string, kind: ('info' | 'image')[] }[] } // tiers/risers DEFERRED to v2 (S4)

// scene (user data)
type PlacedItem = { uid: string, refId: string, kind: 'pedal'|'supply', boardUid: string | null, x: number, y: number, rotationDeg: number, z: number } // boardUid = owning board's uid (which container it belongs to), or null when loose; x,y = cm relative to that board (or world when boardUid is null); refId resolves to a catalog item (its `category` must match `kind`) OR an entry in Scene.customPedals
type PlacedBoard = { uid: string, boardRefId: string | null, customSize?: { widthCm: number, heightCm: number }, x: number, y: number, rotationDeg: number } // world cm; stack order = array order (S6)
type Endpoint = { uid: string, kind: 'amp' | 'instrument', x: number, y: number } // world cm — cable termination targets (B2)
type Cable = { uid: string, from: { itemUid: string, jack: string }, to: { itemUid: string, jack: string } | { endpointUid: string }, color?: string } // length computed, not stored
// custom pedal definition — embedded in the scene so it travels on share (R6/S1)
type CustomPedal = { refId: string, brand: string, name: string, widthCm: number, heightCm: number, category: 'pedal'|'supply', jacks?: CatalogPedal['jacks'], power?: CatalogPedal['power'] } // text-only, no image (renders as labeled rectangle)
type Scene = { id: string, version: 1, name: string, boards: PlacedBoard[], items: PlacedItem[], customPedals: CustomPedal[], endpoints: Endpoint[], cables: Cable[], updatedAt: string }
type Settings = { units: 'cm' | 'in' }  // display only — storage is always cm
```
External catalog formats are **transformed into this schema** by `tools/catalog-transform` (one-off dev tool). This schema is our **own model**, not a rename of any external one — see ADR-003 §Schema originality for the field mapping (cm-native geometry, slug ids, referential variants, provenance enum, our effect taxonomy). We do not inherit external conventions, field names, or images (inches, name-keyed entries, per-colorway duplicates, source image files).

### Z-order & container rules (P1-06)
Layering is **per-container, never global.** A *container* is either one board's group or the loose group (`boardUid: null`). A pedal's `z` only competes with the other items in its own container; boards stack independently by array order (S6). This follows directly from each board group owning its attached pedals (§Canvas architecture) — moving a pedal between boards is a **re-parent**, not a global layer change.

- **Dense per container:** `z` is always `0..n-1` — no gaps, no floats. Every mutation that adds, removes or reorders within a container re-normalises it. Renders sort a container's children ascending by `z` (higher draws on top); a stable sort is the fallback so ties can never scramble draw order.
- **New / duplicated item** → `z = (max z in its container) + 1` — it lands on top.
- **Reorder** (the action-bar `reorder(uid, forward | back | front | bottom)`) moves within the item's own container one step or to the extreme, then re-normalises. `forward`/`back` are no-ops at the top/bottom (those buttons are disabled there). v1 has **no drag-on-canvas reordering** — reordering is only via the action-bar controls (a layer-panel affordance is deferred).
- **Move between containers** (drag board A → board B, or → loose; the drop hit-tests the pedal's visible world centre against the topmost board):
  - the item lands **on top of the destination** (`z = max + 1` there), exactly like a fresh add;
  - the **source container is re-normalised** to close the hole it left;
  - a drop **inside the same container** keeps the item's `z` — dragging is not a re-order.
- **Remove board:** its attached items fall loose (geometry baked, visible rotation preserved) and the loose container is re-normalised, so a freed pedal's old board-relative `z` cannot collide with existing loose items.
- **Remove item:** its own container is re-normalised.

`z` is part of `PlacedItem` and therefore survives save/reload (A4). The full save system (IndexedDB + autosave + boot reconcile) is P3-02; until then a temporary localStorage mirror keeps `z` across reloads.

> This section is the **source of truth** for a future user-facing help/onboarding entry ("how layering works") — see the roadmap's user-help item.

## Persistence (v1, no backend)
- `localStorage`: settings + scene index (id → name, updatedAt)
- `IndexedDB` (via `idb`): scene documents; autosave debounced ~500ms
- **Boot reconcile (R6/S2):** on boot, reconcile the scene index (localStorage) against the scene documents (IndexedDB) — drop index entries with no document, and surface any orphaned documents back into the index. Handles partial eviction (private mode, extensions, browser settings). Lives in P3-02.
- Share: `scene → JSON → deflate (fflate) → base64url → location.hash (#s=…)`; recipients get a read-only view ("save a copy" button). Validate with zod + size cap on load. **Custom pedals travel in the scene payload** (R6/S1) so shared scenes render identically on any device (A5). Watch the ~200KB cap interplay (R6/N4): many custom pedals, each with jacks+power, approach the decoded-payload limit — the codec task (P3-03) should note this.
- **Versioning (S1):** `Scene.version` (starts at 1) + share-URL prefix `#s=v1:…`. Zod schema per version; on load, resolve `refId` against the catalog first, then `Scene.customPedals`; if still unknown, render a labeled placeholder box (keep geometry) rather than failing — so A4/A5 hold even after the catalog changes.
- **Storage failure (N3):** check IndexedDB availability/quota on boot; if unavailable, disable autosave + show an inline warning + offer "download scene backup" (JSON). Never lose work silently.
- **Undo/redo (S5):** snapshot-based undo stack on the persisted scene slice (cap ~50 snapshots), keyboard: Ctrl/Cmd+Z / Shift+Z (N6). Ships as its own task (P3-04), not bundled into save/load.

## Assets & catalog
- Catalog JSON (`pedals.json`, `boards.json`) ships in the app bundle (static import). It is zod-validated **at module load** by `src/catalog/load.ts` (fail-fast) and guarded in CI by a Vitest test against the committed seed — not by a `vite build` step.
- **v1 (ADR-002):** images live in the repo under `public/pedal-assets/` and ship with the Pages deployment (same-origin, no CORS). Two renditions per item — `800/` (master) and `350/` (thumb), pre-resized by the asset pipeline; **no runtime image service**.
- URL convention (dev + v1 prod): `/pedal-assets/pedals/350/{image}`, built via `assetUrl()` in `src/lib/cdn.ts`. R2 with `{CDN_BASE}` is the deferred path (ADR-002) — revisit before ~2k items. `pnpm assets:sync` (scripts/) is the deferred **R2-era sync tool, unused in v1**.
- **Image-resolution contract (P1 renderer):** branch on `imageSource` — `mock`/`static` → `assetUrl(kind, size, item.image)`; `url` → use `item.image` directly (an absolute `http(s)` URL, loaded with `crossOrigin="anonymous"`). **Where an official brand image URL is recorded, `url` is preferred; `mock` is the fallback** (ADR-003 §Brand image URLs). CORS-clean hosts display (canvas stays untainted for export); non-CORS hosts + hotlink-blocked URLs fall back to the labeled rectangle. `assetUrl()` does not URL-encode, so the catalog schema guarantees safe filenames (ADR-003). A missing/failed image falls back to a labeled rectangle at the item's cm footprint (P1-03/P1-04).
- Lazy loading — **NOT implemented in P1 (deferred).** The design intent is to load an image only when the item enters the viewport (Konva `Image` + an intersection check on the stage transform); today every mounted node eagerly loads its asset on mount. Revisit when item counts / zoom-out workloads warrant it (tracked in `docs/progress.md` → Follow-ups).

## CI/CD (ADR-002)
PR / push to main → `pnpm install --frozen-lockfile` (cached) → `biome ci` → `tsc -b` (`pnpm typecheck`) → `vitest run` → `vite build` → Playwright (chromium only, cached browsers, `vite preview`) → `wrangler-action` Pages deploy (PR = preview URL, main = production).

## Security (static SPA threat model)
- XSS via custom pedal/board names → React escaping; no `dangerouslySetInnerHTML`; any future rich text sanitized.
- Share-URL bomb → cap decoded payload (~200KB), zod-validate before applying to store.
- Asset integrity → v1 images are static repo files reviewed via PR; no user uploads in v1. (If/when R2: bucket private, uploads only via CI/owner script.)
- Dependencies → `pnpm audit` weekly in CI + Dependabot; keep deps < 6 months old (launch-gate check).
- Secrets → Cloudflare token in GitHub Secrets only; never in repo.

## Testing strategy
- **Vitest** (the guardrails): geometry (cm↔px, rotation about center, board-relative transforms incl. A1 invariance), serialization round-trip, share codec round-trip + size cap, cable length calc, units conversion, catalog zod schema.
- **Playwright** (chromium, smoke only): app loads → add board → add pedal → rotate → save → reload persists → export non-blank → share URL loads read-only scene.

## Responsive approach
- ≥1024px: top toolbar + right sidebar panels + modal picker.
- <1024px: bottom tab bar (Pedals / Boards / Cables / Custom / More), full-screen sheets, touch-first selection (bigger anchors, action buttons under selection).
- One codebase: layout switches via CSS/container queries; canvas interactions unified via pointer events.