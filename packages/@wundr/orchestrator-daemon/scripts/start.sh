#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Orchestrator Daemon...${NC}"

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

# Check if Redis is available (optional but recommended)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}Redis is available and running${NC}"
    else
        echo -e "${YELLOW}Warning: Redis is installed but not running. Starting without Redis...${NC}"
    fi
else
    echo -e "${YELLOW}Warning: Redis is not available. Running without session persistence...${NC}"
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to package directory
cd "$PACKAGE_DIR"

# Check if build exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Build directory not found. Building...${NC}"
    npm run build
fi

# Check if bin file exists
if [ ! -f "bin/orchestrator-daemon.js" ]; then
    echo -e "${RED}Error: bin/orchestrator-daemon.js not found${NC}"
    exit 1
fi

# Set default environment variables if not set
export PORT="${PORT:-3000}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export REDIS_ENABLED="${REDIS_ENABLED:-true}"

echo -e "${GREEN}Configuration:${NC}"
echo "  Port: $PORT"
echo "  Log Level: $LOG_LEVEL"
echo "  Redis Enabled: $REDIS_ENABLED"

# Graceful shutdown handler
cleanup() {
    echo -e "\n${YELLOW}Received shutdown signal. Gracefully shutting down...${NC}"
    kill -TERM "$DAEMON_PID" 2>/dev/null || true
    wait "$DAEMON_PID" 2>/dev/null || true
    echo -e "${GREEN}Daemon stopped${NC}"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Start the daemon
echo -e "${GREEN}Starting daemon on port $PORT...${NC}"
node bin/orchestrator-daemon.js &
DAEMON_PID=$!

# Wait for daemon to be ready
sleep 2

# Check if process is still running
if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo -e "${RED}Error: Daemon failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}Daemon started successfully (PID: $DAEMON_PID)${NC}"
echo -e "${GREEN}Health check endpoint: http://localhost:$PORT/health${NC}"

# Wait for process
wait "$DAEMON_PID"
