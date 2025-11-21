#!/usr/bin/env bash
################################################################################
# HOOKS USAGE EXAMPLES
# Demonstrates how to use Claude Code hooks
################################################################################

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== Claude Code Hooks Usage Examples ==="
echo ""

################################################################################
# Example 1: Complete Task Workflow
################################################################################

echo "Example 1: Complete Task Workflow"
echo "-----------------------------------"

# Start a new task
SESSION_ID="swarm-$(date +%s)"
TASK_ID="task-$(date +%s)"
TASK_DESCRIPTION="Implement user authentication feature"

echo "1. Running pre-task hook..."
"$PROJECT_ROOT/hooks/templates/pre-task.sh" \
    "$TASK_DESCRIPTION" \
    "$TASK_ID" \
    "$SESSION_ID" \
    "auto" \
    "complex"

echo ""
echo "2. Simulate task work..."
sleep 2

echo ""
echo "3. Running post-task hook..."
"$PROJECT_ROOT/hooks/templates/post-task.sh" \
    "$TASK_ID" \
    "$SESSION_ID" \
    "completed"

echo ""
echo "Task workflow complete!"
echo ""

################################################################################
# Example 2: File Edit Workflow
################################################################################

echo "Example 2: File Edit Workflow"
echo "------------------------------"

TEST_FILE="$PROJECT_ROOT/examples/test-file.txt"
mkdir -p "$(dirname "$TEST_FILE")"
echo "Initial content" > "$TEST_FILE"

echo "1. Running pre-edit hook..."
"$PROJECT_ROOT/hooks/templates/pre-edit.sh" \
    "$TEST_FILE" \
    "modify" \
    "$SESSION_ID" \
    "$TASK_ID"

echo ""
echo "2. Editing file..."
echo "Modified content at $(date)" >> "$TEST_FILE"

echo ""
echo "3. Running post-edit hook..."
"$PROJECT_ROOT/hooks/templates/post-edit.sh" \
    "$TEST_FILE" \
    "modify" \
    "$SESSION_ID" \
    "$TASK_ID" \
    "swarm/${SESSION_ID}/files/test"

echo ""
echo "File edit workflow complete!"
echo ""

################################################################################
# Example 3: Session Management
################################################################################

echo "Example 3: Session Management"
echo "------------------------------"

echo "1. Ending current session..."
"$PROJECT_ROOT/hooks/templates/session-end.sh" \
    "$SESSION_ID" \
    "true" \
    "true" \
    "true"

echo ""
echo "2. Restoring session..."
"$PROJECT_ROOT/hooks/templates/session-restore.sh" \
    "$SESSION_ID" \
    "true" \
    "true" \
    "true"

echo ""
echo "Session management complete!"
echo ""

################################################################################
# Example 4: With Claude Flow Integration
################################################################################

echo "Example 4: Claude Flow Integration"
echo "-----------------------------------"

# Initialize swarm
echo "1. Initializing swarm..."
npx claude-flow@alpha hooks swarm-init \
    --topology "mesh" \
    --max-agents 3 \
    --session-id "$SESSION_ID" || echo "Claude Flow not available"

# Spawn agents
echo ""
echo "2. Spawning agents..."
npx claude-flow@alpha hooks agent-spawn \
    --type "coder" \
    --session-id "$SESSION_ID" || echo "Claude Flow not available"

# Check status
echo ""
echo "3. Checking swarm status..."
npx claude-flow@alpha hooks swarm-status \
    --session-id "$SESSION_ID" || echo "Claude Flow not available"

echo ""
echo "Claude Flow integration complete!"
echo ""

################################################################################
# Example 5: Custom Hook Configuration
################################################################################

echo "Example 5: Custom Hook Configuration"
echo "-------------------------------------"

cat > "$PROJECT_ROOT/.claude/hooks.config.json" <<'EOF'
{
  "autoFormat": true,
  "autoStage": true,
  "archiveTasks": true,
  "git": {
    "autoWorktree": true,
    "autoCommit": false
  },
  "logging": {
    "level": "debug"
  }
}
EOF

echo "Custom configuration created at: $PROJECT_ROOT/.claude/hooks.config.json"
echo ""

################################################################################
# Example 6: Programmatic Hook Usage
################################################################################

echo "Example 6: Programmatic Usage"
echo "------------------------------"

# Function to wrap hook execution
run_with_hooks() {
    local file_path="$1"
    local session_id="$2"
    local task_id="$3"

    # Pre-edit
    "$PROJECT_ROOT/hooks/templates/pre-edit.sh" "$file_path" "modify" "$session_id" "$task_id"

    # Your edit logic here
    echo "Editing: $file_path"

    # Post-edit
    "$PROJECT_ROOT/hooks/templates/post-edit.sh" "$file_path" "modify" "$session_id" "$task_id"
}

echo "Running wrapped function..."
run_with_hooks "$TEST_FILE" "$SESSION_ID" "$TASK_ID"

echo ""
echo "Programmatic usage complete!"
echo ""

################################################################################
# Example 7: Error Handling
################################################################################

echo "Example 7: Error Handling"
echo "-------------------------"

# Try to edit non-existent file (should fail gracefully)
echo "Attempting to edit non-existent file..."
"$PROJECT_ROOT/hooks/templates/pre-edit.sh" \
    "/tmp/nonexistent-file.txt" \
    "modify" \
    "$SESSION_ID" \
    "$TASK_ID" 2>&1 || echo "✓ Error handled correctly"

echo ""
echo "Error handling complete!"
echo ""

################################################################################
# Summary
################################################################################

echo "=== All Examples Complete ==="
echo ""
echo "Check the following locations for results:"
echo "  - Logs: $PROJECT_ROOT/.claude/logs/"
echo "  - Tasks: $PROJECT_ROOT/.claude/tasks/"
echo "  - Sessions: $PROJECT_ROOT/.claude/sessions/"
echo "  - Backups: $PROJECT_ROOT/.claude/backups/"
echo ""
echo "For more information, see: $PROJECT_ROOT/hooks/README.md"
