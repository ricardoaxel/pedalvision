# Catalog backfill plan (P5)

Plan for turning the committed 207-item seed into the real, quality-gated
catalog. Governed by **ADR-003**; roadmap tasks **P5-01…P5-05**.
Owner decisions: **2026-10-21** (self-hosted public assets + 2,000-pedal cap).

## Goals

- Ship a clean catalog with **real facts + hosted, quality-gated images**.
- Cover **Tier A** (top ~20 brands / ~2,000 pedals) for launch; the long tail
  continues after launch.
- Keep **cm** as the only stored unit; inches are converted at import.
- Make data work **parallel with feature work** without merge conflicts.
- Make every agent run **observable and stoppable**.
- Stay inside the **2,000 hosted-pedal hard cap** until hosting is re-decided.

## Current state

- Seed: **207 pedals / 13 brands / 10 boards**; `effectTypes` for 201/207
  (the 6 blanks are supplies).
- **0 jacks, 0 power**; images: 129 hotlinked `url` + 78 `mock`; **0 hosted**.
- Verified base models carry **485 source refs** (340 `image` links).
- Discovery list: **8,557 pedals / 779 brands** from the PedalPlayground public
  list (`Brand`, `Name`, `Width`, `Height`, `Image`; **inches**) + other sources
  the `pedal-expert` agent uses.

**Keep the 207 seed.** Run it through the quality gate and keep/repair/replace
per item; do not wipe. Freeze a `legacy` snapshot for rollback.

## Data contract

### Mandatory
`id`, `brand`, `name`, `category` (`pedal|supply`), `effectTypes` (pedals ≥1,
supplies `[]`), `widthCm`, `heightCm`.

### Required for the cable feature
`jacks[]`: `kind`, `edge`, `pos`, `stereo?`. **Optional enrichment for catalog
data**: if a source exposes input/output positions, record them. `pos` is
normalized 0..1 along the edge, but it is **derived from exact cm** — e.g. a jack
3 cm from the left on a 7.3 cm-wide pedal is `edge: "top", pos: 3 / 7.3`; a jack
2 cm down the left side of a 12 cm pedal is `edge: "left", pos: 2 / 12`. This
represents any point on the four edges exactly. A jack inset from the edge would
need an optional additive `xCm`/`yCm` (only if a source actually requires it).
When only the **edge count** is known (e.g. “2 jacks on top”), record two
`jacks` entries with `kind` + `edge` and **omit `pos`**; the resolver distributes
them evenly across that edge and marks the anchors **approximate** (hollow ticks).
Exact `pos` can be filled later from measured cm. When no jack data exists at all,
P4-02's fallback anchors apply (assumed IN left / OUT right).

### Enrichment (show when present)
`power` (`voltage`, `acDc`, `currentMa`), `usage` (`guitar|bass|both|unknown`),
input/output count, mono/stereo, `color`, `year`, `status`, original `notes`,
`sources`, `confidence`, `lastVerified`.

### Schema additions (P5-01 implementation)
`usage`, `color?`, `notes?`, `year?`, `status?`, `confidence?`, `lastVerified?`,
and a **`public-asset`** value in `SOURCE_TAGS`. `jacks.stereo?` already exists.

## Master inventory

- Normalize `Brand`/`Name`, dedupe by slug, collapse colorways to `variantOf`.
- Inventory is **off-runtime** (`data/catalog/inventory.json`).
- Tier A = top ~20 brands / ~2,000 pedals (launch scope); Tier B = next ~30
  brands; Tier C = long tail.
- Priority: BOSS, Electro-Harmonix, JHS, MXR, TC Electronic, Behringer, Keeley,
  Walrus Audio, EarthQuaker, Mooer, Joyo, Strymon, Wampler, Dunlop, Fender,
  DigiTech, Catalinbread, OBNE, GFI, Meris, Red Panda.
- PedalPlayground is **discovery only** — facts and images are re-verified.

## Image policy & pipeline

Owner-approved self-hosted public-asset policy (ADR-003). Every shipped image is
a **static asset** (`imageSource: "static"`) under `public/pedal-assets/`, or the
P5-05 CDN.

### Candidate sourcing
1. Official manufacturer product/press page.
2. Authorized retailer/product page.
3. Existing public catalog image (last resort).
Record the source URL per item; never bulk-copy descriptions.

