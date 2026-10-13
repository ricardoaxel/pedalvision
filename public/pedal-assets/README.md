# pedal-assets (v1 — Pages-shipped, same-origin)

Pedal/board images ship **inside this repo** and therefore inside the Cloudflare
Pages deployment (ADR-002). Same-origin, no CORS setup, no `{CDN_BASE}` env in
v1. Canvas export (`toDataURL`) works on every origin including PR previews.

## Layout

```
public/pedal-assets/
  pedals/800/<image>   # master rendition (long edge 800px)
  pedals/350/<image>   # thumbnail rendition (long edge 350px)
  boards/800/<image>
  boards/350/<image>
```

`<image>` is the catalog `image` field (e.g. `boss-tr-2.png`). Resulting URL
convention:

```
/pedal-assets/pedals/350/boss-tr-2.png
```

Build URLs with `assetUrl()` from `src/lib/cdn.ts` — never hardcode paths.

## Rules

- **Committed.** These renditions ship with the app. Raw pipeline input lives in
  `assets/` at the repo root and is gitignored.
- **Generated.** Sizes/production are produced by the asset pipeline (P2) —
  do not hand-edit.
- **Same-origin only.** Cross-origin images break canvas export.
- `placeholder.png` is the P0-04 test fixture proving the URL helper + dev
  server serve the correct path. P0-05 adds the synthetic seed catalog images
  alongside it.
- When the catalog outgrows the Pages ceiling (~2k items), these move to R2 —
  see ADR-002 and the future `P2-07` task.
