# Catalog backfill plan

Strategy + inventory for growing the committed catalog seed to the full,
cleared catalog. Referenced from `docs/roadmap.md` (Catalog data track) and
governed by ADR-003 (sourcing, rights, provenance).

## Legend

| Mark | Meaning |
| --- | --- |
| **V** | `effectTypes` from a **verified override** (`tools/catalog-transform/curated.ts`, base-model slug; variants inherit) |
| **C** | `effectTypes` from the conservative name-keyword **classifier** (`effects.ts`) — correct for descriptive names, unverified for creative ones |
| **—** | `effectTypes: []` by design (a power supply) |
| **!** | **Still needs filling** — mocked image and/or unverified spec/effectTypes |

> **Everything below carries a mocked image today** (procedural PNGs,
> `source: 'placeholder'`). Real images are the single launch blocker and are
> never committed until cleared (ADR-003).

## Current state (committed seed)

**207 pedals · 13 brands · 10 boards**; `source: 'placeholder'`; mocked images;
`effectTypes` present for **200/207** (the 7 blanks are all power supplies).

| Brand | Total | V | C | — | Notes |
| --- | --- | --- | --- | --- | --- |
| BOSS | 41 | 4 | 36 | 1 | PSM-5 is a supply |
| Electro-Harmonix | 18 | 10 | 8 | 0 | |
| Walrus Audio | 18 | 17 | 0 | 1 | Aetos is a supply (corrected) |
| Keeley | 18 | 17 | 1 | 0 | |
| EarthQuaker | 18 | 17 | 1 | 0 | |
| JHS | 18 | 2 | 16 | 0 | |
| TC Electronic | 18 | 8 | 10 | 0 | |
| Mooer | 18 | 18 | 0 | 0 | amp-in-a-box preamps |
| MXR | 18 | 3 | 14 | 1 | CAE Power System is a supply |
| Joyo | 18 | 6 | 12 | 0 | |
| Big Joe | 2 | 0 | 0 | 2 | supplies |
| Behringer | 1 | 0 | 0 | 1 | supply |
| Effects Bakery | 1 | 0 | 0 | 1 | supply |
| **Total** | **207** | **102** | **98** | **7** | |

The 10 pilot brands (BOSS … Joyo) had their creatively-named pedals verified
against official sources; the 3 remaining brands (Big Joe, Behringer, Effects
Bakery) are power supplies with `effectTypes: []` by design.

## Missing (future backfill)

- **All models & brands beyond the 13-brand slice.** The seed is a deterministic
  top-brands slice; the full list is produced by re-running the importer with
  higher limits — see _How to run_. The source has ~8.5k models / ~250 boards
  (ADR-003); the committed seed intentionally covers a small, representative set.
- **Verified specs.** Dimensions are real (from the source); `power` and `jacks`
  are **not yet populated** in the seed. The pilot research produced them, but
  our jack model only allows `in | out | exp | power` while real pedals have
  `send`, `return`, `exp-in`, `exp-out`, `midi`, `ctrl` — **resolve the jack-kind
  vocabulary before backfilling jacks** (schema/task; ADR-003 §Data model).
- **Per-item provenance.** Today provenance is the coarse `source` tag. Planned
  enrichment: per-item source, last-verified date, and confidence
  (ADR-003 §Sourcing, rights & ingestion).
- **Cleared images.** Replace all mocked PNGs (launch gate; owner/P2-06).

## Backfill model (steps — same as the product plan)

1. **Discover** — enumerate the full catalog (importer without caps).
2. **Extract facts** — brand, model, footprint dimensions (public facts only).
3. **Normalize** — inches→cm, stable slug ids, flat duplicates→`variantOf`.
4. **Derive our content** — `deriveEffectTypes()` (verified override → classifier)
   and `deriveCategory()`; no guessing.
5. **Verify** — official manufacturer sources first; where the classifier is
   wrong for a creative name, add a **verified override**; keep `unknown` over a
   wrong value.
6. **Provenance** — record source/date/confidence per item (planned field).
7. **Clear images** — only then flip `source` and publish (launch gate).

## How to run

```sh
# Grow the seed to the full catalog (external input file is off-repo by design)
pnpm catalog:import --input <pedals.json> --boards <boards.json> \
  --brand-limit 999 --top-brand-cap 999 --per-brand-cap 999 --board-limit 999
pnpm catalog:seed        # (re)render mocked PNGs
pnpm catalog:reclassify  # re-apply taxonomy/category (no external input needed)
```

Hooks that keep this honest: a committed-data **no-drift** test (seed == fresh
`deriveEffectTypes`/`deriveCategory`), a **no-dead-curated-keys** test, and a
committed-image **byte-determinism** test.

## Repercussions addressed

- **Dedup / variants:** flat colorways are collapsed to `variantOf` links; a
  variant always inherits its base's types and is never emitted without its base.
- **Units:** cm is the storage unit; conversion is `× 2.54` at import only.
- **Provenance rule:** no source name/URL ever enters code, commits, filenames,
  or shipped assets; the audit trail lives in ADR-003 only.
- **Schema originality:** our model is not a rename of the source (ADR-003
  §Schema originality); mocked images mean no third-party asset is reused.
- **Launch gate:** the seed stays `placeholder` until images are cleared, so an
  uncleared catalog can never ship by accident.
