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

## Not built yet

A task API (launch, cancel, stream events), webhook endpoints, API tokens for the CLI, and reading runs back over HTTP arrive with the cloud work. This page will describe them when they exist.
