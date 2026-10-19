# P2-08: First-run empty-state guidance

**Phase:** P2 · **Status:** in review · **Model:** build-cheap

## Goal
A brand-new user lands on an empty infinite canvas with only two Add icons
(pedal / board) and no explanation of what to do. Add **small, dismissible
first-run guidance** that makes the first action obvious — the
"instant use, easy to learn" lesson (requirements §Competitor learnings, R6/N2)
— without covering the canvas, and especially without covering it on a phone.

The guidance appears when the scene is **empty** and the user has **not
dismissed it** (persisted locally). It must not appear once a board or pedal
exists, and it must never block pan/zoom/placement: the canvas stays fully
interactive behind/between the chrome.

## Read first (context pack)
- `docs/roadmap.md` P2-08; `docs/phase-guide.md` P2 row
- `docs/requirements.md` §Competitor learnings ("instant use, easy to learn"),
  F11 (responsive), N8 (no toast-only UX), A2
- `docs/design.md` §Responsive approach (desktop modal / mobile bottom tabs),
  §Accessibility
- `docs/decisions/005-design-governance.md`
- `src/App.tsx` (toolbar, picker open state), `src/components/Picker.tsx`
  (tab copy + mobile tab bar), `src/state/scene.ts` (empty-scene predicate),
  `src/state/persist.ts` (localStorage conventions + fail-soft storage),
  `src/index.css` + `src/styles/tokens.css` (tokens, toolbar chrome)
- Precedents for owner-approved direction + review: `docs/tasks/P2-01-picker-modal.md`,
  `docs/tasks/P2-05-custom-board-creator.md`

## Constraints
- **Design-affecting:** the `designer` proposes the direction and the **owner
  approves before any UI exists**. Then render desktop + mobile, dark + light,
  and run `design-reviewer` (≤2 passes total).
- **Keep it small — never cover the canvas.** The hint is a quiet overlay/chip,
  anchored to existing chrome; on mobile it must stay tiny (no modal sheet, no
  full-width card, no centering over the working area). Placement should not
  obscure the empty canvas centre.
- **Non-blocking:** canvas pan/zoom/placement remain available; no modal trap,
  no forced picker open (a CTA may open the picker on demand).
- **Dismissible + remembered:** a visible dismiss affordance; store the
  dismissal in localStorage (fail-soft, like `persist.ts`). It reappears only
  if the scene is empty and the user hasn't dismissed it. Reopening the app with
  a non-empty scene shows nothing.
- **Tokens only** (no hardcoded colors), dark + light, mobile-first a11y
  (labelled controls, 44px touch targets, `role=status`/`aria-live` only where
  it helps — no toast pattern, N8).
- **Zero new deps.** Do not add a tour library or any package.
- Do not build P5-06 help content, onboarding tours, or P3 save/share.
- No external catalog provenance in UI (ADR-003).

## Steps
1. **Create this task file** (done).
2. **Designer direction → owner approval.** Record the direction name + approval
   date here and in `docs/progress.md`. **No UI before approval.**
3. **Pure logic:** `src/lib/firstRun.ts` (or similar) — first-run visibility
   predicate (`sceneIsEmpty` + `notDismissed`) and the storage key read/write,
   fail-soft; unit tests (empty/non-empty, dismissed, unavailable storage).
4. **UI (owner-approved direction):** a small guidance element in `App.tsx`
   (anchored near the toolbar); primary CTA starts the natural first action
   (board or pedal, per the approved direction); dismiss control; mobile variant
   stays tiny. Tokens + CSS only.
5. **Tests:** Playwright (desktop + mobile) — fresh storage shows the hint; CTA
   opens the picker / places nothing unexpectedly; dismiss hides it; reload
   keeps it hidden; a non-empty scene shows no hint. Existing e2e must reset the
   new storage key where a clean first-run state is assumed.
6. **Design gate:** `design-reviewer` on rendered screenshots (desktop + mobile,
   dark + light), ≤2 passes.
