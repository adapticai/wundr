#!/bin/bash
# Pre-build cleanup script to prevent Next.js lock file race conditions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Running pre-build cleanup...${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEB_DIR="$(dirname "$SCRIPT_DIR")"

# Remove Next.js lock file if it exists
if [ -f "$WEB_DIR/.next/lock" ]; then
  echo -e "${YELLOW}  Removing stale Next.js lock file...${NC}"
  rm -f "$WEB_DIR/.next/lock"
fi

# Remove Next.js cache lock files
if [ -d "$WEB_DIR/.next/cache" ]; then
  find "$WEB_DIR/.next/cache" -name "*.lock" -type f -delete 2>/dev/null || true
fi

# Check for running Next.js processes on this project
NEXT_PIDS=$(pgrep -f "next.*$(basename $WEB_DIR)" || true)
if [ ! -z "$NEXT_PIDS" ]; then
  echo -e "${YELLOW}  Warning: Found running Next.js processes${NC}"
  echo -e "${YELLOW}  PIDs: $NEXT_PIDS${NC}"
  echo -e "${YELLOW}  Attempting to gracefully terminate...${NC}"
  echo "$NEXT_PIDS" | xargs kill -TERM 2>/dev/null || true
  sleep 1
fi

echo -e "${GREEN}✅ Pre-build cleanup complete${NC}"
