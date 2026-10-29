# ADR-008: Frontend architecture — layered domain, opportunistic rework

**Status:** Accepted (2026-10-29)

## Context

The app works and is well tested (56 unit-test files, 22 Playwright specs, zero
import cycles, documented data model and tokens). A full-codebase review on
2026-10-29 found **decomposition debt, not correctness debt**:

- `src/state/scene.ts` (1,521 lines) holds the scene **types**, the pure scene
  **rules**, and the **Zustand store** in one file. Eleven `src/lib/**` modules
  import back into it, so the dependency direction is inverted (`lib → state`).
- `src/App.tsx` (546 lines) is the composition root **and** the panel
  orchestrator: five panel booleans plus two edit ids, seven near-identical
  `openX()` sequences, each manually cancelling the other surfaces.
- A few files are oversized: `Picker.tsx` (1,353), `ExportPanel.tsx` (627),
  `CustomPedalForm.tsx` (601), `ScenePanel.tsx` (546).
- `src/index.css` is a 6,209-line / 621-selector monolith with cross-component
  `.app[data-*]` and `.motion-presence` rules.
- Dialog behaviour (Escape, outside click, focus capture/restore) is duplicated
  across seven components; roving tabindex across two action bars.
- **TypeScript `strict` is off** in every tsconfig (so `strictNullChecks` and
  `noImplicitAny` are off). The app code is nevertheless **already strict-clean**
  (0 errors measured on 2026-10-29 with `--strict` on both the app and test
  configs), so enabling the flag is a one-line guarantee for future code, not a
  migration.
- Four empty barrel files exist (`src/{lib,state,canvas,components}/index.ts`)
  and are imported by nothing.

The goal is maintainable, human-readable code that stays easy to change during
and after the P5 catalog program — without a framework migration, new runtime
dependencies, or a visual redesign.

## Decision

### 1. Dependency direction

```
app / features / canvas  ──►  state  ──►  domain
            │                  │
            └────►  shared  ◄──┘
services (browser/platform) ──►  domain
```

- **`domain/`** is pure: types + rules + codecs. It imports **no** React,
  Zustand, Konva, DOM or browser API. `lib/` stops importing `state/`.
- **`state/`** is Zustand only. Store actions call `domain/` functions. One
  scene store, composed from slices; never a store per component.
- **`canvas/`** stays a top-level subsystem (cohesive, widely used).
- **`features/`** is used only for genuinely multi-file UI subsystems (picker,
  inspector, scenes, share, export, patch, measure). Small shared DOM
  components stay in `components/` until they are touched.
- **`shared/`** holds generic UI primitives, hooks and formatting.

A full Feature-Sliced Design / Atomic Design migration is **not** adopted: this
is a single-page planner, not a multi-team multi-route app, and moving ~73 files
for folder aesthetics adds churn without correctness value.

### 2. Styling

- **Now: plain CSS + cascade layers.** `@layer tokens, base, layout, components,
  features, motion, overrides;` is declared once, before Vite's injected CSS, so
  the cascade cannot be reordered by production chunking (a known Vite/Rolldown
  issue). Files split per concern/feature; class names are preserved (BEM is
  already consistent and E2E touches some of them).
- **Later (optional): CSS Modules per feature** after the component splits,
  inside the same layers. Vite supports them with no dependency.
- **Rejected:** Tailwind (would replace the existing token system and rewrite
  621 selectors), vanilla-extract (two deps + plugin; not justified), runtime
  CSS-in-JS (runtime cost; incompatible with the project's zero-runtime stance).
  No new runtime dependencies.

### 3. The only gate before feature work

**ARCH-01 (TypeScript `strict` + deleting the empty barrels) must land before
the next feature.** It is the only item that gates feature work, and it costs
almost nothing: the code is already strict-clean, so this is a config line plus
four file deletions. Its value is that **every new line is checked from day
one**; without it, new features keep being written outside the compiler's
strictness guarantees.

Every other ARCH item is **deferred and opportunistic**:

- It is **not** a feature gate, does **not** block catalog work, and is **not**
  scheduled on a calendar.
- It is done when a feature/PR already touches that area, or during an explicit
  quiet window.
- **Before any deferred item starts, its task file must be re-checked and
  redefined against the latest codebase** — the plan written on 2026-10-29 will
  age, and ARCH-03 changes the boundary design that ARCH-02 would enforce.

### 4. Refactor rules

- Behaviour-preserving: the test suite is the contract; no visual redesign.
- One task / one PR / one session; no long-lived architecture branch.
- Before/after screenshots for any touched UI (desktop + mobile, dark + light);
  the design gate applies only if pixels actually change.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*` in architecture PRs.
- No new runtime dependencies.

## Work order (recorded in `docs/roadmap.md` → ARCH)

| Task | Scope | Status |
|---|---|---|
| ARCH-01 | TypeScript `strict` + delete the 4 empty barrels | **next — config-only; independent of F-05** |
| ARCH-02 | Import-boundary checker | deferred; re-scope before action |
| ARCH-03a/b | Extract `domain/scene/**`; move codec/share/export models; remove `lib → state` | deferred/opportunistic |
| ARCH-04 | Scene store slices + selector layer | deferred |
| ARCH-05 | `activePanel` state machine + App shell split | deferred |
| ARCH-06 | Shared dialog/focus + roving-focus primitives | deferred |
| ARCH-07 | CSS split + cascade layers | deferred |
| ARCH-08…11 | Split Picker / ExportPanel / custom forms; shared formatting | deferred |
| ARCH-12 | CSS Modules pilot (picker only) | optional |

## Alternatives considered

| Option | Why rejected |
|---|---|
| Big-bang rewrite / one architecture branch | Unreviewable, unresumable, conflicts with catalog work |
| Full Feature-Sliced Design migration | Folder churn without correctness value for a single-page app |
| Tailwind or vanilla-extract | New runtime/tooling dependency; replaces a working token system |
| Store per feature | Fragments one scene document; Zustand recommends one store + slices |
| Do nothing | Debt is bounded today but the god files/store inversion/CSS monolith grow with each feature, and code written before `strict` lands is never checked by it |
| Block all features until the full rework lands | Unnecessary; only strict mode needs to gate feature work |

## Consequences

- New features are written under `strict` from day one.
- The domain becomes importable and testable without the store; the layer
  inversion is removed when ARCH-03 lands.
- The repo gains a durable architecture record so future agents do not
  "helpfully" introduce Tailwind, multiple stores, or a full FSD migration.
- The remaining rework rides along with real feature work instead of becoming a
  multi-week detour.
