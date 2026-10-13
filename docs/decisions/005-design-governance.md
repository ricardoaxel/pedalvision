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

## Amendment (2026-10-12): visual reviewer + designer⇄reviewer loop
The designer proposes from research and intent, but intent is not pixels — a proposal can look wrong once rendered (the rejected "Studio Clay" was approved as a concept and still read too orange on screen). So design work gets a second, adversarial agent that inspects the **actual rendered screenshots**, not the code.

1. **`design-reviewer` agent** (`.opencode/agent/design-reviewer.md`, run via `/visual-review`) — a staff-level visual QA that opens the screenshot PNGs with a **vision model** (default `opencode-go/deepseek-v4-flash-vision-exp`), and judges pixels: hierarchy, color harmony/restraint, type, spacing, consistency, premium-vs-cheap, perceived accessibility. It ranks options and names a preferred one.
2. **Heavy design tasks run a designer⇄reviewer loop, max 3 iterations, gated on owner approval before it starts** (definition of "heavy design task" in AGENTS.md → Design gate). **Every iteration = reviewer feedback on the rendered pixels → designer revision → implementation in code → re-render (dark + light).** A round that only produces comments is not a round — implementation is mandatory each time. Stop early only on an "approve". `/design-loop` orchestrates it; the final result still returns to the owner for approval.
3. **Division of authority:** the designer owns *design intent/direction*; the reviewer is authoritative for *what is actually on screen*. On conflict, present both to the owner (who decides).
4. Only the reviewer requires a vision model; the designer can run on a strong plan-tier model. Neither may merge; the owner approves directions and PRs.