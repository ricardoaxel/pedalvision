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
  assets/         # local static (icons) — board textures are procedural (tokens/Konva), NOT files (P2-05)
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
- Export (S1): export does **not** rasterize the live stage (which at high zoom × pixelRatio exceeds iOS's canvas ceiling and clips off-canvas content). Instead, build a **detached offscreen Konva Stage** — NOT a layer on the live stage (a layer inherits the stage zoom/pan and clips to the viewport-sized canvas, so it would rasterize wrong). Clone the export content onto it, size the stage to `contentBounds × EXPORT_PX_PER_CM` (32 px/cm at 1×; the live canvas is 4 px/cm), leave its transform at identity relative to export content (no inherited pan/zoom), then `toDataURL({ pixelRatio: ≤2 })` on it. The detached layer's scene canvas is pinned to 1× so DPR can't multiply the iOS budget.
- **Export scope:** selectable — (a) *selected board* = the board + its attached pedals + their **in-scope cables**; or (b) *all content* = bounds of everything (boards, loose items, cables, endpoints). Non-selected content is excluded in scope (a).
- **Out-of-scope cable rule (S1):** in scope (a), a cable is included **only if BOTH endpoints are in scope** (pedal↔pedal both on this board, or pedal → endpoint within **board bounds + a defined margin**, e.g. +30 cm — so the amp/instrument signal cables that sit beside the board are NOT dropped from the headline export). A cable to anything out of scope is **dropped** — never clipped mid-air. Endpoints are included in scope (a) only as the far end of an in-scope cable within the inflated bounds.
- **Scope (b) includes everything (owner decision, 2026-10-19):** all content = every board, loose item, cable and endpoint, even a far-off loose pedal with no board. No automatic fit/trim — the **16.7 MP pixel clamp** fits extreme layouts into a valid image. A user who wants a tight, high-density image selects a board instead.
- **Export background (N2):** fill the offscreen stage with the app's **surface color** (not transparent) — exported PNGs get shared into unknown light/dark contexts. **PDF is the print artifact** and always uses the **paper-light palette** (regardless of the app theme) so it prints cleanly.
- **PNG download transport (A3 follow-up, 2026-10-19):** the generated PNG is saved through a **Blob object URL**, not a `data:` URL. iOS Safari's `<a download>` silently fails for multi-MB data URLs; a realistic photographic board exports at ~2.14 MB, so the previous path could report "PNG saved" without producing a file. The object URL is revoked after 60 s (revoking immediately can break the iOS save sheet).
- **PDF export (P3-01 follow-up):** the same detached renderer rasterizes to JPEG (~0.92) and wraps it in a **single-page PDF at exact physical size** (cm → pt, 1 cm = 28.3465 pt) with a `DCTDecode` image XObject. Zero new dependencies (`src/lib/pdf.ts`); the page is true scale and includes the same 4 cm margin + drafting scale bar. SVG is deliberately not offered in v1: the artwork is photographic raster, and PDF covers print/share.
- **All images must be same-origin / CORS-clean** or export throws (ADR-002). **Clamp total output pixels** to **16.7 MP** (the iOS 17-and-older canvas ceiling) with an **8192 px edge** safety cap: fit-scale then reduce pixelRatio so the output never exceeds either limit — the iOS Safari silent-blank guard. Dimensions may exceed 4096 px as long as total area stays under 16.7 MP (supported by older iOS). The output spec shows the effective **PPI**; the notice reads "Resolution capped for iOS compatibility." when the cap binds.
- Accessibility (N3): canvas has no DOM semantics → the **catalog** (picker) and **selection controls / item actions** (rotate, duplicate, delete, z-order) plus the P2-03 info panel are mirrored in HTML. A **scene-list mirror** (an HTML list of placed boards/items for assistive tech) is **deferred** — it is not implemented and has no owning task yet; schedule it with a later accessibility/scene-management pass (see `docs/progress.md` → Follow-ups). This does NOT claim full spatial-editor equivalence — keyboard placement/moving/rotating of items on the canvas is out of v1 scope.

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
  category: 'pedal' | 'supply'  // R6/N1 — lets the custom creator + PlacedItem/renderer distinguish pedals from power supplies. The catalog picker currently lists pedals only; catalog supplies are not placeable yet (create a custom supply in the Custom tab — see progress.md Follow-ups)
  jacks?: Jack[] // { kind: JackKind, edge: 'top'|'right'|'bottom'|'left', pos: number }; JackKind = 'in'|'out'|'exp'|'exp-in'|'exp-out'|'send'|'return'|'midi'|'ctrl'|'power' (widened in P2-02; P4-01 consumes it). pos = 0..1 position ALONG the edge (e.g. 0.5 = centered) — required so cable attach points + length calc have a concrete coordinate (S3)
  power?: { voltage: 9|12|18|number, acDc: 'DC'|'AC', currentMa: number }
  variantOf?: string    // model id for colorways (avoid catalog bloat)
  source: SourceTag     // provenance tag — zod enum: licensed | brand-assets | community | own | placeholder | synthetic (ADR-003; never a name/URL)
  sources?: { url: string, kind: ('info' | 'image')[] }[] // per-item source links a fact/image was verified against (manufacturer preferred; a link may be both; ADR-003 §Per-item sources)
  links?: { label: string, url: string }[] // v2 affiliate (locale-aware)
}
type CatalogBoard = { id: string, brand: string, name: string, widthCm: number, heightCm: number, image: string, imageSource: 'mock'|'static'|'url', source: SourceTag, sources?: { url: string, kind: ('info' | 'image')[] }[] } // tiers/risers DEFERRED to v2 (S4)

