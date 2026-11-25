# Avero

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software developers, engineering teams, and open-source maintainers who need to delegate repository work and inspect the resulting changes during their normal development workflow.

## Product purpose

Avero records what a coding agent did, replays it, has an independent reviewer check it, and leaves the decision to a person. A team can also launch agents on its repositories from the browser. An operator should be able to identify which work is running, what needs a decision, and where to inspect the evidence.

## Capabilities and constraints

**Built, on a machine.** Recording a run to files, replaying it in the console, an independent reviewer's verdict checked against the record, the person's decision, evaluations that compare models and rules on a repository's own history, and a read-only MCP server over the recordings. These need nothing but the command line and a Cursor key.

**Built, for a team.** Sign-in, workspaces and membership-based access through Clerk and PostgreSQL. Inside a workspace: repositories (folders on the worker's machine, and GitHub repositories through the Avero GitHub App), agent definitions (a model and rules), and tasks that a worker runs from a queue, with a live event stream, cancellation, crash recovery, a recorded run per task, a reviewer verdict and role-checked decisions. Pull requests on connected repositories get one review task per commit. Run pushes from a client are accepted by the API.

**Not built.** Slack and scheduled runs, API tokens (so the command line cannot push runs to a workspace), a record of who changed what, workspace members and invitations, and a workspace-wide list of runs and reviews (a workspace's runs open from their task).

**Honesty.** The console shows real data only. A page that cannot work on a given server says what it needs and where to check, never an empty screen. The landing page's demos play a recorded example run and say so. A number is real or the screen says it is not.

## Brand commitments

The product name is Avero, with the Signal Lambda mark and one mineral-green key color. Two visual surfaces share it. The landing page and account pages are "The Bench Instrument", built from the SPEC-01 hardware kit for Vercel UI SDK in the shared `@avero/ui` package: tactile, live, driven by keys, dials and screens. The console, where the work happens, is a flat, dense workbench with a dark default and a light theme, built from its own primitives. The full record, including why they differ, is in DESIGN.md.

## Accessibility

Target WCAG 2.2 AA for applicable UI. Keep the sidebar, command search, forms, status labels, and technical records usable with a keyboard and on narrow screens. The console has a skip link, a keyboard command palette, status that is never color alone, and loading and error states that keep the frame.
