# Pedalvision — Feature + Catalog Roadmap Proposal

**Status:** owner-approved proposal for recording; no implementation in this file.
**Date:** 2026-10-27.
**Sources:** `docs/requirements.md`, `docs/design.md`, `docs/roadmap.md`,
`docs/progress.md`, `docs/tasks/P5-03-image-completion-plan.md`,
`docs/tasks/P5-03d-parallel-workstreams.md`.

## 1. Operating rules

- **Catalog lane:** 3 batches in flight by default, via `catalog:wave` only.
  **T-2c/T-2d** (wrapper safety fix + 3-wide default, PR #62) must merge before
  T-3. The true billed-token metric remains for budgets/stops; the third-slot
  **start** gate is retired by owner decision. Every wave has a logged 3-wide
  start (no flag); soft is logged, hard 2.4M stops.
- **Feature lane:** one feature at a time, after #59; separate worktree; feature
  code/e2e/task/screenshots only. Never edit catalog data/assets/runtime/tools or
  shared docs/config/deps.
- **Catalog cap:** **3 PRs awaiting owner review** (one per batch). **Feature cap:**
  **1 PR**, separate. 3 catalog + 1 feature = 4 PRs is allowed. At the catalog cap,
  start no new catalog wave; at the feature cap, start no new feature.
- **Budgets:** catalog 400k/800k per batch; wave soft 1.6M / hard 2.4M;
  feature 400k/800k + review ≤300k, task hard 1.1M; combined soft 2.2M / hard
  3.4M billed non-cache. 3-wide is owner-accepted risk; log over-soft.
- **Every merge:** verify the post-merge build, update progress, rebase open
  branches, then refill. No generated-file hand edits.
- **Next-wave protocol:** read `catalog:status`, the latest `catalog:wave`
  report/state, `docs/progress.md`, open PRs and post-merge build before selecting
  the next uncompleted batches. Never redo merged; resume/repair failed/stopped.
  No raw logs; ≤3 refills per wave; one WS line per checkpoint.

## 2. Feature phases (easiest → hardest)

### Phase 1 — Core correctness and polish (no backend)

- Q-01 rotate-shadow flicker; Q-02 export scale reference; Q-03 DD-2 search
  normalization; Q-04 mobile add (+); Q-05 cable color picker.
- F-01 P2-10 `350/` thumbnails; F-02 P4-05 read-only jack ticks/export bounds;
  F-03 measurement HUD; F-04 viewport focus; F-09 rotation snap; F-11 cable
  schedule; F-12 pedal labels; F-14 similar pedals; F-16 custom colors;
  F-19 feature/E2E impact map; F-26 help; F-32 mobile picker.
- **F-36 signal-flow validation:** output→output, missing IN/OUT, feedback loops,
  stereo/TRS misuse, unconnected chains; works with fallback/corrected anchors.
- **F-37 scene/share persistence versioning:** versioned codec, guards, migrations,
  history/export/backup/capacity wiring; prerequisite for F-21/F-22/F-33/F-35.
- **F-38 search/filter overhaul:** punctuation/model aliases, brand/effect tags,
  sort; Q-03 is the quick fix.
- **F-33 local jack/IO correction:** per-scene override of IN/OUT/PWR/EXP
  edge/position; reset to catalog; assumed/corrected state; share/export.
- **F-41 docs/legal hub:** `/privacy`, `/terms`, `/docs`, `/help`, `/features`,
  `/changelog`, `/community-guidelines`, `/takedown`; every feature updates it.
- **F-42 PostHog analytics:** cookieless default; consent for cookies/session
  replay; EU cloud; no PII; event taxonomy/funnels/feature flags; privacy first.
- **F-45a access-model ADR:** free/account/supporter/one-time; no implementation yet.

### Phase 2 — Data model and differentiators (no backend)

- F-05 motion; F-06 board info/chrome; F-07 selection/highlight/modal polish;
  F-10 cable angles; F-17 custom pedal image (local).
- F-21 sticky notes.
- **F-22 tiered boards:** 2+ tiers, **max 3**, risers/height/clearance, item tier
  assignment, export/share; no separate board-on-board stacking task.
- F-27 PWA.
- F-33 if not completed in Phase 1; F-37 must be complete first.

### Phase 3 — Power/IO data (catalog-dependent, last)

- **F-34 power supply output model:** `outputs[]` (count, V, AC/DC, polarity, max
  mA, isolated/daisy, connector); catalog schema/raw/mapped/runtime; coordinator/
  serial, not feature-lane. Current data: 108/296 power, 78/296 jacks, 6 supplies,
  aggregate power only.
- **F-20 signal/power plug display:** audio vs power plugs; partial with current
  coverage.
- **F-35 power routing and consumption:** assign pedals to outputs; sum mA;
  headroom/overload; voltage/polarity mismatch; isolation/daisy; board power.
  Depends F-34 + coverage.

### Phase 4 — Accounts, community, access, growth (backend)

- **F-44 accounts + cloud saves.**
- **F-45b access model implementation:** free anonymous / free account / supporter
  monthly / one-time; entitlements, payments, refunds/tax.
- **F-24 community gallery + profiles.**
- **F-39 pedal submission + correction requests:** upload, image rules, rights,
  moderation, optional jack/IO marker step, review queue.
- **F-40 GitHub correction MVP:** optional no-backend first step.
- **F-29 reviews from other sites; F-30 user reviews.**
- **F-25 price/availability/affiliate.**
- **F-46 themes; F-47 favorites; F-48 explore/trending; F-49 community jack maps.**
- **F-50 OG/social previews:** static first; dynamic after share v3 + edge.
- **F-51 native shell:** defer; PWA first.

### Phase 5 — Launch/ops

- C-16 image hosting at 2,000; C-17 Appium; C-18 observability/RUM/errors;
  C-09 final QA/launch.
- Docs/legal/privacy/terms, analytics consent, OG, iOS export, audit.

## 3. Access model (proposal)

| Tier | Features |
|---|---|
| Free anonymous | Core planner, local saves, share/export, catalog search, custom pedals, cables, undo, help, basic power warnings, PWA |
| Free account | Limited cloud saves, favorites, gallery browsing, submissions/corrections, reviews, profile |
| Supporter monthly | Unlimited cloud, tiered boards, full power planner/consumption, advanced export, early access, badge, private boards, priority support |
| One-time donation | Founding-supporter badge + 12 months of supporter features (not lifetime cloud) |
| Never paywalled | True-scale planner, basic cables/power warnings, local save, share/export, catalog, help |

Beta is free; introduce supporter tiers at launch; grandfather beta users.
Community contributions are free for account holders to grow the catalog.

## 4. Docs, privacy, analytics, OG

- **F-41 docs/legal hub:** privacy, terms, tutorials, feature catalog, changelog,
  community guidelines, takedown; linked in footer/help; updated every feature.
- **F-42 PostHog:** cookieless default; anonymous IDs; EU cloud; no PII; consent
  for cookies/session replay; mask inputs/canvas; retention/opt-out; event
  taxonomy (open → search → add → place → cable → export/share; errors/perf);
  funnels/feature flags/A-B.
- **F-50 OG:** static site OG now; dynamic per-share later. Share data is in the
  URL hash, which servers cannot read; dynamic OG needs a server-readable share
  URL (`/s/...` or query) + edge function, depending on F-37.

## 5. Pedal submission / correction

- Phase 1 (no backend): GitHub issue forms + F-33 local correction + image rules.
- Phase 2 (backend): F-39 accounts/upload/moderation; image rules (top-down, flat,
  transparent, no card/caption, min resolution, rights); optional jack/IO marker
  step; correction requests for existing pedals; review queue; provenance;
  takedown.
- “Patch corrector” means jack/IO position marking, not cable-path editing; cable
  paths are F-10.

## 6. Cross-feature requirements

- **Performance guardrail:** every feature PR reports bundle delta, picker/canvas
  frame time, memory, share/export size; scripted thresholds; no regression.
- **Feature demo link:** full deployed URL + share hash where state is
  representable; 1 desktop + 1 mobile screenshot; video only when interaction
  cannot be shown; no localhost.
- **Docs update:** every feature updates the public feature catalog/tutorial and
  the QA impact map.
- **Scene versioning:** F-37 before sticky notes, tiered boards, jack overrides,
  power connections, or public launch.
- **Accessibility:** no full audit; lightweight per-feature keyboard/focus/
  contrast/touch check.
- **No count-based E2E; no catalog/shared edits in feature PRs.**

## 7. Next actions

1. Merge this proposal; start **T-2c** (wrapper 3-wide fix) and **F-01 P2-10**.
2. After T-2c: **T-3 3-wide**; feature F-02/F-19.
3. Continue catalog waves 3-wide with next-wave protocol; feature one at a time.
4. Phase 3 power/IO after catalog coverage; Phase 4 accounts/community/access.
5. Phase 5 launch.
