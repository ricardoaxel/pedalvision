# P2-05: Custom board creator

**Phase:** P2 · **Status:** in review (PR pending) · **Model:** build-cheap

## Goal
Let a user create a **custom pedalboard** of any **width × depth** (entered in
cm or inches — display toggle only, storage stays cm) with a surface
**texture/finish**, then place it on the canvas and move / rotate / delete it
**exactly like a catalog board**. This is the board analogue of the P2-02 custom
pedal creator (F7): where a custom pedal renders as a labeled rectangle, a custom
board renders at its true cm footprint with the chosen texture (no catalog
image), via the existing `BoardNode` fallback path extended with the texture
treatment the **designer** specifies. The creator also supports **editing** an
existing custom board in place (mirror P2-02's edit follow-up).

`PlacedBoard` already reserves `customSize?: { widthCm, heightCm }`
(design.md §Data model); today boards are place-only from the catalog picker. A
custom board has `boardRefId: null` and carries its own inline definition.

## Read first (context pack)
- `docs/roadmap.md` P2-05; `docs/phase-guide.md` P2 row; `docs/tasks/README.md`
- `docs/requirements.md` F3, F5 (layering), F11 (responsive), N10 (no tiered/riser boards in v1)
- `docs/design.md` §Data model (`PlacedBoard` + `customSize`; `BoardDefinition`/`boardFootprint`), §Folder structure (`src/assets/` — board textures), §Canvas architecture (per-board Group; boards stack by array order), §Responsive approach, §Persistence
- `docs/decisions/005-design-governance.md` (design gate) + `006` (code review)
- Precedent: `docs/tasks/P2-02-custom-pedal-creator.md` (creator + edit + persistence hardening)
- `src/state/scene.ts` (`PlacedBoard`, `boardFootprint`, `boardDefinition`, `addBoard`/`moveBoard`/`rotateBoard`/`removeBoard`; the `customPedals` slice pattern), `src/state/persist.ts` (structural guards + orphan pruning)
- `src/components/Picker.tsx` (Boards tab + the "Datasheet" creator surface), `src/components/CustomPedalForm.tsx`
- `src/canvas/BoardNode.tsx` (draft-silhouette fallback), `src/canvas/BoardLayer.tsx` (rotate-only Transformer), `src/canvas/ItemActionBar.tsx` (selection chrome pattern)
- `src/lib/customPedal.ts` (parse/format/validate + cm/in toggle precedent), `src/lib/geometry.ts` (`cmToDisplay`/`displayToCm`/`centerOffset`/`placeItem`)
- `src/styles/tokens.css` + `src/styles/theme.ts` (tokens only; canvas mirror)

## Constraints
- **cm is the source of truth.** Width/depth are stored in cm; the cm/in toggle
  is display-only (`cmToDisplay`/`displayToCm`). No pixels in stored data.
  Apply zoom/pan to the stage transform only; never scale board objects.
- **Zero new deps.** A texture must be procedural/token/CSS/SVG-based — no new
  library, no image assets. Justify anything in Notes or a new ADR.
- **Tokens only** (no hardcoded colors); dark + light; mobile footprint must stay
  small (temporary chrome must not cover the canvas).
- **Persist custom boards** so a reload keeps them (`state/persist.ts`, v1
  localStorage mirror); mirror P2-02's hardenings (structural guards, drop bad
  records, orphan pruning not needed for an inline board def).
- No tiered/riser boards (N10); no board-to-board stacking control (S6, v2); no
  board-to-board resize handles. Do **not** build P3-02/P3-03 (save/share).
- `dangerouslySetInnerHTML` is banned; React escaping only (design.md §Security).
- Catalog provenance stays in ADR-003 — no external names/URLs in code/UI.

## Steps
1. **Designer direction proposal (texture treatment included) → owner approval.**
   Record the direction name + approval in `docs/progress.md`. **No UI before
   approval.**
2. **Data model:** extend `PlacedBoard` with the custom fields (`customSize`
   already exists; add `texture` + optional `brand`/`name`), a `BoardTexture`
   enum, and `addCustomBoard`/`updateCustomBoard` actions in `src/state/scene.ts`;
   thread the new fields through `boardFootprint`/`boardDefinition` and the
   renderer. Pure unit tests.
3. **Pure logic:** `src/lib/customBoard.ts` — parse/format/validate dims
   (reuse the `customPedal` helpers), texture selection + labels; unit tests.
4. **Persistence:** extend `src/state/persist.ts` (`isPlacedBoard` validates the
   custom fields structurally) + tests (round-trip, corrupt record dropped).
5. **UI (owner-approved direction):** a creator surface for a custom board
   (brand?/name?, width × depth + cm/in toggle, texture/finish choice, validation
   with sane bounds), reachable from the picker; a **custom-only Edit** action to
   reopen it pre-filled. Add/move/rotate/delete work end-to-end; boards stack by
   array order; the board renders at its true cm footprint with the texture.
6. **Tests:** Vitest for the pure logic + scene/persistence; Playwright (desktop
   **and** mobile) for create → place → move → rotate → delete →
   reload-persists.
