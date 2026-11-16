# AVERO — Visual Identity & Design System Implementation Prompt

## Your Role

You are a principal product designer, design systems architect, creative director, and senior frontend engineer specializing in premium developer tools.

Your task is to establish and implement the complete visual identity of **Avero**, an AI-powered software engineering platform built with Next.js, React, Tailwind CSS v4, shadcn/ui, and Nx.

You are responsible for transforming Avero from a technical application into a distinctive, cohesive, highly usable developer product.

Approach this as a real software product identity project, not a landing-page redesign or a collection of attractive UI components.

Your objective is to create a visual language that could belong to a serious developer tool used every day.

---

# 1. Product Context

**Product:** Avero  
**Category:** AI Engineering Platform  
**Tagline:** Your engineering workflow, intelligently orchestrated.  
**Audience:** Software developers, engineering teams, and open-source maintainers  
**Primary Experience:** Web-based developer workspace  
**Architecture:** Nx monorepo  
**Frontend:** Next.js App Router  
**UI Foundation:** shadcn/ui  
**Styling:** Tailwind CSS v4

Avero enables developers to:

- Connect and analyze GitHub repositories.
- Create engineering tasks.
- Launch autonomous coding agents.
- Monitor agent execution.
- Review code changes.
- Investigate issues.
- Generate and run tests.
- Manage pull requests.
- Coordinate specialized agents.
- Evaluate agent performance.

The interface should communicate that these are real engineering capabilities, not experimental AI demonstrations.

## Fundamental Product Feeling

Avero should feel like a tool that belongs alongside Cursor, Linear, Raycast, Vercel, GitHub, and other mature developer products.

These products are references for their quality, clarity, interaction design, and cohesion.

**Do not clone their layouts, visual identities, color schemes, or individual components.**

Avero must develop its own recognizable identity.

---

# 2. Primary Design Objective

Create a distinct design system that makes Avero feel:

- Intelligent without being theatrical.
- Technical without being intimidating to use.
- Professional without being sterile.
- Minimal without being empty.
- Powerful without being visually aggressive.
- Modern without relying on short-lived trends.
- Approachable without looking childish.
- Premium without excessive decoration.

Avero should look like a carefully engineered instrument.

Every visual decision should communicate precision, clarity, and reliability.

## The First-Five-Seconds Test

When a developer opens Avero, they should immediately understand:

1. This is a serious engineering product.
2. The interface is designed for technical work.
3. The product has its own identity.
4. It will not get in the way of development.
5. They can quickly understand what is happening and what to do next.

The interface must establish trust before asking users to delegate engineering tasks to autonomous agents.

---

# 3. Creative Direction

Use the following visual direction as the initial hypothesis.

## Direction: Precision Workspace

A combination of:

- **40% Developer Instrumentation** — Precise layouts, technical data, meaningful status indicators, clear controls.
- **30% Modern Editorial Design** — Strong typography, intentional hierarchy, excellent composition, confident whitespace.
- **20% Professional Productivity Software** — Fast navigation, approachable components, predictable interactions.
- **10% Distinctive Identity** — Original brand details, subtle motion, custom iconography, recognizable visual patterns.

These percentages describe design emphasis, not literal implementation rules.

The result should be cohesive.

Avoid making the application feel like several unrelated inspirations assembled together.

## Visual References

Study the following products for specific qualities:

### Linear

Study:

- Information hierarchy.
- Navigation density.
- Keyboard-oriented workflows.
- Status indicators.
- Interaction consistency.

Do not imitate its exact appearance.

### Cursor

Study:

- Developer-focused presentation.
- Technical restraint.
- Clear coding workflows.
- Product confidence.

### Raycast

Study:

- Command interfaces.
- Keyboard interactions.
- High-quality component states.
- Fast everyday workflows.

### Vercel

Study:

- Typographic clarity.
- Technical presentation.
- Dashboard organization.
- Controlled visual emphasis.

### GitHub

Study:

- Code presentation.
- Repository navigation.
- Diff readability.
- Familiar developer interaction patterns.

## Originality Requirement

The final result must not resemble a generic shadcn/ui dashboard template.

shadcn/ui provides the component foundation, not the product identity.

Create a distinct visual language through typography, proportions, navigation, color relationships, information density, and interaction details.

---

# 4. Brand Identity

