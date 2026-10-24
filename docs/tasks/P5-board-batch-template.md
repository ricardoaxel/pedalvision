# P5-03: <Brand> — <Board> board batch (TEMPLATE)

**Phase:** P5 · **Status:** in progress — PR pending · **Model:** build-strong

> Copy this file to `docs/tasks/P5-03-boards-<brand>-<board>.md` and replace the
> placeholders. Read `docs/catalog/board-art.md` (SOP) first. One batch = one
> branch = one PR. Do not merge your own PR.

## Goal

Deliver one board batch: a strict raw board record + hosted 800/350 AVIF + this
task file. **Real-first:** keep a clean real image if it exists; otherwise
generate our own flat board art using the reference color/layout (never reference
pixels).

## Batch scope

- **Kind:** boards
- **Brand:** <Brand>
- **Batch id:** `<brand>/<board>`
- **Items:** 1 — `<catalog-id>` (<Board name>)
- **Raw file:** `data/catalog/research/boards/<brand>/<board>.json`
- **Assets:** `public/pedal-assets/boards/{800,350}/<catalog-id>.avif`
- **Source SVG:** `tools/asset-pipeline/board-art/<catalog-id>.svg` (on `main`)
- **Footprint:** <widthCm × heightCm; official source>; <thickness/height>;
  <weight/material/color/layout/handles/case/mounting/cable routing>.
- **Image decision:** <REAL kept / GENERATED fallback>; if generated:
  **reference-sampled median hex `#......`**; <slots/perforations/handles/
  end caps/logo>; 800×<h> / 350×<h>; aspect; bright **0/0**; no reference pixels.

## Read first

- `docs/catalog/board-art.md` (SOP)
- `docs/tasks/P5-03-board-image-repair.md` (real-first policy)
- `docs/catalog-backfill.md` §Board images / §Quality gate
- `.opencode/agent/catalog-image-scout.md` + `catalog-image-reviewer.md`
- `tools/asset-pipeline/board-art/_template.svg`
- `tools/asset-pipeline/analyze.ts` (`bright` residual check)

## Constraints

- **Real image first.** Generate only when the real image is genuinely unusable.
  Generated art must faithfully represent the board (dimensions/layout) and use
  the **reference-sampled color**; no reference/planner pixels.
- **Raw records + assets + task only** in the PR; the source SVG stays on `main`.
- One batch = one branch = **one PR**; no feature code, no generated
  runtime/mapped edits, no new dependencies.
- Status every 15 min; per-item 12 min; per-batch 4 h; checkpoint after the item.

## Steps

1. Confirm the batch scope and the one item.
2. `catalog:start`; checkpoint after the item.
3. Image: real-first gate; if generating, `asset:board-color` → copy the SVG
   template → `asset:board-art`; analyze; design-reviewer; app QA.
4. `catalog:ci` + the Playwright board picker/placement/rotation/export/share
   flow (desktop + mobile + WebKit/Firefox for board pilots).
5. `catalog:guard-batch-pr`; raw + assets + task only.
6. `catalog:finish`; open exactly one PR; do not merge.

## Acceptance

- Raw record covers the board; mandatory fields; optional only if found.
- Image: 800/350 AVIF, top-down/empty; real-first decision documented; generated
  color sampled from the reference; **bright residual <1%**, **bright edge <2%**,
  aspect pass, no shadow; same-origin.
- `catalog:validate` green in CI; guard clean; no mapped/runtime edits.
- Playwright: picker search/brand, image load, placement/rotation, selected-board
  PNG export, read-only share; no console errors.
- Design reviewer asset + app QA; evidence in the PR.
- One PR; no merge.
