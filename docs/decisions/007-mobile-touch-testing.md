# ADR-007: Mobile & touch testing strategy — free, Playwright + CDP now; Appium deferred

**Status:** Accepted (2026-10-15)

## Context
P1-02 introduced the canvas touch gestures (two-finger pinch-zoom + pan). The behaviour could only be validated by hand on a phone: Playwright's built-in `touchscreen` supports single taps only, and its own WebKit build is *not* the iOS-Safari build, so it cannot reproduce real MobileSafari behaviour (ADR-001 risk 1). A post-PR Copilot review also flagged that the touch foundation "still requires owner validation of pinch and pan on physical hardware". The owner asked for the best **free** way to automate realistic mobile/gesture testing — ideally without running heavy emulators on a modest machine, and without paid device clouds.

## Decision
Stay **free and lightweight**; layer coverage as follows:

1. **Automate gestures now with Playwright + CDP multi-touch (free, in CI).** Inject trusted touch via `Input.dispatchTouchEvent` over a CDP session (Chromium-only, built into Playwright — **no new dependency**). This exercises the app's real **Pointer Events** gesture code (`src/canvas/gestures.ts`) in a real engine and runs in CI by default (`mobile-chromium` project). See `e2e/touch.spec.ts`, task **P1-02b**.
2. **Real iOS Safari stays a manual owner gate for now.** Free, open-source automation of a real iPhone *does* exist — Appium's XCUITest driver drives Safari through WebDriverAgent — but it requires macOS/Xcode, a connected device, and WebDriverAgent signing, so it is **not adopted here** (deferred to P5-06, below). The owner does a short real-device pass before merge/launch to check the OS-level behaviour (hardware gestures, momentum, page-zoom, pull-to-refresh).
3. **Appium + local iOS Simulator (or a real iPhone) / Android device is the recommended *future* path for true mobile-engine E2E — deferred, not scheduled.** It is free (open-source) and gives real MobileSafari/Chrome + W3C multi-touch; a real iPhone is automatable via the XCUITest/WebDriverAgent driver, and the iOS Simulator needs no device or signing. All variants still need a heavy local install (Xcode/simulator or Android SDK), so it is parked as a **proposal for the final full-integration / pre-launch stage only** (task **P5-06**, status *proposed*), without spending setup time now.
4. **Paid device clouds are out of scope.** Real-device cloud providers (BrowserStack, Sauce Labs, LambdaTest, AWS Device Farm, …) are recorded only as an escape hatch, not adopted. If ever needed, prefer (a) a free open-source plan (several providers offer one) or (b) pay-per-minute. Note (**as of late 2025**): among them, BrowserStack is the only one that runs Playwright tests on real iOS Safari; the others automate real mobile via Appium.

The chosen model for the grid's zoom-dependent behaviour is recorded separately; this ADR is about *testing*, not app behaviour.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Playwright WebKit + iPhone device profile | Emulates UA/viewport/touch flags, but the engine is Playwright's WebKit, not the iOS-Safari build — misses real Safari quirks |
| Playwright `dispatchEvent('touchstart')` | Synthetic/untrusted, and the app listens to Pointer Events — wouldn't drive the handlers |
| Appium 3 + simulator / real device **now** | Correct tool (real MobileSafari/Chrome, W3C multi-touch; a real iPhone works via XCUITest/WebDriverAgent), but a heavy install (Xcode, Appium server, WebDriverAgent/device signing) for uncertain value mid-P1 — deferred to P5-06 |
| Android emulator / DeviceFarmer self-hosted farm | Heavy on a modest machine (RAM/CPU) / needs a server + hardware; Android-only |
| Paid real-device cloud as a standing tool | Cost; not justified for occasional gesture checks — free tiers + OSS plans remain the escape hatch |
| Maestro / Drizz | Native-app-oriented; web support (Chromium-only) is early — not a better fit here |

## Consequences
- Gesture regressions (pinch/pan) fail in **CI** without a device; the suite is Chromium-only and adds zero dependencies.
- Real device/browser-engine coverage is a **manual** step **for now** — automated emulation never fully replaces it, and the free real-device path (Appium/XCUITest) is deferred (recorded as a review hint on every canvas PR).
- A **P5-06 proposal** is recorded in `docs/roadmap.md`, `docs/tasks/P5-06-*`, and `docs/progress.md` → Follow-ups so the Appium recommendation resurfaces at the final integration stage.
- If true-device automation ever becomes worth it, the upgrade path is: local Appium (free) → free OSS cloud plan → paid real-device cloud.
