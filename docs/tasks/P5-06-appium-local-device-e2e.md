# P5-06: Full-integration device E2E (Appium, local) — PROPOSED (not scheduled)

> Renumbered from P5-05 on 2026-10-21 (P5-05 is now Image hosting at scale).

**Phase:** P5 · **Status:** proposed — deferred (see ADR-007) · **Model:** plan

> ⚠️ **PROPOSAL — do not implement until the final full-integration / pre-launch stage, and only with owner opt-in.** Recorded so a future session re-surfaces it (see `docs/progress.md` → Follow-ups).

## Goal
At the **very final** integration stage, run a small Appium suite against the owner's **local iOS Simulator**, a **real iPhone** (via the XCUITest/WebDriverAgent driver), and/or a real Android phone over USB to validate real MobileSafari/Chrome behaviour and multi-touch end-to-end — the real-engine coverage Playwright emulation (P1-02b) cannot provide.

## Why it is deferred
Appium + Xcode/simulator (or Android SDK) is a **heavy local install** and a resource cost. The project is mid-P1; that cost is not justified yet. Revisit only at final integration, and only if the owner opts in. It is **free** (open-source Appium) provided Xcode / Android SDK are already installed — no cloud spend.

## Scope (when it happens)
- A minimal smoke E2E on real engines: load → two-finger pan → pinch-zoom → a couple of core flows.
- iOS Simulator first (real MobileSafari engine; no device/signing); a real iPhone via XCUITest/WebDriverAgent and real Android over USB optional.
- Runs locally / on demand (not CI by default). Not a runtime dependency.

## Related
- `docs/decisions/007-mobile-touch-testing.md` — the strategy + why paid clouds are out of scope.
- Optional escape hatch if local setup is unwanted: a free open-source cloud plan or pay-per-minute minutes (as of late 2025, BrowserStack was the only provider running Playwright on real iOS Safari — see ADR-007).
