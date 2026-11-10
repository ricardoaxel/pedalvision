# F-12 — pedal labels

**Phase:** 1 · **Status:** in review — PR #104 · **Model:** light (escalate for the share-version bump — persistence/serialization is high-risk)

> Feature-lane **F-12** from `docs/tasks/feature-roadmap-proposal.md` §2
> Phase 1. This is **not** requirements `F12` (cables); the two numbering
> schemes are unrelated.

## Goal

Let the user give a **placed pedal/supply a short custom label** — a personal
name or a role ("always on", "Klon clone", "dirt 1") — so a rig reads the way
the player thinks about it. The label is an optional, additive field on the
placed item: it persists in the scene document, travels in share links
(share **v5**), renders in read-only previews, and reproduces in PNG/PDF.
Leaving it empty keeps today's behaviour exactly.

Closes **F-12** in `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1.

## Owner-confirmed scope (2026-11-07)

The roadmap only named "pedal labels"; the owner chose this shape:

1. **Placed pedals, supplies and custom parts** get an optional short **user
   label**. Boards are out of scope.
2. The label shows as a **second line in the canvas name chip** and in the
   **info panel**. The resolved catalog/custom name stays the identity; the
   label is an annotation, never a replacement for the name or a catalog edit.
3. The label is edited in the **existing info panel** (desktop rail + mobile
   sheet), not a new toolbar button.
4. **No label** means "omit the field" (no stored value); clearing the input
   removes it.
5. Read-only share views show the label but never expose an edit control.

## The gap on `main` (`1a316eda`)

- `PlacedItem` has no user-label field (`PlacedBoard.name` is the custom-board
  name, a different concept — do not reuse).
- `PedalNode` draws a single-line name chip; there is no second line.
- `exportStage.ts` mirrors the same single-line chip.
- `InfoPanel` shows the resolved name/brand/effects but has no editable field.
- Share is **v4**; `label` is a new transported key, so it needs **v5** and a
  migration (F-37 policy).

## Data model

```ts
// additive optional on the existing placed-item type
interface PlacedItem { /* … */ label?: string }
```

- Store the **trimmed** string, capped at **40 characters** (same ceiling as
  the share `optionalString(40)` fields). Whitespace-only or empty clears the
  field.
- `label` is **document-additive**: the stored `SceneDocument` stays
  `version: 1` (documents without `label` remain valid; no document migration).
- Every mutator no-ops in read-only share mode; a missing uid or an identical
  value is a no-op; one array replacement = **one undoable history step**.
- The label is per **placed item**, not per catalog entry. Duplicating an item
  copies its label (duplicate already clones the placed item); editing the
  custom-pedal definition does **not** touch labels.

### Share version (F-37 policy)

`label` is a **new transported key** on the placed-item wire schema, and the
frozen per-version schemas are strict.

- **Bump `SHARE_VERSION` 4 → 5.**
- Keep decoding **v1 / v2 / v3 / v4**; add a pure **v4 → v5** identity
  migration (the field is optional, so no data is invented).
- Add a frozen **v5** item schema that extends v4 with `label`, `.strict()`;
  keep the frozen v4 schema **without** `label`, so a v4 link cannot smuggle it.
- A v5 link with a label round-trips; an old v4 client rejects it cleanly
  (`unsupported-version`) instead of silently dropping it.
- No change to the document version.

## Approved direction — "Bench Notation" (designer, owner-approved 2026-11-07)

A curator's annotation written onto the existing specimen label: the name stays
the catalog fact, the note is the owner's pencil mark beneath it.

- **Canvas chip (empty = unchanged):** with no label, the existing 14 px chip,
  10 px name, inset 2, opacity 0.9 and position are byte-identical. With a
  label and an on-screen item height **≥ 58 px**, the chip grows **upward** to
  **28 px** = name row 14 + note row 14 (all screen-constant ÷ `labelScale`),
  bottom edge pinned, width unchanged, radius still `min(h/2, 3)`. Row 1 = name
  (sans 10, `itemLabelInk`, ellipsis, unchanged); row 2 = note (sans **10**,
  `itemLabelInkMuted`, ellipsis, centered, width − 6). Below 58 px tall the
  chip falls back to today's one-line name; the note stays in the panel. Chip
  still gated at `minWidthPx 52`. Read-only renders identically. *(Design-
  reviewer R1 found the original 9 px note illegible at 1:1; the 10 px size and
  the darker muted ink below are the R2-verified legibility fix inside the
  approved direction.)*
- **Info panel:** a new **Label** section **first** in `.info-panel__detail`,
  above Effects. Header eyebrow + a mono `n/40` counter shown only when the
  field is focused or non-empty. Reuses the custom-form control anatomy
  (`:focus-within` 2 px accent), input **16 px** (no iOS zoom), `maxLength 40`,
  `autoComplete off`, `spellCheck false`, placeholder `e.g. always on`; clear
  `×` only when non-empty at **44×44 mobile / 32×32 desktop**,
  `aria-label="Clear label"`. Live canvas update coalesced into one undo step
  (`beginHistoryHold`/`endHistoryHold`); commit on Enter/blur; Escape blurs;
  trim + collapse whitespace; whitespace-only deletes. Desktop always visible;
  mobile only in the expanded sheet (never in the 64 px peek). Read-only renders
  `<dt>Label</dt><dd>…</dd>` with no input/clear; section omitted when empty.
- **Tokens:** one dedicated note ink, `itemLabelInkMuted →
  --color-item-label-ink-muted` (#a8b0b8 dark / **#3f454c** light — the light
  value is darker than `--color-ink-muted` to clear AA on the chip) and
  `ITEM_LABEL` note constants (`noteFontSizePx 10`, `noteLineHeightPx 14`,
  `twoLineHeightPx 28`, `twoLineMinScreenHeightPx 58`). No extra note opacity;
  the chip's existing 0.9/1 rule applies.
- **Export:** `labelChip()` gains the note at the same 28 px geometry ÷
  `labelUnit` (name 10 / note 10), same width/height gates; omit the note when
  the printed part height < 58 label-px. PNG/PDF use the same two-line
  treatment and the shared `showItemLabelNote` threshold; the export measures
  in printed label-px (not canvas zoom px) by design.
- **No new animation.**

Risks accepted after review: the taller chip is inset 2 so selection/warning/
read-only cues never collide; the F-16 outline's bottom run is masked by the
chip (already true today); bottom-edge jack ticks intrude into the note row's
padding, not its glyphs (verify on the pixels).

## Read first (context pack)

- `docs/progress.md`, `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 / §6
- `docs/tasks/F-16-custom-colors.md` (the additive-field + share-version
  precedent; share v4 and the history-hold lesson)
