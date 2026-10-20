# P3-06: Capacity budgets + repeatable benchmark

**Phase:** P3 · **Status:** todo — scheduled next, after P3-02 (PR #24) merges · **Model:** build-strong

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

- Measured 2026-10-19 (Chromium desktop, 7 repeated BOSS images): 200 items → 14.6 MB PNG in 629 ms; 400 items → 24.2 MB in 967 ms; 10 boards/400 items → 4.5 MB; 50 scenes boot 90 ms. These are **best-case image reuse** numbers.
- The PNG download path is already Blob-first (`stage.toBlob()`), so the iOS data-URL size failure cannot recur; the remaining risk at scale is decoded-image memory and encode time, not the download.