Develop the visual identity around the name **Avero**.

## 4.1 Wordmark

Create a clean typographic wordmark.

Requirements:

- Readable at small sizes.
- Recognizable in a sidebar.
- Appropriate for a developer product.
- No excessive letter spacing.
- No gimmicky letter substitutions.
- No default futuristic typography.
- Suitable for light and dark backgrounds.

Explore subtle customizations to one or two letterforms, but do not compromise legibility.

## 4.2 Symbol

Design an original standalone symbol that can work as:

- Application icon.
- Favicon.
- Sidebar mark.
- GitHub organization avatar.
- Social profile icon.
- Loading indicator.

The mark should be geometrically coherent and recognizable at 16×16 and 24×24.

Explore concepts involving:

- Direction.
- Alignment.
- Connection.
- Execution.
- Precision.
- Coordination.

Do not automatically use a literal letter A.

Explore both abstract symbols and refined monograms.

Avoid:

- Generic AI sparkles.
- Robot heads.
- Brain icons.
- Lightning bolts.
- Code brackets as the complete logo.
- Gradient infinity symbols.
- Hexagons chosen without conceptual justification.

The final logo should be original.

## 4.3 Brand Deliverables

Provide:

- Primary wordmark.
- Standalone symbol.
- Compact horizontal lockup.
- Light-background version.
- Dark-background version.
- Monochrome version.
- Favicon.
- SVG source assets.
- Brand usage guidelines.

Use vector assets for the final symbol and wordmark where appropriate.

---

# 5. Color System

Build a restrained, flexible color system.

## 5.1 Color Philosophy

Avero should support both dark and light themes.

Use dark mode as the initial reference direction, but give light mode equal design attention.

Do not simply invert the dark palette.

The interface should remain comfortable during long development sessions.

Use color with intention.

Most interface elements should rely on neutral surfaces, typography, spacing, and borders.

Accent colors should communicate brand identity or meaningful interaction.

## 5.2 Initial Palette Exploration

Explore at least three coherent palette directions before settling on the final theme.

### Direction A — Graphite & Cobalt

- Neutral graphite surfaces.
- Cool off-white typography.
- Restrained cobalt-blue accent.
- Subtle blue-gray secondary surfaces.
- Clear semantic status colors.

Character: precise, contemporary, professional.

### Direction B — Ink & Mineral

- Deep ink backgrounds.
- Warm-neutral text.
- Muted mineral-green accent.
- Soft gray borders.
- Reserved warning and error colors.

Character: calm, engineered, distinctive.

### Direction C — Carbon & Ember

- Carbon-neutral surfaces.
- Neutral white typography.
- Restrained copper or amber accent.
- Layered neutral panels.
- High legibility.

Character: confident, technical, recognizable.

## 5.3 Palette Selection

Evaluate each direction according to:

- Developer-product suitability.
- Long-session comfort.
- Visual distinctiveness.
- Accessibility.
- Dark/light consistency.
- Status visibility.
- Chart readability.
- Component compatibility.

Choose the strongest direction based on the product requirements.

Do not select a palette merely because it looks dramatic in a static screenshot.

## 5.4 Semantic Color Tokens

Use shadcn/ui's CSS-variable-based theming system.

At minimum, define:

```css
--background
--foreground

--card
--card-foreground

--popover
--popover-foreground

--primary
--primary-foreground

--secondary
--secondary-foreground

--muted
--muted-foreground

--accent
--accent-foreground

--destructive

--border
--input
--ring

--sidebar
--sidebar-foreground
--sidebar-primary
--sidebar-primary-foreground
--sidebar-accent
--sidebar-accent-foreground
--sidebar-border
--sidebar-ring

--chart-1
--chart-2
--chart-3
--chart-4
--chart-5
```

Also define Avero-specific semantic tokens for:

- Success.
- Warning.
- Information.
- Running.
- Queued.
- Awaiting approval.
- Completed.
- Failed.
- Cancelled.
- Code additions.
- Code deletions.
- Diff backgrounds.
- Terminal surfaces.
- Execution timeline connectors.

Use semantic names instead of arbitrary hardcoded colors scattered throughout the application.

## 5.5 Color Restrictions

Avoid:

- Neon purple as the default AI accent.
- Rainbow gradients.
- Large glowing backgrounds.
- Gratuitous gradient borders.
- Low-contrast gray text.
- Excessively saturated status colors.
- Color as the only indicator of state.