- `docs/tasks/F-37-persistence-versioning.md` (version policy)
- `docs/design.md` → Data model, Canvas name chip, Persistence/Versioning
- `src/state/scene.ts` (`PlacedItem`, `setItemColor` pattern)
- `src/state/sceneDocument.ts`, `src/lib/shareLink.ts`, `src/state/history.ts`
- `src/canvas/PedalNode.tsx` (name chip), `src/canvas/exportStage.ts`
  (`labelChip`), `src/components/InfoPanel.tsx`, `src/index.css`
- `e2e/custom-colors.spec.ts`, `e2e/info-panel.spec.ts`, `e2e/share.spec.ts`,
  `e2e/export.spec.ts`

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file,
  `docs/screenshots/F-12/**`, and the docs hub.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, or shared coordinator docs/config.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; no new
  dependencies.
- Preserve the approved visual directions (Specimen Bench name chip, Specimen
  Readout info panel). The label must not compete with selection (cyan), the
  amber space warning, the F-16 organization outline or the custom-part tag.
- **Design gate (mandatory):** designer proposal → **owner approval** →
  `design-reviewer` ≤2 passes on real desktop + mobile, dark + light
  before/after pixels.
- 44 px touch targets, visible focus, keyboard reachable, desktop/mobile parity.
- **Read-only share views must never expose or mutate the label field.**
- **No total-count E2E assertions**; filter a stable item/brand.
- **No analytics/tracking** (F-42 is Phase 5).
- **Performance guardrail:** record bundle delta, canvas frame time, heap and
  share/export size.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.

## Steps

1. Run the `designer` for the label chip + info-panel field direction; **get
   owner approval before UI**.
2. Implement the minimal change:
   - Additive `label?: string` to `PlacedItem`; `setItemLabel(uid, label | null)`
     (trim, cap 40, read-only no-op, one undo step, no-op on identical/missing).
   - `sceneDocument.ts` guard accepts an optional string; round-trip test.
   - `PedalNode`: second line in the name chip when `item.label` is set, at the
     designed geometry; no label = byte-identical render.
   - `exportStage.ts`: the same second line in PNG/PDF.
   - `InfoPanel`: editable Label field (desktop + mobile expanded), hidden in
     read-only; live/streamed edits coalesced into one undo step using
     `beginHistoryHold`/`endHistoryHold` (F-16 lesson).
   - Share **v5**: `SHARE_VERSION`, `SUPPORTED_SHARE_VERSIONS`,
     `migrateSharePayload` (v4 → v5 identity), frozen v4/v5 schemas,
     encode/decode.
