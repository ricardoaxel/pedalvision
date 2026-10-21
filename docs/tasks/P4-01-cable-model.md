# P4-01: Cable model + jack anchors

**Phase:** P4 · **Status:** done (merged 2026-10-21, PR #30, squash `d0d79ad`) · **Model:** build-strong

## Goal

Add the persisted cable graph (endpoints + cables) and a deterministic jack-anchor resolver, without any drag-connect UI. After this task a scene can hold cables/endpoints and they survive save → reload and the JSON backup, exactly as boards/items/custom pedals do (A4). Share encode/schema, export/capacity UI consumers and the benchmark stay in P4-02.

## Read first (context pack)

- `docs/design.md` §Data model (Endpoint, Cable, Scene, Jack edge/pos), §Persistence → P4 extension contract, §Canvas architecture (CableLayer/DragLayer), §Capacity budgets
- `docs/requirements.md` F12 (cables), A4 (identical state after reload)
- `docs/roadmap.md` P4-01/P4-02 + the P5-01 catalog program (was P4-04)
- `src/state/scene.ts`, `sceneDocument.ts`, `library.ts`, `history.ts`
- `src/lib/capacity.ts`, `src/lib/customPedal.ts`, `src/catalog/schema.ts`
- `src/lib/sceneBackup.ts`, `src/state/share.ts`, `src/state/persist.ts`, `src/lib/exportScene.ts` (types only)

## Constraints

- **No UI, no canvas rendering, no drag-connect** (P4-02). No share payload/schema change (owner decision 2026-10-21: P4-01 ships save/load + backup only; a P4-01 shared link drops cables, explicitly).
- **No export/capacity UI consumer rewiring** and no benchmark change (P4-02).
- cm stays the source of truth; all anchors are **world cm**. No new dependencies. Soft warnings inline, never toasts (N8).
- Keep the additive **SceneDocument v1** rule: older documents without `endpoints`/`cables` stay valid.
- Do not start P4-02/P4-03.

## Steps

1. **Types** (`src/state/scene.ts`): `Endpoint` (`kind: 'amp'|'instrument'`, world-cm `x`/`y`), `CableEnd` (`{ itemUid, jack } | { endpointUid }`), `Cable`. `jack` is the **decimal index** into the resolved item's `jacks` array (catalog first, then inline custom) — the only stable id the existing `{kind, edge, pos}` contract provides; document it.
2. **Store slice + mutators**: `endpoints`/`cables` state; `addEndpoint`/`moveEndpoint`/`removeEndpoint`, `addCable`/`removeCable`. Graph hard cap via `graphAddRefusal` (150/300 shared). Read-only no-ops. `removeEndpoint` cascades to its cables; `removeItem` cascades to cables referencing it; `removeBoard` leaves cable references intact (items survive as loose).
3. **Jack anchors** (`src/lib/jackAnchor.ts`): resolve the item (catalog → custom → fallback), map `edge`+`pos` to the unrotated footprint point, apply the item's own rotation about its origin, then the board transform (`boardToWorld`) when attached. Return `null` for unknown item/out-of-range jack. Include an endpoint/`CableEnd` helper.
4. **Codec** (`sceneDocument.ts`): add both arrays to `SceneDocument`/`SceneSnapshot`/`createSceneDocument`; structural guards `isEndpoint`/`isCable`; `parseSceneDocument` treats both as additive (`[]` when absent); `normalizeSceneContent` drops cables whose item/endpoint is gone **or whose jack index no longer resolves**, then drops only endpoints orphaned by a dropped cable (a standalone endpoint is a placed object and must survive save → reload, A4), then densifies z / prunes custom pedals as today.
5. **Persistence wiring** (`library.ts`): `emptyScene`, `applyScene` (copy **every** snapshot key), `saveActive`, the autosave subscription, legacy/boot/preview/save-copy/switch/delete paths, and the captured `previousSnapshot`. `state/persist.ts` legacy parse validates `endpoints`/`cables` with the same structural guards (additive; absent → empty arrays). `sceneBackup.ts` passes the whole snapshot.
6. **Share boundary**: keep `shareLink.ts` encode/decode on the P3 v1 payload (`boards`/`items`/`customPedals`); decode normalises with `endpoints: []`/`cables: []`. Add a comment + task note that P4-02 owns the explicit v1-additive vs v2 decision.
7. **History**: add `cables`/`endpoints` to the compile-forced key map (undo/redo now capture and restore them). Replace the tautological P3-04 assertion with an explicit field/value fixture that proves each key's **value** is restored.
8. **Tests**: codec round-trip with cables/endpoints; additive v1 doc without them; malformed cables/endpoints dropped; orphan cable + dangling endpoint pruning; `applyScene` scene-switch isolation (no cable leak); autosave after a cable edit; jack anchors on a rotated board + rotated loose item; store mutator cascades + graph cap; history restore of cables/endpoints.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `pnpm e2e` (no new spec: no rendered UI; existing 216 + 7 skipped stays green)
- New unit tests prove: save → load keeps cables/endpoints **and a standalone endpoint with no cable**; an outgoing scene's cables never appear in a loaded scene; removing an item removes its cables; an invalid jack index is rejected and normalised away; anchor math is correct for item rotation composed with a rotated board.
- One light-model `code-reviewer` pass (HIGH-RISK: persistence/serialization) with blockers/should-fixes fixed.
- Exactly one PR; do not merge.

## Notes

- Owner decision (2026-10-21): **P4-01 ships save/load only** — no share support yet; P4-02 adds cables to the share payload and makes the version-policy decision explicit.
- P5-01 (catalog program, was P4-04) runs in parallel; not a dependency.
- **Performance review (2026-10-21, `performance-expert`): verdict `watch`.** P4-01 adds +0.74 kB gz, ~+44 KB per max scene and ~3 ms codec work; hosting $0. Deferred to P4-02: share-URL budget when the graph travels (a 400-item + 300-graph scene measures 38,184 chars vs the 32,000 hard cap), transient endpoint dragging (commit once on pointerup), anchor memoization for `CableLayer`, and the capacity graph UI.
