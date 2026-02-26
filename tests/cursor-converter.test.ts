import { describe, expect, mock, test } from "bun:test"
import { convertClaudeToCursor } from "../src/converters/claude-to-cursor"
import type { ClaudePlugin } from "../src/types/claude"

const fixturePlugin: ClaudePlugin = {
  root: "/tmp/plugin",
  manifest: { name: "fixture", version: "1.0.0" },
  agents: [
    {
      name: "Security Reviewer",
      description: "Security-focused agent",
      capabilities: ["Threat modeling", "OWASP"],
      body: "Review code under .claude/ and coordinate with @repo-research-analyst.",
      sourcePath: "/tmp/plugin/agents/security-reviewer.md",
    },
  ],
  commands: [
    {
      name: "workflows:plan",
      description: "Plan work",
      argumentHint: "[FOCUS]",
      allowedTools: ["Read", "Task"],
      body: "Run /workflows:review.\nTask repo-research-analyst(feature)\nUse ~/.claude/settings.json.",
      sourcePath: "/tmp/plugin/commands/workflows/plan.md",
    },
  ],
  skills: [
    {
      name: "skill-one",
      sourceDir: "/tmp/plugin/skills/skill-one",
      skillPath: "/tmp/plugin/skills/skill-one/SKILL.md",
    },
  ],
  hooks: undefined,
  mcpServers: {
    local: { type: "stdio", command: "npx", args: ["-y", "pkg"], env: { KEY: "VALUE" } },
    remote: { type: "http", url: "https://example.com/mcp", headers: { Authorization: "Bearer x" } },
  },
}

describe("convertClaudeToCursor", () => {
  test("converts agents to cursor rules with mdc frontmatter", () => {
    const bundle = convertClaudeToCursor(fixturePlugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.rules).toHaveLength(1)
    const rule = bundle.rules[0]
    expect(rule.name).toBe("security-reviewer")
    expect(rule.content).toContain("description: Security-focused agent")
    expect(rule.content).toContain("alwaysApply: false")
    expect(rule.content).toContain("globs:")
    expect(rule.content).toContain("## Capabilities")
    expect(rule.content).toContain("Threat modeling")
    expect(rule.content).toContain(".cursor/")
    expect(rule.content).toContain("the repo-research-analyst rule")
  })

  test("converts commands to plain markdown and flattens names", () => {
    const bundle = convertClaudeToCursor(fixturePlugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.commands).toHaveLength(1)
    const command = bundle.commands[0]
    expect(command.name).toBe("plan")
    expect(command.content).toContain("<!-- Plan work -->")
    expect(command.content).toContain("## Arguments")
    expect(command.content).toContain("[FOCUS]")
    expect(command.content).toContain("/review")
    expect(command.content).toContain("Use the repo-research-analyst skill to: feature")
    expect(command.content).toContain("~/.cursor/settings.json")
    expect(command.content).not.toContain("---")
    expect(command.content).not.toContain("allowedTools")
  })

  test("deduplicates flattened command names and keeps disabled commands", () => {
    const plugin: ClaudePlugin = {
      ...fixturePlugin,
      agents: [],
      commands: [
        {
          name: "workflows:plan",
          body: "One",
          sourcePath: "/tmp/plugin/commands/workflows/plan.md",
        },
        {
          name: "review:plan",
          disableModelInvocation: true,
          body: "Two",
          sourcePath: "/tmp/plugin/commands/review/plan.md",
        },
      ],
      skills: [],
    }

    const bundle = convertClaudeToCursor(plugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.commands.map((c) => c.name)).toEqual(["plan", "plan-2"])
  })

  test("passes through skills and MCP servers in cursor-compatible shape", () => {
    const bundle = convertClaudeToCursor(fixturePlugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })

    expect(bundle.skillDirs[0]?.name).toBe("skill-one")
    expect(bundle.mcpServers?.local?.command).toBe("npx")
    expect(bundle.mcpServers?.local?.type).toBeUndefined()
    expect(bundle.mcpServers?.remote?.url).toBe("https://example.com/mcp")
    expect(bundle.mcpServers?.remote?.headers?.Authorization).toBe("Bearer x")
  })

  test("warns when hooks are present", () => {
    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy
    try {
      convertClaudeToCursor(
        {
          ...fixturePlugin,
          hooks: { hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "echo hi" }] }] } },
        },
        {
          agentMode: "subagent",
          inferTemperature: false,
          permissions: "none",
        },
      )
    } finally {
      console.warn = originalWarn
    }

    expect(warnSpy).toHaveBeenCalled()
  })
})
