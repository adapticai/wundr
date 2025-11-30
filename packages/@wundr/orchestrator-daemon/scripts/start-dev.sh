#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Orchestrator Daemon in Development Mode...${NC}"

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18 or higher is required${NC}"
    exit 1
fi

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY environment variable is required${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to package directory
cd "$PACKAGE_DIR"

# Set development environment variables
export NODE_ENV="${NODE_ENV:-development}"
export PORT="${PORT:-3000}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"
export REDIS_ENABLED="${REDIS_ENABLED:-true}"

echo -e "${GREEN}Development Configuration:${NC}"
echo "  Node Environment: $NODE_ENV"
echo "  Port: $PORT"
echo "  Log Level: $LOG_LEVEL"
echo "  Redis Enabled: $REDIS_ENABLED"

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    echo -e "${YELLOW}ts-node not found. Installing dev dependencies...${NC}"
    npm install
fi

# Graceful shutdown handler
cleanup() {
    echo -e "\n${YELLOW}Received shutdown signal. Gracefully shutting down...${NC}"
    kill -TERM "$DAEMON_PID" 2>/dev/null || true
    wait "$DAEMON_PID" 2>/dev/null || true
    echo -e "${GREEN}Daemon stopped${NC}"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Start with ts-node for hot reload
echo -e "${GREEN}Starting daemon with ts-node (hot reload enabled)...${NC}"
echo -e "${YELLOW}Watching for file changes in src/...${NC}"

# Use ts-node to run the bin script directly
npx ts-node --transpile-only bin/orchestrator-daemon.js &
DAEMON_PID=$!

# Wait for daemon to be ready
sleep 2

# Check if process is still running
if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo -e "${RED}Error: Daemon failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}Daemon started successfully in development mode (PID: $DAEMON_PID)${NC}"
echo -e "${GREEN}Health check endpoint: http://localhost:$PORT/health${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"

# Wait for process
wait "$DAEMON_PID"
