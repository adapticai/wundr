#!/usr/bin/env bash
#
# build.sh - Build script for @wundr.io/mcp-server
#
# Usage: ./scripts/build.sh [options]
#   --clean     Clean dist directory before building
#   --watch     Build in watch mode
#   --prod      Production build (minified, no sourcemaps)
#   --check     Run type checking only
#   --help      Show this help message

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
CLEAN=false
WATCH=false
PROD=false
CHECK_ONLY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --prod)
            PROD=true
            shift
            ;;
        --check)
            CHECK_ONLY=true
            shift
            ;;
        --help)
            head -n 11 "$0" | tail -n 9
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Change to project directory
cd "$PROJECT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Building @wundr.io/mcp-server${NC}"
echo -e "${BLUE}========================================${NC}"

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Cleaning dist directory...${NC}"
    rm -rf dist
    echo -e "${GREEN}Clean complete.${NC}"
fi

# Type check only
if [ "$CHECK_ONLY" = true ]; then
    echo -e "${YELLOW}Running type check...${NC}"
    npx tsc --noEmit
    echo -e "${GREEN}Type check passed.${NC}"
    exit 0
fi

# Build
if [ "$WATCH" = true ]; then
    echo -e "${YELLOW}Starting watch mode...${NC}"
    npx tsc --watch
else
    echo -e "${YELLOW}Compiling TypeScript...${NC}"

    if [ "$PROD" = true ]; then
        # Production build: no sourcemaps, remove comments
        npx tsc --sourceMap false --removeComments true
    else
        # Development build: with sourcemaps
        npx tsc
    fi

    echo -e "${GREEN}TypeScript compilation complete.${NC}"
fi

# Verify output
if [ -d "dist" ]; then
    FILE_COUNT=$(find dist -name "*.js" | wc -l | tr -d ' ')
    echo -e "${GREEN}Build successful: ${FILE_COUNT} JavaScript files generated.${NC}"

    # List main files
    echo -e "${BLUE}Main output files:${NC}"
    ls -la dist/*.js 2>/dev/null || echo "  (no root JS files)"

    # Check for sourcemaps
    if [ "$PROD" != true ]; then
        SOURCEMAP_COUNT=$(find dist -name "*.js.map" | wc -l | tr -d ' ')
        echo -e "${BLUE}Sourcemaps: ${SOURCEMAP_COUNT} files${NC}"
    fi

    # Check for type definitions
    DTS_COUNT=$(find dist -name "*.d.ts" | wc -l | tr -d ' ')
    echo -e "${BLUE}Type definitions: ${DTS_COUNT} files${NC}"
else
    echo -e "${RED}Build failed: dist directory not created.${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
