# P3-03: Share links (versioned codec + read-only recipient + save a copy)

**Phase:** P3 · **Status:** todo — scheduled next · **Model:** build-strong

## Goal

A user can turn the active scene into a self-contained URL (`#s=v1:…`) that a recipient opens **read-only**, with the same boards, items, rotations, z-order and inline custom pedals (A5). The recipient can pan/zoom/inspect/export and choose **Save a copy**, which creates a **new** named scene without ever overwriting their own active scene; at the 10-scene cap it shows an inline reason instead. Malformed, truncated, oversize or unsupported links show a clear inline error and leave the recipient's data untouched. Unknown `refId`s keep their geometry and render a labeled placeholder; over-cap shared scenes still load (warned via P3-06 `capacityStatus`, never rejected).

## Read first (context pack)

- `docs/design.md` → §Persistence (share format, versioning, ~200 KB cap), §Data model (`Scene`, `CustomPedal`, `Cable`/`Endpoint`), §Capacity budgets, §Canvas architecture (export/read-only implications), §Security
- `docs/requirements.md` → **F10**, **A5**, read-only/accessibility requirements; skim **S1/R6**
- `docs/roadmap.md` → P3-03 + the P3-04/P3-05/P4-01 boundaries
- `src/state/sceneDocument.ts`, `src/state/scene.ts`, `src/state/library.ts`, `src/lib/capacity.ts`
- `src/App.tsx`, `src/canvas/Stage.tsx`, `src/canvas/BoardNode.tsx`, `src/canvas/PedalNode.tsx`, `src/canvas/useItemDrag.ts`
- `src/state/readOnly.ts` (created here) and `src/main.tsx`
- `docs/tasks/P3-06-capacity-budgets.md` (cap/benchmark interplay)
- `docs/progress.md` → Deps note (`fflate` pre-authorization)

## Constraints

- **Do not** build P3-04 (undo/redo), P3-05 (storage-failure fallback) or P4 (cables). P3-03 runs before them.
- **cm is the source of truth**; never rescale geometry. Persist/encode only scene data, never transient UI state.
- **fflate** is the only new dependency. It is pre-authorized by `docs/tasks/P0-01-repo-scaffold.md` + `docs/progress.md` → Deps note, and is the dependency named in `docs/design.md` §Persistence. Note it in the PR and this task. No other dependency.
- Share format: `scene → JSON → deflate → base64url → location.hash (#s=v1:…)`. Validate the **untrusted** payload with zod **before** applying it to the store.
- **Caps:** reject decoded JSON over ~200 KB and cap the compressed/base64 input; inflate with a bounded output (no link bombs). Encode must refuse an over-ceiling scene with an inline reason, not silently truncate. A scene at the item/board/image hard caps must stay under the ceiling.
- **Never reject or trim a scene because it is over a capacity hard cap** (A4/A5): load it read-only and warn with the existing `capacityStatus`.
- **Never overwrite the recipient's active scene.** Preview content may live in the global scene store, but autosave must be suspended while previewing; exiting restores the recipient's snapshot/document.
- Unknown `refId`s are preserved (existing catalog → custom → fallback resolution) and render a labeled placeholder; never fail the whole scene.
- Soft warnings/errors are **inline**, never toasts (N8).
- Tokens only for colors/spacing/type; no hardcoded hex. No canvas/export regressions (shared scenes must export normally).
- Design-affecting: run the `designer` **before any UI**, get **owner approval**, then render desktop + mobile in dark + light and run `design-reviewer` (hard cap ≤2 passes).
- Code review is HIGH-RISK (serialization/security/untrusted input): light model (`opencode-go/deepseek-v4.1-flash`), ≤2 passes, reuse the same reviewer session for pass 2.

## Steps