7. **Design gate:** `design-reviewer` on rendered screenshots (desktop + mobile,
   dark + light), hard cap ≤2 passes.
8. **Code review (light, ≤2-pass loop — high-risk: persistence/serialization):**
   `/code-review`, source-scoped.

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: `addCustomBoard` creates a board with `boardRefId: null`,
  `customSize`, and the chosen `texture`; `boardFootprint` returns the custom
  size; `updateCustomBoard` edits it in place; units conversion (cm↔in) and
  draft validation are covered.
- Vitest: persistence round-trips a custom board (custom fields survive) and
  drops a structurally-invalid board record.
- Playwright (desktop + mobile): open the creator → fill name + width × depth
  (incl. the cm/in toggle) + texture → submit → a board appears with
  `data-boards` incremented at its true cm footprint (fallback silhouette +
  texture, no catalog image); the board can be **moved, rotated, and deleted**.
- Playwright (desktop + mobile): select a placed custom board → **Edit** reopens
  the creator **pre-filled** → change a field → **Save** updates it in place
  (still one board, not a second placement).
- Playwright: after creating a custom board, **reload** → it is still there
  (same uuid/size/texture).
- Manual/grep: no hardcoded colors; storage stays cm; no new deps; no external
  catalog provenance leaked.

## Notes
- **Fold the texture into this task** (the owner offered to defer it, but the
  roadmap P2-05 explicitly says "any W×D, texture" and the task deliverable lists
  it). The **designer decides the texture treatment** — it must be procedural
  (token/CSS/SVG/Konva-drawn), zero new assets/deps.
- **Data-model decision:** a custom board's definition is stored **inline on
  `PlacedBoard`** (`customSize` + `texture` + optional name/brand), not in a
  separate `customBoards` def table. Rationale: boards are not duplicated in v1
  (no shared-definition propagation needed), so the P2-02 def-table + orphan
  pruning buys nothing; the board already travels inline in the scene (A5).
  `src/assets/` (board textures) is **not** needed — textures are procedural, not
  files; note this deviation from the design.md folder-structure line.
- **Design-affecting (UI + new visible surface + a texture direction):** design
  gate applies — `designer` proposes, OWNER APPROVES BEFORE ANY UI, then
  `design-reviewer` on desktop+mobile, dark+light (≤2 passes).
- Persistence/serialization touch → the code review is likely high-risk
  (≤2-pass loop).
- Precedent: reuse P2-02's creator patterns (`lib/customPedal.ts` dims helpers,
  `Picker`'s edit flow, `persist.ts` guards).
- **Landed (2026-10-19):** the **"Substrate"** finish direction was
  owner-approved before any UI (with: creator in the Custom tab via a
  `Pedal·Supply·Board` kind segment; a small Edit/Delete action bar under a
  selected custom board). Shipped `src/lib/boardTexture.ts` (finish enum),
  `src/lib/customBoard.ts` (draft/validate/units), `src/canvas/boardFinish.ts`
  (procedural tiles), `src/components/CustomBoardForm.tsx`,
  `src/canvas/BoardActionBar.tsx`, `src/components/SheetSection.tsx`,
  `src/canvas/actionBarLayout.ts`; `PlacedBoard.texture|name|brand` +
  `addCustomBoard`/`updateCustomBoard`/`isCustomBoard`/`boardWorldCorners`.
  **Design gate:** `design-reviewer` R1 approve-with-changes (unselected Matte
  swatch blended into the panel) → stronger swatch hairline → R2 **approve**
  (desktop+mobile, dark+light). **Code review (light, HIGH-RISK ≤2 passes):**
  pass 1 changes-required (3 should-fixes: bounded persisted sizes, the
  inline-definition invariant, reload asserts uuid+size; 2 nits) → fixed →
  pass 2 **APPROVE** (2 nits folded). Tests **358**; e2e **109** (+6 skipped).
- **Owner follow-ups (same PR #21):** (a) the empty part-drawing preview now uses
  **kind-specific proportions** (`PART_PREVIEW_SIZES`: pedal portrait, supply slim
  horizontal, board larger horizontal). (b) shrinking a custom board **nudges
  attached pedals back inside** the new footprint (`clampItemsToBoard`, per-axis,
  only on an actual shrink) so none are silently stranded. (c) new optional
  `pedal-user` agent (`.opencode/agent/pedal-user.md`) + its **2 review rounds**
  (round 2 `valuable` / mergeable); non-P2-05 findings deferred to roadmap homes
  (P3-01 export, P4-02 cable gap, **P2-09 PROPOSED** board readout/chrome, P3-04
  undo, P3-02 units). Tests **362**; e2e **109** (+6 skipped).
- **Owner follow-up 2 (same PR #21): catalog-miss shortcut.** The Pedals and
  Boards ledgers now show **"Not listed? Create a custom-size pedal / board"**
  after the filters (designer spec: never above the search, underline link not a
  pill, no accent at rest, 32px mobile target, hidden on very short screens). It
  jumps to the Custom creator with the matching kind preselected (`openCustom`),
  preserving drafts. Tests **362**; e2e **111** (+6 skipped).
