# Q-02: Export scale reference

**Phase:** Q (feature lane, Phase 1) · **Status:** in review — PR #99 · **Model:** light

## Goal

Make the exported PNG/PDF scale reference unambiguous so a printed plan can be
measured and verified. The P3-01 "Print Ticket" export already draws a true-length
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
PDF page is exact cm→pt. The fix is a scale-reference block, not a new export
direction.

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
- **Design gate:** small fix inside the approved "Print Ticket" direction →
  `design-reviewer` on the actual exported PNG/PDF (desktop + mobile, dark +
  light) plus before/after artifacts, ≤2 passes.
- **Code review:** ≤1 light pass on the source diff only.
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
3. Implement the minimal scale-reference block:
   - a pure helper (e.g. `src/lib/exportScale.ts`) that returns the bar length,
     the active-unit label, and the format-specific print hint
     (`1:1 · PRINT AT 100% (81 PPI)` for PNG; `1:1 · PRINT AT 100%` for PDF);
     the bar label itself is the conversion surface (the app's unit setting),
     not a duplicate both-unit string;
   - pass `Settings.units` into `renderExportFile`;
   - draw the label as `SCALE` + bar value + conversion + print hint, keeping
     the existing true-length bar and ticks.
4. Unit-test the helper (length selection, unit conversion, PPI rounding,
   format hint); extend `e2e/export.spec.ts` to prove the bar/caption is drawn
   and its length is physically exact at Standard and HD.
5. Run the checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
   pnpm e2e`.
6. Capture after artifacts (desktop + mobile, dark + light, PNG + PDF), run
   `design-reviewer` (≤2 passes), fold findings.
7. Light `code-review` on the source diff; fold blockers/should-fixes.
8. Update docs hub + this task file + `docs/progress.md`/`docs/roadmap.md`; open
   exactly one PR with before/after artifacts, ≤3 owner hints, review digest,
   performance numbers and the docs line. Do not merge.

## Acceptance (executable)

- The exported PNG and PDF bottom margin contains a scale reference that:
  - draws a true-length bar with end ticks at `lengthCm × pxPerCm` (10 cm, or
    5 cm when content is narrower than 40 cm);
  - labels the bar in the **active display unit** (`10 cm`, or `3.94 in` when
    the app is in inches; `5 cm` / `1.97 in` on narrow content);
  - states `SCALE`, `1:1`, and the print condition **first**: PNG
    `PRINT AT 100% (81 PPI)` (plan's rounded `outputPpi` in parentheses); PDF
    `PRINT AT 100%` (the page itself is true scale).
- The label is visually subordinate to the drawing and fits inside the existing
  4 cm bottom margin at Standard and HD, dark/light PNG and paper-light PDF; no
  overlap with the board/content or the assumed-jack note.
- `PNG` output dimensions, PPI, clamp behaviour, scope bounds, theme and
  `PDF` MediaBox/page size are unchanged from `main`.
- Unit tests cover: 10 cm vs 5 cm selection, cm↔in conversion (10 cm = 3.94 in,
  5 cm = 1.97 in), PPI rounding, PNG vs PDF hint, active unit follows settings.
- `e2e/export.spec.ts` asserts the exported artifact includes ink in the scale
  reference band and that the drawn bar length matches the physical length for
  Standard and HD; existing export tests stay green.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
- Before/after artifacts captured at desktop + mobile, dark + light, PNG + PDF;
  `design-reviewer` verdict recorded.
- Performance numbers recorded (bundle delta, file size + PPI, export time);
  no regression beyond thresholds.
- No edits to catalog data/assets/tools or shared coordinator files.
- One PR; no merge.

## Notes

- **Direction:** remains the owner-approved **"Print Ticket"** surface from
  P3-01; this is a scale-reference fix only (owner-approved bar kept).
- **Baseline on `main` (`9c5d6dd0`):** 1004 unit tests, e2e 394 passed + 12
  skipped, JS 346.44 kB gzip, CSS 16.48 kB gzip.
- **Result:** 1012 unit tests, e2e 398 passed + 12 skipped, JS 346.65 kB gzip,
  CSS 16.48 kB gzip. Design `design-reviewer` R2 **approve**; light
  `code-reviewer` changes-required → fixed (no second pass). PR #99.
- **Gap evidence:** current `drawScaleBar` hardcodes `${lengthCm} cm`, ignores
  `Settings.units`, and has no PPI/print hint; `ExportPanel` shows PPI only on
  screen, never in the artifact.
- **Out of scope:** exporter scope/bounds changes, new formats, print layout,
  moving the bar, or changing the approved typography/palette.
