# P5-03c — Pedal flat-art generator + promote-legacy (T-1)

**Phase:** P5 · **Status:** todo · **Type:** tooling + design · **Depends on:** T-0

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

## Scope

### 1. Pedal flat-art generator

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

- `catalog:promote-legacy --brand <brand> --ids <file|runtime-url|mock>` (or an
  equivalent deterministic command): copy the existing legacy facts by id (name,
  dimensions, effect types, device type, jacks/power if present), set
  `imageProvenance` to the appropriate status (`legacy`/`pending-replacement` or
  `official` once re-sourced), and leave the asset slot empty for the batch session.
- Output a raw batch file under `data/catalog/research/pedals/<brand>/<batch>.json`
  suitable for T-4…T-7; no mapped/runtime edits.
- Tests: deterministic copy, id coverage, no invented facts, no planner URLs.
- This is the scaffold used by the cleanup waves; it must not re-research facts.

## Non-goals

- No new catalog items/assets in this PR.
- No planner pixels or planner references.
- No budget re-baseline (T-0a/calibration owns that).
- No 31-item repair itself (T-2) — only the tools.

## Acceptance

- Generator + specs + promote-legacy deterministic and tested.
- Pilots pass the clean-alpha/aspect/analyzer gates and the design review; owner
  approved the direction.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; code review (1 light
  pass); one PR; no merge.
- Record the design approval + the pilot references in the PR/task.
