#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
HOST="${HOST:-localhost}"
PORT="${PORT:-3000}"
TIMEOUT="${TIMEOUT:-5}"
MAX_RETRIES="${MAX_RETRIES:-3}"

# Health check endpoint
HEALTH_URL="http://${HOST}:${PORT}/health"

# Function to perform health check
check_health() {
    local attempt=$1

    if [ "$attempt" -gt 1 ]; then
        echo -e "${YELLOW}Retry $attempt/$MAX_RETRIES...${NC}"
    fi

    # Perform curl request
    response=$(curl -s -f -m "$TIMEOUT" "$HEALTH_URL" 2>&1) || {
        return 1
    }

    # Check if response contains expected health data
    if echo "$response" | grep -q '"status"'; then
        echo -e "${GREEN}Health check passed${NC}"
        if [ -n "$VERBOSE" ]; then
            echo "$response"
        fi
        return 0
    else
        echo -e "${RED}Invalid health response${NC}"
        return 1
    fi
}

# Main health check loop
attempt=1
while [ $attempt -le "$MAX_RETRIES" ]; do
    if check_health "$attempt"; then
        exit 0
    fi

    if [ $attempt -lt "$MAX_RETRIES" ]; then
        sleep 2
    fi

    attempt=$((attempt + 1))
done

# All retries failed
echo -e "${RED}Health check failed after $MAX_RETRIES attempts${NC}"
echo -e "${RED}URL: $HEALTH_URL${NC}"
exit 1
