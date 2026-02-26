import path from "path"
import { backupFile, copyDir, ensureDir, writeJson, writeText } from "../utils/files"
import type { CursorBundle } from "../types/cursor"

export async function writeCursorBundle(outputRoot: string, bundle: CursorBundle): Promise<void> {
  const paths = resolveCursorPaths(outputRoot)
  await ensureDir(paths.root)

  if (bundle.rules.length > 0) {
    await ensureDir(paths.rulesDir)
    for (const rule of bundle.rules) {
      await writeText(path.join(paths.rulesDir, `${rule.name}.mdc`), rule.content + "\n")
    }
  }

  if (bundle.commands.length > 0) {
    await ensureDir(paths.commandsDir)
    for (const command of bundle.commands) {
      await writeText(path.join(paths.commandsDir, `${command.name}.md`), command.content + "\n")
    }
  }

  if (bundle.skillDirs.length > 0) {
    await ensureDir(paths.skillsDir)
    for (const skill of bundle.skillDirs) {
      await copyDir(skill.sourceDir, path.join(paths.skillsDir, skill.name))
    }
  }

  if (bundle.mcpServers && Object.keys(bundle.mcpServers).length > 0) {
    const backupPath = await backupFile(paths.mcpPath)
    if (backupPath) {
      console.log(`Backed up existing mcp.json to ${backupPath}`)
    }
    await writeJson(paths.mcpPath, { mcpServers: bundle.mcpServers })
  }
}

function resolveCursorPaths(outputRoot: string) {
  const root = path.basename(outputRoot) === ".cursor" ? outputRoot : path.join(outputRoot, ".cursor")
  return {
    root,
    rulesDir: path.join(root, "rules"),
    commandsDir: path.join(root, "commands"),
    skillsDir: path.join(root, "skills"),
    mcpPath: path.join(root, "mcp.json"),
  }
}
