# F-14 — similar pedals

**Phase:** 1 · **Status:** in review — PR #105 · **Model:** light (no persistence/share change)

> Feature-lane **F-14** from `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1.
> This is **not** requirements `F14` (there is none); the two numbering schemes
> are unrelated.

## Goal

When a placed catalog pedal is selected, the info panel suggests a few
**catalogue alternatives with an overlapping effect type** ("Similar in the
catalogue"), so the user can find a substitute for a pedal they already have
without re-typing a search. Tapping an alternative opens the Pedals picker
pre-filtered to that target pedal's effect type(s), where the user can add it.

Purely a discovery aid: nothing in the scene, document or share payload changes.

## Owner-confirmed scope (2026-11-10)

The owner chose the **info-panel, browse-on-tap** option:

1. The list lives in the **existing info panel** (desktop rail + mobile
   expanded sheet), **not** the picker specimen pane (which is hidden on
   mobile — F-32 territory — so it cannot meet desktop/mobile parity).
2. **"Similar" rule:** same `category === "pedal"`, shares **≥ 1 effect type**
   with the target, excludes the target id. Rank by: shared effect-type count
   (desc) → same brand (true first) → closest footprint (|Δw| + |Δh|, asc) →
   name (asc) for a deterministic tie-break. Cap **4**.
3. **No scene mutation.** Tapping a row opens the Pedals picker with that
   effect type pre-selected; adding is still the user's explicit action.
4. **Hidden in read-only shares** (the picker is an edit surface, and read-only
   views must not offer edit controls).
5. Custom/unknown placed parts and targets with no effect types show no
   section.

## The gap on `main` (`f82ed9bf`)

- `InfoPanel` shows identity, effects, jacks, power and the F-12 label, but no
  alternatives and no link back into the catalogue.
- `Picker` owns its filter state internally (`effectTypes`), and `App` only
  passes the tab. There is no way to open it already filtered.
- The catalog already carries everything needed (`effectTypes`, `brand`,
  dimensions) at runtime; no catalog edit is required.

## Data model

No persisted or transported change.

- **No** new `PlacedItem`/`PlacedBoard` field, **no** `SceneDocument` change,
  **no** share-version bump (share stays **v5**).
- New pure module `src/lib/similarPedals.ts`:

```ts
export interface SimilarPedal {
  id: string;
  brand: string;
  name: string;
  widthCm: number;
  heightCm: number;
  /** Effect types shared with the target, in the target's order. */
  sharedEffectTypes: EffectType[];
}

export function similarPedals(
  target: CatalogPedal,
  pedals: readonly CatalogPedal[],
  limit?: number, // default 4
): SimilarPedal[];
```

- The module is catalog-in / data-out; no URL/image resolution and no store
  access, so it is unit-tested without the DOM.
- Brand/footprint matching uses the **stored catalog facts only** (cm is the
  source of truth). No inferred effect types and no name matching.

## Interaction / UI

- New `.info-panel__section[data-testid="info-similar"]` after **Effects**
  (before jacks/power), so it reads as "the catalogue around this pedal".
- Each row is a `<button type="button">` (44 px touch target on mobile) with the
  alternative's brand + name + its shared effect label, and dimensions; the
  row set is `role="list"`/`<ul>` semantics.
- Tapping a row calls a new `onOpenSimilar(id)` prop (App → `openPicker`) with
  a preset; the picker applies the target's effect types and clears the query,
  brand, stereo and sort so the filtered ledger is visible immediately.
- The picker exposes a new optional `preset` prop
  `{ key: number; effectTypes: EffectType[]; query?: string }`; a `key` change
  applies it once (so re-clicking the same alternative works and normal use
  keeps the previous filter state).
- No new toolbar control, no auto-open, no toast.

## Approved direction — "Cross-Reference" (designer, owner-approved 2026-11-10)

Reads like a cross-reference slip pinned beside the specimen: text-only, no
photography, no accent hue, no chrome of its own.

- **Placement:** after **Effects**, before `JackCorrections` (Effects establishes
  the shared-type vocabulary; Jacks/Power stay the physical facts). Press Proof
  hides it with Effects.
- **Header:** eyebrow `Similar` + support line
  `Same effect type · browse <effect> pedals` (rewritten from the designer's
  "Shares an effect type · opens the catalogue." after the pixel review, to name
  the action and the applied filter).
- **Rows:** name (sans `--font-size-sm`, medium, ellipsis) + mono dims
  (`--font-size-2xs`, tabular, right) on line 1; `brand · shared effect types`
  (`--font-size-xs`, `--color-ink-muted`, ellipsis) on line 2. Hairlines between
  rows; full-row 44 px hit area; hover/active `--color-input-bg`; focus ring
  `--color-accent-strong` inset 2 px. Cap **4**, both viewports.
- **Semantics:** `<ul>/<li>/<button>` with `aria-haspopup="dialog"` and an
  accessible name that includes the target action (rows have no visible CTA).
- **No new tokens**; every value reuses the panel's ink/border/accent/spacing
  scale (measured AA: ink-muted on surface-elevated 5.63:1 dark / 6.66:1 light).
- **Mobile:** same DOM inside `.info-panel__detail`, so the collapsed peek hides
  it for free; no new mobile CSS.
- **Design review:** `design-reviewer` pass 1 approve-with-changes (mobile
  evidence missing; mobile picker filter off-screen; copy) → pass 2
  **approve-with-changes** with no remaining blocker after the mobile evidence +
  chip-scroll fixes; the final copy tweak was its single recommended change.
  No third pass (≤2 cap).

## Read first (context pack)

- `docs/progress.md`, `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 / §6
- `docs/tasks/F-12-pedal-labels.md` (info-panel section pattern)
- `docs/design.md` → Data model / Info panel / Picker
- `src/components/InfoPanel.tsx`, `src/components/Picker.tsx`,
  `src/components/pickerFilter.ts`, `src/App.tsx`