1. **Reconcile P3-06 first** (docs-only, in this branch/PR): move it to Done in `progress.md`/`roadmap.md`, set the task status, advance Next to P3-03.
2. **Design gate.** `designer` proposes the share affordance, the read-only recipient view and the `Save a copy`/inline-state model (desktop + mobile, dark + light). **STOP for owner approval before writing UI.** Then implement, freeze, capture the four renders and run `design-reviewer` (≤2 passes).
3. **Codec (`src/lib/shareLink.ts`):**
   - `#s=v1:` prefix; `SharePayload = { version: 1, name, boards, items, customPedals }`.
   - `encodeShareLink(name, snapshot)` → `{ ok: true, hash, url?, decodedBytes, compressedBytes }` or `{ ok: false, reason: "too-large", ... }`.
   - `decodeShareHash(hash)` → `{ ok: true, name, snapshot }` or a typed inline-safe error (`invalid`, `unsupported-version`, `too-large`, `corrupt`). Never throws.
   - Zod schema for boards/items/custom pedals with bounded strings/numbers, known enums/textures, jack edge/kind/pos, power shape; strip unknown fields. Then normalize: drop orphan items, dense `z`, prune unreferenced custom definitions, de-duplicate uids/refs.
   - Base64url encode/decode (`-`/`_`, no padding) without a new dependency. Bounded inflate.
4. **Read-only state (`src/state/readOnly.ts`)** + store guards in `src/state/scene.ts`: every mutator is a no-op/`null` while read-only. Disable drag/transformers/keyboard shortcuts/action bars/picker/scene register/first-run hint; keep pan/zoom, theme, info panel and Export working.
5. **Library preview (`src/state/library.ts`):**
   - `enterPreview(snapshot, name)`: flush + cancel autosave, capture the recipient snapshot, apply the shared content, set read-only, clear selection.
   - `savePreviewAsCopy(name?)`: respect `MAX_SCENES` (inline reason), write a **new** document, update the index/settings, make it active, resume autosave; never write the preview into the active document.
   - `exitPreview()`: restore the recipient snapshot/document; clear read-only and the hash.
6. **Share orchestration (`src/state/share.ts` + `src/main.tsx`):** decode after persistence boot and before first render; store `preview`/`error` state; dismiss clears the hash via `history.replaceState`. Normal-mode link generation + copy (clipboard failure falls back to a selectable field). Clear the hash after save/exit; never mutate the sender's URL.
7. **UI (after approval):** share trigger/panel (inline link, copy, size/error), recipient read-only banner (scene name, capacity warning when applicable, `Save a copy`, exit), inline scene-limit/storage reasons. Desktop + mobile; tokens only; accessible labels/focus.
8. **Docs:** update `docs/design.md` §Persistence/§Security/§Testing with the final constants/behaviour; update `progress.md`, `roadmap.md` and this file (in review, not done).
9. **Tests:** see acceptance. Then run the full checks + the HIGH-RISK light code-review loop.
10. **One PR** to the full standard (Summary, Changes, Testing, screenshots embedded at the commit SHA with captions, ≤3 owner review hints, review-round digest). **Do not merge.**

## Acceptance (executable)

- `pnpm lint` → 0 errors.
- `pnpm typecheck` → 0 errors.
- `pnpm test` → all green, including `src/lib/shareLink.test.ts`:
  - codec round-trip (rotated/custom boards, attached/loose/rotated items, z-order, inline custom pedals with jacks/power);
  - accepts `#s=v1:` and rejects a missing prefix, `#s=v2:` and garbage;
  - malformed base64url, truncated compressed bytes, invalid JSON and schema failures all return a typed error (never throw);
  - oversize decoded payload and oversize compressed/hash input are rejected;
  - unknown `refId` survives decode and resolves to the labeled fallback (scene still renders);
  - an over-cap snapshot (e.g. 11 boards / 401 items) decodes and `capacityStatus` reports `over`;
  - a representative max scene (400 items + 10 boards + 100 custom parts) encodes under the ~200 KB decoded ceiling;
  - base64url output uses only `A–Z a–z 0–9 - _` with no `=` padding.
- Library/read-only unit tests: preview does not autosave into the active document; `savePreviewAsCopy` creates a new document; `MAX_SCENES` refusal; `exitPreview` restores; scene mutators are no-ops in read-only.
- `pnpm build` → succeeds.
- `pnpm e2e` → all green (desktop + `mobile-chromium`), including `e2e/share.spec.ts`:
  - generate a share link from a scene with a board + pedal + inline custom pedal; open it in a recipient context → read-only banner, identical `data-*` geometry/rotation/order;
  - editing affordances are absent and dragging/rotating does not change the scene;
  - `Save a copy` creates a second scene; the recipient's original scene is unchanged after switching/reload;
  - with 10 scenes, `Save a copy` shows the inline limit reason and creates nothing;
  - an over-cap shared scene (11 boards) loads read-only with the capacity warning;
  - an unknown ref renders a labeled placeholder without an error state;
  - desktop + mobile both cover open → save copy.
