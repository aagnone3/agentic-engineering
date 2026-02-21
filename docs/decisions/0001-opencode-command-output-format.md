# ADR 0001: OpenCode commands written as .md files, not in opencode.json

## Status
Accepted

## Date
2026-02-20

## Context
OpenCode supports two equivalent formats for custom commands. Writing to opencode.json requires overwriting or merging the user's config file. Writing .md files is additive and non-destructive.

## Decision
The OpenCode target always emits commands as individual .md files in the commands/ subdirectory. The command key is never written to opencode.json by this tool.

## Consequences
- Positive: Installs are non-destructive. Commands are visible as individual files, easy to inspect. Consistent with agents/skills handling.
- Negative: Users inspecting opencode.json won't see plugin commands; they must look in commands/.
- Neutral: Requires OpenCode >= the version with command file support (confirmed stable).

## Plan Reference
Originated from: docs/plans/feature_opencode-commands_as_md_and_config_merge.md