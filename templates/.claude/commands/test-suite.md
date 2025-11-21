# Test Suite Command

Run the complete test suite with coverage reporting and quality checks.

## Description

This command executes all tests (unit, integration, e2e), generates coverage reports, and performs quality validation to ensure code meets project standards before deployment.

## Usage

```bash
/test-suite
```

Or with options:
```bash
/test-suite --coverage --watch
```

## What This Command Does

1. **Clean Previous Artifacts**
   - Remove old test reports
   - Clear coverage data
   - Clean build artifacts

2. **Run Unit Tests**
   - Execute all unit tests
   - Generate coverage report
   - Validate coverage thresholds

3. **Run Integration Tests**
   - Start test dependencies (database, services)
   - Execute integration tests
   - Shut down test dependencies

4. **Run E2E Tests** (optional)
   - Start application in test mode
   - Execute end-to-end test scenarios
   - Generate test screenshots/videos

5. **Generate Reports**
   - Combine coverage reports
   - Generate HTML coverage report
   - Create test results summary

6. **Quality Gates**
   - Check coverage thresholds
   - Validate test success rate
   - Check for flaky tests

7. **Display Results**
   - Show test summary
   - Display coverage percentages
   - Highlight failures

## Example Output

```
🧪 Running Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cleaning previous artifacts...
✓ Removed old coverage reports
✓ Cleaned test artifacts

Running unit tests...
✓ 245 tests passed in 12.3s
✓ Coverage: 92.5%

Running integration tests...
✓ Started test database
✓ 45 tests passed in 8.7s
✓ Shut down test database

Running E2E tests...
✓ 15 scenarios passed in 45.2s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Tests: 305
Passed: 305 (100%)
Failed: 0
Skipped: 0

Coverage:
  Statements: 92.5%
  Branches: 88.3%
  Functions: 94.1%
  Lines: 92.1%

✅ All quality gates passed!

Coverage report: coverage/index.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Implementation

To implement this command, create the following script:

```bash
#!/bin/bash
# .claude/scripts/test-suite.sh

set -e

echo "🧪 Running Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean
echo "Cleaning previous artifacts..."
rm -rf coverage/ .nyc_output/ test-results/
echo "✓ Cleaned artifacts"

# Unit tests
echo ""
echo "Running unit tests..."
npm run test:unit -- --coverage
UNIT_EXIT=$?

# Integration tests (if available)
if grep -q "test:integration" package.json; then
    echo ""
    echo "Running integration tests..."
    npm run test:integration
    INTEGRATION_EXIT=$?
fi

# E2E tests (if available and requested)
if [[ "$1" == "--e2e" ]] && grep -q "test:e2e" package.json; then
    echo ""
    echo "Running E2E tests..."
    npm run test:e2e
    E2E_EXIT=$?
fi

# Generate summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check coverage
if [ -f "coverage/coverage-summary.json" ]; then
    echo "Coverage report: coverage/index.html"
fi

# Exit with error if any tests failed
if [ $UNIT_EXIT -ne 0 ] || [ ${INTEGRATION_EXIT:-0} -ne 0 ] || [ ${E2E_EXIT:-0} -ne 0 ]; then
    echo "❌ Some tests failed"
    exit 1
fi

echo "✅ All tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Configuration

Add to `package.json`:

```json
{
  "scripts": {
    "test": ".claude/scripts/test-suite.sh",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Options

- `--coverage`: Generate and open coverage report
- `--watch`: Run tests in watch mode
- `--e2e`: Include end-to-end tests
- `--verbose`: Show detailed test output
- `--bail`: Stop on first failure

## Prerequisites

- Testing framework installed (Jest, Vitest, etc.)
- Coverage tool configured
- Test scripts defined in package.json

## Related Commands

- `/test-watch` - Run tests in watch mode
- `/coverage` - View coverage report
- `/test-file <path>` - Test specific file
