#!/bin/bash

# QA Validation Pipeline for Wundr Project
# Comprehensive validation and quality checks

set -e

echo "🔍 WUNDR QA VALIDATION PIPELINE"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Helper functions
run_check() {
    local name="$1"
    local command="$2"
    local critical="$3"

    echo -e "${BLUE}[CHECK]${NC} $name"
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}[PASS]${NC} $name"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [ "$critical" = "true" ]; then
            echo -e "${RED}[FAIL]${NC} $name (CRITICAL)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            return 1
        else
            echo -e "${YELLOW}[WARN]${NC} $name"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            return 0
        fi
    fi
}

echo "1. Package Dependencies Validation"
echo "-----------------------------------"
run_check "PNPM Installation" "pnpm --version" true
run_check "Node.js Version >= 18" "node -e 'process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)'" true
run_check "Root Package Dependencies" "pnpm install --frozen-lockfile" true

echo ""
echo "2. Core Package Builds"
echo "----------------------"
run_check "Shared Config Build" "cd packages/shared-config && pnpm build" true
run_check "Core Package Build" "cd packages/@wundr/core && pnpm build" true
run_check "Analysis Engine Build" "cd packages/@wundr/analysis-engine && pnpm build" false

echo ""
echo "3. TypeScript Validation"
echo "------------------------"
run_check "Root TypeScript Check" "pnpm typecheck" false
run_check "Web Client TypeScript" "cd tools/web-client && pnpm typecheck" false

echo ""
echo "4. Code Quality Checks"
echo "----------------------"
run_check "ESLint Compliance" "pnpm lint --max-warnings 500" false
run_check "Circular Dependencies" "npx madge --circular --extensions ts,tsx tools/web-client/lib/" true

echo ""
echo "5. Security & Dependencies"
echo "--------------------------"
run_check "Package Audit" "pnpm audit --audit-level moderate" false
run_check "Outdated Dependencies" "pnpm outdated" false

echo ""
echo "6. Test Coverage"
echo "---------------"
run_check "Unit Tests" "pnpm test:unit" false
run_check "Integration Tests" "pnpm test:integration" false

echo ""
echo "🔐 VALIDATION SUMMARY"
echo "====================="
echo -e "Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo -e "Warnings: ${YELLOW}$WARNING_CHECKS${NC}"

if [ $FAILED_CHECKS -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo "Critical issues must be resolved before deployment."
    exit 1
else
    echo ""
    echo -e "${GREEN}✅ VALIDATION PASSED${NC}"
    if [ $WARNING_CHECKS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNING_CHECKS warnings should be addressed${NC}"
    fi
    echo "Project is ready for enterprise deployment."
    exit 0
fi