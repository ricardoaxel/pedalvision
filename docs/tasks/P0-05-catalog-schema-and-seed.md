# P0-05: Catalog schema + import transformer + seed

**Phase:** P0 · **Status:** in review — PR #5 · **Model:** build-strong

## Goal
Our own catalog schema (zod) with types + loaders exists per design.md, plus a generic one-off transformer that converts an external catalog JSON into our schema, plus a committed **seed of real catalog facts** (~200 pedals across 10+ brands incl. a few supplies, 10 boards) with **procedurally mocked** 800/350 PNGs, usable in fresh clones and CI. Real (cleared) images remain the single outstanding blocker.

## Read first (context pack)
- `docs/design.md` §Data model, §Assets & catalog
- `docs/decisions/003-catalog-data.md` (whole file — provenance rules are binding; amended 2026-10-14)
- `docs/requirements.md` F7 (custom pedal fields the schema must anticipate)

## Constraints
- **Provenance rule (binding, ADR-003):** never name or link the external source and add **no attribution** anywhere — source code, commits, filenames, comments, or shipped assets. The transformer is generic (`tools/catalog-transform`) and takes input/output paths as CLI args.
- **Committed seed = real facts + mocked images (owner decision, 2026-10-14):** the seed uses real brand names, product names, and footprint dimensions (a curated subset of the full catalog); **all images are procedurally mocked** (no third-party image files are downloaded, committed, or served). Fresh clones and CI run against the committed seed with no external data. The dataset-derived items get `source: 'placeholder'`. The earlier invented/synthetic items are removed.
- **Subset now, backfill later:** the committed seed is a deterministic slice (top brands by count — the largest brand is the biggest group — plus a few supplies). Regenerating with higher limits backfills the rest; documented in the transformer README and the follow-up below.
- **Procedural PNG rendering is SVG→sharp (S2), NOT node-canvas:** draw each item as an inline SVG string (rounded rect + a bitmap-font **shape** label — not `<text>`), then rasterize with `sharp` (added here as a dev-only tool, pinned exactly to keep committed bytes stable; P2-04 will reuse it) to 800/350 PNG. The bitmap label (no fontconfig) + pinned sharp make the output byte-reproducible across macOS/Ubuntu. This is a dev-only stopgap, superseded by P2-04's real image pipeline.
- Storage in cm; transformer converts inches→cm (×2.54, 2 decimals).
- Supply items get `category: 'supply'` (heuristic on the name) so the picker/loose-item paths are exercised from P1 (R6/N1).
- **Effect types are name-derived (P0-05 follow-up):** the external catalog carries no effect taxonomy, so `effectTypes` is a deterministic keyword classifier (`tools/catalog-transform/effects.ts`) — like the supply heuristic. It is intentionally conservative: creatively-named pedals (e.g. "Julia", "Morning Glory") stay unclassified rather than guessed wrong, so ~half the seed is classified; a committed-data test guards no drift. A real effect taxonomy is a later data task.

## Steps
1. `src/catalog/schema.ts`: zod schemas for CatalogPedal / CatalogBoard per design.md (incl. `category`, `jacks.pos`)
2. `tools/catalog-transform/`: CLI with two commands — `import` (external array `{Brand,Name,Width,Height}` → our schema: stable slug ids, cm, `source` flag via arg, `jacks` empty, `effectTypes` derived by the name-keyword classifier `effects.ts`, then deterministic subset selection) and `seed` (render the mocked 800/350 PNGs from the committed catalog JSON)
3. Import the seed subset + render the PNGs via the CLI and **commit both** (JSON validated by zod; PNGs land in `public/pedal-assets/`)
4. `src/catalog/load.ts`: loads catalog JSON, validates, throws on bad data (incl. duplicate ids and dangling `variantOf`); build-time validated via a Vitest test using the committed seed
5. **Transformer fixture test (N1):** an invented external-format JSON fixture in `tools/catalog-transform/fixtures/` + Vitest tests running the converter/selector on it — so inches→cm/slug/variant/selection are verified in CI without the owner's input file
6. **Backfill note:** record (README + progress.md follow-ups) that re-running `import` with higher limits grows the seed to the full catalog — the remaining blocker is real images only.

## Acceptance (executable)
- `pnpm test` includes: schema accepts the committed seed, rejects a broken entry; transformer output validates on the invented fixture; inches→cm conversion correct (2.54 factor); mocked images are deterministic (two runs → identical PNG bytes) and the committed PNGs match a fresh generation byte-for-byte
- A **fresh clone** (no external/owner files) can run `pnpm test` + `pnpm build` with no external data — verified in CI
- `public/pedal-assets/` contains the committed mocked PNGs and `pnpm dev` serves one (manual check in PR)
- `grep -ri` for the source name returns nothing in `src tools public` (no provenance leak, no attribution)
- `effectTypes` in the committed seed equals a fresh `classifyEffects(name)` for every pedal (no drift); the classifier has unit tests incl. a power-box model-number false-positive guard

## Notes
Transformer quality-of-life: warn on duplicate slugs, skip entries missing brand/width/height, drop variants whose base is absent.
