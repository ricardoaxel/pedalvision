# P5-02: Catalog quality pipeline & control plane

**Phase:** P5 · **Status:** in review — PR #36 · **Model:** build-strong

## Goal

Build the deterministic tooling that makes parallel catalog work safe, cheap, observable and stoppable: per-batch source files, a build/validate step, an image analyzer/processor, the `catalog-runner` + status/pause/stop/checkpoint control plane, the 2,000-hosted-pedal cap, and the agent templates/work queue.

## Read first (context pack)

- `docs/catalog-backfill.md` (data contract, image pipeline, batch/control plane)
- `docs/decisions/003-catalog-data.md` §Self-hosted public-asset images
- `docs/tasks/P5-01-policy-inventory.md`
- `tools/asset-pipeline/` (sharp, flood-fill, trim, renditions, draft)
- `tools/catalog-transform/` (schema validation, curated/classify, seed)
- `package.json` scripts

## Constraints

- No new runtime dependencies. Dev-only tooling may use the existing pinned `sharp`; any new dev dependency needs a justification + owner approval.
- No AI for mechanical work: background removal, trim, resize, aspect/alpha checks are scripts.
- No app behavior change; no edits to `src/catalog/data/pedals.json` by brand agents.
- cm only; image aspect compares to the cm footprint.
- Max 3 batches in flight; every batch must be pause/stop-safe.

## Steps

1. **Batch layout:** `data/catalog/research/{pedals,boards}/<brand>/<batch>.json` (raw) + `data/catalog/{pedals,boards}/<brand>/<batch>.json` (mapped); per-brand registry; agents write **raw only**; a batch PR contains raw + assets only; CI runs `catalog:build` into a temp dir and `catalog:validate` checks the generated runtime there; it also generates an **uncommitted** runtime into the app workspace for `pnpm build`/Playwright (schema, duplicate ids, variants, mandatory fields, foreign keys, board footprint/variant links). A post-merge build deterministically commits raw → mapped → runtime; a drift check catches stale generated files. Raw records preserve all verified facts/image candidates — connectors, audio I/O, control/CV, MIDI, USB, wireless/app, power/supply, circuit/bypass, physical, **serial ranges, videos** — even when not yet in the runtime schema. Add enums + structural checks; missing is valid.
2. **Image analyzer** (script): min long edge 800; background uniformity/border-connected; alpha; trim bbox/whitespace; aspect vs `widthCm/heightCm` for **pedals and boards** (≤10% pass, 10–15% flag, >15% reject); rotation/skew; shadow/perspective signals; JSON report. Board images must be top-down/empty; angled hero shots rejected.
3. **Image processor** (script): extend the asset pipeline's flood fill for white/solid backgrounds; optional dev-only matting fallback for gradients; trim; transparent PNG; 800/350; atomic temp→rename.
4. **Vision QA:** contact-sheet helper (20–30 images per call) + a reviewer agent definition; cache accept/reject reasons.
5. **Control plane:** `catalog-runner` starts one batch per worktree/session; state files with progress/heartbeat/tokens/blockers; `catalog:status [--watch]`, `catalog:pause|stop|resume`, global `STOP`, per-agent flags; checkpoint after every pedal; `SIGTERM`/`SIGKILL` fallback.
6. **Caps:** enforce 2,000 hosted pedals / ~4,000 images / ~300 MB and **150 Tier A boards / ~300 board images / ~20 MB** before and after each batch; stop and report at either cap. Boards do not count toward the pedal cap.
7. **Agent templates:** pedal + **pedalboard** researcher, image scout, image reviewer, coordinator; 15-minute status line; per-item 12 min initial, per-batch 4 h; strict JSON output.
8. Dry-run on 3 synthetic pedals (no real assets) and verify stop/pause/resume + status.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- `pnpm catalog:validate` rejects a duplicate id, a missing mandatory field, and a dangling variant.
- Analyzer tests cover: white background, busy background, too-small image, wrong aspect ratio, correct top-down cutout.
- `pnpm catalog:status` shows 3 fake batches; `catalog:stop` stops one at a checkpoint; resume continues; global STOP stops all.
- The 2,000-hosted-pedal cap refuses the next pedal batch with an inline reason.
- The 150-board cap refuses the next board batch with an inline reason.
- Board image budget (~300 files / ~20 MB) is checked independently.
- No runtime UI behavior change; no real image downloads in the dry run.
- A dry-run batch PR contains no mapped/runtime edits; CI temp build validates; the post-merge build is deterministic and the drift check passes.

## Notes

- This task creates the tooling only; P5-03 runs the pilot and waves.
- Keep token use low: scripts first, vision only on contact sheets, cache everything.
- **Optional fields never justify extra research:** the agent template must state that only data encountered during the base pass is captured; no follow-up search for optional fields. Missing is valid.
