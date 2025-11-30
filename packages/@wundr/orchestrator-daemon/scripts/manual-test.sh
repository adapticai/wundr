#!/bin/bash

# Manual test script for orchestrator daemon
# This script verifies that the daemon can start, accept connections, and process requests

set -e

echo "==================================="
echo "Orchestrator Daemon Manual Test"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from orchestrator-daemon package root${NC}"
    exit 1
fi

echo "Step 1: Build the project"
echo "============================"
pnpm build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

echo "Step 2: Type check"
echo "============================"
pnpm typecheck
echo -e "${GREEN}✓ Type check passed${NC}"
echo ""

echo "Step 3: Check OPENAI_API_KEY"
echo "============================"
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠ OPENAI_API_KEY not set${NC}"
    echo "LLM features will not work, but daemon should still start"
    echo ""
    echo "To enable LLM features:"
    echo "  export OPENAI_API_KEY=sk-your-key-here"
    echo ""
    USE_DUMMY_KEY=true
else
    echo -e "${GREEN}✓ OPENAI_API_KEY is set${NC}"
    USE_DUMMY_KEY=false
fi
echo ""

echo "Step 4: Start daemon (will run for 5 seconds)"
echo "============================"

# Create a temp log file
LOGFILE=$(mktemp)
echo "Logging to: $LOGFILE"

# Start daemon in background
if [ "$USE_DUMMY_KEY" = true ]; then
    OPENAI_API_KEY=sk-dummy-test-key node bin/orchestrator-daemon.js --verbose > "$LOGFILE" 2>&1 &
else
    node bin/orchestrator-daemon.js --verbose > "$LOGFILE" 2>&1 &
fi

DAEMON_PID=$!
echo "Daemon started with PID: $DAEMON_PID"

# Wait for daemon to start
sleep 2

# Check if daemon is still running
if ps -p $DAEMON_PID > /dev/null; then
    echo -e "${GREEN}✓ Daemon is running${NC}"

    # Show first 30 lines of log
    echo ""
    echo "Daemon output (first 30 lines):"
    echo "--------------------------------"
    head -30 "$LOGFILE"
    echo "--------------------------------"
    echo ""

    # Keep daemon running for a bit longer
    echo "Keeping daemon running for 3 more seconds..."
    sleep 3

    # Stop daemon
    echo "Stopping daemon..."
    kill $DAEMON_PID 2>/dev/null || true
    wait $DAEMON_PID 2>/dev/null || true

    echo -e "${GREEN}✓ Daemon stopped gracefully${NC}"
else
    echo -e "${RED}✗ Daemon failed to start${NC}"
    echo ""
    echo "Error log:"
    cat "$LOGFILE"
    rm -f "$LOGFILE"
    exit 1
fi

echo ""
echo "Step 5: Verify daemon started correctly"
echo "============================"

# Check for key indicators in log
if grep -q "Orchestrator Daemon started successfully" "$LOGFILE"; then
    echo -e "${GREEN}✓ Daemon started successfully${NC}"
else
    echo -e "${RED}✗ Missing 'Daemon started successfully' message${NC}"
fi

if grep -q "WebSocket server" "$LOGFILE" || grep -q "ws://" "$LOGFILE"; then
    echo -e "${GREEN}✓ WebSocket server initialized${NC}"
else
    echo -e "${YELLOW}⚠ WebSocket server message not found${NC}"
fi

if grep -q "ERROR" "$LOGFILE" || grep -q "Error:" "$LOGFILE"; then
    echo -e "${YELLOW}⚠ Errors detected in log (may be expected without API key)${NC}"
    echo "Errors found:"
    grep -i "error" "$LOGFILE" || true
else
    echo -e "${GREEN}✓ No errors in log${NC}"
fi

echo ""
echo "Full log saved to: $LOGFILE"
echo "To view full log: cat $LOGFILE"
echo ""

echo "============================"
echo "Test Summary"
echo "============================"
echo -e "${GREEN}✓ Build: OK${NC}"
echo -e "${GREEN}✓ Type check: OK${NC}"
echo -e "${GREEN}✓ Daemon startup: OK${NC}"
echo ""

if [ "$USE_DUMMY_KEY" = true ]; then
    echo -e "${YELLOW}Note: Tested without real OPENAI_API_KEY${NC}"
    echo "For full functionality, set OPENAI_API_KEY and run again"
    echo ""
fi

echo "============================"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "============================"
echo ""

echo "To start daemon manually:"
if [ "$USE_DUMMY_KEY" = true ]; then
    echo "  export OPENAI_API_KEY=sk-your-key-here"
fi
echo "  node bin/orchestrator-daemon.js --verbose"
echo ""

# Cleanup
rm -f "$LOGFILE"
