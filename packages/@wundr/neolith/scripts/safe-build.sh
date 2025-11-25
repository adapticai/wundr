#!/bin/bash
# Safe build wrapper for Neolith monorepo
# Handles lock file cleanup and ensures clean build state
# Serializes Next.js builds to prevent race conditions

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Neolith Safe Build Wrapper${NC}"

# Navigate to the Neolith package root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NEOLITH_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$NEOLITH_ROOT"

# Clean up any stale lock files before build
echo -e "${YELLOW}  Cleaning stale lock files...${NC}"
find . -name ".next" -type d -exec rm -f {}/.lock \; 2>/dev/null || true

# Kill any orphaned Next.js processes for this workspace
ORPHANED=$(pgrep -f "next.*neolith" || true)
if [ ! -z "$ORPHANED" ]; then
  echo -e "${YELLOW}  Terminating orphaned processes: $ORPHANED${NC}"
  echo "$ORPHANED" | xargs kill -TERM 2>/dev/null || true
  sleep 2
fi

# Find all packages that need building
PACKAGES=$(find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" | sort)

echo -e "${BLUE}  Found packages to build:${NC}"
echo "$PACKAGES" | while read -r pkg; do
  PKG_NAME=$(node -p "require('$pkg').name || 'unknown'" 2>/dev/null || echo "unknown")
  echo -e "${BLUE}    - $PKG_NAME${NC}"
done

# Build packages one at a time to avoid race conditions
BUILD_FAILED=0
for pkg in $PACKAGES; do
  PKG_DIR=$(dirname "$pkg")
  PKG_NAME=$(node -p "require('$pkg').name || 'unknown'" 2>/dev/null || echo "unknown")

  # Skip root package and packages without build scripts
  if [ "$PKG_DIR" = "." ]; then
    continue
  fi

  HAS_BUILD=$(node -p "!!require('$pkg').scripts?.build" 2>/dev/null || echo "false")
  if [ "$HAS_BUILD" = "false" ]; then
    echo -e "${BLUE}  Skipping $PKG_NAME (no build script)${NC}"
    continue
  fi

  echo -e "${YELLOW}  Building $PKG_NAME...${NC}"

  # Run prebuild hook if it exists
  HAS_PREBUILD=$(node -p "!!require('$pkg').scripts?.prebuild" 2>/dev/null || echo "false")
  if [ "$HAS_PREBUILD" = "true" ]; then
    cd "$PKG_DIR"
    pnpm run prebuild || true
    cd "$NEOLITH_ROOT"
  fi

  # Build the package
  cd "$PKG_DIR"
  if pnpm run build; then
    echo -e "${GREEN}  ✓ $PKG_NAME built successfully${NC}"
  else
    echo -e "${RED}  ✗ $PKG_NAME build failed${NC}"
    BUILD_FAILED=1
  fi
  cd "$NEOLITH_ROOT"

  # Clean up lock files after each build
  find "$PKG_DIR" -name ".next" -type d -exec rm -f {}/.lock \; 2>/dev/null || true
done

if [ $BUILD_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Neolith build complete - all packages built successfully${NC}"
  exit 0
else
  echo -e "${RED}❌ Neolith build failed - some packages had errors${NC}"
  exit 1
fi
