#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Sync local main to origin/main so every session starts with the real SSOT
git fetch origin
git branch -f main origin/main

# Install dependencies
cd "${CLAUDE_PROJECT_DIR:-.}"
npm install
