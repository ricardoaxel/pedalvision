# Catalog backfill plan (P5)

Plan for turning the committed 207-item seed into the real, quality-gated
catalog. Governed by **ADR-003**; roadmap tasks **P5-01…P5-05**.
Owner decisions: **2026-10-21** (self-hosted public assets + 2,000-pedal cap).

## Goals

- Ship a clean catalog with **real facts + hosted, quality-gated images**.
- Cover **Tier A** (top ~20 pedal brands + top board brands, **~1,850 pedals +
  150 boards = ~2,000 catalog items**) as the launch **target**; the long tail
  continues after launch.
- **Absolute minimum launch bar:** ≥200 pedals / ≥10 brands / ≥10 boards. Below
  the Tier A target, launch requires explicit owner acceptance.
- **Pedalboards are first-class**, not an afterthought: the first research wave
  includes the most popular boards alongside the most popular pedals.
- Keep **cm** as the only stored unit; inches are converted at import.
- Make data work **parallel with feature work** without merge conflicts.
- Make every agent run **observable and stoppable**.
- Hit the **Tier A target** (~1,850 pedals + 150 boards); the **2,000 hosted-pedal cap** is a safety limit. Exceeding Tier A requires the P5-05 hosting decision.

## Current state

- Seed: **207 pedals / 13 brands / 10 boards**; `effectTypes` for 201/207
  (the 6 blanks are supplies). The board seed is a tiny slice.
- **0 jacks, 0 power**; images: 129 hotlinked `url` + 78 `mock`; **0 hosted**.
- Verified base models carry **485 source refs** (340 `image` links).
- Discovery lists: **8,557 pedals / 779 brands** and **263 boards / 38 brands**
  (`Brand`, `Name`, `Width`, `Height`, `Image`; **inches**) + other sources the
  `pedal-expert` agent uses.

**Keep the 207 seed.** Run it through the quality gate and keep/repair/replace
per item; do not wipe. Freeze a `legacy` snapshot for rollback.

### P5-01 results (2026-10-21 — PR #35)

- **Raw archive defined:** `data/catalog/research/{pedals,boards}/<brand>/<batch>.json`
  (schema `src/catalog/rawSchema.ts`; contract
  `docs/catalog/raw-research-record.md`). The **H90** stress fixture
  (`data/catalog/fixtures/eventide-h90.json`) maps 14 connectors without
  inventing positions.
- **Master inventory:** `data/catalog/inventory.json` — 8,557 pedals / 779
  brands → **8,549 unique** (8 duplicates removed, 338 conservative colorway
  links, 143 orphan variants kept standalone); 263 boards / 38 brands → **263
  unique**. **Tier A = 1,850 pedals + exactly 150 boards**; Tier B = 1,673
  pedals / 108 boards; Tier C = 5,026 pedals / 5 boards. Seed overlap: **207
  pedals / 10 boards** (the single legacy id `mxr-bass-di` is carried as
  `seedId` for `mxr-bass-di-plus`).
- **Seed validation:** `data/catalog/seed-validation.json` covers all 207 + 10
  items (keep/repair/replace/drop). Today every item is **replace** because the
  seed images are mock/url/placeholder; the facts are kept.
- **Policy:** `public-asset` source tag + optional schema fields
  (`usage`, `color`, `notes`, `year`, `status`, `confidence`, `lastVerified`;
  board `variantOf`; optional jack `pos` with approximate edge-only layout).
  Attribution/takedown content: `docs/catalog/attribution-takedown.md`.
  Community jack maps: `docs/catalog/jack-map-record.md`.
- **Caps:** 2,000 hosted pedals / ~4,000 files / ~300 MB; boards 150 Tier A /
  ~300 files / ~20 MB (`tools/catalog-transform/limits.ts`).

### P5-02 tooling (2026-10-22)

- **Build:** `data/catalog/legacy/{pedals,boards}.json` is the frozen seed baseline.
  `pnpm catalog:build` projects raw batches over it and writes
  `data/catalog/{pedals,boards}/<brand>/<batch>.json` (mapped),
  `src/catalog/data/{pedals,boards}.json` (runtime) and
  `data/catalog/registry.json`. Deterministic, byte-stable, with a drift check
  (`pnpm catalog:check`).
