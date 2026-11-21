---
name: Avero
description: Your engineering workflow, intelligently orchestrated. A tactile, live instrument for delegating and reviewing engineering work.
---

# Design System: Avero

## Overview

**Creative North Star: "The Bench Instrument"**

Avero is built from the SPEC-01 hardware kit for Vercel UI SDK (https://spec-01.vercel.app): molded keys, slide switches, a D-pad, a mode dial, wheel pickers, LCD readouts and OLED screens, all real UI SDK components underneath. Nothing is a static card grid. Screens are devices you drive: pressing a key changes a run, turning a dial sets effort, and the data moves on its own.

The world is warm bone paper with a dot-grid, molded off-white bodies, and black screens. One key color, mineral green, marks keys, lamps and active marks. Type is Red Hat Mono in lowercase for the instrument's legends, with Hanken Grotesk for page titles.

Direction change, 2026-11-18: this replaces the earlier flat "instrument-grade, not toy" direction. The user asked for the SPEC-01 components used in full and for an interface that is not static or dashboard-like.

**Key Characteristics:**

- Real UI SDK behavior everywhere: keyboard, focus, ARIA and agent readiness come from the SDK.
- Live, not static: runs advance, approvals change them, the bar graph moves.
- One key color (mineral green, OKLCH 0.5 / 0.1 / 163), set once on the `Hardware` root.
- Haptics are on where the device supports them. Key sounds are off by default and can be turned on in Settings.
- Anything simulated says so: a "simulation" lamp stays in the navbar and screens name their data as simulated.

## Colors

The skin's palette is fixed by the kit (paper `#efefeb`, metal `#e2e2dd`, hairline `#c8c8c2`, ink `#1b1b19`, dim `#8a8a84`), plus the key color derived through OKLCH relative color syntax into key cap, key ink, lamp and glow roles.

### Named Rules

**The One Key Rule.** Mineral green is the only brand color. Change it in one place, the `keyColor` prop in `apps/web/src/app/layout.tsx`.

**The Symbol-and-Word Rule.** Task status is never color alone. Every status badge carries a distinct shape and its label.

**Open decision.** The skin is light only. The earlier commitment to full light and dark themes is not met, and dark mode is not designed.

## Typography

**Interface and legends:** Red Hat Mono Variable, lowercase, small (the skin's own sizes).
**Page titles:** Hanken Grotesk Variable, medium, tight tracking, sentence case.

Both are self-hosted through the `@fontsource-variable` packages.

### Named Rules

**The Mono-As-Legend Rule.** Printed legends, readouts and logs are monospaced. Titles are the one place the grotesk appears.

## Layout

A sheet with a floating acrylic navbar, then a column of devices and cards on a 1120px measure. Devices keep their designed size and zoom down on narrow screens rather than reflowing. Cards use the skin's module layout. The task workspace is three columns (context, activity, results) and collapses to one column below 1100px.

## Elevation & Depth

Molded, tactile depth: raised keys with soft shadows and highlights, recessed trays and screens, screws on modules. This depth belongs to the skin and is used for controls and devices, not for decoration.

## Shapes

Rounded molded bodies, circular keys and dials, square-ish LCD and OLED screens. The mark is the Signal Lambda: an open A with a square key-colored crossbar; the wordmark is outlined lowercase "avero" in Hanken Grotesk Medium.

## Components

Vendored from the SPEC-01 registry into `packages/ui/src/primitives/` and owned by this repo. Avero adapts a few of them (text fields, stepper, wheel select, resizable and command palette accept props and change callbacks). Used today: Navbar, Device, Display, DPad, SlideSwitch, ModeDial, Segmented, ItemList, Lcd, Meter, BarGraph, Card, Tabs, CodeBlock, AlertDialog, CommandPalette, Toasts, Feed, Switch, Stepper, Select, TextField, Textarea, Button. Avero adds `TaskStatusBadge` and the brand marks.

## Do's and Don'ts

### Do:

- **Do** use UI SDK components and the kit's `data-kit` parts before writing new markup.
- **Do** make a screen respond to input and to time, and label anything simulated.
- **Do** keep status as shape plus word plus color.
- **Do** name every control with a label or `aria-label`.

### Don't:

- **Don't** add a static grid of cards where a device or live readout would do.
- **Don't** add controls that do nothing; remove them instead.
- **Don't** introduce a second key color or a second component library.
- **Don't** present simulated runs as real activity.
