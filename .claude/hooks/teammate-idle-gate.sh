#!/bin/bash
# teammate-idle-gate.sh
# Quality gate for agent team teammates before they go idle.
# Exit 0 = allow idle, Exit 2 = keep working (stderr sent as feedback).

INPUT=$(cat)
TEAMMATE_NAME=$(echo "$INPUT" | jq -r '.teammate_name // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# Check for real merge conflicts (git tracks these in the index)
CONFLICTS=$(cd "$CWD" && git diff --name-only --diff-filter=U 2>/dev/null)
if [ -n "$CONFLICTS" ]; then
  echo "Teammate '$TEAMMATE_NAME' has unresolved merge conflicts in: $CONFLICTS. Resolve before going idle." >&2
  exit 2
fi

exit 0
