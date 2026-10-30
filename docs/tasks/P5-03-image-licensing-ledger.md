# P5-03: Image licensing ledger + attribution notice

> **Catalog program paused (2026-10-29).** Catalog backfill is closed/paused for now while we continue feature work. This task is not active; it may be resumed later for refilling. See `docs/tasks/CATALOG-PAUSED.md` and `docs/progress.md`.

**Phase:** P5 · **Status:** merged 2026-10-26 — PR #51, squash `8826cb5` · **Type:** data/licensing + small UI

## Goal

Make the **licensing state of every catalog image** explicit and auditable, and
give users a clear “not affiliated / request removal” path. This is the follow-up
to PR #50 (BOSS image-provenance repair). It does not send permission emails
itself; it produces the request file and the per-asset ledger so the owner can.

## Status model (internal only)

Per item, two independent facts:

- **`licenseStatus`**: `own` · `licensed` · `license-pending` · `replacement-needed` · `none`
- **`imageHosting`**: `static` · `hotlinked` · `mock`

Current classification (285 items: 270 pedals + 15 boards):

| Status | Items | Meaning |
|---|---:|---|
| `license-pending` | 165 | Official/authorized images in use while permission is requested (73 self-hosted + 92 hotlinked legacy seed) |
| `replacement-needed` | 31 | Legacy/replacement-pending BOSS assets with no recorded source |
| `own` | 89 | Our generated flat board art / mock art (74 mock/static placeholder pedals + 15 boards) |
| `licensed` | 0 | Written permission recorded (`licenseRef`) |
| `none` | 0 | No image asset yet |

The statuses are **internal only** (no badge in the app). The only visible changes
are the not-affiliated notice and the removal page.

## Deliverables

- `data/catalog/image-licenses.json` — brand-level contact/status/terms file
  (BOSS/Roland, EHX, MXR, Mooer, TC, Walrus, JHS, Joyo, Behringer, Meris, Red
  Panda, Pedaltrain, Temple Audio; mock-only brands are listed in the generated doc).
- `data/catalog/asset-ledger.json` — one row per pedal/board: asset, image source,
  hosting, source kind, license status, license ref, replacement target, note.
- `docs/catalog/asset-ledger.md` — human ledger (summary + per-brand item list).
- `docs/catalog/image-licensing.md` — contacts, statuses, request log, email
  template, per-brand counts; links to the ledger.
- `tools/catalog-license/` + scripts:
  `catalog:asset-ledger`, `catalog:check-licenses`, `catalog:license-report`.
- `public/attribution.html` — credits/removal page (email
  `ricardoaxelgd@gmail.com` + GitHub issue).
- `InfoPanel` footer notice: “Pedalvision is an independent planner and is not
  affiliated with or endorsed by {brand}. Image credits & removal” (desktop + mobile
  expanded sheet).
- Post-merge workflow regenerates the ledger + docs after mapped/runtime and on
  `image-licenses.json` changes.

## Non-goals

- Sending the permission emails (owner action; template + contacts provided).
- Replacing the 31 legacy / 92 hotlinked images (their brand batches do that;
  the ledger records the replacement target).
- A user-visible license badge (owner decision: internal only).
- Rehosting the 92 hotlinked legacy images as a separate rewrite.

## Checks

- `pnpm catalog:asset-ledger` regenerates; `pnpm catalog:check-licenses` green.
- `pnpm lint` / `typecheck` / `test` / `build`; `pnpm e2e` (desktop + mobile).
- `catalog:ci` (270/15) + `catalog:validate`.
- Unit tests for the ledger classification; e2e for the notice + attribution page.
- Design review: owner-directed simple notice/page; one design-reviewer pass,
  fixes folded (dark palette, 640px column, `sm` footnote, no-wrap link).

## Follow-ups

- Send the permission emails per brand; update `image-licenses.json`
  (`status`, `lastRequestedAt`, `response`, `licenseRef`); re-run the ledger.
- Replace the 31 legacy + 92 hotlinked images in their normal brand batches.
- Keep `license-pending` until a written permission is recorded; flip the brand to
  `licensed` only then.
