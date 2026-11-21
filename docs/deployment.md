# Deployment

How a release gets built, how to run it, and what happens when parts of it fail. Read the last section first: it says what has and has not been tried.

## What a release is

A tag like `v1.2.3` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **verify**: the whole workspace (`lint`, `typecheck`, `test`, `build`) against a real PostgreSQL and Redis, plus `verify:workspace` and the format check.
2. **images**: builds three images and pushes them to `ghcr.io/<owner>/avero-web`, `avero-worker` and `avero-agent-service`, tagged `1.2.3` and `1.2`. There is no `latest`: a deploy names its version.
3. **release**: creates a GitHub release with notes and attaches [`infra/docker-compose.prod.yml`](../infra/docker-compose.prod.yml).

The workflow does not roll the release out, because it does not know where you host. Rolling out is the section below.

## The pieces

| Piece           | Image                 | Needs                                   | Notes                                                                                                          |
| --------------- | --------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `web`           | `avero-web`           | PostgreSQL, Clerk keys, `AVERO_APP_URL` | Next.js standalone on port 3000. `/api/healthz`.                                                               |
| `worker`        | `avero-worker`        | PostgreSQL, Redis, `CURSOR_API_KEY`     | Runs tasks. Includes `git`, which a task needs. Health on its own `127.0.0.1:3101/healthz`, in-container only. |
| `agent-service` | `avero-agent-service` | `CURSOR_API_KEY`, `AVERO_AGENT_TOKEN`   | The Agent SDK server. **Refuses to start without a token.** `/v1/info` with the token.                         |
| `migrate`       | the worker image      | PostgreSQL                              | `node node_modules/@avero/db/dist/migrate-cli.js`. Applies pending migrations and exits.                       |
| PostgreSQL 18   | `postgres:18-alpine`  | a volume                                | Or a managed one. Back it up: it is the source of truth.                                                       |
| Redis 8         | `redis:8-alpine`      | a volume                                | Holds the task queue. Append-only file on, `noeviction`.                                                       |

All three application images run as a non-root user.

## Rolling out on one host

```shell
cp .env.example .env.production        # then fill in the production values
export AVERO_IMAGE_PREFIX=ghcr.io/<owner> AVERO_VERSION=1.2.3
docker compose --env-file .env.production -f infra/docker-compose.prod.yml pull
docker compose --env-file .env.production -f infra/docker-compose.prod.yml up -d --wait
```

`up` runs `migrate` first and starts the apps only if it succeeded, so a failed migration leaves the old version running. The compose file refuses to start without the values that have no safe default (`AVERO_POSTGRES_PASSWORD`, the Clerk keys, `AVERO_APP_URL`, `CURSOR_API_KEY`, `AVERO_AGENT_TOKEN`).

**Rolling back** is `AVERO_VERSION=<previous>` and `up -d` again. Migrations are not reversed: they only add, and the previous version works against a database that has them. Do not ship a migration that drops or renames something in the same release that stops using it.

Put a reverse proxy with TLS in front of `web` (port 3000). The agent service is not published; it listens inside the compose network only.

### Settings worth knowing

- **GitHub.** All five `GITHUB_*` variables, or GitHub stays off. The App's webhook URL is `https://<your host>/api/v1/github/webhook`.
- **Folder repositories.** `AVERO_REPOSITORY_ROOTS` and the shared `repositories` volume. The web app checks a folder exists where _it_ runs, so it sees the same folder as the worker, read-only. With GitHub repositories you do not need this.
- **Sandbox.** Cursor's sandbox needs privileges a plain container does not have, so the compose file sets `AVERO_WORKER_SANDBOX=off`. The worker container then drops all capabilities and cannot gain new ones, and the command guard stays on. That limits an agent to the container, not to the folder: give the worker no secrets other than the ones it needs, and no network access to anything it should not reach.

## Observability

- **Logs** are JSON lines on stdout and stderr. They carry identifiers and counts only; string values are cut to 300 characters and anything shaped like a credential is replaced. Inside a span they also carry `traceId` and `spanId`.
- **Traces and metrics** go to an OpenTelemetry collector when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (for example `http://collector:4318`), from the web app (`avero-web`) and the worker (`avero-worker`). Without it the instrumentation does nothing.
- **What the worker measures:**

