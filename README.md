# Avero

Avero is an Nx and pnpm workspace for an AI engineering platform. This foundation includes the Next.js web app, the Node.js worker process, and a Cursor Agent SDK project with a review tool and eval.

## Setup

Use Node.js 24 or 26 and pnpm 12.21.0. Install dependencies from the workspace root.

```shell
pnpm install
pnpm check
pnpm verify:workspace
pnpm verify:sdk
pnpm exec nx show projects
pnpm exec nx graph
```

Run checks for a Git comparison range once the workspace has Git history.

```shell
pnpm exec nx affected -t lint typecheck test build --base=main --head=HEAD
```

## Run the applications

Start the web and worker processes in separate terminals.

```shell
pnpm exec nx dev @avero/web
pnpm exec nx dev @avero/worker
```

The web app serves `http://localhost:3000` with health at `/api/healthz`. The worker exposes `http://127.0.0.1:3101/healthz`. Set `AVERO_WORKER_PORT` to use another port. Each endpoint reports liveness for its own process.

```shell
pnpm exec nx build @avero/web
pnpm exec nx start @avero/web
pnpm exec nx build @avero/worker
pnpm exec nx start @avero/worker
```

## Set up workspaces

1. Add your Clerk development keys and `DATABASE_URL` to the root `.env`. See `.env.example` for a local database URL. Set `AVERO_APP_URL` to the browser origin if you use an address other than `http://localhost:3000`.
2. Run `pnpm infra:up` and `pnpm infra:verify` to bring up the local PostgreSQL and Redis services.
3. Run `pnpm exec nx run @avero/db:db:migrate`.
4. Start the web app and open `/workspaces` to sign in and create your first workspace.

Workspace membership controls visibility. Owners and admins can rename a workspace. The authenticated API exposes the same operations under `/api/v1/workspaces`.

See [local infrastructure and images](infra/README.md) for the Compose settings and Docker build commands.

[Workspace architecture](docs/nx-workspace.md) · [Cursor SDK setup and verification](docs/sdk-compatibility.md)