3. Tests: trim/cap/clear, read-only, identical/missing, one history step,
   document round-trip + legacy without label, share v5 round-trip + v4/v3/v2/v1
   decode + frozen v4 rejects `label`, export includes the second line.
4. E2E: select part → type a label → persists on reload → share v5 → read-only
   shows it with no field → export; desktop + mobile.
5. `design-reviewer` ≤2 passes on rendered pixels.
6. One light `code-review` pass on the source diff; **escalate to ≤2** if a
   blocker appears (the share version bump is high-risk).
7. Docs hub: `/changelog`, `/features`; `/help` if the workflow changes;
   `docs/features/README.md` rows/impact map.
8. Required checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
   pnpm e2e`; record bundle delta, canvas frame time, heap, share/export size.
9. ONE PR with the standard sections, before/after artifacts, feature demo
   link; no merge.

## Acceptance (executable)

- Selecting a placed pedal/supply/custom part shows an editable **Label** field
  (desktop and mobile-expanded); read-only share views show no field.
- Typing a label shows it as the second line in that item's canvas name chip
  and in the info panel; clearing it removes the second line and the stored
  field.
- Whitespace is trimmed and the value is capped at 40 characters; an
  over-length paste is refused or truncated deterministically (unit-tested).
- The whole edit is **one undoable history step**; reload restores the label;
  autosave stores it.
- `sceneDocument` round-trips `label`; old documents without it still load
  unchanged.
- A share link with labels round-trips at **v5**; v1/v2/v3/v4 links still
  decode; a v4 client rejects a v5 link cleanly (no partial decode).
- Read-only previews render the label but never expose the field and never
  mutate.
- PNG and PDF use the same second-line treatment with the print-density gate (a part below 58 printed label-px omits the note); the shared `resolveItemChip` rule is unit-tested.
- Selection (cyan), the amber warning, the F-16 organization outline and the
  label remain visually distinct together (design-reviewer verified).
- 44 px targets, focus-visible, keyboard reachable; desktop + mobile; dark +
  light.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green on desktop + mobile.
- Feature demo link (`?share=1#s=…` with labelled parts, or preview URL +
  steps/video) and before/after screenshots (desktop + mobile, dark + light)
  in the PR.
- Performance numbers recorded; no regression beyond thresholds.
- No catalog/shared edits. One PR; no merge.

## Implementation log (2026-11-07)

- **Data:** `PlacedItem.label?: string`; `normalizeItemLabel` trims/collapses
  whitespace and caps at `ITEM_LABEL_MAX_LENGTH = 40`; `setItemLabel` is
  read-only-guarded, no-ops on identical/missing, and replaces the array once
  (one undo step). Duplicate copies the label; boards are untouched.
- **Document:** `isPlacedItem` accepts an optional string `label`; the document
  stays additive v1.
- **Share v5:** `SHARE_VERSION = 5`; v1–v4 decode; `migrateSharePayload` upgrades
  to v5; frozen v4 rejects `label`; frozen v5 adds the optional field.
- **Canvas/export:** the chip grows upward 14 → 28 px (name 10 + note 10/14) only
  when the part is ≥58 screen px tall; otherwise one line. The note ink is the
  new `--color-item-label-ink-muted` token (#a8b0b8 dark / #3f454c light) so the
  second line clears AA on the chip.
- **Info panel:** label section first, live streaming with a history hold, clear
  button, counter, 16 px input, 44 px touch clear; read-only static fact.
- **Design gate:** `designer` proposed **“Bench Notation”**; **owner approved
  2026-11-07**. `design-reviewer` pass 1 **approve-with-changes** (note too small/
  pale, mobile sheet inset, clear box-in-box) → fixes → pass 2
  **approve-with-changes** (remaining are evidence-only: a scrolled mobile shot
  and a note that the toolbar geometry is unchanged; no third pass per the ≤2
  cap). Owner to verify the final pixels.
- **Evidence:** `docs/screenshots/F-12/` (before/after desktop + mobile, dark +
  light; mobile collapsed chip; scrolled sheet; long-label truncation).

## Checks (to fill on PR)

- Unit: **1,082 tests** (+13 vs 1,069).
- Build: **JS 355.15 kB gzip (+0.90 vs 354.25), CSS 17.78 kB gzip (+0.08)**.
- E2E: **436 passed + 14 skipped** (`--workers=2`).
