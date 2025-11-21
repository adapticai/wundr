#!/bin/bash
#
# Post-Task Hook
# Runs after task execution completes
#
# This hook performs cleanup, validation, and finalization
# after completing work on a task.
#

set -e  # Exit on error

# Get task description from argument
TASK_ID="${1:-unknown}"
TASK_DESC="${2:-Unknown task}"

echo "🏁 Post-Task Hook: Finalizing task..."
echo "Task ID: $TASK_ID"
echo "Task: $TASK_DESC"

# ============================================================================
# CUSTOMIZE: Add your post-task actions here
# ============================================================================

# Example: Run linter
if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
    echo "🔍 Running linter..."
    if npm run lint; then
        echo "✓ Linting passed"
    else
        echo "⚠️  Linting failed - please fix errors"
        exit 1
    fi
fi

# Example: Format code
if [ -f "package.json" ] && grep -q "\"format\"" package.json; then
    echo "✨ Formatting code..."
    npm run format || echo "⚠️  Formatting not available"
fi

# Example: Run tests
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
    echo "🧪 Running tests..."
    if npm test; then
        echo "✓ Tests passed"
    else
        echo "❌ Tests failed - task may not be complete"
        exit 1
    fi
fi

# Example: Type checking
if [ -f "tsconfig.json" ]; then
    echo "🔤 Running type check..."
    if npx tsc --noEmit; then
        echo "✓ Type check passed"
    else
        echo "⚠️  Type errors found"
        exit 1
    fi
fi

# Example: Check for console.log statements
echo "🔍 Checking for debug statements..."
if git diff --cached | grep -E "console\.(log|debug|info)" &> /dev/null; then
    echo "⚠️  Found console statements in staged files"
    echo "   Consider removing debug code before committing"
fi

# Example: Update documentation
if [ -f "README.md" ]; then
    echo "📚 Checking documentation..."
    # Add your documentation checks here
fi

# Example: Store task completion in memory (if using claude-flow)
# Uncomment if you're using memory management
# if command -v claude-flow &> /dev/null; then
#     echo "💾 Storing task results..."
#     npx claude-flow@alpha hooks post-task --task-id "$TASK_ID" || true
# fi

# Example: Notify completion
# Uncomment if you're using notifications
# if command -v claude-flow &> /dev/null; then
#     echo "📢 Sending completion notification..."
#     npx claude-flow@alpha hooks notify --message "Task completed: $TASK_DESC" || true
# fi

# Example: Generate task summary
echo ""
echo "📊 Task Summary:"
echo "  Task ID: $TASK_ID"
echo "  Description: $TASK_DESC"
echo "  Status: Complete"

# Example: Session snapshot (if using claude-flow)
# Uncomment if you're using session management
# if command -v claude-flow &> /dev/null; then
#     SESSION_ID="${3:-swarm-default}"
#     echo "📸 Creating session snapshot..."
#     npx claude-flow@alpha hooks session-snapshot --session-id "$SESSION_ID" || true
# fi

echo "✅ Post-task finalization complete"
echo ""

# Exit with success
exit 0
