# Raw research archive & data contract (P5-01)

The catalog is built from **raw research records** first, then projected into the
runtime schema (`src/catalog/data/{pedals,boards}.json`). Research is the
expensive part; schema/UI changes are cheap. **Never drop a verified fact just
because the app does not display it yet.**

- Schema: `src/catalog/rawSchema.ts` (`RawPedalRecordSchema`,
  `RawBoardRecordSchema`, batch schemas).
- Stress fixture: `data/catalog/fixtures/eventide-h90.json` (14 connectors, no
  invented positions).
- Policy: ADR-003 §Self-hosted public-asset images + §Serial numbers, videos,
  artist association & price. Plan: `docs/catalog-backfill.md`.

## Archive layout

```text
data/catalog/research/pedals/<brand>/<batch>.json   # RawPedalBatchSchema (array)
data/catalog/research/boards/<brand>/<batch>.json   # RawBoardBatchSchema (array)
```

- One agent owns one file; agents **write raw records only**.
- The raw archive is committed (small JSON, no images). Assets are hosted under
  `public/pedal-assets/` by the image pipeline (P5-02/P5-03).
- Image candidates, rejected reasons and source pages stay in the raw file so an
  image can be re-checked without re-researching the model.

## Capture-once rule

Record what is on the page **already open for the mandatory facts** (brand,
name, dimensions, effect type). Capture optional facts **opportunistically**:

- Do **not** run extra searches, open extra tabs, or spend extra tokens just for
  serial ranges, videos, artist association, prices, jacks, MIDI/USB/power
  details or board extras.
- Missing optional data is valid. Never invent a value; prefer `unknown` over a
  wrong value.
- Put any verified fact without a first-class field in `extra`.

## Pedal record (superset)

| Group | Fields |
| --- | --- |
| Identity | `id`, `brand`, `name`, `aliases`, `category` (`pedal`/`supply`), `deviceType`, `formFactor`, `instrumentTypes`, `effectTypes`, `variantOf` |
| Geometry | `widthCm`, `heightCm` (**cm only**; inches are converted at import), `dimensionsSource`, `imageFormat?` (`avif` for P5 hosted assets; default `png`) |
| Connectors | `jacks[]`: `label`, `kind` (in/out/send/return/exp/exp-in/exp-out/midi/ctrl/power), `edge`, `pos?`/`xCm?`/`yCm?`, `approximate?`, `connector` (TS/TRS/XLR/DIN5/TRS-MIDI A-B/USB-A-B-C/micro/mini/barrel/IEC/RCA/3.5 mm/other), `channels`, `signal`, `balanced`, `level`, `impedanceOhm`, `maxLevelDbu`, `stereo`, `midiType`, `usbFunctions`, `note` |
| Power | `power` (top-level runtime projection) + `optional.power`: voltage, AC/DC, mA, W, polarity, connector/size, battery/life, USB bus power, isolation, inrush, recommended supply; for a power supply: outlets, isolated outputs, per-output V/mA, total mA, AC input, courtesy outlet, sag |
| Audio I/O | `io` / `optional.audio`: inputs/outputs, channels, mono/stereo/true-stereo, balanced, level, impedance, max level, gain/headroom, SNR/THD, frequency response, dry-through, headphone, aux, DI, effects loop, 4-cable, ground lift, phase invert, phantom, pad, latency |
| Control | `optional.control`: expression/CV count + voltage range, aux/footswitch, tap tempo, amp switching (latching/momentary, TS/TRS, relay), remote |
| MIDI | `optional.midi`: 5-pin DIN in/out/thru, TRS MIDI **Type A/B**, USB-MIDI, BLE-MIDI, clock, program change, CC/NRPN, channels, merge/thru |
| USB | `optional.usb`: connector, functions (audio/MIDI/editor/firmware/power/charging/host), device/host, class compliance, audio channels, sample rate, bit depth, latency, bus power, loopback/re-amp |
| Wireless/app | `optional.wireless`: Bluetooth audio/control/version, BLE-MIDI, Wi-Fi, proprietary, app/editor, presets/banks/scenes, IR slots/formats, cloud |
| Circuit/performance | `optional.circuit`: analog/digital/hybrid, bypass (true/buffered/relay/electronic), switching, DSP, sample rate, bit depth, latency, trails, kill-dry, parallel/series |
| Physical | `optional.physical`: weight, depth/height, enclosure, finish, display, footswitch count, expression pedal, **jack orientation**, **power-jack location**, recessed jacks, plug clearance, mounting, battery compartment |
| Electrical/audio specs | `optional.electrical`: impedance, max level, nominal level, gain/headroom, SNR, THD, frequency response, phantom, pad, ground lift, phase invert, true stereo, analog dry-through, balanced/level |
| Routing/performance | `optional.routing`: loops, 4-cable, series/parallel/split, kill-dry, dry/wet, trails, bypass, switching, latency, presets/banks/scenes, tuner, looper, metronome, amp/cab modeling, IR, expression assignments, snapshots |
| Identity/compatibility | `deviceType`, `formFactor`, `instrumentTypes` (guitar/bass/synth/keys/vocal) |
| Lifecycle/commercial | `year`, `status`, `serial`, `artistAssociation`, `priceObservations`, `videos`, `optional.lifecycle` (discontinued year, replacement, limited edition, made in, manual URL, firmware, MIDI chart) |
| Planner-specific | jack labels/orientation, power-jack location, plug clearance, mounting |
| Provenance | `sources`, `confidence`, `lastVerified`, `dimensionsSource`, `imageCandidates`, `extra` |

