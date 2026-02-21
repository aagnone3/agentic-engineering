# ADR 0002: Plugin merges into existing opencode.json rather than replacing it

## Status
Accepted

## Date
2026-02-20

## Context
Users have existing opencode.json files with personal configuration. The install command previously backed up and replaced this file entirely, destroying user settings.

## Decision
writeOpenCodeBundle reads existing opencode.json (if present), deep-merges plugin-provided keys without overwriting user-set values, and writes the merged result. User keys always win on conflict.

## Consequences
- Positive: User config preserved across installs. Re-installs are idempotent for user-set values.
- Negative: Plugin cannot remove or update an MCP server entry if the user already has one with the same name.
- Neutral: Backup of pre-merge file is still created for safety.

## Plan Reference
Originated from: docs/plans/feature_opencode-commands_as_md_and_config_merge.md