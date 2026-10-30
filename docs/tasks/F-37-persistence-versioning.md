# F-37 — Scene/share persistence versioning

**Phase:** 1 (feature lane) · **Status:** in progress · **Model:** light
(high-risk serialization: ≤2 light code-review passes only if a blocker needs
re-check)
**Budget:** builder soft ≤400k / hard ≤800k billed non-cache; review ≤300k;
task hard ≤1.1M; 6 h active.
**Owner decision (version policy, 2026-10-30):** **no bump now.** Keep the
additive document `v1` and share `v2`; add the migration/guard framework and
reserve document `v2` / share `v3` for the first **non-additive** change. Any
remaining defect is fixed here or recorded under “Remaining gaps”.

## Goal

Make the persisted scene document and the share link **explicitly versioned
contracts** with a documented, tested migration path, so later schema changes
(sticky notes, tiered boards, local jack overrides, power connections) can land
without silently losing a user's saved or shared board. F-37 is the
prerequisite named in `docs/tasks/feature-roadmap-proposal.md` (§6 “Scene
versioning”) and is **not** a feature the user sees: no new UI, no new data
field, no catalog change, zero new dependencies.

The audit below shows most of the machinery already exists. This task
**does not rewrite working code**; it closes the real gaps:

1. No explicit version/support policy in code (hard-coded `=== 1` / `1 | 2`).
2. No named migration chain (legacy share `v1 → v2` is implicit in the decoder).
3. Share prefix version and payload `version` can disagree (a `v2:` link with a
   `version: 1` payload silently decodes as legacy).
4. Guard parity gap: the document guard accepts custom-pedal jacks without
   `pos` (and with `approximate`), but the share zod schema requires `pos` and
   strips `approximate` — a document-valid custom pedal can become an invalid
   or lossy share link.
5. `parseSceneDocument` does not de-duplicate uids, while the share decoder
   does; duplicated uids can collide in React and in the reference graph.
6. No tests pinning forward compatibility (newer document/share) or the
   document-level legacy shape (no `customPedals`/`endpoints`/`cables`).

## Read first (context pack)

- `docs/progress.md` (catalog paused; feature lane open)
- `docs/tasks/P5-03d-parallel-workstreams.md` (parallel-workstream rules)
- `docs/design.md` → Data model, Persistence (v1), P4 extension contract,
  Capacity budgets
- `docs/requirements.md` → F10 share, A4 restore, A5 share fidelity
- `src/state/sceneDocument.ts`, `src/lib/shareLink.ts`, `src/state/library.ts`,
  `src/state/autosave.ts`, `src/lib/sceneBackup.ts`, `src/lib/capacity.ts`,
  `src/state/history.ts`
- Existing tests: `src/state/sceneDocument.test.ts`,
  `src/lib/shareLink.test.ts`, `src/state/library.test.ts`,
  `e2e/share.spec.ts`, `e2e/scenes.spec.ts`,
  `e2e/storage-fallback.spec.ts`

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Feature workstream:** own `src/**` feature code, `e2e/**`, this task file
  and the editable rows of `docs/features/README.md`.
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, `docs/progress.md`, `docs/roadmap.md`, or other
  shared/coordinator-only docs/config/deps. Catalog is **paused**.
- Shared schema/config/docs are **coordinator-only**: if this task needs one,
  **STOP** and report.
- Separate branch/worktree from `main`; `pnpm install --frozen-lockfile`;
  **one PR**; no merge.
- No new dependencies. No design gate: no visible UI, tokens, layout or copy
  change. If a migration needs an owner-facing notice, **STOP** and propose it
  (that would be a design-affecting follow-up), do not add one here.

## Audit — what already exists (do not rewrite)

