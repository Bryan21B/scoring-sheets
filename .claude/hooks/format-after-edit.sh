#!/usr/bin/env bash
# PostToolUse(Edit|Write) — formate et corrige le fichier que l'agent vient
# d'écrire, immédiatement, au lieu de laisser une règle de style en prose dans
# AGENTS.md que l'agent peut ignorer.
set -euo pipefail

file_path=$(jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

case "$file_path" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.json | *.jsonc | *.css) ;;
  *) exit 0 ;;
esac

bunx biome check --write --no-errors-on-unmatched "$file_path" >/dev/null 2>&1 || true