- **CI:** `pnpm catalog:ci` builds into a temp dir, validates there, and writes an
  **uncommitted** runtime into the app workspace for `pnpm build`/Playwright.
  Batch PRs contain raw records + assets only; on merge to `main` the
  `Catalog post-merge build` workflow commits the generated files.
- **Validation:** schema/mandatory fields, catalog-wide duplicate ids, pedal/board
  variant links (missing/self/cycle), board footprint, static 800/350 assets and
  caps.
- **Images:** deterministic analyzer (`asset:analyze`) — 800 px long edge,
  background uniformity/alpha/trim, aspect vs the cm footprint (≤10% pass,
  10–15% flag, >15% reject), rotation >2°, shadow/perspective, board top-down
  signals. Processor adds an optional dev-only soft matte, atomic writes and an
  optional analyzer report.
- **Vision QA:** contact sheets of 20–30 images + `catalog-image-reviewer`;
  verdicts/reasons cached by source hash in `work/catalog/image-qa/`.
- **Control plane:** `catalog-runner` + `work/catalog/{state,control,checkpoints,logs}`;
  `catalog:status [--watch]`, start/pause/stop/resume/finish/flag, global STOP,
  checkpoints after every item, 3 batches max, stale-heartbeat warning, 12 min
  item / 4 h active-time limits, SIGTERM→SIGKILL fallback. The control plane is
  shared across linked worktrees (git-common-dir) and caps aggregate the main
  checkout + active/complete worktrees.
- **Caps:** enforced at start/finish from `tools/catalog-transform/limits.ts`:
  2,000 hosted pedals (~4,000 files/~300 MB) and 150 Tier A boards
  (~300 files/~20 MB, independent).
- **Agent templates:** `.opencode/agent/catalog-{pedal,board}-researcher.md`,
  `catalog-image-scout.md`, `catalog-image-reviewer.md`, `catalog-coordinator.md`.

## Capture once, normalize later

**Rule: never discard a verified fact because the current UI doesn't display it yet.** Research is the expensive part; schema/UI changes are cheap.

**Optional fields are opportunistic.** Capture an optional field **only when it appears in the same base research** (the same manufacturer page/manual/retailer page already open for the mandatory facts). Do **not** run extra searches, open extra tabs, or spend more tokens chasing serial numbers, videos, artist associations, prices, jacks, MIDI/USB/power details, or board extras. Missing optional data is fine; the raw record stays useful. Every batch writes a **raw research record** first, then a projection maps the subset we ship to the runtime catalog. Later field additions read the raw record instead of re-researching the pedal.

Raw records live off-runtime in:

```text
data/catalog/research/{pedals,boards}/<brand>/<batch>.json
```

Shape (superset; extra verified facts go in `extra`):

```jsonc
{
  "id": "boss-ds-1",
  "brand": "BOSS",
  "name": "DS-1 Distortion",
  "aliases": ["DS1"],
  "category": "pedal",
  "deviceType": "stompbox",             // stompbox | multi-fx | amp-modeler | preamp | di | power-supply | switcher | controller | interface | other
  "formFactor": "standard",            // compact | standard | double | mini | desktop | rack | expression | other
  "instrumentTypes": ["guitar", "bass"], // optional compatibility
  "effectTypes": ["distortion"],
  "widthCm": 7.3, "heightCm": 12.9,
  "dimensionsSource": "manufacturer page",
  "jacks": [
    { "kind": "in", "edge": "right", "pos": 0.5, "stereo": false,
      "connector": "ts", "channels": 1, "signal": "audio", "balanced": false },
    { "kind": "out", "edge": "left", "pos": 0.5, "stereo": false,
      "connector": "ts", "channels": 1, "signal": "audio", "balanced": false }
  ],
  "power": { "voltage": 9, "acDc": "DC", "currentMa": 12 },
  "io": { "inputs": 1, "outputs": 1, "stereo": false },
  "optional": { /* connectors, audio, control, MIDI, USB, wireless, circuit, physical, supply — see §Optional metadata */ },
  "usage": "guitar",
  "color": "orange",
  "year": 1978,
  "status": "current",
  "notes": "short original factual summary",
  "extra": { "anyVerifiedFact": "…" },   // e.g. bypass, battery, controls, made-in
  "sources": [ { "url": "https://…", "kind": ["info", "image"] } ],
  "serial": { "format": "…", "ranges": [ { "from": "…", "to": "…", "year": 1995, "revision": "…" } ], "location": "back plate", "notes": "…" },
  "artistAssociation": [ { "artist": "…", "role": "signature|endorsed|used-by|designed-with", "notes": "…", "sources": [ { "url": "https://…", "kind": ["info"] } ] } ],
  "priceObservations": [ { "amount": 129.99, "currency": "USD", "condition": "new|used", "source": "manufacturer/retailer", "observedAt": "2026-10-21", "notes": "…" } ],
  "videos": [ { "url": "https://…", "title": "…", "source": "manufacturer", "kind": "official-demo", "verified": true } ],
  "confidence": "confirmed",
  "lastVerified": "2026-10-21",
  "imageCandidates": [
    { "url": "https://…", "sourcePage": "https://…", "priority": 1, "notes": "top-down official" }
  ]
}
```

