#!/bin/bash
# Block gh pr create commands targeting EveryInc/compound-engineering-plugin

COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'gh pr create' && echo "$COMMAND" | grep -q 'EveryInc/compound-engineering-plugin'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: Never create PRs targeting EveryInc/compound-engineering-plugin. PRs must target origin (aagnone3/agentic-engineering)."
    }
  }'
  exit 0
fi
