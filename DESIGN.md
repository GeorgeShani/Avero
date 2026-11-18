---
name: Avero
description: Your engineering workflow, intelligently orchestrated. A bench-instrument workspace for delegating and reviewing engineering work.
---

<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

# Design System: Avero

## Overview

**Creative North Star: "The Bench Instrument"**

Avero looks like well-made test equipment: quiet matte panels, one signal color, and printed legends instead of decorative labels. The reference family is 1970s and 80s Braun and Teenage Engineering gear, the same lineage as Vercel's spec-01 showcase, translated into a flat, dense, daily-use developer workspace. It is instrument-grade, not toy: the precision of the hardware carries over, the novelty does not.

The surface is a front panel. Information sits on bone or ink panels divided by hairlines. State is read from readouts, meters, segmented controls and legends, not from decoration. Density is high and comfortable: a developer should read which work is running, what needs a decision, and where the evidence is without hunting. Color is scarce. One mineral-green signal marks live and affirmative state; amber and red are reserved for attention and failure.

Both themes are designed, not inverted. Light is bone paper and enamel; dark is ink glass with the same panel logic.

**Key Characteristics:**

- Flat matte panels with hairline rules; depth comes from tonal steps, not shadows.
- One signal color (mineral green). Everything else is neutral surface, ink or reserved status color.
- Readouts and legends are first-class: LCD-style figures for run counters and usage, printed-legend labels for controls.
- Status always pairs color with a symbol and a word.
- Components come from Vercel UI SDK behaviors, restyled by Avero tokens; none are styled to look like rubber keys, bevels or knobs.

**Confirmed visual rejections:**

- Skeuomorphic toy treatment: bevels, knobs, rubber keys, textures that carry no information.
- The generic shadcn-style dashboard template.
- The previous Avero look (sage-green palette, Geist, `console-*` shell) is retired and is not a source for this system.

## Colors

The palette is Ink & Mineral: warm bone and deep ink neutrals, one mineral-green signal, and reserved amber and red. Values below were chosen with the user and are drafts until contrast tuning finishes: text must reach 4.5:1 and control edges, focus rings and state fills 3:1 in both themes, measured in a real browser. Where tuning moves a value, this file is updated.

### Primary

- **Mineral Signal** (light `#2F6F5B`, dark `#6FB89F`): the single brand and live-state color. Used for the active navigation mark, the primary action, focus rings, running state, meter fills and the crossbar of the logo mark. Light uses the deeper value for contrast on bone; dark uses the lighter value on ink.

### Secondary (reserved status)

- **Caution Amber** (light `#8F5A0C`, dark `#D9A441`): awaiting approval and warnings. Anything that needs a human decision.
- **Fault Red** (light `#B5392E`, dark `#E0685B`): failed runs, destructive actions, rejected approvals.

### Neutral

- **Bone Panel** (light `#ECE8DE`): the page ground in light theme, like painted enamel.
- **Bone Raised** (light `#F6F3EA`): cards, tables and inset readouts in light theme.
- **Bone Hairline** (light `#CFC9BA`): rules and borders in light theme.
- **Bench Ink** (light `#1A1F21`): primary text and icons in light theme.
- **Ink Glass** (dark `#14181A`): the page ground in dark theme.
- **Ink Raised** (dark `#1C2224`): cards, tables and inset readouts in dark theme.
- **Ink Hairline** (dark `#3A4244`): rules and borders in dark theme.
- **Bone Text** (dark `#ECE8DE`): primary text and icons in dark theme.

### Named Rules

**The One Signal Rule.** Mineral green is the only brand color. It covers at most one small area per region of a screen, so that when something is lit it means something.

**The Symbol-and-Word Rule.** Status is never carried by color alone. Every state has a distinct symbol and a text label. Working set from the palette study: running `●`, awaiting approval `◆`, completed `✓`, failed `✕`.

**The Reserved Amber Rule.** Amber asks and red interrupts. Neither is used decoratively, and neither appears for non-status content.

**Open decision.** Running and completed both lean on Mineral Signal. They are told apart by symbol and label today. Token tuning must decide whether running gets its own distinct hue or stays mineral with a motion cue.

## Typography

**Display Font:** Hanken Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Hanken Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** Red Hat Mono (with `ui-monospace, SFMono-Regular, Menlo, monospace`) for readouts and code; legends use Hanken Grotesk set small, tracked and uppercase.

**Character:** Chosen with the user as the Swiss grotesk pairing (Braun and Univers lineage): one calm, neutral family does every interface job, and a monospaced face is reserved for data. Hierarchy comes from size, weight and tracking, not from a second display face. It must not look futuristic.

