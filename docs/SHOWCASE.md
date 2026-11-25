# Pedalvision — agentic-workflow showcase

Pedalvision was built by a human owner working with AI agents under a strict, documented process. The app is closed for now (superseded by PedalPlayground v2); this page is a guided tour of *how* it was built.

## The rules

[`AGENTS.md`](../AGENTS.md) is the operating system for every session. Highlights:

- **Session protocol** — read the current task, do only that task, verify acceptance, review, update the handoff doc, open **one** PR.
- **Design gate** — the `designer` agent proposes, the owner approves the direction, the `design-reviewer` checks the rendered pixels (desktop + mobile, dark + light), with a hard cap on passes.
- **Code-review gate** — one light-model pass per task, escalated only for high-risk changes; findings are fixed and re-tested.
- **Phase gate** — a full review between phases, folded back into the docs before continuing.
- **One PR per task, never merged by the agent** — the owner reviews and merges.

## The agents

| Agent | Role |
| --- | --- |
| `designer` | Staff-level UX/UI direction (tokens, layout, components, canvas visuals) |
| `design-reviewer` | Vision review of the actual rendered screenshots |
| `code-reviewer` | Staff-level code/architecture/security review |
| `pedal-expert` | Researches verified pedal/board facts and specs |
| `pedal-user` | Gigging-guitarist perspective (optional user-value review) |
| `performance-expert` | CPU/memory/bandwidth/hosting cost review |
| `token-usage-reviewer` | Audits plan/rule changes for token efficiency |
| `catalog-coordinator` | Runs parallel catalog batches (up to 3) without opening PRs |
| `catalog-pedal-researcher` / `catalog-board-researcher` | Research one brand batch, write raw records + sources |
| `catalog-image-scout` / `catalog-image-reviewer` | Deterministic image processing + contact-sheet vision QA |

All live in [`.opencode/agent/`](../.opencode/agent/), with slash commands in [`.opencode/command/`](../.opencode/command/) and the UX playbook in [`.opencode/skills/ux-polish/`](../.opencode/skills/ux-polish/).

## The process artefacts

- [`docs/decisions/`](../docs/decisions/) — 10 ADRs: canvas library, hosting/assets, catalog data, agent context, design governance, code-review governance, mobile testing, architecture, planner-fill waiver, access model.
- [`docs/tasks/`](../docs/tasks/) — self-contained task files with scope, required reading, acceptance criteria and outcome.
- [`docs/progress.md`](../docs/progress.md) — the handoff log: each session's result, checks, review rounds and next task.
- [`docs/design-playbook.md`](../docs/design-playbook.md) — the UX-heavy rework recipe (root-cause → owner-approved direction → designer ⇄ reviewer loop → QA → one PR).
- [`docs/phase-guide.md`](../docs/phase-guide.md) — what each phase does and where only the owner could act.

## The loops in practice

- **Design gate:** `designer` proposal → owner approval → `design-reviewer` on rendered pixels → implement each round → re-render (dark/light, desktop/mobile) → capped iterations. See PR [#2](https://github.com/ricardoaxel/pedalvision/pull/2), [#108](https://github.com/ricardoaxel/pedalvision/pull/108), [#109](https://github.com/ricardoaxel/pedalvision/pull/109).
- **Code review:** one light-model pass on the source diff, capped findings (blocker / should-fix / nit), fixes committed separately, test suite as the re-check. Escalate only for high-risk changes.
- **Parallel catalog waves:** up to 3 brand batches at once via a supervised wrapper, each with per-item checkpoints, token/time budgets, pause/stop controls, and exactly one PR per batch. See PR [#62](https://github.com/ricardoaxel/pedalvision/pull/62) and the catalog-wave batches.

## Exemplar PRs

| PR | Why it is interesting |
| --- | --- |
| [#2](https://github.com/ricardoaxel/pedalvision/pull/2) | Seven-round designer ⇄ vision-reviewer loop that produced the "Blueprint" theme, with per-round commits |
| [#62](https://github.com/ricardoaxel/pedalvision/pull/62) | Parallel catalog-workstream governance and budgets |
| [#103](https://github.com/ricardoaxel/pedalvision/pull/103) | Feature with design review, code review and an owner-requested live-preview revision |
| [#108](https://github.com/ricardoaxel/pedalvision/pull/108) | Before/after desktop + mobile screenshots and a review-round digest |
| [#109](https://github.com/ricardoaxel/pedalvision/pull/109) | The final task: hover previews + Patch popover focus, with gesture-guard and focus fixes found in review |

## What "done" looked like

- Every task ended with: lint, typecheck, unit tests, production build, and (for UI work) Playwright E2E on desktop + mobile.
- Final state: **1,107 unit tests**, full E2E **474 passed / 24 skipped**, JS bundle **359.54 kB gzip**, CSS **18.81 kB gzip**.
- 109 pull requests, each with a summary, testing steps, screenshots, owner review hints and a review-round digest.

## Licensing

Code is MIT (see [`LICENSE`](../LICENSE)). Catalog/pedal/board imagery is third-party and excluded from the MIT grant — see [`NOTICE`](../NOTICE), [attribution](../public/attribution.html) and [takedown](../public/takedown/index.html). The project was non-commercial (ADR-009); many images remain *license-pending*.