| Area | Current behaviour | Verdict |
|---|---|---|
| Stored document | `SceneDocument.version: 1`; `createSceneDocument` is the only writer | Keep **additive v1** |
| Document parse | `parseSceneDocument` requires `version === 1`; additive arrays default to `[]`; malformed entries dropped; unknown version → `null` | Keep, add migration hook + dedupe |
| Document normalise | `normalizeSceneContent` drops orphan items, densifies z, prunes unreferenced customs, drops dead cables/endpoints, keeps standalone endpoints | Keep as the only data-dropping step |
| IDB index | `localStorage` index is derived; boot reconciles from `repo.all()`; a newer document is unparseable but **never deleted** and re-surfaces when a newer build can read it | Keep; pin with a test/policy |
| Share | `#s=v2:`; decoder accepts v1 + v2; `v3+` → typed `unsupported-version`; `deflate` + base64url; 200 KB decoded / 32,000-char caps; streamed inflate abort | Keep, add explicit migration |
| Share guards | Zod per version (v1 graph-less, v2 with `endpoints`/`cables`); duplicate uids de-duped; unknown refs preserved | Keep; fix jack parity |
| Backup | `buildSceneBackup` calls `createSceneDocument` (live snapshot), compact JSON, no import UI | Keep; inherits the codec |
| Autosave/library | `saveActive` builds from the full snapshot via `createSceneDocument`; `applyScene` copies every key; legacy mirror migrated once | Keep; no version-specific branch |
| Capacity/history/export | Consume the live snapshot; no serialization version | Keep untouched |
| Tests | Round-trips, additive arrays, malformed drops, v1 share, caps, over-cap load | Extend for versions/migration/fuzz |

## Version + migration policy (proposed)

Two independent version tracks, because the storage contract and the untrusted
wire contract have different rules.

### A. Stored document (`SceneDocument`, IndexedDB + backup JSON)

- `version` is an integer; **current = 1**. Writes always use the current
  version.
- **Additive-within-version rule:** a new optional field/array may be added to
  the same version only when an older reader can ignore it without losing
  existing data or rendering wrong. `customPedals`, `endpoints` and `cables`
  were added this way and MUST stay valid without a bump.
- **Bump** the document version only for a **non-additive** change: a required
  field, changed meaning/semantics, or data an older reader would mis-handle
  (not merely ignore).
- Decode path: `supported(document.version)` → run the pure
  `migrateSceneDocument` chain → structural guards → `normalizeSceneContent`.
  `version > current` is **forward-unsupported**: return `null` (never throw,
  never rewrite); the IDB record survives and the derived index re-surfaces it
  once a supporting build reads it.
- No migration may invent catalog facts; unknown/removed `refId`/`boardRefId`
  stay stored and resolve through the renderer's labeled fallback.

### B. Share link (`#s=v<N>:<base64url(deflate(JSON))>`)

- **Current = 2.** The encoder always emits `v2`.
- Decoder accepts **v1 and v2**; every other version is a typed
  `unsupported-version` error (old clients must reject a newer link cleanly,
  never partially decode it).
- **Prefix ↔ payload agreement is mandatory:** `#s=vN:` must carry
  `payload.version === N`; a mismatch is `invalid` (no silent legacy decode).
- **Any new transported key bumps the share version**, because the zod schemas
  strip unknown keys and an old decoder would otherwise drop data silently.
  Additive-within-version applies to the document, **not** to the wire.
- Migration: `migrateSharePayload` upgrades supported older payloads to the
  current shape before guards run. Today the only step is **v1 → v2**
  (`endpoints: []`, `cables: []`); v2 is identity.
- Malformed/unknown-ref policy: the whole untrusted payload is rejected when it
  fails zod; unknown refs are data and are preserved.

### C. Reserved next version (the ambiguity)

- **No v3 is defined in F-37**, because no transported field exists yet.
- v3 is **reserved for the first non-additive share change** (likely F-22
  tiered boards, F-33 local jack overrides or F-21 notes). When it lands:
  `v3 payload = v2 + the new field`; encoder emits v3; decoder keeps v1/v2;
  the document version bumps only if the stored change is non-additive too.
- `docs/design.md` §Versioning will record the “first v3 field” once that task
  is scheduled. This task does not change the v3 meaning.

### D. Single-writer rule

