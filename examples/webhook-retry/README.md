# webhook-retry

A tiny repository for trying Avero. It has one function that sends a webhook and no retry logic.
Copy it somewhere outside this repository, run `git init` and commit, then point an agent at it:

```shell
pnpm avero run "Retry failed webhook deliveries with exponential backoff, at most 4 attempts. Add tests." --cwd <the copy>
```
