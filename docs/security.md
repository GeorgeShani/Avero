# Security

What protects what today, and where the protection stops. The honest limits matter more than the list.

## Secrets

- **The recorder scrubs before it saves.** The Cursor API key and the absolute workspace path are replaced in every event, so a run record on disk does not contain them (`packages/coding-engine/src/scrub.ts`).
- **Export redacts again.** `avero export` runs a pattern pass over the record, verdict and decision for known secret formats. It is a safety net, not a guarantee; the full list and its limits are in [sharing.md](sharing.md). Read an exported file before sending it.
- **The key stays out of the web server.** Reviews and runs are started from the CLI, where `CURSOR_API_KEY` lives. The console only reads files and writes decisions.
- **Logs.** `@avero/observability` writes structured JSON lines; callers pass only identifiers and counts. `@avero/security` provides `redactSecrets` for exact known values.

## Authorization

- **Workspaces** are visible by membership and editable by `owner` and `admin` (`canEditWorkspace`). The check is part of the SQL statement, so there is no window between checking and writing. Covered by tests in `@avero/security` and `@avero/db`.
- **Sessions** come from Clerk. The proxy (`apps/web/src/proxy.ts`) only wraps the workspace, sign-in and API routes; the local console is outside it by design, because it is a local tool over local files.
- **Decisions** on a run (approve, request changes, reject) are written beside the run record. Set `AVERO_READ_ONLY=1` on a shared viewer to turn writing off; the server action refuses even if the page is tampered with.

## Agents run commands

This is the largest risk in the product. A Cursor agent edits files and runs shell commands in the folder you point it at.

- **Sandbox.** Cursor's sandbox is on by default. It is unsupported on some machines (this Windows machine included), where `--no-sandbox` is required. Use a throwaway copy of a project then.
- **Caps.** `--max-tokens` and `--max-seconds` cancel a run and the record says why. A run cancelled by a cap reports 0 tokens, because the SDK does not report usage for a cancelled turn.
- **Plan gate.** `--plan` lets the agent plan without editing; nothing changes unless you approve the plan it actually produced.
- **Approvals are advice.** `--approvals` gives the agent a `request_approval` tool and tells it to use it before risky actions. Avero records every request and answer, but it cannot force a model to call a tool, so this does not guarantee a risky action went through it. Real enforcement needs the sandbox or an agent hook, which is planned (S5 in [structure-plan.md](structure-plan.md)).
- **Bench runs your test command** on your machine, unsandboxed, in throwaway `git worktree` checkouts, at every attempt. The agent never sees the tests, and the original test files are put back before judging, so editing them cannot pass a task.

## The reviewer is a model

The verdict is written by a second agent and can be wrong. Avero checks it against the record and lists every correction (files that were not changed are removed, "tests ran" is dropped when no command ran, risk is raised to a floor the record supports). A person decides.

## Untrusted text

Everything in a record is text produced by an AI run. The exported replay and the local viewer draw it with `textContent`, never as markup, under a Content Security Policy that blocks network access. The local viewer listens on `127.0.0.1` only, is read-only, validates run ids before opening files, and refuses foreign `Host` headers. Details in [sharing.md](sharing.md).

## Reporting a problem

There is no public security contact yet. Until the repository is published, tell the maintainer directly.
