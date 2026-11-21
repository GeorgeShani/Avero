---
description: Use when a change touches package.json, a lockfile, pnpm-workspace.yaml or any other dependency manifest, or when asked whether a dependency change is safe.
---

# Reviewing a dependency change

A dependency change runs other people's code with the project's trust, so it is never "standard". Work through these, and say which you could not check.

1. **Confirm it is a dependency change.** Call `assess_change` with the changed paths. Read the diff of each manifest and lockfile with `summarize_diff`.
2. **List what was added, removed and moved.** Name each package with its old and new version. A lockfile that changed with no matching manifest change is suspicious: say so.
3. **Was it asked for?** A task about a button does not need a new package. A dependency the task did not need is out of scope, however harmless it looks.
4. **Look at the shape of the new version.** A pinned exact version is better than a range. A major version jump, a package with a name close to a popular one, or one that appeared in the lockfile only (a transitive dependency pulled in by something else) each need a person's eyes.
5. **Look for install-time code.** Added `preinstall`, `install` or `postinstall` scripts, or an allow-list change for build scripts (`allowBuilds`, `onlyBuiltDependencies`), let a package run commands on every machine that installs. Flag them.
6. **Look for registry changes.** A changed `resolution`, a git or tarball URL instead of a registry version, or a changed registry setting can send installs somewhere else. Flag them.
7. **Say what you cannot know.** You cannot see the package's contents or its advisories from a diff. Say "not checked" for vulnerabilities and licences, and leave them to a person.

Finish with: the packages that changed, anything not asked for, anything that runs code at install time, and what a person must check. You cannot approve it.
