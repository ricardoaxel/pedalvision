# Reference material

Non-authoritative inputs kept for context. **Our plan lives in `docs/` root +
`docs/decisions/`; nothing here overrides it.**

## `pedal-atlas-product-plan.html`

An externally-produced product/business plan for a *pedal directory* ("Pedal
Atlas"). It is **not** our plan and **not** our product: Pedalvision is a
true-scale board **planner**, not a catalog directory + affiliate site. It is
committed because its data-sourcing, rights, and provenance thinking is directly
useful to our catalog track.

**Adopted (folded into our docs — see ADR-003):**

- Source hierarchy: official manufacturer sources first, then reputable
  catalogs, then specialist archives (matches our `pedal-expert` agent).
- AI-assisted extraction **with human review gates** — AI assists and verifies,
  it never invents facts (ADR-003 §Sourcing, rights & ingestion).
- Per-item / per-field provenance + verification dates + confidence; stale-data
  and broken-link monitoring (planned data-model enrichment).
- Image **rights-first** workflow: per-asset license metadata, "publish only
  approved assets", removal process (ADR-003 exit criteria).
- Independent-site disclaimer, affiliate disclosure, and staged monetization
  (v2; non-goal N5 today).

**Not adopted (deliberately):**

- The directory/SEO/affiliate **business pivot** and its Next.js + PostgreSQL +
  Supabase stack — our stack is fixed (ADR-001/002) and the directory is a
  different product.
- Relational normalization (Brand/Specs/Image-asset tables) for v1 — our static
  denormalized JSON is enough until the catalog grows (roadmap; revisit with
  R2/catalog-scale at P2-07).
- Legal/product advice is not ours to act on unilaterally; the launch gate in
  ADR-003 remains the authority.
