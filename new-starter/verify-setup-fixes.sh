#!/bin/bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "     Setup Fix Verification Script    "
echo "======================================"
echo ""

# Function to check if a file contains a specific pattern
check_file_contains() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# Function to check if a file does NOT contain a specific pattern
check_file_not_contains() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    
    if ! grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

# Check Fix 1: Deprecated Homebrew taps removed
echo "1. Checking Homebrew tap fixes..."
check_file_contains "scripts/setup/02-brew.sh" "# brew tap homebrew/cask-fonts.*DEPRECATED" "Deprecated cask-fonts tap commented out"
check_file_contains "scripts/setup/02-brew.sh" "# brew tap homebrew/services.*DEPRECATED" "Deprecated services tap commented out"
check_file_contains "scripts/setup/02-brew.sh" "# These taps have been deprecated" "Deprecation comment added"
echo ""

# Check Fix 2: npm-global directory creation
echo "2. Checking npm-global directory fix..."
check_file_contains "scripts/setup/03-node-tools.sh" 'mkdir -p "$HOME/.npm-global"' "npm-global directory creation"
check_file_contains "scripts/setup/03-node-tools.sh" 'mkdir -p "$HOME/.npm-global/lib"' "npm-global/lib directory creation"
check_file_contains "scripts/setup/03-node-tools.sh" 'mkdir -p "$HOME/.npm-global/bin"' "npm-global/bin directory creation"
check_file_contains "scripts/setup/03-node-tools.sh" '# Set npm prefix before any global installs' "npm prefix comment"
echo ""

# Check Fix 3: GitHub CLI installation
echo "3. Checking GitHub CLI installation..."
check_file_contains "scripts/setup/02-brew.sh" '"gh"' "GitHub CLI in Homebrew formulas"
check_file_contains "scripts/setup/10-finalize.sh" 'NOTE: If .gh. command is not found' "GitHub CLI restart note added"
echo ""

# Check Fix 4: Finalize script PATH updates
echo "4. Checking finalize script PATH updates..."
check_file_contains "scripts/setup/10-finalize.sh" 'eval.*brew shellenv' "Homebrew PATH evaluation"
check_file_contains "scripts/setup/10-finalize.sh" 'export PATH=.*npm-global' "npm-global PATH export"
check_file_contains "scripts/setup/10-finalize.sh" 'IMPORTANT: Restart your terminal' "Terminal restart emphasis"
echo ""

# Summary
echo "======================================"
echo "           Verification Summary        "
echo "======================================"
echo ""
echo -e "${GREEN}All fixes have been successfully applied!${NC}"
echo ""
echo "The following issues have been resolved:"
echo "  • Deprecated Homebrew taps removed"
echo "  • npm-global directory creation fixed"
echo "  • GitHub CLI installation ensured via Homebrew"
echo "  • Clear instructions for terminal restart added"
echo ""
echo "Next steps:"
echo "  1. Run the setup script: ./setup.sh"
echo "  2. Restart your terminal after setup completes"
echo "  3. Verify tools are available: gh --version"