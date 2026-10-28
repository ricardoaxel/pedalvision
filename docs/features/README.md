# Feature catalog & QA impact map

> **F-19 guardrail.** This is the durable inventory of what the app does, which
> code/data paths each feature owns, and which E2E proves it still works. The
> mapping is deliberately **stable, not exhaustive**: use it to decide which
> workflows a change can break, then run the named specs.
>
> **Map updates are required only for changes worth recording** — behaviour-
> changing, user-visible, or touching a persisted/transported/contract path
> (codec/`SceneDocument`, share payload, capacity, export scope, history, catalog
> schema). Refactors, test-only, dependency and docs-only PRs make **no** map edit
> and state `Map: n/a — <reason>` in the PR. The binding rule is
> `docs/tasks/feature-template.md` → Constraints ("Docs update"); this file defines
> *what* to record and how to pick the E2E. The public tutorial/catalog will live
> in the F-41 docs hub.
>
> **Ownership:** a feature session may edit the inventory, workflow, impact and
> Known-gaps rows. The prose rules in this file (How to use, Per-feature-PR
> requirement, this header), the roadmap link, `docs/progress.md`, templates and
> `AGENTS.md` stay **coordinator-only**: propose the exact text instead of editing.

## How to use this map

1. Find the **feature area** you are changing in the inventory or impact table.
2. Follow the **affected workflows** — those are the regression surfaces.
3. Run the **minimum E2E** (desktop + mobile where the area is responsive),
   deduped and capped as described under the change-impact table.
4. If you add a **new object type**, complete the checklist below before opening
   the PR.
5. If a gap is intentional/deferred, record it under **Known gaps** instead of
   silently leaving it untested.

---

## Feature inventory

Status: **v1 shipped** unless marked future/deferred. "Modules" are the primary
source files; tests are the unit specs that guard the logic.