- `docs/progress.md`, `docs/roadmap.md` and this file say **in review — PR #N** (not done) until the owner merges.

## Notes

- `fflate` justification: pre-authorized in P0-01 + the progress Deps note, named by `design.md`, tiny/stable with no transitive deps; used sync (`deflateSync`/bounded inflate) so the codec stays deterministic and testable in Node.
- Read-only shares reuse the existing catalog → `customPedals` → fallback resolution; the placeholder label is the `refId`, at the item's true cm footprint.
- P4 cables/endpoints are deliberately not encoded yet. The version-1 payload is additive, matching `SceneDocument`'s versioning model; P4 extends it rather than creating a new share version.
- The ~200 KB cap is on decoded JSON; compressed/hash caps plus streamed inflation with a 200 KB output cutoff protect memory and main-thread time. A scene at the item/board/image caps is well under it; many custom pedals are the realistic path to the ceiling and get an inline refusal from the sender.

## Implementation (2026-10-20)

- **Design gate:** the `designer` proposed **"Transmittal"** (owner-approved before any UI, 2026-10-20): toolbar Share beside Export; a non-modal Share panel with a selectable link, size meta, Copy CTA and inline copied/denied/too-large/empty states; a read-only **REVIEW COPY** stamp (desktop top-left / mobile below the toolbar), `Save a copy` + `My scenes`, capacity warning only at hard/over, and an inline invalid-link card. Selection + info panel + Export + theme remain available read-only; picker/Add/scene register/first-run/action bars/drag/transformers/shortcuts are removed. `design-reviewer` reviewed the 10 rendered screenshots (desktop+mobile, dark+light, over-cap, error) and **approved** (1 nit: 11px meta readability — folded by bumping the panel meta to 12px/`ink-eyebrow`).
- **Dependency:** `fflate@0.8.3` (pre-authorized in P0-01 + `progress.md` → Deps note; named in design.md). Zero transitive deps; used sync for deterministic codec tests.
- **Codec:** `src/lib/shareLink.ts` — `#s=v1:` + `deflate → base64url`; zod schema for boards/items/custom pedals; unknown refs preserved; duplicate uids de-duped; `normalizeSceneContent` (orphan items/dense z/prune custom defs); 200 KB decoded cap, 256 KB compressed cap, streamed inflation with a 200 KB output cutoff that aborts early; typed `invalid`/`unsupported-version`/`corrupt`/`too-large` errors; encode refuses over-ceiling scenes. A max-cap fixture (400 items / 10 boards / 100 custom parts) encodes well under 200 KB.
- **Read-only:** `src/state/readOnly.ts` + guards on every scene mutator; drag/transformers/shortcuts/action bars/picker/scene register/first-run removed from the chrome; pan/zoom/selection/info/export/theme kept.
- **Library:** `enterPreview` flushes + suspends autosave and captures the recipient snapshot; `savePreviewAsCopy` writes a **new** document (respects `MAX_SCENES`, inline refusal) and resumes autosave; `exitPreview` restores the recipient document. Original document verified untouched by unit + e2e.
- **Share orchestration:** `src/state/share.ts` + `main.tsx` decode after persistence boot; share state/error; link builder; hash cleared on save/exit/dismiss. Sender's address bar is never mutated.
- **UI:** `SharePanel.tsx` (sender) + `ShareView.tsx` (stamp, actions, saved notice, error card); `LinkIcon`/`CopyIcon`/`LockIcon`; tokens-only CSS; desktop dock / mobile tray + fixed bottom action bar.
- **Tests:** 10 codec unit tests + 4 library preview/save/exit/cap tests + 2 read-only guard tests; `e2e/share.spec.ts` (5 tests × desktop + mobile): generate → open read-only → identical geometry, edit attempts blocked, save a copy, recipient scene intact + reload; over-cap share loads with the capacity warning; unknown ref preserves geometry + labeled fallback; 10-scene cap inline reason; damaged link inline error + dismiss.
- **Checks:** lint / typecheck / test **459** / build / e2e **174 passed + 7 skipped**.
