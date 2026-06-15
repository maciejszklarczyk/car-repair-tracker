#!/usr/bin/env bash
set -euo pipefail

FILE=$(jq -r '.tool_input.file_path // .tool_input.filePath // empty' < /dev/stdin)

if [ -z "$FILE" ]; then
  exit 0
fi

# Skip non-TS files
case "$FILE" in
  *.json|*.css|*.md|*.astro|*.svg|*.yml|*.yaml) exit 0 ;;
esac

# Make path relative to repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REL_FILE="${FILE#"$REPO_ROOT/"}"

FAILED=0

# ESLint
if ! npx eslint --no-warn-ignored "$REL_FILE" 2>&1; then
  FAILED=1
fi

# Scoped tests for risk areas
case "$REL_FILE" in
  src/lib/*|src/pages/api/*)
    if ! npx vitest related "$REL_FILE" --run 2>&1; then
      FAILED=1
    fi
    ;;
esac

if [ "$FAILED" -ne 0 ]; then
  exit 2
fi

exit 0