---

# 6. Typography System

Typography should be one of Avero's strongest identity elements.

## 6.1 Font Categories

Select complementary fonts for:

1. Interface typography.
2. Technical and monospaced content.
3. Brand wordmark, if necessary.

Use no more font families than the design genuinely requires.

## 6.2 Fonts to Evaluate

Interface candidates:

- Geist Sans.
- Inter.
- IBM Plex Sans.
- Manrope.

Monospace candidates:

- Geist Mono.
- JetBrains Mono.
- IBM Plex Mono.

These are starting points, not mandatory selections.

Choose the combination that gives Avero a distinct yet comfortable developer-oriented personality.

## 6.3 Type Scale

Define a consistent scale covering:

- Product branding.
- Page titles.
- Section titles.
- Card headings.
- Body text.
- Secondary labels.
- Metadata.
- Code.
- Table text.
- Captions.

Avoid oversized dashboard headings.

Use typography to establish hierarchy before introducing decorative separators or additional colors.

## 6.4 Technical Text

Use monospaced typography selectively for:

- Commit hashes.
- Branch names where helpful.
- Execution identifiers.
- File paths.
- Terminal output.
- Code.
- Technical metrics.

Do not use monospace for every label merely to make the interface look technical.

---

# 7. Layout System

Avero should prioritize real engineering workflows.

## 7.1 Application Shell

Build a responsive application shell consisting of:

- Persistent desktop sidebar.
- Top contextual header.
- Main content area.
- Optional contextual secondary panel.
- Global command menu.
- Notifications.
- Workspace switcher.
- User account menu.

The structure should accommodate different pages without layout inconsistencies.

## 7.2 Sidebar

The sidebar should provide access to:

- Overview.
- Repositories.
- Tasks.
- Agents.
- Evaluations.
- Activity.
- Settings.

Include:

- Avero logo.
- Workspace switcher.
- Active navigation states.
- Collapsible sections where useful.
- Compact mode.
- Responsive mobile behavior.

Do not waste excessive horizontal space.

## 7.3 Main Content

Use a predictable layout system.

Consider:

- Consistent content padding.
- Clear page headers.
- Contextual actions.
- Responsive grids.
- Readable table widths.
- Optional split views.
- Sensible max-width constraints.

Dense technical pages should use available screen space effectively.

## 7.4 Density

Provide a comfortable default density suitable for daily development.

Avoid:

- Giant KPI cards.
- Excessively tall table rows.
- Unnecessary whitespace between every item.
- Oversized buttons.
- Empty decorative panels.

Prioritize information efficiency without making the interface cramped.

---

# 8. shadcn/ui Component System

Use **shadcn/ui as the primary component foundation**.

Treat shadcn/ui as owned, customizable component source code.

Do not use it as an unmodified visual template.

## 8.1 Monorepo Integration

Avero uses Nx and pnpm.

The shared component system must live in:

```text
packages/ui/
```

Use the package name:

```text
@avero/ui
```

Follow the official shadcn/ui monorepo integration guidance.

Configure workspace-aware `components.json` files and aliases so generated components are installed in the correct project.

Do not initialize a separate shadcn-generated Turborepo.

Do not disrupt the existing Nx workspace.

Verify current CLI behavior before installation.

## 8.2 Component Architecture

Organize UI code as follows:

```text
packages/ui/
├── src/
│   ├── components/
│   │   ├── primitives/
│   │   ├── forms/
│   │   ├── feedback/
│   │   ├── navigation/
│   │   ├── data-display/
│   │   └── overlays/
│   ├── styles/
│   │   ├── globals.css
│   │   ├── tokens.css
│   │   └── typography.css
│   ├── hooks/
│   ├── lib/
│   │   └── utils.ts
│   └── index.ts
├── components.json
└── package.json
```

This is a proposed organization. Adapt component paths to shadcn/ui CLI requirements.

## 8.3 Foundational Components

Use and customize the appropriate shadcn/ui components:

- Button.
- Input.
- Textarea.
- Label.
- Select.
- Checkbox.
- Switch.
- Radio Group.
- Card.
- Badge.
- Tabs.
- Table.
- Dropdown Menu.
- Context Menu.
- Dialog.
- Alert Dialog.
- Sheet.
- Popover.
- Tooltip.
- Command.
- Skeleton.
- Separator.
- Scroll Area.
- Breadcrumb.
- Sidebar.
- Sonner.
- Progress.
- Accordion.
- Collapsible.

