#!/bin/bash
#
# Post-Edit Hook with Wundr MCP Integration
# Runs after file editing operations
#
# This hook automatically formats, validates, and processes
# files after they've been edited, integrating with Wundr MCP tools.
#
# MCP Tools Used:
#   - pattern_standardize: Auto-fix code patterns in edited file
#   - drift_detection: Check for new drift introduced
#   - test_baseline: Update coverage expectations if test file
#
# Usage: ./post-edit.sh "<file_path>" [memory_key]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

FILE_PATH="${1:-}"
MEMORY_KEY="${2:-}"
MCP_TIMEOUT=30
MCP_AVAILABLE=false

# =============================================================================
# MCP CONNECTION VERIFICATION
# =============================================================================

check_mcp_connection() {
    if command -v claude &> /dev/null; then
        if timeout "$MCP_TIMEOUT" claude mcp list 2>/dev/null | grep -q "wundr\|drift\|governance" &> /dev/null; then
            MCP_AVAILABLE=true
            return 0
        fi
    fi
    return 1
}

# =============================================================================
# VALIDATION
# =============================================================================

if [ -z "$FILE_PATH" ]; then
    echo "[WARN] No file path provided"
    exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
    echo "[WARN] File does not exist: $FILE_PATH"
    exit 0
fi

# =============================================================================
# MAIN EXECUTION
# =============================================================================

echo "========================================================================"
echo "Post-Edit Hook: Processing $FILE_PATH"
echo "========================================================================"

# Check MCP connection
check_mcp_connection || true

# Get file metadata
FILE_EXT="${FILE_PATH##*.}"
FILE_DIR=$(dirname "$FILE_PATH")
FILE_NAME=$(basename "$FILE_PATH")

echo "Extension: .$FILE_EXT"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED")"
echo ""

# -----------------------------------------------------------------------------
# MCP TOOL: PATTERN STANDARDIZATION (Primary)
# -----------------------------------------------------------------------------

echo "--- MCP: Pattern Standardization ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: pattern_standardize"
    echo "MCP_PARAMS: { \"action\": \"auto-fix\", \"file\": \"$FILE_PATH\", \"dryRun\": false }"
    echo ""
    echo "Claude Code will standardize:"
    echo "  - Import ordering"
    echo "  - Error handling patterns"
    echo "  - Code style violations"
    echo "  - Naming conventions"
else
    echo "Fallback: Running standard formatters..."

    # Auto-format based on file type
    case "$FILE_EXT" in
        ts|tsx|js|jsx)
            echo "Formatting TypeScript/JavaScript file..."

            # Prettier
            if command -v prettier &> /dev/null; then
                if prettier --write "$FILE_PATH" 2>/dev/null; then
                    echo "[OK] Prettier formatting applied"
                else
                    echo "[WARN] Prettier formatting failed"
                fi
            elif [ -f "node_modules/.bin/prettier" ]; then
                ./node_modules/.bin/prettier --write "$FILE_PATH" 2>/dev/null || echo "[WARN] Prettier failed"
            fi

            # ESLint auto-fix
            if command -v eslint &> /dev/null; then
                echo "Running ESLint auto-fix..."
                eslint --fix "$FILE_PATH" 2>/dev/null || echo "[WARN] ESLint fix failed"
            elif [ -f "node_modules/.bin/eslint" ]; then
                ./node_modules/.bin/eslint --fix "$FILE_PATH" 2>/dev/null || true
            fi
            ;;

        py)
            echo "Formatting Python file..."

            # Black formatter
            if command -v black &> /dev/null; then
                black "$FILE_PATH" 2>/dev/null && echo "[OK] Black formatting applied" || echo "[WARN] Black failed"
            fi

            # isort for imports
            if command -v isort &> /dev/null; then
                isort "$FILE_PATH" 2>/dev/null && echo "[OK] isort applied" || echo "[WARN] isort failed"
            fi

            # Ruff (modern Python linter)
            if command -v ruff &> /dev/null; then
                ruff check --fix "$FILE_PATH" 2>/dev/null || true
            fi
            ;;

        go)
            echo "Formatting Go file..."
            if command -v gofmt &> /dev/null; then
                gofmt -w "$FILE_PATH" 2>/dev/null && echo "[OK] gofmt applied" || echo "[WARN] gofmt failed"
            fi
            if command -v goimports &> /dev/null; then
                goimports -w "$FILE_PATH" 2>/dev/null || true
            fi
            ;;

        rs)
            echo "Formatting Rust file..."
            if command -v rustfmt &> /dev/null; then
                rustfmt "$FILE_PATH" 2>/dev/null && echo "[OK] rustfmt applied" || echo "[WARN] rustfmt failed"
            fi
            ;;

        md|markdown)
            echo "Checking Markdown file..."
            if command -v markdownlint &> /dev/null; then
                markdownlint --fix "$FILE_PATH" 2>/dev/null || echo "[INFO] markdownlint completed"
            fi
            ;;

        json)
            echo "Formatting JSON file..."
            if command -v jq &> /dev/null; then
                jq . "$FILE_PATH" > "${FILE_PATH}.tmp" 2>/dev/null && mv "${FILE_PATH}.tmp" "$FILE_PATH" && echo "[OK] JSON formatted" || rm -f "${FILE_PATH}.tmp"
            fi
            ;;

        yaml|yml)
            echo "Checking YAML file..."
            if command -v yamllint &> /dev/null; then
                yamllint "$FILE_PATH" 2>/dev/null || true
            fi
            ;;

        *)
            echo "[INFO] No auto-formatting configured for .$FILE_EXT files"
            ;;
    esac
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT DETECTION (Post-Edit)
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Post-Edit Drift Check ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"file-check\", \"file\": \"$FILE_PATH\", \"scope\": \"post-edit\" }"
    echo ""
    echo "Claude Code will check for:"
    echo "  - New drift introduced by edit"
    echo "  - Pattern violations"
    echo "  - Quality regressions"