- The runtime catalog is a **projection** of the raw record; unknown/extra fields stay in the raw file (not shipped).
- Image candidates, reject reasons and source pages are kept so a rejected image can be re-checked without re-researching the pedal.
- A later schema addition (e.g. `color`, `stereo`, `bypass`) is a mapping change, not a new research pass: read the raw record first, only re-check fields that are missing.
- **Serial numbers are model-level, not unit-level:** record the format and known ranges/revisions (e.g. date/lot codes) only; never a specific owner's unit serial.
- **Artist association is optional:** if a source already states that a pedal/board is a signature model, designed with an artist, or notably used by one, record `artistAssociation` (artist, role, notes, source). Do **not** run a separate search just for this; capture it only when it appears during normal research.
- **Price is optional and an observation, not a canonical fact:** if a source already shows a price, record `priceObservations` (amount, currency, `condition: new|used`, source, observedAt). Never invent or infer a price; do not run a separate price search.
- **Videos are links, not downloads:** record official/manufacturer demos, manuals and reputable reviews with title/source/kind; prefer manufacturer media.
- The raw archive is committed (small JSON, no images) so every future session can reuse it.

## Optional metadata — capture everything verified

These are **optional**: capture them only when they appear during the same base research, never invent them, and never run a separate search just for an optional field. The raw archive holds the full set; the runtime catalog projects only what the UI shows. This is the “no double-checking later” layer.

### Connectors & jacks
Per jack/connector: `label`, `kind` (semantic: in/out/send/return/exp/exp-in/exp-out/midi/ctrl/power), `edge`, `pos?`/`xCm?`/`yCm?`, `approximate?`, `connector` (`ts`, `trs`, `xlr`, `din5`, `trs-midi-a`, `trs-midi-b`, `usb-a`, `usb-b`, `usb-c`, `micro-usb`, `mini-usb`, `barrel`, `iec`, `rca`, `3.5mm`, `other`), `channels`, `signal` (`audio`, `midi`, `control`, `power`, `usb`, `digital-audio`), `balanced?`, `level?` (`instrument`, `line`, `speaker`, `headphone`), `impedanceOhm?`, `maxLevelDbu?`, `stereo?`, `midiType?` (`a`, `b`, `din5`, `usb`), `usbFunctions?` (`audio`, `midi`, `editor`, `firmware`, `power`, `host`), `note?`.

This is why a single `kind` is not enough: the **Eventide H90** alone has 4× ¼″ TS inputs, 4× ¼″ TS outputs, 2× ¼″ TRS EXP/CTL jacks, MIDI DIN in + out/thru, USB-C, and a 12 V DC center-positive 5.5/2.5 mm power jack. All of that maps into the same jack/connector record without inventing positions.

### Audio I/O
Inputs/outputs count and channels; mono/stereo/true-stereo; balanced/unbalanced; instrument/line level; input/output impedance; maximum input/output level; dry-through (analog/digital/none); headphone out; aux in; DI/XLR out; effects loop (send/return count, mono/stereo, TRS insert); 4-cable-method support; ground lift; phase invert.

### Control
Expression/CV inputs (count, TRS wiring, voltage range); aux/footswitch inputs; tap-tempo; amp channel switching (latching/momentary, TS/TRS, relay); remote jacks; MIDI control.

