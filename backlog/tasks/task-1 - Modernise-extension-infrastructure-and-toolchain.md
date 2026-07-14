---
id: TASK-1
title: Modernise extension infrastructure and toolchain
status: To Do
assignee: []
created_date: '2026-07-14 23:38'
labels:
  - infra
  - tooling
  - maintenance
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The extension still packages and works, but its build/publish infrastructure is years out of date: webpack 4 only runs under a modern Node with NODE_OPTIONS=--openssl-legacy-provider, the vscode engine floor is ^1.38.1 (2019), dependencies (download, got, ts-loader, typescript, @types/*) are pinned to 2020-era versions, the publish path uses the deprecated standalone vsce (2.9.1) rather than @vscode/vsce, and there is no LICENSE file (vsce warns on package). Bring the whole toolchain and dependency set up to date so the extension builds cleanly on current Node without workaround flags and can be published on a supported path. Code changes to extension behaviour are out of scope except where a dependency/API bump forces them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extension builds and packages via @vscode/vsce with no NODE_OPTIONS=--openssl-legacy-provider workaround (bundler/toolchain upgraded off webpack 4, or replaced)
- [ ] #2 Runtime and dev dependencies (download, got, ts-loader, typescript, webpack, @types/node, @types/mocha) are bumped to current supported versions and the lockfile is regenerated
- [ ] #3 engines.vscode floor is raised to a currently-supported VS Code version and the extension still activates against it
- [ ] #4 Publishing uses @vscode/vsce (not the deprecated standalone vsce); publisher access to 'extemporelang' is confirmed and a valid Marketplace PAT is available (or a documented blocker recorded)
- [ ] #5 A LICENSE file is present so vsce packages without the LICENSE warning
- [ ] #6 The pre-existing uncommitted working-tree edits (incl. package.json bumped to 0.2.10) are reconciled and committed so git and the manifest agree before any release
- [ ] #7 Dependabot alerts for the repo are cleared by the dependency bumps (verified against the GitHub security tab)
<!-- AC:END -->
