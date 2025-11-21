#!/usr/bin/env bash
#
# publish.sh - Publish script for @wundr.io/mcp-server
#
# Usage: ./scripts/publish.sh [options]
#   --dry-run       Perform a dry run without publishing
#   --tag <tag>     Publish with a specific tag (default: latest)
#   --bump <type>   Bump version before publishing (patch|minor|major)
#   --skip-tests    Skip running tests before publishing
#   --skip-build    Skip building before publishing
#   --otp <code>    Provide OTP code for npm publish
#   --help          Show this help message

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
DRY_RUN=false
TAG="latest"
BUMP=""
SKIP_TESTS=false
SKIP_BUILD=false
OTP=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --tag)
            TAG="$2"
            shift 2
            ;;
        --bump)
            BUMP="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --otp)
            OTP="$2"
            shift 2
            ;;
        --help)
            head -n 14 "$0" | tail -n 12
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
echo -e "${BLUE}  Publishing @wundr.io/mcp-server${NC}"
echo -e "${BLUE}========================================${NC}"

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    if [ "$DRY_RUN" = false ]; then
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Aborted.${NC}"
            exit 1
        fi
    fi
fi

# Bump version if requested
if [ -n "$BUMP" ]; then
    echo -e "${YELLOW}Bumping version ($BUMP)...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN] Would run: npm version $BUMP${NC}"
    else
        npm version "$BUMP" --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo -e "${GREEN}Version bumped to: ${NEW_VERSION}${NC}"
    fi
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
    echo -e "${YELLOW}Running tests...${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN] Would run tests${NC}"
    else
        ./scripts/test.sh --ci
        echo -e "${GREEN}Tests passed.${NC}"
    fi
else
    echo -e "${YELLOW}Skipping tests (--skip-tests)${NC}"
fi

# Build
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}Building...${NC}"
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN] Would run build${NC}"
    else
        ./scripts/build.sh --clean --prod
        echo -e "${GREEN}Build complete.${NC}"
    fi
else
    echo -e "${YELLOW}Skipping build (--skip-build)${NC}"
fi

# Verify dist directory exists
if [ ! -d "dist" ] && [ "$DRY_RUN" = false ]; then
    echo -e "${RED}Error: dist directory not found. Run build first.${NC}"
    exit 1
fi

# Prepare publish command
PUBLISH_CMD="npm publish --tag $TAG --access public"

if [ -n "$OTP" ]; then
    PUBLISH_CMD="$PUBLISH_CMD --otp $OTP"
fi

# Publish
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Performing dry run...${NC}"
    npm publish --dry-run --tag "$TAG" --access public
    echo -e "${GREEN}Dry run complete. No changes made.${NC}"
else
    echo -e "${YELLOW}Publishing to npm...${NC}"
    eval "$PUBLISH_CMD"

    FINAL_VERSION=$(node -p "require('./package.json').version")
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Published @wundr.io/mcp-server@${FINAL_VERSION}${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo ""
    echo -e "${BLUE}Installation command:${NC}"
    echo "  npm install -g @wundr.io/mcp-server"
    echo ""
    echo -e "${BLUE}Claude Code integration:${NC}"
    echo "  claude mcp add wundr npx @wundr.io/mcp-server"
fi
