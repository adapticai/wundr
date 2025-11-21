#!/bin/bash
#
# Pre-Task Hook with Wundr MCP Integration
# Runs before any task execution begins
#
# This hook prepares the environment, validates preconditions,
# and integrates with Wundr MCP tools for code quality and governance.
#
# MCP Tools Used:
#   - drift_detection: Check for code quality drift before starting
#   - dependency_analyze: Analyze dependencies for issues
#   - test_baseline: Load coverage baseline for comparison
#
# Usage: ./pre-task.sh "<task description>" [session_id]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

TASK_DESC="${1:-Unknown task}"
SESSION_ID="${2:-swarm-default}"
MCP_TIMEOUT=30
MCP_AVAILABLE=false

# =============================================================================
# MCP CONNECTION VERIFICATION
# =============================================================================

# Function to check if MCP server is available
check_mcp_connection() {
    echo "Checking Wundr MCP server connection..."

    # Check if claude command is available with MCP support
    if command -v claude &> /dev/null; then
        # Test MCP connection by listing available tools
        if timeout "$MCP_TIMEOUT" claude mcp list 2>/dev/null | grep -q "wundr\|drift\|governance" &> /dev/null; then
            MCP_AVAILABLE=true
            echo "MCP server connection: AVAILABLE"
            return 0
        fi
    fi

    echo "MCP server connection: UNAVAILABLE (using fallback mode)"
    return 1
}

