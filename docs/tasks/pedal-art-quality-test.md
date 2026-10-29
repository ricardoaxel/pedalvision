# Pedal-art quality test — spec levels + cartoon research

**Status:** test / in review · **Date:** 2026-10-29 · **Scope:** visual calibration only

## Goal

Compare generated-art fidelity levels on the **same pedal** (BOSS DS-1,
7.3 × 12.9 cm) so the owner can decide how much per-item work the catalog art is
worth before committing to a production plan.

This is **not** a catalog batch and does **not** change the catalog policy. It
does not run the full catalog pipeline or the full test suite (owner request).

## Test levels

| Level | What it uses | Spec |
|---|---|---|
| **Template-only** | Catalog facts + effect-type heuristics; neutral body colour; no reference image | `tools/asset-pipeline/pedal-art/pilots/quality-test/boss-ds-1-template.json` |
| **Reference-driven** | Official DS-1 reference for body colour, band, control layout/labels; typeset text | `tools/asset-pipeline/pedal-art/pilots/quality-test/boss-ds-1-reference.json` |
| **Fully faithful** | Reference-matched colour, knob scale/placement, CHECK lamp, output/input legends, separator line, tread pad | `tools/asset-pipeline/pedal-art/pilots/quality-test/boss-ds-1-faithful.json` |
| **Exact replica** | Adds per-text ink (light BOSS on the dark pad), centre-capped knobs, arrow-like output/input legends and the closest reference layout the renderer can express | `tools/asset-pipeline/pedal-art/pilots/quality-test/boss-ds-1-exact.json` |
| **Studio replica v2** | Geometry measured from the official transparent top: knob centres/scale, pad bounds, knurled knobs, centre caps, real arrow primitives, marker dots, CHECK label | `tools/asset-pipeline/pedal-art/pilots/quality-test/boss-ds-1-studio.json` |

All five spec levels use the existing `asset:pedal-art` renderer and the frozen
“Catalog Specimen” style. Reference pixels are **not shipped**; the official
reference is included in the comparison sheets only for QA.

## Artifacts

- `docs/screenshots/pedal-art-quality-test/comparison-800.png` — reference +
  three levels at 800 (full detail).
- `docs/screenshots/pedal-art-quality-test/comparison-350.png` — the same at
  picker/thumb size.
- Individual 800 PNGs: `boss-ds-1-{template,reference,faithful,exact,studio}.png`.
- Studio v2 comparison: `comparison-studio-800.png` / `comparison-studio-350.png`
  (official top, exact v1, studio v2) and a picker-context mock:
  `studio-ui-card.png`.
- Research pass: `comparison-cartoon-800.png` / `comparison-cartoon-350.png`
  (official top, exact spec, reference-derived cartoon) and
  `cartoon-candidates.png` (the tested pipelines).

Rendered AVIF sizes (800 / 350):

| Level | 800 | 350 |
|---|---:|---:|
| Template-only | 9,077 B | 3,786 B |
| Reference-driven | 14,677 B | 5,843 B |
| Fully faithful | 15,219 B | 6,298 B |
| Exact replica | 16,680 B | 6,832 B |
| Studio replica v2 | 17,553 B | 7,187 B |
| Reference-derived cartoon (VTracer) | 24,914 B | 10,650 B |

## Observations

- **Template-only** proves the shape/controls but loses the brand colour, the
  printed legends and the model identity. It is fast and safe, but generic.
- **Reference-driven** is immediately recognizable as a DS-1: sampled orange,
  correct knob arrangement, labels, CHECK lamp and DISTORTION title.
- **Fully faithful** adds the separator line, OUTPUT/INPUT legends, larger
  corner knobs, smaller center LEVEL knob and the dark tread pad. It is closest
  to the real object while staying a flat, typeset illustration.
- **Exact replica** adds the white knob caps, light BOSS mark on the tread pad
  and arrow-like output/input legends. It is the closest flat-art representation
  we can render today without logos or reference pixels. It still uses typeset
  text (not the BOSS wordmark), and it required two small optional renderer
  fields (`text.ink`, `knob.cap`).
- **Studio replica v2** is the strongest **own** version: measured knob positions/sizes and pad bounds from the high-res official top, knurled knobs with centre caps, real arrow primitives, marker dots, CHECK label and a black footswitch. It is still typeset (no BOSS wordmark) and slightly stylised, but it reads much closer to the real unit than exact v1. The picker-context mock (`studio-ui-card.png`) shows it in the actual catalog UI.
- **Renderer additions for v2:** optional `knob.style: "knurled"`, `dot` and `arrow` control kinds, and measured geometry. These are backwards-compatible; existing specs are unchanged.

## Reference-derived cartoon (research pass)

After the four spec levels, I tested a **photo-derived** pipeline on the official
**transparent top-down** DS-1 image (`ds-1_top.png`, 980×700), not the small
gallery JPG:

