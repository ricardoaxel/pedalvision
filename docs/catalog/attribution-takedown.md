# Catalog image attribution & takedown policy (P5-01)

**Owner-approved direction: 2026-10-21 (PR #32).** The owner accepts
responsibility for sourcing and publishing catalog images under this policy.
This document is the content/spec for the public attribution + takedown page;
the page ships before launch (P5-04). Governing decision: ADR-003
§Self-hosted public-asset images.

## Policy

- Every shipped catalog image is a **self-hosted static asset** under
  `public/pedal-assets/` (or the P5-05 CDN). No hotlinked images ship in the
  launched catalog.
- Each item keeps the **source URL(s)** it was verified against in the **private**
  raw catalog/ledger (`sources` + `imageProvenance`), **not on the public page**.
  Manufacturer/press pages are preferred; authorized retailers second;
  user/community third; planner/Pedalplayground only as a recorded last-resort
  shipped source (pedals) above generated art. This private source record is what
  lets future batches target the remaining source gaps.
- Catalog images are used for **identification and true-scale planning** only.
  We do not copy descriptions or imply brand endorsement; brand/model names are
  factual references.
- Removal requests are honoured: the affected asset is replaced or dropped, and
  the data record keeps the source history.

## Attribution page (public copy)

> **Catalog image credits**
>
> Pedalvision shows product images to help you plan a pedalboard at true scale.
> Images are sourced from manufacturer/press pages, authorized retailers,
> user/community images, planner/Pedalplayground last-resort images (pedals), or
> our own generated flat art, and are hosted by Pedalvision. Per-item source
> records are kept internally for provenance and improvement. Brand and product
> names are the property of their owners; Pedalvision is an independent planner
> and does not imply endorsement.
>
> If an image or fact is yours and you would like it credited differently or
> removed, open a removal request and we will replace or remove it.

- Implementation: the page shows the generic policy/removal copy above. Per-item
  source URLs stay in the **private** raw catalog/ledger and are **never rendered**
  on the public page. Visible from the app footer/help surface; linked from the
  catalog picker.

## Takedown path (v1, no backend)

1. Open a removal request:
   <https://github.com/ricardoaxel/pedalvision/issues/new?title=Catalog%20image%20removal%20request>
   (or email the contact published on the page once the owner confirms it).
2. Include the item id/URL, the image or fact, and the requested action
   (remove / replace / credit).
3. We acknowledge, remove or replace the asset in the catalog, and record the
   change in the item's provenance. No legal threat is required.

## Quality/rights guardrails

- Candidate order (pedals): official manufacturer/press page → authorized
  retailer → user/community (recorded) → planner last-resort (recorded) →
  generated flat art. Boards: official/authorized reference → generated art;
  planner pixels never. Never bulk-copy descriptions.
- Rejected candidates are kept in the raw archive with the reason, so an image
  can be re-checked without re-researching the model.
- The 2,000-hosted-pedal cap (~4,000 files, ~300 MB) applies until P5-05; board
  images have a separate ~150-board / ~300-file / ~20 MB budget.
- Removal requests take precedence over the cap/budget: the asset is pulled even
  if no replacement is ready.

## Open owner action before launch (P5-04)

- Confirm the public removal contact (email or the GitHub issue link above) and
  the final visible credits-page placement. Until then the GitHub issue link is
  the working contact.
