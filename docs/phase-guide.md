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

> P2-06 Catalog procurement was **renumbered to P4-04** (pre-launch owner track; see P4).
>
> ✅ **P2 phase gate PASSED (2026-10-19)** — all scheduled P2 tasks merged; post-phase review folded into the docs, with one small proposed follow-up (**P2-10** thumbnails). **P3-01 Export PNG + PDF**, **P3-02 Scene save/load**, **P3-03 Share links**, **P3-04 Undo/redo** and **P3-06 Capacity budgets + benchmark** are done (merged 2026-10-19/20). Next: **P3-05 Storage-failure fallback**.

## P3 — Output (no owner action)
Export PNG + PDF · save/load + boot reconcile · capacity budgets + benchmark · share links · undo/redo · storage-failure fallback.

## Performance & cost review (optional — owner request, 2026-10-20)

Run the **`performance-expert`** agent (`.opencode/agent/performance-expert.md`) before the PR for a **performance-sensitive task**: canvas scale / many objects, share-link or URL payloads, export, IndexedDB/storage, bundle/dependency changes, or anything that raises a product cap. Also run it **before raising a capacity cap** and **before the launch gate**. It reviews client CPU/memory/bandwidth/storage, Cloudflare free-tier/hosting cost, abuse limits, and free-tier user caps, with current sources and a measurement plan. It is **not a mandatory gate** — it advises; the owner decides. Run it with `opencode run --agent performance-expert "<prompt>"` (it is not in the in-session Task list until a session restart). Record the verdict and applied/deferred findings in the task + `docs/progress.md`. Precedent: P3-03 Share links (2026-10-20) — verdict `watch`; the 32K URL cap was applied, the large-preview confirmation + bundle split were deferred.

## P4 — Cables
Cable model + jack anchors · drag-connect + endpoints · auto length calc.

| Task | What it does | Owner action? |
|---|---|---|
| P4-01…P4-03 Cables | Model, drag-connect, length calc | No |
| P4-04 Catalog procurement | Brand outreach + permission + dims spot-check | **Yes** — owner sends outreach emails/permission requests (brands reply to the owner, not an agent). **Owner track: start during P4; feeds P5-02 + the launch gate. Not a code dependency for the cable tasks.** *(Renumbered from P2-06.)* |

## v2 backlog
Accounts · cloud saves · community submissions · power planner · explore · themes · affiliate links · favorites · tiered boards · board stacking.

> **Launch gate** = the one moment the owner must decide (approve public launch with cleared catalog). Everything else in v2 is build work.

## The only owner actions in the whole v1 plan
1. **P0-02 (current blocker):** Cloudflare account + API token + account ID → for deploys.
2. **P0-05:** external catalog file on owner machine → to run `import`/backfill (optional; the committed seed works without it).
3. **P4-04 (renumbered from P2-06):** brand outreach + permission requests → for the real catalog. **Timing: start during P4; needed before P5-02 image clearance + the launch gate.**
4. **Launch gate:** approve public launch.