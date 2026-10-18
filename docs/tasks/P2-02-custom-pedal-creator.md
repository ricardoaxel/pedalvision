# P2-02: Custom pedal creator

**Phase:** P2 · **Status:** in review — PR (opened 2026-10-17) · **Model:** build-cheap

## Goal
Let a user define their own pedal or power supply (F7) and place it on the
canvas: **brand**, **name**, **category** (pedal/supply), **width × depth**
entered in **cm or inches** (display toggle; storage stays cm), **effect
categories** (our taxonomy), **jack locations** (edge + position along the edge,
0..1), and **power** (V, AC/DC, mA). A custom part is **text-only** — it renders
as the existing labeled rectangle at its true cm footprint (`PedalNode`'s
fallback), never an image. Custom parts live **inline in the scene**
(`Scene.customPedals`, design.md §Data model / A5) so a future share link renders
them anywhere; the share/persistence codecs themselves are P3-03 (not built here).

**Prereq (same PR):** widen the `jacks.kind` vocabulary — the current enum
`in|out|exp|power` is too narrow for real pedals. Add `exp-in`, `exp-out`,
`send`, `return`, `midi`, `ctrl` (keep `power`). Catalog-schema change →
high-risk code review.

## Read first (context pack)
- `docs/roadmap.md` P2-02 (+ prereq)
- `docs/requirements.md` F7, F3, A5, N1/N3
- `docs/design.md` §Data model (`CustomPedal`, `PlacedItem`, `CatalogPedal.jacks`/`power`, `Settings.units`), §Responsive approach (bottom tabs incl. Custom)
- `docs/design-playbook.md` (UX-heavy recipe)
- `docs/tasks/README.md` (task format + PR/review standard)
- `src/catalog/schema.ts` (`JackSchema`, `Jack`, `PowerSchema`, `EFFECT_TYPES`)
- `src/state/scene.ts` (`PlacedItem`, `itemDefinition`/`itemFootprint`, actions), `src/state/persist.ts`
- `src/components/Picker.tsx` (`PickerTab`, tabs, placement), `src/components/pickerFilter.ts` (`effectLabel`)
- `src/canvas/PedalNode.tsx` (labeled-rectangle fallback), `src/lib/geometry.ts` (`cmToDisplay`, `DisplayUnits`, `placeItem`)
- `src/styles/tokens.css` (tokens only — no hardcoded colors)

## Constraints
- **UX-heavy design task → run the playbook (`docs/design-playbook.md`).**
  `designer` proposes a direction; the **owner approves it before any UI**.
  Implement, expand desktop+mobile Playwright QA, run the `designer`⇄`design-reviewer`
  loop (screenshots of rendered pixels) until **approve** (~5-round cap), then a
  light `/code-review`. One PR, **not merged**.
- **cm is the source of truth.** Width/depth are stored in cm; the cm/in toggle
  is display-only (`cmToDisplay`). No pixels in the model.
- **Zero new deps** unless justified here or in a new ADR.
- **Custom pedals travel inline**: `CustomPedal[]` in the scene; `PlacedItem.refId`
  may resolve to a catalog entry OR a `Scene.customPedals` entry. Do **not** build
  the P3-03 share codec.
- **Text-only rendering**: no image field on a custom pedal. Reuse `PedalNode`'s
  labeled-rectangle fallback; the label is the custom name.
- Tokens only (no hardcoded colors); dark + light; small mobile footprint.
- Jack `pos` is 0..1 **along** the chosen edge (edge + position, F7).
- No `dangerouslySetInnerHTML`; React escaping (design.md §Security).
- Catalog provenance stays in ADR-003 — no external names/URLs in code/UI.

## Steps
1. **Prereq:** widen `JackSchema.kind` in `src/catalog/schema.ts`; mirror it in
   `docs/design.md` §Data model; update `src/catalog/schema.test.ts` (accept the
   new kinds, still reject truly unknown ones).
2. **Data model:** add `CustomPedal` + `customPedals` + `addCustomPedal` (and a
   remove/cleanup path) to `src/state/scene.ts`; resolve `CustomPedal` in
   `itemDefinition`/`itemFootprint` (and the pure helpers that need a footprint);
   include `customPedals` in `src/state/persist.ts`. Unit tests.
3. **Designer direction proposal → owner approval** (record the name).
4. **UI:** a "Custom" surface (picker tab on desktop + mobile bottom tab) holding
   the creator form: category, brand, name, W/D + cm/in toggle, effect chips,
   jack rows (kind + edge + pos, add/remove), power (V, AC/DC, mA); on submit,
   add the custom pedal + place it (reuse `placeItem`/selection like the picker).
5. **Tests:** pure creator logic (units conversion, draft → CustomPedal
   validation) in Vitest; Playwright create → place → renders labeled rectangle
   on desktop **and** mobile; dark + light.
6. **Design gate:** `designer` review + `design-reviewer` loop on rendered
   screenshots (desktop + mobile, dark + light) until approve.
7. **Code review (light, ≤2 passes — high-risk: catalog schema).**

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: `JackSchema` accepts `in|out|exp|exp-in|exp-out|send|return|midi|ctrl|power`
  and rejects an unknown kind; the widened vocab round-trips.
- Vitest: a custom pedal added to the scene resolves its name + cm footprint;
  units conversion (cm↔in) and draft validation are covered; persistence
  round-trips `customPedals`.
- Playwright (desktop + mobile): open the Custom surface → fill the form (incl.
  the cm/in toggle and ≥1 jack + power) → submit → the item appears at its true
  cm footprint as a **labeled rectangle** (text-only) with `data-items`
  incremented.
- Manual/grep: no hardcoded colors; no external catalog provenance leaked; storage
  stays cm.

## Notes
- **Approved direction: "Datasheet"** (designer proposal, **owner-approved 2026-10-17**): a custom part is its datasheet — a spec sheet (TYPE → IDENTITY → FOOTPRINT → EFFECTS → JACKS → POWER) beside a **live dimensioned drawing** in the specimen pane (desktop), or the drawing in-flow above the Jacks rows (mobile). Custom tab joins the picker's segmented control + mobile bottom bar. Jack editor = kind `<select>` + **T/R/B/L** edge segments + **pos range slider** + remove; the actively-edited jack's dot is accent. cm/in is **local to the creator** for now (derived from canonical cm, seeded from `Settings.units` when it lands). Canvas cue (also owner-approved): **solid** rect (**not** dashed) + **dog-eared top-right corner** + existing bottom name chip + a small mono `CUSTOM` tag; two new neutral tokens `--color-custom-fill`/`--color-custom-stroke`; accent stays reserved for selection. Jack `pos` convention (owner-approved, inherited by P4-01): **reading order** — left→right on top/bottom, top→bottom on left/right; 0.5 centred.
- Folds the designer's **7 picker defects**: arrow-key hijack in form fields, initial focus when there is no search field, no dirty guard on Esc, focus trap missing `textarea`, two-way ternary header labels, scroll hard-wired to the results list, and `resetFilters` wiping a draft.
- First `Settings.units` (app-wide) arrives with the settings/persistence task (P3-02); P2-02 keeps the toggle local.
- Depends on P2-01's picker shell (Custom tab joins Pedals/Boards).
- Roadmap P4-01 (cables) consumes the widened jack vocabulary.
- The temporary localStorage mirror (`persist.ts`) is extended for `customPedals`
  only to survive reloads; the real save/share system is P3-02/P3-03.
