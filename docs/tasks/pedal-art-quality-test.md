# Pedal-art quality test — template vs reference vs faithful

**Status:** test / in review · **Date:** 2026-10-29 · **Scope:** visual calibration only

## Goal

Compare three generated-art fidelity levels on the **same pedal** (BOSS DS-1,
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

All three use the existing `asset:pedal-art` renderer and the frozen
“Catalog Specimen” style. Reference pixels are **not shipped**; the official
reference is included in the comparison sheet only for QA.

## Artifacts

- `docs/screenshots/pedal-art-quality-test/comparison-800.png` — reference +
  three levels at 800 (full detail).
- `docs/screenshots/pedal-art-quality-test/comparison-350.png` — the same at
  picker/thumb size.
- Individual 800 PNGs: `boss-ds-1-{template,reference,faithful}.png`.

Rendered AVIF sizes (800 / 350):

| Level | 800 | 350 |
|---|---:|---:|
| Template-only | 9,077 B | 3,786 B |
| Reference-driven | 14,677 B | 5,843 B |
| Fully faithful | 15,219 B | 6,298 B |

## Observations

- **Template-only** proves the shape/controls but loses the brand colour, the
  printed legends and the model identity. It is fast and safe, but generic.
- **Reference-driven** is immediately recognizable as a DS-1: sampled orange,
  correct knob arrangement, labels, CHECK lamp and DISTORTION title.
- **Fully faithful** adds the separator line, OUTPUT/INPUT legends, larger
  corner knobs, smaller center LEVEL knob and the dark tread pad. It is closest
  to the real object while staying a flat, typeset illustration.

## Decision points

1. **Policy:** keep real-photo-first (generated art fills gaps) or switch to
   “illustrated by default”?
2. **Fidelity:** template-only (fast, generic), reference-driven (recognizable),
   or faithful (closest, slowest)?
3. **Scope:** Tier A launch catalog (~1,850 pedals + 150 boards) or the full
   inventory (8,549)?
4. **Jacks/power:** accept disclosed assumed fallbacks, or require research per
   item?

## Not run

Full `catalog:ci`, guard, lint, typecheck, unit tests and E2E — intentionally
skipped for this visual calibration. Specs render deterministically; the PNGs
above are the evidence.
