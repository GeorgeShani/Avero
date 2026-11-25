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

**Two surfaces, 2026-11-21.** The hardware skin now serves the landing page and the account pages (sign-in, sign-up). The console, where people do their work, is a separate flat, dense workbench with its own tokens and primitives (see [The console](#the-console)). The sections from here down to "The console" describe the hardware skin.

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

**Open decision.** The hardware skin is drawn light. Its dark theme is the whole panel inverted by a filter (`packages/ui/src/styles/dark.css`), which works but is not a designed dark palette. The console has a designed dark and light theme of its own.

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

## Motion on the landing page

The landing page moves the way the sites it was modelled on do: slowly into place, on one curve, with the scroll itself carrying weight. The vocabulary is in `apps/web/src/app/(marketing)/marketing.css` and `features/marketing/motion.ts`.

- **One curve.** `--mk-out` (`cubic-bezier(0.22, 1, 0.36, 1)`) for interface motion, `--mk-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) for the large entrances, `--mk-inout` (`cubic-bezier(0.76, 0, 0.24, 1)`) for travel. Entrances take 0.9 to 1.4 seconds, interface responses 0.45 to 0.6.
- **Inertial scroll.** Lenis (`SmoothScroll`) eases the wheel toward its target. Touch keeps the phone's own momentum. Links to a section glide there on the in-out curve and then move focus to the section.
- **Words rise out of masks.** Headings are split by `Words` into words that come up from below the line, one after another. They stay ordinary text for screen readers.
- **Transform and opacity only,** so everything stays on the compositor. `translate` and `scale` are used as individual properties, so a hover (`transform`) never fights an entrance (`translate`).
- **Scroll-linked touches are decoration.** The progress bar and the hero device receding use CSS scroll timelines behind `@supports`, with no fallback.

### Named Rules

**The Opt-In Rule.** Content is static by default. Every entrance sits inside `prefers-reduced-motion: no-preference`, so a person who asked for less motion gets the finished page, not a hidden one, and Lenis does not start for them. Without script, the layout's `<noscript>` rule shows every block in place.

**The No-Re-Render Rule.** Scroll position never drives React state frame by frame. A component that depends on the scroll takes a step from `useScrollProgress` and re-renders only when the step changes.

**The Never-Skipped Rule.** A block revealed on scroll is also revealed by position, so jumping past it (End key, dragged scrollbar, restored scroll position) cannot leave it hidden.

## The console

The console is `apps/web/src/app/(dashboard)`. It is a tool people work in for hours, so it is flat, dense and quiet, and the brand lives in its details. It is deliberately unlike the hardware skin and does not use it.

**Look.** Dark by default, with a light theme; the choice is stored in the browser (`avero-theme`: system, light or dark) and shared with the site. Everything is scoped to `[data-console]` in `apps/web/src/components/console/console.css`, with its own tokens (`--bg`, `--panel`, `--line`, `--text`, `--dim`, `--key`, `--warn`, `--bad`). The key color is the same mineral green as the skin: `oklch(0.78 0.14 163)` on dark, `oklch(0.5 0.1 163)` on light. Interface text is Hanken Grotesk; commands, ids and numbers are Red Hat Mono.

**Parts.** The console's own primitives are in `components/console/`: `PageHead`, `Panel`, `Stat`, `Note`, `Empty`, `StatusTag`, `RiskTag`, `Term`, `SettingRow`, `CopyCommand`, `ConfirmButton` and toasts (`useToast`). Markup uses `data-*` attributes (`data-btn`, `data-field`, `data-items`, `data-tag`) rather than a second component library. Use them before writing new markup.

**Frame.** A sidebar and a top bar. The sidebar's first control says where the console reads from: **This machine** (recordings in `.avero/`, needs nothing) or **Workspace** (a team's data, needs sign-in and a database). Nav items are grouped the same way, and a workspace item that cannot be used yet says why in a word beside it: Setup, Sign in, Create. A skip link, the Ctrl K palette and a mobile drawer are part of the frame. `loading.tsx`, `error.tsx` and `not-found.tsx` render inside it, so a failing page never takes the sidebar away.

### Named Rules

**The Honest Zero Rule.** A number on screen is real or the screen says it is not. If the recordings folder cannot be read, the sidebar says so instead of showing zeros.

**The Say-What's-Missing Rule.** A page that cannot work does not look empty. It says what it needs in words someone who does not run the server can use, and links to Settings, whose "Server setup" panel lists each requirement as ready or missing and never shows a value.

**The Word-For-The-Newcomer Rule.** Avero's own terms (review, evaluation, setup, hillclimb, worker) are defined where they first appear, through `Term` and `content/glossary.ts`. A command a person must run is shown with a Copy button.

**The Undo-Or-Ask Rule.** Anything that cannot be undone asks first, in a dialog that says what will happen (`ConfirmButton`). Success is a toast; failure stays on the page.

## Do's and Don'ts

### Do:

- **Do** use UI SDK components and the kit's `data-kit` parts before writing new markup on the landing and account pages, and the console primitives before writing new markup in the console.
- **Do** make a landing-page screen respond to input and to time, and label anything simulated.
- **Do** keep status as shape plus word plus color.
- **Do** name every control with a label or `aria-label`.
- **Do** say, in the console, which of this machine and a workspace a page reads from.

### Don't:

- **Don't** add a static grid of cards where a device or live readout would do on the landing page.
- **Don't** add controls that do nothing; remove them instead.
- **Don't** introduce a second key color or a second component library.
- **Don't** present simulated runs as real activity. The console shows only real data; the landing page's demos play a recorded example and say so.
- **Don't** use the hardware skin inside the console, or console tokens outside it.
