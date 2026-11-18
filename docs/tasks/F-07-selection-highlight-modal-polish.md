# F-07 — Selection / highlight / modal polish

**Phase:** 2 · **Status:** in progress · **Model:** light (design-gated; escalate only for a blocker)

## Goal

Make every selectable canvas object preview its selection the same way, and
finish the popover focus contract, without changing the approved "Blueprint"
visual system. Today a pedal shows a neutral corner-bracket hover while boards,
cables and endpoints are silent; the Patch popover neither moves focus in nor
returns it on Escape. F-07 closes those gaps with one bounded, additive polish
pass. No scene/document/share schema change (**share stays v5**), no catalog
edits, no new runtime dependencies.

Roadmap: `docs/tasks/feature-roadmap-proposal.md` §2 Phase 2 → **F-07
selection/highlight/modal polish**.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 (Phase 2) + §6 (cross-feature requirements)
- `docs/design.md` §Canvas architecture (SelectionLayer / hover / selection halo) + §Accessibility
- `docs/requirements.md` → F6 (selection, hover highlight, touch targets) and F11 (responsive chrome)

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/F-07-selection-highlight-modal-polish/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: this task needs none. If that
  changes, **STOP** and report.
- Separate branch/worktree; **one PR**; no merge.

## Design direction — "Construction Line" (designer proposal; **owner-approved 2026-11-17**)

Hover is the faint **construction line** (neutral ink, ≤2 px, no fill, no
handles, instant); selection is the **committed line** (accent + knockout halo +
handles). One preview ink (`theme.hoverOutline` / `--color-ink`) across all
object types; the silhouette varies by object. No new colors or tokens; only
three metrics (`CABLE.hoverHaloPx = 6`, `CABLE.hoverHaloOpacity = 0.5`,
`BOARD_HOVER_ARM_PX = 18`). Hover is always quieter than selection; an object
that is both hovered and selected shows **selection only**.

