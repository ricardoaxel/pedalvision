# Catalog program — paused (2026-10-29)

**Status:** paused/closed for now. **Feature work continues.**

The catalog backfill is intentionally stopped. We are not running catalog
batches, image research, licensing cleanup, or launch-gate catalog work while
the product moves forward on features. We may resume later for refilling.

## What is paused

- All `P5-*` catalog tasks and `T-*` catalog waves/cleanup tasks.
- New pedal/board research, image sourcing/replacement, provenance cleanup and
  catalog launch QA.
- The bulk planner-fill PR **#91** (`catalog/planner-fill`, pedals + boards) was
  **merged before the pause** (`1368a479`); it is the baseline for a future refill.

## What continues

- Feature work (see `docs/tasks/feature-roadmap-proposal.md`).
- Normal app maintenance, bug fixes and architecture work.
- No new catalog PRs or catalog agent waves.

## Resume later

When the owner decides to resume, re-check `docs/progress.md`, the roadmap and
the individual task files against the latest code before starting. The merged
PR #91 data remains the baseline for the bulk planner fill.
