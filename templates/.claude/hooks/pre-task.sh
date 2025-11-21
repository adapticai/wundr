#!/bin/bash
#
# Pre-Task Hook
# Runs before any task execution begins
#
# This hook prepares the environment and validates preconditions
# before starting work on a task.
#

set -e  # Exit on error

# Get task description from argument
TASK_DESC="${1:-Unknown task}"

echo "🔧 Pre-Task Hook: Preparing environment..."
echo "Task: $TASK_DESC"

# ============================================================================
# CUSTOMIZE: Add your pre-task checks and setup here
# ============================================================================

# Example: Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js version: $NODE_VERSION"
else
    echo "⚠️  Node.js not found - may be required for this project"
fi

# Example: Check if git repository is clean
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "⚠️  Git working directory is not clean"
        echo "   Consider committing or stashing changes before starting"
    else
        echo "✓ Git working directory is clean"
    fi
fi

# Example: Check if dependencies are installed
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "⚠️  Dependencies not installed"
        echo "   Run: npm install"
    else
        echo "✓ Dependencies installed"
    fi
fi

# Example: Validate environment variables
REQUIRED_ENV_VARS=("NODE_ENV")  # Add your required vars
for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  Environment variable $var is not set"
    else
        echo "✓ Environment variable $var is set"
    fi
done

# Example: Create necessary directories
REQUIRED_DIRS=("logs" "tmp")  # Add your required directories
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "✓ Created directory: $dir"
    fi
done

# Example: Session restore (if using claude-flow)
# Uncomment if you're using swarm coordination
# if command -v claude-flow &> /dev/null; then
#     SESSION_ID="${2:-swarm-default}"
#     echo "📦 Restoring session context..."
#     npx claude-flow@alpha hooks session-restore --session-id "$SESSION_ID" || true
# fi

# Example: Load project-specific context
# Uncomment if you're using memory management
# if command -v claude-flow &> /dev/null; then
#     echo "🧠 Loading project context..."
#     npx claude-flow@alpha hooks pre-task --description "$TASK_DESC" || true
# fi

echo "✅ Pre-task preparation complete"
echo ""

# Exit with success
exit 0
