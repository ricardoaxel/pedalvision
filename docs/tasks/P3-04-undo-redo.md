# P3-04: Undo/redo (snapshot store) + keyboard shortcuts

**Phase:** P3 · **Status:** done (merged 2026-10-20, PR #27, squash `06ee5e3`) · **Model:** build-strong

## Goal

A user can confidently experiment: every committed scene edit is one undo step, and **Undo / Redo** are always reachable — visible controls on desktop **and** mobile, plus `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z`. The history is a snapshot stack over the persisted scene slice (`boards`, `items`, `customPedals`; P4 extends it with `cables`/`endpoints`), capped at ~50 entries per direction. Continuous gestures (drag, rotate) record once at the committed drop/transform; compound actions (custom-pedal create = definition + placement, board transform = rotation + origin shift) are atomic. Undo/redo never records itself, never touches selection/viewport/picker state, never crosses scenes, and is unavailable in read-only share previews. Undo/redo autosaves and keeps the scene index counts/`updatedAt` consistent; undo restores a previously valid (even over-now-cap) state without capacity refusals.

## Read first (context pack)

- `docs/design.md` → §Persistence (undo/redo bullet, cap ~50), §Canvas architecture (commits on dragend/transformend, read-only), §Data model, §Z-order & container rules, §Capacity budgets
- `docs/requirements.md` → **F8**, **F6**, **S5/N6** (undo/redo + shortcuts), **A4/A5** (state fidelity/read-only)
- `docs/roadmap.md` → P3-04 and the P3-05/P4 boundaries
- `src/state/scene.ts` (all mutators and the persisted slice), `src/state/sceneDocument.ts` (`SceneSnapshot`), `src/state/library.ts` (`applyScene`, autosave wiring), `src/state/autosave.ts`, `src/state/readOnly.ts`, `src/state/share.ts`
- `src/App.tsx`, `src/canvas/useSelectionShortcuts.ts`, `src/canvas/Stage.tsx`, `src/canvas/BoardLayer.tsx`, `src/canvas/BoardNode.tsx`, `src/canvas/ItemTransformer.tsx`, `src/canvas/useItemDrag.ts`, `src/canvas/ItemActionBar.tsx`, `src/canvas/BoardActionBar.tsx`
- `src/components/Picker.tsx` → `handlePlace`, `handleCreate`, `handleSave`, `handleCreateBoard`, `handleSaveBoard`
- `docs/tasks/P3-02-scene-save-load.md` and `docs/tasks/P3-03-share-links.md` → persistence/read-only contracts
- `src/styles/tokens.css`, `src/index.css` (tokens-only styling; toolbar/mobile chrome conventions)
- `AGENTS.md` → Design gate + Code review (design-affecting + HIGH-RISK)

## Constraints

- **No new dependencies.** No ADR needed; do not add a history library.
- **cm is the source of truth.** Snapshots hold the persisted scene slice only — never selection, hover, viewport, drag, picker or panel state.
- **Do not start P3-05 (storage fallback) or P4 (cables).** P4 is the extension point, not part of this task.
- **One user action = one undo step.** Coalesce a whole drag/rotation into its committed drop/transform; make compound actions atomic (`addCustomPedal` + `addItem`, board `rotateBoard` + `moveBoard`). Never snapshot per pointer move or per keystroke.
- **Do not record undo/redo itself.** Restoring a snapshot must not push history. `future` is cleared on a new edit.
- **Scene boundaries:** clear history on boot, new scene, scene switch, share preview enter/exit, and save-a-copy. History never spans two documents.
- **Read-only:** undo/redo are no-ops and the shortcuts/controls are absent/disabled in a shared preview. No undo of a shared scene.
- **Capacity:** hard caps must not reject an undo (restoring a previously valid state bypasses add-time refusals). Over-cap recovered/shared scenes still load by policy (A4/A5).
- **Autosave:** undo/redo must schedule autosave and let `saveActive` refresh `updatedAt` + cached counts as usual.
- **Shortcut scope:** ignore `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` inside `input`/`textarea`/`contenteditable` and while a modal draft is open; never hijack browser text undo in a field.
- **Design gate:** visible controls are design-affecting. The `designer` proposes the direction; the **owner approves before any UI**; then render desktop + mobile, dark + light and run `design-reviewer` (hard cap ≤2 passes).
- **Code review is HIGH-RISK** (snapshot/persistence/autosave interactions): light model (`opencode-go/deepseek-v4.1-flash`), ≤2 passes, reuse the same reviewer session for pass 2.
- Tokens only for colors/spacing/type; no hardcoded hex. Soft warnings stay inline, never toasts (N8).

## Steps

1. **Owner decision (recorded 2026-10-20):** visible Undo/Redo **controls + shortcuts**. This makes the task design-affecting. `designer` proposes the control placement/treatment for desktop + mobile (dark + light); **STOP for owner approval before writing UI**.
2. **History store (`src/state/history.ts`):** `past`/`future` snapshot stacks of `{ boards, items, customPedals }`, `HISTORY_LIMIT = 50`, `undo()`, `redo()`, `clearHistory()`, `canUndo`/`canRedo`. `captureScene()`/`applySnapshot()` are the single extension point for P4 `cables`/`endpoints`. Apply is guarded so it never records.
3. **Action batching (`beginSceneAction`/`endSceneAction` or `runSceneAction`):** every scene mutator opens/closes a history action; nesting coalesces synchronous mutator calls into one entry. A structurally unchanged scene (e.g. reorder at an extreme) records nothing. Wrap the compound call sites (Picker custom-pedal create; `BoardLayer.commitNode` rotate+move) so they stay one step.
4. **Scene boundaries:** `library.applyScene` clears history (boot/new/switch/preview enter/exit/save-copy). Undo/redo themselves never call `applyScene`.
5. **Read-only + capacity:** `undo`/`redo` return false in read-only; apply bypasses add-time cap refusals (it is a restore, not an add).
6. **Shortcuts (`src/canvas/useHistoryShortcuts.ts`, mounted in App):** `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo; ignore typing targets, composing events and open modal dialogs; `preventDefault` only for handled keys. Keep `useSelectionShortcuts` unchanged.
7. **Visible controls (after approval):** Undo/Redo buttons in the existing chrome (desktop toolbar; touch-reachable mobile placement proposed by the designer), disabled at the extremes, accessible names + keyboard focus, tokens-only CSS.
8. **Debug hooks:** expose `data-undo-depth`/`data-redo-depth` on the canvas host for deterministic e2e (same pattern as existing `data-*`).
9. **Tests:** unit (snapshot round-trip, cap 50, redo cleared by a new edit, no-op extremes, compound custom-pedal = one step, board transform = one step, scene switch clears, read-only blocks, autosave after undo, P4 extension point) + e2e on desktop and mobile.
10. **Docs:** update `docs/design.md` §Persistence if the final constants/behaviour differ; update `progress.md`, `roadmap.md` and this task status (in review — PR #N, not done).
11. **Checks + reviews:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; `design-reviewer` (≤2 passes, desktop+mobile dark+light); HIGH-RISK light code review (≤2 passes, same session for pass 2).
12. **One PR** to the full standard (Summary, Changes, Testing, inline screenshots at the commit SHA with captions, ≤3 owner review hints, review-round digest). **Do not merge.**

## Acceptance (executable)

- `pnpm lint` → 0 errors.
- `pnpm typecheck` → 0 errors.
- `pnpm test` → all green, including `src/state/history.test.ts`:
  - snapshot round-trip restores boards, items (incl. rotation/boardUid/z) and inline custom pedals exactly;
  - cap: 51+ edits keep the newest 50; oldest are dropped; redo also capped;
  - undo then a new edit clears `future` (no redo of a discarded branch);
  - undo/redo at the extremes are no-ops (never throws, never changes the scene);
  - a compound custom-pedal creation (`addCustomPedal` + `addItem`) is exactly one undo step and restores/removes the definition + placement together;
  - a board transform commit (`rotateBoard` + `moveBoard`) is exactly one step;
  - delete/edit/z-order/duplicate/add are one step each; undo/redo do not record themselves;
  - `clearHistory()` (scene switch/new/boot) empties both stacks;
  - read-only mode blocks undo/redo (scene unchanged);
  - restoring a state that would now exceed a hard cap (e.g. add was valid in the past) is not refused;
  - autosave is scheduled after undo (library autosave test with an injected repo/timers) and the index counts/`updatedAt` are refreshed by the save;
  - the P4 extension point is covered by a test proving `captureScene`/`applySnapshot` restore every field listed in the editable-scene field set (adding cables/endpoints later is a one-place change).
- `pnpm build` → succeeds.
- `pnpm e2e` → all green (desktop + `mobile-chromium`), including `e2e/history.spec.ts`:
  - add pedal → Undo removes it, Redo restores it (geometry/rotation/z identical);
  - drag a pedal, rotate a pedal → one undo each restores the pre-gesture transform (not an intermediate pointer-move state);
  - duplicate, delete, z-order → each is one undo step;
  - create a custom pedal (definition + placement) → one undo removes both; redo restores both; edit a custom pedal → one undo restores the old definition;
  - create/move/rotate/delete a board → each is one undo step, attached pedals restored with it;
  - shortcuts ignored inside an input (picker search / custom form) and while the picker modal is open with a draft;
  - scene switch/new does not undo across scenes (fresh document has empty history);
  - read-only share preview ignores Undo/Redo and shows no enabled controls; the recipient scene is unchanged;
  - undo then reload persists the undone state;
  - desktop and mobile control paths both covered (visible controls + shortcuts).
- `docs/progress.md`, `docs/roadmap.md` and this file say **in review — PR #N** (not done) until the owner merges.

## Notes

- **Owner decision (2026-10-20):** visible Undo/Redo controls on desktop **and** mobile, plus keyboard shortcuts — mobile users must have undo because delete is immediate. Design gate applies (direction owner-approved before any UI; design-reviewer ≤2 passes). Approved direction: **"Proof Marks"** (icon-only joined desktop capsule + mobile dock pair, zero new tokens).
- **Implementation (2026-10-20):** `src/state/history.ts` (snapshot stacks, cap 50, lazy capture, `queueMicrotask` coalescing, restore guard, exhaustive `Record<keyof SceneSnapshot, true>` key map), `library.applyScene` clears history after every document change, `src/canvas/useHistoryShortcuts.ts` (text/composing/modal scoping), `src/components/HistoryControls.tsx` + `icons.tsx` (aria-disabled focus retention), App/Picker/CSS mounts (desktop capsule + mobile dock; controls absent read-only), Stage `data-undo-depth`/`data-redo-depth`.
- **Checks (2026-10-20):** lint / typecheck / test **482** / build / e2e **200 passed + 7 skipped** (9 history tests × desktop + mobile).
- **Design gate:** owner approved "Proof Marks" before any UI; `design-reviewer` **approve** (10 renders, desktop+mobile, dark+light, empty/enabled/extreme/read-only/sheet/320 px).
- **Code review (light, HIGH-RISK ≤2):** pass 1 changes-required (exhaustive P4 key map + real extension test, production-microtask coalescer test + real custom-pedal round-trip, `flushHistory` internal) → fixed in `03f8b6f` → pass 2 (same reviewer session) **approve**. The first pass-1 attempt hit a provider **429** ("Endpoint is unavailable") and was retried on the same light model after owner confirmation.
- **PR:** #27 (do not merge without owner approval).
- History is intentionally **in-memory only** (S5): it is not persisted, so a reload starts with an empty history; persistence of the resulting scene still happens through autosave.
- P4 adds `endpoints`/`cables` to `SceneSnapshot`; add them in the history capture/apply field set and to `applyScene` in one place.
- Snapshots share unchanged item/board objects with the live store (mutators copy on write), so 50 entries stay cheap; no deep clone per action.
