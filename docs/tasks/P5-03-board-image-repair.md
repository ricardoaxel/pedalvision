# P5-03b: Board image repair (real-first)

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** proposed — next after P5-03 pilot PR #39 merges · **Model:** build-strong

## Goal

Audit every catalog board image and **keep the real image whenever it is clean**.
Repair only the boards whose real image is genuinely unusable (ugly/non-transparent,
real rail highlights, bright front strips, shadows, white/bg residue or fringe)
with **our own flat art** that faithfully represents the board. **No blanket
replacement** of good real images.

The Pedaltrain Classic 2 pilot is the first generated repair (its real photos
were unusable). It uses:
- **proportions measured** from the planner reference (34px side columns, slots
  x 34→766, rail/slot bands 67 / 50 / 67 / 49 / 67 / 50 / 67);
- **board color sampled from the reference** (`#151515`);
- **our own SVG**, no planner/third-party pixels, transparent slots, 4px corners,
  subtle gray outline, no brand line.

## Why

Real product images are preferred and should stay. But a planner needs a clean
top-down board: angled photos have real specular rail tops, silver front strips
and shadows that background removal cannot flatten. Generate only when the real
image cannot meet the clean-alpha standard.

Current `asset:analyze` board report (Pedaltrain pilot passes bright 0% / edge 0%):

| board | result | action |
| --- | --- | --- |
| Aclam / Blackbird / Creation / Fame | pass* | **keep real image** (*top-down reviewer flag only) |
| BOSS BCB-1000 | reject | repair (perspective 20%, bright edge 25%) |
| Boardmods B | reject | repair (perspective 56%) |
| Caseman Gentleman Medium | reject | repair (aspect 35% off) |
| D’Addario XPND-1 | reject | repair (perspective 23%, bright edge 2%) |
| Donner DB-3 | flag | repair (bright 2%, edge 15%) |
| Emerson 18×12 | flag | repair (bright 7.4%, edge 6.3%) |
| Pedaltrain Classic 2 | generated | pilot repair (real photos unusable) |

## Scope

- **Audit:** all 11 board assets with `asset:analyze` (aspect, bright residual,
  bright edge, shadow) + dark/light/checker render + design review.
- **Keep:** real images that pass. Do **not** regenerate a clean real board just
  for style consistency.
- **Repair:** only the failures. Prefer a clean official/authorized real
  replacement if one exists; otherwise draw our own flat SVG from official
  dimensions/rail layout.
- **Generated art:** one source SVG per repaired board under
  `tools/asset-pipeline/board-art/`; 800/350 AVIF q90 under
  `public/pedal-assets/boards/`; update the seed/runtime image filenames through
  the catalog pipeline (no hand-edited runtime).
- **Color:** sample the board fill from the **reference image** used for that
  board (the Pedaltrain sample is `#151515`). Proportions may be measured from an
  official/authorized/planner reference; **never ship planner pixels**.
- **No feature code, no new dependencies, no generated drift.**

## Style contract (generated repairs only)

- True footprint aspect (≤1% error); official rail/slot layout.
- Flat body, **color sampled from the reference**; transparent open slots.
- Smooth outer edge; rounded corners (~4px at 800w); anti-aliased.
- No white/background/shadow/halo/fringe; no 3D highlights; no brand line
  unless the reference has one and it is part of the board.
- 800/350 AVIF q90; source SVG committed in `tools/`, not `public/`.

## QA (executable)

0. For each repaired board: sample the reference color with
   `pnpm asset:board-color --input <reference> --out …`; draw/copy the SVG;
   render with `pnpm asset:board-art --input … --id …`.
1. `pnpm asset:analyze --kind board --width-cm … --height-cm …` per asset:
   aspect pass; **bright residual <1%**; **bright edge <2%**; no shadow; board
   top-down/empty reviewer pass.
2. Render on **dark canvas, light, and checkerboard** (Playwright or one-off
   script); inspect 1× + 3× corner: no border/residual/fringe.
3. `design-reviewer` reviews the batch contact sheet + renders on **`opencode-go/deepseek-v4.1-flash` only** (vision; never free/Gemini/Claude/other);
   `catalog-image-reviewer` accepts the AVIF quality gate.
4. `pnpm catalog:ci`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm e2e`; board picker/placement/rotation/export/share on desktop + mobile.
5. One PR: repaired source SVGs + their AVIFs + task file (no generated runtime
   drift). Clean real images are left untouched.

## Read first

- `docs/catalog/board-art.md` (board-art SOP)
- `docs/tasks/P5-03-boards-temple-audio-duo-24.md` (second-brand generated pilot)
- `docs/tasks/P5-03-boards-pedaltrain-classic-2.md` (approved generated pilot)
- `docs/catalog-backfill.md` §Board images / §Quality gate
- `.opencode/agent/catalog-image-scout.md` + `catalog-image-reviewer.md`
- `tools/asset-pipeline/board-art/pedaltrain-classic-2.svg`
- `tools/asset-pipeline/analyze.ts` (`bright` residual check)

## Acceptance

- Real board images that pass are kept (4 seed boards identified above).
- Only the failing boards are repaired; each generated one is faithful
  (dimensions/layout) and **color-sampled from its reference**.
- Analyzer: every repaired board passes aspect + bright residual <1% + bright
  edge <2%; no shadow; one top-down/empty reviewer pass.
- Visual: no white/bg/halo/shadow/border at 1× or 3× on dark/light/checker.
- No planner/third-party pixels; Pedalplayground may be used only to measure
  proportions/colors as a very last resort.