| Metric                   | Meaning                                  | Attributes                                          |
| ------------------------ | ---------------------------------------- | --------------------------------------------------- |
| `avero.tasks.settled`    | Tasks that ended                         | `status`: finished, failed, cancelled               |
| `avero.task.duration`    | Milliseconds from start to end           | `status`                                            |
| `avero.outbox.published` | Outbox rows put on the queue             |                                                     |
| `avero.tasks.recovered`  | Tasks recovery dealt with                | `outcome`: requeued, failed, cancelled, republished |
| `avero.guard.denied`     | Shell commands the command guard refused |                                                     |

Spans: `task.process` (one per task start, with `taskId`, `attempt` and `task.status`). A failed span records the error's class name, never its message.

Alerts worth setting: a rising `avero.tasks.recovered` with `outcome=failed` (workers dying), `avero.tasks.recovered` with `outcome=republished` at all (the queue lost jobs), and no `avero.outbox.published` while tasks exist.

## What happens when something fails

Each of these has a test.

| What fails                                                   | What happens                                                                                                                                     | Test                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| The queue is down when a task is launched                    | The task and its outbox row are saved together. The relay retries until Redis is back, and nothing is marked published until it is on the queue. | `db`: "publishes outbox rows once, leaves them when publishing fails" |
| Two relays run at once                                       | Each row goes to exactly one of them (`SKIP LOCKED`), and the job id is the row id, so a repeat is one job.                                      | `db`, `worker/queues`                                                 |
| The same job is delivered twice                              | The second finds the task no longer `queued` and does nothing.                                                                                   | `worker/orchestration`: "ignores a duplicate job"                     |
| A worker dies mid-task                                       | Its heartbeat stops. After 30 s recovery puts the task back on the queue, up to 3 attempts, then marks it failed with a reason.                  | `db`, `worker/queues`: "after its worker disappeared"                 |
| A worker dies while a task is being cancelled                | Recovery marks the task cancelled.                                                                                                               | `db`: "recovers tasks whose worker disappeared"                       |
| **Redis loses its data** (restart without a volume, a flush) | A task still `queued` ten minutes after its job was published is put on the queue again. Without this it would wait forever.                     | `db` and `worker/queues`: "lost"                                      |
| A task's agent errors or hits a limit                        | The task fails with the reason, the run is still saved. The reason is scrubbed of anything shaped like a credential.                             | `worker/orchestration`                                                |
| A repository is outside the allowed folders                  | The task fails and the agent is never started.                                                                                                   | `worker/orchestration`                                                |
| A failing run echoes a credential                            | It reaches neither the stored error nor any log line.                                                                                            | `worker/orchestration`: "keeps a credential out"                      |
| A migration fails during a deploy                            | `migrate` exits 1, the apps are not started, the old version keeps running.                                                                      | `db`: migrate tests; exit code tried by hand                          |

## What has and has not been tried

Tried on this machine:

- The worker and agent-service images were built and run. The worker image has `git`, runs the migrator against a fresh database (5 migrations, then nothing on a second run, exit 1 and no connection string printed on a wrong password), and starts as a health-only process. The web image starts, reports healthy and answers `/api/healthz` and the console pages (and 503 on the workspaces API without Clerk, as designed). The agent-service image answers 401 without the token and its `/v1/info` with it, refuses to start without a token, and reports healthy.
- `infra/docker-compose.prod.yml` parses and refuses to start without its required values.
- The recovery scenarios above, against real PostgreSQL and Redis.
- Tracing, metrics and log correlation with in-memory exporters.

**Not tried:**

- The release workflow has never run on GitHub. Its syntax was checked, nothing more.
- Nothing has been deployed anywhere. The compose file was parsed, not brought up as a whole, and the web image was not started against a real Clerk configuration.
- A worker image running a real task. The worker in an image has `git` and starts, but the Cursor SDK inside a container, with the sandbox off, was not exercised (the end-to-end runs used the worker on the host).
- Export to a real OpenTelemetry collector. Only the in-memory path is tested; the OTLP exporters are configured but nothing received their output.
- The agent service's `avero` MCP connection needs the `avero` command, which this image does not contain, so that connection does not work in a container yet.
- Production data services: backups and failover of PostgreSQL and Redis are yours to set up.
