# P5-01: Catalog policy, data contract & master inventory

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Establish the owner-approved policy and data contract for the P5 catalog, then build the master inventory. No bulk images and no backfill yet. The end state: ADR-003 reflects the self-hosted public-asset policy; the schema can carry the new metadata; `data/catalog/inventory.json` lists every candidate pedal/brand with dedupe + tiers; the 207-item seed has a validation report (`keep / repair / replace / drop`); the 2,000-hosted-pedal cap is recorded and enforceable.

## Read first (context pack)

- `docs/decisions/003-catalog-data.md` §Self-hosted public-asset images, §Exit criteria
- `docs/catalog-backfill.md` (the P5 plan)
- `docs/roadmap.md` P5-01…P5-05
- `docs/design.md` §Data model + §Assets & catalog
- `src/catalog/schema.ts`, `src/catalog/data/pedals.json`, `tools/catalog-transform/`, `tools/asset-pipeline/`

## Constraints

- **cm only** for stored dimensions; inches are converted at import.
- The 207 seed is **kept** and validated; do not wipe it.
- No bulk image download/processing in this task (P5-02/P5-03).
- `public-asset` + new optional fields require a schema change + migration of existing data; keep the additive rule.
- Do not touch the P4-03 branch/worktree.
- `jacks[]` is **optional enrichment** for catalog data: record `kind`, `edge`, `pos`, `stereo?` when a source exposes it; never invent positions. `pos` is normalized 0..1, but derive it from exact cm (`x / widthCm` on top/bottom, `y / heightCm` on left/right) so measured positions are preserved. If a jack is inset from the edge, note it; add optional `xCm`/`yCm` only if the source requires it.

## Steps

1. Update ADR-003: public-asset policy, `public-asset` tag, attribution/takedown, launch-gate wording, 2,000 cap.
2. Extend the catalog schema (additive): `usage`, `color?`, `notes?`, `year?`, `status?`, `confidence?`, `lastVerified?`, `public-asset` in `SOURCE_TAGS`; keep `jacks.stereo?`.
3. Build `data/catalog/inventory.json` from the 8,557-item discovery list + other `pedal-expert` sources: normalize brand/name, slug, dedupe, collapse colorways to `variantOf`, brand tiers (A/B/C).
4. Mark which inventory items overlap the current 207 seed; preserve curated effect types/sources.
5. Produce `data/catalog/seed-validation.json` for the 207: keep/repair/replace/drop + reasons (missing mandatory field, bad dimensions, bad image, duplicate).
6. Record the **2,000 hosted-pedal / ~4,000 image / ~300 MB** cap in the tooling constants/plan (no enforcement code yet if P5-02 owns it).
7. Surface the owner decisions: public-asset policy + attribution/takedown page, and the `public-asset` tag.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (schema/data changes).
- Inventory exists with counts: total pedals, brands, Tier A/B/C sizes, duplicates removed, overlap with the 207 seed.
- Seed validation covers all 207 items, each with one of keep/repair/replace/drop + reason.
- ADR-003 + roadmap/phase-guide/catalog-backfill agree on the policy, 2k cap, and P5 numbering.
- No image downloads or `public/pedal-assets` changes.

## Notes

- Owner decision (2026-10-21): self-hosted public assets + attribution/takedown; owner accepts responsibility.
- Owner decision (2026-10-21): 2,000 hosted pedals max until P5-05.
- Optional jack positions are a nice-to-have, never a blocker.
