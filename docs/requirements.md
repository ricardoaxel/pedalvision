# Pedalvision — Requirements (v1)

## Vision
A web app for musicians to design true-to-scale pedalboards **before building them physically**. Multiple boards on one infinite canvas, real cm dimensions, cables, save/share — **no account required**.

## Users
Guitarists/bassists planning a physical pedalboard; comparing board options; sharing layouts with bandmates/techs/forums.

## Competitor learnings (do's & don'ts)

### pedalplayground.com
- ✅ DO: instant use, no login wall, easy to learn, community-maintained library
- ❌ DON'T: **positions scramble on viewport resize** → we store cm world-coordinates (A1)
- ❌ DON'T: ugly/dated UI → design tokens + dark theme from P0
- ❌ DON'T: only latest board survives in localStorage → multi-scene save (F8)

### pedalboard.app
- ✅ DO: modern UX; search by brand + effect type; custom pedals with power data (voltage, AC/DC, current, jack locations); pedal info panel with tags; space warning that warns but allows placement; saved sessions
- ❌ DON'T: one board on canvas at a time, centered → **infinite canvas, multiple boards, free pan** (F1)
- ❌ DON'T: layers locked to fixed position slots → **free z-order** (F5)
- ❌ DON'T: toast spam (e.g. "sign in to save") → inline states and clear redirects
- ❌ DON'T: overcomplicated modal stack → modal on desktop, bottom tabs on mobile
- ❌ DON'T: cable *length* field but no real connections → real cable system (F12)
- ❌ DON'T: shop links not locale-aware → locale-aware links in v2 (non-goal N5)
- Improvement: "Explore" exists but generic → v2: famous/trending boards (non-goal N4)

### stompboxgarden.com
- ✅ DO: **cable management with direction arrows + Amp/Instrument endpoints** (F12)
- ✅ DO: share links (F10); themes (v2); community gear submissions with moderation + "uploaded by" attribution (v2); jack anchor labeling on image edges; **cm/in unit toggle** (Settings)
- ✅ DO: mobile picker as bottom tab bar (F11)

## V1 features (Must)
| ID | Feature |
|---|---|
| F1 | Infinite dotted canvas: pan (drag / two-finger), zoom to pointer (wheel / pinch), multiple boards anywhere |
| F2 | True scale: all geometry in cm; catalog sizes drive rendering; px only at render time |
| F3 | Boards: place / move / rotate catalog boards; custom-size board creator (any W×D) |
| F4 | Pedals: catalog picker → place → drag / free-rotate (any angle) / duplicate / delete |
| F5 | Layers: free z-order controls for **items within a board** (bring forward / send back) — no fixed slots. Boards stack by array order in v1; board-to-board stacking control is v2 (S6) |
| F6 | Selection: hover highlight, click/tap select, rotate handle + action buttons (stompboxgarden-style), touch-friendly targets; keyboard shortcuts: delete/duplicate ship with P1, undo/redo shortcuts ship with undo in P3-04 (phased — N2) |
| F7 | Custom pedal creator: brand, name, **category (pedal/supply)**, W/D (cm/in toggle), effect categories, jack locations (**edge + position along edge**), power (V, AC/DC, mA) |
| F8 | Save/load: multiple named scenes, IndexedDB + localStorage, autosave (debounced), **undo/redo (snapshot store)**, storage-failure fallback (inline warning + JSON download) |
| F9 | Export PNG via a **detached offscreen Stage** (never the live stage): scope = selected board (board + attached pedals + cables with BOTH endpoints in scope, endpoints within board bounds + margin) OR all content (fit-capped); pixelRatio ≤2 + total-pixel clamp for iOS; surface-color background |
| F10 | Share: URL-encoded scene (deflate → base64url in hash); recipient gets read-only view |
| F11 | Responsive from day 1: desktop toolbar/modals, mobile bottom tabs |
| F12 | Cables: drag-connect pedal→pedal with direction, amp input / instrument endpoints, auto length calc + summary |

## Non-goals (v1)
| ID | Deferred / excluded |
|---|---|
| N1 | Accounts / login (v2: Google OAuth) |
| N2 | Cloud sync of scenes (v2) |
| N3 | Power-supply planner (v2; schema already reserves power fields) |
| N4 | Explore / trending / famous boards showcase (v2) |
| N5 | Affiliate "where to buy" links (v2, locale-aware; schema reserves `links`) |
| N6 | 3D / 2.5D rendering |
| N7 | Fixed-position layer system |
| N8 | Toast-only error/UX patterns |
| N9 | **Launching with the dev placeholder catalog** (see decisions/003) |
| N10 | Tiered/riser boards (deferred from v1 — needs tier offsets; see decisions/003 + S4) |

## Global acceptance criteria
| ID | Check |
|---|---|
| A1 | Resize browser window → pedal positions relative to their board are unchanged (the pedalplayground bug, tested) |
| A2 | `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e` all green in CI |
| A3 | Export PNG on iOS Safari produces a valid non-blank image |
| A4 | Save scene → reload app → identical state (positions, rotations, z-order, cables) |
| A5 | Open share URL in a clean browser → identical scene, read-only (incl. custom pedals — they travel inline in the payload) |