# T-7 — Cleanup wave 4 coordinator (Behringer-1 + Big Joe-1 + Effects Bakery-1)

**Phase:** P5 · **Status:** queued (start only after T-6 PRs merge + post-merge build) · **Type:** catalog wave coordinator · **Depends on:** T-6

## Goal

Run **cleanup wave 4** as its coordinator: Behringer-1, Big Joe-1 and Effects Bakery-1. Each is the brand's **first batch**, so it includes all of that brand's existing seed items (hotlinked/mock) **plus** as many new **Tier A** items as the brand actually has. The coordinator reads the last state, creates the batch tasks/worktrees, token-reviews the wave, writes the plan, launches via `catalog:wave`, and hands the PRs to the owner. The coordinator opens **no PR** and never merges.

## Read first

- `docs/progress.md`
- `docs/tasks/P5-03-image-completion-plan.md` (next-wave protocol + wave matrix)
- `docs/tasks/P5-03d-parallel-workstreams.md`
- `docs/catalog-backfill.md` §Parallel waves
- `docs/tasks/P5-batch-template.md`
- `docs/tasks/T-6-cleanup-wave-3.md` (lessons applied below)
- The latest `catalog:wave` report/state (`cleanup-wave-3` + its EQD recovery wave) and the `docs/progress.md` WS note

## State at T-6 handoff (verify before launch)