| ID | Feature | User outcome | Primary modules | Unit tests | E2E |
|---|---|---|---|---|---|
| F1 | Infinite canvas, pan, zoom-to-pointer | Free workspace; viewport never moves objects | `canvas/Stage.tsx`, `useViewportGestures.ts`, `state/viewport.ts`, `lib/geometry.ts` | `viewport.test.ts`, `geometry.test.ts`, `gestures.test.ts` | `smoke.spec.ts`, `touch.spec.ts` |
| F2 | True scale (cm source of truth) | What you lay out is what you build | `lib/geometry.ts`, `state/scene.ts`, `canvas/*` | `geometry.test.ts`, `rotation.test.ts`, `scene.test.ts` | `smoke.spec.ts`, `selection.spec.ts`, `export.spec.ts` |
| F3 | Boards: catalog place/move/rotate/remove + custom size/finish | Choose a real board or any W×D | `state/scene.ts`, `components/Picker.tsx`, `components/CustomBoardForm.tsx`, `canvas/BoardNode.tsx`, `lib/customBoard.ts` | `scene.test.ts`, `customBoard.test.ts`, `items.test.ts` | `picker.spec.ts`, `smoke.spec.ts`, `board-creator.spec.ts` |
| F4 | Pedals: picker → place → drag/rotate/duplicate/delete | Build a signal chain with real parts | `components/Picker.tsx`, `state/scene.ts`, `canvas/useItemDrag.ts`, `canvas/ItemTransformer.tsx` | `items.test.ts`, `rotation.test.ts`, `customPedal.test.ts` | `picker.spec.ts`, `selection.spec.ts`, `smoke.spec.ts` |
| F5 | Layers: per-container z-order | Overlap reads correctly; order persists | `state/scene.ts` (`reorderItems`, `normalizeContainerZ`), `canvas/ItemActionBar.tsx` | `zorder.test.ts`, `history.test.ts` | `z-order.spec.ts`, `history.spec.ts` |
| F6 | Selection + action bar + keyboard/touch | Clear, non-modal editing controls | `state/selection.ts`, `canvas/SelectionLayer.tsx`, `canvas/ItemActionBar.tsx`, `canvas/BoardActionBar.tsx`, `useSelectionShortcuts.ts` | `selection.test.ts`, `itemNodeRegistry.test.ts` | `selection.spec.ts`, `touch.spec.ts` |
| F7 | Custom pedal/supply creator + edit | Add gear the catalog does not carry | `components/CustomPedalForm.tsx`, `lib/customPedal.ts`, `state/scene.ts` | `customPedal.test.ts` | `custom.spec.ts`, `history.spec.ts` |
| F8 | Save/load/scenes/autosave/undo/storage fallback | Work survives reload; never silently lose it | `state/sceneDocument.ts`, `state/library.ts`, `state/autosave.ts`, `lib/sceneIndex.ts`, `lib/idb.ts`, `lib/storageHealth.ts`, `lib/sceneBackup.ts`, `state/history.ts` | `sceneDocument.test.ts`, `library.test.ts`, `autosave.test.ts`, `sceneIndex.test.ts`, `storageHealth.test.ts`, `sceneBackup.test.ts`, `history.test.ts` | `scenes.spec.ts`, `history.spec.ts`, `storage-fallback.spec.ts`, `z-order.spec.ts` |
| F9 | Export PNG + PDF (selected board / all content) | Print or share a true-scale artifact | `lib/exportScene.ts`, `canvas/exportStage.ts`, `lib/pdf.ts`, `components/ExportPanel.tsx`, `lib/download.ts` | `exportScene.test.ts`, `pdf.test.ts`, `capacity.test.ts` | `export.spec.ts`, `picker-choka.spec.ts` |
| F10 | Share links + read-only preview + save a copy | Send a layout without an account | `lib/shareLink.ts`, `state/share.ts`, `state/readOnly.ts`, `state/library.ts`, `components/SharePanel.tsx`, `components/ShareView.tsx` | `shareLink.test.ts`, `shareLink.demo.test.ts`, `readOnly.test.ts`, `library.test.ts` | `share.spec.ts`, `cables.spec.ts`, `history.spec.ts`, `storage-fallback.spec.ts` |
| F11 | Responsive desktop/mobile chrome | Full function on phone and desktop | `App.tsx`, `components/Picker.tsx`, panels/trays, `styles/tokens.css` | `toolbarNav.test.ts` | `picker.spec.ts`, `touch.spec.ts`, mobile cases in `export`/`cable-schedule`/`info-panel`/`scenes` |
| F12 | Cables: drag-connect, endpoints, schedule | Plan the patch, not just the parts | `state/scene.ts` (cables), `state/cableDrag.ts`, `state/endpointDrag.ts`, `state/endpointPlacement.ts`, `canvas/CableLayer.tsx`, `canvas/EndpointLayer.tsx`, `lib/jackAnchor.ts`, `lib/cablePath.ts`, `lib/cableLength.ts`, `lib/cableSummary.ts`, `components/CableSchedulePanel.tsx` | `cables.test.ts`, `cableDrag.test.ts`, `jackAnchor.test.ts`, `cablePath.test.ts`, `cableLength.test.ts`, `cableSummary.test.ts`, `exportScene.test.ts` | `cables.spec.ts`, `cables-touch.spec.ts`, `cable-schedule.spec.ts`, `share.spec.ts`, `export.spec.ts` |
| F-03 | Drafting Scale: one true-length export-style bar | Judges size at a glance without adding a screen element | `components/ScaleBar.tsx`, `lib/measurementHud.ts` | `measurementHud.test.ts` | `measurement-hud.spec.ts` |
| — | Info panel + asset renditions | Right details and imagery at each size | `components/InfoPanel.tsx`, `components/PartDrawing.tsx`, `components/partImage.ts`, `lib/partInfo.ts`, `lib/cdn.ts`, `canvas/loadImage.ts`, `canvas/useImage.ts` | `partInfo.test.ts`, `cdn.test.ts`, `loadImage.test.ts`, `imageStatus.test.ts` | `info-panel.spec.ts`, `picker.spec.ts`, `picker-choka.spec.ts` |
| — | Capacity budgets | Honest limits, never a silent failure | `lib/capacity.ts`, `components/CapacityAnnouncer.tsx`, `scene.ts` caps | `capacity.test.ts`, `capacity.images.test.ts`, `capacityGuards.test.ts` | `capacity.spec.ts`, `share.spec.ts`, `export.spec.ts` |
| — | First-run guidance | Empty scene tells you where to start | `components/FirstRunHint.tsx`, `lib/firstRun.ts`, `lib/focus.ts` | `firstRun.test.ts` | `first-run.spec.ts` |
| — | Power-supply planner | **Future (v2 / non-goal N3)** — schema reserves power; custom supplies carry it today | `state/scene.ts` (`power`), info panel readout | `customPedal.test.ts`, `partInfo.test.ts` | none yet (readout only in `info-panel.spec.ts`) |

