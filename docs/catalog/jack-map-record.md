# Community jack-map record (P5-01)

Optional, evidence-backed jack layouts contributed by users. A jack map fills
exact anchor positions for pedals where no manufacturer layout is published. It
never replaces the documented fallback anchors until it is **approved**.

- **Approved maps only** reach the raw archive; the runtime catalog projects
  `jacks[]` from there.
- A contribution is **pending** on submission, **approved** when reviewed and
  merged, and **rejected** with a reason otherwise.
- Evidence and contributor credit are kept; user photos follow the same
  attribution/takedown policy as catalog images.

## Record shape

```jsonc
{
  "recordVersion": 1,
  "id": "boss-ds-1",
  "status": "pending",                 // pending | approved | rejected
  "contributor": {
    "handle": "example",
    "url": "https://github.com/example" // optional profile/credit link
  },
  "evidence": [
    {
      "type": "photo",                 // photo | manual | measurement
      "url": "https://…",              // evidence image/document
      "note": "Top-down photo with a ruler; jacks visible."
    }
  ],
  "jacks": [
    {
      "label": "IN",
      "kind": "in",
      "edge": "right",
      "pos": 0.5,                      // 0..1 along the edge
      "connector": "ts",
      "stereo": false,
      "note": "Measured 3.65 cm from the top on a 7.3 cm-wide pedal."
    }
  ],
  "reviewedAt": "2026-10-21",          // set when approved/rejected
  "reviewer": "catalog-reviewer",      // reviewer handle/id
  "notes": "Replaces the assumed IN-left/OUT-right fallback pair."
}
```

- `pos` is normalized to **0..1** along the chosen `edge`; derive it from exact
  cm (`x / widthCm` on top/bottom, `y / heightCm` on left/right). Do not invent
  positions; an edge-only map that omits `pos` stays approximate.
- `stereo: true` marks a TRS jack that accepts two cables.
- `connector` uses the same vocabulary as the raw archive
  (`docs/catalog/raw-research-record.md`).

## v1 — GitHub flow (no backend)

1. The builder produces a copyable JSON snippet for the pedal (the “suggest jack
   layout” mode, P5-02 UI).
2. The user opens a **prefilled GitHub issue/PR** (no account on our side, no
   server, no automatic write) with the snippet + evidence links.
3. A reviewer checks the evidence against the footprint, asks for corrections,
   and either merges the map into the raw archive (`status: approved`,
   `reviewedAt` + `reviewer` filled) or closes it (`status: rejected` + reason).
4. Approved maps are projected into the runtime catalog by the deterministic
   catalog build.

## v2 — backend (future)

- Accounts + moderation queue + database.
- Rate limits and spam controls; contributor credit and contributor profiles.
- Versioned records (superseded maps stay auditable), reviewer roles, and a
  removal path for evidence/images.
- No automatic publication: approved-only, as in v1.

## Quality rules

- Evidence-backed: a photo/manual/measurement link or an explicit measured note.
- Convert measured cm to `pos`; keep the measurement in `note`.
- One record per pedal model; colorways share the base model's jack map.
- Approved records are versioned and reviewable; rejected records keep the
  reason so the contributor can fix and resubmit.
- User evidence photos are covered by the attribution/takedown page; removal
  requests are honoured.
