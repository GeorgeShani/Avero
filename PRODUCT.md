# Avero

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software developers, engineering teams, and open-source maintainers who need to delegate repository work and inspect the resulting changes during their normal development workflow.

## Product purpose

Avero organizes repository context, agent assignments, execution events, approvals, and engineering results within a workspace. An operator should be able to identify which work is running, what needs a decision, and where to inspect the evidence.

## Capabilities and constraints

The application provides sign-in, workspace creation, renaming and membership-based access through Clerk and PostgreSQL, plus a versioned workspaces API. Repository integrations, task execution, approvals and evaluations are not built yet. Any engineering screen shown before those services exist is a clearly labeled development fixture, never presented as real activity. The signed-in workspace flow stays connected to its existing application services.

## Brand commitments

The product name is Avero. The visual world is "The Bench Instrument", built from the SPEC-01 hardware kit for Vercel UI SDK: tactile, live, driven by keys, dials and screens, with one mineral-green key color and the Signal Lambda mark. The component foundation is Vercel UI SDK in the shared `@avero/ui` package of the Nx repository. The skin is light only. The full record is in DESIGN.md.

## Accessibility

Target WCAG 2.2 AA for applicable UI. Keep the sidebar, command search, forms, status labels, and technical records usable with a keyboard and on narrow screens.
