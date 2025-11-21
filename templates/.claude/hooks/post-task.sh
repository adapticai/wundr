#!/bin/bash
#
# Post-Task Hook with Wundr MCP Integration
# Runs after task execution completes
#
# This hook performs cleanup, validation, and finalization
# after completing work on a task, integrating with Wundr MCP tools.
#
# MCP Tools Used:
#   - drift_detection: Compare drift before/after task
#   - pattern_standardize: Auto-fix any pattern violations
#   - test_baseline: Compare coverage against baseline
#   - governance_report: Generate task completion report
#
# Usage: ./post-task.sh "<task_id>" "<task description>" [session_id]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

TASK_ID="${1:-unknown}"
TASK_DESC="${2:-Unknown task}"
SESSION_ID="${3:-swarm-default}"
MCP_TIMEOUT=30
MCP_AVAILABLE=false

# =============================================================================
# MCP CONNECTION VERIFICATION
# =============================================================================

check_mcp_connection() {
    echo "Checking Wundr MCP server connection..."

    if command -v claude &> /dev/null; then
        if timeout "$MCP_TIMEOUT" claude mcp list 2>/dev/null | grep -q "wundr\|drift\|governance" &> /dev/null; then
            MCP_AVAILABLE=true
            echo "MCP server connection: AVAILABLE"
            return 0
        fi
    fi

    echo "MCP server connection: UNAVAILABLE (using fallback mode)"
    return 1
}

