#!/bin/bash
#
# Session End Hook
# Runs when a development session ends
#
# This hook saves session state, generates summaries,
# and performs cleanup before ending the session.
#

set -e  # Exit on error

SESSION_ID="${1:-default}"
EXPORT_METRICS="${2:-false}"

echo "🔚 Session End Hook: Finalizing session $SESSION_ID"

# ============================================================================
# CUSTOMIZE: Add your session end actions here
# ============================================================================

# Create session summary directory
SUMMARY_DIR=".claude/sessions"
mkdir -p "$SUMMARY_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SUMMARY_FILE="$SUMMARY_DIR/session_${SESSION_ID}_${TIMESTAMP}.md"

echo "📝 Generating session summary..."

# Generate summary header
cat > "$SUMMARY_FILE" << EOF
# Session Summary

**Session ID**: $SESSION_ID
**Date**: $(date +"%Y-%m-%d %H:%M:%S")
**Duration**: [Calculate from session start time]

## Summary

EOF

# Git statistics (if in git repo)
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "## Git Changes" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"

    # Files changed
    CHANGED_FILES=$(git diff --name-only)
    if [ -n "$CHANGED_FILES" ]; then
        echo "### Modified Files:" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
        echo "$CHANGED_FILES" >> "$SUMMARY_FILE"
        echo '```' >> "$SUMMARY_FILE"
        echo "" >> "$SUMMARY_FILE"
    fi

    # Stats
    echo "### Statistics:" >> "$SUMMARY_FILE"
    echo '```' >> "$SUMMARY_FILE"
    git diff --shortstat >> "$SUMMARY_FILE" 2>/dev/null || echo "No changes" >> "$SUMMARY_FILE"
    echo '```' >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
fi

# Test results (if available)
if [ -f "coverage/coverage-summary.json" ]; then
    echo "## Test Coverage" >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
    echo '```json' >> "$SUMMARY_FILE"
    cat "coverage/coverage-summary.json" >> "$SUMMARY_FILE"
    echo '```' >> "$SUMMARY_FILE"
    echo "" >> "$SUMMARY_FILE"
fi

# Add notes section
cat >> "$SUMMARY_FILE" << EOF
## Notes

- [Add any important notes about this session]

## Next Steps

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Issues Encountered

- [List any issues or blockers]

## Learnings

- [Document what was learned]

EOF

echo "✓ Session summary saved to: $SUMMARY_FILE"

# Export metrics (if using claude-flow)
if [ "$EXPORT_METRICS" = "true" ] && command -v claude-flow &> /dev/null; then
    echo "📊 Exporting session metrics..."
    METRICS_FILE="$SUMMARY_DIR/metrics_${SESSION_ID}_${TIMESTAMP}.json"
    npx claude-flow@alpha hooks session-end --session-id "$SESSION_ID" --export-metrics true > "$METRICS_FILE" 2>/dev/null || true
    echo "✓ Metrics exported to: $METRICS_FILE"
fi

# Backup uncommitted work
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "💾 Creating backup of uncommitted work..."
        BACKUP_BRANCH="backup/session-${SESSION_ID}-${TIMESTAMP}"
        git stash push -u -m "Session backup: $SESSION_ID at $TIMESTAMP"
        echo "✓ Backup created: $BACKUP_BRANCH (stash)"
        echo ""
        echo "⚠️  You have uncommitted changes!"
        echo "   To restore: git stash pop"
    fi
fi

# Clean up temporary files
echo "🧹 Cleaning up temporary files..."
if [ -d "tmp" ]; then
    rm -rf tmp/*
    echo "✓ Cleaned tmp directory"
fi

# Archive old logs
if [ -d "logs" ]; then
    find logs -name "*.log" -mtime +7 -exec gzip {} \;
    echo "✓ Archived old log files"
fi

# Display session summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Session Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Git Changes:"
    git diff --shortstat 2>/dev/null || echo "  No changes"
    echo ""

    CHANGED_COUNT=$(git status --short | wc -l | tr -d ' ')
    if [ "$CHANGED_COUNT" -gt 0 ]; then
        echo "Modified files: $CHANGED_COUNT"
        echo ""
        echo "Remember to commit your changes:"
        echo "  git add ."
        echo "  git commit -m \"your message\""
    fi
fi

echo ""
echo "Session summary saved to:"
echo "  $SUMMARY_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "✅ Session end complete"

# Exit with success
exit 0