### MIDI
5-pin DIN in/out/thru; TRS MIDI **Type A vs Type B**; USB-MIDI; BLE-MIDI; MIDI clock; program change/CC; channel count; merge/thru behavior.

### USB
Connector type; functions (audio interface, MIDI, editor, firmware update, power, host); class compliance; audio channels; sample rate; bit depth; latency; bus power.

### Wireless, app & presets
Bluetooth audio/control/version; Wi-Fi; companion app/editor; preset/bank/scene count; IR loading (slots, formats, sample rates); cloud/editor features.

### Power
Voltage; AC/DC; current draw (mA); power consumption (W); polarity (`center-negative`/`center-positive`); connector size (2.1/2.5 mm/IEC/USB-C); battery type/life; USB bus power; isolation requirement; inrush/peak current; recommended supply. For a **power supply**: outlet count, isolated outputs, per-output V/mA, total mA, AC input.

### Circuit & performance
Analog/digital/hybrid; bypass type (true/buffered/relay/electronic); switching method; DSP/modeling/IR; sample rate/bit depth; latency; trails/spillover; kill-dry; parallel/series routing; scenes/presets; tuner/looper/metronome.

### Physical
Weight; depth/height; enclosure material; finish/color; display; footswitch count; onboard expression pedal; mounting; **jack orientation** (top/side), **power-jack location**, recessed jacks, right-angle/straight plug clearance, jack spacing, mounting holes/feet, battery compartment.

### Electrical & audio specs (optional, high value for warnings)
Input/output impedance; maximum input/output level; nominal level; gain/headroom; signal-to-noise; THD+N; frequency response; phantom power; pad; ground lift; phase invert; true stereo vs summed; analog dry-through; balanced/unbalanced; instrument/line/speaker level.

### Routing & performance
Effects loops (send/return count, mono/stereo, TRS insert); 4-cable-method support; series/parallel/split routing; kill-dry; dry/wet mix; trails/spillover; true/buffered/relay bypass; switching method; latency; presets/banks/scenes; tuner; looper (length/layers); metronome; amp/cab modeling; IR slots/formats; expression assignments; snapshots.

### Control details
Expression/CV voltage range (e.g. 0–3.3 V, 0–5 V); TRS wiring/floating-ring notes; toe switch; footswitch type (latching/momentary, NO/NC); aux switch; amp channel switching (relay/latching/momentary, TS/TRS); remote jacks; tap tempo.

### MIDI details
5-pin DIN in/out/thru; TRS MIDI **Type A/B**; USB-MIDI; BLE-MIDI; MIDI clock; program change; CC/NRPN; 7-bit/14-bit; channel count; merge/thru behavior.

### USB details
Connector (A/B/C/micro/mini); device vs host; functions (audio/MIDI/editor/firmware/power/charging/host); class compliance; audio channels; sample rate; bit depth; latency; bus power; loopback/re-amp.

### Wireless & app
Bluetooth audio/control/version/codec/latency; BLE-MIDI; Wi-Fi; 2.4 GHz proprietary footswitch; companion app/editor; cloud/preset sharing; firmware-update method/version.

### Power details & supplies
Peak/inrush current; power consumption (W); battery type/life; USB bus power/charging; isolation/daisy-chain requirement; voltage-sag behavior; connector size/polarity; recommended PSU; power switch/soft start. For a **power supply**: outlet count, isolated vs shared, per-output V/mA, total mA, AC input, courtesy outlet, USB charging, sag/dip switches, included cables, mounting.

### Identity, compatibility & lifecycle
`deviceType` (stompbox/multi-fx/amp-modeler/preamp/DI/power-supply/switcher/controller/interface/other); `formFactor` (compact/standard/double/mini/desktop/rack/expression/other); `instrumentTypes` (guitar/bass/synth/keys/vocal); release year; discontinued year; replacement model; `variantOf`; limited edition; **artist association** (`signature`, `endorsed`, `used-by`, `designed-with`; optional, only when already found); colorway; made in; **price observations** (new/used, amount/currency/source/date; optional, only when already found); official manual/press-kit URL; firmware version; MIDI implementation chart URL; aliases.

### Provenance
`sources`, `confidence`, `lastVerified`, `dimensionsSource`, `imageCandidates`, and the `extra` bag for anything else verified.