`createSceneDocument` (document/backup/autosave/library) and
`encodeShareLink` (share) stay the **only** serializers. Consumers
(`library`, `autosave`, `sceneBackup`, `SharePanel`, export/capacity/history)
must never construct a versioned payload themselves. The audit above confirms
this today; the task adds a test that every `SceneSnapshot` key survives the
document and share round-trip, so a future field cannot be half-wired.

## Steps

1. Restate scope + acceptance criteria in this file (done).
2. Add the version policy constants + migration functions:
   - `SCENE_DOCUMENT_VERSION`, `SUPPORTED_SCENE_DOCUMENT_VERSIONS`,
     `migrateSceneDocument(raw)` (v1 identity now) in `sceneDocument.ts`.
   - `SHARE_VERSION`, `SUPPORTED_SHARE_VERSIONS`,
     `migrateSharePayload(parsed)` (v1 → v2) in `shareLink.ts`.
   Keep the existing public API (`parseSceneDocument`, `decodeShareHash`)
   behaviour-compatible.
3. Enforce share prefix ↔ payload version agreement.
4. Fix guard parity: share `jackSchema` accepts optional `pos` and optional
   `approximate`, matching `isJack`.
5. De-duplicate document uids (first wins) in `parseSceneDocument`.
6. Do **not** branch library/autosave/backup/export/capacity/history on
   version; verify they inherit the single writer.
7. Tests: migrations, forward/backward, prefix mismatch, dedupe, jack parity,
   every-key round-trip, fuzz/malformed, legacy document shape + max graph.
8. E2E: legacy document in IDB loads; legacy v1 share loads; backup JSON is
   versioned and complete; a newer document version is preserved, not deleted.
9. Measure and record: max-graph document size, parse+migrate time, share/URL
   size, memory; compare to the P4-02/P3-06 numbers.
10. Update `docs/features/README.md` (F8/F10 inventory + workflow/impact rows +
    Known gaps), then open one PR.

## Acceptance (executable)

- [ ] `SceneDocument` keeps **additive v1**: documents missing
      `customPedals`/`endpoints`/`cables` load with empty arrays and no data
      loss (`sceneDocument.test.ts`).
- [ ] `parseSceneDocument` accepts every supported version through the migration
      chain and returns `null` for newer/corrupt input without throwing
      (`sceneDocument.test.ts`).
- [ ] A newer-version document in the repository is **not** deleted or
      overwritten by boot, and re-surfaces when supported
      (`library.test.ts`).
- [ ] Share decode accepts v1 + v2, migrates v1 → v2, and rejects any other
      version with `unsupported-version`; **no silent partial decode**
      (`shareLink.test.ts`).
- [ ] A `#s=v2:` prefix with a `version: 1` payload (and vice versa) is rejected
      as `invalid` (`shareLink.test.ts`).
- [ ] Document/share guard parity: every document-valid `CustomPedal` jack
      survives a share round-trip, including omitted `pos` and `approximate`
      (`sceneDocument.test.ts`, `shareLink.test.ts`).
- [ ] Duplicate uids in a stored document are de-duplicated (first wins) and
      never reach React as colliding keys (`sceneDocument.test.ts`).
- [ ] A round-trip invariant covers **every** `SceneSnapshot` key (boards,
      items, customPedals, endpoints, cables) through the document codec, the
      share codec and the backup; missing a key fails the test.
- [ ] Malformed/fuzz inputs (wrong types, NaN/Infinity, mixed cable ends, bad
      jack index, wrong version, truncation) never throw and never partially
      apply to the store.
- [ ] E2E: inject a legacy (graph-less) document into IndexedDB and reload →
      the scene loads, `data-boards`/`data-items` match, graph is empty
      (`scenes.spec.ts`, desktop + mobile).
- [ ] E2E: open a legacy `#s=v1:` link → read-only scene renders
      (`share.spec.ts` or `cables.spec.ts`, desktop + mobile).
- [ ] E2E: backup JSON is `version: 1` and contains every current array
      (`storage-fallback.spec.ts`).
- [ ] No new dependency; no catalog/shared-doc edits; no visible UI change
      (no design gate).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
      green.
