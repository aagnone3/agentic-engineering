import type { ClaudePlugin } from "../types/claude"
import type { ClaudeToOpenCodeOptions } from "./claude-to-opencode"

export type ClaudeToClaudeOptions = ClaudeToOpenCodeOptions

export function convertClaudeToClaude(
  plugin: ClaudePlugin,
  _options: ClaudeToClaudeOptions,
): ClaudePlugin {
  return plugin
}