- **T-6 cleanup wave 3 is 3 PRs awaiting owner review** (no merges yet this session): **#79 Keeley (26)**, **#80 Joyo (26)**, **#82 EarthQuaker (26)**; CI green (Keeley re-run after a coordinator code-review fix). **0 merged** at handoff; expected post-merge **468 pedals / 15 boards, ledger 483** (444 + 24 net-new). The owner merges serially.
- **F-05 motion (#81) is the separate feature PR (feature cap 1/1).** Do not start another feature.
- **Catalog cap 3/3 used** — start **no** new catalog wave until at least one T-6 PR merges and its post-merge build is verified. Then refill per the next-wave protocol.
- Budgets: catalog 400k/800k per batch (billed non-cache); wave soft **1.6M** / hard **2.4M**; 4 h active; 12 min/item stall; ≤2 vision passes; ≤1 light code review (data-only skip unless `curated.ts` changes).
- T-6 measured (3-wide, incl. one EQD resume after a provider 429): joyo **456k/48m**, keeley **319k/32m**, eqd **471k/~44m active** (~199m wall incl. a 2.5 h pause awaiting owner approval) → **~1.25M** billed total; cache-incl. floor ~42M. Under the 1.6M soft.

## Scope (verify counts from the regenerated ledger + inventory; never force 26)

Run `pnpm catalog:asset-ledger` and re-check `data/catalog/inventory.json` before writing the batch tasks.

- `behringer/behringer-1` — **1 existing** (Powerplay P1, hotlinked) + **25 new Tier A** = **26**. Tier A availability at T-6 handoff: 51 net-new. Re-host the existing seed and record `imageProvenance`; verify dimensions/power/jacks per item. Substitute only with a recorded reason.
- `big-joe/big-joe-1` — **2 existing** (PB-109 Power Box Li2, Power Box ISO4; both mock) and **0 Tier A net-new** (inventory Tier A = 0 at handoff). **Do not force 26.** Ship the 2 re-hosted seeds; if the owner wants Tier B/C items that is a scope change, not a coordinator decision.
- `effects-bakery/effects-bakery-1` — **1 existing** (Power Supply Hoden Sentai Donuts; mock) and **0 Tier A net-new**. **Do not force 26.** Ship the 1 re-hosted seed.
- Total ≈ **29 items** (4 existing + 25 new), subject to the verified counts.
- Boards: none in T-7 (pedal brands only).

## Lessons from T-6 to apply (mandatory in the batch prompts)

1. **Checkpoint the first item immediately after setup**, then inline after every item. Launch the wave with `CATALOG_ITEM_LIMIT_MS=1800000` (30 min); state in every prompt that an `exit 75` / `per-item limit exceeded` checkpoint result is **advisory** — keep going, do not stop or `catalog:resume` for it.
2. **Evidence branches:** the batch PR branch contains raw records + assets + its task file (+ `curated.ts` only when the no-drift test requires it). Screenshots/contact sheets go on `p5-03-pedals-<batch>-evidence`; embed evidence-branch raw URLs, or `guard-batch-pr` fails.
3. **`curated.ts` is coordinator-only.** The T-6 Keeley/EQD batches both edited it directly (verified and kept, but a process deviation). If a batch needs an effect override, it must stop and hand the exact keys + official wording to the coordinator; the coordinator owns the shared-file edit.
4. **Per-batch baseline worktrees** (one each) so three concurrent Playwright/builds never share a dir.
5. **One visual review**: a single `catalog-image-reviewer` call (dual-tone sheet + connector-strip crop + 3× crops for analyzer-flagged cells); no `design-reviewer`, no per-item vision.
6. **Budget edges:** 800k per batch is the brake; 2.4M is an owner-escalation trigger at a checkpoint (effective cap = min(2.4M, 3.4M − actual feature billed)); at 320k trim discovery, not verification.
7. **Provider failures:** a 429/401/quota/timeout/empty stops that batch and is reported with model + operation + exact error, never substituted. T-6's EQD hit `ttft_admission_refused` (429, retryable) twice; the owner approved **one** same-model resume, which completed.

## Steps

1. **Read state:** `pnpm catalog:status`; `pnpm catalog:wave report --wave cleanup-wave-3` and `cleanup-wave-3-eqd-recovery`; check open PRs and the post-merge build. Never re-read raw logs.
2. **Classify batches:** merged / in review / running / failed-stopped / queued. Never redo merged; resume failed-stopped once; never duplicate.
3. **Wait for the T-6 merges + verified post-merge build**, then reconcile `docs/progress.md` (T-6 → Done; 468/15) and remove any cleared blockers.
4. **Create batch tasks/worktrees** from `P5-batch-template.md`; one branch/worktree and one PR per batch. Run `catalog:promote-legacy` for the existing seeds; list the exact scope + image/jack rules in each task.
5. **Token-review** the wave plan; fold valid findings.
6. **Write the wave plan** (`work/catalog/waves/cleanup-wave-4.json`): `maxParallel: 3`; 3-wide by default. A feature PR is a separate 1-PR lane.
7. **Launch** via `pnpm catalog:wave run --plan <file>`; no raw background sessions. Clear stale out-of-plan batch state that would block a slot (never catalog data) **before** launch — T-6 lost the third slot to a stale `acme/pedals-1` and needed a recovery wave.
8. **Monitor** every 10–15 min via `catalog:status`/report; one WS line per checkpoint; log billed tokens by class. At ≥2.0M billed, start no new wave; at the hard caps, stop.
9. **After each merge:** verify the post-merge build, update progress, rebase open branches, then refill only when the catalog cap frees a slot (max 3 refills). Never hand-resolve generated conflicts.
10. **Report** PRs, items, images, planner share, billed tokens/minutes, CI, blockers. No merge.
11. **Handoff:** create the next wave's coordinator task from `catalog-coordinator-template.md`, link it in `progress.md` and `roadmap.md`, and record the next order (T-8 remaining Tier A).

## Rules

- One PR per batch; coordinator opens no PR; owner merges serially.
- **Catalog cap ≤3 PRs**; **feature cap ≤1 PR, separate**. At the catalog cap, start no new catalog wave; at the feature cap, start no new feature.
- Image policy: official/retailer/community (recorded) → recorded planner last-resort → generated flat art only if none; planner is a counted source gap. Clean-alpha gate; jacks need a verified source (omit the edge + `unknown` if none).
- Every batch PR: `catalog:ci`, jack/image gates, demo share link, before/after screenshots (desktop + mobile) on an evidence branch, owner review hints, review digest.
- No generated mapped/runtime hand edits; post-merge build only.
- Stop on 429/401/quota/timeout/empty (report model + operation + exact error, never substitute), 3 catalog PRs or 1 feature PR awaiting, hard cap, 2 failed resumes, generated conflict, or a missing verified source.
- Run the `token-usage-reviewer` before launch; per-batch task copies are exempt.

## Acceptance

- Behringer-1, Big Joe-1 and Effects Bakery-1 launched 3-wide (or 2-wide with a feature open; the feature lane is separate).
- One PR per batch; coordinator PR none.
- Every existing hotlinked/mock seed in the three brands is replaced and recorded; no batch is padded to 26.
- Post-merge build verified after each merge; next wave (T-8) selected and linked.
