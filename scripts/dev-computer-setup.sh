#!/bin/bash

# Dev Computer Setup Runner
# Run computer setup in dry-run mode for testing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ${GREEN}🖥️  Wundr Computer Setup (Dev)${BLUE}    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# Parse command line arguments
DRY_RUN="--dry-run"
PROFILE=""
INTERACTIVE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="--profile $2"
            shift 2
            ;;
        --no-dry-run)
            DRY_RUN=""
            shift
            ;;
        --interactive)
            INTERACTIVE="--interactive"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Change to project root
cd "$PROJECT_ROOT"

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

# Use npx which will auto-install if needed
# Use the dev tsconfig for proper module resolution
TSX_CMD="npx tsx --tsconfig $PROJECT_ROOT/tsconfig.dev.json"

# Default to dry-run for safety
if [ -n "$DRY_RUN" ]; then
    echo -e "${YELLOW}⚠️  Running in DRY-RUN mode (safe)${NC}"
    echo -e "${YELLOW}   Use --no-dry-run to actually install${NC}"
    echo ""
fi

# Show available profiles if not specified
if [ -z "$PROFILE" ] && [ -z "$INTERACTIVE" ]; then
    echo -e "${GREEN}Available profiles:${NC}"
    echo "  • frontend    - React, Vue, Next.js tools"
    echo "  • backend     - Node.js, databases, API tools"
    echo "  • fullstack   - Frontend + Backend tools"
    echo "  • devops      - Docker, K8s, cloud tools"
    echo "  • ml          - Python, Jupyter, ML tools"
    echo "  • mobile      - React Native, mobile dev tools"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./scripts/dev-computer-setup.sh --profile frontend"
    echo "  ./scripts/dev-computer-setup.sh --interactive"
    echo "  ./scripts/dev-computer-setup.sh --no-dry-run --profile backend"
    echo ""
    
    # Ask if they want interactive mode
    read -p "Run interactive setup? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INTERACTIVE="--interactive"
    else
        exit 0
    fi
fi

# Run the computer setup
echo -e "${GREEN}Starting computer setup...${NC}"
echo -e "${YELLOW}Command: $TSX_CMD packages/@wundr/cli/src/index.ts computer-setup $DRY_RUN $PROFILE $INTERACTIVE${NC}"
echo ""

$TSX_CMD packages/@wundr/cli/src/index.ts computer-setup $DRY_RUN $PROFILE $INTERACTIVE