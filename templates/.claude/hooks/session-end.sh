#!/bin/bash
#
# Session End Hook with Wundr MCP Integration
# Runs when a development session ends
#
# This hook saves session state, generates summaries, compares metrics,
# and performs cleanup with MCP tool integration.
#
# MCP Tools Used:
#   - drift_detection: Compare drift against session baseline
#   - test_baseline: Compare coverage changes
#   - governance_report: Generate comprehensive session report
#   - dependency_analyze: Final dependency health check
#
# Usage: ./session-end.sh [session_id] [export_metrics]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

SESSION_ID="${1:-default}"
EXPORT_METRICS="${2:-true}"
MCP_TIMEOUT=30
MCP_AVAILABLE=false
SESSION_DIR=".claude/sessions"

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

# =============================================================================
# MAIN EXECUTION
# =============================================================================

echo "========================================================================"
echo "Session End Hook: Finalizing session $SESSION_ID"
echo "========================================================================"
echo "Timestamp: $(date +"%Y-%m-%d %H:%M:%S")"
echo ""

# Check MCP connection
check_mcp_connection || true

# Create session directory if needed
mkdir -p "$SESSION_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SUMMARY_FILE="$SESSION_DIR/session_${SESSION_ID}_${TIMESTAMP}.md"

# Calculate session duration
SESSION_INFO_FILE="$SESSION_DIR/session_${SESSION_ID}.json"
if [ -f "$SESSION_INFO_FILE" ]; then
    START_TIME=$(grep -o '"startTime"[^,]*' "$SESSION_INFO_FILE" 2>/dev/null | cut -d'"' -f4)
    if [ -n "$START_TIME" ]; then
        echo "Session started: $START_TIME"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT COMPARISON
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Code Quality Drift Comparison ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"compare-baseline\", \"session\": \"$SESSION_ID\" }"
    echo ""
    echo "Claude Code will compare:"
    echo "  - Quality metrics vs session start"
    echo "  - New drift patterns introduced"
    echo "  - Improvement/regression summary"
else
    echo "Fallback: Comparing basic metrics..."

    BASELINE_FILE="$SESSION_DIR/baseline_${SESSION_ID}.json"
    if [ -f "$BASELINE_FILE" ] && command -v jq &> /dev/null; then
        BASELINE_TODO=$(jq -r '.metrics.todoCount // 0' "$BASELINE_FILE" 2>/dev/null)
        CURRENT_TODO=$(grep -r "TODO\|FIXME" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | wc -l | tr -d ' ' || echo "0")

        TODO_DELTA=$((CURRENT_TODO - BASELINE_TODO))

        echo "  TODO/FIXME count:"
        echo "    Start: $BASELINE_TODO"
        echo "    End: $CURRENT_TODO"
        echo "    Delta: $TODO_DELTA"

        if [ "$TODO_DELTA" -gt 0 ]; then
            echo "  [WARN] $TODO_DELTA new TODO comments added"
        elif [ "$TODO_DELTA" -lt 0 ]; then
            echo "  [OK] ${TODO_DELTA#-} TODO comments resolved"
        fi
    else
        echo "  No baseline available for comparison"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: TEST COVERAGE COMPARISON
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Test Coverage Comparison ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: test_baseline"
    echo "MCP_PARAMS: { \"action\": \"compare\", \"session\": \"$SESSION_ID\", \"generateReport\": true }"
    echo ""
    echo "Claude Code will analyze:"
    echo "  - Coverage delta"
    echo "  - New uncovered lines"
    echo "  - Test effectiveness"
else
    echo "Fallback: Checking coverage comparison..."

    if [ -f "coverage/coverage-summary.json" ] && command -v jq &> /dev/null; then
        LINE_COV=$(jq -r '.total.lines.pct // 0' coverage/coverage-summary.json 2>/dev/null)
        BRANCH_COV=$(jq -r '.total.branches.pct // 0' coverage/coverage-summary.json 2>/dev/null)

        echo "  Current coverage:"
        echo "    Line: ${LINE_COV}%"
        echo "    Branch: ${BRANCH_COV}%"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DEPENDENCY HEALTH
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Final Dependency Health Check ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: dependency_analyze"
    echo "MCP_PARAMS: { \"action\": \"health-check\", \"checkCircular\": true, \"checkOutdated\": true }"
    echo ""
    echo "Claude Code will check:"
    echo "  - Circular dependencies"
    echo "  - Outdated packages"
    echo "  - Security vulnerabilities"
