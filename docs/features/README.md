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

## QA impact map

| Feature | Source modules | Affected workflows | Minimum E2E |
|---|---|---|---|
| F-01 / P2-10 two-rendition delivery | `src/lib/cdn.ts` (`ASSET_RENDITIONS`, `resolveThumbImageUrl`, `resolveMasterImageUrl`), `src/components/Picker.tsx`, `src/components/InfoPanel.tsx` | picker search/browse, place pedal/board, mobile info peek + expand, canvas image, export | `e2e/picker.spec.ts`, `e2e/info-panel.spec.ts` (desktop + mobile), `e2e/picker-choka.spec.ts` (350 row / 800 specimen), `e2e/export.spec.ts` when export changes |
| Catalog rendition pipeline (P5-03) | `tools/asset-pipeline/**` (catalog-owned) | any surface that loads an image | `e2e/picker-choka.spec.ts` |

### P2-10 verification notes

- `pnpm test` covers the URL split for mock/static (`800` master, `350` thumb)
  and `url` (unchanged at both sizes).
- Playwright desktop: the Choka ledger row asserts `/350/` and the specimen
  asserts `/800/`; `info-panel.spec.ts` asserts the banner is `/800/`.
- Playwright mobile: the Choka ledger row asserts `/350/`; the info-panel sleeve
  asserts `/350/` and the expanded banner asserts `/800/`.
