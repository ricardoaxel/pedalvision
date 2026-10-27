# Pedal flat-art SOP (P5-03c, T-1)

**Audience:** any future agent/designer adding a pedal image with no clean
official/authorized photo. **Status:** mandatory for generated pedal art.
**Direction:** "Catalog Specimen" — owner-approved 2026-10-26. One frozen style;
no per-batch designer loop.

> **One PR per task/batch.** A batch PR contains the raw record + the two AVIFs
> + the per-item art spec + its task file. Source specs are committed versions of
> the art; reference pixels never ship. Never merge your own PR.

## 1. When to use this path

Use generated flat art **only when no usable image exists at all**: official,
authorized retailer, user/community and **planner last-resort** have all been
checked and none passes the quality gate. The **31 BOSS legacy repair set uses
the same hierarchy** (official → retailer → community → recorded planner
last-resort → generated only if none); never keep its old unrecorded planner
asset.

- **Pedal source hierarchy:** official brand/press/product-support → authorized
  retailer → user/community with a recorded source → **planner/Pedalplayground
  last-resort (recorded + quality-gated)** → **generated flat art last**. Planner
  last-resort is a shipped image; you do not generate over it for a normal gap.
  It is counted in the source-gap ledger so it can be improved later.
- **Generated-art references:** official/authorized/community only; **no planner
  pixels**. If no reference exists, use the official manual/spec dimensions and
  record that in the spec note. Boards never use planner pixels.
- The reference is **reference only**: measure proportions and sample the body
  colour; do not trace or ship its pixels.
- Generated art is `own` provenance. Record the reference URL in the spec's
  `sourceRef` and in the raw record's `imageProvenance`.

## 2. Design direction — "Catalog Specimen"

A top-down flat-plate illustration of the pedal as a **catalogued object**: exact
footprint, controls, printed legends and sampled colours, with one hairline
keyline doing the silhouette work. Borrow the technical-catalog/blueprint
single-viewpoint discipline: one orthographic view, flat fills, no lighting.

**Style freeze (do not re-litigate per item):**

- Orthographic top-down only. Base silhouette = true footprint.
- Two flat body tones: top face = sampled `body.fill`; side ring = body × 0.88.
  No gradient or bevel lighting.
- Mandatory cutline `#78828C`, **2 px at 800 / 1 px at 350**, on the base.
- Hardware hairlines 1 px @800 / 0.5 px @350. No other outlines.
- **Every knob pointer at 12 o'clock (0°); every toggle centred (0°).** A
  catalog is a specimen, not a patch.
- Narrow knob rim (cap 0.9 r); footswitch ~0.9× knob diameter, muted chrome.
- Big tread pads (DS-1, Big Muff, fuzzes) are a **low-contrast body field**
  (`role: "field"`, ~8 % darker than the body) with one hairline edge and the
  switch inside — never a black fill, never a hole.
- Brand/model/control text is **typeset factual text**, not a logo/wordmark
  reproduction. Type is optional where the reference's graphic is decorative.
- Deliberately omitted: shadows, reflections, specular highlights, gradients,
  bevels, perspective, screws/fasteners, wear, texture/grain, plugged cables,
  LED glow, display UI/content, brand logos and signature artwork.
- Jack sockets/ticks are **app-owned**; the art is clipped to the enclosure so
  the app's true-scale stretch stays correct. `jacks[]` is alignment metadata.

**Fixed art palette** (toolchain constant, theme-independent; not DOM tokens):
`#78828C` cutline · `#EEF1F4` print on dark · `#16191D` print on light ·
`#C7CDD3`/`#9AA3AC`/`#6E7781` metal ramp · `#3A4048` hardware ink ·
`#23282D` display · `#2B3036` LED housing. The sampled body fill is clamped to
OKLCh chroma **≤0.18**; print bands/ink to **≤0.14**. The cyan app accent is
never used.

