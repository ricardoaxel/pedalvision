# F-36 — Signal-flow validation

**Phase:** 1 (feature lane) · **Status:** **in review — PR #92** (open, not merged) · **Model:** light
**Direction:** "Continuity Check" (owner-approved 2026-10-29).
**Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k; task hard ≤1.1M; 6 h active.

## Goal

Derive a **read-only signal-flow report** from the current scene graph (items,
boards, endpoints, cables, resolved jacks, fallback anchors, TRS) and surface
actionable **warnings** — never blocks — so a builder can spot a broken patch
before printing or sharing it. It works with the documented fallback anchors and
never turns missing catalog jack data into a false error. One compact, accessible
status surface integrated with the "Specimen Bench" direction; no toasts, no
modals, no new dependencies, no schema migration.

## Read first (context pack)

- `docs/progress.md` (catalog paused; feature lane open)
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/design.md` → Cable visuals, Cable schedule, P4 extension contract
- `docs/requirements.md` → cables/anchors/jacks (F12)
- `src/lib/jackAnchor.ts`, `src/state/scene.ts` (cable role/direction/capacity),
  `src/lib/cableSummary.ts` (existing derived-graph flags), `src/lib/cableLength.ts`
- `src/components/CableSchedulePanel.tsx`, `src/App.tsx` (surface placement),
  `src/components/InfoPanel.tsx` (assumed disclosure pattern)
- `e2e/cables.spec.ts`, `e2e/cables-touch.spec.ts`, `e2e/cable-schedule.spec.ts`

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file,
  `docs/screenshots/F-36-signal-flow-validation/**`, and the editable rows of
  `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`. Catalog is **paused** for this session.
- Shared schema/config/docs are **coordinator-only**: if this task needs one,
  **STOP** and report — it becomes a serial coordinator task.
- Separate branch/worktree; **one PR**; no merge.

## Model (pure, no React)

New `src/lib/signalFlow.ts` + `src/lib/signalFlow.test.ts`:

```ts
export type SignalIssueCode = /* see rules */;
export type SignalSeverity = "warning" | "info";

export interface SignalIssue {
  code: SignalIssueCode;
  severity: SignalSeverity;
  title: string;
  detail: string;
  /** Scene refs so the UI can select the offender. */
  itemUids: string[];
  endpointUids: string[];
  cableUids: string[];
  /** Any involved cable end uses a fallback/approximate anchor. */
  assumed: boolean;
}

export interface SignalReport {
  issues: SignalIssue[];
  warningCount: number;
  infoCount: number;
  checkedCables: number;
  assumedEndCount: number;
  hasInstrument: boolean;
  hasAmp: boolean;
  /** False when the scene lacks the endpoints needed for end-to-end checks. */
  endToEnd: boolean;
}

