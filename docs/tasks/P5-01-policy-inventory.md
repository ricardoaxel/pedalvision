# P5-01: Catalog policy, data contract & master inventory

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Establish the owner-approved policy and data contract for the P5 catalog — **pedals and pedalboards** — then build the master inventory. No bulk images and no backfill yet. The end state: ADR-003 reflects the self-hosted public-asset policy; the schema can carry the new metadata; `data/catalog/inventory.json` lists every candidate pedal/board brand with dedupe + tiers; the 207-pedal/10-board seed has a validation report; the 2,000-hosted-pedal cap and the **~150-board Tier A** target are recorded.

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
- **All optional fields are opportunistic:** capture only if they appear during the same base research (same manufacturer/manual/retailer pages used for the mandatory facts). No extra searches or extra tokens for serials, videos, artist, price, jacks, MIDI/USB, board extras, etc. Missing is valid.
- `jacks[]` is **optional enrichment** for catalog data: record `kind`, `edge`, `pos?`, `stereo?` when a source exposes it; never invent exact positions. `pos` is normalized 0..1, derived from exact cm (`x / widthCm` on top/bottom, `y / heightCm` on left/right). **Partial knowledge is allowed:** if only the edge/count is known (e.g. “2 on top”), omit `pos`; the resolver distributes the jacks evenly on that edge and marks them `approximate` (hollow ticks). Make `pos` optional in the schema, keep existing data valid, and let exact `pos` be filled later. If a jack is inset from the edge, add optional `xCm`/`yCm` only if the source requires it.

## Steps

1. Update ADR-003: public-asset policy, `public-asset` tag, attribution/takedown, launch-gate wording, 2,000 cap, **capture-once raw research archive**.
2. Extend the catalog schema (additive): pedal `usage?` (optional; absent = unknown, no migration needed), `color?`, `notes?`, `year?`, `status?`, `confidence?`, `lastVerified?`, `public-asset` in `SOURCE_TAGS`; keep `jacks.stereo?`. Board schema: optional `variantOf?` for size families + keep width/height as footprint; richer board metadata stays in the raw archive/projection. Model-level `serial`/`videos` are raw-record fields.
3. Define the **raw research record** (superset) and `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`, so all verified facts/image candidates/source pages are kept even when not yet in the runtime schema. Runtime catalog = projection; later fields are mapped from raw, never re-researched. The raw schema covers **connectors** (TS/TRS/XLR/DIN5/TRS-MIDI A/B/USB/barrel/IEC), **audio I/O** (mono/stereo/balanced/level/impedance/loops/DI/headphone), **control** (expression/CV/footswitch/tap/amp-switch), **MIDI** (DIN/TRS A-B/USB/BLE/clock), **USB** (type/functions/class/audio), **wireless/app/presets/IR**, **power** (V/AC-DC/mA/W/polarity/connector/battery/supply outlets), **circuit** (analog/digital/hybrid, bypass), **physical** (weight/enclosure/display/jack orientation/plug clearance), **electrical/audio specs** (impedance/levels/SNR/THD/phantom/pad/ground lift/phase), **routing/performance** (loops/4-cable/bypass/trails/presets/tuner/looper/IR), **identity/compatibility** (`deviceType`, `formFactor`, `instrumentTypes`), **product lifecycle** (year/discontinued/replacement/variant/limited/**artist association**/made-in/manual/firmware/MIDI chart/**price observations new/used**), and **planner-specific** details (jack labels/orientation, power-jack location, right-angle clearance, mounting). Use the **H90** as a stress fixture (4 TS in, 4 TS out, 2 TRS EXP/CTL, MIDI DIN in/out, USB-C, 12 V center-positive 5.5/2.5 mm).
4. Build `data/catalog/inventory.json` from the discovery lists: **8,557 pedals / 779 brands** and **263 boards / 38 brands** + other `pedal-expert` sources. Normalize brand/name, slug, dedupe, collapse colorways to `variantOf`, and set tiers (A/B/C). **Tier A = ~1,850 pedals + exactly 150 boards** (top board brands: Pedaltrain, Pivotal, Temple Audio, Creation Music, GigRig, Morton, Rockboard, Vertex, Mono, STRICH, Aclam, Friedman, Gator, BOSS, D'Addario, Voodoo Lab, Fender, Blackbird, Harley Benton, Palmer, Fame, SKB, Holeyboard).
5. Mark which inventory items overlap the current 207-pedal/10-board seed; preserve curated effect types/sources, and create raw records for them where missing.
6. Define the **pedalboard data contract** (footprint width×depth, thickness/max height, weight, material, board type/tiers, surface, bag/case, power mount, cable routing, handles/feet, max pedal height, lifecycle, videos, price observations (new/used), artist association, sources) and the **model-level serial-number** field (`format`, `ranges`, `location`, `notes`; never a unit's serial) + **videos** (`url`, `title`, `source`, `kind`, `verified`) + optional **artist association** (`artist`, `role`, `notes`, `sources`) and **price observations** (`amount`, `currency`, `condition: new|used`, `source`, `observedAt`) when already found — no separate search.
7. Add the checked-in **H90 raw fixture** (`data/catalog/fixtures/eventide-h90.json`) and the **community jack-map record** spec/example (`docs/catalog/jack-map-record.md`: pending/approved/rejected, contributor/evidence/reviewedAt, v1 GitHub flow, v2 backend).
8. Produce `data/catalog/seed-validation.json` for the 207 pedals + 10 boards: keep/repair/replace/drop + reasons (missing mandatory field, bad dimensions, bad image, duplicate).
9. Record the **2,000 hosted-pedal / ~4,000 image / ~300 MB** cap (boards: exactly 150 Tier A / ~300 files / ~20 MB) in the tooling constants/plan (no enforcement code yet if P5-02 owns it).
10. Surface the owner decisions: public-asset policy + attribution/takedown page, `public-asset` tag, capture-once archive, boards in the first 2,000 items.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (schema/data changes).
- Inventory exists with counts: total pedals/brands, total boards/brands, Tier A/B/C sizes, duplicates removed, overlap with the seed.
- **Tier A includes exactly 150 boards** (priority order, hard cap), not just pedals; first 2,000 catalog items = ~1,850 pedals + 150 boards. Board image budget ~300 files / ~20 MB is enforced in P5-02.
- Board contract covers footprint, thickness/max height, weight, material/type/tiers, bag/case, power mount, cable routing, max pedal height, lifecycle, videos, serial ranges.
- Seed validation covers all 207 pedals + 10 boards, each with keep/repair/replace/drop + reason.
- ADR-003 + roadmap/phase-guide/catalog-backfill agree on the policy, 2k cap, and P5 numbering.
- No image downloads or `public/pedal-assets` changes.
- Raw-capture schema documented; every field we may later surface has a home (`extra` for unknown/verified facts). No re-research needed for a future field addition.
- `data/catalog/fixtures/eventide-h90.json` maps all H90 connectors without inventing positions; optional fields stay optional.
- `docs/catalog/jack-map-record.md` specifies the community record (`pending|approved|rejected`, contributor/evidence/reviewedAt) with a v1 GitHub-submission path and a v2 backend path.

## Notes

- Owner decision (2026-10-21): self-hosted public assets + attribution/takedown; owner accepts responsibility.
- Owner decision (2026-10-21): 2,000 hosted pedals max until P5-05.
- Optional jack positions are a nice-to-have, never a blocker.
