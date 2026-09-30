# P0-05: Catalog schema + import transformer + synthetic seed

**Phase:** P0 · **Status:** todo · **Model:** build-strong

## Goal
Our own catalog schema (zod) with types + loaders exists per design.md, plus a generic one-off transformer that converts an external catalog JSON into our schema, plus a synthetic seed (~50 pedals incl. a few supplies, ~10 boards) with procedural PNGs, usable in fresh clones and CI.

## Read first (context pack)
- `docs/design.md` §Data model, §Assets & catalog
- `docs/decisions/003-catalog-data.md` (whole file — provenance rules are binding)
- `docs/requirements.md` F7 (custom pedal fields the schema must anticipate)

## Constraints
- **Provenance rule (binding):** no third-party dataset names/URLs in source code, commits, filenames, comments, or shipped assets. The transformer is generic (`tools/catalog-transform`) and takes input/output paths as CLI args.
- **Synthetic seed is committed (B3/S2):** `tools/catalog-transform --seed` generates a deterministic, license-clean seed (fictional brands, no third-party images) that fresh clones and CI can run against. **The seed ALSO generates procedural 800/350 PNGs** for every synthetic pedal/board (simple geometric shapes — a colored rounded rectangle with a label) written to `public/pedal-assets/` and committed. This is what exercises the real image-loading, lazy-load, and canvas-export paths from P1 onward — otherwise those stay untested until real assets arrive (S2). The dataset-derived placeholder (real pedals/images, gitignored in `public/dev-assets/`) is an optional local overlay — never a build dependency.
- **Procedural PNG rendering is SVG→sharp (S2), NOT node-canvas:** draw each synthetic pedal as an inline SVG string (rect + `<text>` label), then rasterize with `sharp` (already a P2-04 tool) to 800/350 PNG. This avoids the node-canvas/cairo native dependency (a CI binary risk and against the lean mandate) and is byte-deterministic for the "identical PNG bytes" check. **Font determinism (R5/S3):** sharp renders SVG `<text>` via librsvg/fontconfig, whose fallback font differs between macOS (commit machine) and Ubuntu (CI) — so embed the label font as a base64 `@font-face` in the SVG (or drop labels to pure shapes) AND **pin the `sharp` version** (an upgrade silently changes committed bytes). **Stopgap note (N1):** procedural drawing is a dev-only placeholder; real images flow through P2-04's asset pipeline (bg removal, trim, resize) — the two tools must not grow competing generation/resize code. P0-05's generator stays minimal and is superseded by P2-04.
- Storage in cm; transformer converts inches→cm (×2.54, 2 decimals).
- Synthetic items get `source: 'synthetic'`; dataset-derived items get `source: 'placeholder'`.
- The synthetic seed includes a few `category: 'supply'` items (power supplies) so the picker/loose-item paths are exercised from P1 (R6/N1).

## Steps
1. `src/catalog/schema.ts`: zod schemas for CatalogPedal / CatalogBoard per design.md (incl. `category`, `jacks.pos`)
2. `tools/catalog-transform/`: CLI that (a) reads an external-format JSON → outputs our schema (stable slug ids, cm, `source` flag via arg, effectTypes/jacks/power default empty), and (b) `--seed` generates the deterministic synthetic seed + its procedural 800/350 PNGs (SVG→sharp — see Constraints)
3. Generate the synthetic seed + PNGs via the CLI and **commit both** (JSON validated by zod; PNGs land in `public/pedal-assets/`)
4. `src/catalog/load.ts`: loads catalog JSON, validates, throws on bad data; build-time validated via a Vitest test using the committed seed
5. **Transformer fixture test (N1):** add a small invented external-format JSON fixture (a few made-up entries) to `tools/catalog-transform/fixtures/` + a Vitest test running the converter on it — so the inches→cm/slug/variant conversion is verified in CI without the owner's dataset

## Acceptance (executable)
- `pnpm test` includes: schema accepts the committed seed, rejects a broken entry, transformer output validates on the invented fixture, inches→cm conversion correct (2.54 factor), synthetic seed is deterministic (two runs → identical JSON + identical PNG bytes)
- A **fresh clone** (no owner files) can run `pnpm test` + `pnpm build` with no external data — verified in CI
- `public/pedal-assets/` contains the committed procedural PNGs and `pnpm dev` serves one (manual check in PR)
- `grep -ri "pedalplayground\|pedal-playground" src tools public` returns nothing

## Notes
Transformer quality-of-life: warn on duplicate slugs, skip entries missing width/height.