### Quality gate
1. **Analyzer (script, `sharp`)** — min 800 px long edge; background uniformity;
   alpha; trim bbox/whitespace; aspect ratio vs `widthCm/heightCm` (accept ~≤10%,
   flag 10–15%, reject >15%); rotation/skew ≤2°; shadow/perspective/watermark
   signals.
2. **Processor (script)** — background removal (extend the existing flood fill;
   dev-only ML fallback for gradients/shadows), trim, transparent PNG, 800/350.
3. **Vision QA** — only ambiguous images, on **contact sheets** of 20–30; never
   one call per image.
4. **Fallback** — max 3 candidates → placeholder + `needs-new-image` flag.
5. **Human contact sheet** per brand before PR merge.

Regression fixtures: **BOSS AC-3** (white background) and **TC Choka** (bad crop).

## Hosting cap and P5-05

- **Hard cap: 2,000 pedals with hosted images** (~4,000 files, ~300 MB).
- The runner checks before/after each batch; at the cap it stops all P5-03 waves
  and reports.
- Current Cloudflare Pages/GitHub setup is safe at this cap. Full 8,557 would be
  ~17,100 images (~1.2 GB+) and hits Pages’ 20,000-file / repo-size / directory
  limits.
- **P5-05 (deferred)** evaluates R2 public bucket (leading), Pages Pro, a
  separate Pages asset project, Backblaze B2, Bunny CDN; ADR-002 update + cost
  table + migration plan. No migration without owner approval.

## Parallel work & control plane

```text
data/catalog/inventory.json
data/catalog/brands/<brand>/<batch>.json      # one agent owns one batch file
data/catalog/registry.json                    # coordinator only
work/catalog/state|control|checkpoints|logs   # runtime control plane
public/pedal-assets/**                        # final assets
```

- Brand agents write **only** their batch file + own assets; never
  `src/catalog/data/pedals.json`.
- Feature agents write `src/**` / `e2e/**` only. No shared-file conflicts.
- `pnpm catalog:build` regenerates the runtime catalog after merges.
- **Max 3 batches in flight**; one brand batch = one branch/worktree = one PR.
- Batch size 25–40 pedals; BOSS (209) splits into ~5–6 batches.
- `catalog-runner` + `pnpm catalog:status [--watch]`,
  `catalog:pause|stop|resume`, global `STOP`, per-agent flags.
- Per-agent state: progress %, pedals done/total, images accepted/rejected,
  elapsed, heartbeat, blockers.
- Checkpoint after every pedal; atomic writes; no PR on stop; SIGTERM/SIGKILL
  fallback; stale heartbeat alert after 30 min.
- **Status message every 15 minutes**; hard per-pedal limit 12 min (initial),
  per-batch 4 h; tune after the pilot.

## Execution

1. **P5-01** policy, data contract, inventory, schema, 2k cap.
2. **P5-02** tooling, quality gates, control plane, agent templates.
3. **Pilot:** TC Choka — one PR with data + hosted image + contact sheet +
   Playwright.
4. **Small parallel test:** Meris (15) + Red Panda (14) — one PR each.
5. **Big-brand split test:** BOSS, 3 batch PRs in parallel; verify build/merge.
6. **Scale:** 3 batches in flight continuously; refill as each finishes (no
   one-per-day assumption). Priority brands first.
7. **At 2,000 hosted pedals:** stop; run P5-05; resume only after the decision.
8. **P5-04:** final QA, provenance, launch gate.

## Per-PR QA

- Schema valid; no duplicate ids; variants resolve; mandatory fields present.
- Both image renditions exist; alpha/background/aspect pass; image loads
  same-origin; export stays untainted.
- Playwright: picker search + brand/effect filters; canvas placement; no console
  errors; screenshot/contact sheet in the PR.
- Coverage report: pedals covered, unresolved, duplicates, image pass/reject.

## Cost/time

After the BOSS split test, measure tokens/time per pedal, image accept rate, and
rework rate. Tune batch size/model tier. No fixed calendar commitment until then.
The 2,000 cap and the measured batch duration are the real constraints.

## Historical note

The old appendix (per-pedal mocked/cleared status for the 207-item seed) is
superseded by this plan and remains in git history. The machine-readable source
of truth is the catalog data + the P5 registry.
