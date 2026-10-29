# Behringer batch 1 — image coverage & QA report
- Items: **26** (1 existing re-hosted + 25 net-new)
- Provenance: official **24**, retailer **1**, own/generated **1**, planner **0**
- Planner share: **0%** (target <=30%)
- Single dual-tone contact sheet: `docs/catalog/contact-sheets/behringer-1-dual-tone.png`
- Vision review: **26/26 accept** (one `catalog-image-reviewer` call, deepseek-v4.1-flash)
- Analyzer: 26/26 aspect pass (all <=6.4% after shadow trim; most <3%); PSNR 42.69–57.20 dB (all >=40)

## Per-item image + QA
| id | image provenance | source dims / upscale | analyzer |
|---|---|---|---|
| `behringer-powerplay-p1` | own | Generated Catalog Specimen flat art (own). Official Behringer renders are front/rear/side only (no flat top-down) | accept pass |
| `behringer-69-vibe` | official | Official Behringer top-down render (2000x1993) | flag pass |
| `behringer-adi21-acoustic-di-box` | official | Official Behringer top-down render (1475x2000) | accept pass |
| `behringer-b-tron-iii-envelope-filter` | official | Official Behringer top-down render (2270x4230 WebP) | flag pass |
| `behringer-bdi21-bass-di-box` | official | Official Behringer top-down render (1475x2000) | accept pass |
| `behringer-beq700-bass-graphic-equalizer` | official | Official Behringer top-down render (1013x2000) | accept pass |
| `behringer-ble400-bass-limiter-enhancer` | official | Official Behringer top-down render (1065x2000) | accept pass |
| `behringer-bm-11m-low-pass-filter` | official | Official Behringer top-down render (1340x2000) | accept pass |
| `behringer-bm-12-ring-modulator` | official | Official Behringer top-down render (1336x2000) | accept pass |
| `behringer-bm-15m-resonance-filter` | official | Official Behringer top-down render (1338x2000) | accept pass |
| `behringer-bod400-bass-overdrive` | official | Official Behringer top-down render (1020x2000) | accept pass |
| `behringer-bass-brassmaster-fuzz` | official | Official Behringer top-down render (1984x2000) | flag pass |
| `behringer-cc300-chorus-space-c` | retailer | Retailer product image (Musician's Friend product gallery), white background matted with flood | accept pass |
| `behringer-cl9-compressor-limiter` | official | Official Behringer top-down render (1014x2000) | accept pass |
| `behringer-cs400-compressor-sustainer` | official | Official Behringer top-down render (1021x2000) | accept pass |
| `behringer-centaur-overdrive` | official | Official Behringer top-down render (2000x1966) | flag pass |
| `behringer-chorus-symphony` | official | Official Behringer top-down render (2000x1640) | flag pass |
| `behringer-dd600-digital-delay` | official | Official Behringer top-down render (1067x2048 WebP) | flag pass |
| `behringer-dr600-digital-reverb` | official | Official Behringer top-down render (1022x2000) | accept pass |
| `behringer-dual-phase` | official | Official Behringer top-down render (2000x1975) | flag pass |
| `behringer-eq700-graphic-equalizer` | official | Official Behringer top-down render (1009x2000) | accept pass |
| `behringer-fc600` | official | Official Behringer top-down render (732x2000) | accept pass |
| `behringer-fcv100` | official | Official Behringer top-down render (878x2000) | accept pass |
| `behringer-fd300-ultra-feedback-distortion` | official | Official Behringer top-down render (994x2000) | accept pass |
| `behringer-fs112bv-dual-footswitch` | official | Official Behringer top-down render (2000x1908) | flag pass |
| `behringer-fx600-digital-multi-fx` | official | Official Behringer top-down render (1019x2000) | accept pass |

## Source-discovery log
- Registry-first; official Behringer product pages (1404-product sitemap; 0709-* pedal pages) + official Quick Start Guides. No Google/Bing Images attempt was needed; official top-down `_Top_XL` renders were available for 24/26.
- Behringer CC300: current product page retired (404); no official image. Used the Musician's Friend product-gallery image (retailer, license-pending, counted source gap) after the official manual confirmed dimensions.
- Behringer Powerplay P1: official renders are front/rear/side only (no flat top-down). Generated Catalog Specimen art (`own`) from the official reference; counted as a generated-art item.
- No planner pixels used (0%). No marketplace hotlinks: every shipped image is self-hosted under `public/pedal-assets/`.