Install components as required.

Do not add the entire component registry unnecessarily.

## 8.4 Avero-Specific Components

Build reusable product components on top of shadcn/ui.

### Engineering Components

- `TaskStatusBadge`
- `AgentStatusIndicator`
- `ExecutionTimeline`
- `ExecutionEvent`
- `ToolCallCard`
- `RepositoryCard`
- `RepositorySelector`
- `BranchSelector`
- `AgentSelector`
- `TaskComposer`
- `ApprovalRequest`
- `ApprovalDecision`
- `PullRequestCard`
- `CodeDiffViewer`
- `TestResultPanel`
- `ArtifactList`
- `ExecutionMetrics`
- `EvaluationScore`
- `EvaluationComparison`
- `EmptyWorkspaceState`

### Application Components

- `AppSidebar`
- `AppHeader`
- `WorkspaceSwitcher`
- `PageHeader`
- `PageActions`
- `GlobalCommandMenu`
- `NotificationCenter`
- `ThemeSwitcher`
- `UserMenu`
- `DataTable`
- `FilterBar`
- `SearchField`
- `ConfirmActionDialog`

## 8.5 Component Rules

Every component should:

- Use semantic design tokens.
- Support keyboard interaction.
- Meet accessibility expectations.
- Handle disabled states.
- Handle loading states where applicable.
- Provide meaningful focus indicators.
- Avoid unnecessary animation.
- Use explicit TypeScript props.
- Support composition.
- Remain consistent with the broader design system.

Do not create custom primitives when an appropriate shadcn/ui component already exists.

Do create distinctive product-specific compositions where necessary.

---

# 9. Iconography

Use Lucide as the primary icon library.

Establish consistent rules for:

- Icon sizes.
- Stroke widths.
- Alignment.
- Spacing.
- Interactive states.
- Status representation.

Use icons to reinforce meaning, not fill empty space.

Do not place an icon beside every piece of text.

Create custom icons only when the product requires a meaningful symbol not provided by Lucide.

The Avero brand symbol should remain separate from the general icon system.

---

# 10. Motion and Interaction

Motion should make the interface easier to understand.

It should never slow down routine development workflows.

## 10.1 Motion Principles

Use animation for:

- State transitions.
- Panel opening and closing.
- Navigation feedback.
- Dialog appearance.
- Execution progress.
- New event insertion.
- Success and failure feedback.

Avoid animation for its own sake.

## 10.2 Motion Characteristics

Motion should be:

- Fast.
- Subtle.
- Consistent.
- Interruptible.
- Purposeful.

Respect reduced-motion preferences.

Prefer CSS transitions for simple state changes.

Introduce a dedicated animation library only when technically justified.

## 10.3 Agent Execution Animation

Avero's execution states provide an opportunity for a distinctive interaction language.

Examples:

- A restrained activity pulse for running tasks.
- Smooth event insertion.
- Subtle timeline continuation.
- Clear terminal completion indicators.
- Approval requests that receive appropriate attention.

Avoid:

- Endless spinners when real progress is available.
- Fake typewriter output.
- Decorative AI thinking animations.
- Pulsing every active element.
- Distracting glow effects.

---

# 11. Product-Specific Visual Language

Develop consistent treatments for the following technical information.

## 11.1 Task Statuses

Design states for:

- Queued.
- Preparing.
- Running.
- Awaiting approval.
- Completed.
- Failed.
- Cancelled.

Use combinations of:

- Color.
- Icon.
- Text.
- Shape.
- Motion where appropriate.

Statuses must remain understandable without relying solely on color.

## 11.2 Agent Identity

Different specialized agents should be recognizable.

However, do not create unrelated colors and avatars for every agent.

Use a unified system involving:

- Role labels.
- Consistent icons.
- Optional restrained accents.
- Shared avatar construction.
- Clearly distinguished activity states.

## 11.3 Execution Timeline

Develop a clear timeline visual language.

Distinguish:

- Agent messages.
- Tool calls.
- Files changed.
- Tests executed.
- Errors.
- Approval requests.
- Final results.

Consider collapsible event details.

