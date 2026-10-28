# Image licensing & permission requests

Internal working file for the owner. Catalog images are self-hosted and used for
product identification / true-scale planning only. Pedalvision is independent and
does not imply endorsement; removal requests are honoured (see `public/attribution.html`).

Contact: **Pedalvision** · ricardoaxelgd@gmail.com · https://pedalvision.pages.dev

## Status meanings

- **own** — our generated flat art / mock art (no third-party image licence needed).
- **licensed** — written permission recorded (`licenseRef`).
- **license-pending** — official/retailer/community/archive or planner **last-resort** image in use while permission is requested.
- **replacement-needed** — legacy asset, or planner pending a better source; replace it.
- **none** — no image asset yet.

Source priority: official → authorized retailer → user/community (recorded) → planner **last-resort** → generated flat art only if none exists. Per-item source URLs are recorded in the private raw catalog/ledger, never on the public page.

Sources: archive 4 · community 1 · official 237 · own 89 · planner 58

Needs improvement: 233 (hotlinked 91 · mock 84 · planner 58; see the source-gap table in [asset-ledger.md](./asset-ledger.md)).

## Brands with official images

| Brand | Request | Official | Replace | Own | Contact | Press email | Terms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Behringer | not-requested | 1 | 0 | 0 | [contact](https://www.behringer.com/support) | — | — |
| BOSS | not-requested | 124 | 0 | 1 | [contact](https://www.boss.info/us/support/) | Rebecca.Genel@roland.com | [terms](https://www.boss.info/us/terms_of_use) |
| Electro-Harmonix | not-requested | 18 | 0 | 0 | [contact](https://www.ehx.com/support/) | — | — |
| JHS | not-requested | 13 | 0 | 6 | [contact](https://www.jhspedals.info/pages/contact) | — | — |
| Joyo | not-requested | 5 | 0 | 13 | [contact](https://www.joyoaudio.com/about.html) | info@joyoaudio.com | — |
| Meris | not-requested | 10 | 0 | 0 | [contact](https://meris.us/contact/) | — | — |
| Mooer | not-requested | 17 | 0 | 1 | [contact](https://www.mooeraudio.com/CONTACT.html) | support@mooeraudio.com | — |
| MXR | not-requested | 18 | 0 | 0 | [contact](https://www.jimdunlop.com/contact-us/) | — | — |
| Pedaltrain | not-requested | 0 | 0 | 4 | [contact](https://help.pedaltrain.com/hc/en-us/requests/new) | help@pedaltrain.com | — |
| Red Panda | not-requested | 10 | 0 | 0 | [contact](https://www.redpandalab.com/contact) | — | — |
| TC Electronic | not-requested | 14 | 0 | 4 | [contact](https://www.tcelectronic.com/support) | — | — |
| Temple Audio | not-requested | 0 | 0 | 1 | [contact](https://www.templeaudio.com/contact) | — | — |
| Walrus Audio | not-requested | 7 | 0 | 11 | [contact](https://www.walrusaudio.com/pages/contact) | — | — |

## Request log

| Brand | Status | Last requested | Response | License ref |
| --- | --- | --- | --- | --- |
| Behringer | not-requested | — | — | — |
| BOSS | not-requested | — | — | — |
| Electro-Harmonix | not-requested | — | — | — |
| JHS | not-requested | — | — | — |
| Joyo | not-requested | — | — | — |
| Meris | not-requested | — | — | — |
| Mooer | not-requested | — | — | — |
| MXR | not-requested | — | — | — |
| Pedaltrain | not-requested | — | — | — |
| Red Panda | not-requested | — | — | — |
| TC Electronic | not-requested | — | — | — |
| Temple Audio | not-requested | — | — | — |
| Walrus Audio | not-requested | — | — | — |

Per-item list: [asset-ledger.md](./asset-ledger.md).

## Official image sources

- **Behringer** — https://www.behringer.com/ — Music Tribe brand. 1 hotlinked legacy seed image.
- **BOSS** — https://www.boss.info/us/products/<slug>/ (gallery) + https://www.boss.info/us/support/product_images/ — Press/media contact from BOSS/Roland press releases. Official top-down gallery + hi-res support zips.
- **Electro-Harmonix** — https://www.ehx.com/products/<slug>/ — Legacy seed images are hotlinked from official EHX product pages; replace with self-hosted assets in the EHX batch.
- **JHS** — https://www.jhspedals.info/ — 1 self-hosted official image + hotlinked legacy seed images; replace in the JHS batches.
- **Joyo** — https://www.joyoaudio.com/ — Mix of hotlinked official and mock seed images; replace in the Joyo batch.
- **Meris** — https://meris.us/product/<slug>/ (official top-down control renders) — 10 self-hosted official top-down renders; 1 authorized-retailer image.
- **Mooer** — https://www.mooeraudio.com/ — Legacy seed images are hotlinked; replace in the Mooer batch.
- **MXR** — https://www.jimdunlop.com/ (MXR product pages) — MXR is a Dunlop brand. Legacy seed images are hotlinked; replace in the MXR batch.
- **Pedaltrain** — https://pedaltrain.com/ (reference for dimensions/layout/color) — Board art is our own generated flat art; official photos are reference only (no pixels shipped).
- **Red Panda** — https://www.redpandalab.com/ (official store/archived images) — 14 self-hosted official/archived store images.
- **TC Electronic** — https://www.tcelectronic.com/ — Music Tribe brand. Legacy seed images are hotlinked; replace in the TC batch.
- **Temple Audio** — https://www.templeaudio.com/ (reference for dimensions/layout/color) — Board art is our own generated flat art; official/retailer photos are reference only (no pixels shipped).
- **Walrus Audio** — https://www.walrusaudio.com/ — Mix of hotlinked official and mock seed images; replace in the Walrus batch.

## Permission email template

```text
Subject: Permission request — Pedalvision catalog images ({BRAND})

Hello {BRAND} team,

I run Pedalvision (https://pedalvision.pages.dev), an independent pedalboard planner.
We show product images only to help users identify gear and plan a board at true scale.
The images are self-hosted, used for identification only, and we do not copy descriptions.
The catalog is independent: it is not affiliated with or endorsed by {BRAND}.
We credit sources and honour removal requests. We would like your written permission
to use the official product images for these catalog items, or your preferred terms/credit.

Items: {ITEM LIST / LINK}

Kind regards,
Pedalvision
ricardoaxelgd@gmail.com
```

Update `data/catalog/image-licenses.json` after sending/response, then run
`pnpm catalog:asset-ledger` to refresh the ledger and this file.

## Mock-only brands (no official image yet)

These brands currently use our own mock art; no image permission is needed until a real batch.

- Aclam (1)
- Big Joe (2)
- Blackbird (1)
- BoardMods (1)
- Caseman (1)
- Creation Music Co (1)
- Donner (1)
- D’Addario (1)
- EarthQuaker (18)
- Effects Bakery (1)
- Emerson Custom (1)
- Fame (1)
- Keeley (18)

