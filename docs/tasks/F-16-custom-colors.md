# F-16 — custom colors

**Phase:** 1 · **Status:** todo · **Model:** light (escalate for the share-version bump — persistence/serialization is high-risk)

## Goal

Let the user give **placed parts and boards a custom organization color** so a rig
reads at a glance (grouped drives, power section, modulation row, a colored
board deck). This is distinct from **Q-05 Patch Ink**, which colors patch cables.
Colors must persist in the scene document, travel in share links, render in
read-only previews, and reproduce in PNG/PDF export.

Closes **F-16** in `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1.

## Owner-confirmed scope (2026-11-06)

The roadmap only named “custom colors”; the owner confirmed the exact shape:

1. **Placed parts — pedals, supplies and custom parts** get an optional
   **organization color** rendered as a **slim accent outline/frame** around the
   part footprint. Catalog part images are **not** tinted or recolored. There is
   **no** extra label chip (the outline alone carries the color).
2. **Placed boards** get an optional **color rendered as a colored border/frame**
   around the deck. The existing **matte / brushed / wood / tolex finish stays
   exactly as-is**; the color is a border, not a deck fill or overlay.
3. The color is a **per-item organization marker** (like a highlight), not a
   product colorway. It never edits catalog data.
4. **Default** means “omit the field” (no color stored).

## The gap on `main` (`deb2dc8c`)

- `PlacedItem` and `PlacedBoard` have no color field.
- `PedalNode` / `BoardNode` draw only selection (cyan Transformer/halo),
  warning (amber) and read-only cues; there is no user accent outline/border.
- `exportStage.ts` mirrors the canvas but has no color outline/border.
- There is no UI to set/clear a part or board color; `InfoPanel` has no color
  control and `BoardActionBar` only appears for **custom** boards.
- `Cable.color` (Q-05) is the precedent for an optional hex, but it is a
  different field and must not be reused.

## Data model

```ts
// additive optional on the existing scene types
interface PlacedItem  { /* … */ color?: string }
interface PlacedBoard { /* … */ color?: string }
```

- Stored as a normalized **lower-case 6-digit hex** (`#rrggbb`); 3-digit input
  expands; invalid/empty clears the field. Reuse the Q-05 `normalizeHexColor`
  helper (or move it to the shared color module so cable + item colors share
  it).
- `color` is **document-additive**: the stored `SceneDocument` stays `version: 1`
  (documents without `color` remain valid).
- Every mutator no-ops in read-only share mode; a missing uid or identical value
  is a no-op; one array replacement = **one undoable history step** (the existing
  snapshot middleware coalesces it).

### Share version (F-37 §B)

`color` is a **new transported key** on item and board wire schemas, and the
frozen per-version schemas are strict. Per the documented policy:

- **Bump `SHARE_VERSION` 3 → 4.**
- Keep decoding **v1 / v2 / v3**; add a pure **v3 → v4** identity migration
  (the field is optional, so no data is invented).
- Add frozen `v4` item/board schemas that extend v3 with `color`, `.strict()`.
- A v4 link with color round-trips; an old v3 client rejects it cleanly
  (`unsupported-version`) instead of silently dropping the color.
- No change to the document version.

## Approved direction — “Field Marks” (designer, owner-approved 2026-11-06)

A slim, screen-constant color rule inset on each item’s own edge — a cataloguing
mark, not a product colorway.

- **Item control:** one compact **color trigger** in `ItemActionBar` (after
  Rotate, before Duplicate). The trigger shows the current mark — a ring in the
  stored ink, or a hollow slashed ring for **Default** — and opens the Q-05
  anchored popover (portal, viewport-fixed, Esc/outside close) with
  **Default · 5 inks · Custom**. Same trigger+popover on desktop and mobile.
- **Board control:** extend `BoardActionBar` to **every selected board**:
  **Color** (all boards) → **Edit** (custom only) → **Delete** (custom only,
  destructive last). Catalog-board removal stays in the Picker (owner decision).
- **Palette:** reuse the Q-05 five inks + custom native input (one vocabulary;
  all fixed inks clear 3:1 on dark canvas, light canvas and white paper). No
  accent cyan — accent stays reserved for selection/primary action.
- **Part mark (“Organization Edge”):** inset **2 px** (screen-constant,
  counter-scaled), **2 px** solid ink, radius **3 px**, opacity 1, over a
  **4 px canvas-color knockout** under-stroke. No dash.
- **Board mark (“Deck Spine”):** inset **5 px** (so the selected board's 1.5 px
  Transformer border never merges with it), **4 px** solid ink, radius **4 px**
  (custom boards follow an inset notched silhouette), over an **8 px canvas
  knockout**. Finish untouched; identity chip draws above it. *(Owner accepted
  the R2 design-review fixes on 2026-11-06: the original 2/3/5 values were too
  easily masked by selection in both themes.)*
- **Stacking, outer → inner:** amber warning ring (outset 5) → canvas selection
  halo (outset 2) → cyan Transformer border (edge) → canvas knockout + color
  mark (inset 2) → art → label chip → jack ticks. Read-only danger cue (outset 8)
  stays outside the mark; no control is shown.
- **Accessibility:** trigger `aria-haspopup="dialog"` + `aria-expanded`, label
  `Organization color: <ink>` / `Board color: <ink>`, 44×44, focus-visible,
  roving tabindex; native radio group + native color input; custom-only contrast
  pip described via `aria-describedby`; read-only unmounts the control; no new
  animation (reduced-motion tokens = 0 ms).

