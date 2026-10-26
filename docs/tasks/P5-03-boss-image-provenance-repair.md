# P5-03: BOSS image-provenance repair + stricter image policy

**Phase:** P5 · **Status:** in progress (repair + policy PR) · **Type:** repair + policy (not a batch)

## Why

The BOSS wave shipped 78 items with **77 last-resort Pedalplayground cutouts**. A
deterministic + vision audit found that the premise (“official BOSS art is only
3/4 perspective”) was wrong: the official `_top_gal`/`_gal` gallery images are
**flat top-down** (aspect error 0–2%) but the analyzer’s row-width perspective
metric false-positives on the BOSS **trapezoid enclosure** (32–41%). The owner
asked for (a) a real effort to re-source BOSS from official/authorized/user images,
(b) a stricter rule that never ships planner pixels, (c) a fix for the analyzer
false positive, and (d) a reusable registry of good sources.

## Scope

- Repair the 78 BOSS items in `boss-1`, `boss-2`, `boss-3`.
- Add the typed `imageProvenance` raw field + `catalog:check-images` gate.
- Update the image policy (AGENTS, ADR-003, backfill, template, raw-record doc,
  researcher/scout/reviewer agents) and add `docs/catalog/image-source-registry.md`.
- One PR; no merge.

## What changed

### Analyzer

`tools/asset-pipeline/analyze.ts`: a symmetric trapezoid with a **flat top edge and
no skew** is now a **shape taper**, not perspective. Pedals never reject on the
row-width ratio alone; a non-taper signal is a flag for the contact-sheet reviewer.
A real board perspective is still rejected. Tests cover a synthetic BOSS-like
trapezoid, an uneven-top pedal, a board trapezoid, and the committed BOSS compact
asset.

### Re-sourced (47/78, all official BOSS)

Official BOSS product-gallery `_top_gal`/`_gal`/`_main_gal`/`_F_gal` images,
`--matte flood`, AVIF q80 (q90 where needed), PSNR ≥ 40 dB, one dark-matte contact
sheet pass: **47 SHIP / 0 FIX / 2 REJECT**. The 2 rejects (ES-5/ES-8) were an
official `_top_gal` rear-connector strip, not the top face; the hi-res support-zip
`F` image is top-down but its light-grey card/shadow did not pass the clean-alpha
gate, so they stay pending.

### Pending (31 pedals + 1 board)

- **29 vintage/current pedals** with no usable official flat top-down (retired
  product pages; the 40th-anniversary promo PNGs are only 400 px): AC-2, BF-2B,
  CE-1, CE-2, CE-2B, CE-3, CS-2, DC-2, DC-3, DD-2, DD-5, DF-2, DM-2, DM-3, DS-1-4A,
  DS-1WH, DSD-2, DSD-3, EH-2, EV-1-WL, EV-30, EV-5, FS-5L, FS-5U, FT-2, FV-100,
  FV-500, FZ-2, FZ-3.
- **ES-5, ES-8**: top face exists in the hi-res support zip but the matte left a
  light-grey card/shadow; kept pending rather than shipping an unclean cutout.
- **Temple Audio Duo 24 board**: pre-existing board-pilot planner asset; boards must
  ship our own generated flat art. Marked `pending-replacement`; board-art follow-up.

Each pending record keeps its current asset, carries `imageProvenance: { kind:
"planner", status: "pending-replacement", note }`, and is listed here so the next
task can finish them with retailer/user images or generated flat art.

### Policy + registry + gate

- `AGENTS.md`, `ADR-003`, `docs/catalog-backfill.md`, `P5-batch-template.md`,
  `raw-research-record.md`, and the researcher/scout/reviewer agents: source order
  **official brand/press/support → authorized retailer → user/community (recorded)
  → our own generated flat art**; **planner pixels are never shipped**; planner is
  reference-only for generated art and only as a documented owner-approved edge
  case; record `imageProvenance`; consult/append the registry.
- `docs/catalog/image-source-registry.md`: reusable sources with URL patterns,
  brands, hit rates and caveats (BOSS gallery/support zips, Meris, Red Panda, JHS,
  TC, retailers, users). Planner is deliberately excluded.
- `catalog:check-images`: fails a raw batch that references planner art without a
  deliberate `imageProvenance` (`pending-replacement` warns, `owner-approved-edge-case`
  passes, anything else fails); wired into `catalog:ci`.

## Sources used

- BOSS product pages → `static.roland.com/assets/images/products/gallery/*_top_gal.jpg`
  (49/55 sampled usable top-down).
- BOSS hi-res support images → `static.roland.com/assets/media/zip/<slug>.zip`
  (top-face `F`/`T`; used to diagnose ES-5/8).
- Official/authorized sources for the other brands are recorded in the registry.

## Testing

| Gate | Result |
| --- | --- |
| Analyzer tests | 12/12 (shape taper + real BOSS fixture) |
| Raw schema | 26 tests (incl. typed `imageProvenance`) |
| `catalog:ci` | **270 pedals / 15 boards**; jacks green; **32 pending** image provenances |
| `catalog:validate` | green (178 items / 386 files / 21.3 MB; boards 15 / 30 / 2.0 MB) |
| `catalog:guard-batch-pr --allow-pipeline` | clean |
| `pnpm lint` / `typecheck` / `test` / `build` | green (4 pre-existing warnings; test 84 files) |
| `pnpm e2e` | **258 passed + 7 skipped** (desktop + mobile Chromium) |
| Image QA | calibration (official top-down 10/10), final 49-cell dark-matte pass (**47 SHIP / 2 REJECT**), ES matte-mode re-check (not clean → reverted), PSNR 40–45 dB |

## Budget

One repair session, ~4 h active; no catalog-runner batch. Vision: 1 feasibility
sheet, 1 calibration sheet, 1 final 49-cell pass (2 sheets), 1 targeted ES re-check,
1 matte-mode re-check — higher than a normal batch cap, justified by the owner’s
repair request and the source change.

## Acceptance

- 47 BOSS items ship official top-down BOSS images; 31 are honestly marked
  `pending-replacement` (no planner silently re-labelled).
- Planner is no longer a shipping source; the gate blocks new accidental use.
- The analyzer no longer rejects a flat BOSS trapezoid; tests prove it.
- Registry + rules updated; one PR; no merge.

## Follow-ups (not in this PR)

- Replace the 31 pending assets (retailer/user or generated flat pedal art).
- Repair the Temple Duo 24 board with generated flat art.
- If a future official support zip has a clean `T`/`F` top face, re-check ES-5/ES-8.
