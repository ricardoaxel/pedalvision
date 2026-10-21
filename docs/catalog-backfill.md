# Catalog backfill plan (P5)

Plan for turning the committed 207-item seed into the real, quality-gated
catalog. Governed by **ADR-003**; roadmap tasks **P5-01…P5-05**.
Owner decisions: **2026-10-21** (self-hosted public assets + 2,000-pedal cap).

## Goals

- Ship a clean catalog with **real facts + hosted, quality-gated images**.
- Cover **Tier A** (top ~20 brands / ~2,000 pedals) for launch; the long tail
  continues after launch.
- Keep **cm** as the only stored unit; inches are converted at import.
- Make data work **parallel with feature work** without merge conflicts.
- Make every agent run **observable and stoppable**.
- Stay inside the **2,000 hosted-pedal hard cap** until hosting is re-decided.

## Current state

- Seed: **207 pedals / 13 brands / 10 boards**; `effectTypes` for 201/207
  (the 6 blanks are supplies).
- **0 jacks, 0 power**; images: 129 hotlinked `url` + 78 `mock`; **0 hosted**.
- Verified base models carry **485 source refs** (340 `image` links).
- Discovery list: **8,557 pedals / 779 brands** from the PedalPlayground public
  list (`Brand`, `Name`, `Width`, `Height`, `Image`; **inches**) + other sources
  the `pedal-expert` agent uses.

**Keep the 207 seed.** Run it through the quality gate and keep/repair/replace
per item; do not wipe. Freeze a `legacy` snapshot for rollback.

## Capture once, normalize later

**Rule: never discard a verified fact because the current UI doesn't display it yet.** Research is the expensive part; schema/UI changes are cheap. Every batch writes a **raw research record** first, then a projection maps the subset we ship to the runtime catalog. Later field additions read the raw record instead of re-researching the pedal.

Raw records live off-runtime in:

```text
data/catalog/research/<brand>/<batch>.json
```

Shape (superset; extra verified facts go in `extra`):

```jsonc
{
  "id": "boss-ds-1",
  "brand": "BOSS",
  "name": "DS-1 Distortion",
  "aliases": ["DS1"],
  "category": "pedal",
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
- The raw archive is committed (small JSON, no images) so every future session can reuse it.

## Optional metadata — capture everything verified

These are **optional**: capture them when a source provides them, never invent them. The raw archive holds the full set; the runtime catalog projects only what the UI shows. This is the “no double-checking later” layer.

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

### Product lifecycle & commercial
Release year; discontinued year; replacement model; `variantOf`; limited edition; artist signature; colorway; made in; MSRP/price (optional); official manual/press-kit URL; firmware version; aliases.

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
When only the **edge count** is known (e.g. “2 jacks on top”), record two
`jacks` entries with `kind` + `edge` and **omit `pos`**; the resolver distributes
them evenly across that edge and marks the anchors **approximate** (hollow ticks).
Exact `pos` can be filled later from measured cm. When no jack data exists at all,
P4-02's fallback anchors apply (assumed IN left / OUT right).

### Enrichment (capture everything verified; show when present)
`power` (`voltage`, `acDc`, `currentMa`), `usage` (`guitar|bass|both|unknown`),
input/output count, mono/stereo, `color`, `year`, `status`, original `notes`,
`sources`, `confidence`, `lastVerified`, plus any other verified fact in the raw
record's `extra` bag. Missing fields are allowed; **do not invent** values.

### Schema additions (P5-01 implementation)
`usage`, `color?`, `notes?`, `year?`, `status?`, `confidence?`, `lastVerified?`,
and a **`public-asset`** value in `SOURCE_TAGS`. `jacks.stereo?` already exists.

## Master inventory

- Normalize `Brand`/`Name`, dedupe by slug, collapse colorways to `variantOf`.
- Inventory is **off-runtime** (`data/catalog/inventory.json`).
- Tier A = top ~20 brands / ~2,000 pedals (launch scope); Tier B = next ~30
  brands; Tier C = long tail.
- Priority: BOSS, Electro-Harmonix, JHS, MXR, TC Electronic, Behringer, Keeley,
  Walrus Audio, EarthQuaker, Mooer, Joyo, Strymon, Wampler, Dunlop, Fender,
  DigiTech, Catalinbread, OBNE, GFI, Meris, Red Panda.
- PedalPlayground is **discovery only** — facts and images are re-verified.

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
   dev-only ML fallback for gradients/shadows), trim, transparent PNG, 800/350.
3. **Vision QA** — only ambiguous images, on **contact sheets** of 20–30; never
   one call per image.
4. **Fallback** — max 3 candidates → placeholder + `needs-new-image` flag.
5. **Human contact sheet** per brand before PR merge.

Regression fixtures: **BOSS AC-3** (white background) and **TC Choka** (bad crop).

## Hosting cap and P5-05

- **Hard cap: 2,000 pedals with hosted images** (~4,000 files, ~300 MB).
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
data/catalog/brands/<brand>/<batch>.json      # one agent owns one batch file
data/catalog/registry.json                    # coordinator only
work/catalog/state|control|checkpoints|logs   # runtime control plane
public/pedal-assets/**                        # final assets
```

- Brand agents write **only** their batch file + own assets; never
  `src/catalog/data/pedals.json`.
- Feature agents write `src/**` / `e2e/**` only. No shared-file conflicts.
- `pnpm catalog:build` regenerates the runtime catalog after merges.
- **Max 3 batches in flight**; one brand batch = one branch/worktree = one PR.
- Batch size 25–40 pedals; BOSS (209) splits into ~5–6 batches.
- `catalog-runner` + `pnpm catalog:status [--watch]`,
  `catalog:pause|stop|resume`, global `STOP`, per-agent flags.
- Per-agent state: progress %, pedals done/total, images accepted/rejected,
  elapsed, heartbeat, blockers.
- Checkpoint after every pedal; atomic writes; no PR on stop; SIGTERM/SIGKILL
  fallback; stale heartbeat alert after 30 min.
- **Status message every 15 minutes**; hard per-pedal limit 12 min (initial),
  per-batch 4 h; tune after the pilot.

## Execution

1. **P5-01** policy, data contract, inventory, schema, 2k cap.
2. **P5-02** tooling, quality gates, control plane, agent templates.
3. **Pilot:** TC Choka — one PR with data + hosted image + contact sheet +
   Playwright.
4. **Small parallel test:** Meris (15) + Red Panda (14) — one PR each.
5. **Big-brand split test:** BOSS, 3 batch PRs in parallel; verify build/merge.
6. **Scale:** 3 batches in flight continuously; refill as each finishes (no
   one-per-day assumption). Priority brands first.
7. **At 2,000 hosted pedals:** stop; run P5-05; resume only after the decision.
8. **P5-04:** final QA, provenance, launch gate.

## Per-PR QA

- Schema valid; no duplicate ids; variants resolve; mandatory fields present.
- Both image renditions exist; alpha/background/aspect pass; image loads
  same-origin; export stays untainted.
- Playwright: picker search + brand/effect filters; canvas placement; no console
  errors; screenshot/contact sheet in the PR.
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
