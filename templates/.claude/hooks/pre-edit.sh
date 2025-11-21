#!/bin/bash
#
# Pre-Edit Hook with Wundr MCP Integration
# Runs before file editing operations
#
# This hook validates files before editing, checks for potential
# conflicts, and prepares the editing context with MCP tool integration.
#
# MCP Tools Used:
#   - drift_detection: Check file's current drift status
#   - pattern_standardize: Get applicable patterns for file type
#   - dependency_analyze: Check if file has dependency impacts
#
# Usage: ./pre-edit.sh "<file_path>" [edit_type]
#

set -e  # Exit on error

# =============================================================================
# CONFIGURATION
# =============================================================================

FILE_PATH="${1:-}"
EDIT_TYPE="${2:-modify}"  # modify, create, delete
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

# =============================================================================
# MAIN EXECUTION
# =============================================================================

echo "========================================================================"
echo "Pre-Edit Hook: Validating file edit..."
echo "========================================================================"
echo "File: $FILE_PATH"
echo "Edit Type: $EDIT_TYPE"
echo ""

# Check MCP connection (silent)
check_mcp_connection || true

# -----------------------------------------------------------------------------
# FILE VALIDATION
# -----------------------------------------------------------------------------

echo "--- File Validation ---"

# Get file extension
FILE_EXT="${FILE_PATH##*.}"
FILE_DIR=$(dirname "$FILE_PATH")
FILE_NAME=$(basename "$FILE_PATH")

echo "Extension: .$FILE_EXT"
echo "Directory: $FILE_DIR"

# Check if file exists (for modify operations)
if [ "$EDIT_TYPE" = "modify" ]; then
    if [ ! -f "$FILE_PATH" ]; then
        echo "[WARN] File does not exist: $FILE_PATH"
        echo "       Will be created as new file"
    else
        # Check file size
        FILE_LINES=$(wc -l < "$FILE_PATH" 2>/dev/null || echo "0")
        echo "Current lines: $FILE_LINES"

        if [ "$FILE_LINES" -gt 500 ]; then
            echo "[WARN] File is $FILE_LINES lines (> 500 recommended)"
            echo "       Consider splitting into smaller modules"
        fi
    fi
fi

# Check for protected files
PROTECTED_PATTERNS=(".env" "credentials" "secret" "private" ".pem" ".key")
for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if [[ "$FILE_NAME" == *"$pattern"* ]]; then
        echo "[WARN] Editing potentially sensitive file: $FILE_NAME"
        echo "       Ensure no secrets are committed"
    fi
done

# Check root folder protection
if [ "$FILE_DIR" = "." ] || [ "$FILE_DIR" = "" ]; then
    case "$FILE_EXT" in
        md|txt|log)
            echo "[WARN] Creating documentation/text file in root directory"
            echo "       Consider using docs/ or appropriate subdirectory"
            ;;
        js|ts|py|go|rs)
            echo "[ERROR] Source files should not be in root directory"
            echo "        Use src/ or appropriate subdirectory"
            ;;
    esac
fi

# -----------------------------------------------------------------------------
# GIT STATUS CHECK
# -----------------------------------------------------------------------------

echo ""
echo "--- Git Status ---"

if git rev-parse --git-dir > /dev/null 2>&1; then
    # Check if file has uncommitted changes
    if git ls-files --error-unmatch "$FILE_PATH" &> /dev/null 2>&1; then
        if git diff --name-only "$FILE_PATH" 2>/dev/null | grep -q .; then
            echo "[WARN] File has uncommitted changes"
            echo "       Consider committing or stashing before further edits"
        else
            echo "[OK] File is tracked and clean"
        fi
    else
        echo "[INFO] File is not tracked by git (new file)"
    fi

    # Check for merge conflicts
    if git ls-files -u "$FILE_PATH" 2>/dev/null | grep -q .; then
        echo "[ERROR] File has unresolved merge conflicts!"
        echo "        Resolve conflicts before editing"
    fi
else
    echo "[INFO] Not a git repository"
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DRIFT DETECTION (Pre-Edit)
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Pre-Edit Drift Check ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: drift_detection"
    echo "MCP_PARAMS: { \"action\": \"file-check\", \"file\": \"$FILE_PATH\", \"scope\": \"pre-edit\" }"
    echo ""
    echo "Claude Code will check:"
    echo "  - Current drift status for this file"
    echo "  - Known issues to address"
    echo "  - Pattern compliance"
