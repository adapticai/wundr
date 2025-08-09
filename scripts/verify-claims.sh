#!/bin/bash

# Wundr Verification Script
# This script verifies claims about the project's functionality
# It should be run before claiming any task is complete

set -e  # Exit on error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "🔍 WUNDR VERIFICATION SCRIPT"
echo "================================================"
echo ""

FAILURES=0
WARNINGS=0
SUCCESSES=0

# Function to test a command
test_command() {
    local description=$1
    local command=$2
    local required=$3
    
    echo -n "Testing: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((SUCCESSES++))
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ FAILED${NC}"
            echo "  Command: $command"
            echo "  This is a required check - cannot claim completion!"
            ((FAILURES++))
        else
            echo -e "${YELLOW}⚠️ WARNING${NC}"
            echo "  Command: $command"
            ((WARNINGS++))
        fi
        return 1
    fi
}

# Function to check if file exists
check_file() {
    local description=$1
    local filepath=$2
    
    echo -n "Checking: $description... "
    
    if [ -f "$filepath" ]; then
        echo -e "${GREEN}✅ EXISTS${NC}"
        ((SUCCESSES++))
        return 0
    else
        echo -e "${RED}❌ MISSING${NC}"
        echo "  File: $filepath"
        ((FAILURES++))
        return 1
    fi
}

echo "1. CHECKING BUILD SYSTEM"
echo "------------------------"
test_command "Root build" "npm run build" "true"
test_command "Analysis engine build" "cd packages/@wundr/analysis-engine && npm run build" "true"
test_command "CLI build" "cd packages/@wundr/cli && npm run build" "false"
test_command "Dashboard build" "cd packages/@wundr/dashboard && npm run build" "false"
echo ""

echo "2. CHECKING TESTS"
echo "-----------------"
test_command "Root tests" "npm test" "false"
test_command "Analysis engine tests" "cd packages/@wundr/analysis-engine && npm test" "false"
echo ""

echo "3. CHECKING KEY FILES"
echo "---------------------"
check_file "FAILURES.md tracker" "docs/FAILURES.md"
check_file "Claude Flow verification hooks" ".claude-flow/verification-hooks.json"
check_file "Main package.json" "package.json"
echo ""

echo "4. CHECKING DEPENDENCIES"
echo "------------------------"
test_command "Node modules installed" "[ -d node_modules ]" "true"
test_command "Web client dependencies" "[ -d tools/web-client/node_modules ]" "false"
echo ""

echo "5. CHECKING SERVICES"
echo "--------------------"
test_command "WebSocket server" "lsof -i :8080" "false"
test_command "Dashboard server" "lsof -i :3001" "false"
echo ""

echo "================================================"
echo "VERIFICATION SUMMARY"
echo "================================================"
echo -e "Successes: ${GREEN}$SUCCESSES${NC}"
echo -e "Warnings:  ${YELLOW}$WARNINGS${NC}"
echo -e "Failures:  ${RED}$FAILURES${NC}"
echo ""

if [ $FAILURES -gt 0 ]; then
    echo -e "${RED}❌ VERIFICATION FAILED${NC}"
    echo "Cannot claim the project is working with $FAILURES failures!"
    echo "Please fix the issues and run this script again."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️ VERIFICATION PASSED WITH WARNINGS${NC}"
    echo "The core functionality works but there are $WARNINGS warnings to address."
    exit 0
else
    echo -e "${GREEN}✅ ALL VERIFICATIONS PASSED${NC}"
    echo "The project appears to be working correctly!"
    exit 0
fi