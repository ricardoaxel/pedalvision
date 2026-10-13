# catalog-transform

One-off dev CLI (ADR-003) that converts an external catalog JSON into our
catalog schema (`src/catalog/schema.ts`) and generates the committed synthetic
seed.

```sh
# external catalog → our schema
pnpm catalog:transform --input external.json --output src/catalog/data/pedals.json --source placeholder

# synthetic seed JSON + procedural PNGs (committed)
pnpm catalog:seed
```

## Provenance rule (binding)

Never name or link a third-party dataset in code, commits, filenames, comments,
or shipped assets. Input/output paths are always explicit CLI args; provenance
lives only in `docs/decisions/003-catalog-data.md`.

## External format (invented — this repo ships no third-party data)

An object keyed by display name:

```json
{
  "Big Fuzz": { "brand": "Acme", "widthIn": 2.5, "heightIn": 4.7, "effects": ["fuzz"] },
  "Big Fuzz (Green)": { "brand": "Acme", "widthIn": 2.5, "heightIn": 4.7 }
}
```

- Dimensions are **inches**; the converter multiplies by 2.54 and rounds to 2
  decimals (cm is the storage unit — design.md).
- Ids are stable slugs built from `brand + name`; a trailing `(...)` becomes a
  colorway linked via `variantOf`.
- Entries missing width/height are skipped; duplicate slugs are skipped with a
  warning (first occurrence wins).
- `image` is normalized to a safe lowercase-hyphenated `.png` filename.

## Synthetic seed

`pnpm catalog:seed` writes `src/catalog/data/{pedals,boards}.json` and the
procedural `public/pedal-assets/{pedals,boards}/{800,350}/*.png`. It is
deterministic: fixed literals plus a pure FNV-1a hash (no `Math.random`). Images
are drawn as SVG shapes (no `<text>` — no fontconfig dependency) and rasterized
with a pinned `sharp`, so the bytes are reproducible. Stopgap only — P2-04 owns
real asset processing; this generator must not grow into a second pipeline.