**Typography:** IBM Plex Sans Medium/SemiBold, vendored as a subset + glyph
outlines under `tools/asset-pipeline/pedal-art/fonts/` (OFL). Text is rendered
as filled paths, so no font ships to the app or inside the AVIF and output is
portable/deterministic. Sizes are physical mm; legend floor 1.8 mm, brand/model
≥2.0 mm. Omit rather than shrink. Brand is uppercase, tracked +0.08 em; model
+0.02 em.

## 3. Art-spec JSON

One spec per item:
`tools/asset-pipeline/pedal-art/specs/<catalog-id>.json`. It is authored from the
reference; the renderer owns geometry/palette/type/primitives. Pilots live in
`tools/asset-pipeline/pedal-art/pilots/`.

```jsonc
{
  "id": "boss-ds-1-distortion",
  "family": "compact",                 // 9 families; defaults + validation pack
  "widthCm": 7.3, "heightCm": 12.9,    // true catalog footprint
  "sourceRef": "https://…",            // reference only; no local image
  "style": "catalog-specimen/1",
  "body": {
    "fill": "#E8722F",                 // sampled median; chroma ≤0.18
    "radiusCm": 0.35, "sideCm": 0.35,
    "knobFinish": "black",             // black|metal|cream|white
    "footswitchFinish": "black",       // metal|black
    "bands": [
      { "u": 0.5, "v": 0.72, "wCm": 6.1, "hCm": 3.2,
        "fill": "#D5692B", "rCm": 0.25, "role": "field", "edge": "hairline" }
    ]
  },
  "ink": "auto",                       // auto = higher-contrast house ink
  "controls": [
    { "kind": "knob", "u": 0.25, "v": 0.30, "diameterCm": 1.8,
      "rotationDeg": 0, "label": "TONE", "labelPlacement": "below" },
    { "kind": "footswitch", "u": 0.5, "v": 0.82, "diameterCm": 1.6 },
    { "kind": "led", "u": 0.5, "v": 0.18, "diameterCm": 0.5, "color": "#C0392B" },
    { "kind": "toggle", "u": 0.5, "v": 0.4, "leverCm": 0.7, "angleDeg": 0 },
    { "kind": "button", "u": 0.5, "v": 0.4, "diameterCm": 0.6 },
    { "kind": "display", "u": 0.5, "v": 0.45, "widthCm": 3.2, "heightCm": 1.4 },
    { "kind": "treadle", "u": 0.5, "v": 0.55, "widthCm": 8, "heightCm": 15 }
  ],
  "text": [
    { "role": "brand", "value": "BOSS", "u": 0.5, "v": 0.055, "sizeMm": 2.4,
      "trackingEm": 0.08, "weight": "semibold" },
    { "role": "model", "value": "DS-1", "u": 0.5, "v": 0.105, "sizeMm": 3.6 }
  ],
  "jacks": [ { "kind": "in", "edge": "right" }, { "kind": "out", "edge": "left" } ]
}
```

**Families** (defaults/validation packs, not nine renderers): `compact`,
`standard`, `double`, `expression`, `switcher`, `footswitch`, `volume`,
`multi-fx`, `desktop-rack`. Use the real form factor; family ranges are guidance,
not a hard layout.

**Constraints enforced by the schema:** `u,v` 0.05–0.95; controls, bands and
text must fit the **rounded top face** (the renderer also clips body content to
it); controls inside the enclosure (0.15 cm inset); text `v ≤0.84` (bottom 16 %
is hardware-only, no essential print) and must fit its measured outline width/
height; jack `protrusionCm: 0` (v1 clips to the enclosure); no planner URL in
`sourceRef`; unknown keys rejected.

## 4. Sample the body colour

Use the existing median sampler on the best official/authorized reference (crop
to the top face first if needed):

```sh
pnpm asset:board-color --input <reference> --out work/catalog/board-color/<id>.json
```

Use the reported **median hex** (not a guess). Record the hex + reference in the
spec. The renderer clamps chroma to 0.18; if the sample exceeds it, the spec is
rejected — pick the measured median, don't hand-tune a neon value.

## 5. Render

```sh
pnpm asset:pedal-art --spec tools/asset-pipeline/pedal-art/specs/<id>.json \
  --assets-dir public/pedal-assets --quality 90
```

