#!/bin/bash
# Verify Claude Code & Claude Flow Installation
# This script validates that the computer-setup installed everything correctly

set -e

echo "🔍 Verifying Claude Code & Claude Flow Installation..."
echo ""

ERRORS=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((ERRORS++))
}

# 1. Check Claude CLI installation
echo "📦 Checking Claude CLI..."
if command -v claude >/dev/null 2>&1; then
  VERSION=$(claude --version 2>&1 | head -1)
  check_pass "Claude CLI installed: $VERSION"
else
  check_fail "Claude CLI not found in PATH"
fi

# 2. Check Claude wrapper
echo ""
echo "🔧 Checking global wrapper..."
if [ -f "/usr/local/bin/claude" ]; then
  check_pass "Global wrapper exists at /usr/local/bin/claude"
else
  check_warn "Global wrapper not found (will use shell alias)"
fi

# 3. Check .claude directory structure
echo ""
echo "📁 Checking .claude directory..."
if [ -d "$HOME/.claude" ]; then
  check_pass ".claude directory exists"

  # Check subdirectories
  for dir in agents commands helpers templates hooks; do
    if [ -d "$HOME/.claude/$dir" ]; then
      check_pass "  $dir/ directory exists"
    else
      check_fail "  $dir/ directory missing"
    fi
  done
else
  check_fail ".claude directory not found"
fi

# 4. Check agent files
echo ""
echo "🤖 Checking agent files..."
AGENT_COUNT=$(find "$HOME/.claude/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$AGENT_COUNT" -gt 50 ]; then
  check_pass "Found $AGENT_COUNT agent definition files"
else
  check_warn "Only found $AGENT_COUNT agent files (expected 60+)"
fi

# 5. Check Claude settings
echo ""
echo "⚙️ Checking Claude settings..."
if [ -f "$HOME/.claude/settings.json" ]; then
  check_pass "settings.json exists"

  # Check for MCP servers
  if grep -q "claude-flow" "$HOME/.claude/settings.json"; then
    check_pass "  Claude Flow MCP configured"
  else
    check_warn "  Claude Flow MCP not found in settings"
  fi
else
  check_fail "settings.json not found"
fi

# 6. Check Claude Flow
echo ""
echo "🌊 Checking Claude Flow..."
if npx claude-flow@alpha --version >/dev/null 2>&1; then
  VERSION=$(npx claude-flow@alpha --version 2>&1 | head -1)
  check_pass "Claude Flow available: $VERSION"
else
  check_fail "Claude Flow not available"
fi

# 7. Check shell configuration
echo ""
echo "🐚 Checking shell configuration..."
SHELL_CONFIG="$HOME/.zshrc"
if [ -f "$HOME/.bashrc" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
fi

if [ -f "$SHELL_CONFIG" ]; then
  if grep -q "Claude Code CLI" "$SHELL_CONFIG"; then
    check_pass "Shell alias configured in $(basename $SHELL_CONFIG)"
  else
    check_warn "Shell alias not found in $(basename $SHELL_CONFIG)"
  fi
else
  check_warn "No shell config file found"
fi

# 8. Check npm global packages
echo ""
echo "📦 Checking npm global packages..."
if npm list -g @anthropic-ai/claude-code >/dev/null 2>&1; then
  check_pass "@anthropic-ai/claude-code installed globally"
else
  check_fail "@anthropic-ai/claude-code not found in npm global"
fi

# 9. Check CLAUDE.md template
echo ""
echo "📝 Checking CLAUDE.md template..."
if [ -f "$HOME/.claude/templates/CLAUDE.md.template" ]; then
  TEMPLATE_SIZE=$(wc -c < "$HOME/.claude/templates/CLAUDE.md.template" | tr -d ' ')
  if [ "$TEMPLATE_SIZE" -gt 1000 ]; then
    check_pass "CLAUDE.md template installed (${TEMPLATE_SIZE} bytes)"
  else
    check_warn "CLAUDE.md template seems incomplete"
  fi
else
  check_warn "CLAUDE.md template not found"
fi

# 10. Check Chrome (for Browser MCP)
echo ""
echo "🌐 Checking Chrome browser..."
if [ -d "/Applications/Google Chrome.app" ]; then
  check_pass "Google Chrome installed"
else
  check_warn "Google Chrome not found (needed for Browser MCP)"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "🎉 Claude Code & Claude Flow are fully installed and configured."
  echo ""
  echo "Next steps:"
  echo "  1. Restart your terminal or run: source ~/.zshrc"
  echo "  2. Test: claude --version"
  echo "  3. Start coding in any repository!"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ Installation complete with $WARNINGS warning(s)${NC}"
  echo ""
  echo "Claude is installed but some optional components are missing."
  echo "Review warnings above for details."
  exit 0
else
  echo -e "${RED}✗ Installation incomplete - $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo ""
  echo "Please review errors above and re-run computer-setup if needed."
  echo "For help, see: docs/COMPUTER_SETUP_CLAUDE_FIX.md"
  exit 1
fi