## Future: community jack maps

Once the catalog exists, users can be offered a **“suggest jack layout”** mode: place jack markers on a pedal's top-down footprint, choose connector/direction, attach a photo/evidence, and submit. We review and merge only approved maps into the raw archive (`status: pending|approved|rejected`, `contributor`, `evidence`, `reviewedAt`).

- **v1 without a backend:** the builder produces a JSON snippet + prefilled GitHub issue/PR; no accounts, no server, no automatic writes.
- **v2:** accounts + moderation queue + database; rate limits; contributor credit; removal path.
- **What it unlocks:** exact anchors for pedals with no published layout; real patch-cable lengths (P4-03); 4-cable/amp-loop and stereo/TRS/MIDI routing validation; right-angle/straight plug clearance; power-jack planning; connectivity filters; better export diagrams; coverage metrics. Unmapped pedals keep the fallback anchors.
- **Quality:** approved-only, evidence-backed, versioned; user photos follow the same rights/takedown policy.

## Data contract

### Mandatory
`id`, `brand`, `name`, `category` (`pedal|supply`), `effectTypes` (pedals ≥1,
supplies `[]`), `widthCm`, `heightCm`.

### Required for the cable feature
`jacks[]`: `kind`, `edge`, `pos`, `stereo?`. **Optional enrichment for catalog
data**: if a source exposes input/output positions, record them. `pos` is
normalized 0..1 along the edge, but it is **derived from exact cm** — e.g. a jack
3 cm from the left on a 7.3 cm-wide pedal is `edge: "top", pos: 3 / 7.3`; a jack
2 cm down the left side of a 12 cm pedal is `edge: "left", pos: 2 / 12`. This
represents any point on the four edges exactly. A jack inset from the edge would
need an optional additive `xCm`/`yCm` (only if a source actually requires it).
**Capture every connector** (audio I/O, aux, expression/CV, MIDI, USB, power)
with its position when the source exposes it; the runtime catalog keeps them for
future features. **Only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor
today.**
When only the **edge count** is known (e.g. “2 jacks on top”), record two
`jacks` entries with `kind` + `edge` and **omit `pos`**; the resolver distributes
them evenly across that edge and marks the anchors **approximate** (hollow ticks).
Exact `pos` can be filled later from measured cm. If the order/positions are
estimated from an official product photo (rear/top view), record `pos` +
`approximate: true`; never claim exact cm. When no jack data exists at all,
P4-02's fallback anchors apply (assumed IN left / OUT right).

### Enrichment (capture everything verified; show when present)
`power` (`voltage`, `acDc`, `currentMa`), `usage` (`guitar|bass|both|unknown`),
input/output count, mono/stereo, `color`, `year`, `status`, original `notes`,
`sources`, `confidence`, `lastVerified`, plus any other verified fact in the raw
record's `extra` bag. Missing fields are allowed; **do not invent** values.

### Schema additions (P5-01 implementation)
`usage?` (absent = unknown), `color?`, `notes?`, `year?`, `status?`, `confidence?`, `lastVerified?`,
and a **`public-asset`** value in `SOURCE_TAGS`. `jacks.stereo?` already exists.

## Master inventory

Two tracks, one catalog:

### Pedals
- Normalize `Brand`/`Name`, dedupe by slug, collapse colorways to `variantOf`.
- Inventory is **off-runtime** (`data/catalog/inventory.json`).
- Tier A = top ~20 brands / ~1,850 pedals; Tier B = next ~30 brands; Tier C = long tail.
- Priority: BOSS, Electro-Harmonix, JHS, MXR, TC Electronic, Behringer, Keeley,
  Walrus Audio, EarthQuaker, Mooer, Joyo, Strymon, Wampler, Dunlop, Fender,
  DigiTech, Catalinbread, OBNE, GFI, Meris, Red Panda.

### Pedalboards
- **263 boards / 38 brands** in the discovery list; current seed has only 10.
- Tier A = **exactly 150 boards**, taken in priority-brand order until the cap;
  Tier B/C = the rest. Do not expand beyond 150 without raising the board
  image budget.
