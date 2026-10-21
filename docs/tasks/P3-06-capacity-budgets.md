# P3-06: Capacity budgets + repeatable benchmark

**Phase:** P3 · **Status:** done (merged 2026-10-20, PR #25, squash `e9e7817`) · **Model:** build-strong

> Proposed from the owner-requested capacity research (2026-10-19) and **scheduled by the owner as the next task** after P3-02 merges. Not part of P3-02; runs before **P3-03** and **P4-01** (cables add another node/cable dimension) and before raising the 10-scene cap.

## Goal

Turn the measured v1 capacity envelope into **enforced soft/hard budgets** with honest inline states, and commit a repeatable benchmark so the interface, boot and exports cannot silently regress. Distinct **image-bearing items** (not document bytes or raw item count) are the real memory driver: 7 URL images repeated across 400 items understates a 400-distinct-image scene by ~2 orders of magnitude.

**The budgets are scene-wide totals across every placed object type** — boards, items (catalog pedals, supplies, custom pedals), cables and endpoints. Supplies and custom parts count as items; custom parts are text-only and exempt from the distinct-image count. **Cables/endpoints arrive in P4** (P4-01/P4-02) but the capacity model must include them from day one: they add Konva nodes, export draw work and share-payload bytes. One endpoint ≈ one cable node, so they share the soft/hard 150/300 graph budget. Do not validate with pedals only.

## Read first (context pack)

- `docs/design.md` → §Canvas architecture, §Persistence, §Export, **§Capacity budgets**
- `src/lib/exportScene.ts` (clamp + `ExportPlan`), `src/canvas/exportStage.ts` (`preloadImages`, `imageRequests`)
- `src/state/scene.ts` (`addItem`/`duplicateItem`), `src/canvas/PedalNode.tsx`/`Stage.tsx` (subscriptions)
- `src/state/library.ts` (`MAX_SCENES`), `docs/tasks/P3-02-scene-save-load.md` (PR #24)
- The measured table in `docs/design.md` §Capacity budgets
- `docs/design.md` §Data model (`Cable`, `Endpoint`) + `docs/roadmap.md` P4-01/P4-02 — the future object types the budget must cover

## Constraints

- **Never reject a scene on load** (A4/A5): over-cap shared/recovered scenes still hydrate (read-only or with a warning), because a limit must not lose user data.
- Soft = advisory inline warning (never a toast, N8); hard = refusal with an inline reason, following `MAX_SCENES`.
- Custom (text-only) parts are exempt from the distinct-image count; supplies count as items.
- **Cables + endpoints (P4) share the 150/300 graph budget** and must be counted by the same capacity model — no schema rewrite when P4 lands. Re-run the benchmark with P4 data before raising caps.
- No new dependency; no worker/OffscreenCanvas in v1.
- Watch the ~200 KB share payload (P3-03): a max scene must stay under it.

## Steps

1. `src/lib/capacity.ts` — export the soft/hard constants (items 200/400, distinct images 150/250, boards 8/10, **cables + endpoints 150/300 combined**, scenes 10, export 16.7 MP/8192 px) + `distinctImageCount(scene)` (catalog `imageSource` `mock`/`static`/`url`; custom parts exempt) + `sceneObjectCounts(scene)` over **every** scene array so P4 cables/endpoints are included without a rewrite.
2. Enforce hard caps on **add/duplicate** with an inline reason; soft warnings in the scene/export surfaces at the soft threshold.
3. `ExportPlan` exposes `distinctImages`; the Print Ticket warns at the soft thresholds and estimates the file size; the existing clamp and Standard/HD copy stay.
4. Commit a **report-only** benchmark (no flaky ms gates): 89 distinct catalog pedals (no repeats), plus the 50/100/200/400 and 10-board/10-scene scenarios; log distinct images, doc bytes, boot, heap, fps, export ms/bytes/spec. **Add a P4 follow-up** to extend it with cables + endpoints (same graph budget) once P4-01/P4-02 land — do not treat the pedal-only numbers as final.
5. Fold the final table + the "distinct images, not items" rule into `design.md`; keep the numbers current in `progress.md`.
6. Optional follow-ups if the benchmark shows headroom: URL-keyed image cache shared by live canvas + export; `350/` renditions (P2-10); memoized per-node selectors; viewport culling/lazy images; live DPR cap 2.

## Acceptance (executable)

- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` / `pnpm e2e` green.
- Unit tests: each hard cap refuses the right mutation; over-cap scene documents still load; distinct-image counting ignores custom parts and dedupes URLs.
- Benchmark: logs the table; a 400-item/89-distinct scene stays within the 16.7 MP export clamp and produces a valid PNG via `toBlob` (no data URL).
- Manual/real-device: export the 200-item and 400-item board on an iPhone; document the save-sheet behavior and peak memory in `progress.md`.
- The capacity counters cover all scene arrays (boards, items/supplies, custom parts, **cables, endpoints**) and the graph budget is shared by cables + endpoints; a P4 task extends the benchmark before any cap is raised.
- Docs state the soft/hard budgets and how to raise them safely.

## Notes

- The PNG download path is already Blob-first (`stage.toBlob()`), so the iOS data-URL size failure cannot recur; the remaining risk at scale is decoded-image memory and encode time, not the download.

## Implementation (2026-10-20)

- **Model:** `src/lib/capacity.ts` — `CAPACITY` soft/hard constants (items 200/400, distinct images 150/250, boards 8/10, graph 150/300, scenes 10, export soft 12 MP/15 MB), `sceneObjectCounts` over **every** scene array (boards, items incl. supplies/custom, custom definitions, cables, endpoints, graph), `distinctImageUrls`/`distinctImageCount` (URL dedupe; text-only custom parts + unknown refs exempt; boards only for export sizing), `capacityStatus`, and per-action refusals (`addItemRefusal`, `duplicateRefusal`, `boardAddRefusal`, `graphAddRefusal` for P4). Repeats of an image already in the scene stay allowed at the image cap.
- **Enforcement:** the hard caps live in `src/state/scene.ts` (`addItem`/`duplicateItem`/`addBoard`/`addCustomBoard` return `null`), so future import/paste cannot bypass them; the UI supplies the inline reason. Over-cap stored/shared scenes still hydrate (only adding is guarded).
- **UI:** owner-approved **"Load Chart"** (2026-10-20; owner asked for no capacity chrome until a budget is actually tight): Scene register line (only at soft/hard), Picker strip (hidden at ok; blocked rows + CTA), selected-item action-bar note (item cap; Duplicate refused), Export spec `Distinct images` + `File size` + subordinate `Large export` notice, 8px trigger dot at hard/over-cap. Tokens only; no new color tokens.
- **Export:** `ExportPlan.distinctImages` (item + board art in scope); estimated PNG/PDF bytes from output pixels. The existing 16.7 MP/8192 px clamp and Standard/HD copy are unchanged.
- **Benchmark:** `pnpm bench:capacity` (build + `playwright.benchmark.config.ts` + `e2e/benchmark.spec.ts`) is report-only, never part of CI e2e, and asserts only structural facts (valid PNG, clamp). It logs 89 distinct same-origin items/10 boards, 50/100/200/400-item, 400-item/89-distinct, 10-board/400-item, 10/50-scene rows with distinct images, doc bytes, boot, heap, fps, export ms/bytes/spec.
- **Measured 2026-10-20 (desktop Chromium 1440×900, all-content Standard):** 89 distinct/10 boards → 35 ms boot, 304 ms export, 0.54 MB PNG; 200 items/7 images → 417 ms, 5.16 MB; 400 items/7 images → 630 ms, 9.87 MB; 400 items/89 distinct → 630 ms, 5.39 MB; 50 scenes → 34 ms boot. Full table in `docs/design.md` §Capacity budgets.
- **P4 follow-up:** extend the benchmark with cables + endpoints and re-run it before raising the shared 150/300 graph cap (the model already counts them).
- **Review:** designer "Load Chart" owner-approved before UI; `design-reviewer` pass 1 changes-required (light-theme ink + trigger dot + notice hierarchy) → pass 2 **approve**. Code review (light model, high-risk ≤2): pass 1 changes-required (announcer count spam, soft denominator, edit-mode false refusal, test/benchmark gaps) → fixed → pass 2 **approve** (2 nits: benchmark grid fit + stale docs, both fixed). Checks: lint / typecheck / test **443** / build / e2e **164 passed + 7 skipped**; benchmark passed.

- **P4 capacity wiring (P3 phase gate, 2026-10-21):** `sceneObjectCounts` already counts optional `cables`/`endpoints`, but `CapacityAnnouncer.tsx`, `ScenePanel.tsx`, `Picker.tsx` and `ShareView.tsx` rebuild three-field literals. P4 must pass the full scene so the 150/300 graph budget actually warns, and add the benchmark rows before raising the cap. See `docs/design.md` §Persistence → **P4 extension contract**.
