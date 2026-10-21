# P4-02: Drag-connect UI + direction arrows + amp/instrument endpoints

**Phase:** P4 · **Status:** done (merged 2026-10-21, PR #31, squash `f001a0b`) · **Model:** build-strong

## Goal

Make the P4-01 cable graph usable and truthful end to end: drag from a visible jack tick to another jack or to a placed amp/instrument endpoint, render direction arrows, move/delete endpoints and cables, and carry the graph through share, export, capacity, benchmark and persistence. After this task a user can patch a custom pedal board, see the signal direction, share it, export it, and reload it identically (A4/A5).

## Read first (context pack)

- `docs/design.md` §Canvas architecture (CableLayer, DragLayer, export scope), §Data model (Cable/Endpoint/Jack), §Persistence → P4 extension contract, §Capacity budgets
- `docs/requirements.md` F12 (cables), F10 (share), A4 (identical state), A5 (share identical)
- `docs/roadmap.md` P4-02 + the P4-02 notes left by P4-01's reviews + P5-01 (was P4-04)
- `src/state/scene.ts`, `sceneDocument.ts`, `library.ts`, `history.ts`, `drag.ts`
- `src/lib/jackAnchor.ts`, `shareLink.ts`, `exportScene.ts`, `capacity.ts`
- `src/components/SharePanel.tsx`, `ShareView.tsx`, `ExportPanel.tsx`, `CapacityAnnouncer.tsx`, `ScenePanel.tsx`, `Picker.tsx`
- `src/canvas/Stage.tsx`, `BoardNode.tsx`, `PedalNode.tsx`, `DragLayer.tsx`, `LooseItemLayer.tsx`, `ItemNodes.tsx`, `useItemDrag.ts` (read-only context for the new CableLayer + jack ticks)
- `src/styles/tokens.css`, `src/styles/theme.ts`

## Owner decisions (2026-10-21)

- **Catalog pedals use explicit fallback anchors.** The seed has **zero** `jacks` (207 pedals). Custom pedals use their real jacks. A catalog pedal with no jacks gets a documented default anchor pair (`in` on the left edge, `out` on the right edge, both `pos: 0.5`) so drag-connect works everywhere. The fallback is rendered as an assumption (e.g. a quieter tick/label), never presented as manufacturer data. Do **not** invent per-pedal jack positions.
- **Share bumps to `v2`.** New links encode `#s=v2:` with cables/endpoints. The decoder accepts **both** `v1` (old links, no cables) and `v2`; an old P3 client rejects `v2` cleanly with its existing "newer version" message instead of silently dropping cables. Encode/decode/schema/SharePanel must agree, with a round-trip test.

## Constraints

- No new dependencies. cm stays the source of truth (world cm for cables/endpoints).
- Soft warnings inline, never toasts (N8). Read-only share previews never mutate and never record history.
- Endpoint/cable dragging is **transient** (`state/drag.ts` style): no store writes per pointermove; commit exactly once on pointerup → one history step, one autosave.
- Memoize jack anchors per scene mutation (uid→anchor map); never resolve anchors inside the render loop.
- Do not raise the 150/300 graph cap.
- P5-01 (catalog program, was P4-04) runs in parallel; not a dependency. Do not start P4-03.

## Steps

1. **Design gate.** Run the designer for an owner-approved direction (drag affordance, jack ticks, cable/endpoint visuals, direction arrows, mobile behavior) **before any UI**. Implement the approved direction; freeze; run `design-reviewer` on desktop + mobile, dark + light (≤2 passes; batch fixes; STOP at the cap and hand findings to the owner).
2. **Fallback anchors** (`src/lib/jackAnchor.ts` or `state/scene.ts`): when a resolved item exposes no jacks, synthesize the documented fallback pair (in left 0.5 / out right 0.5) for **interaction only** (ticks + drag-connect + anchor math). Keep `resolveItemJacks` returning the real array for persistence validation so a cable index only resolves when a real (or fallback) anchor exists. Export a single memoized per-scene anchor map (uid + jack index → world cm) and use it in the render layer and hit-testing.
3. **Jack ticks on the pedal** (`canvas/PedalNode.tsx`): render visible edge/position ticks for every resolved jack (real + fallback), screen-constant size, non-listening except the drag target. Highlight on hover/connection. Use the pedal-user finding: ticks must make the jack edge/position visible on the canvas, not only in the info panel.
4. **CableLayer** (`canvas/CableLayer.tsx`): a new Konva layer above boards + loose items and below `DragLayer`. Draw each cable as a smooth path between anchors with a **direction arrow** near the destination end (signal flows `from` → `to`), screen-constant stroke/arrow at any zoom. Skip/null-safe for gone anchors. Selected cable highlight + delete affordance.
5. **Endpoint nodes** (`canvas/EndpointNode.tsx`): amp / instrument markers placed in world cm, draggable (transient commit on pointerup), selectable, deletable. Place via an explicit "Add endpoint" control (toolbar/picker-adjacent, approved in step 1); no invented placement during design.
6. **Drag-connect** (`canvas/useCableDrag.ts`): pointer-down on a jack tick starts a transient connection preview; pointermove updates a preview path; pointer-up over a valid jack/endpoint creates **one** `addCable` call; release elsewhere cancels. A two-finger pan cancels the preview (never commits). Read-only mode shows the read-only cue, never connects. Desktop + touch.
7. **Cable/endpoint editing**: select a cable/endpoint; delete via the existing keyboard Delete affordance and an inline action control; endpoint move commits once. `removeCable`/`removeEndpoint` already cascade. Add `updateCable` only if a color/selection need requires it; otherwise keep the model frozen.
8. **Custom-part jack-edit pruning** (`updateCustomPedal`): after replacing a definition, drop cables whose jack index no longer resolves and any endpoints orphaned by those drops (mirror `normalizeSceneContent`). Keep standalone endpoints.
9. **Share v2** (`lib/shareLink.ts`, `components/SharePanel.tsx`): `SHARE_VERSION = 2`; payload `{ version: 2, name, boards, items, customPedals, endpoints, cables }`; zod schemas for endpoints/cables; decoder accepts v1 (empty graph) and v2, rejects others as `unsupported-version`; normalise with `normalizeSceneContent`. Round-trip test v2 + legacy v1 decode.
10. **Consumers**: `ExportPanel` and `ShareView` pass the full scene (`boards, items, customPedals, endpoints, cables`) to `buildExportPlan`; `CapacityAnnouncer`, `ScenePanel`, `Picker` and `ShareView` pass the full scene to `capacityStatus` so the 150/300 graph budget is visible. Keep the UI inline and quiet.
11. **Overlap / cable gap**: extend the P2-03 space check so a non-overlapping but un-cableable pair still warns — use a documented patch-cable gap (right-angle vs top-mount) in `state/overlap.ts`; "no warning" must mean cableable. Keep it a soft warning.
12. **Benchmark**: add cables/endpoints rows to `e2e/benchmark.spec.ts` and re-run `pnpm bench:capacity`; record numbers. Do not raise the cap.
13. **Tests**: cable/endpoint drag-connect e2e (desktop + mobile), direction arrows (debug attr), endpoint placement + move + delete, share round-trip with cables + legacy v1 decode, over-graph shared scene loads read-only + warns, export includes in-scope cables, capacity graph warning, autosave after cable edits, custom-part jack-edit pruning, anchor mapping on rotated boards.
14. **Reviews**: high-risk light-model `code-reviewer` pass; fix blockers/should-fixes; re-run checks. Optional `performance-expert` review (share URL budget is expected to bind). Exactly one PR, do not merge.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `pnpm e2e` (existing 216 passed + 7 skipped stays green, plus the new specs on desktop + mobile)
- Unit tests prove: fallback anchors exist for catalog items without jacks and never override real jacks; v2 share round-trips cables/endpoints; v1 links still decode with an empty graph; `updateCustomPedal` prunes dead cables + orphaned endpoints; jack anchors stay correct on a rotated board.
- E2E proves: drag jack→jack commits one cable and one history step; drag jack→endpoint works; direction arrow is present; endpoint place/move/delete; read-only shared graph renders with no mutation; over-graph shared scene warns and opens.
- `pnpm bench:capacity` reports cables/endpoints rows; graph cap unchanged at 150/300.
- Design-reviewer approves desktop + mobile, dark + light (≤2 passes), or the open findings are handed to the owner.
- One light-model code review pass recorded; exactly one PR, not merged.

## Notes

- **Owner decisions (2026-10-21):** fallback anchors for catalog pedals; share `v2` with legacy `v1` decode.
- P4-01 review notes folded: transient endpoint drag, anchor memoization, custom-part cable pruning, share URL budget.
- **Expected performance finding:** the share URL budget binds once cables travel — a 400-item + 200-cable + 100-endpoint scene measured **38,184 chars** vs the 32,000 hard cap (200 items + 300 graph = 27,276). Re-measure at 100/200/400 items + graph and record the verdict; do not raise the graph cap.
- P5-01 catalog work runs in parallel; not a gate.
- **Owner bug fixes (2026-10-21, folded into PR #31):** (a) the first cut only rejected the same cable pair, so a mono output could take two cables. Added `Jack.stereo?: boolean` (custom editor **TRS** toggle), one-cable-per-mono-jack/endpoint and two-per-TRS enforcement in `addCable`, the drag target check, the source-jack check, and `pruneCableGraph`; unit + e2e coverage. (b) Exported cables were straight centre-to-centre lines — export now reuses `cableCurveCm` + the jack-anchor index in physical cm (halo + arrow), and a lifted pedal's incident cables follow `liftedWorldCm`/`liftedRotationDeg` via `liftedJackAnchor`; unit tests + export/drag screenshot verification. (c) Moving/rotating a **board** left its cables behind until release — a transient `boardDrag` transform now feeds `CableLayer` (live board transform) and the rotate handle is hidden during a translation drag; mid-drag screenshot verified.
- **Owner-requested 2 review rounds + confirmation (2026-10-21):** round 1 folded semantic direction normalization, endpoint arrow/tag geometry, assumed disclosure, 44px TRS control/double-ring, mobile cable drag/overlay fixes, static/live cable split, persisted **Show patch** toggle (off by default, owner follow-up), mobile header/popover + centered theme icon; round 2 folded popover CSS order, read-only graph visibility + hidden-patch cue, direction-rejected notice, muted assumed diamonds, export endpoint chips/bounds; confirmation: code-reviewer **approve**, designer **approve-with-changes** (trace thread/status width fixed), design-reviewer **approve**. Checks: lint / typecheck / test **553** / build / e2e **245 + 7 skipped**. Design: owner approved “Patch Drafting”; `design-reviewer` 2/2 (R2 approve-with-changes, no blockers; fixed hollow fallback diamonds + stronger halo; remaining halo-over-photo note handed to the owner). Performance `performance-expert`: **risk** (drag fan-out, endpoint per-tag drag + live cables and graph-aware refusal copy fixed; hard-cap **16 fps at 400+300**, untrusted v2 payload confirmation and a ~24K share warning tier recorded as watch notes; cap unchanged). Code review: light pass 1 changes-required → pass 2 same session **approve** (nits folded: touch cross-item assertion, hand-computed rotated anchor, inline refusal + load dedupe). **Merged 2026-10-21 (PR #31, squash `f001a0b`).**