- Priority brands (discovery counts): Pedaltrain (23), Pivotal (22), Templeboards/
  Temple Audio (21), Creation Music Co (18), GigRig (18), Morton (17), Rockboard
  (16), Vertex (14), Mono (11), STRICH (10), Aclam (8), Friedman (6), Gator (6),
  BOSS (4), D'Addario (4), Voodoo Lab (4), Fender (3), Blackbird (2), plus
  Harley Benton, Palmer, Fame, SKB, Holeyboard, Donner.
- Normalize brand names and collapse size variants only where the family is the
  same base model; keep real size/version entries as their own products.

**First 2,000 catalog items:** ~**1,850 pedals + 150 boards**. The 2,000
hosted-pedal cap still applies to pedals; board images are a small separate
budget (~300 files / ~20 MB at Tier A) and stay inside the same Pages/GitHub
safety margin.

PedalPlayground is **discovery only** — facts and images are re-verified.

## Pedalboards — data contract

Boards use the same capture-once raw archive and image pipeline, with a board-
specific projection. `widthCm`/`heightCm` remain the **footprint** (width ×
depth); physical thickness/height is separate.

### Mandatory
`id`, `brand`, `name`, `widthCm`, `heightCm` (footprint depth), `image`, `source`.

### Optional enrichment (capture when found)
- **Physical:** `thicknessCm`, `maxHeightCm` (with risers), `weightG`, `material`
  (aluminum/wood/steel/composite), `finish`/`color`.
- **Form:** `boardType` (flat/angled/tiered/folding), `tiers` + tier heights,
  `surface` (velcro/loop/slat/track), `handles`, `feet`, `mounting`.
- **Transport:** `bagIncluded`, `caseIncluded`, `caseModel`, `foldable`,
  `weightWithCaseG`.
- **Power/ routing:** `powerMount` (brand/size), `powerSupplySpace`,
  `cableRouting` (slots/holes/undercarriage), `cableClearanceCm`.
- **Compatibility:** `maxPedalHeightCm`, `maxPedalDepthCm`, recommended board
  size/family, `variantOf` (size family).
- **Lifecycle/commercial:** year, discontinued, replacement, limited edition,
  made in, **price observations (new/used) when already found**, manual URL,
  videos, serial format/ranges (model-level), artist association.
- **Provenance:** `sources`, `confidence`, `lastVerified`, `imageCandidates`,
  `extra`.

### Board images
- Prefer **top-down, empty board** images (no pedals) so true scale is clear; a
  transparent/neutral background is ideal. Angled hero shots are rejected or
  re-sourced.
- Aspect check uses `widthCm / heightCm` (footprint); perspective distortion is
  a reject signal.
- Both 800/350 renditions, same as pedals.

## Image policy & pipeline

Owner-approved self-hosted public-asset policy (ADR-003). Every shipped image is
a **static asset** (`imageSource: "static"`) under `public/pedal-assets/`, or the
P5-05 CDN.

### Candidate sourcing
1. Official manufacturer product/press page.
2. Authorized retailer/product page.
3. Existing public catalog image (last resort).
Record the source URL per item; never bulk-copy descriptions.

### Quality gate
1. **Analyzer (script, `sharp`)** — min 800 px long edge; background uniformity;
   alpha; trim bbox/whitespace; aspect ratio vs `widthCm/heightCm` (accept ~≤10%,
   flag 10–15%, reject >15%); rotation/skew ≤2°; shadow/perspective/watermark
   signals.
2. **Processor (script)** — background removal (extend the existing flood fill;
   dev-only ML fallback for gradients/shadows), trim, transparent **AVIF**
   (q80 default, q90 escalation; PNG is the per-item fallback), 800/350.
   **Drop shadows/reflections are not part of the product:** prefer a shadow-free
   top-down candidate; if the only candidate has one, remove it before trimming
   (alpha threshold/matte). The shadow must never be included in the cutout or
   counted in the cm footprint.
3. **AVIF quality gate:** encode at q80; require **PSNR ≥ 40 dB** (RGB where
   alpha > 0) and a **dedicated 2-cell identical-coordinate PNG-vs-AVIF 2× crop**
   review; if the item fails, escalate q90 → q100 or keep PNG for that item.
   AVIF q80 measured 6–11% of PNG at 36–42 dB on the pilot assets; q90 improves
   to ~39–45 dB. The analyzer always runs fresh; its image-QA cache is for the
   **vision reviewer** verdicts only. For an alpha cutout the border is the
   subject, so border uniformity is informational (not a reject).
   **Side-jack pedals:** if jack barrels/feet protrude beyond the enclosure, use
   `asset:process --body-crop` (median body edge) and analyze the processed
   output so the enclosure, not the connectors, sets the true-scale width.
