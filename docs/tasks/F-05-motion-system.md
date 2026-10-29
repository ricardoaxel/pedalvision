# F-05 — Motion system (panels, item add/remove/duplicate, scene switch)

**Phase:** 2 · **Status:** in progress (owner-approved design) · **Model:** light

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
  `--motion-base: 180ms`, `--motion-slow: 240ms`; `--ease-standard:
  cubic-bezier(0.2, 0, 0, 1)`, `--ease-exit: cubic-bezier(0.4, 0, 1, 1)`;
  `--motion-distance: 18px`, `--motion-scale-in: 0.985`. Exit = one token down
  (floor 120ms). The original 6/12px `--motion-distance-sm/md` and
  `--ease-enter` were dropped after the visual review (6px was imperceptible on
  a 1076px panel; one travel value is now used everywhere). Reduced motion
  zeroes the durations + JS mirror, and presence unmounts synchronously.
- **Per surface (final):** desktop picker 240ms enter / 120ms exit
  (transform-only, opaque surface; scrim fades 120ms); mobile picker **content
  fade 120ms** (surface opaque; the persistent tab bar is excluded so it never
  leaves the screen); desktop docked panels 180/120ms, 18px from the trigger
  corner; mobile docked panels content fade; mobile info sheet **no shell
  motion** (chevron + swapped content 120ms — never height, protecting the F-04
  safe rect); canvas add 240ms opacity (ease-in, so it remains visible after the
  picker's 120ms exit); duplicate 120ms + 240ms accent halo at 0.5 opacity, zero
  travel; explicit remove 120ms presentation-only ghost; scene switch 240ms
  stage-transform tween + 120ms content fade; a user wheel/pan finishes the
  tween at its **target** (never half-framed), **boot = 0ms**, explicit focus
  stays instant.
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
- `pnpm build` clean. Main JS **316.83 → 318.63 kB gzip** (**+1.80 kB**, under
  the +2 kB target); CSS **13.43 → 13.90 kB gzip** (**+0.47 kB**).
- **E2E:** six touched specs (`picker`, `viewport-focus`, `scenes`, `history`,
  `selection`, `cable-schedule`) **114 passed / 5 skipped** (desktop + mobile,
  1 worker). New motion cases cover panel presence + add/duplicate/delete
  events, reduced motion, the scene camera tween, and a pan during the tween
  that settles the frame instead of freezing it.
- **Performance (1440×900, desktop, branch):** panels 60.0 fps (mean 16.67 ms,
  p95 16.70 ms, max 16.80 ms); scene switch 60.0 fps (same); JS heap 11.3 →
  11.3 MB; share link **359 chars**; all-content Standard PNG **2,771,550
  bytes** — the last two are untouched by F-05.
- **Screenshots/GIFs:** `docs/screenshots/F-05/{before,after}/` (settled picker
  and scenes, desktop 1440 + mobile 412, dark + light; aligned t0/t60/t120
  frames; dark add/duplicate/delete stills; before/after panel + scene-switch
  GIFs, desktop + mobile).
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
- **Billed tokens (non-cache):** builder `1,082,415` (input 890,729 + output
  68,605 + reasoning 123,081; cache-inclusive floor 42,909,615; cost
  $0.3741); designer `75,199` (67,438 + 2,998 + 4,763; $0.0161);
  design-reviewer `122,369` (90,289 + 6,174 + 25,906; $0.0370);
  code review `114,776` (83,122 + 4,487 + 27,167; $0.0342). **Total
  1,394,759** non-cache. **Budget overrun:** the builder exceeded the 400k
  soft / 800k hard, the 300k review allowance by ~12k, and the 1.1M task hard
  cap (1.395M total). The owner is asked to accept the overrun (F-04 precedent)
  or ask for a trim before merge.

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
