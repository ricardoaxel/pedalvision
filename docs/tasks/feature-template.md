# Feature task template

**Phase:** <P#> · **Status:** todo · **Model:** light (escalate to strong only for architecture/security/high-risk)

## Goal

<One paragraph: what this task delivers and why. Tie it to the roadmap item.>

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- <the 2–3 requirement/design sections this task actually needs>

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/<task>/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: if this task needs one, **STOP**
  and report — it becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; same-origin images;
  minimal dependencies (justify any new one).
- **Design gate** only if design-affecting: designer proposal → owner approval →
  ≤2 `design-reviewer` passes on desktop + mobile (dark + light) → fold findings.
- **Code review:** ≤1 light pass (≤2 only for high-risk / a blocker); reuse the
  reviewer session; the test suite is the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review allowance
  ≤300k; task hard cap ≤1.1M; 6 h active.
- If the task needs catalog data or a shared file, split it out — do not widen scope.
- **Performance guardrail:** record bundle delta, picker/canvas frame time, memory and
  share/export size; run the relevant benchmark; no regression beyond thresholds.
- **Docs update:** update the public feature catalog/tutorial and the F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Restate the scope and executable acceptance criteria.
2. Implement in the feature worktree.
3. Run the design gate if needed (record the direction + owner approval).
4. Add/keep tests; run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. Run the touched E2E flow on desktop + mobile when the UI changed.
6. Rebase onto the verified post-merge `main`; re-run the affected checks.
7. Open exactly one PR with the standard sections, including the **feature demo link**; do not merge.

## Acceptance (executable)

- <Task-specific criteria; one line each, verifiable by a command or a screenshot.>
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green (desktop + mobile for UI changes).
- **Feature demo link** opens the final PR preview with the feature applied
  (`?share=1#s=…` where representable; video/steps otherwise), desktop + mobile.
- Performance numbers recorded; no regression beyond thresholds; docs/feature
  catalog updated.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*` or other shared/coordinator-only files.
- One PR; no merge.

## Notes

- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the owner
  first; do not edit the rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the PR/session
  summary. Demo links are required; screenshots alone are not enough for interaction
  features.
- This template is feature-only; catalog batches use `docs/tasks/P5-batch-template.md`.
