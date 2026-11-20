# Cursor SDK compatibility

|                | Cursor TypeScript SDK                                          | Cursor Agent SDK                                                            |
| -------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Package        | `@cursor/sdk@1.4.0`                                            | `@grok/agent-sdk@0.6.0`                                                     |
| Avero project  | `@avero/coding-engine`                                         | `@avero/agent-service`                                                      |
| Prototype      | Read a generated TypeScript file and stream run events as JSON | Classify changed files with a typed review tool and score a real model turn |
| Execution      | Node.js process using the SDK's local runtime                  | Agent SDK CLI loading `bot/` and `evals/`                                   |
| Authentication | `CURSOR_API_KEY` or the SDK's stored browser sign-in           | `CURSOR_API_KEY` or the Agent SDK CLI's stored browser sign-in              |

Cursor's current docs and npm listing use `@grok/agent-sdk`. Both SDKs require Node.js 22.13 or newer. The Avero workspace targets Node.js 24 and 26. Both prototypes use hosted inference and need outbound access to Cursor. The browser sign-in stores are separate.

## Cursor TypeScript SDK

Set `CURSOR_API_KEY` in your terminal or run the login command. Keep credentials outside tracked files.

```shell
pnpm exec nx run @avero/coding-engine:cursor:login
pnpm exec nx run @avero/coding-engine:cursor:auth
pnpm exec nx run @avero/coding-engine:cursor:smoke
```

The smoke command creates a temporary Git repository and allows the agent only the built-in read tool. It prints event envelopes and provider identifiers. It passes only when the SDK completes a tool call and returns the exact value from the fixture. The repository and SDK run store are deleted when the command exits. Use `AVERO_CURSOR_MODEL` to override the default `composer-2.5` model.

## Cursor Agent SDK

Start by validating project discovery and calling the actual registered tool. These steps run locally without a model credential.

```shell
pnpm exec nx run @avero/agent-service:agent:validate
```

From the agent service directory, run `pnpm exec agent-sdk tool call assess_change --input '<JSON>'` with `{"paths":["package.json","README.md"]}` as the input. Expect the verdict `Dependency or workflow review required`, with only `package.json` listed as a review path.

For model turns, supply `CURSOR_API_KEY` or sign in from the CLI.

```shell
pnpm exec nx run @avero/agent-service:agent:login
pnpm exec nx run @avero/agent-service:agent:auth
pnpm exec nx run @avero/agent-service:agent:smoke
pnpm exec nx run @avero/agent-service:agent:eval
```

The evaluation requires a successful model turn and tool call, with the expected verdict in the reply. Model turns and evals can consume Cursor usage. Both integrations type-checked against their installed SDKs. The Agent SDK CLI validated the project and discovered the smoke eval. The registered tool definition accepted valid input and returned the expected verdict when invoked directly. On 2026-11-20 `pnpm verify:sdk --live` passed on a Cursor Pro account: authentication, both smoke runs and the evaluation. The SDK rejects free-plan accounts with `plan_required` on every call, including local runs, so a paid plan is required.

From the workspace root, run `pnpm verify:sdk` for the local checks. After configuring Cursor credentials, run `pnpm verify:sdk --live` to verify both authenticated tasks and the eval.

- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [Cursor Agent SDK](https://cursor.com/docs/agent-sdk)
- [Agent SDK CLI](https://cursor.com/docs/agent-sdk/reference/cli)
- [Agent SDK evaluations](https://cursor.com/docs/agent-sdk/evals)
