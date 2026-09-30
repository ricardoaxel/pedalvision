# ADR-002: Hosting & asset serving — Cloudflare Pages (R2 deferred)

**Status:** Accepted (2026-09-22)

## Context
Static SPA (no v1 backend) + transparent PNGs (two renditions each) + JSON catalog. Needs: cheap/free at low scale, unlimited-ish bandwidth, custom domain, HTTPS, PR previews, commercial use allowed, CI/CD via GitHub Actions. Owner preference (2026-09-22): solid architecture that starts with **minimal dependencies** and doesn't overcomplicate v1.

## Decision (v1 = Pages-shipped images; R2 deferred)
- **App + images:** Cloudflare Pages (free: unlimited static bandwidth, commercial use allowed, PR previews). **Images ship inside the Pages deployment** (`public/pedal-assets/`) — same-origin, so canvas export works with zero CORS setup (ADR-001 risk 3 is moot).
- **Deploys:** GitHub Actions + `cloudflare/wrangler-action` (Direct Upload → PR preview URLs, main → production)
- **Images:** pre-resized at pipeline time (sharp → 800px + 350px). No paid runtime image service (Cloudflare Images charges per transformation — avoided).
- **R2 deferred (B1):** move to R2 + custom domain + Cache when the catalog outgrows the Pages file ceiling or images need updating without a redeploy. Pages free limit: **20,000 files / 25 MiB per file** (N3). V1's min-content gate (~420 files) is far below; the full ~8.5k-item corpus at 2 renditions ≈ 17k files still fits, but a bigger corpus or image-only deploys justify R2. Revisit this ADR before exceeding ~2k items.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Vercel Hobby | 100GB/mo bandwidth cap; **commercial use forbidden** (even donation links); deployment retention limits |
| Netlify Free | Credit system ≈ ~15GB/mo effective bandwidth; sites pause at cap |
| GitHub Pages | 1GB site-size limit — cannot host the PNG corpus |
| Bunny CDN | Great paid escape hatch (~$1–2/mo at 100GB) but no free tier |

## Consequences
- v1 images are **same-origin with the app** → no CORS config needed; export (`toDataURL`) is safe on every origin including `*.pages.dev` previews (B4 is void in v1; if R2 is adopted later, serve `Access-Control-Allow-Origin: *`, not a hardcoded allowlist).
- Assets live in the repo under `public/pedal-assets/`; deploys include them. `pnpm assets:sync` becomes an R2-era tool — not needed in v1.
- When R2 is adopted: bucket private, uploads only via CI/owner script, egress always free.
- If Cloudflare ever becomes a problem: Bunny is the documented fallback (no re-architecture needed).