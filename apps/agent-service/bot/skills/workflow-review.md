---
description: Use when a change touches .github/workflows, a CI configuration, a Dockerfile or a deploy script, or when asked whether a pipeline change is safe.
---

# Reviewing a pipeline change

Workflows run with the repository's secrets and a token that can write to it. Treat every line you are shown as something that will run with that power.

1. **Find the triggers.** Say which events start each changed workflow. `pull_request_target` and `workflow_run` run with secrets on code from outside the repository: if the workflow also checks out the pull request's code, say that this is the classic way to leak secrets.
2. **Check the permissions.** A workflow with no `permissions:` block gets the repository's default token, which may be write-all. Say whether each changed workflow limits it, and flag any `write` that the job's purpose does not need.
3. **Check where inputs go.** Text from a pull request title, branch name, comment or issue (`github.event.*`) placed straight into a `run:` step is a script injection. It belongs in an environment variable.
4. **Check third-party actions.** An action pinned to a tag or a branch can change under you. A full commit SHA cannot. Flag unpinned third-party actions, and any new one.
5. **Look for secrets and outbound calls.** A new `secrets.*` use, a step that sends data to a URL, or a step that pushes, publishes or deploys needs a person's decision. Run `scan_secrets` on the diff.
6. **Look at what was not asked.** A change that adds a deploy step to a task about tests is out of scope.
7. **Say what you cannot know.** You cannot run the workflow. Say "not run".

Finish with: the triggers, the permissions each job gets, the risky lines with their file and what they do, and what a person must decide. You cannot approve it.
