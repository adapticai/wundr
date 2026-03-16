#!/bin/sh
# memory.sh - Live Git Context Injection for Claude Code Sessions
# Run at the beginning of each Claude Code session to inject live repository state.
# Usage: sh memory.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Live Repository Context ==="
echo ""

# Current branch
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
echo "Branch: ${BRANCH}"
echo ""

# Last 5 commits
echo "Recent commits:"
git log --oneline -5 2>/dev/null | while IFS= read -r line; do
  echo "  - ${line}"
done
echo ""

# Modified files (staged + unstaged)
MODIFIED="$(git diff --name-only HEAD 2>/dev/null; git diff --cached --name-only 2>/dev/null)"
if [ -n "${MODIFIED}" ]; then
  echo "Modified files:"
  echo "${MODIFIED}" | sort -u | while IFS= read -r file; do
    [ -n "${file}" ] && echo "  - ${file}"
  done
else
  echo "Modified files: (none)"
fi
echo ""

# Untracked files
UNTRACKED="$(git ls-files --others --exclude-standard 2>/dev/null)"
if [ -n "${UNTRACKED}" ]; then
  echo "Untracked files:"
  echo "${UNTRACKED}" | head -20 | while IFS= read -r file; do
    [ -n "${file}" ] && echo "  - ${file}"
  done
  COUNT="$(echo "${UNTRACKED}" | wc -l | tr -d ' ')"
  if [ "${COUNT}" -gt 20 ]; then
    echo "  ... and $((COUNT - 20)) more"
  fi
else
  echo "Untracked files: (none)"
fi
echo ""

echo "Repository root: ${REPO_ROOT}"
echo ""
echo "=== End Context ==="
