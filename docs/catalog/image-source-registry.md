# Image source registry

A shared, append-only list of **good sources for pedal/board images**. Agents must
consult this before searching; after a batch, append any new source that produced
a usable top-down image, with its hit rate. This is discovery memory, not a licence
grant: every shipped image still needs its per-item source URL + the clean-alpha
gate.

**Pedalplayground/planner is a last-resort shipping source for pedals** (owner
decision 2026-10-27), after official/retailer/community and **before** generated
flat art. Record it (`kind: "planner"`, `status: "last-resort"`, `sourceUrl`),
quality-gate it, and count it as a source gap to improve. It is **never** used for
boards. Generated flat pedal art is used only when none of the above exists/passes.

The **31 BOSS legacy** items use the **same hierarchy**: official → retailer →
community → **recorded planner last-resort** → generated art only if none. They
remain `pending-replacement` until repaired; **never keep the old unrecorded
planner asset** — re-source it and record the exact URL.

## How to use

1. Start with the brand’s **official** row (product gallery, press/support images).
2. If no flat top-down exists, try an **authorized retailer**, then a
   **user/community** image (record the URL; quality-gate it).
3. If none of those passes, a **planner/Pedalplayground** image may be shipped
   **for a pedal as a recorded last-resort** (`kind: "planner"`,
   `status: "last-resort"`, `sourceUrl`); it is counted as a gap to improve.
4. **Resolution is not a rejection reason by itself.** Prefer the
   highest-resolution real source; process it to the 800/350 master (upscaling
   allowed; soft ceiling ≤2×) and gate the **final 800 rendition**, not the
   source. Record source dimensions + upscale factor. Above 2×, generate flat
   art unless the single reviewer pass accepts the upscale (recorded; still a
   source gap).
5. Only when no usable image exists/passes, generate our own flat pedal art
   (`docs/catalog/pedal-art.md`).
6. For boards, use the real image only as a **reference** and generate our own flat
   art (`docs/catalog/board-art.md`); never ship the reference pixels.
7. Record `imageProvenance` in the private raw catalog (kind / sourceUrl /
   referenceUrl / status / note) and add a new row here if the source is
   reusable. Keep one row per domain/pattern, not per product.

## Verified sources

Hit rate = usable flat top-down images / images sampled so far (not exhaustive).