- `src/catalog/schema.ts` (`CatalogPedal`, `EFFECT_TYPES`, `EffectType`)
- `e2e/info-panel.spec.ts`, `e2e/picker.spec.ts`, `e2e/picker.ts`

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file,
  `docs/screenshots/F-14-similar-pedals/**`, and the docs hub pages.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, or shared coordinator docs/config.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm is the source of truth; no new runtime dependencies.
- Preserve the approved "Specimen Cover" info-panel direction and the
  "Specimen Bench" picker direction. The section must not compete with the
  F-12 label, jacks, the amber space warning or the F-16 outline.
- **Design gate (mandatory):** designer proposal → **owner approval** →
  `design-reviewer` ≤2 passes on real desktop + mobile, dark + light
  before/after pixels.
- 44 px touch targets, visible focus, keyboard reachable, desktop/mobile parity.
- **Read-only share views hide the section entirely** (no dead/edit controls).
- **No total-count E2E assertions**; filter a stable item/brand.
- **No analytics/tracking** (F-42 is Phase 5).
- **Performance guardrail:** record bundle delta, picker-open/canvas frame
  time, heap and share/export size (share/export must be byte-identical for the
  same scene — no transported key changed).

## Steps

1. Restate the scope + executable acceptance criteria (this file).
2. Design gate: designer proposal → owner approval → implement.
3. Implement the pure module + section + picker preset; unit tests.
4. `design-reviewer` ≤2 passes on desktop + mobile, dark + light.
5. Light code review on the source diff; fix findings.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; touched E2E
   desktop + mobile.
7. Docs hub `/features` + `/changelog` + `/help` (the workflow gains a
   discovery path) and the F-19 feature map row.
8. One PR with the standard sections + feature demo link; no merge.

## Acceptance (executable)

- `similarPedals` unit tests cover: self excluded; shared-type filter; rank
  order (type count → same brand → footprint → name); cap 4; empty for a target
  with no effect types; deterministic repeat calls; no mutation of inputs.
- Info panel shows `info-similar` for a placed catalog pedal with matches, and
  every row opens the picker on **Pedals** with the target's effect chips
  pressed and query/brand/stereo reset (desktop + mobile E2E).
- Section is absent for a custom part, an unknown part and a no-effect pedal,
  and **absent in a read-only share** (E2E on both viewports).
- No scene/document/share change: a scene round-trips byte-identically
  (existing `share`/`scenes` specs stay green); share version remains 5.
- Before/after screenshots at desktop + mobile, dark + light (same selected
  pedal).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green on desktop + mobile.
- Feature demo link: deployed PR preview + exact steps (the panel is selection
  state, so a `?share=1#s=…` link cannot encode it — use the preview URL + steps
  + a short video/GIF).
- Performance numbers recorded; no regression beyond thresholds.
- `Docs: hub /features /changelog /help · map updated`.

## Notes

- Process/rule gaps: propose the change + `token-usage-reviewer` to the owner
  first; do not edit the rules in this PR.
- Record billed tokens by class (builder / vision / code review) in the PR and
  session summary.

## Review record (2026-11-10)

- **Owner scope choice:** info-panel browse-on-tap (not swap, not picker-only).
- **Designer:** proposed **“Cross-Reference”**; owner approved the direction as
  proposed (rows after Effects, text-only, cap 4 both viewports, dimensions
  kept).
- **design-reviewer R1:** approve-with-changes — mobile evidence missing, the
  mobile picker's applied filter was off-screen, support-line copy. Fixed:
  re-shot mobile with the sheet scrolled to the section, scrolled the pressed
  chip into view, rewrote the support line.
- **design-reviewer R2:** approve-with-changes, **no blocker** — mobile section
  verified (4 rows at ~44 px, no tab-bar clipping) and the pressed Overdrive
  chip visible on both viewports; only remaining change was the copy, applied.
  No R3 (≤2 cap).
- **code-reviewer R1 (light):** approve-with-changes — memoize the ranker,
  exclude utility-only planner placeholders, consume the preset + gate it on
  `open`, add coverage. All fixed; a hook-order bug from the first memo attempt
  was caught by Biome and fixed (memo moved above the early returns).
- **code-reviewer R2 (light, same session):** **approve** — one nit
  (tautological reset assertions) folded by pre-setting brand/sort/stereo before
  the re-tap.
- **Checks:** lint / typecheck / **1,093 tests** / build **JS 356.18 kB gzip
  (+1.03), CSS 17.92 (+0.14)** / e2e **444 passed + 14 skipped** / docs hub
  24/24.
- **Performance:** rank 0.70–1.15 ms (memoised; 8.5 ms before the utility-only
  filter); row→picker median ~44 ms; benchmark 200 items 54 FPS, 400 items
  37 FPS, heap 64.8 MB; share/export unchanged (share v5, no new key).
- **Evidence:** `docs/screenshots/F-14-similar-pedals/` (before/after desktop +
  mobile, dark + light; panel/picker detail; hover; custom/read-only hidden;
  desktop + mobile interaction GIFs).
