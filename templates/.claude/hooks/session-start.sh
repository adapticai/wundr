#!/bin/bash
#
# Session Start Hook with Wundr MCP Integration
# Runs when a new development session begins
#
# This hook initializes the session environment, restores context,
# and prepares MCP tools for the development session.
#
# MCP Tools Used:
#   - drift_detection: Create baseline for session
#   - test_baseline: Load coverage baseline
#   - governance_report: Load previous session context
#   - claude_config: Verify configuration
#
# Usage: ./session-start.sh [session_id] [project_type]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

SESSION_ID="${1:-$(date +%Y%m%d_%H%M%S)}"
PROJECT_TYPE="${2:-auto}"
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
echo "Session Start Hook: Initializing development session"
echo "========================================================================"
echo "Session ID: $SESSION_ID"
echo "Project Type: $PROJECT_TYPE"
echo "Timestamp: $(date +"%Y-%m-%d %H:%M:%S")"
echo ""

# Check MCP connection
check_mcp_connection || true

# Create session directory
mkdir -p "$SESSION_DIR"

# Store session start info
SESSION_FILE="$SESSION_DIR/session_${SESSION_ID}.json"
cat > "$SESSION_FILE" << EOF
{
  "sessionId": "$SESSION_ID",
  "startTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "projectType": "$PROJECT_TYPE",
  "mcpAvailable": $MCP_AVAILABLE,
  "status": "active"
}
EOF

echo "Session file created: $SESSION_FILE"

# -----------------------------------------------------------------------------
# ENVIRONMENT DETECTION
# -----------------------------------------------------------------------------

echo ""
echo "--- Environment Detection ---"

# Detect project type if auto
if [ "$PROJECT_TYPE" = "auto" ]; then
    if [ -f "package.json" ]; then
        if grep -q "react\|next\|vue\|angular" package.json 2>/dev/null; then
            PROJECT_TYPE="frontend"
        elif grep -q "express\|fastify\|nest\|koa" package.json 2>/dev/null; then
            PROJECT_TYPE="backend"
        else
            PROJECT_TYPE="nodejs"
        fi
    elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
        PROJECT_TYPE="python"
    elif [ -f "go.mod" ]; then
        PROJECT_TYPE="go"
    elif [ -f "Cargo.toml" ]; then
        PROJECT_TYPE="rust"
    else
        PROJECT_TYPE="generic"
    fi

    echo "Detected project type: $PROJECT_TYPE"
fi

# Detect runtime versions
echo ""
if command -v node &> /dev/null; then
    echo "Node.js: $(node --version)"
fi
if command -v python3 &> /dev/null; then
    echo "Python: $(python3 --version 2>&1)"
fi
if command -v go &> /dev/null; then
    echo "Go: $(go version | awk '{print $3}')"
fi
if command -v rustc &> /dev/null; then
    echo "Rust: $(rustc --version | awk '{print $2}')"
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT BASELINE
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Creating Drift Baseline ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"create-baseline\", \"session\": \"$SESSION_ID\" }"
    echo ""
    echo "Claude Code will create baseline for:"
    echo "  - Code quality metrics"
    echo "  - Pattern compliance"
    echo "  - Complexity scores"
else
    echo "Fallback: Creating basic metrics baseline..."

    BASELINE_FILE="$SESSION_DIR/baseline_${SESSION_ID}.json"

    # Collect basic metrics
    TOTAL_FILES=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" \) 2>/dev/null | wc -l | tr -d ' ')
    TOTAL_LINES=$(find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.py" \) -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
    TODO_COUNT=$(grep -r "TODO\|FIXME" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | wc -l | tr -d ' ' || echo "0")

    cat > "$BASELINE_FILE" << EOF
{
  "sessionId": "$SESSION_ID",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metrics": {
    "totalFiles": $TOTAL_FILES,
    "totalLines": $TOTAL_LINES,
    "todoCount": $TODO_COUNT
  }
}
EOF

    echo "  Total source files: $TOTAL_FILES"
    echo "  Total lines: $TOTAL_LINES"
    echo "  TODO/FIXME count: $TODO_COUNT"
    echo "  Baseline saved: $BASELINE_FILE"
fi

# -----------------------------------------------------------------------------
# MCP TOOL: TEST BASELINE
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Loading Test Baseline ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: test_baseline"
    echo "MCP_PARAMS: { \"action\": \"load\", \"session\": \"$SESSION_ID\" }"
    echo ""
    echo "Claude Code will load:"
    echo "  - Current coverage metrics"
    echo "  - Test pass/fail history"
