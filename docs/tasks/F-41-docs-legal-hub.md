# F-41 — docs/legal hub

**Phase:** 1 · **Status:** in progress · **Model:** light (escalate only if high-risk)

## Goal

Ship the public documentation and legal hub as static, same-origin pages:
`/privacy`, `/terms`, `/docs`, `/help`, `/features`, `/changelog`,
`/community-guidelines` and `/takedown`. Link the hub from the app's help/legal
entry points so a user can reach it without leaving the product, and make it the
single place every feature updates. Content is limited to facts we can support
from the existing attribution/takedown policy, the shipped feature inventory and
the app's actual data behaviour; no invented policies, analytics or backend.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` → §2 Phase 1 F-41 + §4
- `docs/features/README.md` → inventory + Known gaps
- `docs/catalog/attribution-takedown.md`
- `docs/design.md` (privacy/legal, self-hosted assets)
- `docs/requirements.md` → V1 features, non-goals, acceptance criteria
- `public/attribution.html`, `src/App.tsx` (toolbar/chrome), `src/components/InfoPanel.tsx`
- `src/styles/tokens.css`, `src/index.css`

## Workstream / boundaries

- **Feature workstream:** own `public/{privacy,terms,docs,help,features,changelog,community-guidelines,takedown}/**`,
  any shared hub CSS under `public/`, `src/**` entry-point links, `e2e/**`, this
  task file and `docs/screenshots/<task>/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**; this task does not need one.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- No new runtime dependency (static HTML/CSS is expected). If a build step is
  unavoidable, justify it and keep it dependency-free.
- No analytics/consent code (F-42 owns that). No invented legal promises.
- Pages must be same-origin, work with JS disabled, pass the design gate, and
  keep the app's "Blueprint" visual language (dark + light, desktop + mobile).
- Do not present per-item catalog source URLs; keep provenance private per
  ADR-003. The public takedown/attribution copy is the approved baseline.
- **Design gate:** designer proposal → owner approval → implement → ≤2
  `design-reviewer` passes on desktop + mobile, dark + light.
- **Code review:** ≤1 light pass; escalate only for a blocker/high-risk change.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard cap ≤1.1M; 6 h active.

## Steps

1. Audit existing public pages, app help/legal entry points, copy and routes.
2. Run the designer proposal; record the approved direction.
3. Implement static pages + shared hub chrome; wire app entry points.
4. Add E2E coverage for routes, navigation, copy and responsive chrome.
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
6. Update `docs/features/README.md` rows/Known gaps after behaviour lands.
7. Open exactly one PR with all standard sections; do not merge.

## Acceptance (executable)

- `/privacy`, `/terms`, `/docs`, `/help`, `/features`, `/changelog`,
  `/community-guidelines` and `/takedown` each return a complete page on the
  built site (desktop + mobile), with the app's help/legal links reaching them.
- The existing attribution/removal content is preserved or improved, never lost;
  no per-item source URLs are exposed.
- Hub navigation works between every page and back to the app; pages render
  without JS; focus states and headings are semantic.
- Desktop + mobile, dark + light screenshots are captured.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
- No edits to catalog data/assets/tools or `src/catalog/**`; no new runtime deps.
- One PR; no merge.

## Notes

- **State discrepancy:** F-33 is verified merged (`1cb9a546`, PR #95) but is not
  recorded in `docs/progress.md`/`docs/roadmap.md`. That reconciliation is
  coordinator/owner-owned; this session did not rewrite those files.
- **Design approval:** owner approved the “Drawing Set” direction on 2026-11-03.
  `design-reviewer` pass 1 = changes-required (mobile nav clip, mobile table
  squeeze, light-mode card edges, card radii/alignment, row rhythm); all folded.
  Pass 2 = approve-with-changes, no blockers; the remaining value-level items
  (mobile Features labels/pill, keycap alignment, removal-card gap, card voids)
  were folded without a third pass (≤2 cap).
- **Performance:** JS 1,398.34 kB raw / 346.33 kB gzip (+0.21 kB gzip vs F-33);
  CSS 132.79 kB raw / 16.48 kB gzip (+0.23 kB gzip actual-gzip comparison).
  Hub page weight (privacy, gzip): 2.35 kB HTML + 3.60 kB CSS + 0.59 kB JS ≈
  6.5 kB; no framework/bundle load. Desktop/mobile load 9–30 ms; 112–172 DOM
  nodes; no app heap or share/export size change.
- **Code review:** 1 light pass = changes-required (cold-start E2E race for the
  help chip; route-list drift; untested picker/InfoPanel links; duplicate link
  naming). All fixed; no second pass (simple test/refactor fixes). The stale
  `tools/catalog-license` attribution string is left for a coordinator/catalog
  session (feature sessions must not edit `tools/catalog-*`).
- Record billed tokens by class (builder / vision / code review) in the PR and
  session summary.