### Model-level optional data

All optional and **captured only when already found**:

- `serial: { format, ranges: [{ from, to, year, revision }], location, notes }`
  — **model-level only**; never a specific owner's unit serial.
- `videos: [{ url, title, source, kind, verified }]` — links, never downloads.
- `artistAssociation: [{ artist, role: signature|endorsed|used-by|designed-with, notes, sources }]`.
- `priceObservations: [{ amount, currency, condition: new|used, source, observedAt, notes }]`
  — an observation, never a canonical price.

### Jack positions

**Capture every connector, even if it is not connectable today.** Record audio
I/O, aux, expression/CV, MIDI, USB and power with `kind`, `edge` and
`pos`/`xCm`/`yCm` when the source exposes it. The runtime catalog keeps them for
future features; **only audio I/O (`in`/`out`/`send`/`return`) is a cable anchor
today**. Never omit a verified non-audio connector.

`pos` is optional. Record it only when a source exposes the position (normalized
0..1 from measured cm: `x / widthCm` on top/bottom, `y / heightCm` on
left/right). If only the edge/count is known (e.g. “2 on top”), record `edge`
and omit `pos`; the runtime resolver distributes edge-only jacks evenly and
marks them **approximate** (hollow ticks). Never invent an exact position.

## Pedalboard record (first-class)

`widthCm` / `heightCm` are the **footprint** (width × depth); physical height is
separate.

| Group | Fields |
| --- | --- |
| Mandatory | `id`, `brand`, `name`, `category: "board"`, `widthCm`, `heightCm`, source |
| Physical | `thicknessCm`, `maxHeightCm` (with risers), `weightG`, `material`, `finish`, `color` |
| Form | `boardType` (flat/angled/tiered/folding), `tiers`, `tierHeightsCm`, `surface` (velcro/loop/slat/track), `handles`, `feet`, `mounting` |
| Transport | `bagIncluded`, `caseIncluded`, `caseModel`, `foldable`, `weightWithCaseG` |
| Power/routing | `powerMount`, `powerSupplySpace`, `cableRouting`, `cableClearanceCm` |
| Compatibility | `maxPedalHeightCm`, `maxPedalDepthCm`, `variantOf` (size family) |
| Lifecycle/commercial | `year`, `status`, `serial`, `artistAssociation`, `priceObservations`, `videos`, manual |
| Provenance | `sources`, `confidence`, `lastVerified`, `imageCandidates`, `extra` |

- Keep real size/version entries as their own products; use `variantOf` only to
  link a size family, never to hide a distinct product.
- Board images must be top-down and empty (no pedals), neutral/transparent
  background, aspect checked against `widthCm / heightCm`; angled hero shots are
  rejected.

## Runtime projection

Only fields the runtime schema supports are projected:

- Pedal: `id`, `brand`, `name`, `widthCm`, `heightCm`, `image` (`<id>.<imageFormat>`;
  P5 hosted assets use `.avif`), `imageSource`,
  `effectTypes`, `category`, optional `jacks` (`kind`, `edge`, `pos?`,
  `stereo?`), `power`, `variantOf`, `usage`, `color`, `notes`, `year`, `status`,
  `confidence`, `lastVerified`, `source`, `sources`, `links`.
- Board: `id`, `brand`, `name`, `widthCm`, `heightCm`, `image`
  (`<id>.<imageFormat>`; P5 hosted assets use `.avif`), `imageSource`,
  `variantOf`, `source`, `sources`.

The projection is deterministic from the raw record. Adding a runtime field is a
mapping change, not a new research pass: read the raw record first, re-check only
a missing field. Unknown/extra facts stay in the raw file.

## Validation

`RawPedalRecordSchema` / `RawBoardRecordSchema` validate types and enums; unknown
top-level keys are rejected so verified facts go in `extra`. The checked-in H90
fixture is the multi-connector stress case (4 TS in, 4 TS out, 2 TRS EXP/CTL,
MIDI DIN in/out, USB-C, 12 V center-positive 5.5/2.5 mm) and is exercised by
`src/catalog/rawSchema.test.ts`.
