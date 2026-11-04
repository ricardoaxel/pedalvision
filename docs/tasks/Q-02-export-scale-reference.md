# Q-02: Export scale reference

**Phase:** Q (feature lane, Phase 1) · **Status:** done (merged 2026-11-04, PR #99, squash `e500e7e6`) · **Model:** light

## Goal

Make exported plans **printable and verifiable**. Two things must be true:

1. **A normal person can print the plan on normal paper.** A true-size page for a
   40–80 cm board does not fit A4/Letter; the useful default is a **fit-to-page
   PDF** that shows the whole plan on one sheet at a stated scale ratio.
2. **The printed plan is measurable.** The sheet carries a drafting bar and a
   printed `SCALE 1:N · PRINT AT 100%` reference, so any distance can be checked
   against the stated ratio.

The P3-01 "Print Ticket" export already draws a true-length
drafting bar (10 cm, or 5 cm on narrow content) with end ticks in the bottom
margin. Inspection of the current artifacts (`export-standard-dark.png`,
`export-light.png`, `pdf-paper-light.png`) and `src/canvas/exportStage.ts`
(`drawScaleBar`) shows three concrete gaps:

1. **The bar label is always `10 cm`, even when the app is set to inches.** The
   export ignores the app-wide `Settings.units` (P3-02), so an inch user gets a
   cm-only label. The fix makes the bar label unit-aware rather than printing
   both units (design review round 1: the duplicate `3.94 in` cost legibility
   for no extra value once the label follows the setting).
2. **The artifact never says how to print it at true scale.** A PNG is only 1:1
   when printed at its output PPI (e.g. 81 PPI Standard); a PDF page is true
   scale, but a print dialog can still "fit to page". Neither artifact states
   `1:1` / `print at 100%` / the PPI, so the bar cannot be trusted without
   guessing.
3. **The reference reads as a bare dimension (`10 cm`) rather than a scale
   reference.** There is no `SCALE` label, no inch equivalent and no indication
   that the bar is the thing to measure.

Nothing else about the exported artifact is wrong: the bar is drawn at exact
physical length (cm source of truth), sits in the existing 4 cm margin, and the
PDF page is exact cm→pt.

**Owner decision (2026-11-03, rework):** true-size PDFs are rarely printable at
home, so PDF gains a **Fit A4 (default) / Fit Letter / True size** layout. Fit
mode renders a paper-sized page: the plan is scaled into the sheet and the ruler,
ratio and caption are drawn at fixed paper size (`SCALE 1:2.5 · PRINT AT 100%`).
True size stays as the exact-cm option and warns when the page exceeds A4/Letter.
Small plans are never enlarged (fit scale capped at 1:1). PNG keeps the scale
reference and gains its intended PPI metadata (`pHYs`) so “actual size” works in
apps that honour it.

## Read first (context pack)

- `docs/progress.md` (current state)
- `docs/tasks/feature-template.md` and `docs/tasks/P3-01-export-png.md` (approved
  "Print Ticket" direction; scale bar was owner-approved there)
- `docs/design.md` §Canvas architecture → Export bullets (scope, padding, pixel
  clamp, scale bar)
- `docs/requirements.md` F9 / A3
- `src/lib/exportScene.ts`, `src/canvas/exportStage.ts`, `src/lib/pdf.ts`,
  `src/components/ExportPanel.tsx`, `src/lib/measurementHud.ts`,
  `src/state/settings.ts`
- `e2e/export.spec.ts`

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file,
  `docs/screenshots/Q-02-export-scale-reference/**`, and the docs-hub
  `/changelog` (+ `/features` only if the user-visible copy changes).
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are coordinator-only: if this task needs one, STOP
  and report.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm is the source of truth; the export stays detached from canvas zoom/pan.
- Do not change the approved export direction beyond the scale-reference fix:
  same bar, margin, scope, quality modes, pixel clamp, PNG theme, paper-light
  PDF page size.
- No new dependency. Keep text/line physical size constant across Standard/HD
  and fit-scale, as the existing `labelUnit` mechanism does.
- **Design gate:** the print-page layout + PDF control are design-affecting →
  `designer` proposal → owner approval → `design-reviewer` on the actual fit/true
  PDF + PNG (desktop + mobile, dark + light) plus before/after artifacts, ≤2
  passes. The already-approved "Print Ticket" look is preserved.
- **Code review:** export/PDF is high-risk → up to 2 light passes on the source
  diff only.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.
- **Performance:** record bundle delta, export file size, PPI and export render
  time before/after; no regression beyond thresholds.
- **Docs:** update `/changelog`; update `/features` only if the user-visible
  export copy changes. State `Docs: hub ... · map updated | n/a`.
- No PII, no analytics, no tracking.

## Steps

1. Create this task file before coding (done).
2. Reproduce the gap: export selected board and all content as PNG + PDF at
   desktop and mobile widths, dark + light; capture before artifacts.
3. Implement the scale-reference block (done in the first pass):
   - pure `src/lib/exportScale.ts` (bar length, active-unit label, print hint);
   - pass `Settings.units` into `renderExportFile`;
   - `0` / active-unit caps + `SCALE 1:1 · PRINT AT 100% (81 PPI)` caption.
4. **Rework — printable PDF:**
   - pure `src/lib/exportPage.ts`: A4/Letter sizes, auto orientation, fit scale
     (cap 1:1, never enlarge), ratio (`1:N`), page pixels at 200/300 DPI,
     content rect, printed bar length; unit tests.
   - renderer: page-mode stage at paper size; plan content scaled/centred with
     item/board labels kept at fixed paper size; ruler/caption/assumed-jack note
     drawn in page space at fixed paper size (≥7 pt); true-size path unchanged.
   - PDF: page-sized JPEG fills the exact paper MediaBox (`pdf.ts` unchanged
     for the true-size path); true-size keeps the exact-cm page.
   - PNG: insert a `pHYs` DPI chunk at the plan PPI (zero deps); file otherwise
     unchanged.
   - UI (`ExportPanel`): PDF-only `Fit A4` (default) / `Fit Letter` / `True
     size`; spec shows paper, ratio and page PPI; a true-size overflow notice.
5. Unit-test `exportPage`, PNG pHYs, and the unchanged PDF true-size path;
   extend `e2e/export.spec.ts` for fit A4/Letter MediaBox, the layout control,
   PNG pHYs, and the existing true-size/scale-reference regressions.
6. Run the checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
   pnpm e2e`.
7. Capture fit + true PDF and PNG artifacts (desktop + mobile, dark + light),
   run `design-reviewer` (≤2 passes), fold findings.
8. Light `code-review` (≤2 passes, high-risk); fold blockers/should-fixes.
9. Update docs hub (`/features`, `/changelog`, `/help`) + this task file +
   `docs/progress.md`/`docs/roadmap.md`; update PR #99 with before/after
   artifacts, ≤3 owner hints, review digest, performance numbers and the docs
   line. Do not merge.

## Acceptance (executable)

- **Fit PDF:** one A4 (default) or Letter page shows the whole plan; printing at
  100% yields the stated ratio; the ruler is drawn at the printed scale and the
  caption reads `SCALE 1:N · PRINT AT 100%`; page MediaBox is A4/Letter exactly.
- **True PDF:** still the exact-cm page; the panel warns when it exceeds the
  selected paper and points to Fit. The existing MediaBox test stays valid.
- **PNG:** keeps the `SCALE 1:1 · PRINT AT 100% (N PPI)` ruler; the file gains a
  `pHYs` chunk at the plan PPI; dimensions/theme/clamp/scope unchanged.
- Labels/annotations on the fit page are ≥~7 pt on paper, never clipped, and do
  not overlap the assumed-jack note. Small plans are never enlarged (1:1 max).
- Unit tests cover: fit scale/orientation/ratio, printed bar length, page pixels,
  PNG pHYs, true-size PDF unchanged.
- `e2e/export.spec.ts` asserts fit A4/Letter MediaBox, the layout control, PNG
  pHYs, and keeps the existing scale-reference/bar-length/true-size tests green.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
- Before/after artifacts captured at desktop + mobile, dark + light, PNG + PDF;
  `design-reviewer` verdict recorded.
- Performance numbers recorded (bundle delta, file size + PPI, export time);
  no regression beyond thresholds.
- No edits to catalog data/assets/tools or shared coordinator files.
- One PR; no merge.

## Notes

- **Direction:** the owner-approved **"Print Ticket"** surface from P3-01,
  extended with a print-layout control (owner decision 2026-11-03: fit-to-page
  is the practical print path; true size is the niche template option).
- **Baseline on `main` (`9c5d6dd0`):** 1004 unit tests, e2e 394 passed + 12
  skipped, JS 346.44 kB gzip, CSS 16.48 kB gzip.
- **Rework result (2026-11-03):** **1031 unit tests**, e2e **400 passed + 12
  skipped**, JS **349.03 kB gzip**, CSS **16.50 kB gzip**. Fit A4/Letter/True
  layouts, white print stock, PNG `pHYs`. Design `design-reviewer` R1
  **approve-with-changes** (true-size band too close to trim; 1:3.7 chip
  truncation) → R2 **approve** (both fixed, plus the image-less custom-card nit).
  Light `code-reviewer` R1 **changes-required** (HD label unit halved text;
  endpoint chips overflowed; tests/CRC gaps; dead fields; stale docs) → R2
  **approve**. PR #99.
- **Gap evidence:** current `drawScaleBar` hardcodes `${lengthCm} cm`, ignores
  `Settings.units`, and has no PPI/print hint; `ExportPanel` shows PPI only on
  screen, never in the artifact.
- **Defaults (owner approved in-session 2026-11-03):** A4 default + Letter
  option (Letter is the initial default when the app is in inches); PDF default
  Fit A4; never enlarge small plans; PNG gets DPI metadata; white print stock;
  assumed-jack note kept on the sheet.
- **Perf (rework):** bundle **JS +2.59 kB gz / CSS +0.02 kB gz** vs main; Fit A4
  Standard 115 ms / 220 kB, HD 172 ms / 391 kB; Fit Letter 124 ms / 207 kB,
  HD 166 ms / 381 kB; True Standard 110 ms / 181 kB, HD 260 ms / 626 kB; page
  rasters A4 200 DPI ≈ 3.9 MP, 300 DPI ≈ 8.7 MP (under the 16.7 MP cap).
- **Label/endpoint sizing:** page labels use `pageLabelUnit` (32/pxPerCm ×
  printScale) so 8.9 pt stays 8.9 pt in Standard and HD; endpoint chips grow by
  `1/printScale` so AMP/INSTR tags print at true paper size. Item labels are
  omitted below ~1:3 (never ellipsis), except image-less custom/fallback items
  keep a 7 pt identity.
- **Out of scope:** tiled/poster 1:1 printing, new file formats, changing export
  scope/bounds/clamp, or altering the approved palette/typography.