4. **Vision QA** — only ambiguous images, on **contact sheets** of 20–30; never
   one call per image.
5. **Fallback** — max 3 candidates → placeholder + `needs-new-image` flag.
6. **Human contact sheet** per brand before PR merge.

### Renditions & surfaces

- `800/` — master: specimen plate, canvas (current), export/HD.
- `350/` — thumbnail: picker ledger rows.
- The info-panel sleeve/banner shares one URL with the specimen, so it uses the
  800 master today; a separate peek rendition is a future refinement.
- The app must not hardcode sizes: `ASSET_RENDITIONS` in `src/lib/cdn.ts` is the
  single source of truth. A future **512 canvas rendition** can be added there
  before the bulk fill if decoded-memory measurements justify it.

Regression fixtures: **BOSS AC-3** (white background) and **TC Choka** (bad crop
and bottom drop shadow — removed before trimming).

## Hosting cap and P5-05

- **Hard cap: 2,000 pedals with hosted images** (~4,000 files, ~300 MB).
- **Board image budget:** ~150 Tier A boards × 2 renditions ≈ 300 files / ~20 MB;
  boards do not count toward the 2,000-hosted-pedal cap.
- **AVIF changes the math:** the pilot Choka is 28 KB (800) + 10 KB (350); the
  measured 800 range is ~28–106 KB and the 350 range ~10–27 KB, so 2,000 pedals
  project to ~80–270 MB (fits 300 MB) and 150 boards to ~10 MB (fits 20 MB).
  Re-measure on the first real brand batch; P5-05 stays deferred unless the
  measured average exceeds the caps.
- The runner checks before/after each batch; at the cap it stops all P5-03 waves
  and reports.
- Current Cloudflare Pages/GitHub setup is safe at this cap. Full 8,557 would be
  ~17,100 images (~1.2 GB+) and hits Pages’ 20,000-file / repo-size / directory
  limits.
- **P5-05 (deferred)** evaluates R2 public bucket (leading), Pages Pro, a
  separate Pages asset project, Backblaze B2, Bunny CDN; ADR-002 update + cost
  table + migration plan. No migration without owner approval.

## Parallel work & control plane

```text
data/catalog/inventory.json
data/catalog/research/pedals/<brand>/<batch>.json   # raw capture (one agent owns one file)
data/catalog/research/boards/<brand>/<batch>.json
data/catalog/pedals/<brand>/<batch>.json            # mapped/normalised batch
data/catalog/boards/<brand>/<batch>.json
data/catalog/registry.json                          # coordinator only
work/catalog/state|control|checkpoints|logs         # runtime control plane
public/pedal-assets/**                              # final assets
```

- Brand agents write **only** their batch file + own assets; never
  `src/catalog/data/pedals.json`.
- Feature agents write `src/**` / `e2e/**` only. No shared-file conflicts.
- **Agents write raw records only.** A batch PR contains **raw records + assets only**; CI runs `catalog:build` into a temp dir for validation **and** generates an **uncommitted** runtime into the app workspace before `pnpm build`/Playwright, so the PR's new items are actually testable. A **post-merge build** deterministically commits raw → `data/catalog/{pedals,boards}/...` (mapped) → `src/catalog/data/{pedals,boards}.json` (runtime). No agent edits the mapped/runtime files. A post-merge drift check catches stale generated files.
- **Max 3 batches in flight**; one brand batch = one branch/worktree = one PR.
- Batch size 25–40 pedals; BOSS (209) splits into ~5–6 batches. Boards: 10–25
  models per batch (families/sizes); the final Tier A partial batch may be
  smaller (even 1 board). A board brand batch runs alongside pedal batches in the
  same 3-slot queue.
- `catalog-runner` + `pnpm catalog:status [--watch]`,
  `catalog:pause|stop|resume`, global `STOP`, per-agent flags.
- Per-agent state: kind (pedals/boards), progress %, done/total, images
  accepted/rejected, elapsed, heartbeat, blockers.
