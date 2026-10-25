# Phase guide — what each phase does & what needs the owner

Short explanations so both the owner and any agent session know why each phase exists and where only the owner can act.

## Legend
- **Owner action?** — "No" means a session can execute it fully. "Yes" means the flow STOPS until the owner does the listed thing (owner instruction 2026-09-29: no skipping ahead, blockers ship with full instructions).

## P0 — Foundation
| Task | What it does | Why | Owner action? |
|---|---|---|---|
| P0-01 Repo scaffold | Base Vite+React+TS project, deps, folders, Biome, tests | The base all code sits on | No |
| P0-02 CI/CD pipeline | GitHub Actions: lint→typecheck→test→build→e2e→deploy to Pages | Automated checks + deploys, catch errors before shipping | **Yes** — Cloudflare account + API token + account ID (for deploys; the repo itself is already created). Reason: deploy targets are a Cloudflare account in the owner's name; agents cannot create accounts. |
| P0-03 Design tokens | CSS vars + JS theme map | Consistent UI, theming base (avoid "ugly UI" like pedalplayground) | No |
| P0-04 Asset serving (Pages-shipped) | `public/pedal-assets/` + URL helper | Same-origin images → canvas export works, no CORS, free | No |
| P0-05 Catalog schema + transformer + seed | zod schema, import transformer, committed seed (real facts + mocked PNGs) | Schema is the foundation of everything; seed lets dev/CI work with no external data | **Yes (optional/later)** — the external catalog file lives on the owner machine to run `import`/backfill. Reason: dataset is unlicensed → the input file stays owner-side; only transformed facts + mocked images are committed. The committed seed covers dev/CI without it. |

## P1 — Canvas core (no owner action)
| Task | What it does | Why |
|---|---|---|
| P1-01 True-scale engine | cm↔px geometry lib + tests | The guardrail for all scale/rotation math |
| P1-02 Stage | Grid, pan, zoom-to-pointer, resize-proof | The infinite canvas itself |
| P1-03 Boards | Place/move/rotate pedalboards | Core object |
| P1-04 Pedals | Place/drag/duplicate/delete, cross-board drag | Core object |
| P1-05 Rotation + selection | Free rotation, hover, touch anchors | Core interaction |
| P1-06 Z-order | Bring forward/send back | Core interaction |

## P2 — Catalog & objects
| Task | What it does | Owner action? |
|---|---|---|
| P2-01 Picker modal | Search + filters | No |
| P2-02 Custom pedal creator | User-defined pedals/supplies | No |
| P2-03 Pedal info panel | Tags, dims, power | No |
| P2-04 Asset pipeline | bg removal, trim, resize | No |
| P2-05 Custom board creator | Any W×D board | No |
| P2-07 R2 CDN (deferred) | Asset CDN when catalog grows | No (deferred, not now) |
| P2-08 First-run guidance | Empty-state hint | No |

> P2-06 Catalog procurement moved to **P4-04, then retired into P5-01** (owner decision 2026-10-21; see P5).
>
> ✅ **P2 phase gate PASSED (2026-10-19)** — all scheduled P2 tasks merged; post-phase review folded into the docs, with one small proposed follow-up (**P2-10** thumbnails). **P3-01 Export PNG + PDF**, **P3-02 Scene save/load**, **P3-03 Share links**, **P3-04 Undo/redo**, **P3-05 Storage-failure fallback** and **P3-06 Capacity budgets + benchmark** are done (merged 2026-10-19/21).

## P3 — Output (COMPLETE — phase gate PASSED)
Export PNG + PDF · save/load + boot reconcile · capacity budgets + benchmark · share links · undo/redo · storage-failure fallback.