// scene (user data)
type PlacedItem = { uid: string, refId: string, kind: 'pedal'|'supply', boardUid: string | null, x: number, y: number, rotationDeg: number, z: number } // boardUid = owning board's uid (which container it belongs to), or null when loose; x,y = cm relative to that board (or world when boardUid is null); refId resolves to a catalog item (its `category` must match `kind`) OR an entry in Scene.customPedals
type PlacedBoard = { uid: string, boardRefId: string | null, customSize?: { widthCm: number, heightCm: number }, texture?: BoardTexture, name?: string, brand?: string, x: number, y: number, rotationDeg: number } // world cm; stack order = array order (S6). A custom board (boardRefId null) stores its definition INLINE (customSize + texture + optional name/brand) — P2-05; no separate def table (boards aren't duplicated in v1). BoardTexture = 'matte'|'brushed'|'wood'|'tolex' (procedural finishes, tokens only)
type Endpoint = { uid: string, kind: 'amp' | 'instrument', x: number, y: number } // world cm — cable termination targets (B2)
type Cable = { uid: string, from: { itemUid: string, jack: string }, to: { itemUid: string, jack: string } | { endpointUid: string }, color?: string } // length computed, not stored. `jack` = the decimal INDEX into the resolved item's jacks array (catalog definition, then inline custom); jacks carry no id and duplicate kinds are allowed (P4-01)
// custom pedal definition — embedded in the scene so it travels on share (R6/S1)
type CustomPedal = { refId: string, brand: string, name: string, widthCm: number, heightCm: number, category: 'pedal'|'supply', effectTypes: EffectType[], jacks?: CatalogPedal['jacks'], power?: CatalogPedal['power'] } // text-only, no image (renders as labeled rectangle); refId is a scene-local id ('custom-<uuid>'), resolved via Scene.customPedals
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

`z` is part of `PlacedItem` and therefore survives save/reload (A4). The P3-02 save system (IndexedDB documents + autosave + boot reconcile) persists it; the old temporary single-scene localStorage mirror was migrated once at first boot.

> This section is the **source of truth** for a future user-facing help/onboarding entry ("how layering works") — see the roadmap's user-help item.

