# Phase 6: Update AGENTS.md and README.md

**Date:** 2026-02-20
**Status:** Complete

## Summary

Updated documentation to reflect the three changes from the feature:
- OpenCode commands written as individual `.md` files
- Deep-merge for `opencode.json` 
- Command file backup before overwrite

## Changes Made

### AGENTS.md
- Line 10: Updated Output Paths description to include command files path and deep-merge behavior
- Added Repository Docs Convention section at end of file

### README.md
- Line 54: Updated OpenCode output description to include command files and deep-merge behavior

## Verification

- Read updated files and confirmed accuracy
- Run `bun test` - no regressions

## Next Steps

- Ready for merge to main branch