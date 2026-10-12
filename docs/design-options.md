# Design direction options — decision pack

**Status:** owner decision pending (2026-10-12) · **Produced by:** the `designer` agent (staff-level UX/UI, ADR-005) · **Why:** the owner rejected the "Studio Clay" direction (warm graphite + clay accent) as still reading too orange; the requirement is genuinely better, **non-warm-orange** options with different palettes **and** fonts.

All four directions are **cold-only** (no warm/orange/amber/clay as accent or overall cast), keep the existing token names and the dark-default `[data-theme="light"]` override, and clear WCAG AA (4.5:1 text / 3:1 large) in both themes. Fonts are shown rendered with **zero-dependency system stacks** (no new deps, per the minimal-dependencies rule); each direction also lists the optional **self-hosted** pair (static font files, no JS deps) if the owner later wants pixel-perfect type.

Renders: `docs/screenshots/design-options/` (each direction, dark + light).

---

## 1. Ashen Editorial

Cold-near-black + cobalt-blue accent, national-editorial serif display voice. Depth purely from a luminance ladder + hairline borders — pedal photos are the only real color on canvas.

| Token | Dark | Light |
|---|---|---|
| canvas-bg | `#0b0c0d` | `#f6f7f8` |
| grid-dot | `#1e2023` | `#dfe2e5` |
| surface / raised | `#141517` / `#1c1e21` | `#ffffff` / `#f0f2f4` |
| border | `#2b2e32` | `#dfe3e7` |
| ink / muted | `#f4f5f6` / `#a4a8ac` | `#14171a` / `#5c6167` |
| accent / strong | `#7ba0e0` / `#5c86cf` | `#2f5fa8` / `#24497f` |
| cable | `#cfd3d7` | `#3a3e42` |

Contrast (AA ✓): ink 15–18:1, muted 6–8:1, accent-on-canvas 5.9–7.4:1, on-accent text 5.3–9:1.
Type: display `Iowan Old Style/Palatino` serif + body `SF Pro/sans-serif`, mono labels (zero-dep); self-hosted: **Newsreader + Inter**. Sharp radii (3/6/10).
Screenshot: `1-ashen-editorial-dark.png`, `1-ashen-editorial-light.png`.

## 2. Verdigris

Cool blue-green (patina) system — teal-black canvas, deep-green accent (every green hue 160–170, never olive/amber), "field notebook" organic-product cast.

| Token | Dark | Light |
|---|---|---|
| canvas-bg | `#0a100f` | `#f3f6f4` |
| grid-dot | `#1b2523` | `#dbe3df` |
| surface / raised | `#101817` / `#17211f` | `#ffffff` / `#eef3f0` |
| border | `#263230` | `#d8e0dc` |
| ink / muted | `#eef3f1` / `#9fb0ab` | `#12201c` / `#56655f` |
| accent / strong | `#5aa88f` / `#3f8f78` | `#2d7a62` / `#23624f` |
| cable | `#c9d4cf` | `#33463f` |

Contrast (AA ✓): ink 15–17:1, muted 5.6–8.5:1, accent-on-canvas 4.7–6.8:1, on-accent 4.9–7.2:1.
Type: `Avenir Next` grotesque + mono labels with tabular figures (zero-dep); self-hosted: **Hanken Grotesk + IBM Plex Mono**. Soft radii (4/9/14).
Screenshot: `2-verdigris-dark.png`, `2-verdigris-light.png`.

## 3. Indigo Dusk

Violet-tinted near-black + desaturated indigo/periwinkle accent — calm-tech "digital lavender" (Linear/Arc-adjacent), the most modern-software of the four.

| Token | Dark | Light |
|---|---|---|
| canvas-bg | `#0b0b13` | `#f5f5f9` |
| grid-dot | `#1e1f2c` | `#e0e0ea` |
| surface / raised | `#12131d` / `#1a1c29` | `#ffffff` / `#eeeef5` |
| border | `#292b3b` | `#dedee9` |
| ink / muted | `#f0f0f6` / `#a3a5b6` | `#16161f` / `#5a5c6b` |
| accent / strong | `#8f92e6` / `#6f72d6` | `#4f52b5` / `#3d3f93` |
| cable | `#cfd0dd` | `#3d3f4d` |

Contrast (AA ✓): ink 15–17:1, muted 6–8:1, accent-on-canvas 6–6.9:1, on-accent 4.7–9:1.
Type: `Avenir Next`/SF Pro display + SF body, mono labels (zero-dep); self-hosted: **Sora + Inter**. Radii 4/8/12 unchanged.
Screenshot: `3-indigo-dusk-dark.png`, `3-indigo-dusk-light.png`.

## 4. Blueprint

Navy-black + cyan technical accent, **mono-forward** drafting aesthetic — the language of true-scale schematics (IBM Plex / Teenage Engineering), the spot-on voice for a cm-accurate planner.

| Token | Dark | Light |
|---|---|---|
| canvas-bg | `#070b12` | `#f2f6f9` |
| grid-dot | `#16202e` | `#d8e2ea` |
| surface / raised | `#0d1420` / `#141d2b` | `#ffffff` / `#ecf2f6` |
| border | `#21303f` | `#d6e0e8` |
| ink / muted | `#eaf1f7` / `#93a6b6` | `#0f1a24` / `#4f6270` |
| accent / strong | `#66c9de` / `#3aa9c2` | `#167089` / `#14677e` |
| cable | `#b9cbd8` | `#2f4250` |

Contrast (AA ✓): ink 16–17:1, muted 5.8–7.9:1, accent-on-canvas 5.2–10.3:1 (most headroom of the four), on-accent 5.7–9.9:1.
Type: mono-led (headings, labels, dimensions, `tabular-nums`) + SF/sans body (zero-dep); self-hosted: **IBM Plex Mono + Inter**. Sharpest corners (2/4/6).
Screenshot: `4-blueprint-dark.png`, `4-blueprint-light.png`.

---

## Designer recommendation

**Ship "Blueprint".** Highest-contrast, most functionally defensible for a *true-scale* tool: the mono-forward type turns dimensions/cm readouts and shortcuts into a coherent visual system (so pedal photos stay the loudest content), the cyan accent has the most AA headroom, and it is the largest intended distance from both the rejected clay and the generic dark-slate+amber pedal-planner cliché. Runner-up: **Ashen Editorial** if you want the calmest, most neutral canvas.

**The one decision that would flip the pick:** *how technical vs. how editorial/friendly the app should feel.* Blueprint = precise engineering instrument; if you'd rather have a warmer-being, softer, consumer-friendly instrument → **Verdigris**; if you want maximum clean neutrality → **Ashen Editorial**.

References researched (2025/2026): Linear & Vercel Geist systems (achromatic ladders, hairline borders), Raycast (luminance-step elevation), "calm/muted natural" 2026 palettes (Ffern/Aesop, Morandi), technical-drafting/mono trend (IBM Plex ecosystem), digital-lavender calm-tech palette (Linear/Arc/2026 wellness-UI).