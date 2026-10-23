# catalog-pipeline

Dev-only P5 catalog build/validate tooling. No runtime dependency; no downloads.

## Layout

```text
data/catalog/legacy/{pedals,boards}.json        frozen 207+10 seed baseline
data/catalog/research/{pedals,boards}/<brand>/<batch>.json  raw (agents write)
data/catalog/{pedals,boards}/<brand>/<batch>.json          mapped (generated)
src/catalog/data/{pedals,boards}.json                      runtime (generated)
data/catalog/registry.json                                 generated manifest
```

## Commands

```sh
pnpm catalog:build             # legacy + raw -> mapped + runtime + registry
pnpm catalog:build --temp-dir /tmp/pv-catalog
pnpm catalog:validate          # schema, ids, mandatory fields, variants, assets, caps
pnpm catalog:check             # build to temp and byte-compare generated files
pnpm catalog:ci                # temp build + validate + uncommitted runtime for CI
pnpm catalog:post-merge        # build + validate + drift check
pnpm catalog:guard-batch-pr    # batch PR may contain raw records + assets only
pnpm catalog:guard-batch-pr --allow-pipeline  # owner-approved pilot + pipeline PR only
pnpm catalog:dry-run           # 3 synthetic pedals + 3 fake control-plane batches
```

## Build contract

- The frozen `legacy` baseline means a rebuild is deterministic even when a batch
  is deleted; files are sorted and JSON is stable.
- A raw batch may replace a legacy id by stable id. Two batches providing the
  same id is an error.
- Projection only maps fields the runtime schema supports; everything else stays
  in the raw file. The static image filename is `<id>.<imageFormat>` (`avif` for
  P5 hosted assets; `png` when the raw record omits `imageFormat`).
- Runtime/mapped files are generated. Brand agents never edit them.

## Validation

- runtime schema + mandatory fields
- catalog-wide duplicate ids
- pedal and board `variantOf` links (missing/self/cycle)
- board footprint plausibility (10–250 cm) and variant base
- static 800/350 renditions exist (`.avif` for P5 hosted assets; `.png` for
  mocks/legacy/fallback — the extension comes from the runtime `image` field)
- hosted-image caps (2,000 pedals / 4,000 files / 300 MB; 150 boards / 300 files / 20 MB, independent)

## CI / post-merge

- PR CI: `pnpm catalog:ci` builds into temp, validates, then writes an **uncommitted**
  runtime into `src/catalog/data` so tests, the app build and Playwright see the
  PR's new items.
- On merge to `main`, `.github/workflows/catalog-build.yml` runs the deterministic
  build and commits generated mapped/runtime files. Batch PRs stay raw + assets only.
