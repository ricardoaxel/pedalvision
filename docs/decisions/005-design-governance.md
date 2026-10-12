# ADR-005: Design governance — the designer agent owns visual direction

**Status:** Accepted (2026-10-12)

## Context
The plan was frozen (post-R6) with a default "dark slate surfaces + warm amber accent (guitar-amp vibe)" palette. On first delivery (P0-03), the owner rejected it: it read as the same generic pedal-planner aesthetic as every competitor, and the ask was for a genuinely modern, subtle, refined but friendly design. The dev cycle needs a way to make and review design decisions that is repeatable, fast, and better than one model's taste on a given day.

## Decision
1. **A `designer` agent is the design authority.** A staff-level UX/UI expert lives in `.opencode/agent/designer.md` and is run via the `/design-review` command (see AGENTS.md → Design gate). It researches current design trends (web) before proposing directions, and reviews all design-affecting work before commit.
2. **The owner approves every new/changed visual direction.** The designer proposes; the owner approves; only then do implementing agents touch tokens/components. An agent never hand-tunes a palette or restyles on feedback without the designer running first.
3. **Design work is gated in the session protocol (AGENTS.md):** every design-affecting task must be reviewed by the designer before commit; if the owner does a design task manually, the session must propose running the designer first.
4. **Single source of truth stays** `src/styles/tokens.css` (+ mirror `src/styles/theme.ts` for the canvas) — no theming libraries, no CSS-in-JS, no hardcoded colors in components.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Static palette decided once by the plan | Plan froze a palette the owner rejected on first sight; taste is not reviewable after the fact |
| CSS library / theme framework | Hard constraints already ban theming libs and CSS-in-JS |
| External/human designer on retainer | Not available in the loop; slow for iterative agent-driven development |
| Agents free-hand colors on feedback | This is exactly the failure mode that produced the rejected palette (2026-10-12) |

## Consequences
- Design PRs (P0-03 redo and all P1+ canvas/UI work) must note which designer review ran, its verdict, and the owner's approval of the direction.
- The designer agent's research step keeps proposals grounded in current (2026) design trends rather than one model's priors — the codification of "use the best online references for style/design trends."
- Slower for tiny visual touches until the feedback loop is trusted; mitigation is that `/design-review` is cheap and the designer returns focused output.