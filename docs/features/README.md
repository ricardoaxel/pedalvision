# Feature catalog & QA impact map

> Seed for **F-19** (the full feature/E2E impact map). Every feature PR adds or
> updates its row here and names the E2E it ran. Internal source of truth for
> “what the feature is” + “what it can break”; the public tutorial/catalog will
> live in the F-41 docs hub.

## Feature catalog

### F-01 — Two-rendition image delivery (P2-10)

Small UI now uses the **350 px** rendition instead of the 800 px master:

- **Picker ledger rows** — `PickerEntry.thumbSrc` (`resolveThumbImageUrl`).
- **Mobile info-panel sleeve** — the 64 px peek (`ASSET_RENDITIONS.infoSleeve`).

Large surfaces stay on the **800 px** master: the picker specimen plate, the
info-panel banner/desktop plate, the canvas and export. `imageSource: "url"`
entries keep their recorded absolute URL at both sizes (there is no derived
rendition).

User-visible effect: faster, lighter search results and a lighter mobile peek;
full-detail imagery is unchanged where detail matters. No layout or visual
direction change.

### F-02 — Read-only jack ticks + cable-aware export bounds (P4-05)

Closes the two P4 phase-gate gaps without changing cable geometry, the 150/300
graph cap, the share payload/version or the "Patch Drafting" direction.

- **Read-only jack ticks.** A shared preview now renders the socket ticks
  whenever the graph is visible **or** the canvas is read-only
  (`showCables || readOnly`). Recipients see real ring+dot sockets (hollow
  diamonds for fallback/approximate jacks) even when their own "Show patch"
  preference is off. The outward-biased hit discs stay non-mutating: a press on
  a socket is a read-only attempt, so the existing "shared copy" cue appears and
  nothing changes. Selection, the info sheet and pan/zoom behave exactly as
  before.
- **Cable-aware export bounds.** The selected-board plan unions the **actual
  cubic curve** (exact Bézier extrema + endpoints + arrowhead) for every
  in-scope cable into its content rect, using the same anchors/handles as the
  export renderer. A long outward handle can no longer bulge past the 4 cm
  padding and get clipped. The all-content path includes the same curve union.
  The 4 cm padding and the 16.7 MP / 8192 px clamps are unchanged; cable
  geometry, share payload/version and the graph cap are untouched.

## QA impact map

| Feature | Source modules | Affected workflows | Minimum E2E |
|---|---|---|---|
| F-01 / P2-10 two-rendition delivery | `src/lib/cdn.ts` (`ASSET_RENDITIONS`, `resolveThumbImageUrl`, `resolveMasterImageUrl`), `src/components/Picker.tsx`, `src/components/InfoPanel.tsx` | picker search/browse, place pedal/board, mobile info peek + expand, canvas image, export | `e2e/info-panel.spec.ts` (desktop + mobile), `e2e/picker-choka.spec.ts` (350 row / 800 specimen), `e2e/export.spec.ts` when export changes |
| Catalog rendition pipeline (P5-03) | `tools/asset-pipeline/**` (catalog-owned) | any surface that loads an image | `e2e/picker-choka.spec.ts` |
| F-02 / P4-05 read-only jack ticks + cable-aware export bounds | `src/canvas/PedalNode.tsx`, `src/lib/exportScene.ts`, `src/lib/cablePath.ts` | shared read-only preview (ticks + cue), pan/zoom/selection in share, selected-board and all-content PNG/PDF export, normal editor canvas | `e2e/cables.spec.ts` (read-only tick press + cue, desktop + mobile), `e2e/export.spec.ts` (scope/clamp), `src/lib/exportScene.test.ts` (long outward cable bounds) |

### P4-05 verification notes

- Unit: `exportScene.test.ts` covers a 15.75 cm outward handle that extends the
  selected-board content top to −9.81 cm (board top is 0) and the same curve on
  the all-content path.
- E2E: the read-only test loads a share with the recipient's patch preference
  hidden, presses **10 screen px outside** a socket (inside the tick hit disc,
  outside the pedal) and asserts the item's read-only cue; 30 px outside the
  socket stays empty canvas, proving the tick disc is what caught the press.
- Performance (2026-10-27): bundle **+0.59 kB gzip** (295.12 → 295.71 kB);
  read-only canvas frame time p50/p95 **16.70 ms** (60 fps) unchanged vs main;
  a 60-cable selected-board export plan resolves in **0.18 ms** vs **0.06 ms**
  on main (one-off export action, +0.12 ms).

### P2-10 verification notes

- `pnpm test` covers the URL split for mock/static (`800` master, `350` thumb)
  and `url` (unchanged at both sizes).
- Playwright desktop: the Choka ledger row asserts `/350/` and the specimen
  asserts `/800/`; `info-panel.spec.ts` asserts the banner is `/800/`.
- Playwright mobile: the Choka ledger row asserts `/350/`; the info-panel sleeve
  asserts `/350/` and the expanded banner asserts `/800/`.
