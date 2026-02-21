# Phase 5 Handoff: Change `--permissions` Default to `"none"`

## Summary

Changed the default value of `--permissions` from `"broad"` to `"none"` in the install command to prevent polluting user OpenCode config with global permissions.

## Changes Made

### 1. Code Change (`src/commands/install.ts`)

- Line 51: Changed `default: "broad"` to `default: "none"` with comment referencing ADR-003
- Line 52: Updated description to clarify "none (default)"

```typescript
permissions: {
  type: "string",
  default: "none", // Default is "none" -- writing global permissions to opencode.json pollutes user config. See ADR-003.
  description: "Permission mapping written to opencode.json: none (default) | broad | from-command",
},
```

### 2. New Tests (`tests/cli.test.ts`)

Added two new tests:
1. `"install --to opencode uses permissions:none by default"` - Verifies no `permission` or `tools` keys in opencode.json when using default
2. `"install --to opencode --permissions broad writes permission block"` - Verifies `permission` key is written when explicitly using `--permissions broad`

## Test Results

- CLI tests: 12 pass, 0 fail
- All tests: 187 pass, 0 fail

## Next Steps

None - Phase 5 is complete.