export function buildSignalReport(scene: SignalFlowScene): SignalReport;
```

- Deterministic, stable order (scene order, then code), O(V+E); resolves items,
  jacks and anchors **once** via `resolveItemJacks` / `usesFallbackJacks` /
  `buildAnchorIndex`.
- Only `isCableJack` kinds (`in`/`out`/`send`/`return`) participate in
  cable-anchor rules; MIDI/USB/power/exp/ctrl connectors are **informational**
  and never produce a cable warning.
- Supplies (`kind === "supply"`) are excluded from pedal/chain rules.
- Never mutates the scene, never persists, never runs in render loops; the UI
  memoizes on scene array identity.

## Rules (exact, warning only)

Severity **warning** unless stated. "Assumed" = a fallback pair
(`usesFallbackJacks`) or an edge-only approximate jack (`approximate`); such a
finding is still shown but marked **assumed** and phrased as *possible* — it is
**not** an error and must never block.

1. **`direction-conflict`** — a cable whose two audio ends are both sources or
   both sinks (output→output, input→input). Defensive: `addCable`/`prune` already
   refuse these; report hand-edited/shared documents. Refs: cable.
2. **`instrument-unconnected`** — an instrument endpoint with no cable.
   Refs: endpoint. *(Info when the scene has no pedals.)*
3. **`instrument-bad-target`** — an instrument endpoint is the cable's **sink**
   side, or the cable lands on a non-input audio jack. Refs: cable + endpoint.
4. **`amp-unconnected`** — an amp endpoint with no cable. Refs: endpoint.
5. **`amp-bad-source`** — an amp endpoint is the cable's **source** side (amp
   feeding a pedal input). Refs: cable + endpoint.
6. **`pedal-missing-input`** — a pedal with real custom/catalog jack data that
   has **no `in` jack**. Refs: item. Never for catalog pedals with zero jack
   data (they use the documented fallback pair).
7. **`pedal-missing-output`** — same, no `out` jack. Refs: item.
8. **`pedal-no-audio-jacks`** (info) — a **custom** pedal with no jacks at all;
   deliberate-but-unconnectable. Refs: item.
9. **`dangling-cable-end`** — a cable end no longer resolves (gone item/endpoint
   /jack). Refs: cable. Defensive; the store normally prunes.
10. **`unconnected-pedal`** — a pedal with **no cable** on any audio jack.
    Refs: item.
11. **`unconnected-chain`** — an undirected component with **≥2 pedals** and
    **neither** an instrument nor an amp. Refs: itemUids (one finding per
    component; member pedals are not also reported as `unconnected-pedal`).
12. **`incomplete-chain`** — a component with pedals that reaches an instrument
    **or** an amp but not both, **only when the other endpoint kind exists
    somewhere in the scene**. Refs: itemUids + endpointUids. Phrase:
    "doesn't reach an amp" / "doesn't start at an instrument".
13. **`feedback-loop-direct`** — a 2-item directed cycle (`A.out → B.in`,
    `B.out → A.in`). Refs: itemUids + cableUids.
14. **`feedback-loop-indirect`** — a directed cycle of ≥3 items. Same refs.
15. **`effects-loop`** (info) — a directed cycle that closes through a
    **`return`** jack whose matching departure is a **`send`** on the same item.
    An intentional insert/effects loop is disclosed, **not** warned.
16. **`trs-mono-mismatch`** — one audio end is `stereo: true` (TRS) and the
    other is a mono jack or an endpoint. Advisory: "TRS patched to mono —
    confirm balanced/stereo intent." Refs: cable. Not emitted when both ends are
    stereo or the TRS jack is simply unused on one channel.
17. **`assumed-anchor` disclosure** — not a warning: `assumedEndCount` + each
    affected finding's `assumed` flag. Missing catalog jack data never yields
    rules 6/7/9.

### Precision / no-false-positive rules

- Catalog pedal with no catalog jacks → fallback pair → never 6/7/9.
- No instrument or no amp endpoint in the scene → skip 2/3/4/5/11/12; report an
  **info** "Add an instrument and an amp to check the full chain" instead.
- Empty scene, one pedal, or no cables → no warnings (info only).
- Every rule is per-graph **derived**; a scene with only fallback anchors may
  show **0 warnings**.
- Report each underlying defect **once**; dedupe overlapping chain/feedback
  findings by component.
- Validation **never blocks** an action; the existing store refusals remain the
  only hard stops.

## Owner decisions (surface before implementation)

1. **Effects loops vs feedback (rule 15).** Proposed: a cycle closing through
   `return`/`send` is an intentional effects loop → info, not a warning. A cycle
   closing on an `in` jack is feedback. Confirm.
2. **Custom pedal with zero jacks (rule 8).** Proposed: info only ("No audio
   jacks defined"), never a warning, since an empty jack list is deliberate.
3. **TRS definition (rule 16).** Since a `stereo: true` jack may be balanced
   mono or stereo, proposed: warn only on TRS↔mono pairs and phrase it as
   advisory. `stereo` + one cable is **not** misuse.
4. **Instrument/amp absence.** Proposed: do not guess — end-to-end rules stay
   silent until both endpoint kinds exist.
5. **Surface.** Designer proposal + owner approval (below) decides placement and
   whether findings live in a dedicated dock, the Cable Schedule, or both.

## Design gate — APPROVED

**Direction: "Continuity Check"** (owner-approved 2026-10-29, designer agent). A
compact `✓ Signal clear` / `! N notes` chip in the **Margin Rule strip** opens a
non-modal dock (desktop, 360 px, the Cable Schedule slot) / tray (mobile, 46dvh
above the tab bar). No toast, no modal, no new tokens, no toolbar slot. One
surface at a time (opening Continuity closes the Cable Schedule and Patch
popover).

**Owner decisions (2026-10-29):**
1. Feedback: a cycle closing through `return`/`send` is an intentional effects
   loop → **info**, not a warning.
2. Custom pedal with zero jacks → **info**, never a warning.
3. TRS↔mono pair → **advisory warning**; stereo + one cable is not misuse.
4. Instrument/amp absence → end-to-end rules stay silent (info only).
5. Cable finding with the patch hidden → select a host item; never force Show
   patch on.
6. Single-slot dock: Continuity and Cable Schedule are mutually exclusive.

### Design gate process (per AGENTS.md; satisfied)

- Run the **`designer`** agent first for a compact status surface in the
  "Specimen Bench" direction. Constraints: no toast, no modal; desktop + mobile;
  dark + light; accessible (role/status, keyboard, focus return, ≥44 px touch);
  no new dependencies or shared tokens unless approved.
- **Owner approves the direction before any pixel work.** Record the direction
  name + approval in `docs/progress.md` (coordinator-owned) and this task.
- Then ≤2 `design-reviewer` passes on **desktop + mobile, dark + light**;
  batch findings into one change; stop at the cap and hand open findings to the
  owner.

## UI requirements (post-approval)

- Compact status surface showing a clear/notes state + count; opens a
  non-modal, content-sized dock (desktop) / tray (mobile), never auto-opens.
- Findings grouped by severity then type; each row is **selectable**:
  item findings select the item, endpoint findings the endpoint, cable
  findings the cable (existing `useSelection` API); with the patch hidden, a
  cable finding selects its first host item. No viewport auto-frame in v1.
  Focus return, Esc, outside-click, ARIA dialog/label, reduced-motion safe.
- **Assumed** marker inline per finding + an aggregate "N ends use assumed
  jacks" line; never presented as an error colour/word.
- Respect **Show patch** (findings are derived; the surface must not force the
  patch on) and work in **read-only share previews** (derived locally, no
  mutation).
- Empty/clear state: "Signal flow looks clear." No findings, no blocking.
- No total-count E2E assertions; filter a stable item/brand.

## Performance guardrail

Record in the PR (against existing thresholds):

- **Bundle delta** (JS gzip; target ≤ +8 kB, report).
- **Picker/canvas frame time** (existing benchmark; no regression).
- **Memory/heap** after loading a 400-item / 300-cable scene (report).
- **Share/export size** unchanged (no payload change; findings derived).
- Report `buildSignalReport` cost on the max graph (should be O(V+E), < 5 ms).

## Tests

- **Unit** (`signalFlow.test.ts`): one case per rule (1–17), plus the
  **no-false-positive** cases — fallback-only pedals, no endpoints, empty scene,
  supplies, non-audio jacks, custom no-jacks, intentional effects loop,
  stereo+one-cable, repeated issue dedupe, deterministic order, assumed flag.
- **E2E** desktop + mobile (`signal-flow.spec.ts`): warning visibility, opening
  the surface, selecting a finding (item/cable), assumed disclosure, clear
  state, and **no blocking** (the scene remains editable and the action that
  produced the warning still succeeds). Reuse `e2e/cables.spec.ts` helpers.
- Re-run touched cable flows (`cables.spec.ts`, `cables-touch.spec.ts`,
  `cable-schedule.spec.ts`).

## Steps

1. Write this task file (done) and surface the owner decisions.
2. Designer proposal → **owner approval** of the visual direction.
3. Implement the pure model + tests; wire the surface; run the design reviewer.
4. `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
5. One light `code-reviewer` pass (high-risk only if the model/serialization
   gets complex). Fold findings; re-run checks.
