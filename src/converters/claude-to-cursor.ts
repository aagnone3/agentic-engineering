import { formatFrontmatter } from "../utils/frontmatter"
import type { ClaudeAgent, ClaudeCommand, ClaudeMcpServer, ClaudePlugin } from "../types/claude"
import type { CursorBundle, CursorCommand, CursorRule } from "../types/cursor"
import type { ClaudeToOpenCodeOptions } from "./claude-to-opencode"

export type ClaudeToCursorOptions = ClaudeToOpenCodeOptions

export function convertClaudeToCursor(
  plugin: ClaudePlugin,
  _options: ClaudeToCursorOptions,
): CursorBundle {
  const ruleNames = new Set<string>()
  const commandNames = new Set<string>()

  if (plugin.hooks && Object.keys(plugin.hooks.hooks).length > 0) {
    console.warn("Cursor target does not support Claude hooks; skipping hooks.")
  }

  const rules = plugin.agents.map((agent) => convertAgentToRule(agent, ruleNames))
  const commands = plugin.commands.map((command) => convertCommand(command, commandNames))
  const skillDirs = plugin.skills.map((skill) => ({ name: skill.name, sourceDir: skill.sourceDir }))
  const mcpServers = convertMcpServers(plugin.mcpServers)

  return { rules, commands, skillDirs, mcpServers }
}

function convertAgentToRule(agent: ClaudeAgent, usedNames: Set<string>): CursorRule {
  const name = uniqueName(normalizeName(agent.name), usedNames)
  const frontmatter: Record<string, unknown> = {
    description: agent.description ?? `Converted from Claude agent ${agent.name}`,
    globs: "",
    alwaysApply: false,
  }

  let body = transformContentForCursor(agent.body.trim())
  if (agent.capabilities && agent.capabilities.length > 0) {
    const capabilities = agent.capabilities.map((capability) => `- ${capability}`).join("\n")
    body = `## Capabilities\n${capabilities}\n\n${body}`.trim()
  }
  if (body.length === 0) {
    body = `Instructions converted from the ${agent.name} agent.`
  }

  return {
    name,
    content: formatFrontmatter(frontmatter, body),
  }
}

function convertCommand(command: ClaudeCommand, usedNames: Set<string>): CursorCommand {
  const name = uniqueName(flattenCommandName(command.name), usedNames)
  const sections: string[] = []

  if (command.description && command.description.trim()) {
    sections.push(`<!-- ${command.description.trim().replace(/\s+/g, " ")} -->`)
  }
  if (command.argumentHint) {
    sections.push(`## Arguments\n${command.argumentHint}`)
  }

  const transformedBody = transformContentForCursor(command.body.trim())
  if (transformedBody.length > 0) {
    sections.push(transformedBody)
  }

  return {
    name,
    content: sections.join("\n\n").trim(),
  }
}

function convertMcpServers(
  mcpServers?: Record<string, ClaudeMcpServer>,
): Record<string, ClaudeMcpServer> | undefined {
  if (!mcpServers || Object.keys(mcpServers).length === 0) return undefined

  const converted: Record<string, ClaudeMcpServer> = {}
  for (const [name, server] of Object.entries(mcpServers)) {
    converted[name] = {
      command: server.command,
      args: server.args,
      env: server.env,
      url: server.url,
      headers: server.headers,
    }
  }
  return converted
}

function transformContentForCursor(body: string): string {
  let result = body

  result = result
    .replace(/~\/\.claude\//g, "~/.cursor/")
    .replace(/\.claude\//g, ".cursor/")

  const taskPattern = /^(\s*-?\s*)Task\s+([a-z][a-z0-9-]*)\(([^)]+)\)/gm
  result = result.replace(taskPattern, (_match, prefix: string, agentName: string, args: string) => {
    const ruleName = normalizeName(agentName)
    return `${prefix}Use the ${ruleName} skill to: ${args.trim()}`
  })

  const slashCommandPattern = /(?<![:\w])\/([a-z][a-z0-9_:-]*?)(?=[\s,."')\]}`]|$)/gi
  result = result.replace(slashCommandPattern, (match, commandName: string) => {
    if (commandName.includes("/")) return match
    if (["dev", "tmp", "etc", "usr", "var", "bin", "home"].includes(commandName)) return match
    return `/${flattenCommandName(commandName)}`
  })

  const agentRefPattern =
    /@([a-z][a-z0-9-]*-(?:agent|reviewer|researcher|analyst|specialist|oracle|sentinel|guardian|strategist))/gi
  result = result.replace(agentRefPattern, (_match, agentName: string) => {
    return `the ${normalizeName(agentName)} rule`
  })

  return result
}

function flattenCommandName(name: string): string {
  const colonIndex = name.lastIndexOf(":")
  const base = colonIndex >= 0 ? name.slice(colonIndex + 1) : name
  return normalizeName(base)
}

function normalizeName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return "item"
  const normalized = trimmed
    .toLowerCase()
    .replace(/[\\/]+/g, "-")
    .replace(/[:\s]+/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "item"
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  let index = 2
  while (used.has(`${base}-${index}`)) {
    index += 1
  }
  const name = `${base}-${index}`
  used.add(name)
  return name
}
