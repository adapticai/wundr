#!/usr/bin/env bash
#
# test.sh - Test script for @wundr.io/mcp-server
#
# Usage: ./scripts/test.sh [options]
#   --unit          Run unit tests only
#   --integration   Run integration tests only
#   --coverage      Generate coverage report
#   --watch         Run tests in watch mode
#   --verbose       Verbose output
#   --ci            CI mode (no colors, coverage)
#   --help          Show this help message

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Defaults
TEST_TYPE="all"
COVERAGE=false
WATCH=false
VERBOSE=false
CI_MODE=false
JEST_ARGS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            TEST_TYPE="unit"
            shift
            ;;
        --integration)
            TEST_TYPE="integration"
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --ci)
            CI_MODE=true
            COVERAGE=true
            shift
            ;;
        --help)
            head -n 14 "$0" | tail -n 12
            exit 0
            ;;
        *)
            # Pass unknown args to Jest
            JEST_ARGS="$JEST_ARGS $1"
            shift
            ;;
    esac
done

# Change to project directory
cd "$PROJECT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing @wundr.io/mcp-server${NC}"
echo -e "${BLUE}========================================${NC}"

# Build Jest command
JEST_CMD="npx jest"

# Add test path pattern
case $TEST_TYPE in
    unit)
        echo -e "${YELLOW}Running unit tests...${NC}"
        JEST_CMD="$JEST_CMD --testPathPattern='tests/unit'"
        ;;
    integration)
        echo -e "${YELLOW}Running integration tests...${NC}"
        JEST_CMD="$JEST_CMD --testPathPattern='tests/integration'"
        ;;
    all)
        echo -e "${YELLOW}Running all tests...${NC}"
        ;;
esac

# Add coverage flag
if [ "$COVERAGE" = true ]; then
    JEST_CMD="$JEST_CMD --coverage"
    echo -e "${BLUE}Coverage reporting enabled${NC}"
fi

# Add watch flag
if [ "$WATCH" = true ]; then
    JEST_CMD="$JEST_CMD --watch"
    echo -e "${BLUE}Watch mode enabled${NC}"
fi

# Add verbose flag
if [ "$VERBOSE" = true ]; then
    JEST_CMD="$JEST_CMD --verbose"
fi

# CI mode settings
if [ "$CI_MODE" = true ]; then
    JEST_CMD="$JEST_CMD --ci --runInBand --forceExit"
    echo -e "${BLUE}CI mode enabled${NC}"
fi

# Add any extra args
JEST_CMD="$JEST_CMD $JEST_ARGS"

echo -e "${YELLOW}Command: ${JEST_CMD}${NC}"
echo ""

# Run tests
eval "$JEST_CMD"
TEST_EXIT_CODE=$?

# Report results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All Tests Passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Tests Failed (exit code: ${TEST_EXIT_CODE})${NC}"
    echo -e "${RED}========================================${NC}"
fi

# Show coverage summary if generated
if [ "$COVERAGE" = true ] && [ -f "coverage/coverage-summary.json" ]; then
    echo ""
    echo -e "${BLUE}Coverage Summary:${NC}"
    cat coverage/coverage-summary.json | head -20
fi

exit $TEST_EXIT_CODE