## Persistence (v1, no backend)
- `localStorage`: settings (`units`, `activeSceneId`) + scene index (id → name, updatedAt, cached board/part counts). Implemented in P3-02; the pre-P3 temporary single-scene mirror (`pedalvision.scene.v1`) is migrated once into a named scene and removed.
- `IndexedDB` (via `idb`): scene documents; autosave debounced ~500ms
- **Boot reconcile (R6/S2):** on boot, reconcile the scene index (localStorage) against the scene documents (IndexedDB) — drop index entries with no document, and surface any orphaned documents back into the index. Handles partial eviction (private mode, extensions, browser settings). Lives in P3-02.
- **Share (P3-03, `src/lib/shareLink.ts`):** `scene → JSON → deflate (fflate) → base64url → location.hash (#s=v1:…)`; recipients get a read-only view with "Save a copy". The payload is `{ version, name, boards, items, customPedals }` — **custom pedals travel inline** (R6/S1) so shared scenes render identically on any device (A5). Untrusted input is zod-validated before it reaches the store; unknown `refId`s are preserved and render the labeled fallback (never fail the scene). Caps: **200 KB decoded JSON**, a **32,000-character URL hard cap** (soft warning at 4,000; compressed/base64 limits are derived from it, ~24 KB), and streamed inflation with a 200 KB output cutoff (a link bomb aborts early and becomes a typed `too-large` error). An over-ceiling scene, or one whose link would be truncated by chat apps/address bars, is refused at encode time with an inline reason. A scene at the item/board/image hard caps is well under both ceilings. The recipient's scene document is never written while previewing: `enterPreview` flushes + suspends autosave, `savePreviewAsCopy` creates a **new** document (respecting `MAX_SCENES`), `exitPreview` restores the recipient's document. Every scene-store mutator is a no-op in read-only mode; the share hash is cleared after save/exit.
- **Versioning (S1):** `Scene.version` (starts at 1) + share-URL prefix `#s=v1:…`. Zod schema per version; on load, resolve `refId` against the catalog first, then `Scene.customPedals`; if still unknown, render a labeled placeholder box (keep geometry) rather than failing — so A4/A5 hold even after the catalog changes.
- **Scene cap (product decision, 2026-10-19):** **10 named scenes** in v1. It bounds the boot reconcile (`getAll()` reads every document) and keeps the register usable without search; `newScene` is refused at the cap and the register shows an inline reason (never a toast). Raise it when search/folders land.
- **Storage failure (F8, P3-05):** boot classifies storage once (`src/lib/storageHealth.ts`) from the IndexedDB open, a throwaway `localStorage` write/read/remove, and a **time-boxed `navigator.storage.estimate()`** started concurrently with the IDB open. States: `ok`; `low-quota` (estimate usable and ≥90% used → a quiet, dismissible inline advisory; the estimate is advisory only — missing/invalid/hanging/rejecting → `ok`, never a false warning); `unavailable` (IDB open/read/put failure, blocked `localStorage` even when IDB works, or a failed index write). Unavailable keeps the app fully usable **in memory**, stops autosave (writes latched, no retry loop), and shows a persistent inline **"Margin Note"** (desktop under the Title Block; mobile strip under the top row; never a toast/modal, N8) with **Download backup**. The backup is the **live in-memory scene** serialised as the versioned `SceneDocument` v1 JSON (same codec as IndexedDB, compact, safe `scene-name-YYYY-MM-DD.json`, Blob object URL revoked after ~60s); it never writes to the scene, index or settings, and session-only content never borrows a stored document's id/name. No import/restore UI in v1; read-only share previews show no storage notice.
- **Undo/redo (S5, P3-04):** snapshot-based `past`/`future` stacks over the persisted scene slice (`boards`, `items`, `customPedals`; P4 adds `cables`/`endpoints` to history through one compile-time-exhaustive key map — see the P4 extension contract below), cap **50** per direction, **in-memory only** (not persisted; a reload starts clean). One committed user action = one step: synchronous bursts are coalesced (`queueMicrotask`), so a whole drag/rotation records at its committed drop/transform, and custom-pedal definition + placement or board rotation + origin shift are atomic. Undo/redo never record themselves, never touch selection/viewport/picker state, clear on boot/new/switch/share-preview/save-copy (history never spans documents), and are no-ops in read-only previews. Restoring a snapshot bypasses add-time capacity refusals (a previously valid over-cap state can be undone to); autosave then writes the restored scene and refreshes index counts/`updatedAt`. Keyboard: `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` (N6; ignored in text fields, while composing, and while a modal is open). Visible owner-approved **"Proof Marks"** controls: an icon-only joined capsule at the leading edge of the desktop toolbar and the same pair pinned to the trailing edge of the mobile bottom dock.
- **P4 extension contract (cables/endpoints) — the real wiring list (P3 phase gate, 2026-10-21):** only **undo/redo** is compile-forced (`HISTORY_SCENE_KEYS` is a `satisfies Record<keyof SceneSnapshot, true>` map, so a new snapshot key fails the build). Everything else is manual and must be wired in the P4-01/P4-02 PR:
  - **Codec** (`state/sceneDocument.ts`): add the fields to `SceneDocument`/`SceneSnapshot`, `createSceneDocument`, structural guards (cables/endpoints), `parseSceneDocument`, and `normalizeSceneContent`/`sceneFromDocument` (drop cables whose item/endpoint is gone; drop dangling endpoints). Keep the additive **v1** document rule (older docs without the arrays stay valid).
  - **Persistence** (`state/library.ts`): `applyScene` must copy **every** snapshot key — a partial copy leaves the outgoing scene's cables in the newly loaded scene; `saveActive` must build the document from the full snapshot; the autosave subscriber must compare the new arrays; the legacy-migration, save-a-copy, preview and boot paths all call `createSceneDocument`/`applyScene` too.
  - **Share** (`lib/shareLink.ts` + `components/SharePanel.tsx`): encode the arrays **and** extend the zod `payloadSchema` (zod strips unknown keys, so an old decoder would silently drop cables). **P4 must decide the version policy explicitly:** keep additive `#s=v1:` (old P3 clients open the scene without cables, silently) or bump to `#s=v2:` (old clients reject the link cleanly). Encode, decode, schema and panel must agree, with a round-trip test.
  - **Backup** (`lib/sceneBackup.ts`): builds from the live `SceneSnapshot` via `createSceneDocument`; no separate serialiser — it inherits the codec wiring above.
  - **Export consumers** (`components/ExportPanel.tsx`, `components/ShareView.tsx`): pass the full scene, not the three-field literal. `lib/exportScene.ts` already supports `cables`/`endpoints` and the both-endpoints scope rule.
  - **Capacity consumers** (`components/CapacityAnnouncer.tsx`, `ScenePanel.tsx`, `Picker.tsx`, `ShareView.tsx`): pass the full scene so the 150/300 graph budget actually counts cables/endpoints; `lib/capacity.ts` already counts optional arrays.
  - **Benchmark** (`e2e/benchmark.spec.ts`): add cables/endpoints rows and re-run before raising the graph cap.
  - **Tests:** a codec/persistence round-trip that fails when a `SceneSnapshot` key is not written; a share round-trip; an over-graph shared scene that warns read-only.

