#!/bin/bash

# Script to fix Node.js module version mismatches
# This resolves issues like NODE_MODULE_VERSION mismatches

set -euo pipefail

echo "===================================================="
echo "Node.js Module Version Fix Script"
echo "===================================================="
echo ""

# Function to display current environment
show_environment() {
    echo "Current Environment:"
    echo "-------------------"
    echo "Node version: $(node --version 2>/dev/null || echo 'Not installed')"
    echo "npm version: $(npm --version 2>/dev/null || echo 'Not installed')"
    echo "NVM version: $(nvm --version 2>/dev/null || echo 'Not installed')"
    echo ""
}

# Function to clean npm/npx caches
clean_caches() {
    echo "Step 1: Cleaning all npm/npx caches..."
    echo "---------------------------------------"
    
    # Clear npm cache
    echo "• Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true
    
    # Clear npx cache
    echo "• Clearing npx cache..."
    rm -rf ~/.npm/_npx 2>/dev/null || true
    rm -rf ~/.npm/_cacache 2>/dev/null || true
    
    # Clear node_modules in current project
    if [ -d "node_modules" ]; then
        echo "• Removing local node_modules..."
        rm -rf node_modules
    fi
    
    # Clear package-lock.json to force fresh resolution
    if [ -f "package-lock.json" ]; then
        echo "• Removing package-lock.json for fresh install..."
        rm -f package-lock.json
    fi
    
    echo "✓ Caches cleared successfully"
    echo ""
}

# Function to clean global npm packages that might have native dependencies
clean_global_packages() {
    echo "Step 2: Cleaning problematic global packages..."
    echo "------------------------------------------------"
    
    # List of packages known to have native dependencies
    local packages=(
        "claude-flow"
        "better-sqlite3"
        "node-gyp"
    )
    
    for package in "${packages[@]}"; do
        if npm list -g "$package" &>/dev/null; then
            echo "• Uninstalling global $package..."
            npm uninstall -g "$package" 2>/dev/null || true
        fi
    done
    
    echo "✓ Global packages cleaned"
    echo ""
}

# Function to ensure correct Node.js version
setup_node_version() {
    echo "Step 3: Setting up correct Node.js version..."
    echo "----------------------------------------------"
    
    # Check if nvm is available
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        echo "• Loading NVM..."
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Use Node.js v20 (LTS) for best compatibility
        echo "• Installing/using Node.js v20 (LTS)..."
        nvm install 20
        nvm use 20
        nvm alias default 20
        
        echo "• Current Node.js version: $(node --version)"
    else
        echo "⚠ NVM not found. Using system Node.js: $(node --version)"
    fi
    
    echo "✓ Node.js version configured"
    echo ""
}

# Function to reinstall global packages without version locks
reinstall_global_packages() {
    echo "Step 4: Reinstalling global packages (latest versions)..."
    echo "----------------------------------------------------------"
    
    # Update npm to latest
    echo "• Updating npm to latest..."
    npm install -g npm
    
    # Reinstall Claude packages without version specifications
    echo "• Installing claude-flow (latest)..."
    npm install -g claude-flow || echo "  ⚠ Failed to install claude-flow"
    
    echo "✓ Global packages reinstalled"
    echo ""
}

# Function to reinstall local dependencies
reinstall_local_dependencies() {
    echo "Step 5: Reinstalling local project dependencies..."
    echo "---------------------------------------------------"
    
    if [ -f "package.json" ]; then
        echo "• Installing fresh dependencies..."
        npm install
        
        # Rebuild native modules explicitly
        echo "• Rebuilding native modules..."
        npm rebuild
        
        echo "✓ Local dependencies reinstalled"
    else
        echo "⚠ No package.json found in current directory"
    fi
    
    echo ""
}

# Function to verify the fix
verify_fix() {
    echo "Step 6: Verifying the fix..."
    echo "-----------------------------"
    
    # Test claude-flow
    if command -v claude-flow &>/dev/null; then
        echo "• Testing claude-flow..."
        claude-flow --version 2>/dev/null && echo "  ✓ claude-flow is working" || echo "  ✗ claude-flow still has issues"
    fi
    
    # Test npx claude-flow
    echo "• Testing npx claude-flow..."
    npx claude-flow --version 2>/dev/null && echo "  ✓ npx claude-flow is working" || echo "  ✗ npx claude-flow still has issues"
    
    echo ""
}

# Main execution
main() {
    echo "This script will fix Node.js module version mismatches"
    echo "by cleaning caches and rebuilding native modules."
    echo ""
    
    show_environment
    
    read -p "Continue with the fix? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    echo ""
    
    clean_caches
    clean_global_packages
    setup_node_version
    reinstall_global_packages
    reinstall_local_dependencies
    verify_fix
    
    echo "===================================================="
    echo "Fix Complete!"
    echo "===================================================="
    echo ""
    echo "If you're still experiencing issues:"
    echo "1. Try restarting your terminal"
    echo "2. Run: source ~/.zshrc (or ~/.bashrc)"
    echo "3. Ensure you're using the correct Node.js version: nvm use 20"
    echo ""
    echo "For claude-flow usage:"
    echo "• Global: claude-flow <command>"
    echo "• Via npx: npx claude-flow <command>"
    echo ""
}

# Run main function
main