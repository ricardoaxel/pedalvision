# ADR-010 — Access model (free anonymous / free account / supporter / one-time)

**Status:** Proposed — owner-approved direction for recording (2026-11-13); final
wording in this PR. **No implementation** (F-45b). · **Owner:** chose F-45a for the
Phase 1 feature lane.

## Context

Pedalvision v1 is deliberately **local-first and account-free** (`docs/requirements.md`
N1): the true-scale planner, local saves, share links, export and the catalog all work
with no backend, no login and no tracking. That is the product's trust and acquisition
model, and it must survive monetization.

Phase 4 later adds accounts, cloud saves and community features (F-44, F-24, F-39,
F-40). Hosting, cloud storage and moderation cost money, so the project needs a clear,
durable answer to four questions before any of that is built:

1. What is free, including for people who never register?
2. What does an optional account add?
3. What does a supporter pay for, and is there a one-time option?
4. What must **never** be paywalled?

`docs/tasks/feature-roadmap-proposal.md` §3 records the owner-approved proposal. This
ADR turns that proposal into the decision of record and constrains how F-45b may
implement it. Prices, caps and the payment provider are explicitly **not** decided here.

## Decision

### 1. Four access states

| State | What it is |
|---|---|
| **Free anonymous** | The default. No account, no login; local-first. |
| **Free account** | Optional registration; adds convenience and community, never removes core use. |
| **Supporter (monthly)** | Paid subscription for higher limits and advanced features. |
| **One-time donation** | Optional one-off payment; not a subscription and not lifetime cloud. |

### 2. What each state includes

- **Free anonymous:** core planner, local saves (subject to the v1 scene/item/image
  caps), share/export, catalog search, custom pedals and boards, cables, undo, help,
  basic power warnings, and the PWA (when F-27 ships). The true-scale editor is the
  same tool as today.
- **Free account:** limited cloud saves, favorites, gallery browsing,
  submissions/corrections, reviews and a profile. Registration is optional; every
  local-only workflow above still works without it.
- **Supporter (monthly):** unlimited cloud saves within abuse/cost caps, tiered boards,
  the full power planner/consumption, advanced export, early access, a badge, private
  boards and priority support.
- **One-time donation:** a founding-supporter badge plus **12 months** of supporter
  features. It is **not** lifetime cloud and does not grant permanent supporter
  entitlements; the badge persists after the 12 months, the paid features do not.

### 3. Never paywalled

The following stay free for everyone, with or without an account:

- the true-scale planner and every core editing operation;
- **basic** cables and power warnings;
- local save/load;
- **share links and export** (the existing PNG/PDF baseline);
- the catalog;
- help and documentation.

A read-only share recipient never needs an account and always sees the full shared
scene, including save-a-copy.

### 4. Launch policy

- **Beta is free.** Supporter tiers are introduced at launch.
- **Beta users are grandfathered.** Their local scenes and the free capabilities they
  already have remain free. Any supporter capability offered during beta gets an
  owner-defined grace period at F-45b; grandfathering is not a free permanent
  subscription.
- **Community contributions are free for account holders.** Contributing to the catalog
  never requires a paid tier.

### 5. Open decisions (owner, F-45b — not decided here)

- Prices, billing cadence, currency, tax/VAT, refunds and chargeback handling.
- Exact cloud-save, private-board and abuse limits per tier.
- The grandfathering window and the "beta user" cutoff definition.
- Exactly which "advanced export" options are supporter-only. The free PNG/PDF export
  baseline can never be removed or degraded.
- Payment provider and checkout design. A recurring-billing provider is a new runtime
  or vendor dependency and needs its own note/ADR before adoption.
- Account provider and identity rules (N1 names Google OAuth as the v2 direction),
  plus data retention, export and deletion.
- How entitlement state is stored and checked, including offline/local-only behaviour.
- Whether tiered boards and the full power planner remain compelling incentives, or
  should stay free.
- Required `/privacy`, `/terms` and consent updates before any paid feature or optional
  tracking ships (F-42 stays Phase 5).

## Guardrails

- **No forced account.** Registration is never required to plan, save locally, export
  or share.
- **No core paywall.** Do not gate the editor, local saves, share/export, the catalog or
  help behind payment or login.
- **The v1 caps are product limits, not a paywall.** A supporter tier may raise cloud
  and complexity limits; it may not make the free editor materially worse.
- **Local data is never held hostage.** Entitlement loss, a lapse or an offline session
  must never block reading, exporting or sharing the user's own scenes.
- **No dark patterns.** No countdowns, fake scarcity, interstitials, ads, or removing
  an existing free capability to sell it back.
- **Read-only sharing stays account-free** and non-mutating.
- **No tracking before Phase 5.** No analytics, telemetry, session replay or PII before
  F-42; the share payload stays client-side in the URL hash.
- **Offline/local-first is preserved.** Entitlement checks are non-blocking and must not
  break the no-account, no-network experience.
- **Additive implementation only.** Accounts, cloud and entitlements are additive; the
  current scene/share/persistence contract (share v5 today) must not change for
  anonymous users.

## Consequences

- F-45b and F-44 have an explicit, owner-approved boundary for what can be sold.
- Trust and acquisition stay intact: the free tool is the funnel, and sharing a link
  never asks the recipient to sign up.
- Monetization requires payments, tax/refund handling, entitlement storage and
  privacy/terms updates; none of that is free to build or operate.
- Some proposed supporter incentives (tiered boards, full power planner) are Phase 2/3
  features. They cannot be sold before they exist, and they must not be used to delay
  or degrade the free core.
- The one-time option is intentionally limited; copy must say "12 months", not
  "lifetime".
- Grandfathering needs a concrete cutoff and grace period at implementation time.

## Alternatives considered

- **Everything free, no funding path.** Simplest and best for users, but it does not
  fund Phase 4 cloud/community costs. Keep as long as possible (beta), then introduce
  optional support.
- **Paywall a core capability (export, cables, share).** Rejected: it violates
  "never paywalled", breaks existing share links and destroys the product's trust and
  acquisition model.
- **Ads or affiliate links.** Rejected for v1: ads conflict with the calm, distraction-
  free editor, and affiliate/locale-aware links are a non-goal (N5) deferred to v2.
- **One-time lifetime purchase.** Rejected: it does not fund ongoing cloud/hosting and
  creates an unbounded entitlement liability. Replaced by donation + 12 months.
- **Force an account to save or share.** Rejected: contradicts the account-free v1
  promise (N1) and the edge-safe share-link model.
- **A separate paid app.** Rejected: it splits the catalog, the community and the share
  graph.

## References

- `docs/requirements.md` — N1 (accounts deferred), F8 (save/undo), F9 (export),
  F10 (share links).
- `docs/tasks/feature-roadmap-proposal.md` §2 Phase 1 (F-45a), §3 (access-model
  proposal), §4 (docs/privacy/analytics), Phase 4 (F-44, F-45b) and Phase 5 (F-42).
- `docs/decisions/002-hosting-and-assets.md` — hosting and commercial-use constraints.
- `docs/decisions/009-planner-fill-waiver.md` — non-commercial-build status that any
  paid launch must revisit.
