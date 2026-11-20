# Sharing runs

Three ways to get a recorded run in front of someone else, and one way to get it in front of another agent. All of them read the run records in `.avero/runs`; none of them changes a record.

## Export a replay

`avero export <run-id>` writes one HTML file: the replay (timeline, event feed, token counter, playhead), the task and result, the changed files with their diff, and the verdict and decision when they exist.

**What the file is.** One self-contained document. All style and script are inline, the run is embedded as JSON, and a Content Security Policy in the page (`default-src 'none'`, inline style and script only, `data:` images only) means it cannot ask the network for anything. Open it from a file, an email attachment or any static host. It works without a server and respects the reader's light or dark theme and reduced-motion setting (with reduced motion it starts at the end).

**What it includes.** Everything in the record: the task, the agent's messages and thinking, each tool call's name and a one-line summary of its arguments, the changed files and the full patch (up to the recorder's 200,000 character cap), token counts, billed cost when the account reports it, and the folder _name_ the agent worked in. Tool results are not shown in the feed.

**What it does not include.** The full workspace path (the recorder already removes it), your API key (the recorder scrubs it), and anything the recorder never saw. It does not include files the agent only read, apart from what appears in its own messages and tool output.

**It is text from an AI run, so it is untrusted input.** The page draws every string with `textContent`, never as markup, so a record that contains HTML or script shows up as plain text. This is tested with a hostile record, and checked in a real browser.

## Redaction is a safety net, not a guarantee

Export runs a pass over the record, the verdict and the decision, and replaces what looks like a secret with `[REDACTED:kind]`. It looks for:

- Cursor keys (`crsr_…`), `sk-…` API keys, Stripe-style `sk_live_…` keys
- GitHub tokens (`ghp_…`, `gho_…`, `github_pat_…`) and AWS access key ids (`AKIA…`, `ASIA…`)
- `Bearer …` tokens that look like tokens (not ordinary prose such as "Bearer authentication")
- `-----BEGIN … PRIVATE KEY-----` blocks, including one cut off by a size limit
- `.env`-style lines whose name contains `SECRET`, `TOKEN`, `PASSWORD`, `PASSWD` or `API_KEY`, also inside a diff line
- `"password": "…"` style pairs inside text, and the values of object fields in tool arguments whose names look like `password`, `secret`, `apiKey`, `authorization` or end in `token`
- Exact values you pass in (the API on `exportRun` takes `secrets`)

**Its limits.** It is a list of patterns. It cannot know a secret in a format it has no pattern for: a database URL with a password in it, a customer email address, an internal host name, a secret in a non-English sentence, a base64 blob. It can also redact things that are not secrets (an `.env`-looking line such as `MAX_TOKENS = 4000`). It reports how many replacements it made, which is a hint and not a proof.

**Open the exported file and read it before you send it to anyone.** Search it for your company name, internal hosts and any credential you know the agent could have touched. If a run might have read a secret, do not share it.

## Agent Trace

`avero trace <run-id>` writes an [Agent Trace](https://agent-trace.dev) record (RFC v0.1.0), Cursor's open format for which lines of code an AI wrote. It follows the spec's published JSON Schema.

**Mapping.** Each added line in the run's patch becomes part of a range of 1-indexed lines in the file after the change, with contributor type `ai` and the model from the record. Adjacent added lines are merged into one range. A new file is one range from line 1. A file the run only deleted from, or deleted whole, has no AI-written lines and is left out. A new file git did not track has no patch, so all its lines are listed, counted from the additions the recorder saw. The tool is `avero`, the trace id is a UUID derived from the run id (exporting twice gives the same id), and the timestamp is when the run ended.

**Caveats, so you do not over-trust it.**

- **Revision.** The spec says ranges refer to the commit that contains the code. A run record only knows the commit the agent started from, and the agent's edits are not committed. Avero writes that commit as `vcs.revision` and also keeps it as `metadata["dev.avero"].baseRevision`. The line numbers describe the files after the run, so for a file changed above the added lines they do not line up with the base commit. Commit the changes and pass `--revision <sha>` for an exact trace.
- **Model id.** The spec asks for `provider/model-name`. The record holds only Cursor's model id (`composer-2.5`), so that is what is written, unless you give `--provider`.
- **Spec version.** The spec's examples write version `0.1.0`, but its published JSON Schema accepts only `major.minor`. Avero writes `0.1`, which the schema accepts.
- **Changed lines are `ai`.** Git shows a rewritten line as removed plus added, so a line the agent edited counts as written by the agent. It never writes `mixed`.
- **What Agent Trace itself leaves open.** Merges and rebases are not handled by the spec, and nothing here handles them either. Treat a trace as a record of one run, not as blame.
- **Optional fields left out.** Conversation URLs and content hashes, because a local run has neither.

## Serve the runs locally

`avero serve` shows your runs in a browser: a list at `/` and a replay at `/runs/<id>`. It does not need Next.js or React.

**Security stance.** It is a viewer for the person who recorded the runs, not a service.

- It listens on `127.0.0.1` only, unless you pass another `--host`. Only this machine can reach it.
- While it is on a loopback address it refuses any request whose `Host` header is not that address, so a web page on another site cannot read your runs through DNS rebinding.
- It is read-only: GET and HEAD only, `405` for everything else. There is no way to make it write, run an agent, or record a decision.
- Run ids are checked (`[A-Za-z0-9_-]`, at most 128 characters) before any file is opened, so a path like `../x` is a `400`. Unknown runs are a `404`.
- Every answer carries a Content Security Policy, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- It shows records as they are on disk (already scrubbed by the recorder, but not passed through the export redaction pass). If you bind it to a public address, anyone who can reach it can read every run. Do not.

## Let another agent read your runs (MCP)

`avero-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio. All its tools are read-only.

| Tool             | Gives                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| `list_runs`      | Runs, newest first, with status, size of change, risk tier and the decision         |
| `get_run`        | Summary, task, final message, files changed, commands run with exit codes           |
| `get_run_events` | The run in order, paged (`offset`, `limit`: default 50, at most 200), long text cut |
| `get_verdict`    | The reviewer's verdict and the person's decision                                    |
| `get_changes`    | Changed files; with `path`, the patch for that one file                             |
| `search_runs`    | Runs whose task or final message contains some text (case-insensitive)              |

Point an MCP client at it with a config like this (the exact file and key names depend on the client):

```json
{
  "mcpServers": {
    "avero": {
      "command": "npx",
      "args": ["avero-mcp", "--runs-dir", "/path/to/project/.avero/runs"]
    }
  }
}
```

Without `--runs-dir` it reads `AVERO_RUNS_DIR`, or `.avero/runs` in the folder the client starts it in. While the package is not published, use `"command": "node"` with `"args": ["/path/to/avero/packages/mcp/dist/bin.js", "--runs-dir", "…"]` after `pnpm build`.

**Things to know.**

- Run text (the task, the agent's messages, tool output, patches) is returned as data. A run can contain text written to manipulate a model that reads it. The server tells the client to treat it as data, but a client or model can still be fooled, so do not give an agent that reads runs the power to act on what it finds without a person.
- Inputs are validated: run ids must pass the same check as everywhere else, `limit` is capped, and a bad call returns an MCP tool error and not a crash. Errors that are not about the caller's input are reported without file paths.
- MCP output is not passed through the redaction pass. Use it on runs you would be willing to show the agent's user.