invoke_mcp_tool() {
    local tool_name="$1"
    local tool_args="$2"
    local fallback_cmd="$3"

    if [ "$MCP_AVAILABLE" = true ]; then
        echo "Invoking MCP tool: $tool_name"
        echo "  MCP: $tool_name $tool_args"
        return 0
    else
        if [ -n "$fallback_cmd" ]; then
            echo "Fallback: Running direct CLI command"
            eval "$fallback_cmd" || true
        fi
        return 1
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

echo "========================================================================"
echo "Post-Task Hook: Finalizing task..."
echo "========================================================================"
echo "Task ID: $TASK_ID"
echo "Task: $TASK_DESC"
echo "Session: $SESSION_ID"
echo ""

# Check MCP connection
check_mcp_connection || true

# Calculate task duration
TASK_START_FILE=".claude/sessions/.task_start_${SESSION_ID}"
if [ -f "$TASK_START_FILE" ]; then
    START_TIME=$(cat "$TASK_START_FILE")
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "Task Duration: ${DURATION}s"
    rm -f "$TASK_START_FILE"
fi

# -----------------------------------------------------------------------------
# CODE QUALITY CHECKS
# -----------------------------------------------------------------------------

echo ""
echo "--- Code Quality Checks ---"

# Run linter
if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
    echo "Running linter..."
    if npm run lint 2>/dev/null; then
        echo "[OK] Linting passed"
    else
        echo "[WARN] Linting failed - please fix errors"
    fi
fi

# Format code
if [ -f "package.json" ] && grep -q "\"format\"" package.json; then
    echo "Formatting code..."
    npm run format 2>/dev/null || echo "[WARN] Formatting not available"
fi

# Type checking
if [ -f "tsconfig.json" ]; then
    echo "Running type check..."
    if npx tsc --noEmit 2>/dev/null; then
        echo "[OK] Type check passed"
    else
        echo "[WARN] Type errors found"
    fi
fi

# Run tests
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
    echo "Running tests..."
    if npm test 2>/dev/null; then
        echo "[OK] Tests passed"
    else
        echo "[WARN] Tests failed - task may not be complete"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT DETECTION (Post-Task)
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Code Quality Drift Detection ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"compare\", \"scope\": \"post-task\", \"taskId\": \"$TASK_ID\" }"
    echo ""
    echo "Claude Code will compare code quality:"
    echo "  - Before vs after task changes"
    echo "  - Identify new drift patterns"
    echo "  - Flag regressions"
else
    # Fallback drift detection
    echo "Fallback: Running basic drift checks..."

    # Check for new TODO/FIXME comments
    if git rev-parse --git-dir > /dev/null 2>&1; then
        NEW_TODOS=$(git diff --cached | grep -E "^\+.*TODO|^\+.*FIXME" 2>/dev/null | wc -l || echo "0")
        echo "  New TODO/FIXME comments added: $NEW_TODOS"

        NEW_CONSOLE=$(git diff --cached | grep -E "^\+.*console\.(log|debug|info)" 2>/dev/null | wc -l || echo "0")
        echo "  New console statements added: $NEW_CONSOLE"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: PATTERN STANDARDIZATION
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Pattern Standardization ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: pattern_standardize"
    echo "MCP_PARAMS: { \"action\": \"auto-fix\", \"scope\": \"changed-files\", \"dryRun\": false }"
    echo ""
    echo "Claude Code will standardize:"
    echo "  - Import ordering"
    echo "  - Error handling patterns"
    echo "  - Code style violations"
else
    echo "Fallback: Pattern standardization requires MCP tools"
    echo "  Manual review recommended for code patterns"
fi

# -----------------------------------------------------------------------------
# MCP TOOL: TEST BASELINE COMPARISON
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Test Coverage Comparison ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: test_baseline"
    echo "MCP_PARAMS: { \"action\": \"compare\", \"session\": \"$SESSION_ID\", \"failOnRegression\": false }"
    echo ""
    echo "Claude Code will compare coverage:"
    echo "  - Line coverage delta"
    echo "  - Branch coverage delta"
    echo "  - New uncovered lines"
else
    echo "Fallback: Checking coverage comparison..."

    if [ -f "coverage/coverage-summary.json" ]; then
        if command -v jq &> /dev/null; then
            COVERAGE=$(jq -r '.total.lines.pct // "unknown"' coverage/coverage-summary.json 2>/dev/null)
            echo "  Current line coverage: ${COVERAGE}%"
        fi
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: GOVERNANCE REPORT
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Governance Report ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: governance_report"
    echo "MCP_PARAMS: { \"action\": \"task-summary\", \"taskId\": \"$TASK_ID\", \"description\": \"$TASK_DESC\" }"
    echo ""
    echo "Claude Code will generate:"
    echo "  - Task completion summary"
    echo "  - Quality metrics"
    echo "  - Compliance status"
else
    echo "Fallback: Generating basic task summary..."

    SUMMARY_DIR=".claude/sessions"
    mkdir -p "$SUMMARY_DIR"

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    SUMMARY_FILE="$SUMMARY_DIR/task_${TASK_ID}_${TIMESTAMP}.md"

    cat > "$SUMMARY_FILE" << EOF
# Task Completion Summary

**Task ID**: $TASK_ID
**Description**: $TASK_DESC
**Session**: $SESSION_ID
**Completed**: $(date +"%Y-%m-%d %H:%M:%S")
**Duration**: ${DURATION:-unknown}s

## Changes

EOF

    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo '```' >> "$SUMMARY_FILE"
        git diff --stat >> "$SUMMARY_FILE" 2>/dev/null || echo "No changes" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
    fi

    echo "  Summary saved to: $SUMMARY_FILE"
fi

# -----------------------------------------------------------------------------
# CLAUDE-FLOW INTEGRATION
# -----------------------------------------------------------------------------

echo ""
echo "--- Claude-Flow Integration ---"

if command -v npx &> /dev/null; then
    if npx claude-flow@alpha --version &> /dev/null 2>&1; then
        echo "Storing task completion in Claude-Flow..."
        npx claude-flow@alpha hooks post-task --task-id "$TASK_ID" 2>/dev/null || echo "  Post-task hook skipped"
        npx claude-flow@alpha hooks notify --message "Task completed: $TASK_DESC" 2>/dev/null || echo "  Notification skipped"
    else
        echo "Claude-Flow not available"
    fi
fi

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Post-Task Finalization Complete"
echo "========================================================================"
echo ""
echo "Task Summary:"
echo "  ID: $TASK_ID"
echo "  Description: $TASK_DESC"
echo "  Duration: ${DURATION:-unknown}s"
echo "  Status: Complete"
echo ""
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED (fallback mode)")"
echo ""

# Check for uncommitted changes
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "Uncommitted changes detected!"
        echo "  Consider running: git add . && git commit -m \"$TASK_DESC\""
    fi
fi

exit 0
