# P5 plan restructure (docs-only)

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** done (merged 2026-10-21, PR #32, squash `6e7deef`) · **Model:** build-cheap

## Goal

Restructure the catalog program: retire **P4-04** into **P5-01**, define the P5-01…P5-05 tasks (policy/inventory, quality pipeline + control plane, pilot/parallel backfill, final QA/launch, deferred image-hosting spike), renumber Appium/help/observability to P5-06/07/08, and record the owner decisions (self-hosted public-asset policy, attribution/takedown, 2,000-hosted-pedal cap, max 3 batches in flight, pilot → Meris + Red Panda → BOSS split).

## Read first (context pack)

- `docs/roadmap.md` P4/P5
- `docs/phase-guide.md` P4/P5
- `docs/decisions/003-catalog-data.md`
- `docs/catalog-backfill.md`
- `docs/design.md` §Assets & catalog
- `AGENTS.md` catalog constraints
- `.opencode/agent/pedal-expert.md`

## Constraints

- **Docs only** — no code, schema, data, or asset changes.
- Do not touch the P4-03 branch/worktree.
- Keep P4-01/P4-02 as done; P4-03 stays in progress in its own session.
- Preserve the additive/ADR history; supersede rather than rewrite where appropriate.

## Steps

1. Roadmap/phase-guide: P4-02 done, P4-03 in progress, P4-04 retired, new P5 task list.
2. ADR-003: public-asset policy, `public-asset`, attribution/takedown, 2k cap, exit criteria.
3. `catalog-backfill.md`: replace the old clearance plan with the P5 plan.
4. `design.md` §Assets: hosted/static policy, 2k cap, P5-05.
5. `AGENTS.md`: catalog/P5 isolation + image policy + 2k cap.
6. `pedal-expert.md`: new data fields, public-asset candidates, optional jacks.
7. Create P5-01…P5-05 task files; rename P5-05 Appium → P5-06.
8. Update progress (P4-02 done, P4-03 external, P5 plan in review).

## Acceptance (executable)

- Docs are internally consistent: no active P4-04 references; P5 numbering matches the task files; ADR-003/roadmap/phase-guide/catalog-backfill agree.
- No code/data/assets changed (`git diff --name-only` only docs/AGENTS/.opencode).
- `pnpm lint` green (docs don't affect it but confirms the tree).
- One PR; owner review; no merge.

## Notes

- P5-01 can start in parallel with P4-03 after this PR merges.
