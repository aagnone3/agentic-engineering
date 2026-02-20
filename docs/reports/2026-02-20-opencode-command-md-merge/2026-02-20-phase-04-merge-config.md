# Phase 4 Handoff: Deep-Merge opencode.json

**Date:** 2026-02-20  
**Status:** Complete

## Summary

Implemented `mergeOpenCodeConfig()` function that performs deep-merge of plugin config into existing opencode.json with user-wins-on-conflict strategy.

## Changes Made

### 1. Updated `src/targets/opencode.ts`

- Added imports for `pathExists`, `readJson`, and `OpenCodeConfig` type
- Added `mergeOpenCodeConfig()` function before `writeOpenCodeBundle()`
- Replaced direct `writeJson()` call with merge logic

### 2. Updated `tests/opencode-writer.test.ts`

- Renamed existing backup test to `"merges plugin config into existing opencode.json without destroying user keys"`
- Added two new tests:
  - `"merges mcp servers without overwriting user entry"`
  - `"preserves unrelated user keys when merging opencode.json"`

## Verification

All 8 tests pass:
```
bun test tests/opencode-writer.test.ts
8 pass, 0 fail
```

## Key Behaviors

1. **User keys preserved**: All existing config keys remain intact
2. **MCP merge**: Plugin MCP servers added, user servers kept on conflict
3. **Permission merge**: Plugin permissions added, user permissions kept on conflict
4. **Tools merge**: Plugin tools added, user tools kept on conflict
5. **Fallback**: If existing config is malformed JSON, writes plugin-only config (safety first)
6. **Backup**: Original config is still backed up before writing merged result

## Next Steps

- Proceed to next phase (if any)
- Consider adding decision log entry for ADR-002 (user-wins-on-conflict strategy)