## Capacity budgets (enforced in P3-06; benchmarked 2026-10-20)

v1 targets, from the report-only benchmark (`pnpm bench:capacity`, desktop Chromium, 1440×900). **Distinct image-bearing items — not item count or document bytes — are the memory driver**: a pedal image is ~1.44 MB decoded, so 400 *distinct* images ≈ 577 MB, while repeated items share the decode cache. The distinct scenarios use the **89 same-origin catalog items** (mock/static, so timings measure decode + draw work, not the network); the reuse scenarios use 7 repeated images. The benchmark asserts only structural facts (export clamp + a valid PNG), never ms thresholds.

| Scenario | Distinct images | Doc bytes | Boot | JS heap | rAF (1 s zoom) | Export | PNG |
|---|---:|---:|---:|---:|---:|---:|---:|
| 89 distinct · 10 boards | 89 | 12.5 KB | 35 ms | 12.1 MB | 58 fps | 304 ms | 0.54 MB (6485×2586) |
| 1 board · 50 items (7 images) | 7 | 6.3 KB | 37 ms | 12.1 MB | 61 fps | 208 ms | 1.65 MB (4096²) |
| 1 board · 100 items (7 images) | 7 | 12.4 KB | 31 ms | 12.1 MB | 61 fps | 277 ms | 2.85 MB (4096²) |
| 1 board · 200 items (7 images) | 7 | 24.8 KB | 111 ms | 12.1 MB | 61 fps | 417 ms | 5.16 MB (4096²) |
| 1 board · 400 items (7 images) | 7 | 49.6 KB | 35 ms | 12.1 MB | 43 fps | 630 ms | 9.87 MB (4096²) |
| 400 items · 89 distinct | 89 | 51.2 KB | 36 ms | 12.1 MB | 35 fps | 630 ms | 5.39 MB (4096²) |
| 10 boards · 400 items (7 images) | 7 | 50.6 KB | 36 ms | 12.1 MB | 49 fps | 319 ms | 1.61 MB (6485×2586) |
| 10 scenes · 100 items | 7 | 12.4 KB each | 37 ms | 12.1 MB | 61 fps | 280 ms | 2.85 MB (4096²) |
| 50 scenes · 100 items | 7 | 12.4 KB each | 34 ms | 12.1 MB | 61 fps | 278 ms | 2.85 MB (4096²) |

