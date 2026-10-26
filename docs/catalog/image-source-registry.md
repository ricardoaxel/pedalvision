# Image source registry

A shared, append-only list of **good sources for pedal/board images**. Agents must
consult this before searching; after a batch, append any new source that produced
a usable top-down image, with its hit rate. This is discovery memory, not a licence
grant: every shipped image still needs its per-item source URL + the clean-alpha
gate.

**Pedalplayground/planner is not a shipping source.** It may only be used as a
geometric/colour reference for our own generated flat art, and only as a documented
owner-approved edge case. It is deliberately absent from the “good sources” table.

## How to use

1. Start with the brand’s **official** row (product gallery, press/support images).
2. If no flat top-down exists, try an **authorized retailer**, then a
   **user/community** image (record the URL; quality-gate it).
3. For boards, use the real image only as a **reference** and generate our own flat
   art (`docs/catalog/board-art.md`); never ship the reference pixels.
4. Record `imageProvenance` in the raw record and add a new row here if the source
   is reusable. Keep one row per domain/pattern, not per product.

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
| Cream City Music | retailer product photos (`cdn11.bigcommerce.com/...`) | Authorized retailer | Meris MIDI I/O (1) | **1/1** | Use when the official photo is <800 px or angled; `--matte flood`. |
| Andertons | `https://www.andertons.co.uk/...` | Authorized retailer | Pedaltrain boards (1) | **1/1** | Board reference only; generate our own art. Search endpoints sometimes 404/403. |
| User/community listings | Reverb/eBay seller photos (record URL) | Community | any | **untested** | Allowed only with a recorded source + the same clean-alpha gate. Search endpoints often block (403/429); no bulk scraping. |

## Known gaps

- **Vintage BOSS compacts** (AC-2, DC-2/3, DD-2/5, DF-2, DM-2/3, DSD-2, CE-1/2/2B/3,
  CS-2, BF-2B) have no official flat top-down: current product pages are retired and
  the 40th-anniversary promo PNGs are only 400 px long edge (below the 800 px gate).
  They need an authorized-retailer/user image or our generated flat art.
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
- Do not list Pedalplayground/planner as a source. Record it only in a raw item’s
  `imageProvenance` as a `pending-replacement` or owner-approved edge case.
