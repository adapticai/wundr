#!/bin/bash

# Dev CLI Runner for Wundr
# Run CLI commands directly from source without building

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${GREEN}🚀 Wundr Dev CLI${NC}"
echo -e "${YELLOW}Running from: $PROJECT_ROOT${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Run the CLI with all arguments passed through using npx
# npx will auto-install tsx if needed
# Use the dev tsconfig for proper module resolution
npx tsx --tsconfig "$PROJECT_ROOT/tsconfig.dev.json" packages/@wundr/cli/src/index.ts "$@"