- [ ] Performance recorded with no regression: max-graph document bytes,
      parse+migrate ms, share URL length, memory; within the existing budgets
      (200 KB decoded / 32,000-char URL / 150/300 graph cap).
- [ ] `docs/features/README.md` updated (F8/F10 inventory, workflow/impact
      rows, Known gaps).
- [ ] One PR; **do not merge**. Feature demo link: deployed PR-preview URL +
      a read-only `?share=1#s=v1:…` link (legacy payload) that migrates and
      renders. No screenshots required (no visible UI change).

## Performance plan

- Build the max graph (400 items / 200 cables / 100 endpoints, 10 boards,
  100 custom definitions) and measure:
  - `JSON.stringify(document).length` (bytes) vs the 200 KB share ceiling;
  - `parseSceneDocument` + `migrateSceneDocument` + `normalizeSceneContent`
    wall time (report median of N runs; no CI ms assertion);
  - `encodeShareLink` decoded/compressed bytes and hash length;
  - peak heap during one decode/parse (report only).
- Record the numbers in the task file and the PR; compare to P4-02
  (doc 71.8 KB) and P3-06 (max share under 200 KB). No threshold change.

**Measured 2026-10-30 (desktop Node/V8, max fixture = 10 boards + 400 items +
200 cables + 100 endpoints + 100 custom definitions):**

| Metric | Result | Budget |
|---|---|---|
| Document JSON | **101,257 bytes (98.9 KB)** | 200 KB share ceiling |
| parse → migrate → normalize | **1.27 ms** mean (20 runs) | no CI ms gate |
| Share encode incl. self-validation | **3.92 ms** mean (20 runs, max graph) | no CI ms gate |
| Max-graph share (same fixture, short ids) | **13,808 chars**, encodes | 32,000-char hard cap |
| Valid share (200 items + 75 + 75) | **8,105 chars** / 63,157 decoded / 6,074 compressed | 32,000 chars / 200 KB |
| Heap | scene graph **+0.2 MB**; decode working set is transient/GC-dependent (no new retained structures) | no threshold change |

Compare P4-02 (doc 71.8 KB; 400+200+100 with random UUIDs measured 38,184
chars → **refused**) and P3-06 (max scene well under 200 KB). F-37 adds no
bytes or work to the encode/decode path: the only new work is a version-set
check and the identity/empty-array migration.

## Remaining gaps (recorded, not fixed here)

| Gap | Why it stays | Where recorded |
|---|---|---|
| The document guard is intentionally more permissive than the wire schema (e.g. a custom-pedal name >200 chars). The old arbitrary `32` caps on effect types/jacks were wrong for the form (all 39 effect types, unbounded rows), so they are removed; `encodeShareLink` now self-validates and returns an inline `invalid` refusal instead of emitting a dead link. | Tightening the document guard itself would drop existing data; the encode boundary keeps the user safe without a data policy. | This task file + `docs/features/README.md` → Known gaps |
| A build that predates a document version cannot list that document in its register. The IDB record is preserved and re-surfaces in a supporting build (now unit + E2E tested). | Showing an unreadable scene would be new UI (design-gated) for a rare downgrade case. | `docs/features/README.md` → Known gaps |
| Backup is one-way (no import/restore). | Pre-existing P3-05 scope; unchanged by versioning. | `docs/features/README.md` → Known gaps |
| There is no pre-`v1` stored document shape; the only legacy form is the P1-06 `localStorage` mirror, migrated by `library.ts`. | Historical fact; the mirror path is already unit-tested. | This task file |

## Notes

- **No version bump is proposed.** The current document is additive v1 and
  share v2 is already a clean version boundary; inventing v3 with no new field
  would add churn/bytes and force every document through a fake migration.
  v3 is reserved for the first real non-additive transport change.
- The `docs/features/README.md` prose rules, `progress.md`/`roadmap.md`,
  templates and `AGENTS.md` are coordinator-owned: edit only the inventory,
  workflow/impact and Known-gaps rows.
- Record billed tokens by class (builder / code review) in the PR/session
  summary.
