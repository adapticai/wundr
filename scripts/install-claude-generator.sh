#!/bin/bash

# Install script for Wundr Claude Generator System
# This script sets up the dynamic CLAUDE.md generator globally

set -e

echo "🚀 Installing Wundr Claude Generator System..."
echo "=============================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Found: $(node --version)"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites satisfied"

# Build the project
echo "🔨 Building Claude Generator system..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check for errors above."
    exit 1
fi

# Install globally
echo "📦 Installing globally..."

# Check if we should use npm link (development) or npm install (production)
if [ "$1" = "--dev" ]; then
    echo "🔗 Installing in development mode..."
    npm link
else
    echo "🌍 Installing globally..."
    npm pack
    npm install -g *.tgz
    rm -f *.tgz
fi

# Verify installation
echo "✅ Verifying installation..."
if ! command -v wundr &> /dev/null; then
    echo "❌ Installation verification failed. 'wundr' command not found."
    exit 1
fi

# Test the command
WUNDR_VERSION=$(wundr --version 2>/dev/null || echo "unknown")
echo "✅ Wundr CLI installed successfully - Version: $WUNDR_VERSION"

# Create global config directory
echo "⚙️  Setting up global configuration..."
mkdir -p "$HOME/.wundr"

# Create default config
cat > "$HOME/.wundr/config.json" << 'EOF'
{
  "version": "1.0.0",
  "installedAt": "INSTALL_TIMESTAMP",
  "preferences": {
    "defaultTemplate": "typescript",
    "enableAuditByDefault": true,
    "verboseOutput": false,
    "autoUpdateClaudeConfig": true
  },
  "paths": {
    "templatesDir": "$HOME/.wundr/templates",
    "cacheDir": "$HOME/.wundr/cache"
  },
  "integrations": {
    "claudeFlow": {
      "enabled": true,
      "autoInstall": true
    },
    "mcpTools": {
      "enabled": true,
      "autoSetup": true
    }
  }
}
EOF

# Replace timestamp
if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s/INSTALL_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)/g" "$HOME/.wundr/config.json"
else
    sed -i "s/INSTALL_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)/g" "$HOME/.wundr/config.json"
fi

# Create directories
mkdir -p "$HOME/.wundr/templates"
mkdir -p "$HOME/.wundr/cache"

# Setup shell integration
echo "🐚 Setting up shell integration..."

SHELL_INTEGRATION="$HOME/.wundr/shell-integration.sh"
cat > "$SHELL_INTEGRATION" << 'EOF'
# Wundr Claude CLI Integration
# Auto-generated shell integration

# Quick aliases for common operations
alias wci='wundr claude-init'
alias wca='wundr claude-audit' 
alias wcs='wundr claude-setup'

# Function to automatically suggest Claude setup in new git repos
wundr_auto_suggest() {
  if [ -d .git ] && [ ! -f CLAUDE.md ]; then
    echo "🤖 New git repository detected. Run 'wundr init' for Claude Code setup."
  fi
}

# Hook into cd command (bash/zsh)
if [ -n "$BASH_VERSION" ]; then
  # Bash
  PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND$'\n'}wundr_auto_suggest"
elif [ -n "$ZSH_VERSION" ]; then
  # Zsh  
  autoload -U add-zsh-hook
  add-zsh-hook chpwd wundr_auto_suggest
fi

# Tab completion (basic)
if command -v complete >/dev/null 2>&1; then
  complete -W "init claude-init claude-audit claude-setup help-claude" wundr
fi
EOF

# Add to shell configs
for SHELL_CONFIG in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  if [ -f "$SHELL_CONFIG" ]; then
    if ! grep -q "Wundr Claude CLI Integration" "$SHELL_CONFIG"; then
      echo "" >> "$SHELL_CONFIG"
      echo "# Wundr Claude CLI Integration" >> "$SHELL_CONFIG"
      echo "[ -f \"$SHELL_INTEGRATION\" ] && source \"$SHELL_INTEGRATION\"" >> "$SHELL_CONFIG"
      echo "✅ Added integration to $(basename "$SHELL_CONFIG")"
    else
      echo "ℹ️  Integration already exists in $(basename "$SHELL_CONFIG")"
    fi
  fi
done

echo ""
echo "🎉 Installation Complete!"
echo "========================="
echo ""
echo "✅ What was installed:"
echo "  • Global 'wundr' command"  
echo "  • Shell integration and aliases"
echo "  • Configuration in ~/.wundr/"
echo "  • Template system for project types"
echo ""
echo "⚡ New aliases available:"
echo "  • wci  → wundr claude-init"
echo "  • wca  → wundr claude-audit"  
echo "  • wcs  → wundr claude-setup"
echo ""
echo "🚀 Quick start:"
echo "  1. Restart your terminal (or run: source ~/.bashrc)"
echo "  2. Navigate to any git repository"
echo "  3. Run: wundr init"
echo "  4. Or use: wundr claude-setup for full setup"
echo ""
echo "📚 Learn more:"
echo "  • wundr help-claude  → Comprehensive guide"
echo "  • wundr --help       → All available commands" 
echo ""
echo "✨ Happy coding with optimized Claude Code integration!"