else
    echo "Fallback: Running basic quality checks..."

    # File size check
    FILE_SIZE=$(wc -l < "$FILE_PATH")
    if [ "$FILE_SIZE" -gt 500 ]; then
        echo "[WARN] File is $FILE_SIZE lines (consider splitting files > 500 lines)"
    else
        echo "[OK] File size: $FILE_SIZE lines"
    fi

    # Check for common issues
    case "$FILE_EXT" in
        ts|tsx|js|jsx)
            # Check for console.log
            CONSOLE_COUNT=$(grep -c "console\.log" "$FILE_PATH" 2>/dev/null || echo "0")
            if [ "$CONSOLE_COUNT" -gt 0 ]; then
                echo "[WARN] Found $CONSOLE_COUNT console.log statements"
            fi

            # Check for 'any' type
            if [[ "$FILE_EXT" =~ ^(ts|tsx)$ ]]; then
                ANY_COUNT=$(grep -c ": any" "$FILE_PATH" 2>/dev/null || echo "0")
                if [ "$ANY_COUNT" -gt 0 ]; then
                    echo "[WARN] Found $ANY_COUNT 'any' type usages"
                fi
            fi

            # Check unused imports (basic)
            if command -v eslint &> /dev/null; then
                eslint --rule 'no-unused-vars: warn' "$FILE_PATH" 2>/dev/null || true
            fi
            ;;

        py)
            # Check for print statements
            PRINT_COUNT=$(grep -c "^[^#]*print(" "$FILE_PATH" 2>/dev/null || echo "0")
            if [ "$PRINT_COUNT" -gt 0 ]; then
                echo "[WARN] Found $PRINT_COUNT print() statements"
            fi
            ;;
    esac
fi

# -----------------------------------------------------------------------------
# MCP TOOL: TEST FILE HANDLING
# -----------------------------------------------------------------------------

if [[ "$FILE_NAME" == *".test."* ]] || [[ "$FILE_NAME" == *".spec."* ]] || [[ "$FILE_DIR" == *"/tests/"* ]] || [[ "$FILE_DIR" == *"/__tests__/"* ]]; then
    echo ""
    echo "--- MCP: Test File Processing ---"

    if [ "$MCP_AVAILABLE" = true ]; then
        echo "MCP_TOOL_REQUEST: test_baseline"
        echo "MCP_PARAMS: { \"action\": \"track-test-change\", \"file\": \"$FILE_PATH\" }"
        echo ""
        echo "Claude Code will track:"
        echo "  - Test file modifications"
        echo "  - Coverage expectations"
    else
        echo "[INFO] Test file modified: $FILE_NAME"
        echo "       Remember to run tests: npm test"
    fi
fi

# -----------------------------------------------------------------------------
# CLAUDE-FLOW MEMORY INTEGRATION
# -----------------------------------------------------------------------------

if [ -n "$MEMORY_KEY" ]; then
    echo ""
    echo "--- Memory Integration ---"

    if command -v npx &> /dev/null && npx claude-flow@alpha --version &> /dev/null 2>&1; then
        echo "Storing edit in Claude-Flow memory..."
        npx claude-flow@alpha hooks post-edit --file "$FILE_PATH" --memory-key "$MEMORY_KEY" 2>/dev/null || echo "[INFO] Memory store skipped"
    fi
fi

# -----------------------------------------------------------------------------
# GIT STAGING
# -----------------------------------------------------------------------------

echo ""
echo "--- Git Integration ---"

if git rev-parse --git-dir > /dev/null 2>&1; then
    # Check if file is tracked or should be added
    if git ls-files --error-unmatch "$FILE_PATH" &> /dev/null 2>&1; then
        echo "Staging modified file in git..."
        git add "$FILE_PATH"
        echo "[OK] File staged"
    else
        echo "[INFO] New file - will be staged when explicitly added"
    fi

    # Show diff summary
    if git diff --cached --stat "$FILE_PATH" 2>/dev/null | grep -q .; then
        echo ""
        echo "Changes staged:"
        git diff --cached --stat "$FILE_PATH" 2>/dev/null || true
    fi
fi

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Post-Edit Processing Complete"
echo "========================================================================"
echo ""
echo "File processed: $FILE_PATH"
echo "Size: $(wc -l < "$FILE_PATH") lines"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED")"
echo ""

# Log edit completion
echo "$(date +%s)|$FILE_PATH|complete" >> ".claude/sessions/.edit_log" 2>/dev/null || true

exit 0
