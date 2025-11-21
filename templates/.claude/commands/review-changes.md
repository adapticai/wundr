# Review Changes Command

Review all uncommitted changes with quality checks and suggestions.

## Description

This command performs a comprehensive review of uncommitted changes, running linters, type checks, tests, and providing feedback on code quality before committing.

## Usage

```bash
/review-changes
```

## What This Command Does

1. **Show Changed Files**
   - List all modified files
   - Show additions/deletions statistics
   - Highlight new files

2. **Run Quality Checks**
   - ESLint/TSLint
   - Type checking (TypeScript)
   - Code formatting (Prettier)
   - Security scan

3. **Run Relevant Tests**
   - Identify affected test files
   - Run tests for changed code
   - Show test results

4. **Check for Issues**
   - Debug statements (console.log)
   - TODO/FIXME comments
   - Hardcoded secrets
   - Large file warnings

5. **Generate Summary**
   - Overall quality score
   - Issues found
   - Suggestions for improvement
   - Ready to commit status

## Example Output

```
🔍 Reviewing Changes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 Changed Files (5):
  M  src/services/user-service.ts (+45, -12)
  M  src/api/users.ts (+23, -5)
  A  src/types/user.ts (+30, -0)
  M  tests/user-service.test.ts (+60, -10)
  M  README.md (+15, -3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Quality Checks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ ESLint: No issues
✓ TypeScript: No type errors
✓ Prettier: All files formatted
✓ Tests: 15/15 passed

⚠️  Warnings:
  - Found 2 TODO comments in src/services/user-service.ts
  - Large file: src/types/user.ts (450 lines)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quality Score: 95/100

✅ Ready to commit!

Suggested commit message:
  feat(users): add user profile management

  - Implement user profile update API
  - Add user type definitions
  - Update user service with validation
  - Add comprehensive test coverage

Next steps:
  1. Review warnings above
  2. Run: git add .
  3. Run: git commit -m "your message"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Implementation

```bash
#!/bin/bash
# .claude/scripts/review-changes.sh

set -e

echo "🔍 Reviewing Changes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if there are changes
if [[ -z $(git status --porcelain) ]]; then
    echo "No changes to review"
    exit 0
fi

# Show changed files
echo ""
echo "📁 Changed Files:"
git status --short
echo ""
git diff --stat
echo ""

# Run linter
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Quality Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LINT_PASS=true
TYPE_PASS=true
FORMAT_PASS=true
TEST_PASS=true

# ESLint
if command -v eslint &> /dev/null; then
    echo -n "ESLint: "
    if npm run lint --silent; then
        echo "✓ No issues"
    else
        echo "✗ Issues found"
        LINT_PASS=false
    fi
fi

# TypeScript
if [ -f "tsconfig.json" ]; then
    echo -n "TypeScript: "
    if npx tsc --noEmit; then
        echo "✓ No type errors"
    else
        echo "✗ Type errors found"
        TYPE_PASS=false
    fi
fi

# Prettier
if command -v prettier &> /dev/null; then
    echo -n "Prettier: "
    if prettier --check .; then
        echo "✓ All files formatted"
    else
        echo "⚠️  Some files need formatting"
        FORMAT_PASS=false
    fi
fi

# Run tests
if grep -q "\"test\"" package.json; then
    echo -n "Tests: "
    if npm test; then
        echo "✓ All tests passed"
    else
        echo "✗ Some tests failed"
        TEST_PASS=false
    fi
fi

# Check for issues
echo ""
echo "⚠️  Warnings:"

# Console statements
CONSOLE_COUNT=$(git diff --cached | grep -c "console\." || true)
if [ "$CONSOLE_COUNT" -gt 0 ]; then
    echo "  - Found $CONSOLE_COUNT console statements"
fi

# TODO comments
TODO_COUNT=$(git diff --cached | grep -c "TODO\|FIXME" || true)
if [ "$TODO_COUNT" -gt 0 ]; then
    echo "  - Found $TODO_COUNT TODO/FIXME comments"
fi

# Large files
git diff --cached --name-only | while read file; do
    if [ -f "$file" ]; then
        LINES=$(wc -l < "$file")
        if [ "$LINES" -gt 500 ]; then
            echo "  - Large file: $file ($LINES lines)"
        fi
    fi
done

# Generate summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SCORE=100
[ "$LINT_PASS" = false ] && SCORE=$((SCORE - 20))
[ "$TYPE_PASS" = false ] && SCORE=$((SCORE - 20))
[ "$FORMAT_PASS" = false ] && SCORE=$((SCORE - 10))
[ "$TEST_PASS" = false ] && SCORE=$((SCORE - 30))

echo "Quality Score: $SCORE/100"
echo ""

if [ "$SCORE" -ge 80 ]; then
    echo "✅ Ready to commit!"
else
    echo "⚠️  Fix issues before committing"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Configuration

Make the script executable:
```bash
chmod +x .claude/scripts/review-changes.sh
```

Add to package.json:
```json
{
  "scripts": {
    "review": ".claude/scripts/review-changes.sh"
  }
}
```

## Options

- `--fix`: Automatically fix linting and formatting issues
- `--skip-tests`: Skip running tests
- `--strict`: Fail on warnings

## Related Commands

- `/commit` - Review and commit changes
- `/fix-lint` - Auto-fix linting issues
- `/format` - Format all files
