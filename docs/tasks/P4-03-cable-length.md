# P4-03: Auto cable length calculation + cable list summary

**Phase:** P4 · **Status:** done (merged 2026-10-21, PR #33, squash `c0c419b`) · **Model:** build-strong

## Goal

Turn the P4-02 cable graph into a shop-ready **cable schedule**: derive every cable's required length from jack-to-jack world geometry (never from the drawn screen curve), round up to sold lengths, and present an ordered signal-path list with per-cable FROM → TO labels, length, and totals per length/type. Flag unconnected pedals/endpoints and assumed-jack (catalog fallback) cables. The summary is **derived, never stored** — no scene/schema change, no new dependency.

## Read first (context pack)

- `docs/design.md` §Data model (Cable/Endpoint/Jack), §Canvas architecture, §Persistence, §Capacity budgets
- `docs/requirements.md` F12 (cables: auto length calc + summary), A4/A5
- `docs/roadmap.md` P4-03 + the P4-02 review notes
- `src/lib/jackAnchor.ts`, `src/state/scene.ts` (cable/endpoint/jack helpers), `src/state/overlap.ts` (patch-gap context), `src/lib/exportScene.ts`, `src/canvas/CableLayer.tsx`, `src/components/InfoPanel.tsx`, `src/App.tsx`, `src/state/settings.ts`, `src/state/sceneDocument.ts` (types only), `src/components/EndpointControls.tsx`
- P4-02 pedal-user round-2 notes in `docs/progress.md` (signal-path ordering, assumed-jack disclosure, quiet canvas)

## Owner decisions (2026-10-21)

- **View-only by default.** The cable list is a planning/readout surface; it does **not** enter the PNG/PDF export or the share payload. Revisit only if the owner asks.
- **No new scene data.** Length is derived on read; nothing is persisted (A4 stays byte-identical for an unchanged scene).

## Length model (pure, cm)

- Jack-to-jack **world-cm straight-line distance** from the resolved anchors (`cableEndAnchorFromIndex`), so rotated boards/items and loose items are handled by the existing anchor math. Endpoints are anchors too.
- Add **plug overhang** (`1.5 cm` per end → 3 cm) and a **stated slack allowance** (`10%` of distance + overhang, minimum `1 cm`).
- Round **UP** to sold lengths `10 / 15 / 20 / 30 / 60 cm`. Above 60 cm the cable is reported as **custom** with its calculated requirement (never silently clamped to 60).
- Cable **type**: `TRS` when either terminating jack is `stereo`, otherwise `Mono` (endpoint-terminated cables are mono). TRS jacks may carry two cables; each cable has its own row.

## Summary model (pure)

- **Ordered signal path**: walk the directed cable graph from instrument endpoints / source-only nodes, following source → sink, then append any remaining (branch/loop/neutral) cables in scene order. Every cable appears exactly once.
- Each row: `FROM → TO` labels (item name + jack kind, or Instrument/Amp), length, type, assumed flag.
- **Totals** per sold length + type (e.g. `10 cm · Mono ×3`), plus a custom-length group.
- **Flags**: unconnected pedals (no cable), unconnected endpoints, assumed-jack cables, and defensively unresolvable/dangling cable ends.

## Constraints

- No new dependencies; cm is the source of truth; no toasts (N8).
- Length/summary logic is pure and unit-tested (rotated boards, loose items, endpoints, >60 cm, TRS, ordering, flags).
- Respect the persisted **Show patch** preference (off by default): a hidden patch must not show a noisy summary. The summary is reached deliberately from the Patch surface (or the existing hidden-patch cue), never auto-opened.
- Keep the mobile canvas working area visible (sheet/tray, not a full-screen modal); desktop non-modal.
- Do not regress P4-02 semantics: signal direction, TRS capacity, fallback anchors, I/O labels, read-only previews.
- One light-model code-review pass before the PR; exactly one PR; do not merge.

## Steps

1. **Design gate** — designer proposes a direction (owner approves before UI).
2. Pure length model in `src/lib/cableLength.ts` (+ tests).
3. Pure summary model in `src/lib/cableSummary.ts` (+ tests).
4. UI: summary surface (desktop + mobile), reachable from the Patch control / hidden-patch cue; show it only on demand; inline flags; no new tokens beyond the approved direction.
5. Wire read-only previews (read-only summary, no mutation) and respect `showCables`.
6. Unit + e2e coverage (desktop + mobile), no regression in 553 / 245 + 7 skipped.
7. Optional `performance-expert` review (derived summary UI).
8. Light `code-reviewer` pass; fix blockers/should-fixes; re-run all checks.
9. Exactly one PR (full standard, desktop + mobile screenshots); mark **in review — PR #N**, keep Next = P4-03.

## Acceptance (executable)

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
- Unit tests prove: distance on rotated boards; loose items; endpoint-terminated cables; overhang + slack; round-up at each sold length; >60 cm custom; TRS vs mono; signal-path ordering; unconnected/assumed flags.
- E2E proves: the summary opens from the Patch surface on desktop and mobile, shows ordered rows + totals + flags, stays closed while Show patch is off until opened, and is absent from export/share payload (view-only).
- Existing 553 unit / 245 passed + 7 skipped e2e baseline stays green.
- Light code-review pass recorded; design-reviewer approves desktop + mobile (≤2 passes) or findings are handed to the owner; exactly one PR, not merged.

## Notes

- P4-02 is the source of the cable graph, direction semantics, TRS capacity, Show patch toggle and I/O labels — do not regress them.
- P4-04 owner outreach runs in parallel; not a gate.
- P4-02 watch notes (hard-cap 16 fps, untrusted share payload, ~24K link tier) stay watch notes.
- **Implementation (2026-10-21):** `src/lib/cableLength.ts` (sold lengths 10/15/20/30/60, 1.5 cm plug overhang per end, 10% slack min 1 cm, >60 = custom), `src/lib/cableSummary.ts` (ordered signal path, FROM → TO, totals, unconnected/assumed/dangling flags, one per-item lookup pass), `src/components/CableSchedulePanel.tsx` + CSS (owner-approved "Cable Schedule", desktop dock / mobile 52dvh tray, cm/in units, read-only), Patch-popover entry + read-only toolbar trigger. 15 unit tests; `e2e/cable-schedule.spec.ts` 6 flows × desktop + mobile.
- **Checks:** lint / typecheck / test **568** / build / e2e **257 passed + 7 skipped** (baseline 553 / 245 + 7).
- **Design:** designer "Cable Schedule", owner-approved before UI; `design-reviewer` 2/2 — R1 approve-with-changes (◇ ASSUMED contrast, mobile read-only tray gap, length padding, dot size) → R2 **approve**.
- **Performance (`performance-expert`): verdict `watch`** — CSS +2.06 kB gz, JS ≈+4 kB gz estimated, hosting $0; applied the per-row item/jack lookup should-fix; deferred 300-row cap/over-budget notice + lazy loading.
- **Code review (light, one pass): changes-required** — unresolved-row tooltip fabricated a sold length / ignored units; Show patch dropped focus; payload-equality test gap → fixed (early return, units, panel focus, persisted-document equality). No second pass (simple fixes; test suite is the re-check). Nits: assumed-end title added; duplicated e2e helpers deferred.

- **Merged 2026-10-21** (PR #33, squash `c0c419b`). P4 scheduled tasks are complete; the P4 phase gate runs in a separate docs-only session. P5-01 starts only after the gate merges.