# Function to invoke MCP tool with fallback
invoke_mcp_tool() {
    local tool_name="$1"
    local tool_args="$2"
    local fallback_cmd="$3"

    if [ "$MCP_AVAILABLE" = true ]; then
        echo "Invoking MCP tool: $tool_name"
        # MCP tool invocation through Claude Code
        # Note: In actual use, MCP tools are invoked through Claude Code's interface
        # This script prepares the context for MCP tool usage
        echo "  MCP: $tool_name $tool_args"
        return 0
    else
        # Fallback to direct CLI if MCP unavailable
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
echo "Pre-Task Hook: Preparing environment..."
echo "========================================================================"
echo "Task: $TASK_DESC"
echo "Session: $SESSION_ID"
echo ""

# Check MCP connection (non-blocking)
check_mcp_connection || true

# -----------------------------------------------------------------------------
# ENVIRONMENT CHECKS
# -----------------------------------------------------------------------------

echo ""
echo "--- Environment Checks ---"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "[OK] Node.js version: $NODE_VERSION"
else
    echo "[WARN] Node.js not found - may be required for this project"
fi

# Check if git repository is clean
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [[ -n $(git status --porcelain) ]]; then
        echo "[WARN] Git working directory is not clean"
        echo "       Consider committing or stashing changes before starting"
    else
        echo "[OK] Git working directory is clean"
    fi
fi

# Check if dependencies are installed
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "[WARN] Dependencies not installed"
        echo "       Run: npm install"
    else
        echo "[OK] Dependencies installed"
    fi
fi

# Validate environment variables
REQUIRED_ENV_VARS=("NODE_ENV")
for var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "[WARN] Environment variable $var is not set"
    else
        echo "[OK] Environment variable $var is set"
    fi
done

# Create necessary directories
REQUIRED_DIRS=("logs" "tmp" ".claude/sessions")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "[OK] Created directory: $dir"
    fi
done

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT DETECTION
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Code Quality Drift Detection ---"

if [ "$MCP_AVAILABLE" = true ]; then
    # Prepare context for drift_detection MCP tool
    # This will be invoked by Claude Code when processing the hook output
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"check\", \"scope\": \"pre-task\" }"
    echo ""
    echo "Claude Code will check for code quality drift using:"
    echo "  - Pattern violations"
    echo "  - Code complexity increases"
    echo "  - Test coverage regression"
else
    # Fallback: Manual drift detection
    echo "Fallback: Running basic quality checks..."

    # Check for TODO/FIXME comments
    if command -v grep &> /dev/null; then
        TODO_COUNT=$(grep -r "TODO\|FIXME" --include="*.ts" --include="*.js" --include="*.py" . 2>/dev/null | wc -l || echo "0")
        echo "  Found $TODO_COUNT TODO/FIXME comments"
    fi

    # Check for console.log statements
    if [ -f "package.json" ]; then
        CONSOLE_COUNT=$(grep -r "console.log" --include="*.ts" --include="*.js" . 2>/dev/null | wc -l || echo "0")
        echo "  Found $CONSOLE_COUNT console.log statements"
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DEPENDENCY ANALYSIS
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Dependency Analysis ---"

if [ "$MCP_AVAILABLE" = true ]; then
    # Prepare context for dependency_analyze MCP tool
    echo "MCP_TOOL_REQUEST: dependency_analyze"
    echo "MCP_PARAMS: { \"action\": \"quick-check\", \"checkCircular\": true }"
    echo ""
    echo "Claude Code will analyze dependencies for:"
    echo "  - Circular dependencies"
    echo "  - Outdated packages"
    echo "  - Security vulnerabilities"
else
    # Fallback: Basic dependency checks
    echo "Fallback: Running basic dependency checks..."

    if [ -f "package.json" ]; then
        # Check for outdated packages (if npm is available)
        if command -v npm &> /dev/null; then
            echo "  Running: npm outdated (summary)"
            npm outdated --depth=0 2>/dev/null | head -10 || echo "  No outdated packages found"
        fi
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: TEST BASELINE LOAD
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Test Coverage Baseline ---"

if [ "$MCP_AVAILABLE" = true ]; then
    # Prepare context for test_baseline MCP tool
    echo "MCP_TOOL_REQUEST: test_baseline"
    echo "MCP_PARAMS: { \"action\": \"load\", \"session\": \"$SESSION_ID\" }"
    echo ""
    echo "Claude Code will load test baseline for:"
    echo "  - Coverage comparison after task"
    echo "  - Regression detection"
else
    # Fallback: Check for existing coverage
    echo "Fallback: Checking coverage baseline..."

    if [ -f "coverage/coverage-summary.json" ]; then
        echo "  Found existing coverage summary"
        if command -v jq &> /dev/null; then
            COVERAGE=$(jq -r '.total.lines.pct // "unknown"' coverage/coverage-summary.json 2>/dev/null)
            echo "  Current line coverage: ${COVERAGE}%"
        fi
    else
        echo "  No coverage baseline found"
    fi
fi

# -----------------------------------------------------------------------------
# CLAUDE-FLOW INTEGRATION (Optional)
# -----------------------------------------------------------------------------

echo ""
echo "--- Claude-Flow Integration ---"

if command -v npx &> /dev/null; then
    # Pre-task hook for claude-flow
    if npx claude-flow@alpha --version &> /dev/null 2>&1; then
        echo "Claude-Flow detected, initializing pre-task context..."
        npx claude-flow@alpha hooks pre-task --description "$TASK_DESC" 2>/dev/null || echo "  Claude-Flow pre-task hook skipped"

        # Session restore
        npx claude-flow@alpha hooks session-restore --session-id "$SESSION_ID" 2>/dev/null || echo "  Session restore skipped"
    else
        echo "Claude-Flow not available - skipping integration"
    fi
else
    echo "npx not available - skipping Claude-Flow integration"
fi

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Pre-Task Preparation Complete"
echo "========================================================================"
echo ""
echo "Task ready to begin: $TASK_DESC"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED (fallback mode)")"
echo ""
echo "MCP Tools Available for This Task:"
echo "  - drift_detection: Monitor code quality"
echo "  - pattern_standardize: Auto-fix patterns"
echo "  - dependency_analyze: Check dependencies"
echo "  - test_baseline: Track coverage"
echo "  - governance_report: Generate reports"
echo ""

# Store pre-task timestamp for duration tracking
echo "$(date +%s)" > ".claude/sessions/.task_start_${SESSION_ID}"

# Exit with success
exit 0
