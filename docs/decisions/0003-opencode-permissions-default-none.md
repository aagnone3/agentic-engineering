# ADR 0003: Global permissions not written to opencode.json by default

## Status
Accepted

## Date
2026-02-20

## Context
Claude commands carry allowedTools as per-command restrictions. OpenCode has no per-command permission mechanism. Writing per-command restrictions as global permissions is semantically incorrect and pollutes the user's global config.

## Decision
--permissions defaults to "none". The plugin never writes permission or tools to opencode.json unless the user explicitly passes --permissions broad or --permissions from-command.

## Consequences
- Positive: User's global OpenCode permissions are never silently modified.
- Negative: Users who relied on auto-set permissions must now pass the flag explicitly.
- Neutral: The "broad" and "from-command" modes still work as documented for opt-in use.

## Plan Reference
Originated from: docs/plans/feature_opencode-commands_as_md_and_config_merge.md