# API

Avero has three programmatic surfaces. Only the first is an HTTP API.

## Workspaces API (HTTP)

Served by `apps/web` under `/api/v1/workspaces`. It needs Clerk configured and a signed-in session. Every response is `Cache-Control: private, no-store`. Request and response shapes are Zod schemas in `@avero/contracts` (`workspaceInputSchema`, `workspaceSchema`).

| Method and path                 | Does                           | Success | Errors                                                                         |
| ------------------------------- | ------------------------------ | ------- | ------------------------------------------------------------------------------ |
| `GET /api/v1/workspaces`        | Lists your workspaces          | 200     | 401 signed out, 503 service not configured                                     |
| `POST /api/v1/workspaces`       | Creates one, you are the owner | 201     | 400 name not 1 to 80 characters, 401, 415 body is not `application/json`, 503  |
| `GET /api/v1/workspaces/{id}`   | Reads one                      | 200     | 404 not found **or not yours** (the two are indistinguishable on purpose), 401 |
| `PATCH /api/v1/workspaces/{id}` | Renames (owner or admin)       | 204     | 400, 404, 401, 415                                                             |

Body for create and rename: `{ "name": "<1 to 80 characters>" }`. Unknown fields are rejected.

### Pushing a run

`POST /api/v1/workspaces/{id}/runs` puts a recorded run in a workspace. Body (`application/json`):

```json
{ "record": "<the .jsonl run record, as text>", "verdict": {}, "decision": {} }
```

`verdict` and `decision` are optional and are the contents of `<run>.verdict.json` and `<run>.decision.json`. Pushing the same run id again replaces it, so a client can retry.

| Answer | When                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 201    | The run was new. Body `{ "runId": "...", "created": true }`.                                                                  |
| 200    | The run was already there and was replaced (`created: false`).                                                                |
| 400    | The body is not the envelope, the record is not a valid run record, or the verdict or decision is invalid or for another run. |
| 401    | Signed out. 503 when Clerk or the database is not configured.                                                                 |
| 403    | The caller is a viewer. Owners, admins and members may push.                                                                  |
| 404    | No such workspace **or the caller is not in it** (the same answer, so ids cannot be probed).                                  |
| 413    | The record is over 25,000,000 characters. 415 when the body is not JSON.                                                      |

This uses the signed-in Clerk session. There are no API tokens yet, so the CLI cannot push; that arrives with the cloud sync work.

`GET /api/healthz` reports that the web process is alive; the worker has its own `/healthz`.

## MCP server (stdio)

`avero mcp` (or the `avero-mcp` bin) exposes the recorded runs to your own agent. It is read-only and never writes. Six tools, each with read-only annotations:

| Tool             | Returns                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `list_runs`      | Runs, newest first, with status, size of the change, the reviewer's risk tier and the person's decision  |
| `get_run`        | One run: the task, the final message, the files changed, and the shell commands with their exit codes    |
| `get_run_events` | What the agent did in order, paged with `offset` and `limit` (default 50, at most 200); long text is cut |
| `get_verdict`    | The reviewer's verdict (checks with evidence, tests, risk) and the person's decision, when they exist    |
| `get_changes`    | The changed files with line counts; give a path from that list to get that file's unified diff           |
| `search_runs`    | Runs whose task or final message contains some text, case-insensitive, newest first                      |

Bad input, unknown runs and damaged records come back as MCP tool errors without file paths. Nothing is written to stdout except the protocol. Client configuration is in [sharing.md](sharing.md).

## Files (the record format)

The run record is the stable interface between the recorder, the console, the exports and the bench: JSONL, one event per line, validated by `parseRunRecord` in `@avero/contracts`. Beside it live `<run>.verdict.json` and `<run>.decision.json`, and bench data under `<repo>/.avero/bench/`. Anything that reads those schemas can build on them. Agent Trace output (`avero trace`) follows the open spec, with caveats listed in [sharing.md](sharing.md).

## Tasks, repositories and agents (HTTP)

All under `/api/v1/workspaces/{id}`, with the signed-in Clerk session. The rules are in `apps/web/src/server/task-api.ts`; they answer 404 to a non-member exactly as a missing workspace does, 403 to a role that may not do the thing, and 400 to bad input.

| Method and path                       | Does                                                                                                                                                                                                          | Who                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `GET  /repositories`                  | Lists repositories (never their folders)                                                                                                                                                                      | any member                     |
| `POST /repositories`                  | Registers a folder `{ name, path }`; the path must be inside `AVERO_REPOSITORY_ROOTS` once symbolic links are resolved. The answer is the same for "no such folder" and "outside the roots".                  | owner, admin                   |
| `GET  /agents`, `POST /agents`        | Lists agents; creates one `{ name, model, rules }`                                                                                                                                                            | read: any; write: owner, admin |
| `PATCH /agents/{agentId}`             | Replaces an agent's `{ name, model, rules }`. Tasks already launched keep the model they were given. 400 when another agent has the name, 404 when there is no such agent.                                    | owner, admin                   |
| `DELETE /agents/{agentId}`            | Deletes an agent; its tasks keep running                                                                                                                                                                      | owner, admin                   |
| `DELETE /repositories/{repositoryId}` | Removes a registered folder. Answers 400 for a repository that tasks have run on (removing it would delete them) and for one that comes from the GitHub App (remove it in GitHub), 404 when there is none.    | owner, admin                   |
| `GET  /tasks`                         | Lists the newest 50 tasks                                                                                                                                                                                     | any member                     |
| `POST /tasks`                         | Launches `{ repositoryId, prompt, agentId?, model?, review?, limits? }`. Saves the task and its outbox row in one transaction; the worker queues it. 201 with the task.                                       | owner, admin, member           |
| `GET  /tasks/{taskId}`                | Reads one task                                                                                                                                                                                                | any member                     |
| `POST /tasks/{taskId}/cancel`         | A queued task is cancelled at once; a running one becomes `cancelling` and its worker stops it. Asking twice, or too late, returns the task as it is.                                                         | owner, admin, member           |
| `GET  /tasks/{taskId}/events`         | Server-sent events: one `run` event per recorded run event (`id` is its sequence number, so `Last-Event-ID` resumes), then one `end` event with the final status. A comment line goes out on each quiet poll. | any member                     |

A model given in a launch wins over the agent's, which wins over `AVERO_CURSOR_MODEL`.

## GitHub (HTTP)

| Path                                    | Does                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/github/install?workspace=` | Starts the App installation: redirects to GitHub with a signed `state` (workspace, user, ten-minute expiry). The caller must be an owner or admin of that workspace.                  |
| `GET /api/v1/github/callback`           | GitHub sends the person back here. The state must verify and match the signed-in user; the installation is then linked to that workspace only, and its repositories are synced.       |
| `POST /api/v1/github/webhook`           | GitHub's deliveries. The `X-Hub-Signature-256` HMAC is checked, in constant time, over the raw body before anything is parsed; a delivery id seen before is acknowledged and ignored. |

Handled events: `installation` and `installation_repositories` (keep the repository list current, suspend or remove), and `pull_request` `opened`, `reopened`, `synchronize` and `ready_for_review`, which create one review task per pull request and head commit (a redelivery or a second event for the same commit creates none). All three answer 503 when the GitHub App's environment variables are not set. A task from a pull request clones the repository with an installation token, reviews the change and posts the verdict as a comment on the pull request; it never pushes.

## Not built yet

API tokens for the CLI (so it can push runs), and reading runs back over HTTP. They arrive with the cloud sync work.