Boot is wall-clock reload until the scene chrome is visible (includes engine startup); heap is the Chromium JS heap (`performance.memory`), so image decodes held natively are not all counted. Export is **all content, Standard**. No CI timing gate exists — the numbers are a human comparison table.

**Budgets (soft = inline warning; hard = refusal with an inline reason):**

| Dimension | Soft | Hard |
|---|---:|---:|
| Items / scene | 200 | 400 |
| Distinct image-bearing items / scene | 150 | 250 |
| Boards / scene | 8 | 10 |
| Cables + endpoints / scene (P4 estimate) | 150 | 300 |
| Scenes | — | **10** (implemented, P3-02) |
| Export | >12 MP or ~15 MB estimate | **16.7 MP / 8192 px** (implemented clamp) |

**The budgets are scene-wide totals across every placed object type** — boards, items (catalog pedals, supplies, custom pedals), cables and endpoints. Supplies and custom parts count as items; custom parts are text-only and exempt from the distinct-image count. **Repeats of an image already in the scene are allowed at the image cap** (they add no decode). Cables/endpoints arrive in **P4** but are already in the capacity model (`sceneObjectCounts` counts them; one endpoint ≈ one cable node, so they share the 150/300 graph budget). **P4-01/P4-02 must extend the benchmark with cables + endpoints before the graph cap is raised.**

**Enforcement (P3-06, `src/lib/capacity.ts`):** the hard caps live in the scene store itself (`addItem`/`duplicateItem`/`addBoard`/`addCustomBoard` return null), so a future import/paste cannot bypass them; the UI shows an **inline reason** (never a toast, N8). Soft warnings appear only when a budget is actually tight: the Scene register line, the Picker strip, and the Export spec. The Export panel shows the distinct-image count and an estimated file size, with a subordinate `Large export` notice above ~12 MP or ~15 MB. **Over-cap shared/recovered scenes still hydrate** (A4/A5) — they are measured and warned ("This scene still opens"), never rejected or trimmed; only adding is guarded. A max scene must stay under the **~200 KB share-payload ceiling** (P3-03).

At 2× the hard budget the live canvas drops below ~50 fps and distinct-image decode approaches iOS jetsam; at 5× it is unusable. The 16.7 MP clamp keeps export allocation bounded, and PNG is encoded directly to a Blob (`stage.toBlob()`), never a multi-MB `data:` URL.

**Raising a cap safely:** run `pnpm bench:capacity` and compare the table; confirm the 50-scene boot and the 400-item/89-distinct export still pass the structural checks; keep the max scene under ~200 KB (P3-03); bump the constant in `src/lib/capacity.ts`, update this table + the unit/e2e thresholds, and only then raise the cap. Re-run with P4 cables/endpoints in the mix first.