else
    echo "Fallback: Running basic file analysis..."

    if [ -f "$FILE_PATH" ]; then
        # Count existing issues
        case "$FILE_EXT" in
            ts|tsx|js|jsx)
                TODO_COUNT=$(grep -c "TODO\|FIXME" "$FILE_PATH" 2>/dev/null || echo "0")
                ANY_COUNT=$(grep -c "any" "$FILE_PATH" 2>/dev/null || echo "0")
                echo "  TODO/FIXME comments: $TODO_COUNT"
                echo "  'any' type usage: $ANY_COUNT"
                ;;
            py)
                TODO_COUNT=$(grep -c "TODO\|FIXME" "$FILE_PATH" 2>/dev/null || echo "0")
                echo "  TODO/FIXME comments: $TODO_COUNT"
                ;;
        esac
    fi
fi

# -----------------------------------------------------------------------------
# MCP TOOL: PATTERN GUIDANCE
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Pattern Guidance ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: pattern_standardize"
    echo "MCP_PARAMS: { \"action\": \"get-patterns\", \"fileType\": \"$FILE_EXT\" }"
    echo ""
    echo "Claude Code will provide:"
    echo "  - Applicable code patterns for .$FILE_EXT files"
    echo "  - Import ordering rules"
    echo "  - Error handling patterns"
else
    echo "Pattern guidance for .$FILE_EXT files:"

    case "$FILE_EXT" in
        ts|tsx)
            echo "  - Use explicit types (avoid 'any')"
            echo "  - Follow import ordering: external, internal, relative, types"
            echo "  - Use async/await over raw promises"
            echo "  - Export types with 'export type'"
            ;;
        js|jsx)
            echo "  - Use JSDoc for type documentation"
            echo "  - Follow import ordering conventions"
            echo "  - Handle errors with try/catch"
            ;;
        py)
            echo "  - Use type hints"
            echo "  - Follow PEP 8 style guide"
            echo "  - Use docstrings for public functions"
            ;;
        *)
            echo "  - Follow project conventions"
            echo "  - Check .editorconfig if present"
            ;;
    esac
fi

# -----------------------------------------------------------------------------
# MCP TOOL: DEPENDENCY IMPACT
# -----------------------------------------------------------------------------

echo ""
echo "--- MCP: Dependency Impact ---"

if [ "$MCP_AVAILABLE" = true ]; then
    echo "MCP_TOOL_REQUEST: dependency_analyze"
    echo "MCP_PARAMS: { \"action\": \"impact-check\", \"file\": \"$FILE_PATH\" }"
    echo ""
    echo "Claude Code will check:"
    echo "  - Files that depend on this file"
    echo "  - Potential breaking changes"
else
    echo "Fallback: Basic dependency check..."

    if [ -f "$FILE_PATH" ]; then
        FILE_BASENAME=$(basename "$FILE_PATH" ".$FILE_EXT")

        # Find files that might import this file
        IMPORTERS=$(grep -rl "from.*$FILE_BASENAME\|import.*$FILE_BASENAME" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . 2>/dev/null | wc -l || echo "0")
        echo "  Files potentially importing this: $IMPORTERS"

        if [ "$IMPORTERS" -gt 0 ]; then
            echo "  [WARN] Changes may affect dependent files"
        fi
    fi
fi

# -----------------------------------------------------------------------------
# BACKUP SUGGESTION
# -----------------------------------------------------------------------------

echo ""
echo "--- Backup Recommendation ---"

if [ -f "$FILE_PATH" ] && [ "$EDIT_TYPE" = "modify" ]; then
    FILE_LINES=$(wc -l < "$FILE_PATH" 2>/dev/null || echo "0")

    if [ "$FILE_LINES" -gt 100 ]; then
        echo "[INFO] Consider creating a backup before major changes:"
        echo "       cp \"$FILE_PATH\" \"$FILE_PATH.bak\""
    fi
fi

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------

echo ""
echo "========================================================================"
echo "Pre-Edit Validation Complete"
echo "========================================================================"
echo ""
echo "File ready for editing: $FILE_PATH"
echo "MCP Integration: $([ "$MCP_AVAILABLE" = true ] && echo "ENABLED" || echo "DISABLED")"
echo ""

# Store pre-edit timestamp
mkdir -p ".claude/sessions"
echo "$(date +%s)|$FILE_PATH" >> ".claude/sessions/.edit_log"

exit 0
