# Phase 3 Handoff Report: Write Command Files as .md

## Date
2026-02-20

## Phase
3 of feature: OpenCode Commands as .md Files, Config Merge, and Permissions Default Fix

## Summary

Implemented the `commandsDir` path resolution and command file writing in `src/targets/opencode.ts`.

## Changes Made

### 1. Updated `src/targets/opencode.ts`

**Added `commandDir` to path resolver:**
- In global branch (line 52): Added `commandDir: path.join(outputRoot, "commands")` with inline comment
- In custom branch (line 66): Added `commandDir: path.join(outputRoot, ".opencode", "commands")` with inline comment

**Added command file writing logic (line 24-30):**
- Iterates `bundle.commandFiles`
- Writes each command as `<commandsDir>/<name>.md` with trailing newline
- Creates backup before overwriting existing files

### 2. Added tests in `tests/opencode-writer.test.ts`

- `"writes command files as .md in commands/ directory"` - Tests global-style output (`.config/opencode`)
- `"backs up existing command .md file before overwriting"` - Tests backup creation

## Test Results

```
bun test tests/opencode-writer.test.ts
6 pass, 0 fail
```

All existing tests continue to pass:
```
bun test
183 pass, 0 fail
```

## Deliverables Complete

- [x] Updated `src/targets/opencode.ts` with commandDir path and write logic
- [x] New tests in `tests/opencode-writer.test.ts`
- [x] All tests pass

## Notes

- Used `openCodePaths` instead of `paths` variable name to avoid shadowing the imported `path` module
- Command files are written with trailing newline (`content + "\n"`)
- Backup uses timestamp format `.bak.2026-02-20T...`