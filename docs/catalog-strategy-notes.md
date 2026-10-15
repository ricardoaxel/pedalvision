# Catalog strategy notes

Self-contained summary of the product/data-strategy ideas we **adopted** and
**rejected** for the catalog, in our own words. No external document is
committed (the raw third-party plan was removed — redistribution risk, little
durable value). The **binding** decisions live in ADR-003.

## Adopted

- **Source hierarchy** — manufacturer/authorized sources first, then reputable
  retailer/magazine, then community/vintage archive for corroboration
  (ADR-003 §Sourcing; embodied by the `pedal-expert` agent).
- **AI assists, never invents** — machine extraction/normalization with human
  gates for conflicts, low-confidence records, and dimension spot-checks
  (ADR-003 §Sourcing, rights & ingestion).
- **Per-item provenance** — record the source(s) each fact/image was verified
  against, plus verification date and confidence (ADR-003 §Per-item sources;
  `sources` in the schema).
- **Images are rights-first** — publish only cleared assets, each with
  license/permission evidence and a removal path; **never scrape**; acquire via
  permission / official brand assets / community / own photos
  (ADR-003; `docs/catalog-backfill.md`).
- **Independent site** — brand/model names used factually, no implied
  endorsement; any future affiliate links disclose and are locale-aware (v2,
  non-goal N5).

## Rejected (not our product)

- A **catalog-directory + SEO/affiliate business** and its Next.js +
  PostgreSQL/Supabase stack — Pedalvision is a **true-scale board planner**
  (requirements non-goal N11; stack fixed by ADR-001/002).
- **Relational normalization** for v1 — the static denormalized JSON suffices
  until catalog scale (revisit with R2 at P2-07).
