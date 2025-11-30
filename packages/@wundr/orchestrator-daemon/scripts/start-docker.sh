#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Orchestrator Daemon in Docker...${NC}"

# Wait for dependencies function
wait_for_service() {
    local host=$1
    local port=$2
    local service=$3
    local max_attempts=30
    local attempt=0

    echo -e "${YELLOW}Waiting for $service at $host:$port...${NC}"

    while [ $attempt -lt $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo -e "${GREEN}$service is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -e "${YELLOW}Waiting for $service... ($attempt/$max_attempts)${NC}"
        sleep 2
    done

    echo -e "${RED}Error: $service failed to become ready${NC}"
    return 1
}

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OPENAI_API_KEY environment variable is required${NC}"
    exit 1
fi

# Wait for Redis if enabled
if [ "$REDIS_ENABLED" = "true" ]; then
    REDIS_HOST="${REDIS_HOST:-redis}"
    REDIS_PORT="${REDIS_PORT:-6379}"
    wait_for_service "$REDIS_HOST" "$REDIS_PORT" "Redis" || exit 1
fi

# Wait for PostgreSQL if configured
if [ -n "$POSTGRES_HOST" ]; then
    POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    wait_for_service "$POSTGRES_HOST" "$POSTGRES_PORT" "PostgreSQL" || exit 1

    # Run migrations if migration script exists
    if [ -f "/app/scripts/migrate.sh" ]; then
        echo -e "${YELLOW}Running database migrations...${NC}"
        /app/scripts/migrate.sh || echo -e "${YELLOW}Warning: Migrations failed or not configured${NC}"
    fi
fi

# Set default environment variables
export PORT="${PORT:-3000}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export NODE_ENV="${NODE_ENV:-production}"

echo -e "${GREEN}Docker Configuration:${NC}"
echo "  Node Environment: $NODE_ENV"
echo "  Port: $PORT"
echo "  Log Level: $LOG_LEVEL"
echo "  Redis Enabled: $REDIS_ENABLED"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to package directory
cd "$PACKAGE_DIR"

# Ensure build exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Build directory not found. Building...${NC}"
    npm run build
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

# Start the daemon
echo -e "${GREEN}Starting daemon...${NC}"
node bin/orchestrator-daemon.js &
DAEMON_PID=$!

# Wait for daemon to be ready
sleep 3

# Check if process is still running
if ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo -e "${RED}Error: Daemon failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}Daemon started successfully in Docker (PID: $DAEMON_PID)${NC}"
echo -e "${GREEN}Health check endpoint: http://localhost:$PORT/health${NC}"

# Wait for process
wait "$DAEMON_PID"
