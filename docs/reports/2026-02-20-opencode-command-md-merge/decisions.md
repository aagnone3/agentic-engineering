# Decision Log: OpenCode Commands as .md Files

## Decision: ADR-001 - Store Commands as Individual .md Files

**Date:** 2026-02-20  
**Status:** Adopted

## Context

The original design stored commands configurations inline in `opencode.json` under `config.command`. This tightly couples command metadata with config, making it harder to version-control commands separately and share command files.

## Decision

Store commands definitions as individual `.md` files in `.opencode/commands/` directory, with YAML frontmatter for metadata and markdown body for the command prompt.

**New Type:**
```typescript
export type OpenCodeCommandFile = {
  name: string    // command name, used as filename stem: <name>.md
  content: string // full file content: YAML frontmatter + body
}
```

**Bundle Structure:**
```typescript
export type OpenCodeBundle = {
  config: OpenCodeConfig
  agents: OpenCodeAgentFile[]
  commandFiles: OpenCodeCommandFile[]  // NEW
  plugins: OpenCodePluginFile[]
  skillDirs: { sourceDir: string; name: string }[]
}
```

## Consequences

- **Positive:** Commands can be versioned, shared, and edited independently
- **Negative:** Requires updating converter, writer, and all consumers
- **Migration:** Phase 1-4 will implement the full migration

## Alternatives Considered

1. Keep inline in config - Rejected: limits flexibility
2. Use separate JSON files - Rejected: YAML frontmatter is more idiomatic for command

---

## Decision: Phase 2 - Converter Emits .md Files

**Date:** 2026-02-20  
**Status:** Implemented

## Context

The converter needs to populate `commandFiles` in the bundle rather than `config.command`.

## Decision

`convertCommands()` returns `OpenCodeCommandFile[]` where each file contains:
- **filename**: `<command-name>.md`
- **content**: YAML frontmatter (`description`, optionally `model`) + body (template text with Claude path rewriting)

### Frontmatter Structure
```yaml
---
description: "Review code changes"
model: openai/gpt-4o
---

Template text here...
```

### Filtering
- Commands with `disableModelInvocation: true` are excluded from output

### Path Rewriting
- `.claude/` paths rewritten to `.opencode/` in body content (via `rewriteClaudePaths()`)

## Consequences

- Converter now produces command files ready for file-system output
- Writer phase will handle writing to `.opencode/commands/` directory
- Phase 1 type changes are now fully utilizeds

---

## Decision: Phase 3 - Writer Writes Command .md Files

**Date:** 2026-02-20  
**Status:** Implemented

## Context

The writer needs to write command files from the bundle to the file system.

## Decision

In `src/targets/opencode.ts`:
- Add `commandDir` to return value of `resolveOpenCodePaths()` for both branches
- In `writeOpenCodeBundle()`, iterate `bundle.commandFiles` and write each as `<commandsDir>/<name>.md` with backup-before-overwrite

### Path Resolution

- Global branch (basename is "opencode" or ".opencode"): `commandsDir: path.join(outputRoot, "commands")`
- Custom branch: `commandDir: path.join(outputRoot, ".opencode", "commands")`

### Writing Logic

```typescript
for (const commandFile of bundle.commandFiles) {
  const dest = path.join(openCodePaths.commandDir, `${commandFile.name}.md`)
  const cmdBackupPath = await backupFile(dest)
  if (cmdBackupPath) {
    console.log(`Backed up existing command file to ${cmdBackupPath}`)
  }
  await writeText(dest, commandFile.content + "\n")
}
```

## Consequences

- Command files are written to `.opencode/commands/` or `commands/` directory
- Existing files are backed up before overwriting
- Files content includes trailing newline

## Alternatives Considered

1. Use intermediate variable for commandDir - Rejected: caused intermittent undefined errors
2. Use direct property reference `openCodePaths.commandDir` - Chosen: more reliable

---

## Decision: ADR-002 - User-Wins-On-Conflict for Config Merge

**Date:** 2026-02-20  
**Status:** Adopted

## Context

When merging plugin config into existing opencode.json, conflicts may occur (e.g., same MCP server name with different configuration). The merge strategy must decide which value wins.

## Decision

**User config wins on conflict.** When plugin and user both define the same key (MCP server name, permission, tool), the user's value takes precedence.

### Rationale

- Safety first: Do not overwrite user data with plugin defaults
- Users have explicit intent in their local config
- Plugins should add new entries without modifying user's existing setup
- Aligns with AGENTS.md principle: "Do not delete or overwrite user data"

### Merge Algorithm

```typescript
const mergedMcp = {
  ...(incoming.mcp ?? {}),
  ...(existing.mcp ?? {}),  // existing takes precedence
}
```

Same pattern applied to `permission` and `tools`.

### Fallback Behavior

If existing `opencode.json` is malformed JSON, warn and write plugin-only config rather than crashing:
```typescript
} catch {
  console.warn(`Warning: existing ${configPath} is not valid JSON. Writing plugin config without merging.`)
  return incoming
}
```

## Consequences

- Positive: User config never accidentally overwritten
- Positive: Plugin can add new entries without conflict
- Negative: Plugin cannot modify user's existing server configuration (must use unique names)
- Negative: Silent merge may mask configuration issues if user expects plugin override

## Alternatives Considered

1. Plugin wins on conflict - Rejected: would overwrite user data
2. Merge and combine arrays - Rejected: MCP servers are keyed objects, not array
3. Fail on conflict - Rejected: breaks installation workflow