6. Rebase onto `main`; update `docs/features/README.md` (F12 + F-36 rows, impact
   table, known gaps); add screenshots + demo link; open **one PR**; no merge.

## Acceptance (executable)

- `src/lib/signalFlow.ts` exports `buildSignalReport`; no React/DOM imports;
  no new dependencies; no catalog or shared-file edits.
- Every rule 1–17 has a unit test, and the listed no-false-positive cases pass.
- Only audio I/O jacks produce cable warnings; non-audio connectors are
  informational.
- Assumed/fallback anchors are disclosed and never generate missing-jack/dangling
  false errors.
- The surface is compact, accessible (keyboard/Esc/focus return/44 px), works
  desktop + mobile in dark + light, never blocks, and offers no toast/modal.
- `design-reviewer` approves or its open findings are handed to the owner.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
- **Feature demo link** (deployed PR preview + read-only `?share=1#s=…` with a
  deliberately invalid patch) and **before/after** desktop + mobile screenshots.
- Performance numbers recorded; `docs/features/README.md` updated.
- One PR; no merge.

## Notes

- **Process/rule gaps:** propose the change + the `token-usage-reviewer` to the
  owner first; do not edit the rules in this PR.
- Record billed tokens **by class** (builder / vision / code review) in the PR
  and session summary.
