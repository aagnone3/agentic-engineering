import type { ClaudeMcpServer } from "./claude"

export type CursorRule = {
  name: string
  content: string
}

export type CursorCommand = {
  name: string
  content: string
}

export type CursorSkillDir = {
  name: string
  sourceDir: string
}

export type CursorBundle = {
  rules: CursorRule[]
  commands: CursorCommand[]
  skillDirs: CursorSkillDir[]
  mcpServers?: Record<string, ClaudeMcpServer>
}
