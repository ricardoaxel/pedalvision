# P2-10: Use the 350 px renditions for small UI

**Phase:** P2 follow-up · **Status:** merged — PR #61 (squash `c3e0a7d`) · **Model:** build-cheap

## Goal
Make the checked-in `350/` image renditions earn their place. Today every
`resolveImageUrl(...)` call in the app requests the `800` master — including the
picker ledger rows and the mobile info-panel sleeve, which render at roughly
52–64 CSS px. A 207-row picker therefore downloads and decodes 800 px masters
for thumbnails, and the 350 renditions produced by P0-04/P2-04 are dead assets.

Split the URL into a **master** (`800`, specimen plate / info banner / canvas)
and a **thumb** (`350`, ledger rows / sleeve). For `imageSource: "url"` both are
the same absolute URL (there is no derived rendition); only mock/static assets
switch size.

## Read first (context pack)
- `docs/design.md` §Assets & catalog (the two-rendition contract + the P2 gate note)
- `docs/tasks/P2-01-picker-modal.md` (picker entry shape) and
  `docs/tasks/P2-03-pedal-info-panel.md` (mobile sleeve)
- `src/lib/cdn.ts` (`resolveImageUrl`, `assetUrl`), `src/components/Picker.tsx`
  (`PickerEntry.imageSrc`), `src/components/InfoPanel.tsx` (image URL)
- `src/lib/cdn.test.ts` (URL behaviour for mock/static/url)

## Constraints
- **cm stays the source of truth**; this is an image-delivery change only.
- **Zero new deps.**
- Do not change the canvas loader (`src/canvas/PedalNode.tsx`,
  `src/canvas/BoardNode.tsx`): they correctly use the master.
- Keep the picker specimen pane, info-panel banner, and export on the `800`
  master; only small DOM thumbnails move to `350`.
- No catalog/provenance changes; no new assets.

## Steps
1. Add a separate `thumbSrc` to `PickerEntry` (rows) while keeping `imageSrc`
   for the specimen plate. Use `resolveImageUrl(..., 350)` for mock/static and
   the recorded URL unchanged for `url`.
2. In `InfoPanel`, request `350` for the mobile sleeve/peek thumb and `800` for
   the expanded banner (or keep one `800` if the sleeve is the same element —
   then document why).
3. Unit-test the helper/URL split (`mock`/`static` → `/350/`, `url` → unchanged).
4. Playwright (desktop + mobile): rows/sleeve still render (no failed-image
   fallback) and the specimen/banner still use the master.
5. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
6. Code review: light, one source-scoped pass (not high-risk). One PR; do not merge.

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: the thumb helper returns the `350` path for mock/static entries and
  the exact URL for `url` entries; the master helper still returns `800`.
- Playwright (desktop + mobile): the ledger rows and the mobile sleeve load a
  `/350/` asset (assert via `src`/request URL) while the specimen/banner loads
  `/800/`.
- Manual/grep: no `src/` request path still uses `800` for a thumbnail; no new
  deps; no hardcoded colors.

## Notes
- Surfaced by the P2 post-phase review (2026-10-19): the 350 renditions are
  generated but never requested. The reviewer recommended shipping this before
  P3-01; it is a small, self-contained follow-up, not a P2 architectural defect.

## Workstream / boundaries (T-0b)

- Feature-safe: own `src/lib/cdn.ts`, `src/components/Picker.tsx`,
  `src/components/InfoPanel.tsx`, tests and this task file.
- Never edit catalog data/assets/runtime/tools or shared docs/config/deps.
- One PR; no merge; no total-count E2E; filter a stable item/brand.
- **Demo link:** full PR-preview URL + `?share=1#s=…` if the picker state can be shown;
  otherwise preview URL + exact steps and 1 desktop + 1 mobile screenshot.
- **Performance:** record picker request URLs and bundle delta; no 800px thumbnail
  requests for small UI.
- **Docs:** feature catalog + F-19 QA map seed in `docs/features/README.md`; the
  F-19 map is expanded by its own task. `docs/design.md` §Assets still says the
  info panel shares one URL — a coordinator-only doc edit for a later session.
