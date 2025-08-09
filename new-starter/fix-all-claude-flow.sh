#!/bin/bash

echo "=== Comprehensive claude-flow fix ==="
echo ""

# 1. Fix npm/nvm conflict
echo "1. Fixing npm/nvm configuration conflict..."
# Remove the prefix setting that conflicts with nvm
npm config delete prefix 2>/dev/null
npm config delete globalconfig 2>/dev/null

# Use nvm properly
echo "Setting up Node v22 with nvm..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use --delete-prefix v22.18.0
node --version

# 2. Complete database cleanup
echo ""
echo "2. Complete database and cache cleanup..."

# Find ALL possible claude-flow database locations
POSSIBLE_DIRS=(
    "$HOME/.claude-flow"
    "$HOME/.config/claude-flow"
    "$HOME/.local/share/claude-flow"
    "$HOME/.cache/claude-flow"
    "$HOME/Library/Application Support/claude-flow"
    "/tmp"
)

for dir in "${POSSIBLE_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        echo "Cleaning: $dir"
        # Remove all database files
        find "$dir" -name "*.db" -delete 2>/dev/null
        find "$dir" -name "*.db-shm" -delete 2>/dev/null
        find "$dir" -name "*.db-wal" -delete 2>/dev/null
        find "$dir" -name "*.sqlite" -delete 2>/dev/null
        find "$dir" -name "*.sqlite3" -delete 2>/dev/null
    fi
done

# Remove the entire claude-flow directory to start fresh
echo "Removing claude-flow directories entirely..."
rm -rf "$HOME/.claude-flow"
rm -rf "$HOME/.config/claude-flow"
rm -rf "$HOME/.local/share/claude-flow"

# 3. Clear ALL npm/npx caches
echo ""
echo "3. Clearing all npm/npx caches..."
rm -rf ~/.npm/_npx
rm -rf ~/.npm/_cacache
npm cache clean --force

# 4. Reinstall claude-flow globally
echo ""
echo "4. Reinstalling claude-flow globally..."
npm uninstall -g claude-flow 2>/dev/null
npm install -g claude-flow

# 5. Create claude-flow directory with proper permissions
echo ""
echo "5. Creating claude-flow directory with proper permissions..."
mkdir -p "$HOME/.claude-flow"
chmod 755 "$HOME/.claude-flow"

# 6. Test the installation
echo ""
echo "6. Testing claude-flow installation..."
which claude-flow
claude-flow --version 2>/dev/null || echo "Version check failed"

echo ""
echo "=== Fix completed! ==="
echo ""
echo "Now try running (as a single line):"
echo 'claude-flow hive-mind spawn "your task" --claude --auto-spawn'
echo ""
echo "Or if you still want to use npx:"
echo 'npx claude-flow hive-mind spawn "your task" --claude --auto-spawn'
echo ""