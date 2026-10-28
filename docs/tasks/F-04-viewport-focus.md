# F-04 — Viewport focus (frame a board, the used area, and every loaded scene)

**Phase:** 1 · **Status:** in progress — implementation + checks complete; PR pending · **Model:** light

## Goal

Make the canvas easy to find again. Today the viewport is session-only and never
changes on its own, so a scene can load off-screen or at a stale pan/zoom (the
"correct the x/y offset" defect). F-04 adds three view-only behaviours:

1. **Frame one board** — centre and zoom the selected board (+ its attached
   pedals and in-scope connectors) in the usable canvas area.
2. **Frame the used area** — centre and zoom every placed object in the current
   scene (boards, attached + loose items, endpoints, in-scope cable curves).
3. **Frame on scene load** — boot, scene switch/new, share-preview entry/exit and
   save-a-copy all land with the incoming document framed instead of inheriting
   the previous transform.

Animations are deliberately **out of scope** (F-05): every focus is an instant
stage-transform jump. No scene, catalog, codec, share or export data changes.

Roadmap item **F-04** (Phase 1 — core correctness and polish).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/requirements.md` — **F1** (pan/zoom), **F2** (cm is truth), **A1**
  (resize never moves objects)
- `docs/design.md` — §Canvas architecture + §Export scope (content-bounds rules)
- `docs/features/README.md` — editable inventory/workflow/impact/E2E rows
- `src/state/viewport.ts`, `src/lib/geometry.ts`
- `src/lib/exportScene.ts` (`resolveExportPlan`, `contentBoundsCm`, `unionRects`,
  `boardAabbCm` — reuse the bounds, do not duplicate the geometry)
- `src/canvas/Stage.tsx`, `src/state/scene.ts` (`boardWorldCorners`,
  `itemWorldCorners`, `itemWorldOrigin`)
- `src/components/ScenePanel.tsx`, `src/state/library.ts`
  (`boot`/`switchScene`/`newScene`/`deleteScene`/`enterPreview`/
  `savePreviewAsCopy`/`exitPreview`), `src/state/readOnly.ts`
- `src/state/selection.ts`, `src/canvas/BoardActionBar.tsx`,
  `src/components/ScaleReadout.tsx`, `src/canvas/useMeasureShortcuts.ts`,
  `src/App.tsx`, `src/index.css`, `src/styles/tokens.css`

Read only these pointed files/sections; do not read whole docs.

## Behaviour contract (functional, not visual)

- **Used area** = the current scene's total content AABB in world cm, matching
  the existing **all-content** export scope: every board's rotated AABB + every
  item's rotated AABB + endpoint chips + the exact cubic cable curves. Reuse
  `resolveExportPlan({ scope: "all" })` → `contentBoundsCm`; never write a second
  bounds implementation. An empty scene has no used area.
- **Board target** = the board's AABB + its attached items + in-scope
  endpoints/cables, matching **selected-board** export scope via
  `resolveExportPlan({ scope: "board", boardUid })` → `contentBoundsCm`. Only a
  **board** selection targets a board; an item/cable/endpoint selection frames
  the used area (owner-approved contextual rule: deselect the board to get
  `frame all`).
- **Focus transform:** fit `contentBoundsCm` inside the **usable canvas area**
  (stage size minus safe insets for the scene plate/toolbar, scale strip, mobile
  dock + info peek, and the bottom sheet), with a screen-space breathing margin;
  centre it; clamp zoom to `MIN_SCALE..MAX_SCALE`; never scale objects (stage
  transform only).
- **Safe insets are view state, not scene data.** Use the existing measured
  metrics (`useViewport().size`, `usePanelMetrics().sheetHeight`, `useIsMobile`)
  and token constants; do not add a second persisted setting.
- **Empty / degenerate target:** an empty scene is a no-op for the explicit
  command (disabled trigger or quiet inline state, never a toast — N8). On a
  load with no content, reset to `DEFAULT_VIEWPORT` so the sheet is not stranded
  off-screen. A zero-width/height target must not divide by zero or explode the
  scale.
- **Scene-load triggers:** `ready` false→true (boot), `activeId` change
  (switch/new/delete-active/save-a-copy), `readOnly` false↔true (share preview
  enter/exit). Do **not** re-frame on ordinary edits, undo/redo, autosave,
  selection, panning or zooming. Deduplicate the double signal from
  save-a-copy (`activeId` + `readOnly`).
- **Explicit focus** must not change selection, history, autosave, scene arrays,
  the share URL or export output. It is view-only.
- **Zoom policy (owner-approved 2026-10-28):** explicit focus may magnify or
  zoom out; **load framing fits but never zooms past 1×** (a small scene lands
  at a comfortable 1:1 rather than an extreme magnification).
- **Read-only shares:** framing is allowed (view-only) and the trigger remains
  available; no edit affordances.
- **Keyboard:** the focus command is keyboard reachable and has a documented
  shortcut (proposed `F`; ignored in text fields, while composing, and while a
  modal owns focus, same guard pattern as `useMeasureShortcuts`). No shortcut if
  the owner rejects it.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/F-04/**`; update only the editable rows in
  `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- **Coordinator-only:** `docs/progress.md`, `docs/roadmap.md`, `AGENTS.md`,
  templates, the feature-map prose rules and shared config. If this task needs
  one, **STOP** and report — it becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- **cm is the source of truth.** Focus computes world-cm bounds, then a stage
  transform; no object is rescaled, no cm geometry changes.
- **No data-model changes.** Do not touch `SceneDocument`, `Scene`, share v2,
  export scope, capacity or the catalog. The viewport is not persisted.
- **No animations / easing / tweens** — F-05 owns motion. No new animation
  utility or dependency.
- **Minimal dependencies:** zero new runtime deps; plain math + existing React/
  Konva only.
- **Design gate:** design-affecting (new visible affordance + auto-frame
  behaviour). Run the `designer` first, get **owner approval of the direction
  before implementation**, then ≤2 `design-reviewer` passes on desktop + mobile,
  dark + light; fold findings.
- **Code review:** ≤1 light pass on the source-only diff; tests are the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share/export size against `main`; no regression. Focus math runs only on
  demand and on document load — never per frame.
- **Docs update:** editable rows of the public feature catalog / F-19 QA map
  (`docs/features/README.md`) only.
- **No total-count E2E assertions:** filter a stable item/brand.

## Design direction (gate)

- **Status:** **owner-approved 2026-10-28** — **“Scope Frame”** (small extension
  of the approved “Blueprint” / Margin Rule direction; no new palette).
- **Proposal in one line:** one contextual **`frame board` / `frame all`**
  instrument inside the bottom **Margin Rule** strip, immediately after the
  `view W × H` readout (desktop text + 12 px corner-bracket glyph; mobile short
  `board` / `all`), keyboard `F`, framed-tint state, empty state disabled, no
  animation. It is a small extension of the approved “Blueprint” / Margin Rule
  direction — **no new palette**.
- **Why:** framing is a view question, so it belongs with the view readout, not
  the already-crowded edit toolbar. The label always names its target, which is
  the anti-ambiguity device for one contextual command.
- **Owner decisions:** (1) explicit focus may magnify; load framing caps at 1×;
  (2) contextual-only whole-scene framing (deselect the board); no second path.
- **Responsive implementation detail:** the F-04 control makes the left readout
  cluster wider. When the desktop strip is narrower than 1000 px (the info rail
  is open at 1024/1280), the **F-03 centered true-length bar is hidden** via a
  container query so the readout + frame control never collide; the view/grid
  readout stays. The bar is unchanged at normal desktop widths and in the
  mobile two-row layout. Mobile frame control is a **44 px** target; the mobile
  strip is 66 px and the camera safe rect reserves **150 px** bottom (incl. the
  info peek).
- **Design-reviewer pass 1 (approve-with-changes):** collision at 1024/1280
  with the info rail open (fixed by the narrow-strip rule); mobile hit target
  (raised to 44 px); disabled light (measured 5.4:1 — kept); the “frame rule /
  viewport tint” findings refer to the **existing selected-board Transformer**
  and the **F-03 scale bar**, not F-04 (the framed cue is the chip, as
  approved); scene-switch evidence improved.
- **Design-reviewer pass 2 (approve-with-changes):** strip fix confirmed; the
  remaining blocker was evidence: the small-scene still was centred at the
  owner-approved **1× load cap**, not magnified. Added a large-content scene
  switch that fits at **scale 0.868 / view 414.7 × 251.7 cm**, plus a 4-frame
  montage and a re-exported GIF tail. **Hard cap (2) reached; no third pass.**
  Open findings handed to the owner: mobile strip height (66 px, the cost of the
  44 px target), light active-chip weight, the 1280-with-rail bar hidden/void,
  the mobile short labels (`all`/`board`), and disabled vs neutral affordance.
- The reviewer gate is limited to the rendered result; the designer remains the
  design authority.

## Steps

1. Restate the scope + executable acceptance criteria; record the design
   direction and owner approval.
2. Implement a **pure** bounds→viewport helper (`src/lib/viewportFocus.ts` or
   equivalent): content rect + stage size + safe insets → `{ scale, x, y }`.
   Reuse `resolveExportPlan(...).contentBoundsCm` for both scope kinds.
3. Add the minimum viewport/stage wiring (an action/hook on `state/viewport.ts`
   + `Stage.tsx`) so focus never mutates the scene.
4. Add the approved affordance + keyboard shortcut for desktop and mobile.
5. Add document-load framing (boot/switch/new/preview/save-copy) in a small
   hook; defer until the stage has a size; deduplicate signals; never frame on
   edits.
6. Add unit tests (fit math: landscape/portrait, padding, clamps, negative world
   coords, rotated board, degenerate/empty, safe insets, idempotence) and E2E
   (`e2e/viewport-focus.spec.ts`, desktop + mobile).
7. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; run the touched
   E2E on desktop + mobile; record performance numbers.
8. Design-reviewer ≤2 passes (desktop + mobile, dark + light), fold findings.
9. One light code-review pass; re-run the checks.
10. Open **one** PR with all standard sections, feature demo link and
    before/after screenshots; **do not merge**.

## Acceptance (executable)

- A pure unit test proves `fitBoundsToViewport` centres a known rect in the safe
  area, fits landscape + portrait content, respects the zoom clamp, handles
  negative world coordinates and rotated boards, and is a no-op/safe reset for
  empty or zero-size bounds.
- Unit tests prove board focus bounds equal the selected-board export content
  bounds, and used-area bounds equal the all-content export content bounds.
- **Board focus:** select a catalog board and a custom board; invoking the
  approved command puts the board's content centre at the safe-area centre
  (tolerance ≤1 px) and its content inside the usable area; another board is
  not part of the target bounds.
- **Used-area focus:** with content spread over several boards + a loose pedal,
  invoking the command frames all of it (centre + fit) and nothing is off-screen.
- **Scene-switch framing:** scene A (content far left/up) → scene B (content far
  right/down): switching scenes sets a new stage `x`/`y` (no stale transform)
  and B's content centre is at the safe-area centre; same for a share preview
  opening and `Save a copy`.
- **Empty scene:** focusing is a safe no-op (disabled/quiet inline state); a
  scene load with no content resets to the default transform; no toast.
- **No data side effects:** focus does not change `data-boards`, `data-items`,
  `data-cables`, selection, undo/redo depth, `updatedAt`, or the share hash; no
  autosave is scheduled.
- **View-only:** read-only share can frame; no edit affordance appears.
- Desktop + mobile, dark + light: the affordance is reachable, 44 px touch
  target, keyboard focus-visible, Esc/modals unaffected; no layout overflow at
  1024/1280/mobile widths.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E green on desktop + mobile.
- Performance recorded: main-JS gzip delta (target ≤ +2 kB), canvas frame time
  within noise, memory unchanged, share/export size unchanged; no regression
  beyond thresholds.
- **Feature demo link:** PR-preview URL + exact steps (viewport state is not
  shareable), desktop + mobile.
- **Before/after screenshots:** same viewport/theme/state on base `main` and the
  PR preview; desktop + mobile; video/GIF of the scene-switch framing.
- `docs/features/README.md`: feature inventory row (F-04), workflow row
  (boot/pan/zoom/scene load), change-impact row and E2E suite-map row updated.
- No catalog/shared edits; one PR; no merge.

## Verification evidence

- `pnpm lint` clean (only the 2 pre-existing `tools/asset-pipeline/analyze.ts`
  unused-variable warnings).
- `pnpm typecheck` clean.
- `pnpm test` **888 passed** (97 files), including 16 new `viewportFocus` tests.
- `pnpm build` clean. Main JS **309.59 → 311.56 kB gzip** (**+1.97 kB**), CSS
  **13.05 → 13.16 kB gzip** (**+0.11 kB**); within the ≤ +2 kB target.
- **E2E:** `viewport-focus.spec.ts` **14/14** (desktop + mobile); the six-spec
  touched suite (`measurement-hud`, `scenes`, `smoke`, `share`, `first-run`)
  **89 passed / 4 skipped** (1 worker); `export.spec.ts` **21 passed / 1
  skipped** (it hard-coded the default boot viewport, which load framing
  changes; the helper is now transform-derived). A single `smoke` case flaked
  once under 4-worker parallelism and passed alone + in the serial run (no
  product change). Deferred to post-merge: `selection.spec.ts`,
  `touch.spec.ts`, `info-panel.spec.ts`.
- **Performance (1440×900, fixed board + pedal, base vs branch):** 1 s
  wheel-zoom **61–62 fps both**; JS heap **10.1 MB both**; share link
  **358–360 chars** (same range); all-content Standard PNG **2,771,550 bytes**
  on both. Focus math runs only on command / document load (never per frame);
  the large scene-switch fit took one bounds pass at scale **0.868**.
- **Screenshots:** `docs/screenshots/F-04/before/**` and
  `docs/screenshots/F-04/after/**` (desktop 1440/1280/1024 + mobile 390, dark +
  light, empty / panned / framed all / framed board / scene-switched /
  info-rail), `docs/screenshots/F-04/scene-switch.gif` and
  `scene-switch-frames.png`.
- **Feature demo link:** the deployed PR-preview URL + exact steps are added to
  the PR (viewport state is not shareable).
- **Checks run on this branch:** `pnpm lint && pnpm typecheck && pnpm test &&
  pnpm build`; `pnpm exec playwright test` for the six named specs.
- **Code review (light, one pass):** **changes-required** with 5 findings, all
  fixed in a second commit: (1) direct E2E coverage for save-copy, preview
  enter/exit and no-frame-on-edit, plus a `data-focus-epoch` dedup counter;
  (2) removed the unused `minScale` option; (3) custom-pedal edits now clear
  the framed tint; (4) removed the dead `FOCUS_LOAD_MAX_SCALE` import; (5)
  tightened the centre tolerance to <1 px and anchored the safe rect to the
  real `.app-toolbar`/`.scale-strip` DOM. No second review pass (low-risk
  feature; the green test suite is the re-check).

## Notes

- **F-05 boundary:** no motion now. A future F-05 pass may animate this transform
  without changing the architecture (the focus math returns a target viewport).
- The existing export content-bounds code is the single source of truth for
  "what is in scope"; focus must not fork it.
- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit shared rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the
  PR/session summary.