7. **Code review (light, one source-scoped pass).** Fix blockers/should-fixes.
8. **Docs + PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`,
   reconcile `docs/progress.md` + `docs/roadmap.md` + this file, open **one** PR
   to the full standard (inline screenshots at the commit SHA, ≤3 owner hints,
   review-round digest). **Do not merge.**

## Acceptance (executable)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green.
- Vitest: the visibility predicate returns true only for an empty, undismissed
  scene; dismissal persists; a corrupt/blocked storage read fails soft.
- Playwright (desktop + mobile): with fresh storage the first-run hint is
  visible, labelled, and its CTA opens the matching picker; the hint does not
  intercept canvas gestures (pan/zoom still work).
- Playwright (desktop + mobile): dismiss → hint disappears; reload → still
  hidden; with a placed board/pedal → no hint.
- Manual/grep: tokens only, no new deps, no `dangerouslySetInnerHTML`, hint
  occupies a small footprint (measured mobile width/height documented in the PR).

## Notes
- **Direction: "Bench Note" — designer proposal, OWNER-APPROVED 2026-10-19
  before any UI.** A small drafting annotation pinned to existing chrome. Desktop:
  under the top-right Add cluster (272 × 122.8px at 1440×900), eyebrow `START
  HERE`, title `Start with a board.`, support `Then place pedals on it — true to
  scale.`, an accent-tinted `Add a board` CTA, and a 44px dismiss. Mobile: above
  the tab bar, bottom-left, single row (277.6 × 79px on Pixel 7 / 412×839, ~7.5%
  of the screen), support line hidden, 44px CTA/dismiss. Owner chose the
  recommended option: **board-first CTA, and the note returns whenever the scene
  is empty until dismissed.**
- **Behavior:** visibility is **derived** — `boards.length === 0 &&
  items.length === 0` and `localStorage["pedalvision.firstRun.v1"] !==
  "dismissed"`. No migration/schema change. The CTA opens the Boards picker and
  does **not** dismiss; placing the first part retires the note automatically.
  Dismissal writes the one-way flag. Storage is best-effort (blocked/private
  storage fails soft). Non-modal, `role="note"` + `aria-labelledby` (no
  `aria-live`/toast, N8); focus after dismissal goes to the visible Add-board
  trigger, never `<body>`.
- **Files:** `src/lib/firstRun.ts` (+ tests) — predicate + dismissal; shared
  `src/lib/storage.ts` `resolveStorage` (also used by `state/persist.ts`);
  `src/lib/focus.ts` — visible Add-board trigger fallback (stable ids
  `toolbar-add-board` / `tab-bar-boards`); `src/components/FirstRunHint.tsx`;
  `src/App.tsx`; `src/index.css`; `e2e/first-run.spec.ts` (+ mobile project).
- **Design gate (≤2):** `design-reviewer` R1 **approve-with-changes** (dark card
  surface too close to the canvas) → card lifted to `--color-surface-elevated`
  → R2 **approve** (desktop + mobile, dark + light). Accepted nit: the desktop
  note CTA reinforces the Add-board action; left as intentional.
- **Code review (light, one pass):** **CHANGES-REQUIRED** → fixed the should-fix
  (focus dropped to `<body>` when the CTA's first placement unmounted the
  opener) + all four nits (stable ids instead of test-only/testid + duplicated
  breakpoint; `vi.stubGlobal` storage test; e2e placement-through-the-note +
  pedal-only case; shared `resolveStorage`). No second pass (simple, non-high-
  risk fixes; suite re-checked).
- **Checks:** tests **366**; e2e **121** (+6 skipped). Screenshots
  `docs/screenshots/P2-08/` (desktop + mobile, dark + light, plus CTA-open).
- Existing temporary-chrome rule (owner, 2026-10-15): temporary UI must keep a
  small on-screen footprint, especially on mobile — measured above.
