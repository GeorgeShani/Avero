# Security

What protects what today, and where the protection stops. The honest limits matter more than the list.

## Secrets

- **The recorder scrubs before it saves.** The Cursor API key and the absolute workspace path are replaced in every event, so a run record on disk does not contain them (`packages/coding-engine/src/scrub.ts`).
- **Export redacts again.** `avero export` runs a pattern pass over the record, verdict and decision for known secret formats. It is a safety net, not a guarantee; the full list and its limits are in [sharing.md](sharing.md). Read an exported file before sending it.
- **The key stays out of the web server.** Reviews and runs are started from the CLI, where `CURSOR_API_KEY` lives. The console only reads files and writes decisions.
- **Logs.** `@avero/observability` writes structured JSON lines; callers pass only identifiers and counts. As a net, `writeLog` cuts string values to 300 characters and replaces anything shaped like a credential (keys, tokens, private keys, credentials in a URL, values of secret-named fields). A test reads every `writeLog` call in the repository and fails when one uses a name outside a short allow-list, so adding `prompt` or `error` to a log line cannot happen unnoticed. Spans carry identifiers only, and a failed span records the error's class, never its message. The error stored on a failed task is scrubbed the same way. `@avero/security` provides `redactSecrets` for exact known values.

## Authorization

- **Workspaces** are visible by membership and editable by `owner` and `admin` (`canEditWorkspace`). The check is part of the SQL statement, so there is no window between checking and writing. Covered by tests in `@avero/security` and `@avero/db`.
- **Sessions** come from Clerk. The proxy (`apps/web/src/proxy.ts`) only wraps the workspace, sign-in and API routes; the local console is outside it by design, because it is a local tool over local files.
- **Decisions** on a run (approve, request changes, reject) are written beside the run record. Set `AVERO_READ_ONLY=1` on a shared viewer to turn writing off; the server action refuses even if the page is tampered with.

## Agents run commands

This is the largest risk in the product. A Cursor agent edits files and runs shell commands in the folder you point it at.

- **Sandbox.** Cursor's sandbox is on by default. It is unsupported on some machines (this Windows machine included), where `--no-sandbox` is required. Use a throwaway copy of a project then.
- **Caps.** `--max-tokens` and `--max-seconds` cancel a run and the record says why. A run cancelled by a cap reports 0 tokens, because the SDK does not report usage for a cancelled turn.
- **Plan gate.** `--plan` lets the agent plan without editing; nothing changes unless you approve the plan it actually produced.
- **Approvals are advice.** `--approvals` gives the agent a `request_approval` tool and tells it to use it before risky actions. Avero records every request and answer, but it cannot force a model to call a tool, so this does not guarantee a risky action went through it. Hosted tasks do get real enforcement for shell commands, from the worker's command guard (see "Tasks run on the worker"); the CLI's runs do not.
- **Bench runs your test command** on your machine, unsandboxed, in throwaway `git worktree` checkouts, at every attempt. The agent never sees the tests, and the original test files are put back before judging, so editing them cannot pass a task.

## Tasks run on the worker

A task started from the dashboard runs on the worker's machine, so the same risk applies with a person not watching. What limits it:

- **Folders.** A local repository must be inside `AVERO_REPOSITORY_ROOTS`, checked when it is registered and again when a task starts, with symbolic links resolved. The worker works in a throwaway `git worktree` (or a fresh clone), never in the repository itself.
- **Command guard.** Each working copy gets a Cursor project hook (`.cursor/hooks.json`, fail-closed) that refuses `git push` and remote changes, publishing, `sudo`, fetch-and-run, deleting outside the folder, remote shells, `gh` actions and disk tools, and writes every checked command to an audit file the agent cannot reach. It was checked live to block `npm install`-style and push commands, and it only works because the run loads the working copy's project settings. It replaces any hooks the repository had. It is a deny list: it stops the listed things, not everything. The Agent SDK's own hooks only observe, so they cannot do this.
- **Agent rules** from an agent definition are written as an extra Cursor rule file in the working copy, not over the repository's own rules, and are not counted as the agent's changes.
- **Roles.** Owners, admins and members launch and cancel; viewers watch. Only owners and admins register repositories, connect GitHub or create agents, because those decide what the machine is pointed at and how agents behave.
- **GitHub token.** The installation token goes to `git` in a one-command header, never in the URL or the clone's config, where the agent could read it. Text posted to a pull request has `@` and `<` neutralised, so a model cannot ping people or inject markup.
- **Webhooks.** Verified by HMAC over the raw body in constant time, before parsing. A forged, unsigned or replayed delivery acts on nothing. Installation-to-workspace links use a signed, expiring state.
- **Not covered.** Cursor's sandbox (`AVERO_WORKER_SANDBOX`, on by default) is unsupported on some machines, Windows included, and has to be turned off there; without it a determined agent can do things the deny list does not name. Use a dedicated machine or container for the worker until the deployment work (S6) provides one.

## The reviewer is a model

The verdict is written by a second agent and can be wrong. Avero checks it against the record and lists every correction (files that were not changed are removed, "tests ran" is dropped when no command ran, risk is raised to a floor the record supports). A person decides.

## Untrusted text

Everything in a record is text produced by an AI run. The exported replay and the local viewer draw it with `textContent`, never as markup, under a Content Security Policy that blocks network access. The local viewer listens on `127.0.0.1` only, is read-only, validates run ids before opening files, and refuses foreign `Host` headers. Details in [sharing.md](sharing.md).

## Reporting a problem

There is no public security contact yet. Until the repository is published, tell the maintainer directly.
