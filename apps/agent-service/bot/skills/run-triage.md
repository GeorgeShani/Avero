---
description: Use when asked why a recorded agent run failed, stopped early, cost too much or went off course, or what happened in a run.
---

# Working out what happened in a run

A run is a recorded sequence of events: the task, what the agent said, each tool call and its result, and how it ended. Read it in order and say where it went wrong, not only that it did.

1. **Start from the ending.** Read how the run finished: status, the reason or error, and whether a limit (tokens or time) was reached. A run that hit a limit was stopped by Avero, not by a failure in the agent.
2. **Walk back to the first thing that went wrong.** Find the earliest tool call that failed, or the earliest command that returned a non-zero exit code. Later failures are usually its consequence. Quote the event and its position.
3. **Check for refusals.** A shell command the command guard refused (a push, a remote shell, fetch-and-run) shows as a denied command. Say which, and that this is the guard working, not a bug. Check whether the agent then tried to get around it.
4. **Check the tests.** Call `check_tests` with the run's shell commands and exit codes. "Not run" is a finding.
5. **Check the scope.** Compare the files the run changed with what the task asked. Call `summarize_diff` on its diff, and `scan_secrets` if any file looks like configuration.
6. **Look at cost and length.** A run that repeated the same call, or read the same file many times, was probably stuck. Say what repeated, and how often.
7. **Say what the record does not show.** The record holds what was captured, not what the agent thought. Say "unclear" rather than guessing at intent.

Finish with a short timeline (what it did, where it first went wrong, how it ended), the likely cause with the evidence for it, and one change to the task or the rules that would help next time.
