# F-14 — similar pedals (sound-alikes)

**Phase:** 1 · **Status:** in review — PR #105 · **Model:** light (no persistence/share change)

> Feature-lane **F-14** from `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1.
> This is **not** requirements `F14` (there is none); the numbering schemes are
> unrelated.

## Goal

Answer the guitarist’s question: **“what else can I buy that sounds like this?”**
For a selected catalogue pedal the info panel shows **cross-brand sound-alikes**
(clones / circuits / algorithms) first, then the maker’s own **family/lineage**,
then a broad “Browse all …” path. A plain shared effect type (“it’s also a
delay”) is never enough.

The owner rejected the first implementation (a flat “shares ≥1 effect type” list:
a DD-3 could surface unrelated delays and spent slots on its own reissue). The
redesign is **evidence-tiered**:

1. **Circuit / algorithm family across brands** — Screamer-style overdrive,
   Big Muff-style, BBD analog delay, tape echo, BBD chorus, …
2. **Delay/reverb subtype** when no circuit evidence exists — digital delay,
   analog delay, tape delay, hall/plate/spring/ambient/multi-mode reverb.
3. **The maker’s own family** — DD-3 → DD-3T/DD-5/DD-6/DD-7/DD-8, shown as a
   compact register beneath the cross-brand group.
4. **Broad category fallback (owner follow-up 2026-11-12):** when there is no
   circuit/subtype evidence, fall back to `Other octave pedals`, `Other pitch
   pedals`, `Other delays`, `Other choruses`, etc. — but only for single-effect
   targets in role-based categories. **Never** for overdrive/distortion/fuzz,
   and never for hybrids (e.g. an octave reverb). If nothing is left, hide the
   section.

POG2 note: it is planner-only with `effectTypes: ["utility"]` and a placeholder
note, so it still shows nothing. The proper fix is a small EHX POG/Pitch Fork
**catalog backfill** (POG2/POG3/Nano/Micro/Pico/Soul POG/Pitch Fork) in the
catalog lane; no feature-side name alias is used. No scene mutation; no new transported key (share
stays **v5**).

## Owner-confirmed scope (revised 2026-11-10)

1. **Sound-alikes, not categories.** Cross-brand clones/circuits/algorithms are
   the headline; the maker’s lineage is secondary. Price/availability is **out of
   scope** (the runtime catalogue has no price field; inventing one would be
   misleading).
2. **Tapping a row/token opens that exact model** in the Pedals picker (query =
   the model name, effect type applied). The token label is therefore true.
3. **The footer is the “more all” path** (`Browse all delays`, etc.) and opens
   the broad filtered list.
4. **Read-only shares hide the whole section** (the picker is an edit surface).
   Custom/unknown parts and utility-only planner placeholders have no section.
5. **Picker reset (bug fix 2026-11-12):** every open starts from the default
   view (query/brand/effect/stereo/sort cleared) before first paint; a Sounds-
   like preset is applied on top and consumed. This prevents the “missing
   pedal” illusion after closing the picker.
6. **Curated knowledge is allowed** (owner decision, “whatever is needed”).
   This amends the earlier “no name matching” constraint: the feature may use a
   small, reviewed, unit-tested map of model families/circuits in `src/lib`.
   It is **not** fuzzy/free-text inference, and it never edits catalogue data.
6. **Family register:** up to 5 short tokens, successors/replacements before
   predecessors, finish/colourway variants collapsed or excluded.

## The gap on `main` (`f82ed9bf`)

- The old `similarPedals` ranked by shared effect types + same brand + footprint.
  Same-brand priority spends all four slots on the target’s own line and
  structurally hides every cross-brand alternative; `variantOf` reissues and
  colourways flood the list; every row opened the same broad list.
- `InfoPanel` rendered a flat list; there was no grouping, no reason, no register.
- The catalogue already has the facts for a curated model (names, notes, dims,
  `variantOf`, `stereo`); famous non-BOSS models (TS9, RAT 2, Flashback, Canyon,
  BigSky) are not catalogued yet and must not be faked.

## Data model

No persisted or transported change: **no** `PlacedItem`/`PlacedBoard` field, **no**
`SceneDocument` change, **no** share-version bump (stays **v5**).

- **`src/lib/similarModel.ts` (new).** Typed, reviewed maps:
  - `FAMILY_RULES` — maker lineage + order + short label (BOSS DD/DM/RV/RE/SDE/
    CE/BF/PH/TR/SD/DS/BD/OD/FZ/MT/VB/DC; MXR Carbon Copy; Meris Mercury; Red
    Panda Context/Raster/Particle; EQD Afterneath/Avalanche; Keeley 1962; EHX
    Bass Big Muff; TC Alter Ego). Finish/colourway markers are excluded.
  - `CIRCUITS` — cross-brand circuit/algorithm families with `core` and
    `adjacent` members, limited to families that can actually render today
    (Screamer-style overdrive + SD-1 adjacent; Bluesbreaker; BBD analog delay;
    BBD chorus). Single-member families (Klon, RAT, OCD, Uni-Vibe, Big Muff,
    tape echo) are deliberately **not claimed** until the catalogue carries
    genuine cross-brand members; their family registers still apply.
  - `SUBTYPE_OVERRIDES` + scoped notes keywords for delay/reverb subtypes; an
    unknown subtype is left unknown (no claim).
  - `categoryFallbackLabel` — the role-based broad-effect tier; drives/fuzz
    are deliberately absent.
  - `capabilitiesOf` — stereo (recorded field), tap tempo, multi-mode,
    polyphonic, expression, MIDI, compact footprint.
  - `delayRoleRank` — deprioritises pitch/granular delays that merely share the
    `delay` tag.
- **`src/lib/similarPedals.ts`.** `similarPedalGroups(target, pedals)` returns
  ordered `SimilarGroup[]` (`circuit` / `subtype` / `family`), cap **3** cross
  rows and **5** family tokens, with deterministic ranking:
  - circuit: core before adjacent → shared capabilities → current → footprint →
    name/id;
  - subtype: plain delays before pitch/granular → same format → shared
    capabilities → current → footprint → name/id;
  - family: successors/replacements first → lineage order → current → name.
  - Excludes self, non-pedals, utility-only planner rows, finish/colourway
    variants, multi-processors for single-effect targets, and bass models for a
    non-bass target. `browseAllLabel()` yields the footer copy.

A unit test asserts every mapped id exists in the curated catalogue; unknown
models are never guessed.

## Approved direction — "Sound Register" (2026-11-10)

An adaptation of the designer’s recommended **Family Register** after the owner’s
sound-alike pivot. Same quiet Specimen Cover rail, tokens only, no new photo
layer.

- **Placement:** bottom of the info panel, after **Power** and before the legal
  note (owner re-order). Press Proof hides it with Effects.
- **Order:** cross-brand sound-alike group first, family register second, then
  the footer.
- **Cross group:** mono eyebrow label (`Screamer-style overdrive`, `BBD analog
  delay`, `Other digital delays`, …); rows are name + mono dims on line 1 and
  `brand · <shared capability>` on line 2. Cap 3. No thumbnails, no counts, no
  per-row prose.
- **Family register:** `Also from <brand>` + inline short tokens
  (`DD-3T · DD-5 · DD-6 · DD-7 · DD-8 · DD-2`), 44 px targets, hover fill,
  inset focus ring. No dims/brand in the register; full names in the accessible
  label.
- **Footer:** one muted `Browse all delays` text button (44 px on mobile).
- **Tap:** exact model → picker with that model name as the query + the target’s
  effect types. The preset is one-shot and consumed by the parent.
- **Tokens:** none new; existing ink/border/accent/spacing/type scale only.
- **Read-only/custom/unknown/utility:** section absent.
- **Design review:** the new pixels need one `design-reviewer` pass (desktop +
  mobile, dark + light) before hand-off.

## Read first (context pack)

- `docs/progress.md`, `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 / §6
- `docs/tasks/F-12-pedal-labels.md` (info-panel section pattern)
- `docs/design.md` → Data model / Info panel / Picker
- `src/lib/similarModel.ts`, `src/lib/similarPedals.ts`
- `src/components/InfoPanel.tsx`, `src/components/Picker.tsx`, `src/App.tsx`
- `src/catalog/schema.ts` (`CatalogPedal`, `EFFECT_TYPES`)
- `e2e/similar-pedals.spec.ts`, `e2e/picker.ts`

