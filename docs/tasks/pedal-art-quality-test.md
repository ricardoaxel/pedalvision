# Pedal-art quality test — four fidelity levels

**Status:** test / in review · **Date:** 2026-10-29 · **Scope:** visual calibration only

## Goal

Compare four generated-art fidelity levels on the **same pedal** (BOSS DS-1,
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

All four spec levels use the existing `asset:pedal-art` renderer and the frozen
“Catalog Specimen” style. Reference pixels are **not shipped**; the official
reference is included in the comparison sheets only for QA.

## Artifacts

- `docs/screenshots/pedal-art-quality-test/comparison-800.png` — reference +
  three levels at 800 (full detail).
- `docs/screenshots/pedal-art-quality-test/comparison-350.png` — the same at
  picker/thumb size.
- Individual 800 PNGs: `boss-ds-1-{template,reference,faithful,exact}.png`.
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

## Not run

Full `catalog:ci`, guard and E2E — intentionally skipped for this visual
calibration. The two optional renderer fields were checked with `pnpm typecheck`,
the 37 art-pipeline unit tests and `pnpm lint`; the PNGs above are the evidence.