### F-01 — Two-rendition image delivery (P2-10)

Small UI uses the **350 px** rendition instead of the 800 px master:

- **Picker ledger rows** — `PickerEntry.thumbSrc` (`resolveThumbImageUrl`).
- **Mobile info-panel sleeve** — the 64 px peek (`ASSET_RENDITIONS.infoSleeve`).

Large surfaces stay on the **800 px** master: the picker specimen plate, the
info-panel banner/desktop plate, the canvas and export. `imageSource: "url"`
entries keep their recorded absolute URL at both sizes (there is no derived
rendition).

User-visible effect: faster, lighter search results and a lighter mobile peek;
full-detail imagery is unchanged where detail matters. No layout or visual
direction change.

### F-02 — Read-only jack ticks + cable-aware export bounds (P4-05)

Closes the two P4 phase-gate gaps without changing cable geometry, the 150/300
graph cap, the share payload/version or the "Patch Drafting" direction.

- **Read-only jack ticks.** A shared preview now renders the socket ticks
  whenever the graph is visible **or** the canvas is read-only
  (`showCables || readOnly`). Recipients see real ring+dot sockets (hollow
  diamonds for fallback/approximate jacks) even when their own "Show patch"
  preference is off. The outward-biased hit discs stay non-mutating: a press on
  a socket is a read-only attempt, so the existing "shared copy" cue appears and
  nothing changes. Selection, the info sheet and pan/zoom behave exactly as
  before.
- **Cable-aware export bounds.** The selected-board plan unions the **actual
  cubic curve** (exact Bézier extrema + endpoints + arrowhead) for every
  in-scope cable into its content rect, using the same anchors/handles as the
  export renderer. A long outward handle can no longer bulge past the 4 cm
  padding and get clipped. The all-content path includes the same curve union.
  The 4 cm padding and the 16.7 MP / 8192 px clamps are unchanged; cable
  geometry, share payload/version and the graph cap are untouched.

### F-03 — Drafting Scale (P2-03)

The app’s **export scale bar**, used as the only on-canvas measurement: one
true-length line + 8 px end caps + a `20 cm` label in a 22 px bottom caption
strip (desktop bottom-left, 16 px gutter; mobile bottom-right, 16 px above the
dock). No axis, ticks, world labels, grid/zoom/unit chrome, fill or card. Pan
changes nothing; zoom re-steps the label/bar; the bar hides on an empty scene.
Units live in the info panel and the bar follows them; `cm` stays canonical;
nothing is persisted, exported or shared. The ruler/axis and selected-W×H chip
were deleted because they did not earn their place.

### F-19 — This map

The feature inventory, workflow → module → E2E table, change-impact table,
object-type checklist and known-gap ledger. Kept current by behaviour-changing
feature PRs.

---

## Workflow → code → data → E2E

