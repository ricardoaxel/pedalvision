# P3-02: Scene save/load + multi-scene index (IndexedDB) + autosave + boot reconcile

**Phase:** P3 · **Status:** done (merged 2026-10-20, PR #24, squash `b874821`) · **Model:** build-strong

## Goal

Replace the temporary `localStorage` scene mirror (P1-06) with the real v1 persistence system: **IndexedDB scene documents** (via the pre-authorized `idb` dependency), a **named multi-scene index + settings in `localStorage`**, **debounced autosave (~500 ms)**, and a **boot-time index↔document reconcile**. A user can create/switch/rename/delete named scenes; every scene keeps its boards, items, inline custom pedals, z-order and geometry across reloads (A4). Undo/redo (P3-04), share links (P3-03) and the storage-failure fallback/warning (P3-05) are **out of scope**. The app-wide `Settings.units` (`cm`/`in`) follow-up from `docs/progress.md` lands here as a small persisted setting (it is the other `localStorage` "settings" item in `docs/design.md` §Persistence).

## Read first (context pack)

- `docs/design.md` → §Data model, §Persistence (v1, no backend), §Z-order & container rules (the z-order contract)
- `docs/requirements.md` → **F8**, **A4**; skim **F10** only for the codec boundary (P3-03 owns it)
- `docs/roadmap.md` → P3-02 and the P3-03/P3-04/P3-05 boundaries
- `docs/progress.md` → Follow-ups (app-wide `Settings.units` → P3-02) + Deps note (`idb` pre-authorized)
- `src/state/persist.ts` + `persist.test.ts` (the temporary localStorage mirror being replaced)
- `src/state/scene.ts` (store shape; `normalizeAllZ`, `pruneCustomPedals`)
- `src/lib/storage.ts` (`resolveStorage`)
- `src/main.tsx` (hydration before first render)
- `src/components/InfoPanel.tsx` (local `units` state → `Settings.units`)
- `src/App.tsx` (toolbar/picker/export chrome the scene manager must fit beside)
- `src/styles/tokens.css` + `src/index.css` (tokens-only styling; no hardcoded colors)
- `AGENTS.md` → Design gate + Code review (this task is **design-affecting** and **HIGH-RISK**)

## Constraints

- **cm is the source of truth**; never rescale objects. Persist only scene data, never transient UI state (selection, viewport, drag, picker state).
- **Do not** build undo/redo (P3-04), share links/deflate codec (P3-03), or the storage-failure warning/JSON backup (P3-05). Storage errors must be **non-fatal** and must not lose the in-memory scene silently: fail soft at boot, keep the app usable, and stop autosave if the DB is unavailable (the user-facing warning is P3-05).
- **Preserve the existing scene shape**: `boards`, `items`, `customPedals` (inline), per-container dense `z`, rotations and cm geometry byte-for-byte on a round trip. Do not rename/alter `PlacedBoard`/`PlacedItem`/`CustomPedal`.
- **Migrate the legacy `localStorage` mirror** (`pedalvision.scene.v1`) into the new store exactly once (rename it to a named scene), then delete the legacy key. A blocked/corrupt legacy payload must not break boot.
- **Boot reconcile (R6/S2):** drop index entries with no document; surface orphaned documents back into the index; leave the index consistent in `localStorage`. Reconcile must be idempotent.
- **One active scene at a time.** A switch must flush the outgoing scene before loading the incoming one. Never write scene A's payload into scene B.
- **No new dependency except `idb`** (pre-authorized). No new ADR required for it; note it in the PR/task file.
- **Design gate:** the scene-manager UI is design-affecting. The `designer` proposes a direction; the **owner approves before any UI**; then desktop + mobile, dark + light renders and `design-reviewer` (≤2 passes).
- Tokens only for colors/spacing/type; no hardcoded hex in components.
- Keep the current autosave debounce (~500 ms) and add a flush on `pagehide`/`visibilitychange` where practical.

## Steps

1. **Task file first** (this file) — done.
2. **Design gate:** run the `designer` for the scene-manager surface (trigger placement, panel/tray, list/active state, naming, new/rename/delete, empty/one-scene states), present the proposal to the owner, and **stop for approval before writing UI**.
3. **Codec (`src/state/sceneDocument.ts`, pure):** `SceneDocument` = `{ id, version: 1, name, boards, items, customPedals, updatedAt }`; validation/parse mirroring `persist.ts` (drop malformed entries, reject unknown versions, never throw); `documentFromScene(...)`; `applyDocumentToScene(doc)` (drop items whose board is gone, `normalizeAllZ`, `pruneCustomPedals`). Keep the additive-field pattern so P4 cables/endpoints and P3-03's codec can extend version 1.
4. **Index + settings (`src/lib/sceneIndex.ts`, pure):** parse/serialize `pedalvision.scenes.v1` = `{ version: 1, scenes: { id, name, updatedAt }[] }`; `reconcileIndex(index, docs)` → dropped/added/changed; parse/serialize `pedalvision.settings.v1` = `{ version: 1, units: 'cm'|'in', activeSceneId: string|null }`; `resolveStorage` fail-soft.
5. **IDB layer (`src/lib/idb.ts`):** `openDB` from `idb`, db `pedalvision`, store `scenes` keyPath `id`; `getAllSceneDocs`/`getSceneDoc`/`putSceneDoc`/`deleteSceneDoc`; `close` for tests. Guard all calls so a failure rejects safely (callers fail soft).
6. **Autosave (`src/state/autosave.ts`, pure/testable):** debounce helper (~500 ms) with injectable timer, `schedule()`/`flush()`/`cancel()`; no write when the scene slice is unchanged; flush on switch and on page hide.
7. **Library store (`src/state/library.ts`):** `useSceneLibrary` Zustand store (`scenes: SceneIndexEntry[]`, `activeId`, `ready`) + async actions `bootLibrary`, `newScene(name?)`, `switchScene(id)`, `renameScene(id, name)`, `deleteScene(id)` (never delete the last scene), `saveActiveNow()`. Inject a repository interface so unit tests use an in-memory repo (no `fake-indexeddb` dependency). Hydrate `useScene` through the codec on boot/switch; suppress autosave while applying a document.
8. **Replace `persist.ts`:** keep legacy parse helpers for migration; `bootScenePersistence()` opens IDB, loads the index, reconciles, migrates the legacy mirror once, hydrates the active scene, and starts autosave. `main.tsx` awaits boot before first render (still renders if persistence fails).
9. **`Settings.units`:** small persisted settings store (`src/state/settings.ts`) read/written by `InfoPanel` (replacing its local `useState`); storage stays cm.
10. **UI (after owner approval):** scene-manager control in the existing toolbar + desktop panel / mobile tray, tokens-only CSS, accessible (dialog/sheet semantics consistent with Picker/ExportPanel; focus return; Esc/tap-outside; 44 px touch targets). No new visual direction beyond the approved one.
11. **Tests:** unit — codec round-trip (boards/items/customPedals/z), malformed/unknown-version docs, reconcile (drop/add/idempotent), autosave debounce/flush/cancel with fake timers, orphan-item normalization on load, legacy migration, library create/switch/rename/delete via in-memory repo, settings round-trip. E2E — save → reload → **identical state** (positions, rotations, z-order, inline custom pedal) desktop **and** mobile; create a second scene, switch, both survive reload; rename persists; delete fallback; reconcile by deleting an IDB doc / injecting an orphan via `page.evaluate` and reloading.
12. **Checks:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; then design-reviewer (≤2) and the **HIGH-RISK code-review ≤2-pass loop** on the light model (`opencode-go/deepseek-v4.1-flash`, reuse the session for pass 2).
13. **PR:** exactly one, full 5-section standard + review-round digest + inline screenshots at the commit SHA (**dark mode only is sufficient**; caption every screenshot so the owner knows what is demonstrated). Do not merge.
14. **Docs:** update `docs/progress.md`, `docs/roadmap.md`, this task's status, and `docs/design.md` if a persistence detail changes.

## Acceptance (executable)

- `pnpm lint` → 0 errors.
- `pnpm typecheck` → 0 errors.
- `pnpm test` → all green, including the new codec/reconcile/autosave/migration/library unit tests.
- `pnpm build` → succeeds.
- `pnpm e2e` → all green (desktop + mobile), including `e2e/scenes.spec.ts`:
  - place board + pedals (incl. a rotated pedal and a custom pedal), reload → **identical** `data-*` geometry/rotation/z-order and the custom part still renders;
  - create scene B, place different content, switch A↔B, reload → each scene restores its own content;
  - rename a scene, reload → name persists;
  - delete a scene, reload → it stays gone and the remaining scene is active;
  - index↔doc reconcile: remove a document from IDB (or seed an orphan document) via `page.evaluate`, reload → stale index entry is dropped / orphan is surfaced.
- Manual/observable: no `pedalvision.scene.v1` key remains after the first boot (legacy scene migrated into a named scene); a blocked IndexedDB does not crash the app (app renders; no silent data loss within the session).
- `docs/progress.md`, `docs/roadmap.md` and this file reflect **in review — PR #N** (not done) until the owner merges.

## Notes
- **Owner-directed additions folded into this PR (2026-10-19):** a product cap of **10 named scenes** (`MAX_SCENES`, inline "limit reached" state), centring the compact mobile Export trigger icon, and switching the PNG download to a Blob object URL (A3: iOS Safari fails on multi-MB `data:` downloads; the reported 7-pedal board exports as a ~2.14 MB PNG).

- `idb` (P3 persistence) is pre-authorized in `docs/progress.md` → Deps note; keep it the only new dependency.
- The index lives in `localStorage` even though documents live in IndexedDB (design.md §Persistence) — reconcile exists because the two stores can evict independently.
- P3-03 will reuse the `SceneDocument` codec; keep it pure and version-aware.
- P3-05 will consume `bootLibrary`'s "storage unavailable" signal for the inline warning + JSON backup — expose a small readiness/availability flag now, but do not build the UI.
- **P4 persistence wiring (P3 phase gate, 2026-10-21):** `applyScene` copies `boards`/`items`/`customPedals` explicitly and the autosave subscriber compares those three arrays. Adding `cables`/`endpoints` to `SceneSnapshot` will **not** fail the build here, so P4-01 must update `applyScene` (copy every key), `saveActive`, the autosave subscription, and every other `createSceneDocument` call site (legacy migration, save-copy, preview). Otherwise a scene switch leaves the outgoing scene's cables behind and cables never autosave. See `docs/design.md` §Persistence → **P4 extension contract**.
