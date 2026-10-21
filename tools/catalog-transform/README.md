# catalog-transform

One-off dev CLI (ADR-003) that imports an external catalog into our schema
(`src/catalog/schema.ts`) and renders the committed mocked images.

```sh
# Import an external catalog → the committed seed (real facts, mocked images)
pnpm catalog:import --input pedals.json --boards pedalboards.json

# (Re)generate the mocked PNGs from the committed catalog JSON
pnpm catalog:seed

# Recompute effectTypes + category of the committed JSON in place (curated + classifier)
pnpm catalog:reclassify

# Promote recorded direct brand image URLs to the rendered image (mock = fallback)
pnpm catalog:resolve-images
```

## Provenance rule (binding)

Never name or link the source anywhere — code, commits, filenames, comments, or
shipped assets. Input/output paths are always explicit CLI args; provenance
lives only in `docs/decisions/003-catalog-data.md`. **No attribution.**

## External format (the CLI's input shape; no third-party data ships in this repo)

An array of rows; dimensions in **inches**:

```json
[
  { "Brand": "Acme", "Name": "Big Fuzz", "Width": 2.5, "Height": 4.7 },
  { "Brand": "Acme", "Name": "Big Fuzz (Green)", "Width": 2.5, "Height": 4.7 }
]
```

- Dimensions are **inches**; the converter multiplies by 2.54 and rounds to 2
  decimals (cm is the storage unit — design.md).
- Ids are stable slugs built from `brand + name`; a trailing `(...)` becomes a
  colorway linked via `variantOf`. A colorway inherits its **base model's
  footprint** — variant rows with conflicting dimensions are normalized to the
  base (a finish must not change the planned occupied size).
- Rows missing brand/name or width/height are skipped with a warning; duplicate
  slugs are skipped (first wins); variants whose base is absent are dropped.
- **Any external image name is ignored.** We always emit our own mocked name
  (`<id>.png`) — no third-party asset is referenced.

Our stored shape (`id, brand, name, widthCm, heightCm, image, imageSource,
effectTypes, category`; optional `jacks?`, `power?`, `variantOf?`, `sources?`;
`source`) is deliberately different from the external one — see ADR-003 §Schema
originality. `sources` are per-item provenance links (manufacturer/authorized
preferred; ADR-003 §Per-item sources), added by curation — the importer leaves
them off.
`imageSource` (`mock` | `static` | `url`) says *how* the image is provided
(the import always emits `mock`); `source` is the separate rights tag.

## Brand image URLs (`resolve-images`)

Where an item has a **direct-file** official image URL in its `sources`
(`kind: ["image"]`, URL ending in `.jpg/.jpeg/.png/.webp/.gif/.avif` — not an
HTML product page), `pnpm catalog:resolve-images` promotes it to the rendered
image (`imageSource: "url"`, `image` = the URL). Items without one keep the mock.
Deterministic and idempotent; run it **before** `seed`, which then only draws the
remaining mocks and prunes the stale PNGs of resolved items. Nothing is
downloaded — only the recorded URL is reused (ADR-003 §Brand image URLs).

## Effect taxonomy & category

The external data has **no** taxonomy, so `effectTypes` and `category` are OURS
(ADR-003 §Effect taxonomy):

- **`effectTypes`** — our vocabulary enum (`EFFECT_TYPES` in
  `src/catalog/schema.ts`: sound effects + non-effect roles like `preamp`,
  `buffer`, `di`, `ab-box`, `amp-modeler`). Resolved by `deriveEffectTypes()`
  (`curated.ts`): a **verified override** for the base model wins (colorway
  variants inherit their base), otherwise a conservative name-keyword classifier
  (`effects.ts`) is used — creatively-named pedals stay unclassified rather than
  guessed wrong.
- **`category`** — `pedal` | `supply`, via `deriveCategory()` (`curated.ts`):
  a verified-supply override (`CURATED_SUPPLIES`) or a name hint. Supplies keep
  `effectTypes: []`.
- **`pnpm catalog:reclassify`** re-applies both to the committed JSON in place,
  so taxonomy/curated changes need no external input file. A no-drift test
  asserts the committed seed equals a fresh derivation for every pedal, and a
  second test asserts every curated key maps to a real seed entry (no dead rows).

## Re-import preserves curation

`import` merges onto the existing catalog by **stable id**: `widthCm`/`heightCm`
(corrected footprints), `sources`, `source` (rights tag), `power`, `jacks`,
`image`/`imageSource`, and `links` are carried over for surviving ids (new ids
get the converter defaults). So `--source` tags
**newly imported items only** — an existing id keeps its curated provenance tag.
Boards are only read/written when `--boards` is passed (a pedals-only import
never blanks `boards.json`). An id that leaves the selection is **not** dropped
silently — `import` throws unless `--allow-removals` is passed. A malformed
existing catalog fails loudly rather than being silently overwritten.

## Selection

`import` converts the full catalog, then keeps a deterministic **subset** so the
repo/CI stay lean: the top `--brand-limit` brands by pedal count (the largest
brand contributes the biggest group), plus a few power supplies so the picker
has data. The **verified override set** (`curated.ts`) is always kept regardless
of the caps, so the seed reproduces the curated models and every curated key
stays a real entry. Tune with `--brand-limit/--top-brand-cap/--per-brand-cap/--supply-limit/--board-limit`.

**Follow-up — backfill:** this seed is a slice. To grow it, re-run `pnpm
catalog:import` with higher limits (or a different brand set) and `pnpm
catalog:seed`. The full catalog is imported the same way; nothing else changes.

## Mocked images

`seed` draws each item as an SVG (rounded rectangle + bitmap label — no `<text>`,
so no font dependency) and rasterizes with a pinned `sharp`, giving
byte-reproducible PNGs. Real images are the one piece gated on clearance
(ADR-003); the generator is a dev-only stopgap, superseded by P2-04.

# Master inventory (P5-01)

Builds the off-runtime candidate list from the two discovery lists
(`{ Brand, Name, Width, Height }`, inches). It normalizes brands/names, mints
stable slugs (a `+` stays a meaningful token), dedupes, links colorways with
`variantOf` when the base is present, and assigns Tier A/B/C. Tier A is capped
at **1,850 pedals + exactly 150 boards**; the first 2,000 catalog items are
~1,850 pedals + 150 boards.

```sh
pnpm catalog:inventory --pedals pedals.json --boards boards.json \
  [--out data/catalog/inventory.json] [--seed-dir src/catalog/data] \
  [--generated-at 2026-10-21]
```

The output is `data/catalog/inventory.json` (off-runtime; not imported by the
app). It never stores external image filenames. Caps live in `limits.ts`.

# Seed validation (P5-01)

Classifies every committed seed item as `keep` / `repair` / `replace` / `drop`
with reasons (missing mandatory field, duplicate, implausible dimensions, image
not hosted/public-asset, missing static rendition).

```sh
pnpm catalog:validate-seed [--catalog-dir src/catalog/data] \
  [--assets-dir public/pedal-assets] [--out data/catalog/seed-validation.json]
```

The seed is **kept**; the report tells P5-03 what to repair or re-source. A
`replace` verdict means the image is mock/url/placeholder (the P5 policy requires
a self-hosted `public-asset`), not that the facts are wrong.

# Raw research archive (P5-01)

Research writes `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`
first (schema `src/catalog/rawSchema.ts`); the runtime catalog is a projection.
See `docs/catalog/raw-research-record.md` and the
`data/catalog/fixtures/eventide-h90.json` stress fixture.