| Source | URL pattern | Type | Brands / coverage | Hit rate | Notes |
| --- | --- | --- | --- | --- | --- |
| BOSS product gallery | `https://www.boss.info/us/products/<slug>/` → `https://static.roland.com/assets/images/products/gallery/<file>_top_gal.jpg` | Official | BOSS (162 current products) | **49/55 sampled (89%)** | Flat top-down, light-grey studio bg + soft shadow → `--matte flood`. Prefer `_top_gal`; `_F_gal`/`_main_gal` can also be top-down. `_angle`/`_back`/`_rear` are not. AVIF q80 PSNR 41–45 dB. |
| BOSS hi-res support images | `https://www.boss.info/us/support/product_images/` → per-product zip `https://static.roland.com/assets/media/zip/<slug>.zip` | Official | BOSS (162 current products) | **3/3 sampled top-down** | 600 dpi JPGs (`F` = front/top, `T` = top, `D`/`R` = detail/rear). Best for current models; the light-grey card/shadow needs a careful matte (flood left a card on ES-5/ES-8). |
| Meris product pages | `https://meris.us/product/<slug>/` → `https://meris.us/wp-content/uploads/.../*front*controls*.png` | Official | Meris (10) | **10/10 (9 official + 1 retailer)** | Transparent top-down control renders → `--matte none` (never re-key). |
| Red Panda store / archive | `https://cdn11.bigcommerce.com/s-5d662uh/...` (+ Wayback copies) | Official / archive | Red Panda (14) | **14/14** | Official front/top studio photos; use the top/front variant, matte the background. |
| JHS Shopify CDN | `https://cdn.shopify.com/s/files/.../JHS-...-Front.png` | Official | JHS (sampled 1) | **1/1** | Official front render; clean. |
| TC Electronic / empowertribe CDN | `https://cdn-media.empowertribe.com/.../*_Top_XL.png` | Official | TC Electronic (sampled 1) | **1/1** | Official top render. |
| Cream City Music | retailer product photos (`cdn11.bigcommerce.com/...`) | Authorized retailer | Meris MIDI I/O (1) | **1/1** | Use when the official photo is angled/unavailable or lower quality; <800 px is fine after upscale if the final cutout passes; `--matte flood`. |
| Amazon product gallery (`hiRes`) | product page → `m.media-amazon.com/images/I/..._AC_SL1500_.jpg` (extract the `"hiRes"` JSON) | Marketplace / manufacturer render | any | **1 candidate sampled (EHX 1440), 0 flat** | Treat as a **candidate locator**, not a licence: trace the identical render to the official press/support asset first. Ship marketplace pixels only when no official asset exists, as `kind: "retailer"` + `license-pending`, counted as a source gap; record the product page + resolved CDN URL; self-host, never hotlink. 1440 sample was high-angle (rejected). |
| Sweetwater | `https://media.sweetwater.com/...` product photos | Authorized retailer | EHX/MXR (2 sampled) | **2/2 product, gate each** | Product photos can be angled or shadowed; use only the flat top-down variant and gate the final 800. `--matte flood`/`soft`; record the product page. |
| Andertons | `https://www.andertons.co.uk/...` product pages | Authorized retailer | pedals + Pedaltrain boards | **1/1** | Pedal + board product pages; search endpoints sometimes 404/403. For boards use only as reference and generate our own art. |
| Guitar Sanctuary | `https://cdn11.bigcommerce.com/s-bfprvr7x1v/...` (1280×1280 WebP/PNG) | Authorized retailer | EHX 1440 sample | **1/1 found, not directly usable** | BigCommerce product images often on a **black** background with no alpha; matte carefully or trace to a white-bg/official asset. Record the product page + resolved URL. |
| Google / Bing Images | search page → open the source page (record the underlying URL, **never** the search URL) | **Discovery only** | any | **n/a** | One opportunistic attempt per batch; if 403/429/consent/captcha/empty, log `zero-yield` once and fall through. Do not bulk-scrape; do not ship search-engine thumbnails. |
| User/community listings | Reverb/eBay seller photos (record URL) | Community | any | **untested** | Allowed only with a recorded source + the same clean-alpha gate. Search endpoints often block (403/429); no bulk scraping. |
| Pedalplayground / planner | `https://www.pedalplayground.com/...` / GitHub raw | **Last resort (pedals only)** | any | **n/a** | Only when official/retailer/community has no usable image; record `kind: planner`, `status: last-resort`, `sourceUrl`, quality-gate it, count it as a gap. **Never for boards.** |

## Discovery protocol (T-4b)

1. **Registry first** — reuse a known-good source before searching.
2. **Official** brand product/manual/press/support (`_top`, `_front`, transparent
   PNG, support zips).
3. **One opportunistic Google/Bing Images attempt per batch** (not per item).
   Open the source page; record the underlying image URL, never the search URL.
   A 403/429/consent/captcha/empty is `zero-yield` once — no retry, no engine swap.
4. **Amazon/Andertons/Sweetwater/Thomann/Guitar Sanctuary/Mercado Libre/Reverb**
   product pages. Extract image URLs with a deterministic helper (curl + regex),
   not by dumping HTML into context. Bounds: ≤2 search pages + ≤20 source-page
   fetches per batch (≤3 per item).
5. **Marketplace pixels** are `kind: "retailer"` + `license-pending` + counted
   as a source gap; record product page + resolved CDN URL; self-host.
