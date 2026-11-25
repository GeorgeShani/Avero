# Architecture

Avero is split into a control plane and an execution plane. This page records what exists today and what is planned, so the two are never confused. The milestone checklist in [`AVERO.md`](../AVERO.md) is the source of truth for progress.

## Layers

| Layer           | Responsibility                                                                    | Status                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Control plane   | Authentication, workspaces, repository access, tasks, approvals, audit, dashboard | Workspaces and membership-based access, tasks, repositories, agent definitions and the GitHub App integration exist. The console reads files on this machine for runs, review and evaluations, and the database for a workspace's tasks, repositories, agents and runs; there is no run sync from the CLI yet. |
| Execution plane | Cursor SDK coding sessions, Agent SDK workflows, tool execution, evaluations      | Recording, review and bench run against the live Cursor SDK on a Pro account. The Agent SDK has a prototype and one eval.                                                                                                                                                                                      |
| Worker          | Background jobs, retries, recovery, outbox                                        | Transactional outbox relay, BullMQ queue, task processing, cancellation and crash recovery (`apps/worker/src`), with a health endpoint.                                                                                                                                                                        |

The control plane and the execution plane meet through authenticated APIs and the worker. The two SDK runtimes do not share session state and are not coupled to each other.

## Applications

| Project                | Role                                                                                                                                                                                                                                         | Depends on (workspace)                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@avero/web`           | Next.js app: marketing page, the console (overview, runs, review, evaluations, tasks with a timeline, repositories, agents, workspaces, settings), `/api/v1/workspaces` (with tasks, repositories, agents), `/api/v1/github`, `/api/healthz` | `config`, `contracts`, `db`, `github`, `observability`, `run-store`, `security`, `ui`        |
| `@avero/cli`           | The `avero` command: run, list, show, verdict, decide, bench, export, trace, serve, mcp                                                                                                                                                      | `bench`, `coding-engine`, `contracts`, `mcp`, `run-store`, `share`                           |
| `@avero/worker`        | Runs tasks: outbox relay, queue, processor, recovery, `/healthz`                                                                                                                                                                             | `bench`, `coding-engine`, `config`, `contracts`, `db`, `github`, `observability`, `security` |
| `@avero/agent-service` | Agent SDK project (`bot/`, `evals/`): four review tools, four skills, two subagents, two hooks, an MCP connection to Avero's runs, and a smoke evaluation                                                                                    | `contracts`                                                                                  |

## Shared packages

| Package                | Owns                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@avero/contracts`     | Zod schemas and types shared across processes                                                                                        |
| `@avero/config`        | Typed environment parsing (worker, Clerk, GitHub App, repository roots)                                                              |
| `@avero/db`            | Drizzle schema, migrations, and the queries for workspaces, runs, tasks, the outbox, agents and GitHub                               |
| `@avero/security`      | Permissions (workspaces, runs, tasks, agents), folder-root checks and secret redaction                                               |
| `@avero/observability` | Structured JSON logging with secret scrubbing, OpenTelemetry tracing and metrics (`withSpan`, `recordTaskSettled`, `startTelemetry`) |
| `@avero/coding-engine` | The recorder, run limits, the reviewer agent and its evals, on the Cursor SDK                                                        |
| `@avero/run-store`     | Reading and writing run records, verdicts, decisions and bench files                                                                 |
| `@avero/bench`         | Task suites from git history, the matrix runner, hillclimb                                                                           |
| `@avero/share`         | One-file HTML replay, secret redaction for export, Agent Trace, local viewer                                                         |
| `@avero/mcp`           | The read-only MCP server over recorded runs                                                                                          |
| `@avero/github`        | GitHub App: webhook signature, installation state, REST client, pull request comments                                                |
| `@avero/ui`            | Shared interface components and tokens                                                                                               |

Libraries publish compiled output from `dist/` through a single entry point. Nx builds dependencies first for builds, type checks and tests.

## The web app's layout

`apps/web/src` is organised by what a thing is for, not by technology:

- `app/(marketing)`: the landing page. `app/(auth)`: sign-in and sign-up (Clerk). `app/(dashboard)`: the console (overview, runs, review, evaluations, tasks, repositories, agents, workspaces, settings), with its `loading.tsx`, `error.tsx` and `not-found.tsx`. `app/api`: the HTTP API.
- `features/<name>/`: the code of one feature, UI and logic together: `overview`, `runs`, `review`, `bench`, `tasks`, `repositories`, `agents`, `activity`, `console-shell`, `marketing`.
- `components/`: generic pieces shared across features. `hooks/` and `lib/`: shared hooks and plain helpers (theme, formatting). `server/`: everything that runs only on the server.

### Where the console's data comes from

The console has two sources, and the sidebar says which one a page reads. **This machine** (overview, runs, review, evaluations, settings) reads the `.avero` folder. **Workspace** (tasks, repositories, agents, workspaces) reads PostgreSQL and needs sign-in.

Pages and server actions never read files or the database themselves. They go through `server/run-source.ts`, which returns a `RunSource` (an interface in `@avero/contracts`): `runSource()` is `fileRunSource` from `@avero/run-store`, and `workspaceRunSource(workspace, decidedBy?)` is `dbRunSource` from `@avero/db`, scoped to one workspace. A lint rule rejects any import of `@avero/run-store` in the web app outside `server/run-source.ts`, so the seam cannot leak. A workspace's runs are opened from their task (`/tasks/[taskId]`), which uses the same `RunView` as a local run; a decision there is checked against the person's role on the server (`decideWorkspaceRun`) before it is saved.

**Which workspace.** The sidebar's picker stores the choice in the `avero-workspace` cookie. The cookie is only a hint: `pickWorkspace` accepts it only if the signed-in person still belongs to that workspace, so a forged value shows nothing extra. `server/console-context.ts` holds the per-request reads the shell needs (`loadHostedState`, `loadLocalData`, `loadWorkspaceSummary`), each cached for the request. If the recordings folder cannot be read, the layout still draws and the shell shows a notice instead of zeros. `server/capabilities.ts` reports what the server has set up as yes or no, never a value; Settings shows it.

**Clerk in the console.** The console layout wraps its pages in Clerk only when Clerk is configured, and the middleware (`src/proxy.ts`) runs on console routes so the sidebar can ask who is signed in. Without Clerk the local pages work and workspace pages explain what they need.

## Dependency rules

Rules live in [`eslint.config.mjs`](../eslint.config.mjs) and run with `nx lint`. Tags are declared in each package's `nx.tags`.

- Applications may depend only on `scope:shared` libraries. Shared libraries depend only on other shared libraries.
- Anything tagged `runtime:browser` may depend only on `runtime:browser` libraries. This keeps Node-only code (`db`, `coding-engine`, `security`, `config`, `observability`) out of browser bundles. The web app's `src/server/**` and `src/proxy.ts` are the only allow-listed exceptions.
- `type:ui` may not depend on `type:data-access`, `type:integration` or `runtime:node` libraries.
- `scope:agent` may depend only on `type:contract` libraries.
- Transitive dependencies are banned: a project must declare what it imports.
- Packages are imported through their public entry point. Subpath imports such as `@avero/contracts/dist/index.js` are rejected, except for `@avero/ui`, whose subpath layout is decided with the new design system.

## Data

Local run data is files: run records, verdicts, decisions and bench results are written under `.avero/` in the repository they came from, and read through `@avero/run-store`. PostgreSQL holds users, workspaces and members; repositories and agent definitions; tasks, their events and the outbox; runs, verdicts and decisions pushed to or recorded by a workspace; bench results; and the GitHub App's installations. Drizzle migrations are in `packages/db/src/migrations` (see [database.md](database.md)). Authorization is enforced in the query: reads are filtered by membership and renames require an owner or admin role in the same statement. Redis holds the task queue (BullMQ). The database is the source of truth: a task is saved with an outbox row in one transaction, and the worker publishes the row to the queue, so a crash between the two loses nothing.

## Not built yet

A workspace-wide list of runs and reviews in the console (a workspace's runs open from their task today), CLI run sync, and API tokens. Releases and deployment are in [deployment.md](deployment.md). See [structure-plan.md](structure-plan.md) and the milestones in [`AVERO.md`](../AVERO.md). Related pages: [database](database.md), [security](security.md), [api](api.md), [deployment](deployment.md).