Use visual hierarchy to avoid overwhelming the user during long-running executions.

## 11.4 Code Diffs

Code diffs should be readable and familiar to developers.

Requirements:

- File path display.
- Addition and deletion highlighting.
- Line numbers.
- Syntax highlighting where appropriate.
- Expandable file sections.
- Accessible contrast.
- Horizontal scrolling when required.
- Support for large diffs without severe performance degradation.

Prefer established code-rendering techniques over inventing a new diff format.

## 11.5 Data Tables

Tables should be a major strength of Avero.

Support:

- Sorting.
- Filtering.
- Pagination.
- Column alignment.
- Status indicators.
- Row actions.
- Empty states.
- Loading states.
- Keyboard accessibility.

Do not turn every table into a set of large cards.

---

# 12. Key Screens to Design

Create high-quality designs for the following pages.

## 12.1 Overview Dashboard

The dashboard should immediately communicate what is happening.

Include:

- Active engineering tasks.
- Pending approvals.
- Recent completed work.
- Repository activity.
- Execution summaries.
- Quick task creation.

Do not overwhelm the dashboard with decorative statistics.

## 12.2 Repositories

Design:

- Repository list.
- Connection states.
- GitHub installation information.
- Repository details.
- Recent engineering activity.
- Repository-specific actions.

## 12.3 Task Composer

This is one of the most important product experiences.

Design an interface that makes it easy to:

1. Select a repository.
2. Describe a task.
3. Select an agent or workflow.
4. Configure execution.
5. Launch the task.

The task composer must feel approachable, even when the underlying execution options are sophisticated.

Use progressive disclosure for advanced settings.

## 12.4 Task Workspace

This is the centerpiece of Avero.

Consider a three-region composition where useful:

**Left: Task Context**

- Task description.
- Repository.
- Agent.
- Configuration.
- Status.

**Center: Execution Activity**

- Agent messages.
- Tool calls.
- Progress.
- Errors.
- Approval requests.

**Right: Engineering Results**

- Changed files.
- Diffs.
- Test results.
- Artifacts.
- Pull request information.

The composition must remain usable on smaller screens.

Do not force three columns when available space is insufficient.

## 12.5 Agent Studio

Design an interface for inspecting agent definitions.

Include:

- Agent roles.
- Capabilities.
- Tools.
- Skills.
- Configuration.
- Version information.
- Evaluation links.

## 12.6 Evaluation Lab

Design an interface for:

- Evaluation suites.
- Run history.
- Pass/fail results.
- Scores.
- Agent comparisons.
- Regression analysis.

This should feel like an engineering quality dashboard, not an AI leaderboard.

## 12.7 Settings

Design a structured settings experience covering:

- Workspace.
- Account.
- Members.
- GitHub.
- Agents.
- Execution policies.
- Usage.
- Security.

---

# 13. Light and Dark Themes

Both themes must use the same visual identity.

## Requirements

- Semantic color tokens.
- Theme persistence.
- System theme support.
- Smooth but restrained transitions.
- Accessible contrast.
- Consistent component states.
- Appropriate chart colors.
- Readable code diffs.

Avoid:

- Pure-black backgrounds everywhere.
- Pure-white surfaces everywhere.
- Light mode that feels unfinished.
- Status colors that become unreadable in either theme.

Test representative screens in both themes.

---

# 14. Accessibility

Accessibility is a core requirement.

Use WCAG 2.2 AA as the target for applicable interface requirements.

Ensure:

- Keyboard navigation.
- Visible focus states.
- Appropriate contrast.
- Semantic HTML.
- Correct labels.
- Accessible dialogs.
- Screen reader compatibility.
- Reduced-motion support.
- Adequate interactive target sizes.
- Non-color-only status representation.

Use accessible shadcn/ui primitives wherever suitable.

Do not sacrifice usability for visual minimalism.

---

# 15. Responsive Design

Avero should be desktop-first but responsive.

Prioritize desktop layouts because engineering tasks often involve complex information.

Still support smaller viewports meaningfully.

## Desktop

- Full sidebar.
- Wide content area.
- Optional split panes.
- Dense tables.
- Full execution monitoring.

## Tablet

- Collapsible sidebar.
- Adaptive panels.
- Reduced layout complexity.
- Responsive tables.

## Mobile