else
    echo "Fallback: Basic dependency check..."

    if [ -f "package.json" ] && command -v npm &> /dev/null; then
        echo "  Running npm audit..."
        npm audit --audit-level=moderate 2>/dev/null | head -5 || echo "  Audit completed"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: GOVERNANCE REPORT
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Generating Session Report ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: governance_report"
    echo "MCP_PARAMS: { \"action\": \"session-summary\", \"session\": \"$SESSION_ID\", \"format\": \"markdown\" }"
    echo ""
    echo "Claude Code will generate:"
    echo "  - Comprehensive session report"
    echo "  - Quality metrics summary"
    echo "  - Recommendations"
else
    echo "Fallback: Generating basic summary..."

    # Generate summary header
    cat > "$SUMMARY_FILE" << EOF
# Session Summary

**Session ID**: $SESSION_ID
**End Date**: $(date +"%Y-%m-%d %H:%M:%S")
**MCP Integration**: $([ "$MCP_AVAILABLE" = true ] && echo "Enabled" || echo "Disabled (fallback mode)")

## Summary

This session was completed with the Wundr MCP integration in $([ "$MCP_AVAILABLE" = true ] && echo "full" || echo "fallback") mode.

EOF

    # Git statistics
    if git rev-parse --git-dir > /dev/null 2>&1; then
        echo "## Git Changes" >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"

        # Files changed
        CHANGED_FILES=$(git diff --name-only 2>/dev/null)
        STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

        if [ -n "$STAGED_FILES" ]; then
            echo "### Staged Files:" >> "$SUMMARY_FILE"
            echo '```' >> "$SUMMARY_FILE"
            echo "$STAGED_FILES" >> "$SUMMARY_FILE"
            echo '```' >> "$SUMMARY_FILE"
            echo "" >> "$SUMMARY_FILE"
        fi

        if [ -n "$CHANGED_FILES" ]; then
            echo "### Modified Files (unstaged):" >> "$SUMMARY_FILE"
            echo '```' >> "$SUMMARY_FILE"
            echo "$CHANGED_FILES" >> "$SUMMARY_FILE"
            echo '```' >> "$SUMMARY_FILE"
            echo "" >> "$SUMMARY_FILE"
        fi

        # Stats
        echo "### Statistics:" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
        git diff --shortstat >> "$SUMMARY_FILE" 2>/dev/null || echo "No unstaged changes" >> "$SUMMARY_FILE"
        git diff --cached --shortstat >> "$SUMMARY_FILE" 2>/dev/null || echo "No staged changes" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
    fi

    # Test results
    if [ -f "coverage/coverage-summary.json" ]; then
        echo "## Test Coverage" >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
        echo '```json' >> "$SUMMARY_FILE"
        cat "coverage/coverage-summary.json" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
    fi

    # Add template sections
    cat >> "$SUMMARY_FILE" << EOF
## Quality Metrics

| Metric | Value |
|--------|-------|
| Files Modified | $(git diff --name-only 2>/dev/null | wc -l | tr -d ' ') |
| Lines Changed | $(git diff --shortstat 2>/dev/null | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | head -2 | tr '\n' ', ' || echo "0") |
| TODO Count | $(grep -r "TODO\|FIXME" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | wc -l | tr -d ' ' || echo "0") |

## MCP Tools Used

- drift_detection: $([ "$MCP_AVAILABLE" = true ] && echo "Yes" || echo "No (fallback)")
- pattern_standardize: $([ "$MCP_AVAILABLE" = true ] && echo "Yes" || echo "No (fallback)")
- test_baseline: $([ "$MCP_AVAILABLE" = true ] && echo "Yes" || echo "No (fallback)")
- governance_report: $([ "$MCP_AVAILABLE" = true ] && echo "Yes" || echo "No (fallback)")

## Notes

- [Add any important notes about this session]

## Next Steps

- [ ] Review and commit changes
- [ ] Run full test suite
- [ ] Update documentation if needed

## Issues Encountered

- [List any issues or blockers]

## Learnings

- [Document what was learned]

EOF

    echo "[OK] Session summary saved to: $SUMMARY_FILE"
fi