## Read first (context pack)

- `docs/progress.md`, `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1
- `docs/tasks/Q-05-cable-color.md` (the additive-field + palette precedent)
- `docs/design.md` → Data model, Persistence/Versioning, Custom-board finishes
- `src/state/scene.ts` (`PlacedItem`, `PlacedBoard`, `setCableColor` pattern)
- `src/state/sceneDocument.ts`, `src/lib/shareLink.ts`
- `src/lib/cableColor.ts`, `src/styles/theme.ts`, `src/index.css`
- `src/components/InfoPanel.tsx`, `src/canvas/ItemActionBar.tsx`,
  `src/canvas/BoardActionBar.tsx`, `src/canvas/PedalNode.tsx`,
  `src/canvas/BoardNode.tsx`, `src/canvas/exportStage.ts`
- `e2e/selection.spec.ts`, `e2e/share.spec.ts`, `e2e/export.spec.ts`,
  `e2e/history.spec.ts`, `e2e/cables-color.spec.ts`

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file,
  `docs/screenshots/F-16/**`, and the docs hub.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, or shared coordinator docs/config.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; no new
  dependencies.
- Preserve the approved visual direction (Specimen Bench / Patch Drafting):
  the color is an **organization accent**, never a replacement for selection
  (cyan) or the amber space warning. All three must be legible together.
- **Design gate (mandatory):** designer proposal → **owner approval** →
  `design-reviewer` ≤2 passes on real desktop + mobile, dark + light
  before/after pixels.
- 44 px touch targets, visible focus, keyboard reachable, desktop/mobile parity.
- **Read-only share views must never expose or mutate the color control.**
- **No total-count E2E assertions**; filter a stable item/brand.
- **Performance guardrail:** record bundle delta, canvas frame time, heap and
  share/export size.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.

## Steps

1. Record the before state (uncolored selected part + board) on desktop + mobile,
   dark + light.
2. Run the `designer` for the control placement + palette + outline/border
   direction; **get owner approval before UI**.
3. Implement the minimal change:
   - Shared color helper (normalize + palette + contrast pip, reusing Q-05 where
     sensible) with unit tests.
   - Additive `color?: string` to `PlacedItem` / `PlacedBoard`; guards in
     `sceneDocument.ts`.
   - `setItemColor(uid, color | null)` / `setBoardColor(uid, color | null)`
     mutators (read-only no-op, one undo step, no-op on identical/missing).
   - Color control in the selected part/board surface (designer-decided),
     hidden in read-only.
   - `PedalNode`: slim accent outline around the footprint using `item.color`.
   - `BoardNode`: colored border around the deck using `board.color`, keeping
     the finish.
   - `exportStage.ts`: the same outline/border in PNG + PDF.
   - Share v4: schemas, `SHARE_VERSION`, `SUPPORTED_SHARE_VERSIONS`,
     `migrateSharePayload`, decode/encode.
4. Tests: color normalize/palette, mutators (set/clear/read-only/missing/
   identical/one history step), document round-trip + legacy without color,
   share v4 round-trip + v3 migration + old-link decode, export uses the color.
5. E2E: select part → set color → persist (reload) → share → read-only (no
   control) → export; same for a board; desktop + mobile.
6. `design-reviewer` ≤2 passes on rendered pixels.
7. One light `code-review` pass on the source diff; **escalate to ≤2** because
   the share version bump is high-risk.
8. Docs hub: `/changelog`; `/features` / `/help` if the workflow changes;
   `docs/features/README.md` rows/impact map only if the regression surface
   changes. State the `Docs:` line.
9. Required checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
   pnpm e2e`; record bundle delta, canvas frame time, heap, share/export size.
10. ONE PR with the standard sections, before/after artifacts, feature demo
    link; no merge.

## Acceptance (executable)

- Selecting a placed part shows a color control with a **Default** option;
  choosing a color draws a slim accent outline around that part only.
- Selecting any placed board (catalog or custom) shows the color control;
  choosing a color draws a colored border around that board while its finish
  is unchanged.
- **Default** removes `color` from the item/board (no field stored).
- The change is one undoable history step and autosaves.
- Reload restores the colors; `sceneDocument` round-trips them; old documents
  with no color still load.
- A share link with colors round-trips at **v4**; v1/v2/v3 links still decode;
  a v3 client rejects a v4 link cleanly (no partial decode).
- Read-only previews render the colors but never expose the control and never
  mutate.
- PNG and PDF show the same part outline and board border as the canvas.
- Selection (cyan), the amber space warning and the custom color remain visually
  distinct together (design-reviewer verified).
- 44 px targets, focus-visible, keyboard reachable; desktop + mobile; dark +
  light.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green on desktop + mobile.
- Feature demo link (`?share=1#s=…` with a colored part + board, or preview URL
  + steps/video) and before/after screenshots (desktop + mobile, dark + light)
  in the PR.
- Performance numbers recorded; no regression beyond thresholds.
- No catalog/shared edits. One PR; no merge.

## Notes

- Q-05 cable ink is **out of scope** and must not be modified except to share a
  pure color-normalization helper if the designer approves.
- Record billed tokens by class in the PR/session summary.
