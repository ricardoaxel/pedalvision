# P2-03: Pedal info panel + space warning

**Phase:** P2 · **Status:** done (merged 2026-10-18, PR #19, squash `ef4f5ff`) · **Model:** build-cheap

## Goal
Two related, owner-approved-to-share surfaces (owner folded 2026-10-18):

**(A) Pedal info panel.** Show the **selected** item's details in an HTML panel
(design.md §Responsive approach: ≥1024px = a right sidebar panel; <1024px = a
bottom-tab sheet/section). For **both** catalog items and custom parts:
identity (brand · name), category (pedal/supply), **tags** = effect categories
(our `EFFECT_TYPES` taxonomy), true-scale **dimensions in cm** with a **cm/in
display toggle**, **power** (V, AC/DC, mA) when present, and **jack locations**
(edge + pos) when present. This is the natural home to surface the P2-02 custom
fields; custom parts already have an **Edit** action on the selection action bar
(don't duplicate it — the designer may add an Edit entry here too). The panel is
the HTML mirror of the selection (design.md §Accessibility) — the canvas has no
DOM semantics.

**Data caveat:** the committed seed has no `power`/`jacks` for catalog pedals yet
(backfill is P5-01) — those sections must **degrade gracefully** (hide when
absent, never show empty scaffolding). Catalog brand/name/dims/`effectTypes`
**are** real.

**(B) Space warning (owner folded 2026-10-18).** When a pedal **overlaps** another
item or **extends beyond its board's footprint**, **warn — but still ALLOW** the
placement (never block a drop). Non-blocking visual cue (designer decides the
exact treatment, e.g. a warning-tinted outline + an inline message in the info
panel), in **dark + light** and on **touch**. Trigger points: while/after
dragging, on drop, and whenever the selected item's info panel is open. **No
auto-avoidance / reflow** — it only warns. Extract a **pure predicate**
(`overlaps` / `outOfBounds` given items + boards) that is unit-testable and has
**no pixels**.

## Read first (context pack)
- `docs/roadmap.md` P2-03; `docs/phase-guide.md` P2 row; `docs/requirements.md`
  F7 + the pedalboard.app "DO" lines (info panel with tags; "space warning that
  warns but allows placement").
- `docs/design.md` §Responsive approach (≥1024px right sidebar / <1024px bottom
  tabs), §Accessibility (panels/selection controls are mirrored in HTML — this
  panel IS that mirror), §Data model (`CatalogPedal.effectTypes`/`power`/`jacks`;
  `CustomPedal`; the units setting), §Z-order & container rules.
- `src/state/scene.ts` (`resolveItem`, `itemFootprint`, `boardFootprint`,
  `customPedalById`, `itemWorldCorners`, `PlacedItem`, `PlacedBoard`),
  `src/state/selection.ts` (`selectSelectedItemUid`), `src/canvas/ItemActionBar.tsx`
  (existing selection chrome — coordinate placement so they don't collide).
- `src/components/Picker.tsx` + `pickerFilter.ts` (`effectLabel`),
  `src/lib/geometry.ts` (`cmToDisplay`/`DisplayUnits`, `rectsOverlap`,
  `worldToBoard`/`boardToWorld`), `src/lib/customPedal.ts`
  (`jackKindLabel`, `JACK_EDGE_LABELS`), `src/styles/tokens.css`.
- Precedent: `docs/tasks/P2-02-custom-pedal-creator.md` (the "Datasheet" surface +
  a11y/token conventions).

## Constraints
- **cm is the source of truth**; the cm/in toggle is **display-only** (reuse
  `cmToDisplay`). No pixels in the DOM model / stored data.
- **Tokens only** (no hardcoded colors); dark + light. Keep the mobile footprint
  small (owner instruction: temporary/placeholder chrome must stay small on
  mobile so the canvas stays visible).
- **Zero new deps** by default (justify any in this file or a new ADR); minimal
  dependencies is a hard constraint.
- React escaping; **no `dangerouslySetInnerHTML`**. **No external catalog
  provenance in UI** (ADR-003).
- **Warn, never block**: the drop path is untouched; the warning is an overlay
  cue + an inline message only. No auto-avoidance/reflow.
- Do **not** build P3-02/P3-03 (save/share); P2-03 is display + the warning only.
- Design gate applies (UI + design-affecting, two visible surfaces): `designer`
  proposes the direction (both surfaces), **owner approves before any UI**;
  after implementation run the `design-reviewer` on rendered screenshots
  (desktop + mobile, dark + light, incl. a warning state), ≤2 passes.

## Steps
1. **Create this task file** (done) — no task file existed.
2. **Designer direction** for both surfaces → **owner approval** (record the name
   + approval date here and in `docs/progress.md`).
3. **Pure predicate** (`src/state/overlap.ts`): given an item, its resolved
   footprint, the other items and the boards, return whether it **overlaps** a
   peer (world-cm AABB across **all** containers — a container boundary does not
   hide a real on-canvas overlap; using `rectsOverlap`) and/or is **out of
   bounds** of its board footprint (`boardFootprint` + `worldToBoard`), with the
   offending peer(s) named. Unit tests (overlap in board frame for a rotated
   board; loose-item peer overlap; cross-container overlap; boundary-touch = no
   warning; out-of-bounds each edge; no board → no bounds check).
4. **Info panel** (`src/components/InfoPanel.tsx` + tokens/CSS): desktop right
   sidebar; mobile bottom sheet/section. Renders identity, category, effect
   tags, dimensions + cm/in toggle, power (when present), jacks (when present),
   graceful omission otherwise; the space-warning message when the item warns.
   Extend `App.tsx` to mount it; coordinate with `ItemActionBar` so the two never
   collide.
5. **Space warning cue**: warning-tinted treatment on the offending canvas item
   (Konva) + the inline panel message; dark + light; touch-friendly.
6. **Tests**: pure predicate + any formatting logic (Vitest). Playwright
   (desktop + mobile): select → info panel shows details (a custom part with
   power/jacks AND a catalog pedal with none); the cm/in toggle; an
   overlapping/off-board pedal shows the warning **but stays placed**.
7. **Design gate**: `design-reviewer` on rendered screenshots (desktop + mobile,
   dark + light, incl. a warning state) until approve (≤2 passes).
8. **Code review (light, one source-scoped pass).**
9. **Docs + PR**: reconcile `docs/progress.md` + `docs/roadmap.md` + this file;
   open **one** PR to the full standard (inline screenshots at the commit SHA,
   ≤3 owner hints, review-round digest). **Do not merge.**

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: the pure overlap/out-of-bounds predicate covers same-container
  overlap, cross-container overlap (a loose pedal over a board pedal, since the
  test is world-space), board-frame correctness under a rotated board,
  boundary-touch (no warning), each out-of-bounds edge, and no-board
  (no bounds check).
- Vitest: display formatting (cm/in via `cmToDisplay`, power + jack labels) is
  covered.
- Playwright (desktop + mobile, dark + light): selecting a placed item shows the
  info panel with brand · name, category, effect tags, and dimensions; the cm/in
  toggle switches the displayed numbers; a custom part shows power + jack rows
  while a catalog pedal with no power/jacks omits those sections (no empty
  scaffolding).
- Playwright (desktop + mobile): a pedal placed overlapping a peer and/or off its
  board shows the space warning (a warning cue + inline message) yet remains
  placed (`data-items` unchanged, its stored position unchanged).
- Manual/grep: tokens only (no hardcoded colors); no `dangerouslySetInnerHTML`;
  no external provenance; storage stays cm.

## Notes
- **Approved direction: "Readout"** (designer proposal, **owner-approved
  2026-10-18**; **superseded/extended by the "Specimen Readout" rework below** — rail
  360px, warning strip under the plate, specimen preview). The panel is the selected
  specimen's instrument readout; the space warning is its out-of-tolerance flag.
  Extends the Blueprint → Specimen Bench → Datasheet family as its quietest,
  persistent-chrome member (mono eyebrows + sans values + hairline rules; sections
  render only when data exists; accent stays reserved for action/selection).
  **Desktop:** a trailing **push** column — owner chose push over overlay so the
  canvas narrows and nothing is occluded. **Mobile:** a compact,
  **collapsed-by-default** bottom sheet above the persistent tab bar (identity +
  dimensions + the warning always visible; expand for the plate + effects/jacks/
  power). **Warning:** a non-blocking `--color-warning` cue on the offending item
  (the "Specimen Readout" rework made it an amber **outer ring** beyond the
  selection border) + the panel's status strip (`role="status"`): "Overlaps
  {name}." / "Extends beyond the board." Owner chose to keep **Edit
  action-bar-only** (no duplicate in the panel).
- **Owner-requested rework (2026-10-18, same PR) — "Specimen Readout".** Mid-review the
  owner asked for an intense UX/UI pass and a **larger pedal image** so the selected
  pedal is identifiable. Added a **specimen preview**: a lit plate (light in both
  themes) on the desktop rail; the **mobile collapsed** sheet shows a **48px header
  thumb** and the **expanded** sheet the full plate. The image loads through the
  picker's loader extracted to a shared `src/components/partImage.ts` (CORS-first →
  cache-bust → no-CORS → failed), so a hotlinked `url` can't re-poison the canvas
  cache. Custom parts render the on-plate `PartDrawing` (extracted to
  `src/components/PartDrawing.tsx`, shared with the Datasheet); unknown/failed →
  a glyph tile. Polish: the warning band became a slim left-bar **status strip**
  (mono `SPACE` label + sentence) and moved **under the plate**; section eyebrows
  muted + hero name `--font-size-xl`; rail **320→360px**; borderless inline cm/in
  segment (44px touch on mobile); 12px mobile bottom inset; and a shared fix for
  the **existing on-plate ink defect** (theme-invariant `--color-plate-*` tokens —
  the Datasheet's mobile drawing moved onto the same light plate so its callouts
  are legible in dark theme). Mid-session owner approvals: rail 360, warning under
  the plate, full-`PartDrawing` fallback, shared ink fix.
- **Owner-requested rework 2 (2026-10-18, same PR) — "Specimen Cover" (mobile-first).**
  The owner asked for a **much better mobile preview interface** (+ desktop if
  possible). The preview is now the anchor: mobile shows a constant-height **cover
  row** in the peek — a **64px sleeve** + one-line name + a `brand · category`
  subline + actions — with a **status row** (dimensions + a compact warning
  **chip**); one tap expands to a **72dvh hero** (a full-bleed **banner** + a
  **measure row** with the cm/in toggle) + the readout. Desktop adopts the same
  **full-bleed banner + measure row**. Warning: chip in the peek, status strip
  when open. The peek is *shorter* than before (more canvas at rest) while the
  image is bigger. Owner-approved mid-session (72dvh detent, chip).
- **Review rounds (Specimen Cover):** `design-reviewer` R1 **approve** → light
  `code-review` pass changes-required (mobile rule hid the readout section titles;
  sleeve img missing `onError`; chip a11y label; e2e exclusivity) → fixed →
  `design-reviewer` R2 **approve**.
- **Review rounds (rework 1):** `design-reviewer` R1 approve-with-changes → revision
  → R2 **approve** → R3 (shared drawing) **approve**; light `code-review` rework
  pass → fixed (shared drawing plate, drawing follows the cm/in toggle, empty-src
  guard, single `onError`). Screenshots `docs/screenshots/P2-03/` (desktop + mobile,
  dark + light; catalog / custom / warning / drawing).
- `Settings.units` (app-wide) arrives with P3-02; until then the panel's cm/in
  toggle is local (like P2-02's creator toggle).
- The seed's catalog pedals carry **no** `power`/`jacks` (P5-01 backfill) — the
  panel must render those sections only when present.
- Depends on P2-01 (picker shell) + P2-02 (custom part fields, `jackKindLabel`).
- The space warning reuses `rectsOverlap` (geometry) + `itemFootprint`/
  `boardFootprint`/`worldToBoard` (scene); it adds **no** placement constraint.
