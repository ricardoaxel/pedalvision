# catalog-transform

One-off dev CLI (ADR-003) that imports an external catalog into our schema
(`src/catalog/schema.ts`) and renders the committed mocked images.

```sh
# Import an external catalog → the committed seed (real facts, mocked images)
pnpm catalog:import --input pedals.json --boards pedalboards.json

# (Re)generate the mocked PNGs from the committed catalog JSON
pnpm catalog:seed
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
- **`effectTypes` and `category` are name-derived** (the external data has no
  taxonomy). `effects.ts` maps effect keywords in the product name to effect
  types (`overdrive`, `delay`, `fuzz`, …) and `convert.ts` flags power supplies
  by name. Both are conservative best-effort heuristics: creatively-named pedals
  stay unclassified rather than guessed wrong. A real taxonomy is a later data task.

Our stored shape (`id, brand, name, widthCm, heightCm, image, effectTypes,
category`; optional `jacks?`, `power?`, `variantOf?`; `source`) is deliberately
different from the external one.

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
