# Catalog backfill plan

Strategy + inventory for growing the committed catalog seed to the full,
cleared catalog. Referenced from `docs/roadmap.md` (Catalog data track) and
governed by ADR-003 (sourcing, rights, provenance).

## Legend

| Mark | Meaning |
| --- | --- |
| **V** | `effectTypes` from a **verified override** (`tools/catalog-transform/curated.ts`, base-model slug; variants inherit) |
| **C** | `effectTypes` from the conservative name-keyword **classifier** (`effects.ts`) — correct for descriptive names, unverified for creative ones |
| **—** | `effectTypes: []` by design (a power supply) |
| **!** | **Still needs filling** — unverified spec/effectTypes |
| **mocked** | image is a procedural placeholder (`source: 'placeholder'`) |
| **cleared** | image is a real, rights-checked asset (`source ∈ {licensed, brand-assets, community, own}`) |

> **Every item below is `mocked` today** (procedural PNGs, `source: 'placeholder'`).
> Real images are the single launch blocker and are never committed until cleared
> (ADR-003). Per-pedal image status is in the appendix; the machine-readable
> source of truth is the `source` field in `src/catalog/data/pedals.json`.

## Current state (committed seed)

**207 pedals · 13 brands · 10 boards**; `source: 'placeholder'`; mocked images;
`effectTypes` present for **200/207** (the 7 blanks are all power supplies).
**Source links:** 85 items (the verified base models) carry official
`sources: [{url, kind}]` — 221 links total (ADR-003 §Per-item sources); the rest
have none (their facts come only from the aggregate, which is never cited).

| Brand | Total | V | C | — | Images (cleared/total) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| BOSS | 41 | 4 | 36 | 1 | 0 / 41 | PSM-5 is a supply |
| Electro-Harmonix | 18 | 10 | 8 | 0 | 0 / 18 | |
| Walrus Audio | 18 | 17 | 0 | 1 | 0 / 18 | Aetos is a supply (corrected) |
| Keeley | 18 | 17 | 1 | 0 | 0 / 18 | |
| EarthQuaker | 18 | 17 | 1 | 0 | 0 / 18 | |
| JHS | 18 | 2 | 16 | 0 | 0 / 18 | |
| TC Electronic | 18 | 8 | 10 | 0 | 0 / 18 | |
| Mooer | 18 | 18 | 0 | 0 | 0 / 18 | amp-in-a-box preamps |
| MXR | 18 | 3 | 14 | 1 | 0 / 18 | CAE Power System is a supply |
| Joyo | 18 | 6 | 12 | 0 | 0 / 18 | |
| Big Joe | 2 | 0 | 0 | 2 | 0 / 2 | supplies |
| Behringer | 1 | 0 | 0 | 1 | 0 / 1 | supply |
| Effects Bakery | 1 | 0 | 0 | 1 | 0 / 1 | supply |
| **Total** | **207** | **102** | **98** | **7** | **0 / 207** | all `mocked` |

The 10 pilot brands (BOSS … Joyo) had their creatively-named pedals verified
against official sources; the 3 remaining brands (Big Joe, Behringer, Effects
Bakery) are power supplies with `effectTypes: []` by design.

## Image status & acquisition (rights-first)

**Status (today):** every one of the 207 seed items is **`mocked`**; **0 `cleared`**.

Two orthogonal fields record an item's image (schema: `src/catalog/schema.ts`):

- **`imageSource`** — *how* the image is provided: `mock` (procedural
  placeholder; the seed today), `static` (a committed file under
  `public/pedal-assets/`), or `url` (deferred same-origin/CDN path, ADR-002).
  All 207 are `mock`.
- **`source`** — *rights* provenance: `placeholder` = not cleared; `licensed` /
  `brand-assets` / `community` / `own` = cleared. So `mocked` ⇔ `source:
  placeholder`, and `cleared` ⇔ `imageSource: static|url` + a cleared `source`.

Both are mirrored per-pedal in the appendix below.

**How real images are acquired — never by scraping.** Per ADR-003, an image is
added only once its use is cleared, via (in priority order):

1. **Permission** from the catalog maintainer.
2. **Brand outreach / official brand assets** (product galleries, media/press
   kits) — *with usage terms checked*.
3. **Community submissions** (with moderation + attribution).
4. **Our own photos**, or an appropriately-**licensed** image.