6. **Planner last resort**; count it. Target ≤30% planner per batch; if >50%
   after one documented discovery round, record the share + waiver line for the
   owner.
7. **One dual-tone contact sheet** (split white/dark or checkerboard) for the
   halo/fringe gate; one vision pass. High resolution is not flatness — reject a
   high-res angled image.

## Deep source audit (2026-10-28, EHX/MXR)

Added after a multi-source research pass (official assets, music retailers, marketplaces, image search). Re-test each source on the specific item; the source list is not a guarantee of flatness.

| Source | URL pattern / access | Type | Flatness / background (sampled) | Resolution | Feasibility |
| --- | --- | --- | --- | --- | --- |
| **MXR / Jim Dunlop official gallery** | product page → `cdn11.bigcommerce.com/s-n26aknlnlm/images/stencil/{original,1280x1280}/<pid>/<iid>/<sku>.{MAIN,LEFT,RGHT,TOPP,BOTT,BACK}__<h>.<ts>.jpg` | Official | **`MAIN` = near-top-down face, white bg + soft shadow (5/5 sampled)**; `TOPP` is a front-edge view, not top-down; LEFT/RGHT/BACK are side/rear evidence | **1400×1400** (`original`) | Open CDN, no challenge; page robots disallows many AI/bulk UAs (crawl-delay 10) |
| **EHX official galleries** | product page → `ehx.com/wp-content/uploads/YYYY/MM/<slug>_Front.jpg` (NYC DSP 5-view set) or `<slug>-0.jpg` (2024–26 set); legacy `-1…-4`, `-f`, `-h`, `-v` | Official | `_Front` and `-0` = flat face, white bg; `-1` = 3/4 hero (reject for footprint); `-2/-3/-4` = rear/sides (jack evidence); `-f/-h/-v` = lifestyle (reject) | 1000×1000 (some 2048) | Open, Cloudflare but plain GET 200 |
| **EHX WordPress media API** | `ehx.com/wp-json/wp/v2/media?search=<token>&per_page=60&_fields=source_url` | Official inventory | Enumerates every asset for a product; use as a pre-flight “does a flat asset exist?” check | — | 200; some queries 500 (retry/shorten) |
| **EHX press library** | `ehx.com/product-images/` → Dropbox `Product Images.zip` | Official press | 3.58 GB zip, unlisted; contents unverified; one owner download could index hi-res art | — | Page yes; listing needs JS; no Range |
| **Russo Music (Shopify)** | `russomusic.com/products.json?limit=250`, `/search/suggest.json`; images `cdn.shopify.com/s/files/1/1210/3886/...` | Retailer | White-bg manufacturer images; near-top-down (sample 1440/2020/M169/M234); some opaque white PNGs (no alpha) | **2000×2000** | Open JSON/CDN |
| **Chicago Music Exchange (Shopify)** | `chicagomusicexchange.com/products.json?limit=250&page=N`, `/search/suggest.json`; `cdn.shopify.com/s/files/1/0343/4368/2183/...` | Retailer | New stock = manufacturer top-down/white; used = 3/4/wood (reject); Bad Stone sample 1600² orthographic | 500–2000×2000 | Open; use limit=250 |
| **Musician's Friend** | `media.musiciansfriend.com/is/image/MMGS7/<slug>/<sku>-00-2000x2000.jpg` | Retailer | M234 = flat top-down; M169 = 3/4; white bg | 2000×2000 | HTML 200; image server open (`fmt=png-alpha` gives no alpha) |
| **Andertons** | `cdn11.bigcommerce.com/s-4hc0jwsnnq/images/stencil/{original,1280x1280}/<pid>/<iid>/<name>.jpg`; sitemap `xmlsitemap.php?type=products&page=N` | Retailer | Some flat/top-down; some 3/4; named `-Top-1` variants for some; background white | 400–2500 (varies) | Search JS-rendered; sitemap works; some 404 |
| **Guitar Village (WooCommerce)** | `guitarvillage.co.uk/wp-json/wc/store/v1/products?search=<q>&per_page=50`; `wp-content/uploads/...` | Retailer | Top-down slight perspective, white | 1080×1080 | Open; MXR only |
| **ProAudioStar (Magento)** | `proaudiostar.com/pub/media/catalog/product/cache/<hash>/<x>/<y>/<hash>_<name>.jpg`; sitemap | Retailer | Slight-perspective top-down, light grey, faint shadow; Bad Stone 1215×984 | ~1215×984 | Open; hashed filenames |
| **Guitar Sanctuary** | `cdn11.bigcommerce.com/s-bfprvr7x1v/...` | Retailer | Top-down but **opaque black bg** (alpha channel present, min α=255) | 386×386 | Open; low-res |
| **Pedal Empire (Shopify)** | `pedalempire.com.au/products.json` | Retailer | Genuine transparent PNG/WebP but **angled** and low-res | 400–640 | Open; poor |
| **Pedalbro** | `https://pedalbro.com/search?q=<query>` → `/pedals/<slug>`; images `assets.pedalbro.com/cdn-cgi/image/width=800/...` | Aggregator | Exact search worked for EHX 1440/Bass Clone/Bad Stone, MXR Carbon Copy; ~500 px white JPEG; specs/power on page | ~500 px | HTTP 200; robots disallows `/search`/`/api` (product pages/sitemap accessible) |
| **PedalFinder** | `https://guitarpedalfinder.com/pedal-database?search=<query>` → `/pedals/<slug>`; images on Supabase `pedal-images/...webp` | Aggregator | 25k coverage; exact 1440/Bass Clone/Bad Stone/Carbon Copy; image ~375 px white WebP | ~375 px | JS-rendered; works in a real browser, not simple HTTP |
| **Pedalfilter** | `https://pedalfilter.com/` search UI → `/brand/model`; images `images.pedalfilter.com/<slug>.png` | Aggregator | 7.8k; search works but fuzzy (Carbon Copy → Deluxe); transparent PNG ~350 px; specs/description and Amazon/Reverb links | ~350 px | UI search works in browser; robots disallows `/api/`/`/data/` |
| **All The Pedals** | `https://allthepedals.com/search/` or `sitemap.xml` → `/pedals/<slug>`; images `assets/pedals/<slug>.webp` | Aggregator | 14k; **800 px transparent WebP** when present (Carbon Copy verified clean/flat); search is fuzzy and some image URLs 404 — use sitemap/direct product URL | **800 px** | HTTP 200; search needs UI; sitemap reliable |
| **Effects Database** | effectsdatabase.com | Aggregator | Blocked (403) from this network; retry later or use browser | — | blocked |
| **PedalMap / Equipboard / PedalDatabase** | pedalmap.app / equipboard.com / pedaldatabase.com | Planner/community | No usable catalog search: PedalMap is a planner; Equipboard needs login/JS; PedalDatabase cert invalid | — | skip |

