# P3-05: Storage-failure fallback (availability/quota check + inline warning + JSON backup)

**Phase:** P3 · **Status:** done (merged 2026-10-21, PR #28, squash `fb4b1cd`) · **Model:** build-strong

## Goal

Never lose work silently (F8, `design.md` §Persistence → Storage failure). On boot the app classifies storage health (IndexedDB open/read, `localStorage` availability, and a `navigator.storage.estimate()` quota signal) instead of scattering `try/catch`. If IndexedDB or the index store is unusable/blocked, the app stays **fully usable in memory (session-only)**, shows a **persistent inline warning** (never a toast, N8), and offers a **JSON backup download** of the current scene built from the **live in-memory scene**. Runtime write failures (autosave `put`, index write) surface the same warning and stop autosave when documents cannot land. A low-quota signal is a quiet inline **advisory**, not a block; an unavailable estimate must never produce a false warning. There is no import/restore UI in this task. Read-only share previews keep their existing behaviour (no storage warning/backup), and the warning/backup never write to a scene document.

## Read first (context pack)

- `docs/design.md` → §Persistence (Storage failure bullet, IndexedDB/index/autosave/boot reconcile, Scene cap), §Data model (`SceneDocument` shape), §Capacity budgets
- `docs/requirements.md` → **F8**, **A4/A5**, **N8** (no toasts), **S2/R6** (boot reconcile)
- `docs/roadmap.md` → P3-05 and the P4 boundary
- `src/state/library.ts` (`storageAvailable`/`sessionOnly`/`saving`/`lastSavedAt`, `boot`, `applyScene`, `saveActive`, new/switch/rename/delete, preview)
- `src/state/autosave.ts`, `src/state/sceneDocument.ts`, `src/state/persist.ts`
- `src/lib/idb.ts`, `src/lib/sceneIndex.ts`, `src/lib/storage.ts`
- `src/main.tsx`, `src/App.tsx`, `src/components/ScenePanel.tsx` (Title Block), `src/components/ExportPanel.tsx` / `src/components/SharePanel.tsx` (inline states + Blob download patterns)
- `docs/tasks/P3-02-scene-save-load.md`, `docs/tasks/P3-03-share-links.md`, `docs/tasks/P3-04-undo-redo.md` (persistence/read-only/history contracts)
- `src/styles/tokens.css` + `src/index.css` (tokens-only styling; existing inline notice patterns)
- `AGENTS.md` → Design gate, Code review, PR standard

## Constraints

- **No new dependencies.** Do not start P4 or P3-06 changes.
- **cm is the source of truth**; backup/restore must not rescale geometry. The backup is scene data only — never selection/viewport/picker state.
- **Classify storage in one pure, injectable place** — no ad-hoc `try/catch` spread through components. Tests must inject the probe (IDB available, `localStorage` available, estimate) and never depend on a real browser quota.
- **Boot:** IDB open/read failure or blocked `localStorage` → session-only + inline warning. A failed read must **not** overwrite a valid stored register (P3-02 contract).
- **Runtime:** a failed autosave `put` must surface the warning and **disable autosave** (no retry loop). A failed index write must surface the warning but must not claim "Saved".
- **Low quota** (estimate usable and ≥90% used) → inline advisory only; the app keeps saving. **Estimate unavailable / quota ≤ 0 → no warning.**
- **Backup:** versioned `SceneDocument` v1 (the same codec as IndexedDB), valid and round-trippable through `parseSceneDocument`, built from the **live** in-memory scene at click time, downloaded via a **Blob object URL** (never a `data:` URL — iOS Safari), object URL revoked after ~60 s. Safe filename from scene name + date. No writes to the scene document, index or settings.
- **No import/restore UI.** Out of scope unless the owner asks.
- **Read-only share preview:** keep existing behaviour — no storage warning/backup affordance, no writes while previewing.
- **Preserve existing contracts:** over-cap and shared scenes still load; autosave stays debounced (~500 ms); history still clears per document; scene switching still flushes when it can.
- **Design gate:** visible UI is design-affecting. `designer` proposes the direction; **owner approves before any UI**; then render desktop + mobile, dark + light, and run `design-reviewer` (hard cap ≤2 passes). Inline only — no toast, no modal.
- **Code review is HIGH-RISK** (persistence/storage/autosave): light model (`opencode-go/deepseek-v4.1-flash`), ≤2 passes, reuse the same reviewer session for pass 2.
- **Performance-sensitive:** run the optional `performance-expert` review on the quota check + backup payload/download; record verdict + applied/deferred findings. No ms gates.

## Steps

1. **Task file first** (this file).
2. **Design gate:** `designer` proposes the inline warning + backup affordance for desktop + mobile, dark + light (placement, hierarchy, copy, unavailable vs low-quota states, ARIA semantics, touch targets). **STOP for owner approval before writing UI.** Record the approved direction in this file + `progress.md`.
3. **Health classification (`src/lib/storageHealth.ts`, pure):** `StorageProbe { indexedDb, localStorage, estimate }`; `classifyStorageHealth(probe)` → `ok | low-quota | unavailable` with a reason + usage/quota; `LOW_QUOTA_RATIO = 0.9`; estimate `null`/non-finite/`quota ≤ 0` → `ok`. Browser adapter probes `localStorage` with a throwaway key write/remove and `navigator.storage.estimate()` fail-soft.
4. **Library state (`src/state/library.ts`):** add `storageHealth` to the snapshot; set it at boot from the probe + actual document read result (IDB open/read failure or blocked `localStorage` → `unavailable` + `sessionOnly`, even when IDB opened). On autosave `put` failure → `unavailable`, `storageAvailable: false`, `sessionOnly: true`, cancel autosave. On an index write failure → the same session-only state (writes latched, never `saved`, no retry loop). Keep `sessionOnly`/`storageAvailable` semantics for existing UI/tests.
5. **Backup codec (`src/lib/sceneBackup.ts`):** `buildSceneBackup({ id, name, snapshot, now })` → `{ document, json, filename }` using `createSceneDocument` + `JSON.stringify`; `backupFileName(name, date)` sanitises to a safe `scene-name-YYYY-MM-DD.json`; shared `src/lib/download.ts` (`downloadBlob`) reused by ExportPanel. Live snapshot read at click time.
6. **UI (after approval):** inline `StorageNotice` (tokens only) shown when `ready` and health ≠ `ok` and not read-only; unavailable = persistent notice + `Download backup` action; low quota = quieter advisory (backup optional); inline success/failure for the download; accessible (`role="status"`/`aria-live` for advisory, no `role="alert"` toast), 44 px targets; desktop + mobile placement per the approved direction. No modal, no toast.
7. **Tests:** unit — classification matrix, boot classification, register not overwritten on read failure, autosave disabled after put failure, index-write warning, backup round-trip/live edits/filename/no side effects. E2E — desktop + mobile: blocked IDB (renders, editable, warning, session-only edits, backup parses), mid-session put failure (warning, work in memory), estimate unavailable (no warning), normal storage (no warning), existing suites unaffected.
8. **Checks:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; `performance-expert`; `design-reviewer` (≤2); HIGH-RISK light code review (≤2, same session for pass 2).
9. **One PR** to the full standard (Summary, Changes, Testing, inline screenshots at the commit SHA with captions, ≤3 owner review hints, review-round digest). **Do not merge.**
10. **Docs:** update `docs/design.md` §Persistence if final behaviour differs; `docs/progress.md`, `docs/roadmap.md` and this file → **in review — PR #28** until merged. **Merged 2026-10-21 (squash `fb4b1cd`).**

## Acceptance (executable)

- `pnpm lint` → 0 errors.
- `pnpm typecheck` → 0 errors.
- `pnpm test` → all green, including new tests:
  - `storageHealth` classification: available (`ok`), IDB blocked (`unavailable`, reason indexeddb), `localStorage` blocked (`unavailable`), IDB read failure (`unavailable`), `usage/quota ≥ 0.9` (`low-quota`), estimate `null`/rejecting/quota `0`/non-finite → `ok` (no false warning).
  - boot with IDB blocked → `ready`, `sessionOnly`, `storageAvailable: false`, warning state, in-memory scene usable.
  - boot read failure → the stored index is **not** overwritten (P3-02 regression test still passes) and the warning is `unavailable`.
  - autosave `put` failure → `unavailable` + `sessionOnly` + autosave stops (no further writes/retries); the in-memory edits remain.
  - index write failure → `unavailable`, `storageAvailable: false`, never `saved`.
  - low quota at boot → healthy register loads, autosave works, health is `low-quota` (advisory only).
  - backup: `parseSceneDocument(JSON.parse(json))` round-trips boards/items/customPedals; JSON reflects an unsaved in-memory edit; filename is `[a-z0-9-_]+-YYYY-MM-DD.json`; building/downloading writes nothing to the repository/index/settings.
- `pnpm build` → succeeds.
- `pnpm e2e` → all green (desktop + `mobile-chromium`), including `e2e/storage-fallback.spec.ts`:
  - blocked IndexedDB via `addInitScript` → app renders, canvas stays editable (place a board/pedal), inline warning appears, edits work session-only, `Download backup` fires a download whose JSON parses with the current live scene; reload → work gone (session-only) and the warning still appears;
  - mid-session `IDBObjectStore.prototype.put` failure → warning appears, the board/pedal stays on canvas, autosave stops, backup contains that edit;
  - `navigator.storage.estimate` unavailable → **no** warning with normal storage;
  - normal storage → no warning;
  - the existing scene/share/undo suites still pass (no regression).
- `docs/progress.md`, `docs/roadmap.md` and this file said **in review — PR #28** until merged. **Merged 2026-10-21 (squash `fb4b1cd`).**

## Notes

- **Design direction (2026-10-20, owner-approved): "Margin Note".**
  - **Placement:** inside `.app-canvas`, pinned to the sheet's left margin directly under the Title Block — desktop `top: 68px; left: var(--space-4); width: 320px`; mobile full-width strip under the 44px top row (`left/right: 12px`, same y). 320px wraps to ≤3 lines, CTA full-width, card bottom ≈201px on 320×568. Never in the toolbar. Coexists with the plate (never shifts), panels/trays (panels win), info rail/sheet (never covered), item action bar (z2 above notice z1). FirstRunHint hidden only while `unavailable`.
  - **Treatment:** reviewer's slip — `--color-surface-elevated`, `--color-border`, `--radius-card`, `--shadow-raised`; unavailable adds a 3px `--color-warning` left rule; low quota is border-only and quieter. Mono uppercase eyebrow (`--color-warning`), one plain sentence (`--color-ink`), accent CTA (`--color-accent-surface/border/ink`, 44px), mono receipt (filename after download; danger on failure). **Zero new tokens.** No danger red, no alarm glyph, no badge on the scene plate. 140ms mount fade with reduced-motion fallback.
  - **States:** `ok` ─ nothing; `unavailable` (boot blocked / mid-session write failed) ─ **not dismissible**, persistent card + `Download backup`; `low quota` ─ border-only advisory, dismissible for the session; `downloading` (aria-busy) → `downloaded` (receipt `scene-name-YYYY-MM-DD.json`) or `download failed` (danger receipt, retry on the same button). No timers, no toast/modal, no "Retry saving" (autosave is deliberately stopped).
  - **Copy:** eyebrow `Not saving`; *Storage is blocked in this browser. Changes stay in this tab only.* / *The last save didn’t go through. Changes stay in this tab only.*; CTA `Download backup`; receipt *Downloaded scene-name-2026-10-20.json.* / *Couldn’t download the backup. Try again.*; low quota `Storage almost full` · *Browser storage is about 92% full. Saving still works.*
  - **ARIA/focus:** card is `role="note"` (not a live region); an always-mounted visually-hidden `role="status" aria-live="polite"` announces health/download changes (mid-session failure included). Nothing autofocuses; CTA uses `aria-disabled` so focus survives; low-quota dismiss (44×44) returns focus to the scene trigger.
  - **Reviewer renders:** desktop 1440×900 + mobile 390×844 + 320×568, dark + light; unavailable (boot/mid-session/register open), low quota, downloaded, failed, ok; mobile info sheet open. Read-only preview = absent (asserted in e2e).
  - **Owner decision (2026-10-20, "ok"):** direction approved with the designer's recommendations — low quota is **informational-only** (no backup CTA) and the First-run Bench Note is **hidden while storage is unavailable**.
- Tests must name their injections explicitly (probe object, failing repository, patched `IDBObjectStore.prototype.put`, overridden `navigator.storage.estimate`); no test may depend on real browser quota.
- The session-only path intentionally disables scene register mutations (existing P3-02 semantics) so a failed write cannot be followed by a scene switch that loses the outgoing document.
- Backup is the user's escape hatch, not a restore feature: no import UI, no automatic re-import.
- P4 extends `SceneSnapshot` with cables/endpoints; `buildSceneBackup`/health code must keep the additive codec pattern.

## Implementation (2026-10-20)

- **Design gate:** owner approved **"Margin Note"** before any UI (`ok`, 2026-10-20; low-quota informational-only, First-run note hidden while unavailable). `design-reviewer` **R1 approve-with-changes** (the open Scene Register covered the notice in the same top-left column) → notice steps beside the register on desktop → **R2 approve** (17 renders: desktop 1440×900, mobile 390×844, 320×568, dark + light, boot/mid-session/register/low-quota/downloaded/failed/ok/info-sheet).
- **Classification (`src/lib/storageHealth.ts`):** pure `StorageProbe { indexedDb, localStorage, estimate }` → `ok | low-quota | unavailable` (reason + usage/quota). `LOW_QUOTA_RATIO = 0.9`; unusable estimate → `ok` (never a false warning). `probeStorage()` writes/reads/removes a throwaway `localStorage` key and fail-softs `navigator.storage.estimate()`. `readStorageEstimate()` is started **concurrently** with the IDB open and time-boxed (`ESTIMATE_TIMEOUT_MS = 250`) so a hung probe cannot gate first render. Runtime failures upgrade the same state via `withStorageFailure`.
- **Boot (`src/state/persist.ts` + `src/state/library.ts`):** probe once, then classify with the actual `repo` result. IDB open/read failure **or blocked `localStorage`** → `unavailable` + `sessionOnly` + `storageAvailable: false` (even when IDB opened). The register is never reconciled over a failed read.
- **Runtime:** an autosave `put` failure latches the write failure (session-only, autosave cancelled, work kept in memory); an index write failure latches the same state and is not retried per autosave. Never claims "Saved" for a write that did not land. Low quota keeps saving normally.
- **Backup (`src/lib/sceneBackup.ts` + `src/lib/download.ts`):** `buildSceneBackup({ id, name, snapshot, now })` serialises the **live** scene as `SceneDocument` v1 compact JSON (`parseSceneDocument` round-trip), safe `scene-name-YYYY-MM-DD.json` (NFKD/diacritics stripped, length-bounded, fallback `pedalvision-scene`), downloaded via a Blob object URL revoked after 60s. Session-only backups use `session-backup` + `Unsaved scene` (never borrow a stored document's identity). Building/downloading writes nothing to the scene/index/settings. One download at a time (ref guard).
- **UI (`src/components/StorageNotice.tsx`, `src/App.tsx`, `src/index.css`):** inline "Margin Note" under the Title Block (desktop) / strip under the mobile top row; unavailable is persistent + `Not saving` + `Download backup`; low quota is border-only, dismissible for the session; mono receipt (filename after download; danger on serialisation/URL failure). Always-mounted hidden polite `role="status"` announcer; card is `role="note"` (not live); nothing autofocuses; CTA 44px with `aria-disabled`; low-quota dismiss returns focus to the scene plate. Zero new tokens. Read-only previews mount neither the notice nor the backup.
- **Tests:** 6 new `storageHealth` + 5 `sceneBackup` + 4 library health/write-failure tests (502 unit total); `e2e/storage-fallback.spec.ts` **8 tests × desktop + mobile** (blocked IDB, blocked localStorage with healthy IDB, mid-session put failure, estimate unavailable, hanging estimate, normal storage, low quota + dismiss, read-only share suppression) and a backup read-only assertion (localStorage + stored document unchanged). Existing scene/share/undo suites pass.
- **Checks:** lint / typecheck / test **502** / build / e2e **216 passed + 7 skipped**.
- **Performance (`performance-expert`, 2026-10-20):** verdict **watch**; hosting **$0**; backup measured ~0.39 MB worst case / <2 ms stringify+Blob. **Applied:** estimate runs concurrently with the IDB open and is time-boxed (a synthetic 300 ms/never-resolving probe no longer adds its full delay to boot); compact backup JSON (~35% smaller); re-click download guard; latched index failure (no per-autosave retry). **Deferred watch note:** the 90% ratio is effectively unreachable under modern per-origin quotas (the real trigger is a failed write); absolute headroom/usage thresholds and verified-delivery download semantics are not implemented (no fake confirmation beyond the browser download event).
- **Code review (light, HIGH-RISK ≤2):** pass 1 **changes-required** (index-only failure falsely said "Not saving" while docs still saved; design approval/status docs stale; missing blocked-localStorage and no-write assertions; session-only backup borrowed a stored id; dead transient states) → fixed (session-only for any unavailable boot/index failure; tests; `session-backup`/`Unsaved scene`; compact JSON; docs) → pass 2 (same session) **approve** (2 nits folded: re-read `sessionOnly` before arming autosave; e2e blocked-localStorage chain).
- **Deviations:** `docs/design.md` §Persistence now states blocked `localStorage` is session-only even with a working IDB (truthful "changes stay in this tab only"); low-quota remains advisory-only per the owner's approval.
