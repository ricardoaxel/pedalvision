# ADR-009 — Planner fallback fill (non-commercial bulk import)

**Status:** accepted · **Date:** 2026-10-29 · **Owner:** approved in session

## Context

The curated catalog is complete for the reviewed brands, but it is far smaller
than the planner dataset the owner wants to ship. Continuing per-item art and
image research is not cost-effective for this project, and the owner does not
intend to commercialize it. The owner asked to fill the catalog with the
external planner dataset, converted to our AVIF renditions, and mark the new
items as pending.

This conflicts with the earlier P5 policy:

- 2,000 hosted pedals / 4,000 files / 300 MB safety cap (until P5-05);
- planner images only as a recorded last-resort source, not the majority;
- per-item research and quality gates before shipping an asset.

## Decision

For this non-commercial build only:

1. Import **missing** items from the external planner dataset; keep all existing
   curated records and assets unchanged. The owner extended this to the
   **pedalboards** dataset as well (248 missing boards): use the planner board
   images as pending placeholders, overriding the generated-board-art rule for
   this non-commercial build.
2. Use the **800 px** source images, converted to our **AVIF 800 + 350**
   renditions (quality 70).
3. Mark every imported item:
   - `imageProvenance.kind: "planner"`
   - `imageProvenance.status: "pending-replacement"`
   - per-item `sources[]` with the image URL;
   - `confidence: "unsure"` and an explicit unverified note.
4. Raise the hosted-image caps to fit the fill (9,000 pedals / 18,000 files /
   1,200 MB; boards 400 / 800 files / 40 MB).
5. Do not present these as verified catalog facts. Specs are planner
   footprints only; effect type is the generic `utility`; the images are
   placeholders and are counted as source gaps.

## Consequences

- The catalog becomes visually complete but includes many unverified planner
  records and a planner-majority image set.
- These assets are **not cleared for commercial use** and must be replaced
  before any commercial launch. The attribution/takedown page still applies.
- The deployment is near the Cloudflare Pages file-count limit (~17.9k files
  for pedals alone) and grows the repo by roughly 600–800 MB.
- Validation caps and the asset ledger must reflect this owner waiver; future
  agents must not treat the filed-out catalog as verified research.
