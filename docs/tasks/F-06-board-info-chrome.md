# F-06 — Board info readout + consistent board chrome

**Phase:** 2 · **Status:** in review — PR #<n> · **Model:** light (design-gated; escalate only for a blocker)

## Goal

Close the last gap in the board-selection experience (**P2-09**, Phase 2 **F-06**).
Every selected board already gets the same action bar (P2-05 + F-16: Color for
all boards; Edit/Delete for custom; catalog removal stays in the Picker). The
remaining gap is the **readout**: selecting a board shows only a floating action
bar, while a selected pedal gets the "Specimen Cover" info panel. This task adds
a board readout with brand, name, true footprint, finish (custom) and the board
image (catalog), on desktop and mobile, dark and light, in edit and read-only
share views. It is additive: no scene schema, share, catalog or dependency
change.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 (Phase 2) + §6
- `docs/tasks/P2-05-custom-board-creator.md` (board model + P2-09 follow-up)
- `docs/design.md` §Data model (`PlacedBoard`), §Canvas architecture
  (selection chrome), §Accessibility
- `docs/requirements.md` F3/F6
- `src/components/InfoPanel.tsx` (the pedal readout pattern to mirror)
- `src/canvas/BoardActionBar.tsx` (anchoring + roving-toolbar contract)
- `src/state/scene.ts` (`boardFootprint`, `boardDefinition`, `isCustomBoard`)

Read only the pointed sections.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/F-06-board-info/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: if this task needs one,
  **STOP** and report.
- Separate branch/worktree; **one PR**; no merge.

## Scope decision

- **In scope:** a board info readout for the selected board.
  - Catalog board: image (800 master), brand, name, true `width × depth`,
    "Catalog board" identity.
  - Custom board: brand/name (fallbacks), true `width × depth`, finish
    (`Matte`/`Brushed`/`Wood`/`Tolex`) and "Custom board" identity.
  - Units follow the app-wide `Settings.units`; a cm/in toggle is shown only if
    the approved design includes it (pedal panel precedent).
  - Read-only shares show the same readout with no edit controls.
  - Desktop rail / mobile sheet behaviour must not cover the selected board's
    action bar or the mobile tab bar.
- **Out of scope:** duplicating a board, moving catalog-board Delete onto the
  canvas, board renaming, tiered boards, any share-format change. Board action
  chrome already satisfies P2-09 (F-16) and is only verified, not redesigned.
- **Share decision:** **no change — share stays v5.** Selection is transient and
  never transported.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; same-origin
  images; minimal dependencies (justify any new one).
- **Design gate** (visibly rendered): designer proposal → **owner approval** →
  implement → ≤2 `design-reviewer` passes on real desktop + mobile (dark +
  light, before/after pixels) → fold findings.
- **Code review:** ≤1 light pass (≤2 only for high-risk / a blocker); reuse the
  reviewer session; the test suite is the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review allowance
  ≤300k; task hard cap ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, picker/canvas frame time,
  memory and share/export size; no regression beyond thresholds.
- **Docs update:** `/help` when the workflow changes; `/features` + `/changelog`
  always for a user-visible feature; record the `Docs:` status line and the
  F-19 QA impact map.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Restate the scope and executable acceptance criteria.
2. Run the design gate; record the approved direction.
3. Implement in the feature worktree.
4. Add/keep tests; run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
5. Run the touched E2E flow on desktop + mobile.
6. Rebase onto the verified post-merge `main`; re-run the affected checks.
7. Open exactly one PR with the standard sections and the **feature demo
   link**; do not merge.

## Acceptance (executable)

- Selecting a catalog board shows the board readout with the catalog `brand`,
  `name`, and true `width × depth` in the app's active units.
- Selecting a custom board shows its name (fallback "Custom board"), brand when
  present, true `width × depth`, and its finish label.
- The readout appears on desktop and mobile, in dark and light themes, and
  never overlaps the mobile tab bar or the board action bar.
- Read-only share views show the board readout with no edit affordance; the
  read-only switch rejects every mutator (existing guard).
- Clearing selection or selecting a pedal removes the board readout; selecting
  a pedestal or board keeps only one readout open.
- Switching `Settings.units` updates the displayed dimensions without a reload.
- Unit tests cover the board readout model (catalog/custom/fallback finish and
  dimensions); E2E covers select board → readout on desktop + mobile.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green (desktop + mobile).
- **Feature demo link** opens the final PR preview with a board + pedals; the
  steps select the board (selection is not share-encoded).
- **Before/after screenshots** embedded: same viewport/theme/state on base
  `main` and the PR preview, desktop + mobile, dark + light.
- Performance numbers recorded (bundle delta, canvas frame time, memory,
  share/export size); no regression beyond thresholds. Docs hub updated.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*` or other shared/coordinator-only files.
- One PR; no merge.

## Outcome (2026-11-17)

- **Direction:** “Title Block” — owner-approved. Desktop reuses the pedal
  “Specimen Cover” trailing push rail (framed plan plate + identity + true W×D +
  finish); mobile docks a passive identity strip in the bottom chrome; read-only
  shows the same details without edit controls.
- **Design review:** `design-reviewer` R1 approve-with-changes → R2
  approve-with-changes (≤2 cap). R1's read-only-mobile + board-overlay blockers
  were fixed; R2's remaining mobile-catalog blocker was resolved by docking the
  strip in the bottom chrome, which the **owner approved**. No R3 (cap); owner
  verifies the final pixels.
- **Code review:** light R1 changes-required (dead `data-board-readout`, stale
  mobile sheet lift, short action-bar reserve, masked E2E) → fixes → same-session
  R2 **approve**.
- **Share:** unchanged (**v5**); selection is transient.
- **Scope:** board action chrome already satisfied P2-09 (F-16); no duplication,
  catalog Delete or rename was added.
- **Checks:** lint (0 errors, 16 pre-existing warnings) / typecheck /
  **1,106 tests** / build **JS 361.61 kB gzip (+1.50), CSS 18.74 (+0.43)** /
  full E2E **468 passed + 16 skipped**.
- **Perf:** desktop board rail heap **37.8 MB**, canvas p50/p95
  **16.7/16.8 ms**; mobile heap **42.6 MB**, picker open **66 ms**, picker
  scroll **16.7/16.8 ms**; share **360 chars**; export estimate
  **2,044 × 1,383 px / ~2.5 MB** (unchanged scene data).
- **Docs hub:** `/help` (board readout step), `/features` (Board readout row),
  `/changelog` (17 Nov entry), shared footer date; feature map updated.

## Notes

- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit the rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the
  PR/session summary.
- This template is feature-only; catalog batches use
  `docs/tasks/P5-batch-template.md`.
