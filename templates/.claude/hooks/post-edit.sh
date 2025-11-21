#!/bin/bash
#
# Post-Edit Hook
# Runs after file editing operations
#
# This hook automatically formats, validates, and processes
# files after they've been edited.
#

set -e  # Exit on error

# Get file path from argument
FILE_PATH="${1:-}"
MEMORY_KEY="${2:-}"

if [ -z "$FILE_PATH" ]; then
    echo "⚠️  No file path provided"
    exit 0
fi

echo "✏️  Post-Edit Hook: Processing $FILE_PATH"

# ============================================================================
# CUSTOMIZE: Add your post-edit actions here
# ============================================================================

# Get file extension
FILE_EXT="${FILE_PATH##*.}"

# Auto-format based on file type
case "$FILE_EXT" in
    ts|tsx|js|jsx)
        echo "✨ Formatting TypeScript/JavaScript file..."
        if command -v prettier &> /dev/null; then
            prettier --write "$FILE_PATH" 2>/dev/null || echo "⚠️  Prettier formatting failed"
        fi

        if command -v eslint &> /dev/null; then
            echo "🔍 Running ESLint..."
            eslint --fix "$FILE_PATH" 2>/dev/null || echo "⚠️  ESLint check failed"
        fi
        ;;

    py)
        echo "✨ Formatting Python file..."
        if command -v black &> /dev/null; then
            black "$FILE_PATH" 2>/dev/null || echo "⚠️  Black formatting failed"
        fi

        if command -v isort &> /dev/null; then
            isort "$FILE_PATH" 2>/dev/null || echo "⚠️  isort failed"
        fi
        ;;

    go)
        echo "✨ Formatting Go file..."
        if command -v gofmt &> /dev/null; then
            gofmt -w "$FILE_PATH" 2>/dev/null || echo "⚠️  gofmt failed"
        fi
        ;;

    rs)
        echo "✨ Formatting Rust file..."
        if command -v rustfmt &> /dev/null; then
            rustfmt "$FILE_PATH" 2>/dev/null || echo "⚠️  rustfmt failed"
        fi
        ;;

    md|markdown)
        echo "📝 Checking Markdown file..."
        if command -v markdownlint &> /dev/null; then
            markdownlint --fix "$FILE_PATH" 2>/dev/null || echo "⚠️  markdownlint failed"
        fi
        ;;

    json)
        echo "✨ Formatting JSON file..."
        if command -v jq &> /dev/null; then
            jq . "$FILE_PATH" > "${FILE_PATH}.tmp" && mv "${FILE_PATH}.tmp" "$FILE_PATH" || echo "⚠️  JSON formatting failed"
        fi
        ;;

    yaml|yml)
        echo "✨ Formatting YAML file..."
        # Add YAML formatting if needed
        ;;

    *)
        echo "ℹ️  No auto-formatting configured for .$FILE_EXT files"
        ;;
esac

# Check file size
FILE_SIZE=$(wc -l < "$FILE_PATH")
if [ "$FILE_SIZE" -gt 500 ]; then
    echo "⚠️  File is $FILE_SIZE lines (consider splitting files > 500 lines)"
fi

# Update imports/exports (TypeScript/JavaScript)
if [[ "$FILE_EXT" =~ ^(ts|tsx|js|jsx)$ ]]; then
    # Check for unused imports (requires eslint)
    if command -v eslint &> /dev/null; then
        eslint --rule 'no-unused-vars: error' "$FILE_PATH" 2>/dev/null || true
    fi
fi

# Store in memory (if using claude-flow)
# Uncomment if you're using memory management
# if command -v claude-flow &> /dev/null && [ -n "$MEMORY_KEY" ]; then
#     echo "💾 Storing edit in memory..."
#     npx claude-flow@alpha hooks post-edit --file "$FILE_PATH" --memory-key "$MEMORY_KEY" || true
# fi

# Git add if in git repo
if git rev-parse --git-dir > /dev/null 2>&1; then
    if git ls-files --error-unmatch "$FILE_PATH" &> /dev/null; then
        echo "➕ Staging file in git..."
        git add "$FILE_PATH"
    fi
fi

echo "✅ Post-edit processing complete"

# Exit with success
exit 0