The `pedal-expert` agent knows where to look (manufacturer product pages;
media/press/dealer pages such as `/press`, `/media`, `/press-materials`,
`/newsroom`) and never downloads files or returns third-party catalog images —
it returns the candidate official source + the rights metadata.

**Per-asset record** (one row per image, filled when acquired):

| Field | Meaning |
| --- | --- |
| `pedal` | catalog id |
| `original_source_url` | where the asset lives |
| `rights_holder` | manufacturer / photographer / owner |
| `license_type` | license or permission basis |
| `commercial_use_allowed` | covered for our use? |
| `modifications_allowed` | crop/resize allowed? |
| `attribution_required` | required credit + placement |
| `permission_evidence` | license URL / written approval |
| `status` | `pending` \| `approved` \| `restricted` \| `rejected` |

**Cleared-assets log** (append as items clear; empty today):

| Pedal | Source | Rights holder | Status | Cleared on |
| --- | --- | --- | --- | --- |
| _(none yet)_ | | | | |

## Missing (future backfill)

- **All models & brands beyond the 13-brand slice.** The seed is a deterministic
  top-brands slice; the full list is produced by re-running the importer with
  higher limits — see _How to run_. The source has ~8.5k models / ~250 boards
  (ADR-003); the committed seed intentionally covers a small, representative set.
- **Verified specs.** Dimensions are real (from the source); `power` and `jacks`
  are **not yet populated** in the seed. The pilot research produced them, but
  our jack model only allows `in | out | exp | power` while real pedals have
  `send`, `return`, `exp-in`, `exp-out`, `midi`, `ctrl` — **resolve the jack-kind
  vocabulary before backfilling jacks** (schema/task; ADR-003 §Data model).
- **Per-item provenance.** Today provenance is the coarse `source` tag. Planned
  enrichment: per-item source, last-verified date, and confidence
  (ADR-003 §Sourcing, rights & ingestion).
- **Cleared images.** Replace all mocked PNGs (launch gate; owner/P2-06).

## Backfill model (steps — same as the product plan)

1. **Discover** — enumerate the full catalog (importer without caps).
2. **Extract facts** — brand, model, footprint dimensions (public facts only).
3. **Normalize** — inches→cm, stable slug ids, flat duplicates→`variantOf`.
4. **Derive our content** — `deriveEffectTypes()` (verified override → classifier)
   and `deriveCategory()`; no guessing.
5. **Verify** — official manufacturer sources first; where the classifier is
   wrong for a creative name, add a **verified override**; keep `unknown` over a
   wrong value.
6. **Provenance** — record source/date/confidence per item (planned field).
7. **Clear images** — only then flip `source` and publish (launch gate).

## How to run

```sh
# Grow the seed to the full catalog (external input file is off-repo by design)
pnpm catalog:import --input <pedals.json> --boards <boards.json> \
  --brand-limit 999 --top-brand-cap 999 --per-brand-cap 999 --board-limit 999
pnpm catalog:seed        # (re)render mocked PNGs
pnpm catalog:reclassify  # re-apply taxonomy/category (no external input needed)
```

Hooks that keep this honest: a committed-data **no-drift** test (seed == fresh
`deriveEffectTypes`/`deriveCategory`), a **no-dead-curated-keys** test, and a
committed-image **byte-determinism** test.

## Repercussions addressed

- **Dedup / variants:** flat colorways are collapsed to `variantOf` links; a
  variant always inherits its base's types and is never emitted without its base.
- **Units:** cm is the storage unit; conversion is `× 2.54` at import only.
- **Provenance rule:** no source name/URL ever enters code, commits, filenames,
  or shipped assets; the audit trail lives in ADR-003 only.
- **Schema originality:** our model is not a rename of the source (ADR-003
  §Schema originality); mocked images mean no third-party asset is reused.
- **Launch gate:** the seed stays `placeholder` until images are cleared, so an
  uncleared catalog can never ship by accident.

## Appendix — per-pedal image status & sources (snapshot)

Snapshot generated from `src/catalog/data/pedals.json` (that JSON is the source of truth — regenerate this table if the seed changes). Image is `mocked` for every item today; the Sources column counts the official source links (see ADR-003 §Per-item sources).

