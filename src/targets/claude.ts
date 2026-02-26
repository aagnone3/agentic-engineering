import path from "path"
import { copyDir, ensureDir } from "../utils/files"
import type { ClaudePlugin } from "../types/claude"

export async function writeClaudeBundle(outputRoot: string, plugin: ClaudePlugin): Promise<void> {
  const destination = resolveClaudeOutputRoot(outputRoot, plugin.manifest.name)
  await ensureDir(path.dirname(destination))
  await copyDir(plugin.root, destination)
}

function resolveClaudeOutputRoot(outputRoot: string, pluginName: string): string {
  if (path.basename(outputRoot) === pluginName) return outputRoot
  return path.join(outputRoot, pluginName)
}
