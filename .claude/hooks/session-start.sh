#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Sync local main to origin/main so every session starts with the real SSOT
git fetch origin
if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  git branch -f main origin/main
fi