| Workflow | Code path | Persisted / transported path | E2E coverage |
|---|---|---|---|
| **Boot, pan, zoom, resize** | `App.tsx` → `Stage.tsx` → `useViewportGestures.ts` / `state/viewport.ts` | Viewport is not persisted (scene geometry is world cm) | `smoke.spec.ts` (wheel/pan/drag guards), `touch.spec.ts` (pinch/pan), `picker.spec.ts` (short viewports) |
| **Picker search/filter/place** | `Picker.tsx` + `pickerFilter.ts` → `addItem` / `addBoard` | `items` / `boards` in the scene document | `picker.spec.ts` (desktop + mobile), `picker-choka.spec.ts` |
| **Place / move / rotate / re-parent** | `state/scene.ts`, `useItemDrag.ts`, `ItemTransformer.tsx` | Board-local cm for attached items; world cm loose; rotation per item; z re-normalised | `smoke.spec.ts` (cross-board, pan interrupt), `selection.spec.ts` (rotate on rotated board), `touch.spec.ts` |
| **Select / duplicate / delete / reorder** | `state/selection.ts`, `ItemActionBar.tsx`, `BoardActionBar.tsx` | Selection is ephemeral; the mutation is persisted | `selection.spec.ts`, `z-order.spec.ts`, `history.spec.ts` |
| **Custom pedal/supply** | `CustomPedalForm.tsx`, `lib/customPedal.ts`, `state/scene.ts` | `customPedals` **inline** in the scene document and share payload | `custom.spec.ts` (desktop + mobile), `history.spec.ts`, `share.spec.ts` |
| **Custom board** | `CustomBoardForm.tsx`, `lib/customBoard.ts`, `boardTexture.ts` | `boards[].customSize` + `texture` + `name`/`brand` inline | `board-creator.spec.ts` (desktop + mobile), `history.spec.ts`, `share.spec.ts` (custom board round-trip) |
| **Cables + endpoints** | `state/scene.ts`, `cableDrag.ts`, `endpointDrag.ts`, `endpointPlacement.ts`, `jackAnchor.ts`, `CableLayer.tsx`, `EndpointLayer.tsx` | `cables` + `endpoints` in the scene document, share v2 payload, export bounds/capacity | `cables.spec.ts`, `cables-touch.spec.ts`, `share.spec.ts`, `export.spec.ts`, `capacity.spec.ts` |
| **Cable schedule** | `lib/cableLength.ts`, `lib/cableSummary.ts`, `CableSchedulePanel.tsx` | Derived only — never stored/exported; read-only recipients derive locally | `cable-schedule.spec.ts` (desktop + mobile + read-only) |
| **Save/load/autosave/boot reconcile** | `sceneDocument.ts`, `library.ts`, `autosave.ts`, `sceneIndex.ts`, `idb.ts` | IndexedDB document + localStorage index/settings; additive `version: 1` document | `scenes.spec.ts` (A4, isolation, rename/delete, cap, reconcile), `cables.spec.ts` (graph reload) |
| **Undo/redo** | `state/history.ts`, `HistoryControls.tsx`, `useHistoryShortcuts.ts` | In-memory only; every `SceneSnapshot` key is compile-forced | `history.spec.ts` (desktop + mobile), `cables.spec.ts` (one cable = one step) |
| **Share / read-only / save a copy** | `shareLink.ts`, `state/share.ts`, `readOnly.ts`, `library.ts`, `SharePanel.tsx`, `ShareView.tsx` | `#s=v2:` deflate → base64url; v1 still decodes; recipient never writes their document | `share.spec.ts` (desktop + mobile), `cables.spec.ts` (v2/v1), `history.spec.ts`, `storage-fallback.spec.ts` |
| **Export PNG/PDF** | `exportScene.ts`, `exportStage.ts`, `pdf.ts`, `ExportPanel.tsx` | Reads the live snapshot; selected-board vs all-content; detached stage | `export.spec.ts` (desktop + mobile), `picker-choka.spec.ts`, `capacity.spec.ts` (warnings) |
| **Capacity** | `capacity.ts`, `scene.ts` guards, `CapacityAnnouncer.tsx`, picker/export/scene UI | Scene-wide counts + distinct images + graph (cables + endpoints) | `capacity.spec.ts` (desktop + mobile), `share.spec.ts` (over-cap hydration), `export.spec.ts` (large-export notice) |
| **Storage failure/backup** | `storageHealth.ts`, `sceneBackup.ts`, `StorageNotice.tsx`, `library.ts` | Live scene → `SceneDocument` v1 JSON download; no writes | `storage-fallback.spec.ts` (desktop + mobile) |
| **Info panel / asset loading** | `InfoPanel.tsx`, `partInfo.ts`, `partImage.ts`, `cdn.ts`, `loadImage.ts`, `useImage.ts` | Image URLs are derived from the catalog entry, not stored | `info-panel.spec.ts` (desktop + mobile), `picker.spec.ts` (CORS/cache self-heal), `picker-choka.spec.ts` (AVIF) |
| **Drafting Scale / one true-length bar** | `ScaleBar.tsx`, `lib/measurementHud.ts` → `useViewport` / `useSettings` / `useScene` | Derived only — never stored, exported or shared | `measurement-hud.spec.ts` (desktop + mobile), `smoke.spec.ts` |
| **First-run** | `FirstRunHint.tsx`, `firstRun.ts`, `focus.ts` | One-way localStorage `pedalvision.firstRun.v1` | `first-run.spec.ts` (desktop + mobile) |
| **Mobile/touch chrome** | `App.tsx`, responsive CSS, bottom tabs/trays, 44 px targets | Same scene/document | `touch.spec.ts`, `cables-touch.spec.ts`, mobile project runs listed above |

