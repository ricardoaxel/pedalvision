# P5-W1 — Planner fallback catalog fill (non-commercial)

**Status:** in progress · **Date:** 2026-10-29 · **Owner-approved waiver**

## Goal

Fill the catalog with every missing item from the external planner dataset,
converted to the app's AVIF 800/350 renditions, without disturbing existing
curated records/assets. Every imported item is a **pending planner placeholder**.

See `docs/decisions/009-planner-fill-waiver.md`.

## Scope

- Input: the external planner JSON (kept out of the repo) with brand, name,
  width/height in inches, and an 800 px image filename.
- Add only items not already matched by id or normalized brand + name.
- Sources: 800 px transparent cutouts → AVIF 800 + 350 (quality 70).
- Raw record: planner image provenance, `pending-replacement`, `confidence:
  "unsure"`, `effectTypes: ["utility"]`, dimensions converted to cm.
- Do not modify existing curated raw records/assets.
- Do not add UI chrome in this task.

## Acceptance

- [ ] Missing items imported: ~8,373 (exact count from the dedupe report).
- [ ] 800 and 350 AVIF exist for every imported item.
- [ ] No duplicate id or normalized brand+name introduced.
- [ ] `catalog:build` / `catalog:validate` pass with the owner-approved raised caps.
- [ ] Asset ledger/license report show the planner pending count.
- [ ] Temp raw downloads removed after the run; report committed under `work/`.
- [ ] PR states the planner-majority/rights waiver, file count, repo-size impact
      and the pending-replacement status.

## Reproduce

```sh
node --experimental-strip-types tools/catalog-planner-fill/index.ts \
  --input <external-planner.json> \
  --source-base-url <image-base-url> \
  --concurrency 4 --write
pnpm catalog:build
pnpm catalog:validate
pnpm catalog:asset-ledger
pnpm catalog:license-report
```

## Risks

- Planner images are not licensed/cleared; non-commercial only.
- Footprints are planner measurements; specs are unverified.
- ~17.9k asset files is close to Cloudflare Pages' file-count limit.
- Planner is now the majority source; the P5 quality launch gate is waived for
  this build.