**Owner answers (2026-11-17):** read-only share → **hover follows
selectability** (pedals/boards hover, cables/endpoints don't); cable hover →
**neutral 50 % sleeve**.

| Object | Hover | Selected (unchanged) |
|---|---|---|
| Pedal | Existing corner brackets (unchanged) | Accent Transformer + knockout halo |
| Board | Same bracket family, longer arms (18 px) / gap 8, outside the footprint | Accent Transformer + board mark |
| Cable | Neutral sleeve: same path, 6 px, `hoverOutline`, opacity 0.5; trace/arrow ink unchanged | Accent halo 9 px + wider trace |
| Endpoint | 1.5 px `hoverOutline` border on the existing pill, canvas knockout | 2 px accent border + inner accent inset |

**Guards:** hover is desktop/pointer only (no coarse-pointer / sticky touch
hover); never for the selected object; suppressed while dragging/connecting or
while a board is being dragged; read-only shows hover only for objects that are
selectable there (pedals/boards — **no** cable/endpoint hover, since they are
`listening={false}`). Hover must **not** feed the incident-cable dim focus
except for `kind: "item"`.

**Popover / modal polish:** bring `EndpointControls` to the SceneColorControl
contract — focus the first enabled control on open, Escape closes and returns
focus to the Patch trigger (scoped so it does not also disarm placement or
cancel a connect drag), outside pointer-down closes (return focus only if focus
was inside), Tab-out closes (non-modal, no trap, **no** `aria-modal`), and the
popover is `aria-labelledby`. Add the missing `aria-controls` on the
SceneColorControl and cable-ink popovers. Add a `:has(input:focus-visible)`
accent ring on the Patch show-toggle. No visual change to the non-modal docks.

**Do / Don't:** do keep one preview ink and let silhouettes differ; do destroy
the hover affordance the same frame selection appears; do suppress hover during
gestures. Don't tint hover with the accent; don't thicken the cable trace on
hover; don't trap focus in the Patch popover.

**Resolved:** read-only hover follows selectability; cable hover uses the
neutral 50 % sleeve.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; screen-constant
  hover metrics (counter-scaled); same-origin images; minimal dependencies.
- **Design gate:** designer proposal → **owner approval** → ≤2 `design-reviewer`
  passes on desktop + mobile (dark + light) → fold findings.
- **Code review:** ≤1 light pass (≤2 only for high-risk / a blocker); reuse the
  reviewer session; the test suite is the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review allowance
  ≤300k; task hard cap ≤1.1M; 6 h active.
- 44 px touch targets; visible focus states; WCAG AA contrast dark + light;
  reduced motion respected; read-only views never look editable.
- **Performance guardrail:** record bundle delta, picker/canvas frame time, memory
  and share/export size; no regression beyond thresholds.
- **Docs update:** if the F-19 trigger applies, update `/features` + `/changelog`
  (and `/help` when the workflow changes) and the F-19 QA impact map; state
  `Docs: hub <pages> | n/a — <reason> · map updated | n/a`.
- **No total-count E2E assertions:** filter a stable item/brand.

## Steps

1. Record owner approval of the direction + the two open answers.
2. Capture before artifacts (desktop 1280 + mobile 390/375, dark + light):
   pedal/board/cable/endpoint hover, selection, Patch popover.
3. Implement the hover target model + per-object hover rendering + popover focus.
4. Run the design gate (`design-reviewer`, ≤2) on before/after pixels.
5. Add/keep tests; run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
6. Run the touched E2E flows on desktop + mobile.
7. Rebase onto the verified post-merge `main`; re-run affected checks.
8. Open exactly one PR with the standard sections + feature demo link; do not merge.

## Acceptance (executable)

- Hovering a pedal, board, cable and endpoint shows the §2 treatment on desktop,
  dark + light; hovering the selected object shows no preview.
- Hovering a pedal on a board shows pedal brackets only; hovering a pedal dims
  non-incident cables exactly as today; hovering a cable/endpoint dims no cables.
- Hover metrics stay ~screen-constant at 25 %, 100 % and 400 % zoom; board
  brackets stay clamped on a small deck.
- No hover artifact appears after a tap/drag at 390 px; tap selection unchanged.
- Patch popover: focus lands on the first enabled control on open; Escape closes
  and returns focus to the trigger; Escape while placement is armed closes only
  the popover (placement stays armed); outside tap closes; Tab-out closes; no
  focus trap / `aria-modal`; `aria-controls` resolves on Patch, SceneColor and
  cable-ink triggers.
- Read-only share: pedal/board hover previews only; no cable/endpoint hover; no
  handles/accent; the view still reads non-editable.
- Reduced motion: hover appears/disappears with no tween.
- Unit tests for the hover-target transitions and the item-only dim-focus rule;
  Playwright hover + popover-focus coverage (desktop dark+light, 390 px mobile).
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- **Feature demo link** opens the final PR preview with the feature applied,
  desktop + mobile.
- **Before/after screenshots** embedded for every visible change, same
  viewport/theme/state on base `main` and the PR preview, desktop + mobile.
- Performance numbers recorded; no regression beyond thresholds.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*` or other shared/coordinator-only files.
- One PR; no merge.

## Notes

- **Share decision:** unchanged (**v5**) — hover is transient and never
  transported; no scene/document field is added.
- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit the rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the
  PR/session summary.

## Outcome (2026-11-17)

- **Direction:** “Construction Line” — owner-approved. Hover is the neutral
  construction line (pedal/board corner brackets, cable 50 % sleeve, endpoint
  2 px neutral border); selection stays the only accent. Owner chose read-only
  hover = follows selectability and the neutral cable sleeve.
- **Design review:** `design-reviewer` pass 1 approve-with-changes (blockers:
  cable sleeve hidden behind the halo, endpoint ring not demonstrated, focus
  ring evidence missing) → fixes (sleeve above the halo, 2 px endpoint ring,
  keyboard-focus capture) → pass 2 **approve** (≤2 cap; remaining items are
  pre-existing nits).
- **Code review:** light pass 1 **changes-required** (hover not suppressed during
  gestures; E2E coverage gaps: dim focus, read-only, selected-object, zoom,
  outside/Tab-out, `aria-controls`) → fixes: `isCanvasGestureActive()` guard in
  all four hover handlers, gesture-start/stale-target clearing in `Stage`,
  `data-cable-dim-focus`, deferred focus return after an outside tap, conditional
  `aria-controls`, hoisted `useCoarsePointer`, plus the coverage tests. No second
  full pass (simple fixes; the test suite is the re-check). Also fixed a real
  bug found while testing: moving from a pedal to its board body never re-fired
  the board group’s `mouseenter`, so the board preview now also runs on a guarded
  `mousemove`.
- **Share:** unchanged (**v5**); hover is transient and never transported.
- **Checks:** lint (0 errors, 16 pre-existing warnings) / typecheck / **1,107
  tests** / build **JS 359.54 kB gzip (+1.07 vs main 358.47), CSS 18.81
  (unchanged)** / full E2E **474 passed + 24 skipped**, with the two known
  flakes (`board-info` read-only share passed 3/3 alone; `viewport-focus`
  double-click is pre-existing — baseline 8/10 vs F-07 3/5 on repeat, passed on
  re-run).
- **Perf:** desktop heap **28 MB**; hover-sweep canvas p50/p95 **16.7/16.8 ms**;
  share/export unchanged (no scene data change).
- **Docs:** `/changelog` (Hover previews & Patch focus), `/features` (Selection &
  hover row); `docs/features/README.md` F6 row and `docs/design.md` canvas
  architecture updated.