| **Amazon (US/MX)** | product page → `m.media-amazon.com/images/I/<id>._AC_SL1500_.jpg`; bare `<id>.jpg` for larger | Marketplace | 1440/Carbon Copy main = flat-ish on white (owner-approved reference); not guaranteed; some high-angle | 1500–2500 | Open CDN; pages may block |
| **Walmart** | `i5.walmartimages.com/seo/<slug>_<uuid>.<hash>.jpeg` | Marketplace | 1440 = flat top-down, near-white; limited pedal coverage | 1150×1280 (server upscale) | CDN 200; pages 307 blocked |
| **Mercado Libre** | `http2.mlstatic.com/D_NQ_NP_<id>-<site><n>_<date>-O.webp` | Marketplace | 1440 = flat top-down, near-white; often ~500 px; pages/API blocked | 441×500 sample | CDN 200; pages account-verification |
| **Reverb** | signed `rvb-img.reverb.com/.../quality=medium-high,height=1600,width=1600,fit=contain/<id>.jpg` | Community/marketplace | Mostly used-gear 3/4/scene; high coverage; signed URLs | up to 1600 | CDN 200; pages/API 403 |
| **eBay** | `i.ebayimg.com/images/g/<hash>/s-l1600.jpg` | Community/marketplace | Mostly seller 3/4/scene; some near-top-down | 1500–1600 | CDN 200; listing/search pages 403 |
| **Google Images** | `google.com/search?tbm=isch&q=...` | Discovery only | Blocked with “unusual traffic”/captcha from this network | — | Not usable without a browser/session |
| **Bing Images** | `bing.com/images/search?q=...` in a real browser | Discovery only | Works in Playwright (~120 results); `a.iusc` `m` JSON has `murl`/`purl`; curl fallback is unreliable | — | Browser/pacing only |
| **DuckDuckGo Images** | `duckduckgo.com/i.js?...&vqd=...` | Discovery only | Worked for ~5 queries, then returns a bot challenge; no reliable stable access | — | Rate-limited |