else
    echo "Fallback: Loading coverage baseline..."

    if [ -f "coverage/coverage-summary.json" ]; then
        if command -v jq &> /dev/null; then
            LINE_COV=$(jq -r '.total.lines.pct // 0' coverage/coverage-summary.json 2>/dev/null)
            BRANCH_COV=$(jq -r '.total.branches.pct // 0' coverage/coverage-summary.json 2>/dev/null)
            echo "  Line coverage: ${LINE_COV}%"
            echo "  Branch coverage: ${BRANCH_COV}%"
        else
            echo "  Coverage file found (jq not available for parsing)"
        fi
    else
        echo "  No coverage baseline found"
        echo "  Run tests with coverage to create baseline"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: CONFIGURATION CHECK
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Configuration Verification ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: claude_config"
    echo "MCP_PARAMS: { \"action\": \"verify\", \"projectType\": \"$PROJECT_TYPE\" }"
    echo ""
    echo "Claude Code will verify:"
    echo "  - CLAUDE.md configuration"
    echo "  - Hook setup"
    echo "  - Convention files"
else
    echo "Fallback: Checking configuration files..."

    # Check for CLAUDE.md
    if [ -f "CLAUDE.md" ]; then
        echo "[OK] CLAUDE.md found"
    elif [ -f ".claude/CLAUDE.md" ]; then
        echo "[OK] .claude/CLAUDE.md found"
    else
        echo "[WARN] No CLAUDE.md configuration found"
    fi

    # Check for hooks directory
    if [ -d ".claude/hooks" ]; then
        HOOK_COUNT=$(ls -1 .claude/hooks/*.sh 2>/dev/null | wc -l | tr -d ' ')
        echo "[OK] Hooks directory found ($HOOK_COUNT hooks)"
    else
        echo "[INFO] No hooks directory"
    fi

    # Check for config files
    [ -f "tsconfig.json" ] && echo "[OK] tsconfig.json found"
    [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] && echo "[OK] ESLint config found"
    [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] && echo "[OK] Prettier config found"
    [ -f "jest.config.js" ] || [ -f "jest.config.ts" ] && echo "[OK] Jest config found"
fi

# -----------------------------------------------------------------------------
# MCP TOOL: PREVIOUS SESSION CONTEXT
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Loading Previous Session Context ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: governance_report"
    echo "MCP_PARAMS: { \"action\": \"load-context\", \"session\": \"$SESSION_ID\" }"
    echo ""
    echo "Claude Code will load:"
    echo "  - Previous session notes"
    echo "  - Incomplete tasks"
    echo "  - Known issues"
else
    echo "Fallback: Checking for previous session..."

    # Find most recent session summary
    LAST_SESSION=$(ls -t "$SESSION_DIR"/session_*.md 2>/dev/null | head -1)
    if [ -n "$LAST_SESSION" ] && [ -f "$LAST_SESSION" ]; then
        echo "  Found previous session: $(basename "$LAST_SESSION")"

        # Extract next steps if available
        if grep -q "## Next Steps" "$LAST_SESSION" 2>/dev/null; then
            echo "  Previous session had pending next steps"
        fi
    else
        echo "  No previous session found"
    fi
fi

# -----------------------------------------------------------------------------
# CLAUDE-FLOW INTEGRATION
# -----------------------------------------------------------------------------

echo ""
echo "--- Claude-Flow Integration ---"

if command -v npx &> /dev/null; then
    if npx claude-flow@alpha --version &> /dev/null 2>&1; then
        echo "Initializing Claude-Flow session..."
        npx claude-flow@alpha hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || echo "  Session restore skipped (no previous state)"
    else
        echo "Claude-Flow not available"
    fi
fi

# -----------------------------------------------------------------------------
# GIT STATUS
# -----------------------------------------------------------------------------

echo ""
echo "--- Git Status ---"

if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "Current branch: $BRANCH"

    # Check for uncommitted changes
    CHANGED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$CHANGED" -gt 0 ]; then
        echo "[WARN] $CHANGED uncommitted changes"
        echo ""
        echo "Changed files:"
        git status --short | head -10
        if [ "$CHANGED" -gt 10 ]; then
            echo "... and $((CHANGED - 10)) more"
        fi
    else
        echo "[OK] Working directory clean"
    fi

    # Check if ahead/behind remote
    git fetch --quiet 2>/dev/null || true
    AHEAD=$(git rev-list --count @{upstream}..HEAD 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count HEAD..@{upstream} 2>/dev/null || echo "0")

    if [ "$AHEAD" -gt 0 ]; then
        echo "[INFO] $AHEAD commits ahead of remote"
    fi
    if [ "$BEHIND" -gt 0 ]; then
        echo "[WARN] $BEHIND commits behind remote - consider pulling"
    fi
else
    echo "[INFO] Not a git repository"
fi

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Session Initialization Complete"
echo "========================================================================"
echo ""
echo "Session: $SESSION_ID"
echo "Project: $PROJECT_TYPE"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED")"
echo ""
echo "Available MCP Tools:"
echo "  - drift_detection: Monitor code quality drift"
echo "  - pattern_standardize: Auto-fix code patterns"
echo "  - dependency_analyze: Analyze dependencies"
echo "  - test_baseline: Track coverage"
echo "  - governance_report: Generate reports"
echo "  - monorepo_manage: Monorepo operations"
echo "  - claude_config: Configure Claude Code"
echo ""
echo "Session file: $SESSION_FILE"
echo ""
echo "Ready for development!"

exit 0
