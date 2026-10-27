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
4. Only when no usable image exists at all, generate our own flat pedal art
   (`docs/catalog/pedal-art.md`).
5. For boards, use the real image only as a **reference** and generate our own flat
   art (`docs/catalog/board-art.md`); never ship the reference pixels.
6. Record `imageProvenance` in the private raw catalog (kind / sourceUrl /
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
| Cream City Music | retailer product photos (`cdn11.bigcommerce.com/...`) | Authorized retailer | Meris MIDI I/O (1) | **1/1** | Use when the official photo is <800 px or angled; `--matte flood`. |
| Andertons | `https://www.andertons.co.uk/...` | Authorized retailer | Pedaltrain boards (1) | **1/1** | Board reference only; generate our own art. Search endpoints sometimes 404/403. |
| User/community listings | Reverb/eBay seller photos (record URL) | Community | any | **untested** | Allowed only with a recorded source + the same clean-alpha gate. Search endpoints often block (403/429); no bulk scraping. |
| Pedalplayground / planner | `https://www.pedalplayground.com/...` / GitHub raw | **Last resort (pedals only)** | any | **n/a** | Only when official/retailer/community has no usable image; record `kind: planner`, `status: last-resort`, `sourceUrl`, quality-gate it, count it as a gap. **Never for boards.** |

## Known gaps

- **Vintage BOSS compacts** (AC-2, DC-2/3, DD-2/5, DF-2, DM-2/3, DSD-2, CE-1/2/2B/3,
  CS-2, BF-2B) have no official flat top-down: current product pages are retired and
  the 40th-anniversary promo PNGs are only 400 px long edge (below the 800 px gate).
  They need an authorized-retailer/community image or our generated flat art; the
  **31 BOSS legacy** are the repair set and do not keep their old planner asset.
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
