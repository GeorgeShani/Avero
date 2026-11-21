# Architecture

Avero is split into a control plane and an execution plane. This page records what exists today and what is planned, so the two are never confused. The milestone checklist in [`AVERO.md`](../AVERO.md) is the source of truth for progress.

## Layers

| Layer           | Responsibility                                                                    | Status                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Control plane   | Authentication, workspaces, repository access, tasks, approvals, audit, dashboard | Workspaces and membership-based access exist. The local console (runs, review, bench) reads files. Tasks, repositories and sync are planned. |
| Execution plane | Cursor SDK coding sessions, Agent SDK workflows, tool execution, evaluations      | Recording, review and bench run against the live Cursor SDK on a Pro account. The Agent SDK has a prototype and one eval.                    |
| Worker          | Background jobs, retries, recovery, outbox                                        | A process with a health endpoint only. BullMQ queues and job processing are planned (S4 in [structure-plan.md](structure-plan.md)).          |

The control plane and the execution plane meet through authenticated APIs and the worker. The two SDK runtimes do not share session state and are not coupled to each other.

## Applications

| Project                | Role                                                                                                                                  | Depends on (workspace)                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `@avero/web`           | Next.js app: marketing page, the console (desk, runs, review, bench, settings), workspace pages, `/api/v1/workspaces`, `/api/healthz` | `config`, `contracts`, `db`, `observability`, `run-store`, `security`, `ui` |
| `@avero/cli`           | The `avero` command: run, list, show, verdict, decide, bench, export, trace, serve, mcp                                               | `bench`, `coding-engine`, `contracts`, `mcp`, `run-store`, `share`          |
| `@avero/worker`        | Node.js process with `/healthz`                                                                                                       | `config`, `contracts`, `observability`                                      |
| `@avero/agent-service` | Agent SDK project (`bot/`, `evals/`) with the `assess_change` tool and a smoke evaluation                                             | `contracts`                                                                 |

## Shared packages

| Package                | Owns                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `@avero/contracts`     | Zod schemas and types shared across processes                                 |
| `@avero/config`        | Typed environment parsing (worker port, Clerk settings)                       |
| `@avero/db`            | Drizzle schema, migrations, workspace queries                                 |
| `@avero/security`      | Workspace edit permission and secret redaction                                |
| `@avero/observability` | Structured JSON logging                                                       |
| `@avero/coding-engine` | The recorder, run limits, the reviewer agent and its evals, on the Cursor SDK |
| `@avero/run-store`     | Reading and writing run records, verdicts, decisions and bench files          |
| `@avero/bench`         | Task suites from git history, the matrix runner, hillclimb                    |
| `@avero/share`         | One-file HTML replay, secret redaction for export, Agent Trace, local viewer  |
| `@avero/mcp`           | The read-only MCP server over recorded runs                                   |
| `@avero/github`        | Repository slug validation (GitHub App integration is Milestone 4)            |
| `@avero/ui`            | Shared interface components and tokens                                        |

Libraries publish compiled output from `dist/` through a single entry point. Nx builds dependencies first for builds, type checks and tests.

## Dependency rules

Rules live in [`eslint.config.mjs`](../eslint.config.mjs) and run with `nx lint`. Tags are declared in each package's `nx.tags`.

- Applications may depend only on `scope:shared` libraries. Shared libraries depend only on other shared libraries.
- Anything tagged `runtime:browser` may depend only on `runtime:browser` libraries. This keeps Node-only code (`db`, `coding-engine`, `security`, `config`, `observability`) out of browser bundles. The web app's `src/server/**` and `src/proxy.ts` are the only allow-listed exceptions.
- `type:ui` may not depend on `type:data-access`, `type:integration` or `runtime:node` libraries.
- `scope:agent` may depend only on `type:contract` libraries.
- Transitive dependencies are banned: a project must declare what it imports.
- Packages are imported through their public entry point. Subpath imports such as `@avero/contracts/dist/index.js` are rejected, except for `@avero/ui`, whose subpath layout is decided with the new design system.

## Data

Run data is files, not rows: run records, verdicts, decisions and bench results are written under `.avero/` in the repository they came from, and read through `@avero/run-store`. PostgreSQL holds users, workspaces and workspace members today, with Drizzle migrations in `packages/db/src/migrations` (see [database.md](database.md)). Authorization is enforced in the query: reads are filtered by membership and renames require an owner or admin role in the same statement. Redis is provisioned for local development and used from Milestone 3 onward.

## Not built yet

Task API, BullMQ jobs, transactional outbox, event persistence and SSE, GitHub App, specialized agents, a database-backed run source, OpenTelemetry, deployment. See [structure-plan.md](structure-plan.md) and the milestones in [`AVERO.md`](../AVERO.md). Related pages: [database](database.md), [security](security.md), [api](api.md). `deployment.md` is written with the release work.
