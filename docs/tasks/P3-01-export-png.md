# P3-01: Export PNG + PDF

**Phase:** P3 · **Status:** done (merged 2026-10-19, PR #23, squash `d2a33bb`) · **Model:** build-strong

## Goal
Let a user save a **real PNG or PDF of their pedalboard plan** — the finished
artifact they can print, share, or attach to a message — without any of the live
viewport's zoom/pan or clipping leaking into it.

Export runs through a **detached offscreen Konva Stage** (never the live stage).
The user can export either **the selected board** (that board + attached pedals
+ cables whose BOTH endpoints are in scope) or **all content** (**everything**,
including far-off loose items/endpoints; no automatic trim — the pixel clamp
handles extreme layouts). PNG follows the app theme; **PDF is a true-scale
paper-light raster PDF** for printing. Output has an opaque background, a
32 px/cm base density, `pixelRatio ≤ 2`, and a **16.7 MP total + 8192 px edge**
clamp for iOS Safari.

Images are rendered only when they are same-origin / CORS-clean; otherwise the
export **fails clearly** instead of silently producing a tainted/blank file.
Per A3, the real iOS Safari export remains an owner/manual device check.

## Read first (context pack)
- `docs/design.md` §Canvas architecture → **Export** bullets (detached stage,
  scope, out-of-scope cable rule, background, pixel clamp) and
  §Data model (`Cable`, `Endpoint`, `PlacedBoard`, `PlacedItem`).
- `docs/requirements.md` F9 + A3.
- `docs/roadmap.md` P3-01; `docs/phase-guide.md` P3.
- `docs/decisions/001-canvas-library.md` (iOS export risk) and
  `docs/decisions/002-hosting-and-assets.md` (same-origin/CORS).
- `src/canvas/BoardNode.tsx`, `PedalNode.tsx`, `boardFinish.ts`, `useImage.ts`,
  `loadImage.ts` (visual primitives + image loader), `src/lib/cdn.ts`
  (image-resolution contract), `src/lib/geometry.ts` (`cmToPx`, `boardToWorld`,
  `rotatePoint`), `src/state/scene.ts` (`boardFootprint`, `itemFootprint`,
  `itemWorldCorners`, `resolveItem`, `itemsByZ`), `src/styles/theme.ts`
  + `tokens.css` (palette + canvas background).
- `src/App.tsx` + `src/index.css` (toolbar/chrome), `src/components/Picker.tsx`
  (dialog/sheet conventions).
- Precedent for the design + review flow: `docs/tasks/P2-08-first-run-guidance.md`.

## Constraints
- **Design-affecting:** the `designer` proposes the direction and the **owner
  approves before any UI exists**. Then render desktop + mobile, dark + light,
  and run `design-reviewer` (vision, actual pixels) — **≤2 passes**. Fold every
  finding before commit.
- **Detached stage only.** Never rasterize the live stage. The export stage has
  no inherited viewport transform (no pan/zoom), no viewport clipping, no grid,
  no selection/Transformer/warning chrome. Content is drawn from the **scene
  document**, at cm true scale.
- **Scope:**
  - **Selected board** — that board + its attached items + only cables whose
    **both** endpoints are in scope. A pedal→amp/instrument endpoint is in scope
    when the endpoint is inside **board bounds + `ENDPOINT_MARGIN_CM = 30`**.
    A cable to anything out of scope is **dropped** (never clipped mid-air).
  - **All content** — every board, loose item, cable and endpoint, even a
    far-off orphan pedal with no board. **No automatic trim/fit cap**: the pixel
    clamp fits extreme layouts into a valid image. A tight, high-density image is
    what the selected-board scope is for.
  - Selected-board scope must be unavailable/disabled when no board is selected.
- **Cables/endpoints:** the real cable store is P4. Model the scope engine over
  export-input `Cable`/`Endpoint` shapes (matching `design.md` §Data model) so
  P4 can wire the store in later without rewriting the export; unit-test the
  both-endpoints rule + endpoint margin with synthetic cables.
- **Quality:** **Standard is the default** (32 px/cm at 1×, small file); **HD**
  is opt-in (64 px/cm, up to the area/edge budget). Text/scale-bar physical size
  stays constant across modes.
- **Pixel safety:** `pixelRatio ≤ 2`; total output ≤ **16.7 MP** and each edge
  ≤ **8192 px** (fit-scale, then reduce pixelRatio; dimensions may exceed 4096
  as long as the area stays under the old-iOS ceiling). Never export a
  blank/zero-size image. The readout shows effective PPI.
- **Formats:** PNG (WYSIWYG theme) and a **true-scale paper-light PDF** (same
  raster, exact cm→pt page, `DCTDecode` JPEG, zero new deps). No SVG in v1.
- **Opaque background:** fill with the render theme's surface/canvas color
  (`theme.canvasBackground`). Never transparent.
- **Images:** load same-origin/CORS-clean images before drawing. If an included
  image fails (CORS, missing, hotlink-blocked), **throw a clear, user-facing
  error** naming the part(s) — do not silently substitute a fallback. Catch a
  tainted-canvas `SecurityError` from `toDataURL` and surface it clearly.
- **Zero new deps.** No html-to-image/html2canvas; no download helper library.
  Use Konva + the existing loader + an `<a download>` / blob URL.
- Tokens only (no hardcoded colours), dark + light, desktop + mobile; 44px
  touch targets; labelled controls; a visible failure state (not toast-only —
  N8). Correct focus handling when the export surface closes.
- Do **not** build P3-02/P3-03 (save/share), SVG export, print layout, or the
  cable UI (P4).
- Catalog/image provenance must not appear in the UI (ADR-003).

## Steps
1. **Create this task file** (done).
2. **Designer direction → owner approval.** Record the direction name + approval
   date here and in `docs/progress.md`. **No UI before approval.**
3. **Pure export model** (`src/lib/exportScene.ts` + tests):
   scope resolution (selected board / all content), rotation-aware world bounds,
   endpoint margin, both-endpoints cable rule, padding, pixel-ratio +
   total-pixel clamp. No DOM.
4. **Detached offscreen renderer** (`src/canvas/exportStage.ts` or similar):
   preload included images with the existing CORS loader, build a detached
   Konva Stage at content size, fill the surface background, draw boards (image
   / custom finish / fallback), items (image / custom / fallback + name chips),
   cables/endpoints when present, then `toDataURL`. Return the data URL (PNG) or
   PDF bytes; throw typed, user-facing errors for image/CORS/encoder failures.
   The detached layer's scene canvas is pinned to 1× so device DPR can't inflate
   the iOS budget.
5. **UI (owner-approved direction):** an Export trigger in the existing toolbar
   chrome opening a compact export surface with **FORMAT (PNG | PDF)**,
   **QUALITY (Standard | HD, Standard default)**, the scope choice (selected
   board vs all content), an output-size + PPI readout, the primary download
   action, and an inline error/empty state. Desktop + mobile variants; tokens
   only.
6. **Tests:** Vitest for the pure model (bounds under rotation, selected-board
   exclusion, 30 cm endpoint margin, both-endpoints cable rule, far-off loose
   items/endpoints included, pixel clamp). Playwright (desktop + mobile): create a
   custom board + custom pedal (no external images), export selected board and
   all content, parse the downloaded PNG (signature + IHDR dimensions), verify
   non-blank/opaque pixels, verify export is unaffected by live zoom/pan, and
   verify the no-board state disables selected-board scope.
7. **Design gate:** screenshots (desktop + mobile, dark + light) → `design-reviewer`,
   ≤2 passes; fold findings.
8. **Code review (light, one source-scoped pass).** Fix blockers/should-fixes.
9. **Docs + PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`,
   reconcile `docs/progress.md` + `docs/roadmap.md` + this file, open **one** PR
   to the full standard (inline screenshots at the commit SHA, ≤3 owner hints,
   review-round digest). **Do not merge.**

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: selected-board bounds include the board + attached items only, with
  rotation; an endpoint inside board+30 cm is included and one outside is
  excluded; a cable with one out-of-scope endpoint is dropped; a cable with both
  endpoints in scope is kept; all-content bounds include loose items/cables; a
  far-away loose item is fit-capped; the pixel clamp keeps output ≤4096×4096 and
  pixelRatio ≤2; output dimensions are never 0.
- Playwright (desktop + mobile): exporting a custom board + pedal downloads a
  valid PNG whose IHDR dimensions match the reported output size, whose pixels
  are non-blank and fully opaque, and whose extent contains the board/pedal
  (not the viewport). A PDF download starts with `%PDF-`, embeds a `DCTDecode`
  image at the reported dimensions, and has the exact cm→pt MediaBox (selected
  and clamped all-content cases). Live zoom/pan before export does not change
  the exported dimensions/content. With no board selected, selected-board scope
  is disabled; selecting a board enables it and excludes another board's content.
- Manual/owner (A3): export PNG and PDF on a real iOS Safari device produces
  valid non-blank files (owner device check; the PDF page size is rendered and
  inspected with `pdftoppm` in this session).
- Grep/audit: no new dependencies, no hardcoded colours in new UI, no
  `dangerouslySetInnerHTML`.

## Notes
- **Direction: "Print Ticket" — designer proposal, OWNER-APPROVED 2026-10-19
  before any UI.** A quiet, non-modal print-job ticket. Desktop: 320px docked
  panel under the top-right toolbar (no scrim; the canvas stays interactive so
  the selected board can drive the scope). Mobile: 388px compact tray above the
  tab bar (never a full sheet). Neutral EXPORT trigger, one accent
  `Download PNG`; native-radio scope (`Selected board` / `All content`, the
  first disabled with no board); live mono spec well (output px + output cm +
  effective ratio, clamp/fit notices); persistent inline success/error states.
  The owner also approved the **10/5 cm drafting scale bar** in the PNG's bottom
  margin (no branding/caption). Tokens only; zero new deps.
- **Export model** (`src/lib/exportScene.ts`, 18 unit tests): rotation-aware
  bounds; selected-board scope keeps a cable only when BOTH ends are in scope
  (an endpoint must sit within board AABB + `ENDPOINT_MARGIN_CM = 30`);
  all-content includes **every** board, loose item, endpoint and cable (no fit
  cap); uniform `EXPORT_PADDING_CM = 4`; `EXPORT_PX_PER_CM = 32`, `pixelRatio ≤ 2`, and the
  `EXPORT_MAX_PIXELS = 16_777_216` + `EXPORT_MAX_EDGE_PX = 8192` clamp with
  fit-scale reduction; `ExportQuality` Standard (32 px/cm @1×, default) / HD
  (64 px/cm, area-capped); exposes `outputPpi` + `pxPerCm`. The input carries
  `endpoints`/`cables` in the design.md shape, so P4 can wire the real store
  without changing the scope rules.
- **Renderer** (`src/canvas/exportStage.ts`): a detached Konva Stage (never the
  live stage; the layer canvas is pinned to 1×), opaque background, boards
  (image / procedural finish / fallback), attached + loose items in z order,
  name chips, cables/endpoints when present, then a 10/5 cm scale bar in the
  bottom margin. Images are preloaded CORS-first via the existing self-healing
  loader; any failed image throws a clear `ExportError` (named parts), and a
  tainted canvas is reported. **PDF** renders the paper-light palette, encodes
  JPEG (~0.92), and wraps it in a true-scale page (`src/lib/pdf.ts`); the JPEG
  MIME is verified before embedding.
- **UI:** `src/components/ExportPanel.tsx` + the toolbar trigger
  (`src/App.tsx`, `DownloadIcon`), tokens-only CSS in `src/index.css`
  (desktop panel / mobile tray / short-landscape fallback; export hides the
  first-run note and, on mobile, the info panel — one bottom surface at a
  time). **FORMAT** (PNG | PDF) sits above SCOPE; the CTA/filename/success/error
  follow the selected format; changing scope/format clears a stale error.
  Escape returns focus to the trigger; success focuses Done; error focuses
  Try again.
- **E2E** (`e2e/export.spec.ts`, desktop + mobile): downloads are parsed as
  real PNGs (signature + IHDR dimensions), decoded in-page to assert fully
  opaque pixels and non-blank content, selected-board vs all-content extents,
  live zoom/pan independence, empty/disabled states, and the mobile tray
  geometry above the tab bar.
- **Design gate:** `design-reviewer` **APPROVE** on pass 1 for the original
  Print Ticket UI (desktop + mobile, dark + light, success + error, PNGs), and
  **APPROVE** on the follow-up pass for FORMAT + PDF (desktop + mobile, PDF
  selected, paper-light PDF rendered via `pdftoppm`); no findings.
- **A3 remains an owner/manual device check:** real iOS Safari export.
- **Checks:** lint / typecheck / test **388** (37 files; 20 in
  `exportScene.test.ts` + 2 in `pdf.test.ts`) / build / e2e **140 passed +
  7 skipped**. Screenshots `docs/screenshots/P3-01/` (desktop + mobile, dark +
  light, PNG and PDF selected, success, error, both exported PNGs, the PDF, and
  a `pdftoppm` render of it).
- **Code review (light, 2-pass cap per change):** original task pass 1
  **CHANGES-REQUIRED** → fixed the fit-cap payload/preload leak, empty-state
  focus, missing rotated/error tests, taint mapping, and busy lockout; pass 2
  **CHANGES-REQUIRED** → fixed the stuck busy trigger on mid-export unmount
  (+ e2e). Follow-up (higher res + PDF) pass 1 **CHANGES-REQUIRED** → fixed the
  blocker (detached Layer scene canvas was allocated at DPR; now pinned to 1×),
  the JPEG MIME guard, xref/width/height test coverage, and stale-error clearing;
  pass 2 **APPROVE**. No further passes (2-pass cap per change).
- **All-content scope fix (owner feedback, same PR #23):** the original 40 cm
  fit cap silently dropped an orphan pedal far from both boards. It was removed:
  all content now includes everything, and the pixel clamp (not a crop) handles
  extreme layouts. The “Far-off items were trimmed.” notice is gone.
- **Standard / HD (owner request, same PR #23):** Standard is now the default
  (32 px/cm at 1×, small file); HD is opt-in and uses the full iOS-safe budget
  (64 px/cm, area-capped). The output spec shows quality + PPI. HD text/scale
  bar physical size matches Standard (constant across fit-scale/quality).
  `design-reviewer` approved both passes; code review approved after the
  label-size and clamp-notice fixes.
- **Known limitation (reviewer nit, documented):** output PPI is raster density;
  catalog board images are 800 px masters, so a large catalog board is upscaled
  in a high-density export. Pedal images are below the ceiling at typical sizes;
  cleared high-resolution assets (P5-02) are the real fix.
- The live stage keeps working unchanged — export is an additive path.
