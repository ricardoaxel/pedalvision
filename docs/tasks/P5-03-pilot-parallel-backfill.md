# P5-03: Pilot + parallel brand backfill

**Phase:** P5 · **Status:** in progress — Choka + JHS pedal pilots DONE; board pilot (Pedaltrain Classic 2) in review (PR #39) · **Model:** build-strong

## Goal

Prove the full pipeline on one pedal and one **pedalboard**, then on two small pedal brands + one board batch in parallel, then on a split big brand (BOSS), then run continuous waves of up to 3 batches in flight. Every batch is data + hosted images + a PR with QA evidence. The first 2,000 catalog items include **150 boards**. Stop at the **Tier A target** (~1,850 pedals + 150 boards); **2,000 hosted pedals is a safety cap**, and P5-05 only triggers if the owner chooses to exceed Tier A.

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
- Stop at the **Tier A target** (~1,850 pedals + 150 boards). **2,000 hosted pedals is a safety cap**; P5-05 only if the owner chooses to exceed Tier A.
- Capture every connector with its position (audio I/O, aux, expression/CV, MIDI, USB, power); only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor today. Other connectors are future-feature data. Use fallback anchors only when a pedal has no jack data at all.
- Every agent reports every 15 minutes: `% · items done/total · images accepted/rejected · blockers`.
- Per-item hard limit starts at 12 min; per-batch at 4 h; tune after the pilot.
- **Optional data is opportunistic:** capture only what appears in the same base research. Never run a separate search for serials, videos, artist, price, jacks, MIDI/USB, board extras, etc.
- No merge by the agent; owner reviews each PR.

## Steps

1. **Pilot:** TC Choka — one PR with the **raw research record + assets only**; CI runs `catalog:build` into a temp dir and an **uncommitted** app-workspace runtime for Playwright; the post-merge build commits mapped/runtime. Add the hosted 800/350 image, contact sheet, and Playwright render/filter check. Capture every verified fact found — connectors, audio I/O, electrical specs, routing/loops, control/CV, MIDI, USB, wireless/app, power/supply, circuit/bypass, physical/jack orientation, lifecycle, **artist association when already found**, **price observations (new/used) when already found**, and `extra` — not just what the UI shows today. The H90 is the stress fixture for multi-connector pedals.
2. **Owner checkpoint.** Only continue if the pilot is approved.
3. **Board pilot:** Pedaltrain Classic 2 (or Temple Audio Duo 24) — board facts, hosted top-down image, contact sheet, Playwright board picker/placement.
4. **Small parallel test:** Meris (15) + Red Panda (14) + one board batch (Pedaltrain), one PR each; verify filters, image load, canvas/board placement.
5. **Big-brand split test:** BOSS into ~5–6 batches; run 3 in parallel; one PR each; verify merge/build/QA and no conflicts.
6. **Scale:** continuous queue, 3 batches in flight, **mixing pedal and board batches**; refill as each finishes; priority brands; update the registry after each merge. First 2,000 catalog items include 150 boards.
7. **Stop condition:** complete the Tier A target (~1,850 pedals + 150 boards). If pedals reach 1,850 before boards reach 150, pause pedal batches and finish boards. Hard safety cap: **2,000 hosted pedals**; pedal waves stop there, boards continue to 150, then report and hand off to **P5-04**. P5-05 only if the owner chooses to exceed Tier A.

## Acceptance (executable)

- Pilot PR approved by the owner.
- Board pilot (Pedaltrain Classic 2 or Temple Duo 24) approved by the owner; board facts + top-down image + Playwright. The final Tier A board batch may be a smaller partial batch (even 1 board).
- Meris + Red Panda + one board batch PRs merged with green checks (catalog validate + Playwright).
- Three BOSS batch PRs merged without merge conflicts; PRs contain no mapped/runtime edits; CI temp build validates; the uncommitted app-workspace runtime feeds Playwright; post-merge build stable; count/coverage report.
- First 2,000 catalog items = ~1,850 pedals + 150 boards; board images count toward the separate board budget.
- Absolute minimum (≥200 pedals / ≥10 brands / ≥10 boards) and Tier A target are reported separately; launching below Tier A needs owner acceptance.
- Each PR contains: data, images, contact sheet, coverage/reject report, Playwright evidence.
- **Every batch PR description includes a demo share link** (`?share=1#s=…`) that opens a
  pedalboard (or boards) with every item added by that batch, with illustrative patch cables
  connecting the batch items (not a true audio-flow model), and the link must load the expected
  board/item/cable counts (owner instruction, 2026-10-25).
- `catalog:status` shows the in-flight batches; pause/stop verified on at least one real batch.
- Cap enforcement verified (simulate near-cap or assert the check).
- No feature-code changes in brand PRs.

## Batch task files

P5-03 is the coordinator/template task. Each batch session copies `docs/tasks/P5-batch-template.md` to `docs/tasks/P5-03-<kind>-<brand>-<batch>.md` and opens **one PR** for that batch. The coordinator runs up to 3 batch sessions and opens no batch PR itself.

## Notes

- The first waves are deliberately small to calibrate tokens/time and image acceptance.
- Do not start P5-04 until the Tier A data/images are stable.
