#!/bin/bash
# task-completed-gate.sh
# Quality gate that runs when a task is being marked as completed.
# Exit 0 = allow completion, Exit 2 = block completion (stderr sent as feedback).

INPUT=$(cat)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // "unknown"')
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# Check for real merge conflicts (git tracks these in the index)
CONFLICTS=$(cd "$CWD" && git diff --name-only --diff-filter=U 2>/dev/null)
if [ -n "$CONFLICTS" ]; then
  echo "Task '$TASK_SUBJECT' cannot be completed: merge conflicts in $CONFLICTS" >&2
  exit 2
fi

# Syntax check on staged JS/TS files
STAGED_FILES=$(cd "$CWD" && git diff --cached --name-only 2>/dev/null | grep -E '\.(js|ts|jsx|tsx)$')
if [ -n "$STAGED_FILES" ]; then
  for FILE in $STAGED_FILES; do
    FULL_PATH="$CWD/$FILE"
    if [ -f "$FULL_PATH" ]; then
      ERR=$(node --check "$FULL_PATH" 2>&1)
      if [ $? -ne 0 ]; then
        echo "Task '$TASK_SUBJECT' has syntax errors in $FILE: $ERR" >&2
        exit 2
      fi
    fi
  done
fi

exit 0
