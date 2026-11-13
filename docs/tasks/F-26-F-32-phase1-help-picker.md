# F-26 + F-32 — Phase 1 help (Layers) + mobile picker preview

**Phase:** 1 · **Status:** in progress · **Model:** light (escalate only for a blocker/high-risk change)

**Owner waiver (2026-11-13):** the owner explicitly waived the usual
one-task-per-session guidance and asked for **F-26 help + F-32 mobile picker in
ONE session, ONE task file and ONE PR** to reduce review/merge overhead. Never
open a second/rider PR. If the combined work cannot stay small and coherent,
STOP and report — do not silently drop either half.

**Design direction (owner-approved 2026-11-13):** F-26 inserts
“Layer parts and boards” as help section **03** (renumber 03–07 → 04–08), adds
the TOC link, and retargets the HelpChip + picker link to **/help**; F-32 is a
passive 48 px mobile “bench strip” above the results (thumbnail + brand + name +
dimensions + effect tags as mono text, `aria-hidden`), hidden on desktop and at
≤620 px height. Passive top-match binding: no tap action, no extra mobile step.

**Share:** stays **v5**. Neither half transports a new scene key (help is static
copy; the picker preview reads existing `PickerEntry`/`activeId` data).

## Goal

Two small Phase 1 polish items in one PR:

1. **F-26 — Layers & order help.** The `/help` page covers boards, pedals,
   cables, scale, jacks, save/share and shortcuts but is missing user-facing
   **layering** guidance, which `docs/design.md` §Z-order reserves for a help
   entry. Add one section (`id="layers"`) explaining: layering is per container
   (board vs loose); new items land on top; reorder via the item action bar
   (forward/back/front/bottom); moving an item between boards re-parents it;
   boards stack by array order. Add it to the TOC and update the footer date.
   Update `/features` (Layers row) and `/changelog`. Point an existing help
   entry at the how-to page only if that stays a one-line change; do not build a
   new modal or a second help UI.

2. **F-32 — Mobile picker active-item preview.** On phones the sheet hides the
   desktop specimen pane, so the active item is only a row. Add a **compact
   active-item preview** to the mobile sheet — thumbnail + name + brand +
   dimensions + effect tags — from the existing `PickerEntry`/`activeId` data.
   It is a small header/peek, not a redesign. Keep the result list usable, the
   sheet height/scroll behaviour, the tab bar and 44 px targets. Desktop must
   not change. No new data, assets or dependencies.

## Read first (context pack)

- `docs/progress.md`, `docs/roadmap.md` → Feature lane
- `docs/tasks/feature-roadmap-proposal.md` §2 (Phase 1) and §6
- `docs/design.md` §Z-order & container rules (source of truth for the copy)
- F-26: `public/help/index.html`, `public/features/index.html`,
  `public/changelog/index.html`, `public/docs/index.html`, `public/hub/hub.css`,
  `src/components/HelpChip.tsx`, `src/App.tsx`, `docs/tasks/F-41-docs-legal-hub.md`,
  `e2e/docs-hub.spec.ts`, `src/lib/hubPages.test.ts`
- F-32: `src/components/Picker.tsx`, `src/components/pickerFilter.ts`,
  `src/components/pickerPaging.ts`, mobile picker rules in `src/index.css`
  (≤1023px), `e2e/picker.spec.ts`, `e2e/picker-choka.spec.ts`,
  `docs/tasks/P2-01-picker-modal.md`, `docs/tasks/Q-04-mobile-add.md`
- `docs/features/README.md` (F-19 map) for the F-4/F-11/F-41 rows/impact map

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, `public/help`,
  `public/features`, `public/changelog`, this task file and
  `docs/screenshots/F-26-F-32/**`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- Shared schema/config/docs are **coordinator-only**: if this task needs one,
  **STOP** and report.
- Separate branch/worktree `feat/f26-f32-phase1-help-picker`; **one PR**; no merge.

## Constraints

- cm is the source of truth; zoom/pan on the stage transform only; same-origin
  images; minimal dependencies (no new runtime dependency).
- **Design gate (both halves are visibly rendered):** one combined `designer`
  proposal covering both surfaces → **owner approval** → one combined
  `design-reviewer` pass on real desktop + mobile, dark + light before/after
  pixels. Batch all visual findings into one change; **hard cap ≤2
  `design-reviewer` passes total**. If both surfaces cannot be approved within
  the cap, STOP and hand the open findings to the owner.
- **Code review:** ≤1 light pass on the source diff only (`src`, `e2e`);
  `public/` help HTML/CSS is outside the code-review scope. Escalate to ≤2 only
  for a blocker or a high-risk change.
- **Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
  task hard ≤1.1M; 6 h active.
- **Performance guardrail:** record bundle delta, picker/canvas frame time,
  memory and share/export size.
- **Docs update:** `/help`, `/features`, `/changelog`; update
  `docs/features/README.md` rows/impact map for the mobile picker + help changes.
  State `Docs: hub help, features, changelog | map updated · <details>`.
- **No total-count E2E assertions:** filter a stable item/brand.

## Share-version decision

**Stay v5.** No new transported key, codec, document or share change. The
mobile preview is derived UI only; the help page is static copy.

## Executable acceptance criteria

- `/help` has a section with `id="layers"` plus a matching TOC link `#layers`;
  the copy states per-container layering, new items on top, action-bar reorder
  (forward/back/front/bottom), board-to-board re-parenting and board array
  stacking. Footer date is updated.
- `/features` Layers row reflects the same behaviour; `/changelog` has a new
  top entry dated 2026-11-13 describing the help + mobile preview.
- On a ≤1023 px viewport the open picker shows a compact active-item preview
  (thumbnail, name, brand, dimensions, effect tags) derived from `activeId`;
  it is absent at ≥1024 px and on the Custom tab; the result list still scrolls,
  the sheet height/tab bar are unchanged and all interactive targets stay ≥44 px.
- Desktop picker DOM/CSS is unchanged except the mobile-only preview.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- Touched E2E flows green: `e2e/picker.spec.ts`, `e2e/picker-choka.spec.ts`
  (or the targeted known-flake rerun), `e2e/docs-hub.spec.ts` on desktop +
  mobile, dark + light.
- **Feature demo link:** deployed `/help#layers` for F-26; deployed PR-preview
  URL + exact mobile steps + a short video/GIF for F-32 (the open picker state is
  not representable in a share link). Desktop + mobile verified.
- **Before/after screenshots** embedded for BOTH halves at desktop + mobile,
  dark + light, same viewport/state on base `main` and the PR preview.
- Performance numbers recorded; no regression beyond thresholds.
- No edits to catalog/data/assets/tools; no new runtime dependency.
- **One PR; no merge.** Do not start the following task.

## Notes

- `docs/design.md` §Z-order is the copy source of truth; do not invent behaviour.
- `public/` HTML is static; keep it no-JS readable and keep the shared nav/footer
  blocks intact (`hubPages.test.ts` guards them).
- Record billed tokens **by class** (builder / vision / design / code review) in
  the PR + session summary, plus the one-line-per-round review digest.
