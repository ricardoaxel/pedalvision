# T-4b — Image source discovery upgrade (researcher + scout + rules)

**Phase:** P5 · **Status:** in review — PR #73 · **Type:** process/agent rules (docs-only) · **Depends on:** T-4 (owner request 2026-10-28)

## Goal

Stop batches from defaulting to Pedalplayground. Make the catalog agents run a
real **image-source discovery pass** (official → Google/Bing Images discovery →
Amazon/Andertons/retailer/community → planner last resort → generated last),
record every reusable source, and gate images on a **dark-background** contact
sheet so halos/speckle are visible. Add a **planner-share guard** so a batch cannot
ship with a planner majority without a documented discovery round and an owner
waiver.

Owner request (2026-10-28): “just looking at Google Images I found usable images
for EHX 1440 … improve the researcher agent to find those kind of resources …
Amazon, Andertons, Google Images in general … it's ok to use Pedalplayground as a
semi-last source but not that all our batches have a majority of them.”

## Problem evidence (T-4)

- EHX/MXR first passes defaulted to planner (26/26 each) after official photos
  failed; a simple Google Images search found a 1500 px Amazon product render for
  EHX 1440 (later rejected as high-angle, but the **discovery** worked and is not
  captured in the agent workflow).
- White-background contact sheets hid the MXR white/black edge speckle; the owner
  only saw it on the dark canvas. A dark-background sheet exposes it.
- `catalog-pedal-researcher.md` and `catalog-image-scout.md` still say “never use
  planner”, contradicting the T-1a policy.

## Proposed changes (implementation after token review)

1. **`catalog-pedal-researcher.md`**
   - Fix the stale planner rule; state the full hierarchy.
   - Add a mandatory, bounded discovery pass per batch:
     - official brand product/manual/press/support (try `_top`, `_front`,
       transparent PNG, support zips);
     - **Google Images / Bing Images discovery only** (exact `"<brand> <model>"
       pedal`; open the source page; record the underlying URL, never the search
       URL);
     - **Amazon product gallery**: fetch the product page, extract `"hiRes"` URLs
       (`m.media-amazon.com/images/I/..._AC_SL1500_.jpg`);
     - **Andertons / Sweetwater / Thomann / Guitar Sanctuary / Mercado Libre /
       Reverb/eBay** and manufacturer press kits; record the source page.
     - planner/Pedalplayground last resort; generated art last.
   - **Bound it per batch, not per item:** at most **2 search-engine pages** and
     **20 source-page fetches** per batch (≤3 for any one item), and only for
     items whose official/retailer candidate failed. Never fetch HTML into
     context: a deterministic `curl` + regex helper extracts candidate image URLs
     (`_AC_SL1500_`, `cdn.shopify.com`, `cdn11.bigcommerce.com`) and hands back
     ≤10 URLs. The researcher owns discovery; the scout never re-searches per
     item.
   - **Search engines are opportunistic:** exactly **one** Google/Bing Images
     attempt per batch. If it returns 403/429/consent/captcha/empty, log
     `zero-yield` once and fall through to registry/brand-site/retailer pages —
     never retry, never substitute another engine. Anchor the pass on
     registry-first → brand site search/press/support → retailer product pages
     reached from the brand page.
   - Add a **source-discovery log** (queries, candidate URLs, accept/reject
     reasons, zero-yield) to the raw/task record; tell the coordinator to append
     reusable sources to the registry.
   - **Marketplace images (Amazon/Sweetwater/Andertons/Thomann):** treat them as
     candidate **locators** first — trace the identical render to the official
     press/support asset. Ship marketplace pixels only when no official asset
     exists, recorded as `kind: "retailer"` + `license-pending` and counted as a
     source gap; record the **product page URL** (never a search URL) plus the
     resolved CDN URL; cache the download once under gitignored `work/`; never
     hotlink.
   - **Planner-share guard (measured, not a mid-wave stop):** compute the share
     of new/replaced items that use planner from the batch's raw records (or
     `catalog:license-report`). Target **≤30%**; if the first pass exceeds
     **50%**, run one documented discovery round. If it is still >50%, proceed
     to the PR with the share and a **waiver line** — the owner decides at merge.
     No mid-wave owner ping; no silent majority-planner batch.
2. **`catalog-image-scout.md`**
   - Same hierarchy/discovery notes; remove “never planner”.
   - Add Amazon `hiRes` extraction and Google/Bing discovery examples.
   - Make **one dual-tone contact sheet** mandatory: split each cell diagonally
     white/dark or use a checkerboard, so a white **or** black halo/fringe is
     visible. One sheet, one vision pass; no separate white+dark call (the MXR
     failure was invisible on white).
   - Reject high-resolution **angled** images on the flatness gate; resolution is
     not flatness.
   - Add the planner-share check.