## Assets & catalog
- Catalog JSON (`pedals.json`, `boards.json`) ships in the app bundle (static import). It is zod-validated **at module load** by `src/catalog/load.ts` (fail-fast) and guarded in CI by a Vitest test against the committed seed — not by a `vite build` step.
- **v1 (ADR-002):** images live in the repo under `public/pedal-assets/` and ship with the Pages deployment (same-origin, no CORS). Two renditions per item — `800/` (master) and `350/` (thumb), pre-resized by the asset pipeline; **no runtime image service**. As of P2 the app requests **800 everywhere** (picker ledger rows, info-panel sleeve, canvas); the `350/` renditions exist but are not consumed yet — using them for small UI is a small follow-up (P2-10).
- URL convention (dev + v1 prod): `/pedal-assets/{kind}/{size}/{image}` (e.g. `/pedal-assets/pedals/800/boss-tr-2.png`), built via `assetUrl()` in `src/lib/cdn.ts`. R2 with `{CDN_BASE}` is the deferred path (ADR-002) — revisit before ~2k items. `pnpm assets:sync` (scripts/) is the deferred **R2-era sync tool, unused in v1**.
- **Image-resolution contract (P1 renderer):** branch on `imageSource` — `mock`/`static` → `assetUrl(kind, size, item.image)`; `url` → use `item.image` directly (an absolute `http(s)` URL, loaded with `crossOrigin="anonymous"`). **Where an official brand image URL is recorded, `url` is preferred; `mock` is the fallback** (ADR-003 §Brand image URLs). CORS-clean hosts display (canvas stays untainted for export); non-CORS hosts + hotlink-blocked URLs fall back to the labeled rectangle. `assetUrl()` does not URL-encode, so the catalog schema guarantees safe filenames (ADR-003). A missing/failed image falls back to a labeled rectangle at the item's cm footprint (P1-03/P1-04).
- **Cache-poisoning self-heal (P2-01):** a plain no-CORS load of a hotlinked `url` image (e.g. a picker `<img>`) can cache a response **without** `Access-Control-Allow-Origin`; the canvas's later `crossOrigin` request reuses that cached copy and fails the CORS check — for hosts that only send ACAO when the request carries an `Origin` (e.g. `static.roland.com`). Both the canvas loader (`canvas/useImage.ts`) and the picker thumbnails load **CORS-first**, and on failure retry **once under a distinct cache key** (`lib/cdn.ts` `bustCache`, a stable `?pedalvision-v=1`) — a fresh, CORS-clean response. The picker additionally retries **no-CORS** so hosts with no ACAO still display in the DOM (the canvas falls back for those, by design). Both attempts stay `crossOrigin`, so export is never tainted.
- **Lazy loading — NOT implemented in P1 (deferred).** The design intent is to load an image only when the item enters the viewport (Konva `Image` + an intersection check on the stage transform); today every mounted node eagerly loads its asset on mount. Revisit when item counts / zoom-out workloads warrant it (tracked in `docs/progress.md` → Follow-ups).
- **Custom-board finishes (P2-05, "Substrate")** are **procedural**, not image assets: `BoardTexture` (`matte|brushed|wood|tolex`) is rendered from finish tokens (`--color-finish-*`, mirrored in `theme.ts`) — a cached offscreen tile applied via Konva `fillPatternImage` on the canvas, and the equivalent CSS/SVG pattern in the DOM creator. Zero new deps/assets; pattern contrast is deliberately below the dot grid so a textured board never out-reads content.

## CI/CD (ADR-002)
PR / push to main → `pnpm install --frozen-lockfile` (cached) → `biome ci` → `tsc -b` (`pnpm typecheck`) → `vitest run` → `vite build` → Playwright (chromium only, cached browsers, `vite preview`) → `wrangler-action` Pages deploy (PR = preview URL, main = production).

## Security (static SPA threat model)
- XSS via custom pedal/board names → React escaping; no `dangerouslySetInnerHTML`; any future rich text sanitized.
- Share-URL bomb → cap decoded payload (200KB), cap the compressed/base64 input, inflate into a bounded output, and zod-validate before applying to the store. Unknown refs are data, never code.
- Asset integrity → v1 images are static repo files reviewed via PR; no user uploads in v1. (If/when R2: bucket private, uploads only via CI/owner script.)
- Dependencies → `pnpm audit` clean is a **launch-gate check** (manual today); a weekly CI audit job + Dependabot are **not set up yet** (small CI follow-up). Keep deps < 6 months old.
- Secrets → Cloudflare token in GitHub Secrets only; never in repo.

## Testing strategy
- **Vitest** (the guardrails): geometry (cm↔px, rotation about center, board-relative transforms incl. A1 invariance), serialization round-trip, share codec round-trip + malformed/oversize/version/unknown-ref/custom-pedal/size-cap cases, read-only mutation guards and preview save/exit, cable length calc, units conversion, catalog zod schema.
- **Playwright** (chromium, smoke only): app loads → add board → add pedal → rotate → save → reload persists → export non-blank → share URL loads read-only scene → Save a copy (recipient scene untouched) → over-cap shared scene warns without failing. Desktop + mobile.

## Responsive approach
- ≥1024px: top toolbar + right sidebar panels + modal picker.
- <1024px: bottom tab bar (currently **Pedals / Boards / Custom**; **Cables** arrives with P4, **More** is future), full-screen sheets, touch-first selection (bigger anchors, action buttons under selection).
- One codebase: layout switches via CSS/container queries; canvas interactions unified via pointer events.