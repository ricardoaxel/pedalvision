# P5-03e — Image source policy: planner last-resort + recorded sources (T-1a)

**Phase:** P5 · **Status:** merged — PR #56 (squash `ea20b02`) · **Type:** policy + gate + ledger (docs/tools) · **Depends on:** T-1 (merged)

## Purpose

Owner decision (2026-10-27): **reverse the “never ship planner pixels” rule**.
Pedalplayground/planner becomes a **last-resort shipped source above generated
art**, and generated flat art is used **only when no usable image exists at
all**. Keep the 31 BOSS legacy items on the repair path (they must be replaced,
not kept). Record **where every image was obtained** in the private catalog
(raw `imageProvenance` + ledger), never on the public page, so future batches can
target the remaining source gaps (totals by source).

This is a **pedal** policy. Board batches keep their generated-flat-art default.

## Source hierarchy (pedals)

1. **Official** manufacturer/brand (product, press, support).
2. **Authorized retailer**.
3. **User/community** image with a recorded source (quality-gated).
4. **Planner / Pedalplayground** — **last-resort shipped image**, recorded and
   quality-gated; mark it as a source gap to improve.
5. **Generated flat pedal art** (`Catalog Specimen`) — only when none of 1–4
   exists or passes the quality gate.

**Repair set (same hierarchy, no exception):** the **31 BOSS legacy** items stay
`pending-replacement`; T-2 repairs them with the normal order — official →
retailer → community → **recorded planner last-resort** → generated art only if
none. The existing unrecorded planner asset is **never kept**; re-source it and
record the exact URL. Generated art is last for these items too.

## Ledger mapping (decided before coding)

| Provenance / state | `sourceKind` | `imageHosting` | `licenseStatus` | `replacementTarget` | `improve` |
| --- | --- | --- | --- | --- | --- |
| official chosen | `official` | static/hotlinked | `license-pending` (or `licensed` with written permission) | brand batch if hotlinked | yes if hotlinked |
| retailer chosen | `retailer` | static/hotlinked | `license-pending` | brand batch if hotlinked | yes if hotlinked |
| community chosen | `community` | static/hotlinked | `license-pending` | brand batch if hotlinked | yes if hotlinked |
| archive chosen (Wayback) | `archive` | static | `license-pending` | — | no |
| planner **last-resort** | `planner` | static | `license-pending` | `better source (official/retailer/community)` | **yes** |
| legacy (no source) | `legacy` | static | `replacement-needed` | brand batch (T-2 for BOSS) | **yes** |
| own generated | `own` | static | `own` | — | no |
| own mock/placeholder | `own` | mock | `own` | brand batch | **yes** |

`referenceUrl` (own generated art) is **metadata only** — never treated as a
shipped image source and never used for planner detection.

## Scope

- **Raw schema:** add `last-resort` to `RAW_IMAGE_PROVENANCE_STATUSES`; add
  optional `referenceUrl` to `RawImageProvenanceSchema` (own art reference).
- **Gate (`catalog:check-images`):** require `sourceUrl` for every **chosen**
  official/retailer/community/planner/archive image; allow `planner` only with
  `status: "last-resort"` + `sourceUrl` (one aggregate warning, not per item);
  keep legacy only `pending-replacement`; keep `owner-approved-edge-case`; ignore
  `referenceUrl` for shipping/planner checks.
- **Ledger (`catalog:asset-ledger` / `license-report`):** expand
  `SourceKind` to `official|retailer|community|archive|planner|legacy|own`; add
  `sourceUrl`, `referenceUrl`, `improve`; add `summary.needsImprovement` and a
  source-gap report (totals by source + brand). Regenerate
  `data/catalog/asset-ledger.json`, `docs/catalog/asset-ledger.md`,
  `docs/catalog/image-licensing.md`.
- **Private source backfill:** add the missing `imageProvenance` to the 26 raw
  records that have a recorded image source (Red Panda/Meris/JHS/TC): 22
  `official`, 4 `archive` (Wayback), `status: "chosen"`, with the recorded image
  URL. No facts/assets change.
- **Docs:** `AGENTS.md` hard constraints, ADR-003, `raw-research-record.md`,
  `image-source-registry.md` (planner row + known gaps), `pedal-art.md`
  hierarchy, `attribution-takedown.md` (per-item URLs stay private), image
  completion plan D1/T-2/acceptance, progress/roadmap/phase-guide.
- **Tests:** raw-schema status/referenceUrl; gate (planner last-resort vs
  missing source); ledger (source kinds, improve flags, aggregate gaps); backfill
  validity via `catalog:ci`.

## Non-goals

- No image files, generated assets, or public-page changes.
- No repair of the 31 BOSS legacy here (T-2) — only the policy + ledger flag.
- No board-policy change (boards still generated flat art by default).
- No migration of the 31 legacy records (keep `legacy/pending-replacement`).

## Sequencing

**T-2 starts only after this PR merges.** T-1 (PR #55) is already merged; this
is the only PR awaiting review. No catalog wave runs in parallel.

## Token review (2026-10-27)

`token-usage-reviewer`: **`adjust`**. Folded:

- **Sequencing:** land this before any T-2 sourcing; one PR (T-1 is merged).
- **Ledger semantics first:** the mapping table above is fixed before coding.
- **Aggregate the planner warning** (one count line, not 30+ per-item lines).
- **One PR** for docs + gate + ledger (no split).
- **No 31-legacy migration**; keep `pending-replacement` / `owner-approved-edge-case`;
  `referenceUrl` is metadata, not a shipped source.
- Budget: low–medium; one light code review pass; no vision.

## Acceptance

- Hierarchy + repair-set exception documented; AGENTS/ADR/registry/plan
  reconciled.
- `catalog:check-images` accepts planner only as a recorded `last-resort` and
  rejects chosen non-own images without a recorded source; aggregate warning.
- Ledger shows source totals + needs-improvement gaps; regenerated files match.
- 26 backfilled raw records validate; 31 BOSS remain `pending-replacement`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + `catalog:ci`;
  one light code review (2/2: pass 1 changes-required → pass 2 approve with 2 nits fixed); one PR; no merge.

## Review outcome

Token reviewer **`adjust`** (mapping table, one PR, aggregate warnings, no 31-legacy migration, `referenceUrl` metadata only) → folded. Code reviewer **pass 1 changes-required** (own+planner URL gate, recorded hotlink ledger, source-gap hosting, aggregate gap warnings, dead field) → fixed; **pass 2 approve** with 2 nits (planner warning count, planner host) → fixed. No designer/vision pass (no visual-direction change; one public policy-copy update). PR #56 merged (`ea20b02`).
