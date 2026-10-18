# P2-04: Asset-pipeline tooling

**Phase:** P2 · **Status:** todo · **Model:** build-cheap

## Goal
A **dev-only CLI** (`tools/asset-pipeline/`) that turns a **raw source image** into
the two committed renditions the app serves — `public/pedal-assets/{pedals,boards}/{800,350}/<slug>.png`
(800 = master, 350 = thumb) — plus a **JSON draft** catalog entry for the existing
catalog transformer/seed. It **removes the background to transparency**, **trims**
the transparent/spare borders, preserves the **true aspect ratio** (scale the long
edge to 800 / 350), and names the file with a safe `IMAGE_PATTERN` slug. This
replaces today's manual/placeholder image flow (P0-04 created the folders/fixtures;
`catalog-transform seed` draws mocks). Images are the single rights-gated part
(ADR-003) — the tool processes a file the operator already has the right to use; it
**never downloads/scrapes** anything.

## Read first (context pack)
- `docs/roadmap.md` P2-04; `docs/phase-guide.md` P2 row; `docs/tasks/README.md`.
- `docs/design.md` §Folder structure (`tools/asset-pipeline/` = image processing:
  bg removal, trim, resize, JSON draft) + §Assets & catalog (two renditions;
  `imageSource` `mock|static|url`; `assetUrl()`), §Data model
  (`CatalogPedal`/`CatalogBoard`).
- `docs/decisions/002-hosting-and-assets.md` (Pages-shipped, same-origin,
  pre-resized with sharp → 800 + 350; no runtime image service) and
  `docs/decisions/003-catalog-data.md` (rights-first; **no scraping**; provenance
  lives in ADR-003 ONLY; `static` = a committed file; the true-scale bar = a
  top-down, tightly-cropped cutout on a transparent/neutral background).
- `docs/catalog-backfill.md` §Image status & acquisition (where the pipeline fits:
  it produces a **candidate `static`** asset; `source` stays `placeholder` until
  cleared/launch).
- `src/catalog/schema.ts` (`IMAGE_PATTERN`, `IMAGE_SOURCES`, `SOURCE_TAGS`,
  `CatalogPedalSchema`/`CatalogBoardSchema`), `src/lib/cdn.ts` (`assetUrl`),
  `public/pedal-assets/README.md` (layout + URL contract).
- `tools/catalog-transform/` — the sibling dev CLI's conventions
  (`index.ts` arg parsing, `slug.ts` `toSlug`, `image.ts` `renditionPixels`,
  `seed.ts` stale-PNG pruning), `tools/catalog-transform/README.md`.
- `package.json` (scripts; `sharp` is a pinned devDependency), `tsconfig.tools.json`
  (tools typecheck), `vite.config.ts` (Vitest picks up `tools/**/*.test.ts`; only
  `e2e/**` is excluded), `.gitignore` (`/assets/` = raw input, gitignored).

## Constraints
- **Dev-only tooling.** Must not change app runtime or ship in the bundle; must not
  be imported by `src/`. The repo must build/test/e2e with **no external files** and
  without ever running the pipeline.
- **Minimal dependencies is a hard constraint.** Use **`sharp` only** (already
  pinned). **No new dependency** — background removal is a deterministic
  corner-sampled flood fill, not an ML model (note: if a real dep were ever needed
  it must be justified here or in a new ADR).
- **Rights-first (ADR-003):** no scraping/download; provenance named in ADR-003
  ONLY — never in code, commits, filenames, comments, or public assets. No external
  dataset names anywhere.