- Accessible navigation.
- Task status viewing.
- Notifications.
- Task details.
- Approvals.
- Essential repository information.

Do not attempt to force a full desktop code-diff workspace into a narrow mobile viewport.

---

# 16. Design Tokens and Documentation

Create a centralized design token system.

## Required Token Categories

- Colors.
- Typography.
- Spacing.
- Border radii.
- Borders.
- Shadows.
- Motion.
- Component dimensions.
- Z-index.
- Breakpoints.

Use Tailwind CSS v4 conventions and semantic CSS custom properties.

## Design Documentation

Create:

```text
docs/design/
├── visual-identity.md
├── design-principles.md
├── colors.md
├── typography.md
├── spacing.md
├── components.md
├── interaction.md
├── accessibility.md
└── screens.md
```

Document why important decisions were made.

Do not merely list CSS values.

---

# 17. Component Showcase

Create an internal design-system showcase inside the web application.

Suggested route:

```text
/design-system
```

Restrict the route to development or appropriately authorized environments.

The showcase should demonstrate:

- Brand assets.
- Color tokens.
- Typography.
- Spacing.
- Buttons.
- Inputs.
- Form elements.
- Navigation components.
- Tables.
- Badges.
- Dialogs.
- Notifications.
- Empty states.
- Loading states.
- Engineering-specific components.

Display interactive states where useful.

Include both light and dark themes.

This page should serve as a reference for future development.

---

# 18. Nx Implementation Requirements

Avero uses an Nx monorepo.

Respect existing workspace configuration.

## UI Package

Place shared UI components in:

```text
packages/ui/
```

Use:

```text
@avero/ui
```

## Application Components

Place application-specific compositions in:

```text
apps/web/src/components/
```

or appropriate feature directories.

## Styling

Use Tailwind CSS v4 and shadcn/ui semantic tokens.

Avoid competing global stylesheets.

Ensure the shared UI package's styles are imported correctly into Next.js.

## Dependency Boundaries

- `packages/ui` must not import database logic.
- `packages/ui` must not depend on server-only APIs.
- Application features may import shared UI components.
- Shared UI components must remain reusable.
- Avoid circular dependencies.

## Build Validation

After implementation, run the relevant Nx targets for:

- Linting.
- Type checking.
- Tests.
- Next.js production build.

Fix all issues introduced by the design-system changes.

---

# 19. Design Exploration Process

Do not immediately produce a complete dashboard implementation using arbitrary defaults.

Follow this sequence.

## Phase 1 — Audit

Inspect the repository.

Identify:

- Existing Nx structure.
- Next.js configuration.
- Existing shadcn/ui components.
- Tailwind configuration.
- Current fonts.
- Existing theme tokens.
- Existing application routes.
- Existing UI conventions.

Do not overwrite working components unnecessarily.

## Phase 2 — Identity Exploration

Create three visual directions.

For each direction, provide:

- Design concept.
- Color palette.
- Typography pairing.
- Brand symbol concept.
- Navigation treatment.
- Component styling.
- Representative dashboard composition.
- Advantages.
- Tradeoffs.

Evaluate the directions against Avero's product requirements.

Select and justify the strongest coherent direction.

## Phase 3 — Design System

Implement:

- Color tokens.
- Typography.
- Spacing.
- Radius system.
- Icon rules.
- Motion rules.
- Theme support.
- Shared shadcn/ui components.

## Phase 4 — Application Shell

Implement:

- Sidebar.
- Header.
- Workspace switcher.
- Navigation.
- Theme switcher.
- Command menu.
- Responsive behavior.

## Phase 5 — Key Screens

Implement visual foundations for:

1. Overview.
2. Repositories.
3. Task Composer.
4. Task Workspace.
5. Agent Studio.
6. Evaluation Lab.

Focus on layout, usability, and consistency.

Use real application data where available.

When backend features are not implemented, use explicitly labeled development fixtures rather than presenting mock data as real production activity.

## Phase 6 — Refinement

Review:

- Visual consistency.
- Responsive behavior.
- Accessibility.
- Keyboard navigation.
- Interaction quality.
- Typography.
- Contrast.
- Component reuse.
- Layout stability.
- Performance.

Fix inconsistencies before considering the identity complete.

---

# 20. Anti-Patterns to Avoid

Do not:

- Build a generic SaaS template.
- Copy Linear or Vercel directly.
- Use AI-themed gradients everywhere.
- Add decorative glowing spheres.
- Use arbitrary accent colors.
- Mix unrelated typography styles.
- Overuse cards.
- Make every section unnecessarily spacious.
- Use giant headings in technical screens.
- Hide important actions behind excessive menus.
- Animate every interaction.
- Use multiple incompatible component libraries.
- Duplicate shadcn/ui primitives without a reason.
- Hardcode colors throughout components.
- Ignore light mode.
- Ignore mobile layouts.
- Introduce unnecessary 3D effects.
- Use mock analytics without labeling them.
- Make the UI appear more functional than it is.

**The product should look credible during real usage, not only in screenshots.**

---

# 21. Deliverables

Produce the following.

## Brand Identity

- Avero wordmark.
- Original brand symbol.
- Favicon.
- Light and dark variations.
- Brand color palette.
- Typography system.
- Iconography rules.

## Design System

- Semantic theme tokens.
- Shared UI package.
- Customized shadcn/ui components.
- Theme provider.
- Light and dark themes.
- Reusable engineering components.
- Component showcase.

## Application Interface

- Application shell.
- Overview layout.
- Repository management layout.
- Task composer.
- Task workspace.
- Agent Studio layout.
- Evaluation Lab layout.
- Settings navigation.

## Documentation

- Visual identity guide.
- Component guidelines.
- Theme documentation.
- Interaction guidelines.
- Accessibility guidelines.
- Design decision rationale.

## Verification

- Successful TypeScript checks.
- Successful linting.
- Successful Next.js build.
- Responsive layout inspection.
- Accessibility review.
- Light and dark theme verification.

---

# 22. Definition of Done

The visual identity implementation is complete when:

- [ ] Avero has a recognizable wordmark and brand symbol.
- [ ] The color system is coherent and accessible.
- [ ] Typography feels distinctive and professional.
- [ ] Both themes are complete.
- [ ] shadcn/ui is correctly integrated with Nx.
- [ ] Shared components live in `@avero/ui`.
- [ ] The application shell is responsive.
- [ ] Navigation is consistent.
- [ ] Core engineering components share a common visual language.
- [ ] Task statuses are visually distinguishable.
- [ ] Agent execution events are easy to understand.
- [ ] Code diffs are readable.
- [ ] The design-system showcase works.
- [ ] The interface is keyboard accessible.
- [ ] Reduced-motion preferences are respected.
- [ ] No unrelated visual styles remain.
- [ ] Relevant Nx checks pass.
- [ ] The design documentation is complete.

---

# 23. Execution Rules

1. Read the existing codebase before editing.
2. Respect the Nx monorepo architecture.
3. Use shadcn/ui as the component foundation.
4. Use Tailwind CSS v4.
5. Consult the current official documentation.
6. Avoid unnecessary dependencies.
7. Prefer semantic design tokens.
8. Keep shared components reusable.
9. Preserve existing functionality.
10. Do not invent application data.
11. Test light and dark themes.
12. Test responsive layouts.
13. Verify accessibility.
14. Avoid excessive animation.
15. Document important decisions.
16. Run Nx checks after changes.
17. Do not report tests as passed unless executed.
18. Prioritize product usability over visual novelty.

---

# 24. Reference Documentation

- shadcn/ui: https://ui.shadcn.com/
- shadcn/ui Monorepo: https://ui.shadcn.com/docs/monorepo
- shadcn/ui Theming: https://ui.shadcn.com/docs/theming
- Tailwind CSS v4: https://tailwindcss.com/docs
- Nx: https://nx.dev/
- Next.js: https://nextjs.org/docs
- Lucide: https://lucide.dev/

---

# Final Creative Objective

Avero should become visually recognizable as a serious developer product.

Its visual identity should communicate:

**Precision. Clarity. Intelligence. Reliability. Momentum.**

The interface should make complicated engineering workflows feel understandable and manageable.

Avero must not look like an AI experiment.

It must look like software that developers would willingly use every day.

**Build the foundation for a product identity that can scale from an early open-source release to a mature engineering platform.**

Begin by auditing the existing Nx workspace, exploring three coherent visual directions, and implementing the selected identity through a shared shadcn/ui design system.

**AVERO — Your engineering workflow, intelligently orchestrated.**
