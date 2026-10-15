# P1-02b: Touch/gesture E2E (Playwright + CDP multi-touch)

**Phase:** P1 · **Status:** in review — PR #10 · **Model:** build-strong

## Goal
Add automated coverage for the P1-02 canvas touch gestures — two-finger **pinch-zoom** and two-finger **pan** — using Playwright's CDP touch injection, so gesture regressions fail in CI instead of only surfacing on a physical device.

## Read first (context pack)
- `docs/decisions/007-mobile-touch-testing.md`
- `src/canvas/useViewportGestures.ts`, `src/canvas/gestures.ts` (the gesture machine under test)
- `e2e/smoke.spec.ts`, `playwright.config.ts`

## Constraints
- **No new dependencies** — CDP (`page.context().newCDPSession`) is built into Playwright.
- Chromium-only; must never require a real device or a cloud account.
- Tests only — **do not change app behaviour**.
- Inject input that produces **trusted pointer events** (the app listens to Pointer Events); use `Input.dispatchTouchEvent`, not synthetic `dispatchEvent`.

## Steps
1. `e2e/touch.spec.ts`: inject two-finger pinch + two-finger pan via CDP; assert the stage `data-scale`/`data-x`/`data-y` transform.
2. `playwright.config.ts`: add a touch-enabled Chromium project (`mobile-chromium`, Pixel device profile) scoped to `touch.spec.ts`; keep the desktop smoke project unchanged.
3. Confirm each touch test **fails** when the gesture logic is broken (real regression guard).

## Acceptance (executable)
- `pnpm e2e` green, running smoke (desktop) + touch (mobile-chromium) — also in CI.
- `pnpm typecheck` + `pnpm lint` pass.
- Each touch test fails when `applyPinch`/pan handling is broken (verified manually during implementation).

## Notes
Real iOS Safari + true-device behaviour still needs a short owner pass (ADR-007). Appium local-device E2E is a deferred *proposal* (P5-05), not part of this task.
