# Architecture

Avero is split into a control plane and an execution plane. This page records what exists today and what is planned, so the two are never confused. The milestone checklist in [`AVERO.md`](../AVERO.md) is the source of truth for progress.

## Layers

| Layer           | Responsibility                                                                    | Status                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Control plane   | Authentication, workspaces, repository access, tasks, approvals, audit, dashboard | Workspaces and membership-based access, tasks, repositories, agent definitions and the GitHub App integration exist. The local console (runs, review, evaluations) reads files; there is no run sync from the CLI yet. |
| Execution plane | Cursor SDK coding sessions, Agent SDK workflows, tool execution, evaluations      | Recording, review and bench run against the live Cursor SDK on a Pro account. The Agent SDK has a prototype and one eval.                                                                                              |
| Worker          | Background jobs, retries, recovery, outbox                                        | Transactional outbox relay, BullMQ queue, task processing, cancellation and crash recovery (`apps/worker/src`), with a health endpoint.                                                                                |

The control plane and the execution plane meet through authenticated APIs and the worker. The two SDK runtimes do not share session state and are not coupled to each other.

## Applications

| Project                | Role                                                                                                                                                                                                                                    | Depends on (workspace)                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@avero/web`           | Next.js app: marketing page, the console (desk, tasks, runs, review, evaluations, activity, repositories, agents, settings), workspace pages, `/api/v1/workspaces` (with tasks, repositories, agents), `/api/v1/github`, `/api/healthz` | `config`, `contracts`, `db`, `github`, `observability`, `run-store`, `security`, `ui`        |
| `@avero/cli`           | The `avero` command: run, list, show, verdict, decide, bench, export, trace, serve, mcp                                                                                                                                                 | `bench`, `coding-engine`, `contracts`, `mcp`, `run-store`, `share`                           |
| `@avero/worker`        | Runs tasks: outbox relay, queue, processor, recovery, `/healthz`                                                                                                                                                                        | `bench`, `coding-engine`, `config`, `contracts`, `db`, `github`, `observability`, `security` |
| `@avero/agent-service` | Agent SDK project (`bot/`, `evals/`): four review tools, four skills, two subagents, two hooks, an MCP connection to Avero's runs, and a smoke evaluation                                                                               | `contracts`                                                                                  |

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

- `app/(marketing)`: the landing page. `app/(auth)`: sign-in, sign-up and the workspace pages (Clerk). `app/(dashboard)`: the console (desk, tasks, runs, review, evaluations, activity, repositories, agents, settings). `app/api`: the HTTP API.
- `features/<name>/`: the code of one feature, UI and logic together: `runs`, `review`, `bench`, `tasks`, `repositories`, `agents`, `activity`, `console-shell`, `marketing`.
- `components/`: generic pieces shared across features. `hooks/` and `lib/`: shared hooks and plain helpers (theme, formatting). `server/`: everything that runs only on the server.

### Where the console's data comes from

Pages and server actions never read files or the database themselves. They call `runSource()` in `server/run-source.ts`, which returns a `RunSource` (an interface in `@avero/contracts`). Today that is `fileRunSource` from `@avero/run-store`, reading the `.avero` folder. `dbRunSource` in `@avero/db` implements the same interface over PostgreSQL, scoped to a workspace. Choosing it per request needs sign-in and a workspace picker in the dashboard, which is not built yet. A lint rule rejects any import of `@avero/run-store` in the web app outside `server/run-source.ts`, so the seam cannot leak.

## Dependency rules

Rules live in [`eslint.config.mjs`](../eslint.config.mjs) and run with `nx lint`. Tags are declared in each package's `nx.tags`.

- Applications may depend only on `scope:shared` libraries. Shared libraries depend only on other shared libraries.
- Anything tagged `runtime:browser` may depend only on `runtime:browser` libraries. This keeps Node-only code (`db`, `coding-engine`, `security`, `config`, `observability`) out of browser bundles. The web app's `src/server/**` and `src/proxy.ts` are the only allow-listed exceptions.
- `type:ui` may not depend on `type:data-access`, `type:integration` or `runtime:node` libraries.
- `scope:agent` may depend only on `type:contract` libraries.
- Transitive dependencies are banned: a project must declare what it imports.
- Packages are imported through their public entry point. Subpath imports such as `@avero/contracts/dist/index.js` are rejected, except for `@avero/ui`, whose subpath layout is decided with the new design system.

## Data

Run data is files, not rows: run records, verdicts, decisions and bench results are written under `.avero/` in the repository they came from, and read through `@avero/run-store`. PostgreSQL holds users, workspaces and workspace members today, with Drizzle migrations in `packages/db/src/migrations` (see [database.md](database.md)). Authorization is enforced in the query: reads are filtered by membership and renames require an owner or admin role in the same statement. Redis holds the task queue (BullMQ). The database is the source of truth: a task is saved with an outbox row in one transaction, and the worker publishes the row to the queue, so a crash between the two loses nothing.

## Not built yet

A dashboard that reads runs from the database (the console still reads files) and CLI run sync. Releases and deployment are in [deployment.md](deployment.md). See [structure-plan.md](structure-plan.md) and the milestones in [`AVERO.md`](../AVERO.md). Related pages: [database](database.md), [security](security.md), [api](api.md), [deployment](deployment.md).
