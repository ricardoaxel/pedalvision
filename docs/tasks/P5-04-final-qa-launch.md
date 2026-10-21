# P5-04: Final QA, provenance & launch gate

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Validate the full launch-scope catalog, finish provenance/confidence records, run the final product checks and hand the launch gate to the owner. No new catalog features.

## Read first (context pack)

- `docs/decisions/003-catalog-data.md` §Exit criteria
- `docs/requirements.md` A1–A5 + F1–F12
- `docs/roadmap.md` launch gate
- `docs/catalog-backfill.md` QA
- `docs/tasks/P5-03-pilot-parallel-backfill.md`

## Constraints

- No placeholder/mock images in the shipped catalog.
- 2,000-hosted-pedal cap respected; if launch scope exceeds it, P5-05 must be decided.
- No new dependencies; no feature scope creep.
- Owner signs off; agents do not merge or launch.

## Steps

1. Full catalog validation: schema, duplicate ids, variants, mandatory fields, image files (800/350), source URLs, `public-asset` tag.
2. Provenance sweep: `lastVerified`, `confidence`, per-item sources; document the ≥10-item dimension spot-check against manufacturer specs.
3. Playwright: picker search + brand/effect filters, image load, pedal and **board** placement/rotation, cables, share/read-only, export PNG/PDF, save/reload A4.
4. Platform checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`, `pnpm audit`, iOS export on a real device, real-device touch pass.
5. Verify the attribution/takedown page and removal contact.
6. Produce the launch-gate report: catalog counts, image counts/bytes, hosting headroom, known gaps, sign-off checklist.

## Acceptance (executable)

- All P5-04 checks green; no placeholder/mock in the launch scope.
- ≥200 pedals / ≥10 brands (Tier A scope) with hosted images + sources; Tier A boards (~150) included and verified.
- Dimension spot-check documented (≥10).
- `pnpm audit` clean; iOS export + real-device touch pass recorded.
- Attribution/takedown live.
- Owner approves launch (or lists the remaining blockers).

## Notes

- If P5-05 is triggered, launch waits for the hosting decision.