- **cm is source of truth / true-scale:** preserve aspect, don't pad/letterbox with
  margins (the renderer stretches the cutout to the item's exact cm footprint).
- **Deterministic** outputs (stable slug filenames, reproducible sizes).
- **Never run anything with `--overwrite`/force flags in the repo root**; do not
  touch `docs/` from code. The tool writes only under `--assets-dir` and the
  `--draft` path.
- **Do not commit any new image assets** in this task (the pipeline is exercised in
  temp dirs in tests). The committed-image tests (`seed.test.ts`) must stay green.
- Interaction to document: `catalog-transform seed` **prunes** any PNG in the
  rendition dirs that is not referenced by the catalog — a processed `static` asset
  must be registered (via the draft) before re-running `seed`.
- **Not design-affecting** (no UI) → the design gate does **not** apply. If anything
  user-visible changes, follow AGENTS.md §Design gate.
- `scripts/assets:sync` is R2-era and deferred — **do not create it**.

## Steps
1. **Create this task file** (done).
2. **Pure logic + unit tests** (no image/fs I/O in unit tests):
   - `pixels.ts`: `sampleBackgroundColor` (average of the 4 corner samples),
     `isBackground` (per-channel tolerance), `removeBackground` (BFS flood fill from
     the borders → alpha 0), `trimBounds` (bounding box of non-transparent pixels;
     `null` when fully transparent). Tests on tiny synthetic RGBA buffers.
   - `naming.ts`: `RENDITIONS = [800, 350]`, `kindDir(kind)`, `slugId(brand,name)`
     (reuses `toSlug`), `imageFilename(id)` (asserts `IMAGE_PATTERN`),
     `fitToLongEdge(w,h,size)`, `outputPath(assetsDir,kind,size,file)`. Tests incl.
     aspect/rounding + `IMAGE_PATTERN` compliance.
   - `draft.ts`: `buildDraftEntry(...)` → a schema-valid `CatalogPedal`/`CatalogBoard`
     (`imageSource: "static"`, `source` configurable default `placeholder`,
     `effectTypes: []`, `category` for pedals). Tests (valid + rejects bad slug).
3. **Image processing** (`render.ts`, sharp; buffers only, no paths):
   `renderRenditions(input: Buffer, {tolerance})` → `{ 800: Buffer, 350: Buffer }`:
   ensureAlpha → raw → sample bg → knockout → trim → resize long edge to 800/350 →
   PNG. Deterministic; a buffer-level test asserts PNG signature + dimensions.
4. **CLI** (`index.ts`, `node --experimental-strip-types`): parse args
   (`--input --kind --brand --name [--id] --width-cm --height-cm
   [--category] [--source] [--variant-of] [--assets-dir] [--draft] [--tolerance]`),
   read the input, render, `mkdir -p` + write both PNGs into
   `public/pedal-assets/{kind}/{size}/`, then write/print the draft JSON.
5. **README** (`tools/asset-pipeline/README.md`): usage, the output + draft
   contract, the bg-removal approach/limits, the `seed` pruning interaction, and the
   ADR-003 rights rule.
6. **npm script** (only if useful): add `asset:process` to `package.json` (no dep,
   no lockfile change).
7. **Verify**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
8. **Code review** (light, source-scoped; **HIGH-RISK** = build tooling / new
   script → run the ≤2-pass `/code-review-loop`). Fold findings; record in
   `docs/progress.md`.
9. **Docs + PR**: reconcile `docs/progress.md` + `docs/roadmap.md` + this file; open
   **one** PR to the full standard (no Screenshots section — no UI change; ≤3 owner
   hints; review-round digest). **Do not merge.**

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: `pixels` — background sampling, tolerance boundary, flood fill removes
  only **border-connected** background (an interior same-colour pixel survives),
  `trimBounds` bounds math + the fully-transparent (`null`) case.
- Vitest: `naming` — `kindDir`, `imageFilename` (valid + rejects an unsafe id),
  `fitToLongEdge` (portrait/landscape/square, min 1px), `outputPath`.
- Vitest: `draft` — produces a schema-valid `static` entry (kind both) and rejects
  an invalid id; `render` — output buffers are PNGs at the expected long-edge sizes
  (and an all-background frame is rejected, not written as an invisible asset).
- Manual/grep: the tool is dev-only (`tools/`), no `src/` import, **no new
  dependency** (`package.json` deps unchanged; lockfile unchanged); no external
  provenance strings anywhere in `tools/asset-pipeline/`.
- Manual: running the CLI on a temp raw PNG writes `{800,350}` PNGs of the right
  pixel sizes into the target dirs and prints/writes a valid draft.

## Notes
- **Background removal is a deterministic corner-key** (average of the 4 corners +
  a flood fill from the borders within `--tolerance`), not ML. It is exact for
  solid/neutral backgrounds and top-down cutouts (the ADR-003 true-scale bar);
  angled/hero/shadowed product photos still need manual cropping — documented, not
  a blocker (the seed keeps its mock for those).
- The draft is **catalog-shaped** (`imageSource: "static"`) so it can be merged into
  `src/catalog/data/{pedals,boards}.json` and re-`seed`/`reclassify`ed. It is a
  **hand-off**, not an auto-merge: which asset is cleared is a rights decision
  (ADR-003), so the operator merges intentionally.
- `--source` defaults to `placeholder` (an uncleared asset). Flipping to a cleared
  tag is a launch-gate decision (ADR-003 exit criteria), out of scope here.
- Reuses `toSlug` (`tools/catalog-transform/slug.ts`) and the catalog zod schema —
  no duplicated slug/validation logic.
