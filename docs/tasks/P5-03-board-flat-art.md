# P5-03b: Board flat-art batch (all catalog boards)

**Phase:** P5 · **Status:** proposed — next after P5-03 pilot PR #39 merges · **Model:** build-strong

## Goal

Replace every catalog board image with a **flat self-drawn/illustrated** asset built
from the official dimensions and rail/slot layout, using the approved
**Pedaltrain Classic 2** sample as the style reference. **No photo-derived
cutouts, no third-party planner images, no Pedalplayground.** The result must
read as a clean flat board at app scale: transparent slots, smooth/rounded
edges, no white/background/halo/shadow/fringe.

## Why

The photo-derived board assets are structurally wrong for a planner: the real
boards are photographed at an angle, so the rail tops catch bright/silver light
and cast shadows. Those are product/photo light, not background — keying cannot
remove them cleanly. The approved Pedaltrain sample
(`tools/asset-pipeline/board-art/pedaltrain-classic-2.svg`) avoids the problem
by drawing the top-down board flat.

Current `asset:analyze` board report on the 10 seed assets (Pedaltrain pilot
passes bright 0% / edge 0%):

| board | result | issue |
| --- | --- | --- |
| BOSS BCB-1000 | reject | perspective 20%, bright edge 25% |
| Boardmods B | reject | perspective 56% |
| Caseman Gentleman Medium | reject | aspect 35% off |
| D'Addario XPND-1 | reject | perspective 23%, bright edge 2% |
| Donner DB-3 | flag | bright residual 2%, bright edge 15% |
| Emerson 18×12 | flag | bright residual 7.4%, bright edge 6.3% |
| Aclam / Blackbird / Creation / Fame | pass* | *top-down reviewer flag only |

These are asset defects, not app bugs. The flat-art batch fixes the class, not
just the Pedaltrain pilot.

## Scope

- **Boards:** the 10 seed boards + the Pedaltrain Classic 2 pilot = **11**.
- **Art:** one source SVG per board under `tools/asset-pipeline/board-art/` (style:
  dark flat body, transparent slots, 1px gray outline, small gray brand line,
  rounded outer corners). Draw each board's real rail/slot layout from official
  product images + dimensions — do not reuse a generic template blindly.
- **Assets:** `public/pedal-assets/boards/{800,350}/<id>.avif` (q90), same id
  filenames; update the seed/runtime image filenames from `.png` to `.avif`
  through the catalog pipeline (no hand-edited runtime).
- **Data:** official dimensions and layout facts only; `sources` official; no
  third-party image candidates. Keep the existing board facts.
- **No feature code, no new dependencies, no generated drift.**

## Style contract

- True footprint aspect (≤1% error).
- Flat body (no photo gloss/specular rail tops), transparent open slots.
- Smooth outer edge; rounded outer corners (~7px at 800w); anti-aliased.
- No white/background/shadow/halo/fringe; no 3D highlights.
- Subtle gray outline + small gray brand line (never white); readable on the
  dark canvas and on light.
- 800/350 AVIF q90; source SVG committed in `tools/`, not `public/`.

## QA (executable)

1. `pnpm asset:analyze --kind board --width-cm … --height-cm …` per asset:
   - aspect pass;
   - **bright residual <1%** of visible pixels;
   - **bright edge <2%** of edge pixels;
   - no shadow flag;
   - board top-down/empty reviewer flag resolved.
2. Render each asset on **dark canvas, light, and checkerboard** (Playwright or
   a one-off script) and inspect at 1× + 3× corner: no border/residual/fringe.
3. `design-reviewer` reviews the batch contact sheet + the rendered boards;
   `catalog-image-reviewer` accepts the AVIF quality gate.
4. `pnpm catalog:ci`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm e2e`; board picker/placement/rotation/export/share on desktop + mobile.
5. One PR: source SVGs + 11×2 AVIFs + task file (no generated runtime drift).

## Read first

- `docs/tasks/P5-03-boards-pedaltrain-classic-2.md` (approved pilot/sample)
- `docs/catalog-backfill.md` §Board images / §Quality gate
- `.opencode/agent/catalog-image-scout.md` + `catalog-image-reviewer.md`
- `tools/asset-pipeline/board-art/pedaltrain-classic-2.svg`
- `tools/asset-pipeline/analyze.ts` (`bright` residual check)

## Acceptance

- All 11 boards have flat-art AVIF 800/350; no PNG-only board assets.
- Analyzer: every board passes aspect + bright residual <1% + bright edge <2%;
  no shadow; one top-down/empty reviewer pass.
- Visual: no white/bg/halo/shadow/border at 1× or 3× on dark/light/checker.
- The app still renders the boards true-scale; picker/canvas/rotation/export/
  share pass on desktop + mobile.
- No third-party/planner images; Pedalplayground remains last resort.