## Workstream / boundaries

- Feature workstream: `src/**`, `e2e/**`, this task file,
  `docs/screenshots/F-14-similar-pedals/**`, and the docs hub pages.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, or shared coordinator docs/config.
- Separate branch/worktree; **one PR** (#105); no merge.

## Constraints

- cm is the source of truth; no new runtime dependencies.
- Preserve the approved "Specimen Cover" panel and "Specimen Bench" picker.
- **Design gate:** designer proposal (done) → owner direction → `design-reviewer`
  ≤2 passes on real desktop + mobile, dark + light before/after pixels.
- 44 px targets, visible focus, keyboard reachable, desktop/mobile parity.
- **Read-only share views hide the section entirely.**
- **No total-count E2E assertions**; filter stable items/brands.
- **No analytics/tracking** (F-42 is Phase 5).
- **Performance guardrail:** record bundle delta, picker/canvas frame time, heap
  and share/export size; the ranker is memoised on `[target, plannerVersion]`.

## Acceptance (executable)

- DD-3 shows **Other digital delays** (cross-brand: Alter Ego v2, DD600, ARP-87)
  then **Also from BOSS** with `DD-3T, DD-5, DD-6, DD-7, DD-8`; no DD-3,
  no DD-20/200/500, no colourways.
- OC-5 shows **Other octave pedals** (Joyo JF-12) then **Also from BOSS**
  (OC-3, OC-2). A generic overdrive and an octave+reverb hybrid show no
  category fallback.
- Closing and reopening the picker resets query/brand/effect/stereo/sort; a
  Sounds-like preset then a normal open is clean too.
- Carbon Copy shows **BBD analog delay** (Bucket Brigade, Ana Echo, DM-2) then
  **Also from MXR** (`Mini, Bright, Deluxe`), excluding the 10th Anniversary.
- JHS 808 shows **Screamer-style overdrive** (3 Series Screamer, SD-1); a generic
  overdrive is not suggested.
- Tapping a row/token opens the picker on that exact model (query = name) with
  the effect type applied; the footer opens the broad list with an empty query.
- A re-tap after closing re-applies the preset and resets query/brand/sort/stereo.
- No section for a custom part, unknown part, utility-only planner item, or a
  generic drive with no evidence; **no section in a read-only share**.
- No scene/document/share change: share remains v5 and the existing share/scenes
  specs stay green.
- Before/after screenshots desktop + mobile, dark + light; interaction GIFs.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; touched E2E
  green on desktop + mobile.
- Feature demo: deployed PR preview + exact steps + GIF (selection state cannot
  be encoded in a share link).
- `Docs: hub /features /changelog /help · map updated`.

## Review record (2026-11-10)

- **Owner scope v1:** info-panel browse-on-tap; implemented flat shared-effect
  list; design-reviewer 2/2 and code-reviewer 2/2 on that version.
- **Owner rejected v1 (2026-11-10):** “similar should be DD-5 but also other
  digital delays from other brands — something smarter.” Price explicitly out of
  scope (would need scraping/assumptions).
- **Pedal-domain expert:** family → circuit/algorithm → subtype tiers; curated
  maps; no broad-effect fallback; catalog coverage caveat (planner overlay untagged;
  TS9/RAT/Flashback/Canyon/BigSky absent).
- **Designer:** recommended **Family Register** (inline lineage + cross rows +
  browse-all); owner delegated the UX call.
- **v2 implemented:** `similarModel.ts` + grouped `similarPedals.ts` +
  Sound Register UI + exact-model preset.
- **design-reviewer v2:** R1 approve-with-changes (persistent affordance, group
  hierarchy, neutral circuit label) → R2 **approve**; remaining nits (chevron/
  dims gutter, light label tier) deferred.
- **code-reviewer v2:** R1 changes-required (dead family regexes, wrong DM
  override ids, dead circuit defs, predecessor order, preset comment) → fixed;
  R2 changes-required (tape-echo/Big Muff circuits unreachable) → fixed by
  removing the defs and adding a reachability test. **≤2-pass cap reached**; the
  test suite is the re-check (no third pass).
- **Checks:** lint / typecheck / **1,102 tests** / build **JS 359.92 kB gzip
  (+4.77), CSS 18.09 (+0.31)** / e2e **452 tests (451 passed + 1 known interaction flake; 14 skipped)** /
  docs hub 24/24. The export F-16 outline flake passed 3/3 alone; the
  viewport-focus double-click is the documented pre-existing flake. **Perf:** rank 0.3–2.6 ms on the merged 8,857-row catalog (memoised on
  `[target, plannerVersion]`), row→picker median ~51 ms, heap 37.8 MB
  (DD-3 + picker), share/export unchanged (share v5, no new key).
- **code-reviewer follow-up (2026-11-12):** approve-with-changes (unknown
  delay/reverb subtypes were leaking into the broad tier; stale comments; a
  preset-key edge) → dropped delay/reverb from the category fallback, added
  DD-20/TE-2 digital overrides, monotonic preset keys, and capability tests.
  Test suite is the re-check (no second review loop).
- **Owner follow-up (2026-11-12):** the picker reset bug (filters persisted on
  close) was fixed by a pre-paint reset on open (designer consulted); a broad
  category fallback (`Other octave pedals`, etc.) was added for single-effect
  targets. POG2 remains empty until a catalog-lane EHX POG/Pitch Fork backfill.
- **Evidence:** `docs/screenshots/F-14-similar-pedals/` (before/after desktop +
  mobile, dark + light; panel/picker detail; hover; custom/read-only hidden;
  octave category state; filter before/after; interaction GIFs).