| Brand | Model | Image | Sources |
| --- | --- | --- | --- |
| BOSS | AC-2 Acoustic Simulator | mocked | 3 |
| BOSS | AC-3 Acoustic Simulator | mocked | 3 |
| BOSS | AD-2 Acoustic Preamp | mocked | — |
| BOSS | AW-3 Dynamic Wah | mocked | — |
| BOSS | BB-1X Bass Driver | mocked | — |
| BOSS | BC-1x Bass Compressor | mocked | — |
| BOSS | BC-2 Combo Drive | mocked | — |
| BOSS | BD-2 Blues Driver | mocked | — |
| BOSS | BF-2 Flanger | mocked | — |
| BOSS | BF-2B Bass Flanger | mocked | — |
| BOSS | BF-3 Flanger | mocked | — |
| BOSS | CE-1 Chorus Ensemble | mocked | — |
| BOSS | CE-2 Chorus | mocked | — |
| BOSS | CE-20 Chorus Ensemble | mocked | — |
| BOSS | CE-2B Bass Chorus | mocked | — |
| BOSS | CE-3 Chorus | mocked | — |
| BOSS | CE-5 Chorus Ensemble | mocked | — |
| BOSS | CEB-3 Bass Chorus | mocked | — |
| BOSS | CH-1 Super Chorus | mocked | — |
| BOSS | CP-1X Compressor | mocked | — |
| BOSS | CS-2 Compression Sustainer | mocked | — |
| BOSS | CS-3 Compression Sustainer | mocked | — |
| BOSS | DA-2 Adaptive Distortion | mocked | — |
| BOSS | DC-2 Dimension C | mocked | 4 |
| BOSS | DC-3 Digital Dimension | mocked | 4 |
| BOSS | DD-2 Digital Delay | mocked | — |
| BOSS | DD-20 Giga Delay | mocked | — |
| BOSS | DD-200 Digital Delay | mocked | — |
| BOSS | DD-3 Digital Delay | mocked | — |
| BOSS | DD-3T Digital Delay | mocked | — |
| BOSS | DD-5 Digital Delay | mocked | — |
| BOSS | DD-500 Digital Delay | mocked | — |
| BOSS | DD-6 Digital Delay | mocked | — |
| BOSS | DD-7 Digital Delay | mocked | — |
| BOSS | DD-8 Digital Delay | mocked | — |
| BOSS | DF-2 Super Feedbacker & Distortion | mocked | — |
| BOSS | DM-101 Delay Machine | mocked | — |
| BOSS | DM-2 Delay | mocked | — |
| BOSS | DM-3 Delay | mocked | — |
| BOSS | DN-2 Dyna Drive | mocked | — |
| BOSS | PSM-5 Power Supply & Master Switch | mocked | — |
| Electro-Harmonix | #1 Echo | mocked | — |
| Electro-Harmonix | 1440 Stereo Looper | mocked | — |
| Electro-Harmonix | 15Watt Howitzer | mocked | 3 |
| Electro-Harmonix | 2020 Tuner | mocked | — |
| Electro-Harmonix | 2020 Tuner v2 | mocked | — |
| Electro-Harmonix | 22500 Dual Stereo Looper | mocked | — |
| Electro-Harmonix | 22500 Foot Controller | mocked | 2 |
| Electro-Harmonix | 44 Magnum Power Amp | mocked | 3 |
| Electro-Harmonix | 5mm Power Amp | mocked | 3 |
| Electro-Harmonix | 720 Stereo Looper | mocked | — |
| Electro-Harmonix | 8 Step Program | mocked | 4 |
| Electro-Harmonix | 95000 Performance Loop Laboratory | mocked | 3 |
| Electro-Harmonix | Analogizer | mocked | 2 |
| Electro-Harmonix | Attack Decay | mocked | 2 |
| Electro-Harmonix | B9 Organ Machine | mocked | 3 |
| Electro-Harmonix | Bad Stone | mocked | 2 |
| Electro-Harmonix | Bass Big Muff Pi | mocked | — |
| Electro-Harmonix | Bass Big Muff Pi 2 | mocked | — |
| Walrus Audio | 385 | mocked | 3 |
| Walrus Audio | 385 (Nat. Parks) | mocked | — |
| Walrus Audio | 385 MKII | mocked | 3 |
| Walrus Audio | 385 MKII (Black) | mocked | — |
| Walrus Audio | ARP-87 | mocked | 3 |
| Walrus Audio | ARP-87 (Kamakura) | mocked | — |
| Walrus Audio | ARP-87 (Nat. Parks) | mocked | — |
| Walrus Audio | ARP-87 (Nautical) | mocked | — |
| Walrus Audio | ARP-87 (Obsidian) | mocked | — |
| Walrus Audio | ARP-87 (Platinum) | mocked | — |
| Walrus Audio | Aetos | mocked | 3 |
| Walrus Audio | Ages | mocked | 3 |
| Walrus Audio | Ages (Kamakura) | mocked | — |
| Walrus Audio | Ages (Nat. Parks) | mocked | — |
| Walrus Audio | Badwater | mocked | 3 |
| Walrus Audio | Bellwether | mocked | 3 |
| Walrus Audio | Canvas Clock | mocked | 3 |
| Walrus Audio | Canvas Line Isolator | mocked | 2 |
| Keeley | 1962 | mocked | 3 |
| Keeley | 1962x | mocked | 3 |
| Keeley | 30ms Double Tracker | mocked | 3 |
| Keeley | Abbey Chamber Verb | mocked | 3 |
| Keeley | Angry Orange | mocked | 3 |
| Keeley | Angry Orange (Signalis) | mocked | — |
| Keeley | Angry Orange (White) | mocked | — |
| Keeley | Aria | mocked | 3 |
| Keeley | Aurora | mocked | 3 |
| Keeley | Bassist Compressor | mocked | — |
| Keeley | Black Glass | mocked | 3 |
| Keeley | Blacktop | mocked | 3 |
| Keeley | Blues Disorder | mocked | 3 |
| Keeley | Blues Disorder (Signalis) | mocked | — |
| Keeley | Blues Disorder (White) | mocked | — |
| Keeley | Bubble Tron | mocked | 3 |
| Keeley | Bubble Tron (Ler) | mocked | — |
| Keeley | California Girls | mocked | 4 |
| EarthQuaker | A/B Box | mocked | 2 |
| EarthQuaker | Acapulco Gold | mocked | 2 |
| EarthQuaker | Afterneath | mocked | 2 |
| EarthQuaker | Afterneath V3 | mocked | 2 |
| EarthQuaker | Afterneath V3 (Pastel Purple) | mocked | — |
| EarthQuaker | Afterneath V3 (Raw) | mocked | — |
| EarthQuaker | Aqueduct | mocked | 2 |
| EarthQuaker | Arpanoid | mocked | 2 |
| EarthQuaker | Arrows | mocked | 2 |
| EarthQuaker | Arrows V2 | mocked | 2 |
| EarthQuaker | Astral Destiny | mocked | 2 |
| EarthQuaker | Aurelius | mocked | 2 |
| EarthQuaker | Avalanche Run | mocked | 2 |
| EarthQuaker | Avalanche Run V2 | mocked | 2 |
| EarthQuaker | Avalanche Run V2 (Black) | mocked | — |
| EarthQuaker | Avalanche Run V2 (Mint) | mocked | — |
| EarthQuaker | Avalanche Run V2 (Purple Sparkle) | mocked | — |
| EarthQuaker | Barrows Fuzz | mocked | — |
| JHS | 1966 Series Bender | mocked | 2 |
| JHS | 1966 Series Boost | mocked | — |
| JHS | 1966 Series Fuzz | mocked | — |
| JHS | 1966 Series Italy | mocked | 2 |
| JHS | 3 Series Bit Crusher | mocked | — |
| JHS | 3 Series Chorus | mocked | — |
| JHS | 3 Series Compressor | mocked | — |
| JHS | 3 Series Delay | mocked | — |
| JHS | 3 Series Distortion | mocked | — |
| JHS | 3 Series Flanger | mocked | — |
| JHS | 3 Series Fuzz | mocked | — |
| JHS | 3 Series Glitch Delay | mocked | — |
| JHS | 3 Series Hall Reverb | mocked | — |
| JHS | 3 Series Harmonic Trem | mocked | — |
| JHS | 3 Series Octave Reverb | mocked | — |
| JHS | 3 Series Oil Can Delay | mocked | — |
| JHS | 3 Series Oil Can Delay (Black) | mocked | — |
| JHS | 3 Series Overdrive | mocked | — |
| TC Electronic | 2290 P Dynamic Digital Delay | mocked | — |
| TC Electronic | 3rd Dimension Chorus | mocked | — |
| TC Electronic | Afterglow Chorus | mocked | — |
| TC Electronic | Alter Ego v2 Vintage Echo | mocked | — |
| TC Electronic | Alter Ego x4 Vintage Echo | mocked | — |
| TC Electronic | Ampworx 550 | mocked | 4 |
| TC Electronic | Ampworx Combo Deluxe 65' | mocked | 3 |
| TC Electronic | Ampworx DC30 | mocked | 3 |
| TC Electronic | Ampworx Dual Wreck | mocked | 3 |
| TC Electronic | Ampworx Jims 45 | mocked | 3 |
| TC Electronic | Ampworx Jims 800 | mocked | 3 |
| TC Electronic | Arena Reverb | mocked | — |
| TC Electronic | Blood Moon Phaser | mocked | — |
| TC Electronic | BodyRez Acoustic Pickup Enhancer | mocked | 3 |
| TC Electronic | Bonafide Buffer | mocked | 3 |
| TC Electronic | Brainwaves Pitch Shifter | mocked | — |
| TC Electronic | Bucket Brigade Analog Delay | mocked | — |
| TC Electronic | Choka Tremolo | mocked | — |
| Mooer | 001 Gas Station | mocked | 2 |
| Mooer | 002 UK Gold 900 | mocked | 2 |
| Mooer | 003 Power Zone | mocked | 2 |
| Mooer | 004 Day Tripper | mocked | 2 |
| Mooer | 005 Brown Sound 3 | mocked | 2 |
| Mooer | 006 US Classic Deluxe | mocked | 2 |
| Mooer | 007 Regal Tone | mocked | 2 |
| Mooer | 008 Cali-MK3 | mocked | 2 |
| Mooer | 009 Black Knight | mocked | 2 |
| Mooer | 010 Two Stones | mocked | 2 |
| Mooer | 011 Cali-Dual | mocked | 2 |
| Mooer | 012 US Gold 100 | mocked | 2 |
| Mooer | 013 Matchbox | mocked | 2 |
| Mooer | 014 Taxidea Taxus | mocked | 2 |
| Mooer | 015 Brown Sound | mocked | 2 |
| Mooer | 016 Phoenix Digital | mocked | 2 |
| Mooer | 017 Cali MKIV | mocked | 2 |
| Mooer | 018 Custom 100 | mocked | 2 |
| MXR | A/B Box | mocked | 4 |
| MXR | Analog Chorus | mocked | — |
| MXR | Bass Chorus Deluxe | mocked | — |
| MXR | Bass Compressor | mocked | — |
| MXR | Bass DI+ | mocked | 4 |
| MXR | Bass Distortion | mocked | — |
| MXR | Bass Envelope Filter | mocked | — |
| MXR | Bass Fuzz Deluxe | mocked | — |
| MXR | Bass Octave Deluxe | mocked | — |
| MXR | Bass Overdrive | mocked | — |
| MXR | Bass Preamp | mocked | — |
| MXR | Bass Synth | mocked | — |
| MXR | Blue Box Fuzz | mocked | — |
| MXR | Booster Mini | mocked | — |
| MXR | CAE Boost/Line Driver | mocked | — |
| MXR | CAE Boost/Overdrive | mocked | — |
| MXR | CAE Buffer | mocked | 4 |
| MXR | CAE Power System | mocked | 4 |
| Joyo | D-Seed | mocked | 2 |
| Joyo | JF-01 Vintage Overdrive | mocked | — |
| Joyo | JF-02 Ultimate Drive | mocked | — |
| Joyo | JF-03 Crunch Distortion | mocked | — |
| Joyo | JF-04 High Gain Distortion | mocked | — |
| Joyo | JF-05 Classic Chorus | mocked | — |
| Joyo | JF-06 Vintage Phase | mocked | 2 |
| Joyo | JF-07 Classic Flanger | mocked | — |
| Joyo | JF-08 Digital Delay | mocked | — |
| Joyo | JF-09 Tremolo | mocked | — |
| Joyo | JF-10 Dynamic Compressor | mocked | — |
| Joyo | JF-11 6 Band EQ | mocked | — |
| Joyo | JF-12 Voodoo Octave | mocked | — |
| Joyo | JF-13 AC Tone | mocked | 2 |
| Joyo | JF-14 American Sound | mocked | 2 |
| Joyo | JF-15 California Sound | mocked | 2 |
| Joyo | JF-16 British Sound | mocked | 2 |
| Joyo | JF-17 Extreme Metal | mocked | — |
| Big Joe | PB-109 Power Box Li2 | mocked | — |
| Big Joe | Power Box ISO4 | mocked | — |
| Behringer | Powerplay P1 | mocked | — |
| Effects Bakery | Power Supply Hoden Sentai Donuts | mocked | — |
