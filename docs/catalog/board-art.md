# Board art SOP (P5-03)

**Audience:** any future agent/designer adding or repairing a pedalboard image.
**Status:** mandatory for board assets. **New board batches ship our own flat
art** (owner instruction, 2026-10-25). Pedals do **not** use this path — pedals
stay on the real-image pipeline (official/authorized photo → clean cutout →
body-crop → AVIF).

> **One PR per board batch/task.** Source SVGs live on `main`; the batch PR
> contains the raw record + the two AVIFs + the task file. Never merge your own
> PR.

## 1. Generate our own flat art (default for new board batches)

```
new board batch
    → sample the reference color
    → draw a flat SVG from the official dimensions/rail layout
    → render 800/350 AVIF
    → analyzer + vision + app QA
```

Real official/authorized photos are **reference only**: use them to measure the
footprint/rail layout and to sample the body color. **Their pixels are never
shipped.** Existing merged seed boards that passed the real-image gate may stay
until a repair task (see §7); new batches do not “keep the real image”.

**Source hierarchy (reference only):** official brand/product/press →
authorized retailer → existing public catalog. A planner/third-party image may
be used only as a **very last resort for proportions/color**, and its pixels are
**never** shipped.

**Family batches:** keep one family template and a per-size SVG, and use one
reference-sampled family color for consistency (record it in each raw record).

## 2. Sample the reference color

Use the best reference image of that exact board (official or authorized
retailer; crop to the board if needed), then:

```sh
pnpm asset:board-color --input <reference> --out work/catalog/board-color/<id>.json
```

Use the reported **median hex** (not a guessed gray) as the board body color.
Record the hex and reference in the raw record's `extra.imageProcessing`.
Transparent references are supported; alpha-0 corners are treated as transparent,
not black.

## 3. Draw our own flat SVG

- Copy the starter: `tools/asset-pipeline/board-art/_template.svg` →
  `tools/asset-pipeline/board-art/<catalog-id>.svg`.
- Use the **official dimensions/footprint aspect** and the real rail/slot/
  perforation layout from the reference. **Measure** proportions; do not copy
  pixels.
- Body fill = the sampled median hex.
- Transparent openings/slots; for a dense perforated deck, opaque dark perforations are allowed when the reference shows dark holes (this avoids white/checker bleed and halos) — keep a 0.5px transparent outer cutout edge so the asset still reads as a cutout.
- Smooth outer edge, 4–5px rounded corners, anti-aliased.
- No white/background/shadow/halo/fringe; no 3D highlights. Include a brand line
  only if it is part of the board in the reference.
- Add `<title>` (Biome requires it).

Reference examples:
- `tools/asset-pipeline/board-art/pedaltrain-classic-2.svg` — `#151515`, 4 rails / 3 slots.
- `tools/asset-pipeline/board-art/temple-audio-duo-24.svg` — `#3a3c3b` body / `#444643` caps, dense opaque perforation field, mirrored end caps/handles/module slots, no logo (P5-03b repair 2026-10-24).

## 4. Render the committed assets

```sh
pnpm asset:board-art --input tools/asset-pipeline/board-art/<id>.svg --id <id>
```

This writes `public/pedal-assets/boards/{800,350}/<id>.avif` (q90) and a PNG
reference under `work/catalog/board-art/<id>.png`. The source SVG is committed
to `main`; the AVIFs belong to the batch branch/PR.

## 5. QA (all mandatory)

```sh
pnpm asset:analyze --input public/pedal-assets/boards/800/<id>.avif \
  --kind board --width-cm <w> --height-cm <h> --id <id> \
  --out work/catalog/analyze/<id>.json
```

Require:
- aspect pass (≤10%; aim <1%);
- **bright residual <1%** and **bright edge <2%**;
- no shadow flag;
- board top-down/empty reviewer pass.

Then:
- **design-reviewer** on a dark/light/checker sheet + 3× corner (**`opencode-go/deepseek-v4.1-flash` only**; vision; never free/Gemini/Claude/other): no
  white/bg/halo/shadow/border/fringe; transparent openings; corners smooth;
  faithful layout/color.
- **App QA** in the picker/canvas/rotation/export/share on **desktop + mobile +
  WebKit + Firefox** (temporary spec; screenshots in the evidence branch).
- `pnpm catalog:ci`, `pnpm catalog:guard-batch-pr`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`, `pnpm e2e`.

## 6. PR + evidence

- **One PR:** raw record + 800/350 AVIFs + task file. Source SVG stays on `main`.
- Evidence: quality sheet, source PNG, desktop/mobile/WebKit/Firefox app
  screenshots in `docs/screenshots/P5-03-<id>/` on an evidence branch; embed them
  in the PR body with the evidence commit SHA.
- PR body: summary, changes, testing commands/results, screenshots, owner hints,
  review-round digest. Do **not** merge.

## 7. Existing-board repair (P5-03b)

`docs/tasks/P5-03-board-image-repair.md` is the **existing-board exception**
(merged seed boards may keep a clean real image that passes):
- **Keep** the seed boards that pass (Aclam, Blackbird, Creation, Fame as of the
  pilot).
- **Repair only** the failures (BOSS, Boardmods, Caseman, D'Addario, Donner,
  Emerson) + the generated Pedaltrain pilot.
- Do **not** regenerate clean real boards for style consistency.
- **Temple Audio Duo 24 (2026-10-24):** repaired the merged art — mirrored 22px end caps/handles/2+1 module slots, centred unclipped staggered perforation field, removed the logo overlay; body `#3a3c3b`, caps `#444643`; opaque dark perforations + 0.5px cutout edge; evidence `docs/screenshots/P5-03-temple-audio-duo-24-fix/`.
- One PR for the batch; source SVGs on `main`; no generated runtime drift.

## Checklist

- [ ] Reference image used for proportions/color; **no reference pixels shipped**.
- [ ] Color sampled with `asset:board-color`; median hex used.
- [ ] Official footprint/layout; reference used for proportions only; family color sampled once for consistency.
- [ ] SVG has `<title>`, transparent openings, smooth 4–5px corners, no brand
      line unless in the reference.
- [ ] `asset:board-art` rendered 800/350 AVIF q90 + PNG reference.
- [ ] `asset:analyze`: aspect + bright <1% / edge <2% + no shadow + board pass.
- [ ] Design reviewer approved dark/light/checker + 3×.
- [ ] App QA desktop/mobile/WebKit/Firefox.
- [ ] Catalog CI, guard, lint, typecheck, test, build, e2e green.
- [ ] One PR with raw + AVIFs + task; source SVG on `main`; not merged.
