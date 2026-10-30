# P5-05: Image hosting at scale — DEFERRED SPIKE

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** deferred (trigger: 2,000 hosted pedals / ~4,000 images / ~300 MB) · **Model:** plan

## Goal

Decide how to host the full catalog (8,557 pedals → ~17,100 images) for a public launch, with the cheapest reliable option and a safe migration from the current same-origin `public/pedal-assets/` setup. Deliver an ADR-002 update + cost table + migration plan; do not migrate until the owner approves.

## Read first (context pack)

- `docs/decisions/002-asset-serving.md` (ADR-002)
- `docs/design.md` §Assets & catalog
- `docs/catalog-backfill.md` §Hosting cap
- Cloudflare Pages limits + R2 pricing/public buckets; GitHub repository limits
- Current `src/lib/cdn.ts`, `assetUrl()`, `vite`/Pages deploy config

## Constraints

- **Trigger only:** do not start before the 2,000-hosted-pedal cap is reached (or the owner asks).
- No migration code in this task; report + ADR + owner decision.
- Keep canvas export CORS-clean; same-origin or CORS-enabled CDN.
- No new runtime dependency without an ADR/justification.

## Options to evaluate

1. **Cloudflare R2 public bucket** (leading): free tier 10 GB, no egress fees, custom domain, CORS; 17k images fit.
2. **Cloudflare Pages Pro** (100k files).
3. **Separate Pages project for assets** (splits the 20k file cap).
4. **Backblaze B2 + Cloudflare** (cheap storage, free egress via bandwidth alliance).
5. **Bunny CDN** (low storage/egress).
6. **GitHub raw / jsDelivr** — document why not for production.

## Steps

1. Measure current: images, bytes, file count, Pages/GitHub headroom.
2. Build a cost table (storage, egress, requests, custom domain, ops) for Tier A + full catalog.
3. Verify CORS/export with a small R2/CDN proof (read-only test, no migration).
4. Recommend one option; write the migration plan (URL helper/CDN base, 800/350, cache headers, fallback, rollback).
5. Update ADR-002 and hand the decision to the owner.

## Acceptance (executable)

- Cost/size table with sources.
- CORS/export proof for the recommended option.
- ADR-002 decision + migration plan.
- No app code changes until owner approval.

## Notes

- Current Pages/GitHub setup is safe to ~2,000 pedals; full 8,557 exceeds repo/directory guidance and approaches the Pages 20,000-file cap.
