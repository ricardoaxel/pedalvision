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
`assetUrl()` does **not** URL-encode its `file` argument: the contract is that
the catalog `image` field is lowercase/hyphenated/ASCII (enforced by P0-05's
catalog schema — see ADR-003). Today nothing untrusted reaches it. If a
user-supplied filename ever reaches it, encode it first.

## Rules

- **Committed.** These renditions ship with the app. Raw pipeline input lives in
  `assets/` at the repo root and is gitignored.
- **Generated.** The committed images are the **synthetic seed** (P0-05), drawn
  as procedural shapes by `tools/catalog-transform` (`pnpm catalog:seed`) — do
  not hand-edit. Real images will be produced by the asset pipeline (P2-04).
- **Same-origin only.** Cross-origin images break canvas export.
- The synthetic seed is license-clean (fictional brands, no third-party images)
  and is what fresh clones + CI run against. It is swapped for the cleared
  catalog before public launch (ADR-003).
- When the catalog outgrows the Pages ceiling (~2k items), these move to R2 —
  see ADR-002 and the future `P2-07` task.
