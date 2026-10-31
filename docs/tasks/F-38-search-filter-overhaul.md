# F-38 — Search/filter overhaul (punctuation/model aliases, tags, sort)

**Phase:** 1 · **Status:** in review — PR #94 · **Model:** light (design gate required)
**Roadmap:** `docs/tasks/feature-roadmap-proposal.md` → Phase 1 / F-38 + Q-03
(“DD-2 search” quick fix). **Baseline:** F-37 merged (#93, `ae0fe84d`).

## Goal

Close the real gaps in the catalog picker's search/filter: a plain lowercase
substring over `"brand name"` currently cannot find `DD-2` from `dd2`, does not
search effect types, and has no sort. Deliver punctuation/model-shorthand
normalization, a small reviewable alias layer, effect-aware text search, a
deterministic user-visible sort, and honest empty/degraded states — without
rewriting the approved picker chrome or touching catalog data.

## Read first (context pack)

- `docs/progress.md` (catalog paused; feature lane open)
- `docs/tasks/feature-roadmap-proposal.md` → §2 Phase 1 (F-38 / Q-03)
- `docs/requirements.md` → “V1 features” F4/F11 + “pedalboard.app” search line
- `docs/design.md` → §Data model (catalog shape), §Responsive approach
- `docs/features/README.md` → F-19 inventory / workflow / impact / known gaps
- `src/components/Picker.tsx`, `src/components/pickerFilter.ts`,
  `src/components/pickerFilter.test.ts`, `src/components/pickerPaging.ts`
- `src/catalog/schema.ts` (read-only), `src/catalog/planner.ts` (read-only),
  `src/state/plannerCatalog.ts`
- `e2e/picker.spec.ts`, `e2e/picker-choka.spec.ts`

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file,
  `docs/screenshots/<task>/**`, and the editable rows of `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, `docs/progress.md`, `docs/roadmap.md`, shared config/deps.
- No catalog schema/data change is needed. If one turns out to be needed, **STOP**
  and schedule a serial coordinator task.
- Separate worktree/branch from `main`; **one PR**; no merge.

## Audit — current behaviour (baseline `ae0fe84d`)

| Axis | Today | Gap |
|---|---|---|
| Query | `trim().toLowerCase()` substring over `"brand name"` | `dd2` ≠ `DD-2`; no slash/hyphen/whitespace folding; no effect-type match; no alias |
| Brand | single `<select>`, exact match | fine; keep (multi-select is an open question) |
| Effect | multi-select chips, OR | fine; keep |
| Sort | none (catalog array order) | no deterministic, user-visible order |
| Empty | “No pedals match. Clear filters” | does not say what is active |
| Degraded | planner overlay failure is silent | user cannot tell curated-only |

## Proposed plan (owner approval pending)

### 1. Normalization (`pickerFilter.ts`, pure)

`normalizeSearch(value)`:

1. `NFKD` normalize, strip combining marks (`\p{M}`) → `Ibañez` = `ibanez`.
2. Lowercase.
3. `&` → ` and `.
4. Replace every run of non-`\p{L}`/`\p{N}` with one space.
5. Collapse spaces, trim. → `DD-2` = `dd 2`, `A/B` = `a b`.

`queryTerms(query)` splits the **raw** query on whitespace first, then normalizes
each chunk, so `DD-2` stays one term (`dd 2`) instead of `dd` + `2`.

`termPattern(term)` builds `\b<group>\s*<group>…\b` from the term's alphanumeric
groups (escaped). This is the key rule: `dd2`/`dd-2`/`DD 2` all match `DD-2`
(`dd 2`) but **not** `DD-20` (`dd 20`), because `2\b` cannot match before `0`.
All terms must match (AND); multi-word queries no longer require contiguity.

### 2. Searchable fields

Per item, memoized once per catalog version:

- `name` (normalized), `brand` (normalized),
- `effects` (normalized `effectLabel()` strings),
- `aliases` (normalized alias targets, see §3).

A term is satisfied if its pattern matches any field (or an alias target).
Effect labels are searchable, so `fuzz` finds `Keeley Angry Orange` even though
its name lacks “fuzz”.

### 3. Alias layer (`src/lib/searchAliases.ts`)

A small, data-only table; **no catalog/schema change**. Initial proposal:

| Alias | Target | Justification |
|---|---|---|
| `ehx` | `electro harmonix` | universal brand abbreviation |
| `eqd` | `earthquaker` | universal brand abbreviation |
| `tc` | `tc electronic` | universal brand abbreviation |

Model shorthand is **not** an alias: `dd2`, `bd2`, `ts9` already resolve through
normalization because the catalog name contains the model token. We will only add
a model synonym where the catalog name genuinely lacks the common name (owner to
confirm the list; see Open questions). The table is unit-tested for shape and
normalized keys.

### 4. Sort (`pickerFilter.ts` + a control in `Picker.tsx`)

- **Relevance** (default): query terms scored per field — name at start >
  name inside > brand > effect > alias; score desc, then brand, name, id.
  **Empty query keeps catalog order (curated first)** — owner decision
  2026-10-30, so the resting picker and existing placement flow are unchanged.
- **Brand A–Z**: brand, name, id.
- **Name A–Z**: name, brand, id.

Comparators use normalized keys and code-unit compare (not `localeCompare`) so
the order is identical in Node and every browser; `id` is the total-order
tie-break. Sort is reset to the default when switching tabs (same rule as the
other filters).

### 5. Filters, empty and degraded states

- Keep the brand `<select>` (single) and the effect chips (multi, OR); do not
  restyle the picker. Add effect/brand aliases to the text haystack.
- Empty: “No pedals match **“dd2”**. Clear filters” (echo the active query and,
  when present, “Filtered by brand/effect.”); Clear filters resets query, brand,
  effects (sort is not a filter and stays) and returns focus to the search field.
- Degraded: **defined, deferred to a coordinator task.** The overlay loader is
  `src/catalog/planner.ts`, which a feature session must not edit. Desired state:
  on overlay failure show a muted inline line, “Full catalog unavailable —
  showing curated gear.” (no spinner, no retry); success stays silent. Requires
  a status field set by the loader, so it is a serial coordinator change, not
  this PR.

### 6. Performance

- Build the normalized search index once per `plannerVersion` (memoized) and
  filter+rank once per `(query, brand, effects, sort)` change (memoized).
- Measure over the full ~8.8k catalog; record query→render ms, bundle delta,
  picker/canvas frame time, and memory in the PR. No regression beyond the
  existing thresholds; no debounce unless the measurement demands it.

## Owner decisions (2026-10-30)

1. **Default order:** Relevance is the default sort; an empty query keeps
   catalog order (curated first). Brand A–Z is a user choice, not the default.
2. **Brand filter:** keep single-select; effect chips stay multi-select OR.
3. **Aliases:** brand abbreviations only (`ehx`, `eqd`, `tc`); model shorthand is
   handled by normalization and no model synonyms ship.
4. **Design direction:** approved as proposed (native Sort select styled like the
   brand select, two-band tools row, chips on their own band, query-echoing empty
   state, muted curated-only note).

## Steps

1. Restate scope + executable acceptance (this file).
2. Designer proposal for the sort control / active-filter and empty/degraded
   states; **owner approves the direction before UI code**.
3. Implement normalization, aliases, effect-aware matching, sort, states in the
   feature worktree; keep `Picker.tsx` chrome, tabs, keyboard/focus, de-stack,
   mobile layout, 350 thumbs, CORS/cache self-heal and F-05 motion unchanged.
4. Unit tests for every normalization/alias/match/sort rule; E2E for
   search → filter → sort → place on desktop + mobile.
5. Design-reviewer ≤2 passes on desktop + mobile, dark + light; fold findings.
6. Code review: ≤1 light pass; the test suite is the re-check.
7. `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
8. Update the F-19 inventory/workflow/impact/known-gaps rows.
9. One PR with the standard sections, feature demo link, and before/after
   screenshots (base `main` vs preview; desktop + mobile; dark + light); no merge.

## Acceptance (executable)

- `dd2`, `DD-2`, `dd-2`, `DD 2` all surface `boss-dd-2-digital-delay` and do
  **not** surface `boss-dd-20-giga-delay` (unit + E2E).
- `ehx` surfaces an Electro-Harmonix pedal (unit + E2E).
- A text query for an effect (`fuzz`) surfaces a pedal whose name lacks the word
  (unit + E2E).
- Brand + effect + query combine; sort is deterministic and stable across
  repeated runs (unit).
- Relevance puts an exact model/name match first; Brand/Name A–Z orders are
  verified (unit).
- Empty query and punctuation-only query behave as documented; the no-match
  state echoes the query + active filters and Clear filters restores the full
  list and returns focus (unit + E2E). The degraded overlay note is deferred to
  a coordinator task (see §5) because it needs `src/catalog/planner.ts`.
- Existing picker behaviour is unchanged: tabs reset filters, keyboard ↑/↓/↵,
  focus trap, mobile sheet/tab bar, de-stack, 350 thumbs, CORS self-heal, F-05
  motion (`picker.spec.ts`, `picker-choka.spec.ts`).
- Performance numbers recorded (bundle delta, query→render ms, frame time,
  memory) with no regression beyond thresholds.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- `pnpm e2e` green (baseline: 950 unit, 338 E2E passed + 11 skipped, JS
  336.20 kB gzip).
- Feature demo link + before/after screenshots embedded; F-19 map updated.
- No edits to catalog/shared/coordinator-only files; one PR; no merge.

## Notes

- Budget: builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k; task
  hard ≤1.1M; 6 h active. Record billed tokens by class.
- Process/rule gaps: propose + run `token-usage-reviewer` with the owner first;
  do not edit rules in this PR.
