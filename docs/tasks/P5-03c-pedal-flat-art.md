# P5-03c — Pedal flat-art generator + promote-legacy (T-1)

**Phase:** P5 · **Status:** in review — PR #TBD · **Type:** tooling + design · **Depends on:** T-0

## Goal

Ship the deterministic tools needed to replace the **no-official** pedal images
without Pedalplayground pixels:

1. a **template-based flat pedal-art generator** + per-item art-spec schema, and
2. a **`catalog:promote-legacy`** scaffold that turns an existing legacy runtime item
   into a raw-research record for a brand cleanup batch.

No catalog batch data ships in this PR.

## Design direction (owner gate)

The designer proposes the visual direction first; the **owner approves it before any
implementation**. Direction: a faithful flat top-down “catalog illustration” of the
pedal (true enclosure shape, controls, labels, colors) consistent with the app/board
art, not a photo, not a planner copy. Official/authorized/user photos are **reference
only**; no reference pixels ship. `designer` proposal → owner approval →
`design-reviewer` ≤2 passes → style freeze.

**Outcome (2026-10-26):** the designer proposed **“Catalog Specimen”**; the owner
approved it (including type + ≤2 solid bands, and clipping to the enclosure
instead of drawing jack protrusions) before implementation. Two design-reviewer
passes ran on the rendered pilots: pass 1 found the DS-1 pad/duplicates + cheap
knob/switch rings + random pointers + 350 smudges; pass 2 approved Enzo and fixed
the rest, but still flagged the DS-1 face as too empty at the cap. The pass-2
findings were folded after the cap (low-contrast tread field restored, Tensor
HOLD legend, 350 LED/button LOD, pointer tick); no third reviewer pass. The
owner reviews the final pilots in the PR.

## Scope

### 1. Pedal flat-art generator

- **Landed:** `tools/asset-pipeline/pedal-art/` (`spec.ts` schema, `svg.ts`
  renderer, `glyphs.ts` + bundled IBM Plex Sans subset/OFL, `render.ts`,
  `index.ts` CLI), `asset:pedal-art`, tests, and the SOP
  `docs/catalog/pedal-art.md`. The 350 rendition is a clean LOD (no legends/LEDs/
  small buttons); the 800 master carries the full set.
- Template family (shared geometry + per-item spec):
  `compact`, `standard`, `double/twin`, `expression`, `switcher`, `footswitch`,
  `volume`, `multi-fx`, `desktop/rack`.
- Per-item **art-spec JSON**: shape, width/height cm, body color, knob/control
  positions, labels, footswitch/LED, jack protrusions, brand/model text. The model
  writes the **spec**, not a freehand SVG per pedal.
- CLI `asset:pedal-art`: spec → transparent 800/350 AVIF (+ PNG reference); analyzer
  (aspect/alpha/background/shape-taper), no shadow/halo; deterministic output.
- Tests for the spec schema, rendering, analyzer pass, determinism.
- SOP `docs/catalog/pedal-art.md`; update `docs/catalog/board-art.md` to point
  pedals at the pedal-art path for no-official items (pedals still prefer real
  official/authorized photos where clean).
- 2–3 **pilots** from official/authorized/user reference photos (never planner) to
  calibrate the style; include them as fixtures/evidence, not catalog items.

### 2. Promote-legacy scaffold

- **Landed:** `catalog:promote-legacy --brand <brand> --ids <file> [--id …]
  [--batch <slug>]`: copies the existing legacy/runtime facts by id (name,
  dimensions, effect types, jacks/power if present), strips planner/image-only
  sources, sets `imageProvenance` (`legacy`/`pending-replacement` or
  `official`/`chosen` with `--source-url`), and leaves the asset slot empty.
  It refuses ids already in a raw batch and never re-researchs.
- Output a raw batch file under `data/catalog/research/pedals/<brand>/<batch>.json`
  suitable for T-4…T-7; no mapped/runtime edits.
- Tests: deterministic copy, id coverage, no invented facts, no planner URLs.
- This is the scaffold used by the cleanup waves; it must not re-research facts.

## Non-goals

- No new catalog items/assets in this PR.
- No planner pixels or planner references.
- No budget re-baseline (T-0a/calibration owns that).
- No 31-item repair itself (T-2) — only the tools.

## Pilots / evidence

- `boss-ds-1-distortion` (official BOSS gallery, 7.3 × 12.9 cm, compact).
- `meris-enzo` (official Meris front-controls reference, 10.8 × 11.43 cm, double).
- `red-panda-tensor` (official Red Panda product page, 7.75 × 12.07 cm, compact).
- Analyzer: **accept** 3/3 (aspect error 0.01–0.06 %, rotation 0, no shadow).
- Evidence: `docs/screenshots/P5-03c/` (reference-vs-generated, dark/light/
  checker, 350 tile, 3× crops, `analysis/*.json`). Pilots are fixtures/evidence,
  not catalog items.

## Acceptance

- Generator + specs + promote-legacy deterministic and tested.
- Pilots pass the clean-alpha/aspect/analyzer gates and the design review; owner
  approved the direction.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; code review (1 light
  pass); one PR; no merge.
- Record the design approval + the pilot references in the PR/task.
