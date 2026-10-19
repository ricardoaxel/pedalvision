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
| P1-02 | Stage: dot grid, pan, zoom-to-pointer, resize-proof | done |
| P1-02b | Touch/gesture E2E (Playwright + CDP multi-touch) | done |
| P1-03 | Boards: place / move / rotate | done |
| P1-04 | Pedals: place / drag / duplicate / delete | done |
| P1-05 | Free rotation + selection UX (hover, touch anchors) | done |
| P1-06 | Z-order controls (bring forward / send back) | done |

> **P1 COMPLETE + phase gate PASSED** (all 7 merged: #8 · #9 · #10 · #11 · #13 · #14 · #16; post-phase review done 2026-10-17 — findings folded into the docs). ✅ **Begin P2-01.**

## P2 — Catalog & objects (expand when scheduled)
- P2-01 Picker modal: search + brand/effect filters; mobile bottom tabs — **done** (merged 2026-10-17, PR #17, squash `36734a2`; owner-approved "Specimen Bench" direction, extending "Parts Bin"; replaces the temporary `BoardPicker`/`PedalPicker`). **note:** any temporary/placeholder chrome added before a task must keep a **small on-screen footprint, especially on mobile** so it doesn't cover the canvas (owner instruction, 2026-10-15).
- P2-02 Custom pedal creator (category pedal/supply, power fields, **jack edge + pos along edge**, cm/in toggle) (N3) — **done** (merged 2026-10-18, PR #18, squash `c654e56`; owner-approved "Datasheet" direction; includes edit-a-custom-part + the widened `jacks.kind` vocabulary `in|out|exp|exp-in|exp-out|send|return|midi|ctrl|power`).
- P2-03 Pedal info panel (tags, dimensions, power) **+ space warning** (warn — but still allow — when a pedal overlaps another or extends beyond its board; owner-folded 2026-10-18) — **done** (merged 2026-10-18, PR #19, squash `ef4f5ff`; owner-approved "Readout" → "Specimen Readout" → **"Specimen Cover"** — the specimen image preview: desktop full-bleed banner + measure row, mobile cover peek (64px sleeve) → 72dvh hero)
- P2-04 Asset-pipeline tooling (bg removal, trim, 800/350 sizes, JSON draft) — **done** (merged 2026-10-19, PR #20, squash `bfbe1fe`; dev-only CLI `tools/asset-pipeline/` + `asset:process`; background→transparency flood fill, trim, EXIF auto-orient, catalog-shaped static draft; zero new deps)
- P2-05 Custom board creator (any W×D, texture) — **done** (merged 2026-10-19, PR #21, squash `e068c35`; owner-approved **"Substrate"** direction — inline `customSize` + procedural finish `matte|brushed|wood|tolex`, edit-in-place, add/move/rotate/delete, kind-specific previews, catalog-miss shortcut; the optional `pedal-user` agent landed too)
- P2-06 Catalog procurement — **MOVED to P4-04** (pre-launch owner track; it is not a P2/P3 gate).
- P2-07 Asset CDN (R2) — deferred (ADR-002): revisit before catalog exceeds ~2k items
- P2-08 First-run empty-state guidance (hint overlay / default-open picker — "instant use, easy to learn" lesson) (R6/N2) — **done** (merged 2026-10-19, PR #22, squash `30bea5b`; owner-approved **"Bench Note"** — a small derived-empty-scene note under the desktop Add cluster / above the mobile tab bar, board-first CTA, one-tap dismiss persisted in localStorage, non-modal and clear of the canvas centre).
- P2-09 **PROPOSED (pedal-user review, 2026-10-19):** Board info readout + consistent board chrome — extend the info panel to boards (brand/name/true cm dims/finish) and give **every** board the same action bar (Delete; Edit only for custom), instead of catalog boards having no readout + Delete buried in the picker. Also candidate: **duplicate a board**. Design-affecting → designer first.
- P2-10 **PROPOSED (P2 phase gate, 2026-10-19):** Use the `350/` thumbnail renditions for picker ledger rows + the mobile info-panel sleeve (keep `800/` for the specimen plate, info banner, canvas and export). Small perf/correctness follow-up surfaced by the phase review; the reviewer recommended shipping it before P3-01. Zero new deps.

> **P2 scheduled tasks COMPLETE** (P2-01…P2-05, P2-08 merged; P2-06 moved to P4-04; P2-07 deferred; P2-09/P2-10 proposed/unscheduled).
>
> ✅ **P2 phase gate PASSED (2026-10-19)** — post-phase review on the light model (`opencode-go/deepseek-v4.1-flash`, PRs #17–#22 + docs): verdict changes-required; all findings folded into `design.md`/this file/task files + `progress.md`; one small code follow-up created (**P2-10**). No P2 regression; F3 (custom-size boards), F7 (custom pedal + info panel) and F11 (responsive picker) are satisfied. Checks green: lint / typecheck / test **366** / build / e2e **121** (+6 project-specific skips). **Next: P3-01 Export PNG** (new session; create its task file first; design-affecting). P2-10 is recommended before P3-01 — owner decides.

## P3 — Output (in progress)
- P3-01 Export **PNG + PDF** (detached offscreen Stage, scope: selected-board | all-content (everything), Standard/HD quality (32/64 px/cm), pixelRatio ≤2 + 16.7 MP/8192 px clamp, true-scale paper-light PDF, verify on iOS Safari) (S1/S2) — **in review — PR #23** (owner-approved "Print Ticket"; `src/lib/exportScene.ts` + `canvas/exportStage.ts` + `lib/pdf.ts`; 17+2 unit tests; desktop+mobile e2e; zero new deps). **A3 real-device iOS Safari is a manual owner check.** Do not start P3-02 until merged.
- P3-02 Scene save/load + multi-scene index (IndexedDB) + autosave + **boot-time index↔doc reconcile** (R6/S2)
- P3-03 Share links (versioned codec, **custom pedals travel inline**, deflate → base64url hash; read-only view + "save a copy"; note the ~200KB cap interplay) (S1/R6)
- P3-04 Undo/redo (snapshot store) + keyboard shortcuts (S5/N6 — separate task, one concern)
- P3-05 Storage-failure fallback (IndexedDB availability check + inline warning + JSON backup download) (N3 — separate task, one concern)

## P4 — Cables (expand when scheduled)
- P4-01 Cable model + jack anchors in catalog schema — **prereq:** the widened `jacks.kind` vocabulary from P2-02 (see above)
- P4-02 Drag-connect UI + direction arrows + amp/instrument endpoints. **+ pedal-user review note (2026-10-19):** show jack edges/positions as ticks on the canvas pedal (not only in the info panel) and let the overlap check use a **patch-cable gap** (right-angle vs top-mount), so "no warning" means cableable — not just non-overlapping.
- P4-03 Auto length calculation + cable list summary
- P4-04 Catalog procurement (owner-assisted, **owner track**): brand outreach log + permission tracking + dimension spot-check (S4/S6). **Start during P4** (brand replies are slow); feeds **P5-02** image clearance + the launch gate. Not a code dependency for P4-01…P4-03. *(Renumbered from P2-06.)*

## P5 — Catalog completion (pre-launch) (expand when scheduled)
> Runs **after P1–P4, before any public launch** — this is the "backfill all the rest of the pedals of all brands + clear everything" phase. The full data plan (steps, master inventory, image-rights workflow) lives in **`docs/catalog-backfill.md`**; the launch bar is ADR-003's exit criteria.
> **Now (P0-05 seed):** 207 pedals / 13 brands / 10 boards; `source: 'placeholder'`; **mocked** images; `effectTypes` for 201/207; 485 source refs (340 image links) — a representative slice, not the full catalog.
- **P5-01 Full-catalog backfill** — run `pnpm catalog:import` at full scale (all brands/models, no caps) + `catalog:seed`/`catalog:reclassify`; fill `effectTypes` (verified overrides) and specs (`power` + `jacks` after widening the jack-kind vocabulary) for every item; keep per-item `sources`.
- **P5-02 Image clearance (rights-first)** — acquire + clear real images (permission / official brand assets / community / own) and replace every mocked PNG, flipping `source`. Depends on **P4-04** outreach. **No scraping** (ADR-003).
- **P5-03 Provenance & verification sweep** — per-item verification date + confidence; dimension spot-check (≥10) against manufacturer spec sheets.
- **P5-04 Launch-gate sign-off** — minimum bar (≥200 pedals / ≥10 brands, cleared assets only), A1–A5 green, `pnpm audit`, iOS export.
- **P5-05 Full-integration device E2E (Appium, local) — PROPOSED (not scheduled).** At the very final integration stage, a small Appium smoke against the local iOS Simulator / real iPhone (XCUITest) / real Android to validate real-engine touch end-to-end. Free if Xcode/Android SDK present; deferred to avoid heavy setup now. See `docs/decisions/007-mobile-touch-testing.md` + `docs/tasks/P5-05-appium-local-device-e2e.md`.
- **P5-06 User help / how-to content — PROPOSED (not scheduled).** Short end-user help ("how layering works", cables, save/share/export) so users understand the model. Draws on **`docs/design.md` §Z-order & container rules** (the source of truth) + the other behaviour sections; pairs with P2-08 first-run guidance. Surface at the final content pass before launch.

## v2 backlog (not scheduled)
Accounts (Google OAuth) · cloud saves · community gear submissions + moderation + attribution · power-supply planner · explore/trending/famous boards · themes · locale-aware affiliate links · favorites · **tiered/riser boards (deferred from v1, S4)** · **board-to-board stacking/z-order (deferred from v1, S6)**

## Launch gate (v1 public) — ALL must pass
- [ ] Catalog contains cleared assets only — mocked seed images + `placeholder`-sourced items fully swapped (decisions/003 exit criteria: `source ∈ {licensed, brand-assets, community, own}` + min 200 pedals/10 brands + dimension spot-check + note purged)
- [ ] A1–A5 acceptance criteria green on production
- [ ] `pnpm audit` clean; all dependencies < 6 months old
- [ ] iOS Safari export verified on a real device
- [ ] **Real-device touch/interaction pass** — pinch/pan on a physical phone (automated coverage is Chromium-only; see **P5-05** proposal for local Appium E2E)