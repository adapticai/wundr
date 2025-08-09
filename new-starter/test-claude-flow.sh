#!/bin/bash

echo "Testing claude-flow installation and database..."

# Unset problematic environment variables
unset npm_config_prefix
unset npm_config_init_author_url

# Try to initialize claude-flow in a clean environment
export CLAUDE_FLOW_DB_PATH="$HOME/.claude-flow/test.db"
export NODE_ENV="production"

echo "Environment setup:"
echo "CLAUDE_FLOW_DB_PATH: $CLAUDE_FLOW_DB_PATH"
echo "NODE_ENV: $NODE_ENV"
echo "Node version: $(node --version)"
echo ""

# Create the directory with full permissions
mkdir -p "$HOME/.claude-flow"
chmod 777 "$HOME/.claude-flow"

# Try a simple claude-flow command
echo "Testing basic claude-flow command..."
claude-flow --version

echo ""
echo "If the above worked, try this command manually:"
echo ""
echo 'claude-flow hive-mind spawn "update the setup script" --claude --auto-spawn'
echo ""
echo "Or try installing and using an older stable version:"
echo "npm install -g claude-flow@latest"
echo ""