> ✅ **P3 phase gate PASSED (2026-10-21; PR #29 merged, squash `57dc9c7`; light model)** — verdict **changes-required**, no P3 regression; 5 findings folded docs-only, then confirmation passes 2–3 **approve** (the **P4 wiring contract** replaces the "one-place extension" claim, the share version-policy decision is flagged, export/capacity call sites are listed, and stale status text is fixed). Baseline green: lint / typecheck / test **502** / build / e2e **216 passed + 7 skipped**. **Next: P4-01; catalog procurement later moved from P4-04 into P5-01.**

## Performance & cost review (optional — owner request, 2026-10-20)

**Visual review:** use the `design-reviewer` on **`opencode-go/deepseek-v4.1-flash` only** (vision; never free/Gemini/Claude/other — owner instruction, 2026-10-24).

Run the **`performance-expert`** agent (`.opencode/agent/performance-expert.md`) before the PR for a **performance-sensitive task**: canvas scale / many objects, share-link or URL payloads, export, IndexedDB/storage, bundle/dependency changes, or anything that raises a product cap. Also run it **before raising a capacity cap** and **before the launch gate**. It reviews client CPU/memory/bandwidth/storage, Cloudflare free-tier/hosting cost, abuse limits, and free-tier user caps, with current sources and a measurement plan. It is **not a mandatory gate** — it advises; the owner decides. Run it with `opencode run --agent performance-expert "<prompt>"` (it is not in the in-session Task list until a session restart). Record the verdict and applied/deferred findings in the task + `docs/progress.md`. Precedent: P3-03 Share links (2026-10-20) — verdict `watch`; the 32K URL cap was applied, the large-preview confirmation + bundle split were deferred.

## Agent/token review (MANDATORY for plan/rule changes — owner instruction, 2026-10-25)

Run the **`token-usage-reviewer`** (`.opencode/agent/token-usage-reviewer.md`) **before changing** `AGENTS.md`, this phase guide, the roadmap, task templates, `docs/catalog-backfill.md` process sections, `docs/design-playbook.md`, `.opencode/agent/*`, or **starting a parallel wave**. It returns a strict JSON verdict, agent/model inventory, per-batch token/time budget, findings, lean workflow and stop conditions; fold valid findings and record the verdict in the task/PR.

- **Exempt:** per-batch task copies (`docs/tasks/P5-03-<kind>-<brand>-<batch>.md`) and routine data batches.
- **Before a parallel wave:** max 3 batches, light models by default, per-batch soft ≤400k / hard ≤800k tokens, ≤2 vision passes, ≤1 light code-review pass, 4 h active; wave soft ≤1.2M / hard ≤2.4M; a global stop path. BOSS 209 → 6×~35 in 2 waves.
- It is read-only. If it cannot make the plan lean/safe, **STOP** and report.

## P4 — Cables (COMPLETE — phase gate PASSED)
Cable model + jack anchors · drag-connect + endpoints · auto length calc.

> **P4-01 is DONE** (merged 2026-10-21, PR #30, squash `d0d79ad`). **P4-02 is DONE** (merged 2026-10-21, PR #31, squash `f001a0b`). **P4-03 is DONE** (merged 2026-10-21, PR #33, squash `c0c419b`; owner-approved “Cable Schedule”; derived-only lengths; view-only; read-only recipients can open it; design-reviewer 2/2 approve; performance watch; light code review fixed). **P4 phase gate PASSED** (merged 2026-10-21, PR #34, squash `caee58d`; docs-only). **P4-04 is retired → P5-01** (owner decision 2026-10-21): catalog procurement moved into P5; brand-permission outreach is replaced by the self-hosted public-asset policy. **P4-05 (cable follow-ups) is PROPOSED, not a P5 blocker.**

| Task | What it does | Owner action? |
|---|---|---|
| P4-01…P4-03 Cables | Model, drag-connect, length calc | No |

## P5 — Catalog completion (plan approved 2026-10-21; PR #32 merged; P5-01 + P5-02 DONE; P5-03 Choka + JHS pedal pilots DONE; board pilot in review — PR #39)
P5 turns the 207-item seed into the real catalog and prepares launch. Full plan: `docs/catalog-backfill.md`.

| Task | What it does | Owner action? |
|---|---|---|
| P5-01 Policy, data contract & master inventory | Public-asset policy, attribution/takedown, pedal + **pedalboard** schema, 8,557 pedals + 263 boards inventory, brand tiers — **DONE** (PR #35) | **Yes** — approve the public-asset policy + attribution/takedown page (owner accepts responsibility) |
| P5-02 Quality pipeline & control plane | Pedal/board batch files, build/validate, image analyzer/processor, status/pause/stop, 2,000 cap — **DONE** (merged PR #36) | No |
| P5-03 Pilot + parallel backfill | Choka/JHS pedal pilots + Pedaltrain/Temple board pilots **DONE**; **Meris first-10 merged (PR #42)**; **batch guardrails in review (PR #43)**; next Red Panda + one board batch → BOSS 6×~35 in 2 waves. First 2,000 items include 150 boards | **Yes** — review the pilot/brand PRs and the guardrails PR |
| P5-04 Final QA, provenance & launch gate | Full validation, spot-checks, iOS, launch sign-off | **Yes** — launch approval |
| P5-05 Image hosting at scale | Deferred spike only if the owner chooses to exceed Tier A / 2,000 hosted pedals | **Yes** — choose the hosting option only when triggered |
| P5-06 Appium · P5-07 Help · P5-08 Observability | Proposed/unscheduled | Later |

## v2 backlog
Accounts · cloud saves · community submissions · power planner · explore · themes · affiliate links · favorites · tiered boards · board stacking.

> **Launch gate** = the one moment the owner must decide (approve public launch with the hosted, quality-gated catalog). Everything else in v2 is build work.

## The only owner actions in the whole v1 plan
1. **P0-02 (current blocker):** Cloudflare account + API token + account ID → for deploys.
2. **P0-05:** external catalog file on owner machine → to run `import`/backfill (optional; the committed seed works without it).
3. **P5-01:** approve the self-hosted public-asset policy + attribution/takedown page (owner accepts responsibility).
4. **P5-03:** review the pilot pedal and the first brand PRs.
5. **P5-05 (only if exceeding Tier A):** choose the image-hosting option at the 2,000-pedal cap.
6. **Launch gate:** approve public launch.