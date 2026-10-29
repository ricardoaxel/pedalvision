# F-05 — Motion system (panels, item add/remove/duplicate, scene switch)

**Phase:** 2 · **Status:** in review — PR #81 (CI green) · **Model:** light

## Goal

Give the planner a small, consistent motion language instead of today's mix of
instant swaps and two one-off CSS fades. Motion is feedback, not decoration: it
makes a panel feel like it opened *from* its trigger, makes an added or removed
part legible as a change to the board, and makes a scene switch read as the
camera moving to a new sheet rather than a jarring teleport.

Scope (owner-directed, 2026-10-28):

1. **Panel/modal open-close** — picker modal/sheet, docked panels (scene,
   export, share, cable schedule), mobile info sheet expand/collapse.
2. **Item add/remove/duplicate** — a placed pedal/board entering, leaving or
   being duplicated on the canvas.
3. **Scene-switch transitions** — the incoming document's viewport/first paint.

Non-goals: no scroll/parallax, no decorative loops, no animation of cm geometry,
no new runtime dependency, no catalog/shared-file changes.

Roadmap item **F-05** (Phase 2 — data model and differentiators; the F-04 task
explicitly deferred motion to F-05).

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/tasks/F-04-viewport-focus.md` (the instant focus/load-framing contract
  F-05 may animate without changing)
- `docs/design.md` — §Canvas architecture (stage transform only; objects never
  rescaled) + §Responsive approach
- `docs/features/README.md` — editable inventory/workflow/impact/E2E rows
- `src/styles/tokens.css`, `src/index.css` (existing motion: `storage-note-in`,
  `share-cue-in`, the info-expand chevron transition)
- `src/App.tsx`, `src/components/Picker.tsx`, `ScenePanel.tsx`,
  `ExportPanel.tsx`, `SharePanel.tsx`, `CableSchedulePanel.tsx`,
  `InfoPanel.tsx`, `StorageNotice.tsx`
- `src/canvas/Stage.tsx`, `BoardLayer.tsx`, `LooseItemLayer.tsx`,
  `PedalNode.tsx`, `BoardNode.tsx`, `SelectionLayer.tsx`
- `src/state/viewport.ts`, `src/state/focus.ts`,
  `src/canvas/useSceneAutoFrame.ts`, `src/state/library.ts`,
  `src/state/scene.ts` (`addItem`/`duplicateItem`/`removeItem`)

Read only these pointed files/sections; do not read whole docs.

## Behaviour contract (functional, not visual)

- **One vocabulary.** Durations, easings and travel distances live in
  `tokens.css` (CSS custom properties) and in one tiny JS mirror for canvas
  motion (Konva cannot read CSS variables). No component hard-codes a duration
  or easing. The existing one-off fades are re-expressed with the tokens.
- **`prefers-reduced-motion: reduce` is a hard off switch.** Every transition,
  animation and JS tween resolves to an instant state change (0 ms), including
  canvas add/remove/duplicate and scene-switch framing. The app must remain
  functionally identical and visually settled at the end state.
- **No layout shift.** Enter/exit motion must not change layout, shift the
  document flow, resize chrome, or move a placed object's stored cm geometry.
  Panels animate opacity + a small transform only; the canvas animates node
  presentation only (never `x`/`y`/rotation persistence for items or boards).
- **Panel open/close.** Desktop docked panels and the picker modal animate in
  and out from a defined anchor; mobile sheets rise/fall. Exit motion must not
  delay or swallow the close action, focus return, Escape, outside-click or the
  read-only contract. A close during motion still returns focus to the trigger.
- **Item add / duplicate.** A newly placed (or duplicated) item becomes legible
  without changing its final position/rotation/z. A duplicate is distinguishable
  from an existing item (e.g. one short emphasis, not a moving target).
- **Item remove.** The removal is legible when it is an explicit user action.
  Data removal (store/autosave/undo/history/share semantics) stays synchronous;
  any exit visual is a transient ghost, never a delayed mutation.
- **Scene switch.** Boot, scene switch/new, share-preview enter/exit and
  save-a-copy keep the F-04 contract: the incoming document is framed, load
  framing caps at 1×, and no ordinary edit re-frames. Any camera transition is
  interruptible by user pan/zoom and never runs per frame after it settles.
- **Read-only shares.** The same non-blocking motion is allowed; no edit
  affordance appears and no mutator runs.
- **Mobile/touch.** 44 px targets and touch-action behaviour are unchanged;
  sheets remain dismissible during/after motion; no motion flicker on resize or
  keyboard opening.
- **Performance.** 60 fps target; motion must be compositor-friendly where
  possible (transform/opacity); no per-frame React state churn on the whole
  stage; one short canvas tween at most for add/remove.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file and
  `docs/screenshots/F-05/**`; update only the editable rows in
  `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- **Coordinator-only:** `docs/progress.md`, `docs/roadmap.md`, `AGENTS.md`,
  templates, the feature-map prose rules and shared config (incl.
  `playwright.config.ts`). If this task needs one, **STOP** and report — it
  becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- **cm is the source of truth.** Motion never rescales objects or changes stored
  geometry; only presentational opacity/transform (and a transient ghost) move.
- **No data-model changes.** Do not touch `SceneDocument`, `Scene`, share v2,
  export scope, capacity or the catalog. Viewport stays session-only.
- **Minimal dependencies:** zero new runtime deps; CSS + Konva `to()`/rAF only.
- **Design gate:** design-affecting. Run the `designer` first, get **owner
  approval of the direction before implementation**, then ≤2 `design-reviewer`
  passes on desktop + mobile, dark + light; fold findings.
- **Code review:** ≤1 light pass on the source-only diff; tests are the re-check.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, canvas frame time, memory and
  share/export size against `main`; no regression. State the 60 fps evidence and
  the no-layout-shift evidence.
- **Docs update:** editable rows of the public feature catalog / F-19 QA map
  (`docs/features/README.md`) only.
- **No total-count E2E assertions:** filter a stable item/brand.

## Design direction (gate)

- **Status:** **owner-approved 2026-10-28** — **“Straightedge Settle”**.
- **Designer proposal (2026-10-28): “Straightedge Settle”.** Motion behaves like
  a drafting instrument: fixed short travel, arrives, stops dead; no overshoot,
  no spring, no loop. Enters are longer than exits (the user is still deciding
  on the way in, already decided on the way out).
- **Final tokens (tokens.css + `src/lib/motion.ts`):** `--motion-fast: 120ms`,
  `--motion-base: 180ms`, `--motion-slow: 240ms`, `--motion-exit: 180ms`,
  `--motion-close: 160ms`; `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`,
  `--ease-exit: cubic-bezier(0.16, 1, 0.3, 1)`; `--motion-distance: 18px`,
  `--motion-scale-in: 0.985`, `--motion-scale-out: 0.992`. The original 6/12px
  distances and `--ease-enter` were dropped after the visual review (6px was
  imperceptible on a 1076px panel; one travel value is used everywhere).
  Reduced motion zeroes the durations + JS mirror (exit/close included) and
  presence unmounts synchronously.
- **Per surface (final):** desktop picker 240ms enter; close = 180ms transform
  + late 80ms dissolve over the dimmed scrim (scrim holds full dim then
  releases 120ms; overlay unmounts at 300ms). Desktop docked panels 180ms
  enter; close = **one 160ms fade + `translateY(3px) scale(0.98)`**, no lift,
  no content/surface split. Mobile picker content 120ms enter; close content +
  surface share 100–180ms, scrim release as above; the tab bar is excluded and
  the dock handoff reserves the history width. Mobile docked sheets 120ms
  content enter; close = the same single 160ms panel fade + 2% scale
  (bottom-center origin). Mobile info sheet: no shell motion; chevron/content
  swap 180ms, never height. Canvas add 240ms ease-in opacity; duplicate 120ms +
  240ms accent halo at 0.5; explicit remove 120ms ghost; scene switch 240ms
  stage tween + 120ms content fade; a user wheel/pan finishes the tween at its
  target, **boot = 0ms**, explicit focus stays instant.
- **Exit strategy:** full open+close via `MotionPresence` (semantic close, focus
  return and re-open use the live value; the node lingers inert for the exit;
  reduced motion unmounts immediately).
- **Item remove:** transient presentation-only ghost, explicit delete only; not
  undo/redo, scene switch/load/share-preview, board-delete cascade, capacity
  refusal or read-only.
- **Owner decisions (2026-10-28):** approved as proposed — full open+close via
  presence, explicit-delete ghost, scene-switch camera tween, **boot snaps
  instantly**, reduced motion is a hard off switch, and the framed chip is
  **suppressed until the tween settles**.
- **Reviewer decisions (2026-10-28):** pass 1 (approve-with-changes) required
  opaque mid-motion surfaces, item evidence, aligned frames and visible travel;
  pass 2 (approve-with-changes) signed off the direction and required the mobile
  sheet content fade, tab-bar exclusion, a 0.5 halo cap and the dark item
  evidence. All were folded; no third pass (cap 2).
- **Design-reviewer:** at most 2 passes, desktop + mobile, dark + light; findings
  folded.
- **Designer risks to settle:** (1) never animate the mobile info-sheet height
  (would jerk the locked-camera refit); (2) the framed chip may flash unframed
  during the camera tween — suppress until settle or mark the epoch at tween
  end; (3) a timer-based exit under reduced motion must unmount, not leave an
  inert node over the canvas; boot snap is recommended.
- The reviewer gate is limited to the rendered result; the designer remains the
  design authority.

### Close revision — “Sheet Lift” (owner feedback, 2026-10-28)

Owner feedback on the first implementation: the close read **abrupt/harsh**.
Root cause: the old 120 ms exit used an accelerating ease and deleted the card
on its fastest frame; the scrim unmounted with the sheet (a one-frame brightness
jump); mobile content and surface used different windows (a blank-card beat);
and docked surfaces faded against the raw canvas.

**Owner-approved revision “Sheet Lift”:** the card lifts, stops, then the ink
releases. `--motion-exit: 180ms`, decelerating `--ease-exit` (`cubic-bezier(0.16,
1, 0.3, 1)`), `--motion-scale-out: 0.992`; transform 180 ms plus a late dissolve
(80 ms after 100 ms for the picker, 40 ms after 140 ms for docked panels). The
picker scrim holds full dim for the sheet exit, then releases over 120 ms; the
picker overlay stays mounted 300 ms so the canvas never jumps brighter at
unmount. Mobile picker content and surface share the 100–180 ms window; mobile
docked content fades 180 ms while the opaque surface holds until 140 ms, then
drops in 40 ms. The dock handoff reserves the history width in both bars
(measured tab centers 54/161/269) and reveals the history pair after the sheet
unmounts. Reduced motion adds `--motion-exit: 0ms` and zeroes animation delays.

- Design-reviewer close pass 1: **approve-with-changes** (scrim cut, blank card,
  docked dot bleed, tab-nudge evidence) → all fixed.
- Design-reviewer close pass 2: **APPROVE** (direction shipped; mid-exit frame
  dump added; no third pass). Residual notes are pre-existing/optional (the
  undimmed dock band, a 12 px dot strip under the mobile Scenes card, and the
  docked mobile sheet has no translation).

- **Video follow-up (owner, 2026-10-28):** the owner's recording showed the
  **docked** close lifting toward its trigger and a two-rate content/surface
  fade leaving an empty-card ghost. Docked panels (Scenes/Export/Share/Cable)
  now close with a **single 160 ms `cubic-bezier(0.2, 0, 0, 1)` panel timeline**:
  opacity 1→0 + `translateY(3px) scale(0.98)`, **no lift, no content/surface
  split**; mobile bottom sheets use a bottom-center origin. `--motion-close:
  160ms`; the picker modal close is unchanged (its scrim hold/release). The
  video was split into 60 frames and reviewed by the vision agent, which
  confirmed the new close is **APPROVE** (no empty-card ghost, no upward bump,
  one smooth settle). Optional nits: a ~30 ms fade hang (could use
  `cubic-bezier(0.3, 0, 0.35, 1)` only if still felt), the surface slab
  out-reading thin text at ≤10 % alpha, and a 1:1 desktop crop — the crop was
  added (`scene-close-after-desktop-crop-frames.png`).

### Press Fit extension — patch reveal, info rail, board changes (owner request, 2026-10-28)

Owner request: “If we enable patch cables it should animate smoothly; if we
select a pedal it should open the lateral menu animated; every time we add a
pedal/pedalboard it should pop in (out if delete) animated smoothly.”

**Direction: “Press Fit”** (designer; extends Straightedge Settle): parts press
onto the sheet, cables are drawn as ink, panels slide from their edge.

- **Patch reveal:** `showCables`/read-only mounts the cable + endpoint layers.
  Small graphs (≤40 cables) draw each cable from its jack over **240 ms**
  (`--motion-slow`, `--ease-standard`); the arrowhead follows at 96 ms and
  endpoints fade 180 ms. Dense graphs (>40) use one **180 ms** group fade.
  Hiding fades **120 ms** (`--motion-fast`), never rewinds. Read-only has no
  draw-in (the scene content fade covers it). Cable selection is cleared when
  the patch hides.
- **Info rail:** the desktop **360 px slot is never width-animated** (that
  would fire the stage ResizeObserver and re-render/reallocate the canvas every
  frame). The slot mounts/unmounts once; content slides/fades from the right
  **180 ms** (`--motion-base`) and closes **160 ms** (`--motion-close`), with a
  **16 ms `--motion-prime`** before the enter animation so the 350 sleeve/800
  image rasterizes with the header. Mobile sheet rises 8 px/fades; `sheetHeight`
  is untouched. A→B selection is the same panel.
- **Board/pedal add/delete:** pedal add **180 ms** opacity (replaces the old
  ease-in stall), board add **240 ms** opacity (no scale — true-scale
  footprints). Explicit deletes are presentation-only ghosts: pedal **120 ms**,
  board **240 ms** silhouette only (attached pedals are freed in place, never
  double-drawn; no image snapshot). The catalog-board ghost is delayed **340 ms**
  (picker overlay 300 + margin) so it fades after the closing scrim; custom
  boards (action bar, no picker) start immediately. Data/history/autosave stay
  synchronous.
- **Performance agent:** verdict **adjust → proceed**. Hard edits adopted: no
  width animation, no per-cable draw-in above 40, no snapshot ghost. Rail +
  cable reveal measured **60.0 fps** (mean 16.66–16.67 ms, p95 16.80, max
  16.80). Bundle: **318.77 → 320.14 kB gzip JS (+1.37 kB)**, **14.09 → 14.20 kB
  CSS (+0.11 kB)** for the extension (over the agent's +0.5 kB soft, under its
  +2 kB hard). Cumulative vs main: +3.31 kB JS / +0.77 kB CSS.
- **Design-reviewer (Press Fit):** pass 1 **approve-with-changes** (rail
  thumbnail timing, board scrim/ghost). Fixes: one-frame `--motion-prime`,
  0.9 enter opacity, 340 ms picker-delay, explicit 8-step 240 ms ghost fade, and
  a custom-board delete evidence clip. The final confirmation was
  **evidence-limited** (~20–25 fps headless capture) and could not resolve the
  160/240 ms fades from the frame dividers; the reviewer asked for a true 60 fps
  burst. Open nits: desktop patch ink is thin when jacks align, the
  “Patch hidden · 1 cable · 0 endpoints” chip next to `0 / 0`, and dark mobile
  sheet separation. These are deferred nits, not code blockers. **Owner should
  verify the preview** before merge.

Evidence: `docs/screenshots/F-05/press-fit/` (cable on/off, rail open/close dark
+ light, board add/delete dark + light, custom-board ghost, frame dividers).

## Steps

1. Restate the scope + executable acceptance criteria; record the design
   direction and owner approval.
2. Add the motion tokens (duration/easing/distance) and the reduced-motion
   override to `tokens.css`; add the tiny canvas mirror.
3. Implement panel open/close motion with a reusable presence mechanism that
   does not delay close actions or focus return.
4. Implement item add/duplicate emphasis and explicit-remove ghost on the canvas
   (presentation only, reduced-motion instant).
5. Implement the scene-switch camera/first-paint transition on top of the F-04
   framing contract; make it interruptible.
6. Add unit tests for token/motion helpers and E2E assertions in the existing
   touched specs (desktop + mobile, reduced-motion emulation).
7. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; run the touched
   E2E on desktop + mobile; record performance numbers.
8. Design-reviewer ≤2 passes (desktop + mobile, dark + light), fold findings.
9. One light code-review pass; re-run the checks.
10. Open **one** PR with all standard sections, feature demo link, before/after
    stills and a before/after video/GIF; **do not merge**.

## Acceptance (executable)

- Motion tokens exist in `tokens.css` (duration, easing, distance) and every
  touched surface uses them; no hard-coded duration/easing in feature CSS/JS.
- Unit tests prove: reduced-motion resolves every motion helper to an instant
  state; the canvas motion helper is presentation-only (no stored geometry /
  transform input).
- Panel/modal open and close are visibly animated (picker, one docked panel, one
  mobile sheet) and closing still returns focus to the trigger, closes on
  Escape/outside click, and does not re-open.
- A placed pedal (catalog, stable filtered item) enters with the approved
  emphasis; Duplicate produces the same emphasis at its final z/position; Delete
  removes data in the same tick and only the approved transient ghost remains.
- Scene A → scene B: the incoming content is framed per F-04, the transition is
  the approved camera/first-paint motion, a user pan/zoom interrupts it, and
  ordinary edits/undo/autosave do not trigger it.
- `prefers-reduced-motion: reduce`: no transition/animation/tween runs; every
  final state is identical to the animated end state; all workflows pass.
- No layout shift: measured element/client rects for the app shell, stage,
  action bar and open panel are unchanged before/after the motion settles.
- Read-only share: motion allowed, no edit affordance, no store mutation.
- Mobile: 44 px targets unchanged; sheets/trays remain dismissible; no overflow
  at 390 px.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E green on desktop + mobile.
- Performance recorded: main-JS gzip delta (target ≤ +2 kB), 60 fps during
  motion, JS heap unchanged within noise, share/export size unchanged.
- **Feature demo link:** PR-preview URL + exact steps (animation state is not
  shareable), desktop + mobile.
- **Before/after screenshots:** same viewport/theme/state on base `main` and the
  PR preview, desktop + mobile, plus a before/after **video/GIF** of the motion.
- `docs/features/README.md`: feature inventory row (F-05), workflow row,
  change-impact row and E2E suite-map row updated.
- No catalog/shared edits; one PR; no merge.

## Verification evidence

- `pnpm lint` clean (only the 6 pre-existing warnings); `pnpm typecheck` clean.
- `pnpm test` **906 passed** (101 files), including new `motion`, `viewportMotion`
  (cancel/finish invariants) and transient-motion store tests.
- `pnpm build` clean. Main JS **316.83 → 320.14 kB gzip** (**+3.31 kB**); CSS
  **13.43 → 14.20 kB gzip** (**+0.77 kB**). The F-05 close extension was +1.94
  kB JS; Press Fit added +1.37 kB JS / +0.11 kB CSS (over the agent's +0.5 kB
  soft, under +2 kB hard).
- **E2E:** the Press Fit touched set (`info-panel`, `cables`, `picker`,
  `selection`, `smoke`, `first-run`, `cable-schedule`, `scenes`,
  `board-creator`) **156 passed / 6 skipped** (desktop + mobile, 1 worker).
  CI full suite re-runs on the final head. New motion cases
  cover panel presence + add/duplicate/delete events, reduced motion, the scene
  camera tween, and a pan during the tween that settles the frame instead of
  freezing it. CI initially caught a duplicate `picker-bar-*` during the exit;
  the exiting sheet now omits its tab bar so only the persistent dock exists.
- **Preview:** https://feat-f-05-motion-system.pedalvision.pages.dev (verified
  desktop + mobile; commit `f98fa50`).
- **Performance (1440×900, desktop, branch):** rail open/close **60.0 fps**
  (mean 16.66 / p95 16.80 / max 16.80, 43 frames); cable reveal **60.0 fps**
  (mean 16.67 / p95 16.80 / max 16.80, 55 frames); scene close 60.0 fps; JS
  heap 9.5–11.3 MB; share link **358–359 chars**; all-content Standard PNG
  **2,771,550 bytes** — the last two are untouched by F-05.
- **Screenshots/GIFs:** `docs/screenshots/F-05/{before,after}/` (settled picker
  and scenes, desktop 1440 + mobile 412, dark + light; aligned t0/t60/t120
  frames; dark add/duplicate/delete stills; before/after panel + scene-switch
  GIFs, desktop + mobile) and `docs/screenshots/F-05/close/{before,after}/`
  (old vs new close GIFs, close frame strips, mid-exit contact sheets, the
  412 px band-handoff composite, and reduced-motion stills) plus
  `docs/screenshots/F-05/issue/` (the owner's video contact sheet, old vs new
  scene-close GIFs/frames, and the 1:1 desktop close crop).
- **Feature demo link:** added to the PR (deployed preview + exact steps; motion
  state is not shareable).
- **Code review (light, one pass):** **changes-required** with 5 findings, all
  fixed: (1) a pointerdown during the camera tween now **finishes at the
  target** instead of committing the live mid-transform (and the wheel only
  interrupts when a zoom actually applies); (2) pulse cleanup restores
  `opacity(1)` so a replaced pulse cannot strand a pedal semi-transparent; (3)
  added unit tests for cancel/finish + a pan-during-tween E2E; (4) removed the
  unused distance/easing tokens and reconciled the task with the 18px travel;
  (5) removed the dead `data-motion-viewport` writes and
  `isViewportTweening`. No second pass (UI-only; the unit + touched E2E suite
  is the re-check).
- **Billed tokens (non-cache, final cumulative):** builder `2,763,974` (input
  2,483,854 + output 100,347 + reasoning 179,773; cache-inclusive floor
  80,817,734; $0.7748); designer original `75,199`; designer close revision
  `48,679`; design-reviewer original `122,369`; design-reviewer close pass 1
  `54,239`; close pass 2 `46,034`; code review `114,776`. **Total `3,225,270`**
  non-cache (cache-inclusive floor `84,006,982`; ~$0.9084). The owner explicitly
  requested the close revision + UX/UI review; that added **~1,615k builder +
  ~149k design/vision** over the original 1,461k. **Budget overrun:** builder
  over the 400k soft / 800k hard, review/design over the 300k allowance, and the
  1.1M task hard cap. The owner is asked to accept the overrun or ask for a trim
  before merge.

## Notes

- **F-04 boundary:** F-04 deliberately shipped instant focus. F-05 may animate
  the same target viewport; the focus math and snapshot contract must not fork.
- **Exit motion vs unmount:** React unmounts panels immediately. A tiny presence
  helper (mount → animate in; keep the node until the exit duration elapses) is
  the preferred zero-dep approach — but it must never delay the semantic close,
  focus return, or a re-open. The owner may instead choose enter-only motion if
  it reads cleaner.
- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit shared rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the
  PR/session summary.