- Findings are **derived**, so no `SceneDocument`/share/codec/backup change and
  no schema migration.

## Outcome (2026-10-30)

- **PR #92** (`feat/f-36-signal-flow-validation`, commit `bb984ff`), one PR, not merged.
- **Checks:** `pnpm lint` (0 errors, 10 pre-existing warnings) · `pnpm typecheck` ·
  `pnpm test` **940** · `pnpm build` · `pnpm e2e` **332 passed + 11 skipped**
  (`signal-flow.spec.ts` 6/6 desktop + mobile).
- **Design:** designer "Continuity Check" → owner approved; `design-reviewer` 2/2
  (R1 mobile strip/vocabulary/secondary/chevron; R2 tray/toolbar seam, amber
  warning, light secondary). The R2 fixes were applied after the ≤2 cap and are
  handed to the owner — no third pass.
- **Code review:** light pass 1 changes-required (non-audio catalog-jack blocker,
  endpoint gating, lone-pedal rule, test gaps, docs) → fixed; pass 2 (same
  session) **approve** (nits: dead `realJacks`, EHX 22500 incomplete catalog
  OUT recorded as a catalog-repair gap, order test) → fixed.
- **Performance:** JS +4.26 kB gzip (336.02), CSS +0.59 kB; 400+300 graph 39 fps,
  heap 18.4 MB, doc 73.5 KB, export 873 ms / 16.92 MB (unchanged); report
  **3.24 ms** per 400/300 build, memoized per scene mutation.
- **Demo:** deployed preview + read-only `?share=1#s=…` with a deliberate direct
  feedback loop (2 pedals, fallback jacks) in the PR body.
- **Boundary:** `docs/progress.md` / `docs/roadmap.md` not edited (feature lane;
  shared docs are coordinator-only). One PR; owner merges.
- **Multi-I/O coverage:** a 4-audio-jack stereo pedal with both channels patched
  is clean; a loop switcher with two SEND/RETURN loops reports one
  `effects-loop` info and zero warnings. (30 signal-flow unit cases.)
- **Known gap:** an item-level viewport auto-frame does not exist; rows select
  the offender (selection chrome + info panel locate it). The model treats each
  pedal as one graph node, so it does **not** flag an unused second input/output
  when another of that kind is patched, nor validate per-channel routing. EHX
  22500's catalog OUT omission is recorded for the catalog-repair lane.