3. **`docs/catalog/image-source-registry.md`**
   - New rows: Amazon product-gallery `hiRes` (marketplace/manufacturer renders;
     check flatness; 1440 sample: 1 candidate found, 0 flat — high-angle);
     Google/Bing Images (discovery only; record the underlying source);
     Guitar Sanctuary BigCommerce 1280×1280 (black background/no alpha; matte
     carefully).
   - Add a “discovery protocol” checklist and the 1440 rejected-candidate note.
4. **`docs/tasks/P5-batch-template.md`, `docs/catalog-backfill.md`, `AGENTS.md`,
   `docs/tasks/P5-03-image-completion-plan.md`**
   - Add the discovery pass, dark-background sheet, and planner-share guard to
     the batch rules/plan for T-5+.
   - Keep the existing budgets: 400k/800k per batch, 1.6M/2.4M wave, one vision
     pass + one fix pass, ≤1 light code review.

## Validation on the EHX/MXR batches (2026-10-28 — completed)

Tried the proposed approach on the whole EHX batch (and representative MXR items)
before landing this PR:

- **Search engines:** Google Images blocks this network with “unusual traffic”
  (captcha). DuckDuckGo Images worked for the first ~5 queries, then returned a
  bot challenge; a multi-source pass has to cache/back off, not hammer one engine.
- **Sources tried:** DuckDuckGo Images → Sweetwater, Andertons, Chicago Music
  Exchange (Shopify), Amazon product galleries (`hiRes`), Jim Dunlop/MXR official
  multi-view images, official EHX gallery.
- **Candidates found:** high-res real images (e.g. Sweetwater transparent PNG for
  #1 Echo 2521×3000; Amazon 1500 px 1440 and Carbon Copy; Andertons/Sweetwater
  Bad Stone; official 2020 Tuner/v2 1000 px).
- **Gate result:** every candidate failed the flat/clean-alpha gate for a concrete
  reason — 3/4 perspective renders with visible side walls (Sweetwater #1 Echo,
  Amazon 1440, official tuners), background/shadow strips (Sweetwater/Andertons/
  MXR official), or a right-side backdrop mass (Amazon Carbon Copy). The
  Pedalplayground cutout remained the only **orthographic flat** asset.
- **Conclusion:** the workflow works as a discovery + provenance + gate, but it
  cannot make 3/4 product renders orthographic. For these two batches the planner
  is still the best flat source. **Result after the owner review:** EHX merged as #74 with 9 flat real sources + 14 planner per the owner’s list + 3 original real; MXR #72 uses **14 official Dunlop `MAIN` 1400 + strong matte** and **12 planner fallbacks**. The 1:1 audit corrected the contact-sheet over-flagging (bezels are not side walls) and the owner’s explicit list overrides the agent. The workflow is validated; this PR carries the rules.

## Bounded workflow (for the token review)

1. Official pass first (existing).
2. If no usable flat top-down: **one** opportunistic Google/Bing Images attempt
   per batch; extract candidate URLs with the helper; open ≤20 source pages
   (≤3/item) from registry/brand/retailer; record URLs. If blocked, log
   zero-yield and continue.
3. One dual-tone contact sheet; one vision call (10–30 cells); one batched fix
   pass if needed.
4. Planner only for the remaining gaps; count them; log the share.
5. If planner >50%, one documented discovery round; still >50% → PR with the
   share + waiver line (owner decides).
6. No per-item vision, no bulk scraping, no extra searches for optional fields.

## Stop conditions

- Planner share >50% after the documented discovery round without a waiver line.
- >2 search-engine attempts, >20 source-page fetches, or >3 page fetches for one
  item; any search endpoint 403/429/consent/captcha/empty after the one logged
  attempt.
- Batch billed >600k (discovery overhead) or approaching the 800k hard / 2.4M
  wave.
- A second vision pass is requested, or a source has no opened source page /
  recorded URL / rights note.
- Any 429/401/quota/timeout/empty model/provider response — stop and report.
- A source with no recorded URL or an unverifiable rights/provenance note.

## Acceptance

- Agents/rules no longer forbid planner and require the discovery pass + dark
  sheet + planner-share guard.
- Registry records Amazon/Google/Bing/Andertons/Guitar Sanctuary and the 1440
  rejected candidate.
- T-5+ tasks carry the new pass; budgets unchanged.
- Token review verdict recorded; one PR; no merge.
