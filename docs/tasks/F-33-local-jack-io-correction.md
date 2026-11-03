# F-33 — Local jack/IO correction (“Patch Corrector”)

**Phase:** 1 (feature lane) · **Status:** implementation complete — PR #95 updated
(one PR, no merge) · **Model:** light but **high-risk** (scene/share codec).
**Owner revision 2026-11-02:** the correction is **canvas-first** — drag a jack pin
anywhere on the real pedal (free 2D face position, **not** edge-constrained; top-face
jacks included) — and the side-panel schematic/edge/slider were removed. The
override now stores normalized `{x, y}` instead of `edge/pos`; the share v3 schema
was redefined in place before its first release. See “Press Proof” below.
**Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k; task hard ≤1.1M; 6 h active.
**Branch/worktree:** `feat/f-33-local-jack-correction` off verified `main` `a217cba7` (F-38 merged, PR #94).

## Goal

Let a user correct the **physical jack/IO layout of a placed catalog pedal for this
scene only** — edge, position along the edge, connector kind, and TRS/mono — without
editing the catalog, and reset any correction back to the catalog. The corrected
layout drives cable anchors, cable lengths/schedule, continuity, canvas ticks,
export, and share; recipients see the same corrected scene read-only. This is the
roadmap's Phase 1 “local jack/IO correction” item and the “patch corrector” from
`docs/tasks/feature-roadmap-proposal.md` §5 — **jack/IO position marking only, not
cable-path editing** (cable paths are F-10).

F-33 depends on F-37 (merged #93): the scene document stays additive, and the
share payload must move from `v2` to a new `v3` because a new transported key is
added (F-37 §B). No catalog schema/data change is allowed or needed.

## Read first (context pack)

- `docs/progress.md` (catalog paused; feature lane open — **read-only in this task**)
- `docs/tasks/feature-template.md`, `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/tasks/F-37-persistence-versioning.md` → §A stored document, §B share wire,
  §C reserved next version, §D single-writer rule
- `docs/tasks/feature-roadmap-proposal.md` → Phase 1 / F-33 + §5
- `docs/requirements.md` → F7 (jack locations), F12 (cables), A4 (restore), A5 (share)
- `docs/design.md` → Data model (`Jack`, `PlacedItem`, fallback anchors, cable
  capacity), Persistence (v1 / share v2), P4 extension contract
- `docs/features/README.md` → F12, info panel, share, Known gaps, New object type checklist
- Code: `src/state/scene.ts`, `src/state/sceneDocument.ts`, `src/lib/shareLink.ts`,
  `src/lib/jackAnchor.ts`, `src/lib/partInfo.ts`, `src/lib/signalFlow.ts`,
  `src/lib/cableSummary.ts`, `src/canvas/PedalNode.tsx`, `src/canvas/CableLayer.tsx`,
  `src/canvas/exportStage.ts`, `src/components/InfoPanel.tsx`,
  `src/components/CustomPedalForm.tsx`, `src/state/library.ts`, `src/state/history.ts`,
  `src/lib/sceneBackup.ts`
- Tests: `src/lib/jackAnchor.test.ts`, `src/state/sceneDocument.test.ts`,
  `src/lib/shareLink.test.ts`, `src/state/library.test.ts`, `e2e/cables.spec.ts`,
  `e2e/info-panel.spec.ts`, `e2e/share.spec.ts`, `e2e/scenes.spec.ts`

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file,
  `docs/screenshots/F-33/**`, and only the editable inventory/workflow/impact/
  Known-gaps rows of `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, `docs/progress.md`, `docs/roadmap.md`, `docs/design.md`,
  `AGENTS.md`, templates or other shared/coordinator-only docs/config/deps.
  Catalog is **paused**. If a catalog schema change (e.g. stable `Jack.id`) is
  needed, **STOP** and schedule a coordinator task.
- Separate branch/worktree; `pnpm install --frozen-lockfile`; **one PR**; no merge.
- **Design gate REQUIRED** (visible info-panel/canvas correction UI): designer
  proposal **first** → owner approval of the direction → implementation → ≤2
  `design-reviewer` passes on desktop + mobile, dark + light → fold findings.
- **Code review:** ≤1 light pass; escalate to ≤2 (scene/share codec is high-risk);
  reuse the reviewer session for any re-check.
- **No new dependencies.**
- Do not update `docs/progress.md` / `docs/roadmap.md`; the owner/coordinator
  reconciles them (the local `progress.md` still says “start the next feature”
  and does not record F-38 merged).

## Audit — current jack resolution (source of truth before F-33)

| Stage | Current behaviour | F-33 impact |
|---|---|---|
| Catalog source | `CatalogPedal.jacks?: Jack[]`; `Jack = { kind, edge, pos?, stereo?, approximate? }`; catalog items may have no jacks | Read-only input; never edited |
| Custom source | `CustomPedal.jacks?: Jack[]`, edited by `CustomPedalForm` (shared by every placed copy) | Keep the existing editor; no per-item override (decision 1) |
| Item resolution | `resolveItemJacks(item, customPedals)` in `src/state/scene.ts:373` → catalog jacks → custom jacks → **fallback pair** (`in` left 0.5, `out` right 0.5) for a catalog pedal with no jacks; `resolveJackLayout` fills edge-only positions and marks `approximate` | Apply local overrides **after** base resolution; keep array length/index stable |
| Item identity | A cable references a jack by **decimal index** into the resolved array (`jackIndex`); jacks have no id | Overrides must **not add/remove** jacks or indices drift and cables silently move |
| Anchors | `src/lib/jackAnchor.ts` `buildAnchorIndex` / `anchorIndexFor`; edge+pos → local point → item rotation → board transform | Reads effective jacks; overrides re-anchor cables with no cable mutation |
| Cables | `CableLayer` draws from anchor index; `addCable`, `cableEndExists`, `cableEndRole`, `cableEndHasCapacity`, `pruneCableGraph` use `resolveItemJacks` | Effective kind/edge/pos/capacity feed all of these |
| Info panel | `InfoPanel` → `resolveItemJacks` + `usesFallbackJacks` → `buildPartInfo` → read-only `formatJack` rows | Rows become the correction entry point; show assumed/approximate/corrected |
| Continuity / schedule | `signalFlow.ts` uses item-level `usesFallbackJacks` + `jack.approximate`; `cableSummary` uses anchor `assumed`/`approximate` | Must become **per-jack** so a corrected fallback jack is not reported assumed |
| Export | `exportStage.ts` re-derives anchors and draws an “assumed or approximate” caption when an included cable uses one | Corrected anchors must be excluded from that note; caption needs the “locally corrected” wording |
| Persistence | `SceneDocument` items are stored as-is; `isPlacedItem` validates core fields only; `createSceneDocument` is the only writer | Add optional `jackOverrides` to `PlacedItem`, guard, normalize |
| Share | `#s=v2:`; strict frozen v1/v2 schemas; v3 reserved for the first new transported field | **Bump to v3** with `jackOverrides` on items; v1/v2 still decode |
| History | Snapshot over `SceneSnapshot`; `items` is one key (compile-exhaustive map) | No new key; commit one override edit = one step |
| Backup | `buildSceneBackup` → `createSceneDocument` | Inherits the codec; assert the field in the JSON |
| Capacity | items/boards/images/graph budgets; overrides add no object | No cap change; measure share size growth |

**Important limitation (recorded, not fixed):** jacks have no stable id, so both
cables and overrides use the decimal index. A future catalog batch that reorders a
pedal’s `jacks` array can drift both. A stable catalog `Jack.id` is a
coordinator/catalog task; F-33 must not add one.

## Proposed override model

### Data shape (scene-local, never a catalog edit)

Add one optional field to `PlacedItem`:

```ts
interface JackOverride {
  /** Decimal index into the item's BASE resolved jacks array (catalog jacks or the fallback pair). */
  jack: number;
  /** Any changed property; absent = keep the base value. */
  kind?: JackKind;
  edge?: JackEdge;
  pos?: number;      // 0..1, clamped
  stereo?: boolean;
}

interface PlacedItem {
  // existing fields…
  /** Scene-local jack/IO corrections; never written to the catalog or a custom definition. */
  jackOverrides?: JackOverride[];
}
```

- **Index-stable by construction:** an override changes only properties of an
  existing base jack; it **never adds, removes or reorders** jacks. Therefore every
  cable’s `jack` index remains valid and the cable follows the corrected anchor.
- **Base + overlay:** new helper `baseItemJacks(item, customPedals)` = today’s
  resolution (catalog/custom/fallback + `resolveJackLayout`); `resolveItemJacks`
  applies overlays and returns effective `ResolvedJack[]`. Effective jacks carry
  per-jack provenance flags for UI/captions: `assumed` (base fallback, not
  overridden), `approximate` (base edge-only, not overridden), `corrected`
  (overridden), keeping `pos` always defined.
- **Only differences are stored** (an override with all base values is dropped by
  normalization), so a reset simply removes the entry.
- **Reset** removes one override (per jack) or the whole field (per item). Reset
  restores the catalog/custom/fallback values exactly.
- **Duplication** copies `jackOverrides` with the item (per placed instance).
- **Custom pedals** keep their existing `CustomPedalForm` jack editor; F-33 does
  not add per-instance overrides for them (two sources of truth would be ambiguous
  because custom jacks are shared by all copies). A `PlacedItem` whose `refId`
  resolves to a custom pedal ignores/drops `jackOverrides` on load.
- **Unknown refs** have no base jacks, so their overrides are ignored for now.
  Structural entries are **kept** on load (bounded) rather than dropped, so a
  catalog/planner batch that later resolves the ref can still apply the user's
  correction; `applyJackOverrides` ignores them until then. Custom-pedal
  overrides are dropped outright (the shared editor owns those jacks).
- **No add/remove** in F-33. Adding/removing connectors is a future jack-map /
  catalog-contribution feature (F-39) because it needs index remapping and cable
  migration.

### Scope of overridable jacks (proposed, owner confirms)

- **Movement (`edge`, `pos`) and `stereo`** on **every** catalog jack kind:
  `in`, `out`, `send`, `return`, `exp`, `exp-in`, `exp-out`, `midi`, `ctrl`,
  `power`. This matches “correct the real panel”, including PWR/EXP and the
  connectors SEND/RETURN/MIDI/CTRL.
- **Kind correction** is allowed too, but is guarded by cables (below).
- On canvas, only `in/out/send/return` are connectable ticks today. Corrected
  PWR/EXP/MIDI/CTRL positions are shown in the info panel; the design proposal
  decides whether a corrected non-cable marker should also appear on the canvas
  (muted, non-connectable). No new connectable kinds.

## Cable behaviour when a jack moves / changes kind

- **Move (edge/pos):** no cable mutation. `anchorIndexFor` re-derives the anchor
  from the effective jack, so incident cables, lengths, schedule, continuity and
  export follow immediately. The cable is still the same jack index.
- **Stereo/TRS change:** if switching TRS → mono would leave **two** cables on the
  socket, refuse the edit inline with a reason; otherwise re-evaluate capacity.
- **Kind change / reset that changes kind:** re-evaluate every incident cable with
  the existing `normalizeCableDirection` + `cableEndHasCapacity` rules. If the
  change would make any attached cable invalid (e.g. source↔source, sink↔sink, or
  over-capacity), **refuse the edit inline** and leave the scene untouched. If all
  cables remain valid, normalize their direction and keep them (a cable may flip
  from/to, but never disappears silently).
- **Removal:** not supported in F-33. “Reset” restores the catalog jack and goes
  through the same guard; a reset that would invalidate a cable is refused inline.
- Read-only shares: no mutators run (existing no-op guards); the corrected state is
  rendered and can be saved as a copy.

## UI/state plan (design gate; no visual implementation before approval)

- Entry point: the existing **Jacks** section in `InfoPanel` (desktop rail and
  mobile expanded sheet). Read-only rows stay read-only; edit mode is only in the
  editable scene.
- Per-jack row: current summary (`kind · edge · pos · TRS`) with an
  **assumed / approximate / corrected** marker. A “Correct”/edit affordance opens
  the row editor (kind select, edge segmented control, position slider, TRS
  toggle, “Reset to catalog”).
- Per-item header: “Reset all jacks” when any override exists.
- Keyboard: every control is a native button/select/range with visible focus;
  slider commits on release/blur so one correction = one undo step. Escape closes
  the row editor and returns focus. Touch targets ≥44 px on mobile.
- Feedback: inline refusal reason next to the affected row (no toast, N8); an
  undo-able correction is reflected immediately on the canvas and in the info row.
- Read-only shares: no edit controls; show the corrected marker/caption only.
- Canvas: corrected audio jacks render as a solid ring + dot (not the hollow
  fallback/approximate diamond); the info panel carries the full provenance. Any
  corrected non-cable marker is the designer’s call.

## Codec / share / export / history / capacity wiring

### Stored document (additive v1 — no document bump)

- Add optional `jackOverrides` to `PlacedItem`; `SceneSnapshot`/`SceneDocument`
  shape is unchanged (items carry the nested field).
- `isPlacedItem` bounds the optional array; `normalizeSceneContent` (and
  `parseSceneDocument`) normalizes each item’s overrides against its **base**
  jacks and drops: non-integer / out-of-range indices, duplicate indices (first
  wins), invalid enums/values, entries equal to the base jack, and custom-pedal
  overrides. Unknown-ref entries are kept (bounded) for a later catalog/planner
  load. Empty arrays are removed. No catalog lookup is invented.
- `createSceneDocument` and `applyScene` keep passing items whole (single writer);
  `library.ts`/autosave/backup inherit it. `history.ts` needs no new key.
- A **newer document is still preserved**, not deleted (F-37 contract).

### Share wire (bump to v3)

- `SHARE_VERSION = 3`; `SUPPORTED_SHARE_VERSIONS = [1, 2, 3]`.
- **v1/v2 schemas stay frozen** (v2 items have no `jackOverrides`). Add a **v3
  item schema** with optional `jackOverrides` (bounded: array ≤64, unique integer
  index, valid `JACK_KINDS`/`JACK_EDGES`, finite `0..1` pos, boolean stereo, at
  least one changed property) and a strict v3 payload schema.
- `migrateSharePayload`: v1 → v2 (graph empty) → v3 (no overrides); v2 → v3;
  v3 identity. Prefix ↔ payload version agreement stays mandatory. Encoder emits
  `v3`; an old client rejects v3 cleanly (no partial decode).
- `encodeShareLink` self-validates against the v3 schema (existing F-37 boundary).
- `decodeShareHash` accepts v1/v2/v3 and normalizes through the same
  `normalizeSceneContent`.

### Export

- `exportStage` already re-derives anchors via `buildAnchorIndex`, so corrected
  curves/bounds follow automatically. Update the honesty note to include
  **locally corrected** positions and only show it when an included cable uses an
  assumed, approximate or corrected jack. Selected-board + all-content scopes and
  the 4 cm / 16.7 MP / 8192 px clamps are unchanged.

### History / backup / capacity

- History: `items` snapshots carry overrides; one committed edit = one step;
  read-only no-ops.
- Backup: inherits `createSceneDocument`; assert `jackOverrides` in the JSON.
- Capacity: no new object; graph/item budgets unchanged. Measure the share-size
  delta at a worst-case fixture and keep it under the 200 KB / 32,000-char caps.

## Is this a “new object type” checklist path?

**No new scene array/object type** — the override is a nested optional field on
`PlacedItem`, so the P4 “new object type” checklist does **not** apply wholesale.
The relevant checklist items are still required: **codec/guards**, **persistence**
(`applyScene`/`saveActive`/autosave/legacy/preview/copy), **history**, **backup**,
**share**, **export**, **UI/read-only**, and **tests/docs**. Capacity needs no new
counter. The every-snapshot-key round-trip test stays green because `items` still
carries the field; add an item-level round-trip assertion for `jackOverrides`.

## Owner decisions (recorded 2026-10-31)

1. **Override scope:** placed **catalog** pedals/supplies only; custom pedals keep
   their existing shared jack editor; a duplicate copies the override.
2. **Overridable kinds:** **all** catalog jack kinds for edge/pos/stereo, plus
   cable-guarded kind changes.
3. **Cable outcome:** **refuse the edit inline** when a kind/TRS/reset change would
   invalidate an attached cable; moves never drop a cable. No silent loss.
4. **Reset semantics:** per jack **and** “Reset all jacks” on the item; each is one
   undo step.
5. **Share version:** **always emit v3**; decoder accepts v1/v2/v3; stored document
   stays **additive v1**. Old clients reject v3 cleanly.

## Steps

1. Record owner decisions here; run the **designer** proposal and get owner
   approval of the direction before any UI.
2. Implement the model + base/overlay resolution + store mutators and guards.
3. Wire codec/document normalization, share v3 + migration, history/backup,
   export caption, info panel/canvas UI, read-only path.
4. Add unit tests (resolution, guards, codec, share v1/v2/v3, duplicate/reset,
   cable guard, read-only) and E2E (desktop + mobile).
5. Run the design-reviewer loop (≤2 passes, desktop + mobile, dark + light) and
   fold findings.
6. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
7. Record performance numbers, update `docs/features/README.md` rows/Known gaps,
   open exactly one PR with before/after screenshots, the feature demo link
   (`?share=1#s=v3:…` with a corrected jack), and the review digest. Do not merge.

## Acceptance (executable)

- [ ] Correcting an existing catalog jack’s **edge/position** moves its canvas
      anchor and every incident cable immediately, without changing the cable’s
      stored jack index (`src/lib/jackAnchor.test.ts`, `e2e/cables.spec.ts`).
- [ ] An override is **scene-local**: the catalog/custom definition is never
      mutated; a second placed copy of the same pedal is unaffected
      (`src/state/scene.test.ts`).
- [ ] **Duplicate** copies the override; **reset per jack** restores that jack;
      **reset all** restores every jack; both are one undo step
      (`src/state/scene.test.ts`, `src/state/history.test.ts`).
- [ ] Assumed / approximate / corrected are **per jack**: a corrected fallback jack
      is solid and not reported assumed; the uncorrected fallback jack stays
      hollow/assumed. Continuity/schedule/export use the same flags
      (`src/lib/signalFlow.test.ts`, `src/lib/cableSummary.test.ts`,
      `src/canvas/exportStage` test, `src/lib/partInfo.test.ts`).
- [ ] A kind/TRS/reset edit that would invalidate an attached cable is **refused
      inline** and leaves the scene/cables unchanged; a valid change keeps every
      cable and re-normalizes direction (`src/state/scene.test.ts`).
- [ ] Document codec: an additive-v1 document may contain `jackOverrides`; invalid
      entries are dropped without blanking the document; a document without the
      field still loads; a newer document is preserved
      (`src/state/sceneDocument.test.ts`, `src/state/library.test.ts`).
- [ ] Backup JSON contains `jackOverrides`; `applyScene`/autosave/preview/save-copy
      preserve them (`src/lib/sceneBackup.test.ts`, `src/state/library.test.ts`).
- [ ] Share: encoder emits `v3`; decode accepts v1/v2/v3 with migration; prefix ↔
      payload mismatch is rejected; v1/v2 have no overrides; a v3 round-trip
      preserves them; an old build rejects v3 cleanly with `unsupported-version`
      (`src/lib/shareLink.test.ts`).
- [ ] Read-only share renders corrected jacks and has no edit mutators; “Save a
      copy” preserves overrides (`e2e/share.spec.ts`).
- [ ] Export selected-board and all-content keeps corrected cables in bounds; the
      honesty caption mentions assumed/approximate/locally corrected only when
      relevant (`e2e/export.spec.ts`, `src/lib/exportScene.test.ts`).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green
      (baseline at F-38 merge: 977 unit tests, 354 E2E passed + 11 skipped, JS
      337.54 kB gzip).
- [ ] Design gate: designer direction owner-approved; ≤2 `design-reviewer` passes
      on desktop + mobile, dark + light; findings folded.
- [ ] Performance recorded: bundle delta, picker/canvas frame time, memory,
      share/export size vs thresholds; no regression.
- [ ] `docs/features/README.md` updated (F-12 / info panel / share rows + Known
      gaps); no catalog/shared-doc edits.
- [ ] One PR; **do not merge**. Feature demo link: deployed PR-preview URL +
      a read-only `?share=1#s=v3:…` link with a corrected jack; before/after
      screenshots on base `main` vs the PR preview, desktop + mobile, dark + light.

## Performance plan

- Fixture: max graph (10 boards, 400 items, 200 cables, 100 endpoints, 100 custom
  definitions) plus overrides on the busiest multi-jack pedals (e.g. 8 jacks each).
- Measure: document JSON bytes and `parseSceneDocument` + normalize wall time;
  share `encodeShareLink` decoded/compressed bytes and hash length; max-graph
  decode time; peak heap; picker open and canvas frame time with the correction
  panel open/closed; PNG/PDF export bytes.
- Compare to F-37 (document 98.9 KB / share 13,808 chars at max fixture) and the
  F-38 baseline. Thresholds: no new runtime deps; share stays under 200 KB decoded
  / 32,000 chars; no measurable canvas regression (target 60 fps class); report
  numbers in the task file and PR.

## Press Proof (owner revision, 2026-11-02)

- **Direction:** **“Press Proof”** supersedes the panel-schematic “Proof Marks”
execution. The real pedal is the proof sheet: `Correct` enters a mode where every
effective jack (including PWR/EXP/MIDI/CTRL) becomes a screen-constant pin on the
item; drag it anywhere inside the footprint (free normalized x/y), with live cable
re-anchoring and routing (interior radial normal + chord guard). Release commits one
override; Esc/pointercancel cancels. The panel is a proof ledger: rows, provenance,
kind/TRS, position readout, per-jack reset, reset-all. Mobile hides the sheet and uses
a fixed Proof Bar + inspector. Auto-frames the pedal only when its screen long edge is
below 240/200 px; never restores the camera on exit.
- **Model change:** `JackOverride = { jack, x?, y?, kind?, stereo? }` (x/y pair,
  0..1 face position); `edge/pos` are derived for display/cable compatibility.
  `normalizedToWorld`/`worldToNormalized` are shared by the drag hook, canvas layer
  and cable overlay; interior anchors use a radial normal with a chord tangent guard.
- **Code:** `lib/jackProof.ts`, `state/jackProof.ts`, `canvas/useJackProofDrag.ts`,
  `canvas/JackProofLayer.tsx`, `components/ProofBar.tsx`; reworked
  `JackCorrections`, `InfoPanel`, `PedalNode`, `Stage`, `SelectionLayer`,
  `CableLayer`, `cablePath`, `sceneDocument`, `shareLink`.
- **Design review:** pass 1 `approve-with-changes`; fixes folded (readout, ledger
  visibility, mobile action bars/Done hierarchy); confirmation `approve-with-changes`
  with no merge blockers; final chip/ledger fixes applied and re-shot. No further
  round.
- **Code review:** new pass `changes-required` — blocker (proof mode could outlive
  its item/scene on mobile), should-fix (live cables not rendering during drag;
  rotated-frame test/duplication) + nits. Fixed; confirmation **approve**.
- **Register polish (owner-approved 2026-11-02):** registration ticks (not resize
  brackets), 20/22/24 px socket pins with hit circles + hover/nearest + grab
  cursors, one hover/drag tag outside the pedal AABB, dimmed non-held pins,
  duplicate-kind ordinals, solid Done, proof legend, notice under the selected
  row, mobile prev/next stepper + jack list + bar notice, inspector refit.
  **Design-review:** round 1 `approve-with-changes`, round 2 `approve-with-changes`
  with no merge blocker; final fixes folded (inspector refit, mobile notice, full
  jack names). **Code-review:** Register delta `changes-required` → fixed →
  **approve** (refit loop, units in tag, cancel hover, fallback).
- **Exit flow (owner follow-up, 2026-11-02):** only the pin hit circles listen in
  proof mode; a press anywhere else (pedal body, another pedal, board, empty
  canvas, cable/endpoint) exits proof and **continues the same gesture** (drag/
  select/pan). The exiting empty-canvas press is non-destructive (selection kept).
  Implemented as one capture-phase rule in `useJackProofDrag` using Konva
  `getIntersection` against the `jack-proof-pin` name; `PedalNode` no longer
  swallows the body press. Verified desktop + touch; code review **approve**.

## Design gate (recorded)

- **Direction approved by the owner:** **“Proof Marks”** (inline accordion in the
  existing Jacks section, per-jack Assumed/Approx/Corrected markers, in-panel
  schematic, per-jack reset + two-step Reset all, no new tokens), approved
  2026-10-31.
- Owner also approved **non-cable corrections stay info-panel/share-only** and
  **panel-live / canvas-on-release** slider feedback.
- **`design-reviewer` pass 1** (desktop + mobile, dark + light):
  `approve-with-changes` — mobile schematic ate the sheet; schematic contrast;
  reset affordance; weak Done state; missing assumed/canvas evidence. Folded.
- **`design-reviewer` pass 2** (same session, new pixels): `approve-with-changes`
  — direction approved, no further design rounds. Remaining: mobile schematic
  strip is under-scaled and the third row/both resets still need a short scroll
  (recorded as a known gap; **hard ≤2 cap reached, no pass 3**). Evidence crop was
  regenerated with patch ticks visible (`after-canvas-assumed-desktop-{dark,light}.png`).
- **Code review (light, high-risk):** pass 1 `changes-required` — 3 should-fix
  (unrelated cables blocking every correction, missing propagation/undo/save-copy
  tests, unknown-ref contract mismatch) + 2 nits (duplicate v3 indices, a bad
  override dropping the whole item). All fixed; pass 2 **approve** (3 nits folded:
  stale comment, dead flags/helper, soundness of the item predicate). Same
  reviewer session reused; no third pass.

## Measured results (2026-10-31)

- **Build:** `dist` JS **346.12 kB gzip** vs F-38 baseline **337.54 kB gzip**
  (**+8.58 kB**, +2.54%); CSS **16.25 kB gzip**. No new dependency.
- **Unit:** **1002 tests** (baseline 977; +25), all green.
- **E2E:** full suite **369 passed + 12 skipped**; the touched `info-panel-jack-cables`,
  `info-panel` and `picker-choka` runs are green (13 passed + 1 skipped in the
  final proof run).
- **Share size** (v3 x/y payload): 10 corrected parts = **2,250 B decoded / 286 B
  compressed / 388 chars**; 400 parts × 8 overrides = **140,960 B / 3,773 B /
  5,037 chars** — under the 200 KB decoded and 32,000-char caps. Demo link: 412
  chars.
- **Canvas:** 60 fps class with the correction editor open (avg 16.667 ms, p95
  16.8 ms over 90 rAF frames); heap **34.40 → 34.69 MB** (+0.29 MB) with the
  editor open. No threshold regression.
- **Screenshots:** `docs/screenshots/F-33/` — before/after desktop + mobile,
  dark + light; assumed-marker evidence; zoomed canvas solid-vs-hollow crops.

## Risks / known gaps

- **Index-based identity.** Overrides (like cables) use a decimal jack index; a
  future catalog jack reorder can drift both. A stable `Jack.id` is a catalog
  coordinator task, not F-33.
- **Overrides on an approximate jack are user assertions, not manufacturer data.**
  The info panel/export caption must keep disclosing corrected positions; never
  present them as verified.
- **No add/remove.** A pedal missing a connector cannot be fully corrected in
  F-33; that needs the future jack-map/contribution feature and index remapping.
- **Non-cable jacks** (PWR/EXP/MIDI/CTRL) are not connectable and currently have no
  canvas tick; the design direction decides whether to render a muted corrected
  marker.
- **Share v3 means older clients reject a corrected link.** Expected and clean
  (F-37 policy); uncorrected scenes still encode as v3 because the encoder always
  writes the current version. If the owner wants v2 for override-free scenes, that
  is a deliberate additional policy and must be decided before implementation.

## Notes

- Do not update `docs/progress.md` / `docs/roadmap.md`; the owner/coordinator
  reconciles F-38 → F-33 status. This task records the F-38 merge baseline
  (`a217cba7`, PR #94) locally.
- Record billed tokens by class (builder / design / review) in the PR/session
  summary.
- One PR only; no merge.
