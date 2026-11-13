# F-45a — Access-model ADR

**Phase:** 1 · **Status:** in progress · **Model:** light (docs-only)

## Goal

Record the access model — free anonymous, free account, supporter monthly and
one-time donation — as an ADR so F-44 (accounts) and F-45b (payment/entitlements)
have an owner-approved decision of record. This task ships **no implementation**:
no accounts, payments, entitlement checks, tracking, UI or backend.

Ties to the roadmap Phase 1 item **F-45a** ("access-model ADR: free/account/
supporter/one-time; no implementation yet") and `docs/tasks/feature-roadmap-proposal.md`
§3.

## Read first (context pack)

- `docs/progress.md`
- `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1, §3 (access model), §4
  (docs/privacy/analytics), Phase 4 and Phase 5
- `docs/requirements.md` — N1 (accounts deferred), F8/F9/F10
- `docs/decisions/002-hosting-and-assets.md` (hosting/commercial-use constraints)
- `docs/decisions/009-planner-fill-waiver.md` (ADR format precedent)

Read only the pointed sections; do not read whole docs.

## Workstream / boundaries

- **Docs-only.** Allowed files: `docs/decisions/010-access-model.md`,
  `docs/tasks/F-45a-access-model.md`, `docs/progress.md`, `docs/roadmap.md`,
  `docs/tasks/feature-roadmap-proposal.md` (status/links only).
- **Never edit** `data/catalog/**`, `public/pedal-assets/**`, `src/catalog/**`,
  `tools/catalog-*`, `src/**`, `e2e/**`, `public/hub/**`, config or dependencies.
- Shared schema/config/docs are coordinator-only: this task needs none.
- Separate branch/worktree; **one PR**; no merge.

## Constraints

- cm/geometry, render, share and persistence are untouched; share stays **v5**.
- **Design gate:** n/a — no rendered UI.
- **Code review:** skipped — docs-only (AGENTS §Code review).
- **Token/agent review:** n/a — no process, rule, agent or budget change.
- **Performance guardrail:** n/a — no runtime change (bundle/JS/CSS unchanged).
- No pricing decisions; those stay open for the owner in F-45b.

## Scope

1. Record four access states (free anonymous, free account, supporter monthly,
   one-time donation) and what each includes.
2. Record the **never-paywalled** list (planner, basic cables/power warnings,
   local save, share/export, catalog, help).
3. Record launch policy: beta free, supporter tiers at launch, grandfather beta
   users; one-time = badge + **12 months** (not lifetime cloud); community
   contributions free for account holders.
4. Record explicit **open decisions** for F-45b (prices, caps, provider, tax/
   refunds, grandfathering window, which advanced-export options).
5. Record guardrails: no forced account, no core paywall, local data never held
   hostage, no dark patterns, read-only sharing stays account-free, no tracking
   before Phase 5, offline/local-first preserved, additive implementation only.
6. Record alternatives considered (all free, paywall core, ads/affiliate,
   lifetime one-time, forced account, separate paid app).

## Non-goals

- No accounts/auth, payments, checkout, entitlements, feature gating, UI,
  analytics, backend, schema or share-version change.
- No public docs-hub page change (no user-visible behaviour yet).
- No prices or commercial launch commitment.

## Acceptance (executable)

- `docs/decisions/010-access-model.md` exists with Status, Context, Decision
  (four states + never-paywalled + launch policy + open decisions), Guardrails,
  Consequences, Alternatives and References.
- The four states and never-paywalled list match
  `docs/tasks/feature-roadmap-proposal.md` §3 with no contradictions.
- `git diff --stat main...HEAD` touches only the allowed docs files; no
  source/catalog/tool/config/dependency changes.
- Share version is unchanged (**v5**); no code path changed.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (unchanged
  baseline).
- E2E: not run — docs-only, no user-visible or runtime change.
- Docs hub: `n/a — internal decision record, no user-visible feature yet`.
- Feature map: `n/a — no behaviour or contract change`.
- One PR; no merge.

## Notes

- This task deliberately does **not** decide prices or the payment provider.
  Those are owner decisions in F-45b, together with a provider dependency note/ADR.
- Any future paid launch must revisit ADR-009 (non-commercial planner fill) and
  update `/privacy` + `/terms` before shipping.
