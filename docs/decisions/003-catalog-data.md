# ADR-003: Catalog data & asset strategy

**Status:** Accepted (2026-09-22) — ⚠️ MUST BE REVISITED BEFORE ANY PUBLIC LAUNCH

## Context
The app needs pedals/boards with real footprint dimensions + top-down transparent PNGs. Research (Sep 2026) found no cleanly-licensed open dataset. The only comprehensive community dataset (PedalPlayground's public GitHub repo: ~8.5k pedals, ~250 boards, inches + 350/800px PNGs) has **no LICENSE file** → default copyright (all rights reserved); its maintainer has objected to unpermissioned reuse before (repo issues #1875, #212, #2285).

## Decision
1. **Dev placeholder:** a small subset of that dataset is used for **local development only**, to unblock P0–P3. Rules:
   - Never deployed to any public URL, never committed to a public repo.
   - **Never referenced in source code, commits, filenames, comments, or shipped assets** (owner instruction, 2026-09-22). Provenance is documented ONLY in this file.
   - Lives in `public/dev-assets/` + a dev-only catalog file, both gitignored.
   - **Deterministic synthetic seed (B3/N1/S2):** additionally, a license-clean, procedurally-generated seed (fictional brands/pedals, no third-party images) is **generated once by the CLI and committed as static JSON + procedural 800/350 PNGs** — NOT generated at build time (N1). This lets fresh clones and CI run tests and render without the owner's machine, and exercises the real image-loading/export paths from P1 (S2). The dataset-derived placeholder is an optional local overlay on top of the synthetic seed.
2. **Our own schema** (design.md §Data model) is source-agnostic. A generic one-off transformer (`tools/catalog-transform`) converts external catalog JSON → our schema (inches→cm, name-keys→stable slugs, flat duplicates→model+variant). We do not inherit external conventions.
3. **Before public launch**, the catalog must contain cleared assets only, via (in priority order):
   a. Permission from the dataset maintainer (GitHub issue, attribution if required) — owner action
   b. Brand outreach (verified model: pedal brands onboard planner sites as free marketing — Guitar Pedal X × Pedaltrain, Sep 2023: brands join/send updates via email; 395 brands listed)
   c. Community submissions with moderation + attribution (v2 feature; pipeline from P2-04)
   d. Own photos (pedals we own)
4. Every catalog item carries a `source` tag (`licensed` | `brand-assets` | `community` | `own` | `placeholder` | `synthetic`) so the launch gate is machine-checkable.
5. **Procurement ownership (S4):** brand outreach + permission ask is owner-side work — tracked as a roadmap task (P2-06), not agent-implementable. The launch gate below sets a **minimum-content bar** so "launch" can't mean "launch with 2 pedals".

## Exit criteria (launch gate — all required)
- [ ] **Swap the synthetic seed + placeholder for the cleared catalog before deploy (S1):** no `synthetic` or `placeholder` items in the deployed catalog
- [ ] Zero `placeholder`-sourced items in the deployed catalog
- [ ] Deployed images contain no placeholder files
- [ ] **Minimum content gate (S1):** ≥200 catalog pedals across ≥10 brands, plus ≥10 pedalboards, all with `source ∈ {licensed, brand-assets, community, own}` (NOT synthetic/placeholder)
- [ ] **Dimension spot-check (S6):** a documented sample (≥10 items) re-measured against manufacturer spec sheets, screenshots/links recorded here — catches hand-measured footprint errors before they ship
- [ ] **Then delete the "Dev placeholder" section and this cleanup note from this ADR** (owner instruction, 2026-09-22)

## References
- Brand-onboarding model: Guitar Pedal X interview with Pedaltrain's Jim Colella, 2023-09-06 + pedalboardplanner.com/request (verified)
- Dataset license status: repo root has no LICENSE; GitHub API `license: null` (verified Sep 2026)
- Claim "some brands refused Pedaltrain": Reddit-sourced, unverified — do not cite