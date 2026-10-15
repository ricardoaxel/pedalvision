# ADR-007: Mobile & touch testing strategy — free, Playwright + CDP now; Appium deferred

**Status:** Accepted (2026-10-15)

## Context
P1-02 introduced the canvas touch gestures (two-finger pinch-zoom + pan). The behaviour could only be validated by hand on a phone: Playwright's built-in `touchscreen` supports single taps only, and its own WebKit build is *not* the iOS-Safari build, so it cannot reproduce real MobileSafari behaviour (ADR-001 risk 1). A post-PR Copilot review also flagged that the touch foundation "still requires owner validation of pinch and pan on physical hardware". The owner asked for the best **free** way to automate realistic mobile/gesture testing — ideally without running heavy emulators on a modest machine, and without paid device clouds.

## Decision
Stay **free and lightweight**; layer coverage as follows:

1. **Automate gestures now with Playwright + CDP multi-touch (free, in CI).** Inject trusted touch via `Input.dispatchTouchEvent` over a CDP session (Chromium-only, built into Playwright — **no new dependency**). This exercises the app's real **Pointer Events** gesture code (`src/canvas/gestures.ts`) in a real engine and runs in CI by default (`mobile-chromium` project). See `e2e/touch.spec.ts`, task **P1-02b**.
2. **Real iOS Safari stays a manual owner gate.** No free tool drives actual MobileSafari on a real iPhone (Apple exposes only the Safari Web Inspector protocol); the engine, hardware gestures, momentum, page-zoom, and pull-to-refresh are OS-level. The owner does a short real-device pass before merge/launch.
3. **Appium + local iOS Simulator / Android device is the recommended *future* path for true mobile-engine E2E — deferred, not scheduled.** It is free (open-source) and gives real MobileSafari/Chrome + W3C multi-touch, but requires a heavy local install (Xcode/simulator or Android SDK). It is parked as a **proposal for the final full-integration / pre-launch stage only** (task **P5-05**, status *proposed*) so a later session is reminded, without spending setup time now.
4. **Paid device clouds are out of scope.** BrowserStack / Sauce Labs / LambdaTest / AWS Device Farm (real devices) are noted only as an escape hatch. Notably **BrowserStack is the only provider that runs Playwright on real iOS Safari** (since June 2025); others automate real mobile via Appium. BrowserStack/LambdaTest/TestingBot also grant **free plans to open-source projects**, which the owner may apply for if ever needed.

The chosen model for the grid's zoom-dependent behaviour is recorded separately; this ADR is about *testing*, not app behaviour.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Playwright WebKit + iPhone device profile | Emulates UA/viewport/touch flags, but the engine is Playwright's WebKit, not the iOS-Safari build — misses real Safari quirks |
| Playwright `dispatchEvent('touchstart')` | Synthetic/untrusted, and the app listens to Pointer Events — wouldn't drive the handlers |
| Appium 3 + simulator **now** | Correct tool, but heavy install (Xcode/simulator, Appium server, WebDriverAgent) for uncertain value mid-P1 — deferred to P5-05 |
| Android emulator / DeviceFarmer self-hosted farm | Heavy on a modest machine (RAM/CPU) / needs a server + hardware; Android-only |
| Paid real-device cloud as a standing tool | Cost; not justified for occasional gesture checks — free tiers + OSS plans remain the escape hatch |
| Maestro / Drizz | Native-app-oriented; web support (Chromium-only) is early — not a better fit here |

## Consequences
- Gesture regressions (pinch/pan) fail in **CI** without a device; the suite is Chromium-only and adds zero dependencies.
- Real device/browser-engine coverage is still a **manual** step — automated emulation never fully replaces it (recorded as a review hint on every canvas PR).
- A **P5-05 proposal** is recorded in `docs/roadmap.md`, `docs/tasks/P5-05-*`, and `docs/progress.md` → Follow-ups so the Appium recommendation resurfaces at the final integration stage.
- If true-device automation ever becomes worth it, the upgrade path is: local Appium (free) → free OSS cloud plan → paid real-device cloud.