---

## Change-impact table

Use this as the **minimum** regression set. Add the area's own E2E when the
change is user-visible.

| If you change… | Touches (paths) | Affected workflows | Minimum E2E (plus the area's own) |
|---|---|---|---|
| **Geometry, transforms, board-relative cm** | `src/lib/geometry.ts`, `src/state/scene.ts`, `src/canvas/Stage.tsx`, `src/canvas/useItemDrag.ts`, `src/canvas/ItemTransformer.tsx` | every canvas workflow, A1, export bounds | `smoke.spec.ts`, `selection.spec.ts`, `export.spec.ts` |
| **Scene model / store mutators / z-order** | `src/state/scene.ts`, `src/state/selection.ts`, `src/canvas/ItemActionBar.tsx`, `src/canvas/BoardActionBar.tsx` | place, move, rotate, duplicate/delete, save/load, history, share | `selection.spec.ts`, `z-order.spec.ts`, `scenes.spec.ts`, `history.spec.ts` |
| **New object type / new scene array** | `src/state/scene.ts`, `src/state/sceneDocument.ts`, `src/state/library.ts`, `src/lib/shareLink.ts`, `src/lib/exportScene.ts`, `src/lib/capacity.ts` | codec, guards, persistence, backup, history, share, export, capacity, UI | Complete the **new object type checklist**; run the checklist's named specs |
| **Codec / `SceneDocument` / `library.ts`** | `src/state/sceneDocument.ts`, `src/state/library.ts`, `src/state/autosave.ts`, `src/lib/sceneIndex.ts` | save/load, autosave, boot reconcile, backup, share save-copy | `scenes.spec.ts`, `storage-fallback.spec.ts`, `share.spec.ts`, `cables.spec.ts` |
| **Share codec / payload / version** | `src/lib/shareLink.ts`, `src/state/share.ts`, `src/state/readOnly.ts`, `src/components/SharePanel.tsx`, `src/components/ShareView.tsx` | sender → recipient, read-only, save-a-copy, legacy links | `share.spec.ts`, `cables.spec.ts` (v2/v1), `history.spec.ts`, `storage-fallback.spec.ts` |
| **Export plan / renderer / PDF** | `src/lib/exportScene.ts`, `src/canvas/exportStage.ts`, `src/lib/pdf.ts`, `src/components/ExportPanel.tsx` | selected-board/all-content, clamps, image failure, mobile tray | `export.spec.ts`, `picker-choka.spec.ts` |
| **Cables / cable geometry / anchors** | `src/state/scene.ts`, `src/state/cableDrag.ts`, `src/state/endpointDrag.ts`, `src/state/endpointPlacement.ts`, `src/canvas/CableLayer.tsx`, `src/canvas/EndpointLayer.tsx`, `src/lib/jackAnchor.ts`, `src/lib/cablePath.ts`, `src/lib/cableLength.ts`, `src/lib/cableSummary.ts` | editor, touch connect, schedule, share, export, capacity | `cables.spec.ts`, `cables-touch.spec.ts`, `cable-schedule.spec.ts`, `share.spec.ts`, `export.spec.ts` |
| **Capacity constants / guards** | `src/lib/capacity.ts`, `src/state/scene.ts`, `src/components/CapacityAnnouncer.tsx` | add, duplicate, board add, over-cap load, export warning | `capacity.spec.ts`, `share.spec.ts`, `export.spec.ts` |
| **Picker / filtering / catalog loading** | `src/components/Picker.tsx`, `src/components/pickerFilter.ts`, `src/catalog/load.ts`, `src/lib/cdn.ts`, `src/canvas/loadImage.ts` | every place workflow, asset renditions | `picker.spec.ts`, `picker-choka.spec.ts` |
| **Info panel / part info / image loading** | `src/components/InfoPanel.tsx`, `src/lib/partInfo.ts`, `src/components/partImage.ts`, `src/canvas/useImage.ts` | selection readout, asset sizes, CORS fallback | `info-panel.spec.ts`, `picker.spec.ts` |
| **Drafting Scale bar / units** | `src/components/ScaleBar.tsx`, `src/lib/measurementHud.ts`, `src/App.tsx`, `src/index.css`, `src/styles/tokens.css` | canvas zoom, units, read-only shares, mobile peek | `measurement-hud.spec.ts`, `smoke.spec.ts`, `info-panel.spec.ts` |
| **First-run / boot chrome** | `src/components/FirstRunHint.tsx`, `src/lib/firstRun.ts`, `src/lib/focus.ts` | empty scene, storage notice precedence | `first-run.spec.ts`, `storage-fallback.spec.ts` |
| **Responsive CSS / mobile chrome** | `src/App.tsx`, `src/styles/**`, responsive cases in `src/components/**` | picker, trays, action bars, touch targets | mobile project of `picker`/`export`/`cable-schedule`/`info-panel`/`scenes`; `touch.spec.ts` |
| **Catalog data/images** — **catalog sessions only** (a feature PR never edits catalog data) | `data/catalog/**`, `public/pedal-assets/**`, `tools/catalog-*` | catalog picker/canvas/info/export/share | `picker-choka.spec.ts`, `info-panel.spec.ts` (+ `catalog:ci`); a feature PR that only *consumes* an entry runs `picker.spec.ts` for one stable filtered item/brand |
| **Annotations/legal/attribution copy** | `src/components/InfoPanel.tsx`, `public/attribution.html` | info panel, attribution page | `info-panel.spec.ts` |

**Selecting the E2E (cost guard).** Take the union of the rows your diff matches,
dedupe, and **cap at 6 spec files per PR**. If the union exceeds 6, run the 6
highest-risk and list the rest as `deferred to post-merge` in the PR. Use the
mobile project only for responsive/UI changes.

- **Per PR:** `pnpm test` (full) + `pnpm exec playwright test <union files>`.
- **Per merge:** the touched-area specs + `smoke.spec.ts` on the verified build.
- **Nightly / phase gate:** full `pnpm e2e` + `pnpm bench:capacity`.

Never run the full suite per PR.

---

## New object type checklist

A "new object type" is any new persisted/transported scene concept (the last
ones were **endpoints** and **cables** in P4). Do all of these in the same PR;
missing one is how P4-01/P4-02 broke standalone endpoints on load.

1. **Model + store** — `src/state/scene.ts`: type, array in `Scene`, add/update/
   remove mutators, cascades, z/container rules, capacity accounting,
   `prune*` helpers, selection handling. Add unit tests beside the existing
   `items`/`cables` suites.
2. **Codec + guards** — `src/state/sceneDocument.ts`: add to `SceneDocument` and
   `SceneSnapshot`, `createSceneDocument`, the structural guard, `parseSceneDocument`,
   `normalizeSceneContent`, `sceneFromDocument`. Keep the **additive v1 document**
   rule (older docs without the array stay valid).
3. **Persistence** — `src/state/library.ts`: `applyScene` must copy **every**
   snapshot key; `saveActive` builds from the full snapshot; the autosave
   subscriber compares the new array; legacy migration, preview, save-a-copy and
   boot all use the same codec.
4. **History** — `src/state/history.ts`: add the key to the compile-time-exhaustive
   `HISTORY_SCENE_KEYS` map; decide whether one user action is one step; ensure
   undo/redo are no-ops read-only and clear on scene switch.
5. **Backup** — `src/lib/sceneBackup.ts`: inherits the codec (no separate
   serialiser). Assert the new field is in the downloaded JSON.
6. **Share** — `src/lib/shareLink.ts`: encode the array **and** extend the zod
   `payloadSchema` (zod strips unknown keys, so the decoder silently drops it
   otherwise). Decide/keep the version policy (`v2` rejected cleanly by old
   clients; `v1` still decodes). Update `SharePanel`/review copy (counts), the
   read-only no-op guards, and add a round-trip + legacy test.
7. **Export** — `src/lib/exportScene.ts`: include the object in the correct
   scope(s), union its bounds/curve, and render it in `canvas/exportStage.ts`;
   verify both selected-board and all-content, the 4 cm padding and the 16.7 MP
   / 8192 px clamps. Update `ExportPanel` copy if the scope rule needs an
   explanation.
8. **Capacity** — `src/lib/capacity.ts`: count it in `sceneObjectCounts`, add the
   refusal/add guard, thread the **full scene** through every consumer
   (picker strip, scene register, export spec, share view), and extend the
   benchmark if the load profile changes.
9. **UI entry + read-only** — picker/action bar/toolbar entry, Escape/focus
   behavior, mobile tray, and the read-only cue/no-op path. No new toast (N8).
10. **Tests** — codec round-trip that fails if a snapshot key is missed, history,
    capacity, share round-trip + legacy, export, and E2E on the real workflow
    (desktop + mobile), including **A4** reload and **A5** share where the object
    can be persisted/shared.
11. **Docs** — add/update the feature row here, the impact row if workflows
    changed, and the public feature/tutorial entry.

---

## E2E suite map

| Spec | Covers | Projects |
|---|---|---|
| `smoke.spec.ts` | boot, pan/zoom, board place/rotate, cross-board drag, pan interrupt, short viewports | chromium |
| `picker.spec.ts` | search/filter/place, specimen, keyboard, tabs, de-stack, thumbs, CORS/cache self-heal | chromium + mobile |
| `picker-choka.spec.ts` | AVIF 350/800, canvas decodes, PNG/PDF, share, console-clean | chromium + mobile |
| `selection.spec.ts` | action bar, rotate handles, rotated board, hover, narrow viewport | chromium |
| `z-order.spec.ts` | layer reorder persistence | chromium |
| `custom.spec.ts` | custom pedal/supply create/edit, TRS, drafts, units, validation | chromium + mobile |
| `board-creator.spec.ts` | custom board create/edit/delete/finish/units/persist | chromium + mobile |
| `info-panel.spec.ts` | identity/tags/dims/power/jacks, legal, renditions, overlap, mobile peek | chromium + mobile |
| `cables.spec.ts` | connect/direction/capacity/endpoints/toggle/read-only/share v2+v1/over-graph | chromium + mobile |
| `cables-touch.spec.ts` | trusted touch jack→jack | mobile |
| `cable-schedule.spec.ts` | derived schedule, empty state, read-only, mobile tray, no mutation | chromium + mobile |
| `scenes.spec.ts` | A4, scene isolation, rename/delete, 10-scene cap, boot reconcile | chromium + mobile |
| `history.spec.ts` | undo/redo controls+keys, one-step actions, scene isolation, read-only | chromium + mobile |
| `share.spec.ts` | sender→recipient, save a copy, unknown ref, over-cap, read-only cue, damaged link | chromium + mobile |
| `export.spec.ts` | selected/all, clamps, far-off content, zoom/pan independence, HD PNG+PDF, mobile tray, cable endpoint in scope | chromium + mobile |
| `capacity.spec.ts` | soft/hard warnings, add refusals, over-cap load, export notice | chromium + mobile |
| `storage-fallback.spec.ts` | blocked IDB/localStorage, write failure, quota advisories, backup | chromium + mobile |
| `first-run.spec.ts` | note geometry, CTA, dismiss/focus, retire on first object | chromium + mobile |
| `measurement-hud.spec.ts` | drafting scale bar, units, zoom, empty, mobile yield, read-only | chromium + mobile |
| `touch.spec.ts` | pinch/pan, board-drag interrupt | mobile |
| `benchmark.spec.ts` | report-only capacity table (`pnpm bench:capacity`) | excluded from `pnpm e2e` |

Helpers: `e2e/picker.ts` (open/place), `e2e/stage.ts` (item screen centre),
`e2e/persistence.ts` (read IndexedDB document), `e2e/share.ts` (build `#s=v2:`).

---

## Known gaps (intentional / unit-only / deferred)

These are **not** silent holes: each is covered by unit tests or tracked here.

| Gap | Current coverage | Decision |
|---|---|---|
| Selected-board export with an in-scope cable/endpoint | `exportScene.test.ts` (curve + endpoint bounds); **E2E added in F-19** (`export.spec.ts`) | Closed in F-19 |
| Inline custom board through share + save-a-copy | `shareLink`/`library` unit tests; **E2E added in F-19** (`share.spec.ts`) | Closed in F-19 |
| Standalone endpoint (no cable) survives reload (A4) | `library.test.ts` + `sceneDocument` guards | Unit-only; integration path is the same codec as cabled endpoints (covered by `cables.spec.ts`) |
| Removing a board releases attached items loose with visible geometry | `items.test.ts` (rotated + rotated-attached cases) | Unit-only; low UI risk (no new code path) |
| Shrinking a custom board nudges attached pedals back inside | `clampItemsToBoard` unit tests | Unit-only; add E2E only if the creator gets a resize-preview UI |
| Z-order **within a board** container | `zorder.test.ts` (unit); E2E covers a loose-item reorder (`z-order.spec.ts`) | Unit + loose E2E; same `reorderItems` path. Add when a per-board layer UI lands |
| Undo/redo of a cable create/delete | `cables.spec.ts` asserts the cable commit adds one undo step; other mutations in `history.spec.ts` | Partial E2E; full graph undo/redo is unit-covered (`history.test.ts`) |
| PDF page pixels/raster fidelity | `pdf.test.ts` + header/MediaBox/`DCTDecode` assertions; owner iOS PNG check; P3-01 used `pdftoppm` manually | No automated pixel diff; keep as a visual/manual launch check |
| Real iOS Safari export (A3) | Owner-confirmed PNG on iPhone (2026-10-20) | Manual; PDF not separately re-tested; P5-04 launch gate |
| Non-Chromium browsers | Playwright chromium only (owner scope) | Out of scope; real-device pass is P5-06 |
| Power-supply planner | Not implemented (non-goal N3); custom supply power shows in the info panel | Future feature; no E2E by design |
| Selected W×H in the measurement frame | The info panel is the size readout; the bar is scale-only | Intentional (owner rejected the duplicate chip) |
| Scene list accessibility mirror | Deferred in `docs/design.md` (no owning task) | Deferred |
| Capacity timing thresholds | `benchmark.spec.ts` is report-only; no ms gate | Intentional (avoid flaky CI) |

---

## Per-feature-PR requirement

The binding rule is `docs/tasks/feature-template.md` → Constraints ("Docs
update"). This file defines *what* to record and how to pick the E2E.

**Worth recording?** Behaviour-changing, user-visible, or touching a
persisted/transported/contract path (codec/`SceneDocument`, share payload,
capacity, export scope, history, catalog schema) → **yes**. Pure refactor,
test-only, dependency bump, typo or docs-only → **no**; write
`Map: n/a — <reason>` in the PR.

When recording:

- Add/update only the **feature inventory** row, the matched **workflow** and
  **change-impact** rows, and any resolved **Known gaps** row (1–3 table rows,
  no prose).
- Name the E2E you ran (spec + desktop/mobile) and the map rows touched in the PR.
- If you added an object type, link the checklist items you completed.
- Do not assert catalog totals in E2E; filter a stable item/brand.
- **Editable by a feature session:** those table rows. **Coordinator-only:** the
  prose rules above, `AGENTS.md`, templates, roadmap, progress — propose exact
  text instead of editing.