1. crop to alpha and upscale to 1400 px;
2. bilateral filter (9 / 80 / 80);
3. k-means colour quantization (10 colours);
4. **VTracer** (color, stacked, spline, 8-bit precision, layer difference 12);
5. render at 800, apply the alpha mask and a 2 px silhouette keyline.

Why VTracer: it is a linear-time, colour-aware raster→vector tracer (unlike
Potrace, which is binary), so it keeps the exact text, BOSS mark, knob caps,
arrows and layout while flattening the photo into vector regions. The high-res
transparent top fixed the noisy results from the 514 px gallery JPG.

Result: **the closest visual replica** of the real pedal — exact text/logo
layout, flat vector colours, 24.9 KB (800) / 10.7 KB (350). It is still
**reference-derived**: the BOSS wordmark is the trademark of BOSS, the output is
a derivative of their official image, and there are orange shading halos around
the knobs from the source. It is **not shippable** without permission; the clean,
logo-free spec remains the shippable path.

The likely production path is a **hybrid**: use this reference-derived vector to
read exact positions/colours, then author a clean spec (no logos, no reference
pixels) from it.


## Deterministic filter sweep (no agentic generation)

All variants below are classical CPU filters applied to the **official transparent
top** (`ds-1_top.png`), not per-image LLM/agent calls. One script processes the
whole catalog; there is no per-item token cost. Every output keeps the official
layout/text but is **reference-derived** (not shippable without permission).

**Comparison grid:** `docs/screenshots/pedal-art-quality-test/filter-comparison.png`
(3 × 4: official top + 11 filters).

| Variant | Core algorithm | Look | Text/logo fidelity | Main issue | Verdict |
|---|---|---|---|---|---|
| Bilateral + adaptive | bilateral + k-means + adaptive threshold | clean cartoon, flat colours | good | thick/noisy edges | solid baseline |
| Bilateral + XDoG | bilateral + k-means + XDoG | strong ink lines | good | texture noise | good cartoon |
| Mean-shift + XDoG | pyramid mean shift + k-means + XDoG | flatter, smoother | soft | BOSS text smears | not best |
| Kuwahara + adaptive | Kuwahara + k-means + adaptive | painterly, soft regions | soft | BOSS text soft | good painterly |
| Kuwahara + XDoG | Kuwahara + k-means + XDoG | painterly + ink | good | texture noise | good |
| Domain transform + XDoG | domain-transform edge-preserving + k-means + XDoG | smooth, washed | good | low contrast | meh |
| Stylization | OpenCV `stylization` | watercolour | poor | knobs/text distort | reject for product |
| Pencil colour | OpenCV `pencilSketch` colour | sketch | poor | washed out / illegible | reject |
| **Bilateral + Canny** | bilateral + k-means + Canny | clean flat + thin ink | **very good** | edges can be thin | **best clean raster** |
| **VTracer flat** | bilateral + k-means + VTracer | exact vector, crisp | **excellent** | orange shading halos | **best exact vector** |
| **VTracer + lines** | k-means + XDoG + VTracer | bold cartoon vector | excellent | body texture noise | **best bold cartoon** |

**Recommendation:** if the goal is a clean, shippable-from-licensed-source look,
start with **Bilateral + Canny** or **Kuwahara + adaptive**. If the goal is an
exact vector replica, use **VTracer flat**; for stronger cartoon lines, use
**VTracer + lines**. Reject `stylization` and `pencilSketch` for product art —
they lose the knobs/text.

**Cost:** these are CPU seconds per item (roughly 0.05–5 s depending on the
filter at 1200 px), so 8,549 items is hours of compute, not months. The real
cost is source rights + QA, not the filter.

## Decision points

1. **Policy:** keep real-photo-first (generated art fills gaps) or switch to
   “illustrated by default”?
2. **Fidelity:** template-only (fast, generic), reference-driven (recognizable),
   faithful (closest), or exact replica (closest flat-art ceiling, slowest)?
3. **Scope:** Tier A launch catalog (~1,850 pedals + 150 boards) or the full
   inventory (8,549)?
4. **Jacks/power:** accept disclosed assumed fallbacks, or require research per
   item?
5. **Source path:** spec-driven (shippable, clean, approximate), reference-derived
   cartoon (exact, derivative, halos), or hybrid (use the cartoon as a tracing
   reference for a clean spec)?
6. **Studio v2 adoption:** is this the new exact-replica standard, a hero-only
   tier, or should it stay a test?

## Not run

Full `catalog:ci`, guard and E2E — intentionally skipped for this visual
calibration. The optional renderer fields (`text.ink`, `knob.cap`, `knob.style`, `dot`, `arrow`)
were checked with `pnpm typecheck`, the 37 art-pipeline unit tests and
`pnpm lint`; the PNGs above are the evidence.