- Checkpoint after every pedal; atomic writes; no PR on stop; SIGTERM/SIGKILL
  fallback; stale heartbeat alert after 30 min.
- **Status message every 15 minutes**; hard per-pedal limit 12 min (initial),
  per-batch 4 h of active time (paused gaps excluded); tune after the pilot.

## Execution

1. **P5-01** policy, data contract, inventory, schema, 2k cap.
2. **P5-02** tooling, quality gates, control plane, agent templates.
3. **Pedal pilot:** TC Choka — one PR with the raw record + assets; CI runs
   `catalog:build` into a temp dir and an **uncommitted** app-workspace runtime
   for Playwright; the post-merge build commits mapped/runtime. Hosted image, contact sheet, Playwright.
4. **Board pilot:** **Pedaltrain Classic 2** (or Temple Audio Duo 24) — one PR
   with board facts, hosted top-down image, contact sheet, Playwright board
   picker/placement. Boards are first-class: this runs immediately after the
   pedal pilot, not at the end.
5. **Small parallel test:** Meris + Red Panda + one board batch (Pedaltrain) —
   one PR each, 3 in flight.
6. **Big-brand split test:** BOSS, 3 batch PRs in parallel; verify build/merge.
7. **Scale:** 3 batches in flight continuously, mixing pedals and boards;
   refill as each finishes. First 2,000 catalog items include 150 boards.
8. **At the Tier A target:** stop and run P5-04. Only if the owner chooses to exceed Tier A: the 2,000 hosted-pedal cap applies, then run P5-05 before scaling.
9. **P5-04:** final QA, provenance, launch gate.

## Per-PR QA

- Schema valid; no duplicate ids; variants resolve; mandatory fields present.
- Both image renditions exist; alpha/background/aspect pass; image loads
  same-origin; export stays untainted.
- Playwright: picker search + brand/effect filters; canvas placement; no console
  errors; screenshot/contact sheet in the PR.
- Boards: footprint width×depth, top-down image aspect, picker board preview,
  board placement/rotation, no console errors; board images 800/350.
- Coverage report: pedals covered, unresolved, duplicates, image pass/reject.

## Cost/time

After the BOSS split test, measure tokens/time per pedal, image accept rate, and
rework rate. Tune batch size/model tier. No fixed calendar commitment until then.
The 2,000 cap and the measured batch duration are the real constraints.

## Historical note

The old appendix (per-pedal mocked/cleared status for the 207-item seed) is
superseded by this plan and remains in git history. The machine-readable source
of truth is the catalog data + the P5 registry.

## Research references (standards & examples)

- Eventide H90 specifications / rear panel — 4 TS in, 4 TS out, 2 TRS EXP/CTL, MIDI DIN in/out, USB-C, 12 V center-positive 5.5/2.5 mm: <https://www.eventideaudio.com/pedals/h90/> and <https://cdn.eventideaudio.com/manuals/h90/1.12.5/content/appendix/specifications.html>
- MIDI Association — TRS connectors with MIDI devices (Type A standard; Type B legacy): <https://midi.org/specification-for-use-of-trs-connectors-with-midi-devices>
- MIDI transports / TRS A-B pinout: <https://midi.community/docs/transports/>
- Red Panda — stereo/TRS vs balanced, CV/expression wiring: <https://support.redpandalab.com/support/solutions/articles/43000586536-stereo-pedal-connections> and <https://support.redpandalab.com/support/solutions/articles/43000583020-building-a-cv-to-expression-cable>
- Elektron — TS/TRS, balanced/unbalanced, CV/expression/footswitch: <https://support.elektron.se/support/solutions/articles/43000601004-connectors-and-signals>
- Strymon — pedal power requirements, 9V center-negative 2.1 mm, current headroom, isolated outputs: <https://www.strymon.net/gear-guide-getting-right-power-supply-strymon-pedal/>
- Guitar.com — pedal power guide (voltage/polarity/current, AC exceptions): <https://guitar.com/guides/buyers-guide/pedal-power-explained/>
- Truetone — power FAQ (voltage/polarity/current): <https://www.truetone.com/FAQ/>
- Guitar World — true vs buffered bypass: <https://www.guitarworld.com/features/true-bypass-vs-buffered-bypass>
