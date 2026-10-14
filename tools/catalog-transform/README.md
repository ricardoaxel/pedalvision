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
  colorway linked via `variantOf`.
- Rows missing brand/name or width/height are skipped with a warning; duplicate
  slugs are skipped (first wins); variants whose base is absent are dropped.
- **Any external image name is ignored.** We always emit our own mocked name
  (`<id>.png`) — no third-party asset is referenced.

Our stored shape (`id, brand, name, widthCm, heightCm, image, imageSource,
effectTypes, category`; optional `jacks?`, `power?`, `variantOf?`, `sources?`;
`source`) is deliberately different from the external one — see ADR-003 §Schema
originality. `sources` are official per-item provenance links (ADR-003
§Per-item sources), added by curation — the importer leaves them off.
`imageSource` (`mock` | `static` | `url`) says *how* the image is provided
(the import always emits `mock`); `source` is the separate rights tag.

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

## Selection

`import` converts the full catalog, then keeps a deterministic **subset** so the
repo/CI stay lean: the top `--brand-limit` brands by pedal count (the largest
brand contributes the biggest group), plus a few power supplies so the picker
has data. Tune with `--brand-limit/--top-brand-cap/--per-brand-cap/--supply-limit/--board-limit`.

**Follow-up — backfill:** this seed is a slice. To grow it, re-run `pnpm
catalog:import` with higher limits (or a different brand set) and `pnpm
catalog:seed`. The full catalog is imported the same way; nothing else changes.

## Mocked images

`seed` draws each item as an SVG (rounded rectangle + bitmap label — no `<text>`,
so no font dependency) and rasterizes with a pinned `sharp`, giving
byte-reproducible PNGs. Real images are the one piece gated on clearance
(ADR-003); the generator is a dev-only stopgap, superseded by P2-04.
