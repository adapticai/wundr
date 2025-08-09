#!/bin/bash

echo "Fixing claude-flow database issues..."

# Find and remove claude-flow database files
echo "Looking for claude-flow database files..."

# Common locations for claude-flow data
CLAUDE_FLOW_DIRS=(
    "$HOME/.claude-flow"
    "$HOME/.config/claude-flow"
    "$HOME/.local/share/claude-flow"
    "$HOME/.cache/claude-flow"
)

for dir in "${CLAUDE_FLOW_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        echo "Found claude-flow directory: $dir"
        echo "Removing database files..."
        rm -rf "$dir"/*.db 2>/dev/null
        rm -rf "$dir"/*.db-shm 2>/dev/null
        rm -rf "$dir"/*.db-wal 2>/dev/null
        rm -rf "$dir"/db/ 2>/dev/null
        
        # Fix permissions on the directory
        chmod -R 755 "$dir" 2>/dev/null
        echo "Cleaned: $dir"
    fi
done

# Also check temp directory
echo "Checking temp directories..."
rm -rf /tmp/claude-flow*.db 2>/dev/null
rm -rf /tmp/*.db-shm 2>/dev/null
rm -rf /tmp/*.db-wal 2>/dev/null

# Clear npx cache again just to be safe
echo "Clearing npx cache..."
rm -rf ~/.npm/_npx 2>/dev/null

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force 2>/dev/null

echo ""
echo "Database cleanup completed!"
echo ""
echo "The claude-flow database will be recreated fresh on next run."
echo "Try running your command again now."
echo ""

# Check disk space
echo "Checking available disk space:"
df -h ~ | grep -E "^/|Avail"
echo ""

# Check if there are any permission issues
echo "Checking permissions on home directory:"
ls -la ~ | grep -E "^d.*\.claude|^d.*\.config|^d.*\.local"
echo ""