**Blocked / unusable for now:** Sweetwater (403), Thomann (429), Guitar Center (403), zZounds (403), Gear4music (403), GuitarGear.com.mx (Cloudflare 403), Rich Tone (connection failure), Promenade (Store API disabled), Wayback (temporarily offline).

**Revised discovery order:** MXR official `MAIN` → EHX official `_Front`/`-0` → **aggregators (Pedalbro / PedalFinder / Pedalfilter / All The Pedals)** → Russo Music / Chicago Music Exchange / Musician's Friend / Andertons / Guitar Village (JSON/CDN) → Amazon/Walmart/Mercado Libre (marketplace candidates) → Reverb/eBay (community/coverage) → Bing Images (discovery only) → planner last resort → generated last.

**Key conclusion:** MXR has a strong official flat-ish source (`MAIN` 1400); EHX official flat art exists for only ~36/266 products. For EHX 1440, Bad Stone and 2020 Tuner v1 the official galleries have no flat face view; use Russo/CME/retailer or planner. Marketplace images are candidates, not guaranteed flat; always gate the final 800 on the flatness/clean-alpha/dual-tone sheet and record the source page.

## Known gaps

- **Vintage BOSS compacts** (AC-2, DC-2/3, DD-2/5, DF-2, DM-2/3, DSD-2, CE-1/2/2B/3,
  CS-2, BF-2B) have no official flat top-down: current product pages are retired and
  the 40th-anniversary promo PNGs are only 400 px long edge. That is **not** a
  rejection by itself: prefer a higher-resolution retailer/community/planner
  cutout; the 400 px promo can still be upscaled (2× soft ceiling) if the final
  800 cutout passes. The **31 BOSS legacy** are the repair set and do not keep
  their old planner asset.
- **Some current units** (EV-30, EV-5, EV-1-WL, FS-5L/U, FV-100, FZ-2/3, DSD-3, EH-2,
  FT-2, DS-1WH, DS-1-4A, FV-500) are not in the support-image list or only have 3/4
  art; same fallback.
- **Analyzer false positive:** a symmetric trapezoid enclosure (BOSS compact) scores
  32–41% on the row-width perspective metric even when flat. The analyzer now detects
  a flat top edge + no skew as a **shape taper** and does not reject; use aspect
  (≤3% is strong evidence) + the contact-sheet reviewer. Never re-source to planner
  because of the perspective score alone.

## Maintenance

- Append new sources here after a batch; keep the table to reusable patterns.
- The coordinator owns this file; do not edit it from parallel batch sessions.
- Pedalplayground/planner is listed only as a **last-resort** source (pedals); record
  it in the raw item's `imageProvenance` (`status: "last-resort"`, `sourceUrl`) and
  count it as a gap. Never use it for boards. Check `catalog:license-report` for the
  current planner/legacy/mock totals.
