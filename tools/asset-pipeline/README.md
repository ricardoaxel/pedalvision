# asset-pipeline

A **dev-only CLI** (P2-04) that turns a raw, top-down image into the two committed
renditions the app serves, plus a JSON draft catalog entry. It replaces today's
manual/placeholder flow (`tools/catalog-transform seed` draws the mocked images;
P0-04 created the folders/fixtures).

```sh
pnpm asset:process -- \
  --input /path/to/raw.png \
  --kind pedal \
  --brand "BOSS" --name "TR-2 Tremolo" \
  --width-cm 7.3 --height-cm 12.9
```

Or run it directly (like the catalog transformer):

```sh
node --experimental-strip-types tools/asset-pipeline/index.ts --input raw.png \
  --brand "BOSS" --name "TR-2 Tremolo" --width-cm 7.3 --height-cm 12.9
```

## What it does

1. **Background → transparency.** A deterministic corner key: the four corner pixels
   are averaged to a background colour, then a flood fill from the image borders
   turns every border-connected pixel within `--tolerance` (per channel) fully
   transparent. Because it is a *flood fill*, an interior pixel that happens to
   match the background (e.g. white lettering on a pedal) is **kept**.
2. **Trim.** The transparent/spare borders are cropped to the bounding box of the
   remaining opaque pixels.
3. **Resize (true aspect).** The long edge is scaled to `800` (master) and `350`
   (thumb), preserving aspect ratio — **no padding/letterboxing**, because the
   renderer stretches the cutout to the item's exact cm footprint (design.md
   §Assets & catalog; ADR-003 true-scale bar).
4. **Write + draft.** Two PNGs are written to
   `public/pedal-assets/{pedals,boards}/{800,350}/<id>.png`, and a catalog-shaped
   JSON draft is printed (or written with `--draft`). Progress lines go to
   **stderr**, so stdout is pure JSON (`… > draft.json` works).

## Output contract

| Item        | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Pedals      | `public/pedal-assets/pedals/{800,350}/<id>.png`                        |
| Boards      | `public/pedal-assets/boards/{800,350}/<id>.png`                        |
| Filename    | `<id>.png` — must match `IMAGE_PATTERN` (`^[a-z0-9][a-z0-9-]*\.png$`)  |
| Renditions  | long edge `800` and `350`, aspect preserved, alpha PNG                 |
| URL         | `/pedal-assets/{pedals,boards}/{350,800}/<id>.png` via `assetUrl()`    |

`assetUrl()` (`src/lib/cdn.ts`) does **not** URL-encode, so the filename must stay
lowercase/hyphenated/ASCII — the CLI asserts this and refuses an unsafe id.

## The JSON draft

The draft is a **one-entry array** in **our catalog shape**, with
`imageSource: "static"` (a committed file under `public/pedal-assets/`) and
`source: "placeholder"` by default:

```json
[
  {
    "id": "boss-tr-2",
    "brand": "BOSS",
    "name": "TR-2 Tremolo",
    "widthCm": 7.3,
    "heightCm": 12.9,
    "image": "boss-tr-2.png",
    "imageSource": "static",
    "effectTypes": [],
    "category": "pedal",
    "source": "placeholder"
  }
]
```

It is validated against `CatalogPedalSchema`/`CatalogBoardSchema`, so the CLI can
never emit a draft the app would reject. Merge it into
`src/catalog/data/{pedals,boards}.json`, then run `pnpm catalog:seed` (and
`pnpm catalog:reclassify` if you want the taxonomy/category re-derived).

**Why a draft and not an auto-merge:** whether an asset is *cleared* is a rights
decision (ADR-003), so `source` stays `placeholder` unless you pass `--source`.
Flipping it to a cleared tag is a launch-gate decision, not the tool's.

> **Seed interaction.** `catalog-transform seed` **prunes** any `.png` in the
> rendition dirs that the catalog does not reference. A processed `static` asset
> must be merged (via the draft) **before** you re-run `seed`, or `seed` will
> delete it.

## Options

| Flag                     | Default                | Notes                                        |
| ------------------------ | ---------------------- | -------------------------------------------- |
| `--input <file>`         | —                      | required; the raw source image               |
| `--brand <brand>`        | —                      | required                                     |
| `--name <name>`          | —                      | required                                     |
| `--width-cm`/`--height-cm` | —                    | required; the true footprint in cm           |
| `--kind <pedal\|board>`  | `pedal`                | selects the target folder                    |
| `--id <slug>`            | slug(brand + name)     | stable catalog id / filename stem            |
| `--category <pedal\|supply>` | `pedal`           | pedals only                                  |
| `--source <tag>`         | `placeholder`          | rights tag (`SOURCE_TAGS`)                   |
| `--variant-of <id>`      | —                      | pedals only; base model id for a colorway    |
| `--assets-dir <dir>`     | `public/pedal-assets`  | output root                                  |
| `--draft <file>`         | stdout                 | where to write the JSON draft                |
| `--tolerance <0-255>`    | `32`                   | background match tolerance                   |

## Rights & scope (ADR-003)

- **No download / no scraping.** The tool processes a file the operator already has
  the right to use; it never fetches anything.
- Provenance lives in `docs/decisions/003-catalog-data.md` **only** — never in code,
  commits, filenames, or shipped assets.
- Background removal is a deterministic corner key, not ML: it is exact for
  solid/neutral backgrounds and top-down cutouts (the true-scale bar). Angled/hero
  or shadowed product photos still need manual cropping — those items keep their
  mock until a proper cutout exists.

## Layout

```
tools/asset-pipeline/
  index.ts        # CLI: args + filesystem IO
  render.ts       # sharp: knockout → trim → resize (buffers only)
  pixels.ts       # pure: background sampling, flood fill, trim bounds (tested)
  naming.ts       # pure: slug/id, filename, rendition sizes, paths (tested)
  draft.ts        # pure: catalog-shaped draft entry, schema-validated (tested)
  *.test.ts       # Vitest — pure logic + buffer-level sharp (no file IO)
```

Only **`sharp`** (already a pinned devDependency) is used — no new dependency.