Both families are loaded as self-hosted variable fonts through `next/font`, not from a runtime CDN. Weights are used sparingly: regular for reading, medium for headings and legends, semibold only where a state needs emphasis.

### Hierarchy

- **Page title:** Hanken Grotesk, medium, modest scale (about 20 to 22 px), tight letter-spacing; sentence case, never a dashboard headline.
- **Section title and card heading:** Hanken Grotesk, medium, small; hierarchy comes from size and weight before decoration.
- **Body and table text:** Hanken Grotesk, regular, 13 to 14 px, comfortable for all-day reading at high density.
- **Legend (label):** Hanken Grotesk, medium, about 11 px, tracked (about 0.08 to 0.1em), uppercase. Used for column heads, control legends and region labels so they read as printed legends.
- **Readout:** Red Hat Mono, tabular figures, for counters, durations, usage and run metrics.
- **Code:** Red Hat Mono, for file paths, commit hashes, branch names, terminal output and diffs.

### Named Rules

**The Mono-As-Data Rule.** Monospace is for data: identifiers, paths, hashes, code and readouts. It is not used on every label to look technical.

**The Tabular Figures Rule.** Any number that updates, aligns in a column or is compared with another uses tabular figures so values do not shift.

## Layout

A front-panel grid: panels share one spacing module and align to one baseline rhythm. A persistent desktop sidebar, a contextual header and a main region; an optional secondary panel appears where results sit beside activity, as in the task workspace. Dense technical pages use the full width; prose and forms keep a readable maximum line length.

Density is comfortable-high, tuned for daily work: no oversized KPI cards, no tall table rows, no decorative empty panels. Tables are a major strength, not a set of cards. Panel regions are resizable where the workflow benefits (UI SDK Resizable), and collapse to single-region views on narrow screens instead of forcing three columns. Desktop is primary; tablet collapses the sidebar; mobile prioritises status, approvals, notifications and task details, and does not attempt a full diff workspace.

Exact spacing, breakpoint and sidebar-width values: `[to be resolved during implementation]`.

## Elevation & Depth

Flat by default. Depth is conveyed by tonal steps between ground, raised panel and inset readout, plus hairline rules. There are no resting shadows and no bevels. Floating layers (menus, popovers, dialogs) are separated by a hairline and a single restrained shadow, used only because they genuinely overlay content.

### Named Rules

**The Flat Panel Rule.** Surfaces are flat at rest. Elevation exists only for layers that overlay other content, and at most two floating layers are on screen at once.

## Shapes

Small, consistent corner radii on controls and panels, hairline borders throughout, and square or near-square geometry for readouts and meters. Segmented controls, meters and LCD-style readouts are the signature shapes. Pills are used only for true tags.

**Mark:** the Signal Lambda, a refined monogram. An open A of two mitered strokes with a square mineral block as its crossbar, so the symbol and the "one signal" rule are the same gesture. It must stay legible at 16 px and 24 px, work on bone and ink, and have a monochrome version. The symbol is locked. The wordmark is lowercase "avero" set from Hanken Grotesk Medium with light negative tracking, with the lambda's letterform reconciled to it (outlined to vectors in the final asset); it is drawn when the brand assets are built.

Exact radius values: `[to be resolved during implementation]`.

## Components

Omitted in this seed. No components exist yet. Component behavior comes from Vercel UI SDK (`@ui-sdk/react`, with `@ui-sdk/core` for pieces it does not ship) and is styled by Avero tokens through `data-slot` and state attributes. Re-run the documenter after the first implementation to capture actual components.

## Do's and Don'ts

### Do:

- **Do** use mineral green as the single signal color and keep it rare enough to mean "lit".
- **Do** pair every status color with a symbol and a text label.
- **Do** design light and dark themes separately: bone enamel and ink glass, with matching panel logic.
- **Do** show real run counters, durations and usage as monospaced tabular readouts.
- **Do** label development fixtures as fixtures wherever real data does not exist yet.
- **Do** use hairline rules and tonal steps to separate panels before reaching for color or shadow.
- **Do** meet 4.5:1 for text and 3:1 for control edges, focus rings and state fills, measured in a real browser.

### Don't:

- **Don't** add bevels, knobs, rubber keys or decorative texture; this is an instrument, not a toy.
- **Don't** use amber or red decoratively, or any color as the only carrier of state.
- **Don't** ship a generic shadcn-style dashboard: oversized KPI cards, tall rows, gradient accents or glow.
- **Don't** use monospace for every label to look technical.
- **Don't** reintroduce the retired sage-green palette or the old Avero shell.
- **Don't** invent analytics or execution results to fill panels.