# -----------------------------------------------------------------------------
# CLAUDE-FLOW INTEGRATION
# -----------------------------------------------------------------------------

echo ""
echo "--- Claude-Flow Integration ---"

if [ "$EXPORT_METRICS" = "true" ] && command -v npx &> /dev/null; then
    if npx claude-flow@alpha --version &> /dev/null 2>&1; then
        echo "Exporting session metrics to Claude-Flow..."

        METRICS_FILE="$SESSION_DIR/metrics_${SESSION_ID}_${TIMESTAMP}.json"
        npx claude-flow@alpha hooks session-end --session-id "$SESSION_ID" --export-metrics true > "$METRICS_FILE" 2>/dev/null || echo "  Metrics export skipped"

        if [ -f "$METRICS_FILE" ] && [ -s "$METRICS_FILE" ]; then
            echo "[OK] Metrics exported to: $METRICS_FILE"
        fi
    else
        echo "Claude-Flow not available"
    fi
fi

# -----------------------------------------------------------------------------
# CLEANUP
# -----------------------------------------------------------------------------

echo ""
echo "--- Session Cleanup ---"

# Clean up temporary files
if [ -d "tmp" ]; then
    rm -rf tmp/* 2>/dev/null || true
    echo "[OK] Cleaned tmp directory"
fi

# Archive old logs
if [ -d "logs" ]; then
    find logs -name "*.log" -mtime +7 -exec gzip {} \; 2>/dev/null || true
    echo "[OK] Archived old log files"
fi

# Clean up edit logs
if [ -f "$SESSION_DIR/.edit_log" ]; then
    EDIT_COUNT=$(wc -l < "$SESSION_DIR/.edit_log" 2>/dev/null | tr -d ' ')
    echo "[OK] Session edit log: $EDIT_COUNT edits recorded"

    # Archive edit log
    mv "$SESSION_DIR/.edit_log" "$SESSION_DIR/edit_log_${SESSION_ID}_${TIMESTAMP}.txt" 2>/dev/null || true
fi

# Update session info file
if [ -f "$SESSION_INFO_FILE" ]; then
    # Mark session as completed
    if command -v jq &> /dev/null; then
        jq '. + {"status": "completed", "endTime": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"}' "$SESSION_INFO_FILE" > "${SESSION_INFO_FILE}.tmp" && mv "${SESSION_INFO_FILE}.tmp" "$SESSION_INFO_FILE"
    fi
fi

# -----------------------------------------------------------------------------
# BACKUP UNCOMMITTED WORK
# -----------------------------------------------------------------------------

echo ""
echo "--- Backup Check ---"

if git rev-parse --git-dir > /dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "[WARN] Uncommitted changes detected!"
        echo ""
        echo "Options:"
        echo "  1. Commit changes: git add . && git commit -m \"Session $SESSION_ID work\""
        echo "  2. Stash changes: git stash push -u -m \"Session $SESSION_ID backup\""
        echo ""

        # Optionally create automatic stash
        # Uncomment if you want automatic backup
        # BACKUP_NAME="session-${SESSION_ID}-${TIMESTAMP}"
        # git stash push -u -m "$BACKUP_NAME"
        # echo "[OK] Changes stashed as: $BACKUP_NAME"
    else
        echo "[OK] All changes committed"
    fi
fi

# -----------------------------------------------------------------------------
# FINAL SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Session Summary"
echo "========================================================================"

if git rev-parse --git-dir > /dev/null 2>&1; then
    echo ""
    echo "Git Status:"
    git diff --shortstat 2>/dev/null || echo "  No unstaged changes"
    git diff --cached --shortstat 2>/dev/null || echo "  No staged changes"

    CHANGED_COUNT=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CHANGED_COUNT" -gt 0 ]; then
        echo ""
        echo "Modified files: $CHANGED_COUNT"
        echo ""
        echo "Remember to commit your changes:"
        echo "  git add ."
        echo "  git commit -m \"your message\""
    fi
fi

echo ""
echo "Session files:"
echo "  Summary: $SUMMARY_FILE"
[ -f "$SESSION_INFO_FILE" ] && echo "  Info: $SESSION_INFO_FILE"

echo ""
echo "========================================================================"
echo "Session End Complete"
echo "========================================================================"
echo ""
echo "Session: $SESSION_ID"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED")"
echo ""
echo "Thank you for using Wundr MCP tools!"

exit 0
