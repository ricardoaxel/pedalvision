# ARCH-01 — TypeScript strict mode + empty-barrel cleanup

**Phase:** Architecture (cross-cutting) · **Status:** next — config-only; start in the next free slot · **Model:** light

## Goal

Turn on TypeScript's `strict` family for the app source so new feature code is
type-safe from day one, and remove the four unused empty barrel files. This is
the **only** architecture item that gates feature work (ADR-008 §3).

**Measured baseline (2026-10-29):** `tsc -p tsconfig.app.json --noEmit --strict`
and `tsc -p tsconfig.test.json --noEmit --strict` both report **0 errors**. The
code is already strict-clean, so this is a configuration change plus four file
deletions — **not** a migration. (For reference, `--noUncheckedIndexedAccess`
*does* report errors; that is a separate future task, not this one.)

Scope, owner-redefined on 2026-10-29:

1. Enable `"strict": true` in `tsconfig.app.json` (the test config inherits it).
2. Fix anything the flag reveals (expected: nothing). If it reveals a real bug,
   fix it explicitly and flag it — otherwise make no code changes.
3. Delete the empty barrel files:
   - `src/lib/index.ts`
   - `src/state/index.ts`
   - `src/canvas/index.ts`
   - `src/components/index.ts`

Non-goals: no domain extraction, no store splits, no component splits, no CSS
changes, no `noUncheckedIndexedAccess`, no strict mode for
`tsconfig.node.json`/`tsconfig.tools.json` (tiny follow-ups if wanted).

## Read first (context pack)

- `docs/progress.md`
- `docs/decisions/008-frontend-architecture.md`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.test.json`
- `docs/design.md` §Folder structure

Read only these pointed files/sections; do not read whole docs.

## Steps

1. Add `"strict": true` to `tsconfig.app.json`.
2. Delete the four 0-byte `index.ts` files; confirm nothing imports them
   (`rg 'from "\.\./(lib|state|canvas|components)"' src` → no matches).
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. If `typecheck` reports errors (did not on the measured baseline), fix them
   with the smallest correct change; do **not** silence them with `any`,
   `@ts-ignore`, `@ts-expect-error` or `biome-ignore` unless there is a
   documented external reason. Do not change runtime behaviour to satisfy the
   compiler; a real bug gets its own explicit note in the PR and
   `docs/progress.md`.
5. Commit once (one task, one PR). No per-directory fix commits are expected.

## Constraints

- **Gate:** no other `src/**` PR open in the same session. Catalog batches may
  run in parallel (they never touch `src/**`). No dependency on F-05 — strict is
  a config-only change and can land independently.
- No behaviour change; the test suite is the contract.
- No edits to `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**` or
  `tools/catalog-*`.
- One PR; no merge.

## Acceptance (executable)

- `tsconfig.app.json` contains `"strict": true`; `tsconfig.test.json` inherits it.
- `pnpm typecheck` passes with **0** errors and no new suppressions.
- `pnpm lint && pnpm test && pnpm build` green.
- The four empty `index.ts` files are gone; no barrel imports remain.
- If any source file changed, the PR explains why (a real bug, not ceremony).
- No edits outside `src/**` + `tsconfig.app.json` (+ this task file and
  `docs/progress.md`).

## Notes

- **E2E is not required here:** config + four unused file deletions cannot change
  behaviour. State "no behaviour change, E2E unaffected" in the PR. If the owner
  wants one confidence run, run only the smoke spec — never a full triple run.
- **Stop condition:** more than ~10 strict errors (a real divergence from the
  measured baseline) → stop, report, and split the fix into its own task.
- A code-review pass is optional for this mechanical config change; the checks
  are the re-check.
