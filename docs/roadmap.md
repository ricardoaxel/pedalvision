# Roadmap

Task files live in `docs/tasks/`. Only P0–P1 have detailed files; later phases are one-liners — expand them into task files when scheduled (see decisions/004).

## P0 — Foundation
| Task | Title | Status |
|---|---|---|
| P0-01 | Repo scaffold (Vite + React + TS + Konva + Zustand) | todo |
| P0-02 | CI/CD pipeline (GitHub Actions → Cloudflare) | todo |
| P0-03 | Design tokens (CSS vars + JS theme map, dark default) | todo |
| P0-04 | Asset serving — Pages-shipped images (same-origin, no R2) | todo |
| P0-05 | Catalog schema + import transformer + synthetic seed | todo |

> **Sequencing (S7):** P0-02 needs owner actions (GitHub repo + Actions secrets). P0-04/P0-05 no longer depend on the owner (Pages-shipped assets, committed synthetic seed). **P1-01 has zero dependencies** — after P0-01 lands, run P1-01 (pure geometry) to fill any gap while owner-blocked tasks wait.

## P1 — Canvas core
| Task | Title | Status |
|---|---|---|
| P1-01 | True-scale engine (cm↔px geometry lib + tests) | todo |
| P1-02 | Stage: dot grid, pan, zoom-to-pointer, resize-proof | todo |
| P1-03 | Boards: place / move / rotate | todo |
| P1-04 | Pedals: place / drag / duplicate / delete | todo |
| P1-05 | Free rotation + selection UX (hover, touch anchors) | todo |
| P1-06 | Z-order controls (bring forward / send back) | todo |

## P2 — Catalog & objects (expand when scheduled)
- P2-01 Picker modal: search + brand/effect filters; mobile bottom tabs
- P2-02 Custom pedal creator (category pedal/supply, power fields, **jack edge + pos along edge**, cm/in toggle) (N3)
- P2-03 Pedal info panel (tags, dimensions, power)
- P2-04 Asset-pipeline tooling (bg removal, trim, 800/350 sizes, JSON draft)
- P2-05 Custom board creator (any W×D, texture)
- P2-06 Catalog procurement (owner-assisted): brand outreach log + permission tracking + dimension spot-check (S4/S6)
- P2-07 Asset CDN (R2) — deferred (ADR-002): revisit before catalog exceeds ~2k items
- P2-08 First-run empty-state guidance (hint overlay / default-open picker — "instant use, easy to learn" lesson) (R6/N2)

## P3 — Output (expand when scheduled)
- P3-01 Export PNG (detached offscreen Stage, scope: selected-board | all-content w/ fit-cap, pixelRatio ≤2 + total-pixel clamp, verify on iOS Safari) (S1/S2)
- P3-02 Scene save/load + multi-scene index (IndexedDB) + autosave + **boot-time index↔doc reconcile** (R6/S2)
- P3-03 Share links (versioned codec, **custom pedals travel inline**, deflate → base64url hash; read-only view + "save a copy"; note the ~200KB cap interplay) (S1/R6)
- P3-04 Undo/redo (snapshot store) + keyboard shortcuts (S5/N6 — separate task, one concern)
- P3-05 Storage-failure fallback (IndexedDB availability check + inline warning + JSON backup download) (N3 — separate task, one concern)

## P4 — Cables (expand when scheduled)
- P4-01 Cable model + jack anchors in catalog schema
- P4-02 Drag-connect UI + direction arrows + amp/instrument endpoints
- P4-03 Auto length calculation + cable list summary

## v2 backlog (not scheduled)
Accounts (Google OAuth) · cloud saves · community gear submissions + moderation + attribution · power-supply planner · explore/trending/famous boards · themes · locale-aware affiliate links · favorites · **tiered/riser boards (deferred from v1, S4)** · **board-to-board stacking/z-order (deferred from v1, S6)**

## Launch gate (v1 public) — ALL must pass
- [ ] Catalog contains cleared assets only — synthetic seed + placeholder fully swapped (decisions/003 exit criteria: `source ∈ {licensed, brand-assets, community, own}` + min 200 pedals/10 brands + dimension spot-check + note purged)
- [ ] A1–A5 acceptance criteria green on production
- [ ] `pnpm audit` clean; all dependencies < 6 months old
- [ ] iOS Safari export verified on a real device