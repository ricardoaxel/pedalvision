# P5-03: Pilot + parallel brand backfill

**Phase:** P5 · **Status:** todo · **Model:** build-strong

## Goal

Prove the full pipeline on one pedal, then on two small brands in parallel, then on a split big brand (BOSS), then run continuous waves of up to 3 batches in flight. Every batch is data + hosted images + a PR with QA evidence. Stop at 2,000 hosted pedals.

## Read first (context pack)

- `docs/catalog-backfill.md` (execution, image policy, QA)
- `docs/tasks/P5-01-policy-inventory.md` + `P5-02-quality-pipeline-control.md`
- `docs/decisions/003-catalog-data.md` §Self-hosted public-asset images
- `docs/roadmap.md` P5-03
- The discovered inventory (`data/catalog/inventory.json`) and the brand slices

## Constraints

- **Pilot first; owner approval before scaling.**
- **Meris + Red Panda** are the first small parallel test. Then **BOSS split into 3 batch PRs** in parallel.
- One brand batch = one branch/worktree = one PR; max 3 in flight.
- No direct edits to `src/catalog/data/pedals.json`; batch files only.
- 2,000 hosted-pedal hard cap. Stop all waves at the cap and report.
- Jacks are optional enrichment; use fallback anchors when absent.
- Every agent reports every 15 minutes: `% · pedals done/total · images accepted/rejected · blockers`.
- Per-pedal hard limit starts at 12 min; per-batch at 4 h; tune after the pilot.
- No merge by the agent; owner reviews each PR.

## Steps

1. **Pilot:** TC Choka — one PR with the **raw research record** + mapped data, hosted 800/350 image, contact sheet, Playwright render/filter check. Capture every verified fact found — connectors, audio I/O, electrical specs, routing/loops, control/CV, MIDI, USB, wireless/app, power/supply, circuit/bypass, physical/jack orientation, lifecycle and `extra` — not just what the UI shows today. The H90 is the stress fixture for multi-connector pedals.
2. **Owner checkpoint.** Only continue if the pilot is approved.
3. **Small parallel test:** Meris (15) + Red Panda (14), one PR each; verify filters, image load, canvas placement.
4. **Big-brand split test:** BOSS into ~5–6 batches; run 3 in parallel; one PR each; verify merge/build/QA and no conflicts.
5. **Scale:** continuous queue, 3 batches in flight, refill as each finishes; priority brands; update the registry after each merge.
6. **Stop** at 2,000 hosted pedals; report and hand off to P5-05.

## Acceptance (executable)

- Pilot PR approved by the owner.
- Meris + Red Panda PRs merged with green checks (catalog validate + Playwright).
- Three BOSS batch PRs merged without merge conflicts; `catalog:build` stable; count/coverage report.
- Each PR contains: data, images, contact sheet, coverage/reject report, Playwright evidence.
- `catalog:status` shows the in-flight batches; pause/stop verified on at least one real batch.
- Cap enforcement verified (simulate near-cap or assert the check).
- No feature-code changes in brand PRs.

## Notes

- The first waves are deliberately small to calibrate tokens/time and image acceptance.
- Do not start P5-04 until the Tier A data/images are stable.