Writes `public/pedal-assets/pedals/{800,350}/<id>.avif` (q90, 4:4:4, alpha) and
a PNG + SVG reference under `work/catalog/pedal-art/`. The 350 rendition is a
**simplified LOD**: it omits control legends, LEDs and small buttons, so the
picker thumb stays clean; the 800 master carries the full control set.

## 6. QA (all mandatory)

```sh
pnpm asset:analyze --input public/pedal-assets/pedals/800/<id>.avif \
  --kind pedal --width-cm <w> --height-cm <h> --id <id> \
  --out work/catalog/analyze/<id>.json
```

Require:
- aspect **pass** (≤10 %; aim <1 %), rotation ≤2°, no shadow flag, alpha present;
- clean alpha: no white/black/colour halo, fringe or jagged edge (3× crops);
- no cyan accent pixels; no gradient/filter/shadow/image tags in the SVG;
- deterministic: same spec → identical SVG/PNG/AVIF.

Then:
- **design-reviewer** on dark, light, checker + 3× corner/knob/label/footswitch
  crops + the 350 tile (**`opencode-go/deepseek-v4.1-flash` only**; never
  free/Gemini/Claude/other). ≤2 passes; batch findings into one change.
- **App QA** when shipping a batch: picker/canvas/rotation/export/share on
  desktop + mobile + WebKit + Firefox; name chip does not hide essential print;
  jack ticks align; export is transparent and true-scale.
- `pnpm catalog:ci`, `pnpm catalog:guard-batch-pr`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, `pnpm e2e`.

## 7. Batch integration

- A batch that generates art keeps its **spec** at
  `tools/asset-pipeline/pedal-art/specs/<id>.json` (allowed by
  `catalog:guard-batch-pr` as batch support) and the two AVIFs under
  `public/pedal-assets/pedals/`. The raw record sets `imageProvenance`
  `{ kind: "own", status: "chosen", note }` and `sources` to the reference URL.
- The raw record's `jacks[]` is copied into the spec so app ticks align.
- `catalog:promote-legacy --brand <brand> --ids <file>` prepares the raw record
  for cleanup batches; it never writes an asset slot and never invents facts.
  For re-sourced official images use `--provenance official` with
  `--source-url <url>` (one id) or `--source-urls <map.json>`
  (`{ "<id>": "<url>" }`); planner URLs are rejected in the library.

## 8. Pilots (evidence only, not catalog items)

| id | family | cm | official reference |
| --- | --- | --- | --- |
| `boss-ds-1-distortion` | compact | 7.3 × 12.9 | BOSS DS-1 official gallery |
| `meris-enzo` | double | 10.8 × 11.43 | Meris Enzo official front-controls image |
| `red-panda-tensor` | compact | 7.75 × 12.07 | Red Panda Tensor official product page |

Pilot specs: `tools/asset-pipeline/pedal-art/pilots/`.
Evidence: `docs/screenshots/P5-03c/` (reference vs generated, dark/light/checker,
350 tile, 3× crops, analyzer reports). The pilots are calibration/evidence, not
catalog items.

## Checklist

- [ ] Generated-art reference is official/authorized/community only; **no planner
      pixels** (planner is a separate last-resort shipped source, not a generator
      reference).
- [ ] Body median sampled; record hex + `sourceRef`; chroma ≤0.18.
- [ ] Spec validated; `jacks[]` copied from the raw record.
- [ ] Style freeze: 12 o'clock pointers, centred toggles, low-contrast tread
      field if the pedal has a pad, no logo/shadow/gradient/display UI.
- [ ] `asset:pedal-art` rendered 800/350 AVIF q90 + PNG/SVG reference.
- [ ] Analyzer aspect pass, alpha clean, no shadow/halo/cyan.
- [ ] design-reviewer dark/light/checker + 3× + 350 (≤2 passes).
- [ ] App QA desktop/mobile/WebKit/Firefox (batch).
- [ ] Catalog CI, guard, lint, typecheck, test, build, e2e green.
- [ ] One PR with raw + spec + AVIFs + task; no merge.
