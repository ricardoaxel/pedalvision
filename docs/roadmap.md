# Roadmap

Task files live in `docs/tasks/`. Only P0–P1 have detailed files; later phases are one-liners — expand them into task files when scheduled (see decisions/004).

## P0 — Foundation
| Task | Title | Status |
|---|---|---|
| P0-01 | Repo scaffold (Vite + React + TS + Konva + Zustand) | done |
| P0-02 | CI/CD pipeline (GitHub Actions → Cloudflare) | done |
| P0-03 | Design tokens (CSS vars + JS theme map, dark default) | done |
| P0-04 | Asset serving — Pages-shipped images (same-origin, no R2) | done |
| P0-05 | Catalog schema + import transformer + seed | done |

> **P0 COMPLETE + phase gate PASSED** (all 5 merged; post-phase review done 2026-10-14 — findings folded into the docs). ✅ **P1 cleared to start** (begin with **P1-01**). P0-05's transformer needs the external catalog file only to run `import`/backfill (the committed seed covers dev/CI).

## P1 — Canvas core
| Task | Title | Status |
|---|---|---|
| P1-01 | True-scale engine (cm↔px geometry lib + tests) | done |
| P1-02 | Stage: dot grid, pan, zoom-to-pointer, resize-proof | in review — PR #9 |
| P1-02b | Touch/gesture E2E (Playwright + CDP multi-touch) | in progress |
| P1-03 | Boards: place / move / rotate | todo |
| P1-04 | Pedals: place / drag / duplicate / delete | todo |
| P1-05 | Free rotation + selection UX (hover, touch anchors) | todo |
| P1-06 | Z-order controls (bring forward / send back) | todo |

## P2 — Catalog & objects (expand when scheduled)
- P2-01 Picker modal: search + brand/effect filters; mobile bottom tabs
- P2-02 Custom pedal creator (category pedal/supply, power fields, **jack edge + pos along edge**, cm/in toggle) (N3) — **prereq:** widen the `jacks.kind` vocabulary first (current enum `in|out|exp|power` is too narrow for real pedals — add `send`/`return`/`exp-in`/`exp-out`/`midi`/`ctrl` in `src/catalog/schema.ts` + design.md §Data model)
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
- P4-01 Cable model + jack anchors in catalog schema — **prereq:** the widened `jacks.kind` vocabulary from P2-02 (see above)
- P4-02 Drag-connect UI + direction arrows + amp/instrument endpoints
- P4-03 Auto length calculation + cable list summary

## P5 — Catalog completion (pre-launch) (expand when scheduled)
> Runs **after P1–P4, before any public launch** — this is the "backfill all the rest of the pedals of all brands + clear everything" phase. The full data plan (steps, master inventory, image-rights workflow) lives in **`docs/catalog-backfill.md`**; the launch bar is ADR-003's exit criteria.
> **Now (P0-05 seed):** 207 pedals / 13 brands / 10 boards; `source: 'placeholder'`; **mocked** images; `effectTypes` for 201/207; 485 source refs (340 image links) — a representative slice, not the full catalog.
- **P5-01 Full-catalog backfill** — run `pnpm catalog:import` at full scale (all brands/models, no caps) + `catalog:seed`/`catalog:reclassify`; fill `effectTypes` (verified overrides) and specs (`power` + `jacks` after widening the jack-kind vocabulary) for every item; keep per-item `sources`.
- **P5-02 Image clearance (rights-first)** — acquire + clear real images (permission / official brand assets / community / own) and replace every mocked PNG, flipping `source`. Depends on **P2-06** outreach. **No scraping** (ADR-003).
- **P5-03 Provenance & verification sweep** — per-item verification date + confidence; dimension spot-check (≥10) against manufacturer spec sheets.
- **P5-04 Launch-gate sign-off** — minimum bar (≥200 pedals / ≥10 brands, cleared assets only), A1–A5 green, `pnpm audit`, iOS export.
- **P5-05 Full-integration device E2E (Appium, local) — PROPOSED (not scheduled).** At the very final integration stage, a small Appium smoke against the local iOS Simulator / real Android to validate real-engine touch end-to-end. Free if Xcode/Android SDK present; deferred to avoid heavy setup now. See `docs/decisions/007-mobile-touch-testing.md` + `docs/tasks/P5-05-appium-local-device-e2e.md`.

## v2 backlog (not scheduled)
Accounts (Google OAuth) · cloud saves · community gear submissions + moderation + attribution · power-supply planner · explore/trending/famous boards · themes · locale-aware affiliate links · favorites · **tiered/riser boards (deferred from v1, S4)** · **board-to-board stacking/z-order (deferred from v1, S6)**

## Launch gate (v1 public) — ALL must pass
- [ ] Catalog contains cleared assets only — mocked seed images + `placeholder`-sourced items fully swapped (decisions/003 exit criteria: `source ∈ {licensed, brand-assets, community, own}` + min 200 pedals/10 brands + dimension spot-check + note purged)
- [ ] A1–A5 acceptance criteria green on production
- [ ] `pnpm audit` clean; all dependencies < 6 months old
- [ ] iOS Safari export verified on a real device
- [ ] **Real-device touch/interaction pass** — pinch/pan on a physical phone (automated coverage is Chromium-only; see **P5-05** proposal for local Appium E2E)