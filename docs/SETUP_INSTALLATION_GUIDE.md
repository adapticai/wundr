# Computer Setup - Complete Installation Guide

## ✅ What Was Fixed

The `@wundr.io/computer-setup` package now properly installs Claude Code and Ruflo for **any user**,
not just the Wundr development environment.

### Key Improvements

1. **Bundled Resources** (728KB)
   - 65 agent `.md` files packaged with npm module
   - CLAUDE.md template included
   - No dependency on CWD or git repo structure

2. **Automatic Wrapper Installation**
   - Creates `/usr/local/bin/claude` wrapper (with sudo prompt)
   - Falls back to shell aliases if wrapper fails
   - Works across NVM version switches

3. **Comprehensive Verification**
   - Post-install verification script
   - Checks all components
   - Clear error/warning reporting

## 📦 Package Structure

```
@wundr.io/computer-setup/
├── dist/                      # Compiled TypeScript
├── resources/                 # Bundled with npm (included in package.json "files")
│   ├── agents/               # 65 agent .md files (728KB)
│   │   ├── core/
│   │   ├── swarm/
│   │   ├── consensus/
│   │   ├── github/
│   │   ├── sparc/
│   │   └── specialized/
│   └── templates/
│       └── CLAUDE.md.template # Wundr CLAUDE.md template
└── scripts/
    └── verify-installation.sh # Verification script
```

## 🚀 Installation Flow

### For New Developers

```bash
# 1. Clone wundr repository
git clone https://github.com/your-org/wundr.git
cd wundr

# 2. Install dependencies
pnpm install

# 3. Run setup for your profile
pnpm --filter @wundr.io/computer-setup run setup --profile fullstack

# 4. Verify installation
./packages/@wundr/computer-setup/scripts/verify-installation.sh

# 5. Restart terminal
# Source your shell config or restart terminal
source ~/.zshrc  # or source ~/.bashrc
```

### Expected Output

```
🤖 Installing Claude Code & Ruflo ecosystem...
📦 Installing Claude Code CLI...
Installing @anthropic-ai/claude-code globally...
✅ Claude Code CLI installed successfully
ℹ️  Installing global wrapper requires administrator privileges...
[sudo] password for user: ********
✅ Created global claude wrapper at /usr/local/bin/claude
✅ Added Claude alias to .zshrc
📁 Setting up Claude directory structure...
🔧 Installing MCP servers...
✓ Installed ruflo
✓ Installed firecrawl
⚙️ Configuring Claude settings with advanced hooks...
🤖 Setting up 54+ specialized agents...
📋 Copying bundled agent .md files...
✅ Installed 65 agent definition files
📝 Setting up global CLAUDE.md generator...
✅ Claude Code & Ruflo ecosystem installed successfully!
```

## ✅ Post-Installation Verification

Run the verification script:

```bash
./packages/@wundr/computer-setup/scripts/verify-installation.sh
```

### Expected Verification Output

```
🔍 Verifying Claude Code & Ruflo Installation...

📦 Checking Claude CLI...
✓ Claude CLI installed: 2.0.1 (Claude Code)

🔧 Checking global wrapper...
✓ Global wrapper exists at /usr/local/bin/claude

📁 Checking .claude directory...
✓ .claude directory exists
✓   agents/ directory exists
✓   commands/ directory exists
✓   helpers/ directory exists
✓   templates/ directory exists
✓   hooks/ directory exists

🤖 Checking agent files...
✓ Found 65 agent definition files

⚙️ Checking Claude settings...
✓ settings.json exists
✓   Ruflo MCP configured

🌊 Checking Ruflo...
✓ Ruflo available: 2.0.0-alpha

📊 Verification Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ All checks passed!

🎉 Claude Code & Ruflo are fully installed and configured.
```

## 🔧 What Gets Installed

### 1. Claude Code CLI

- **Global npm package**: `@anthropic-ai/claude-code@2.0.1+`
- **Wrapper script**: `/usr/local/bin/claude` (requires sudo)
- **Shell aliases**: Added to `~/.zshrc` and `~/.bashrc`

```bash
# Verify
claude --version
# Output: 2.0.1 (Claude Code)

which claude
# Output: /usr/local/bin/claude (or alias to npx)
```

### 2. Claude Configuration (`~/.claude/`)

```
~/.claude/
├── agents/                    # 65 agent definition files
│   ├── core/                 # coder, reviewer, tester, planner, researcher
│   ├── swarm/                # hierarchical, mesh, adaptive coordinators
│   ├── consensus/            # byzantine, raft, gossip, crdt, quorum
│   ├── github/               # pr-manager, code-review-swarm, release-manager
│   ├── sparc/                # sparc-coord, coder, specification, pseudocode
│   └── specialized/          # backend-dev, mobile-dev, ml-developer, cicd
├── commands/                  # Custom commands (empty initially)
├── helpers/
│   ├── pre-commit-hook.sh    # Quality enforcement hook
│   └── generate-claude-md.js # CLAUDE.md generator
├── templates/
│   └── CLAUDE.md.template    # Wundr CLAUDE.md template
├── hooks/                     # Git hooks (empty initially)
└── settings.json             # MCP servers and hooks configuration
```

### 3. MCP Servers (Configured in settings.json)

- **ruflo**: Orchestration and multi-agent coordination
- **firecrawl**: Web scraping capabilities
- **playwright**: Browser automation
- **browser**: Browser MCP integration
- **context7**: Context management
- **sequentialthinking**: Enhanced reasoning

### 4. Shell Configuration

Added to `~/.zshrc` and `~/.bashrc`:

```bash
# Claude Code CLI - Auto-generated by Wundr
export PATH="/usr/local/bin:$PATH"
alias claude='npx @anthropic-ai/claude-code'
```

## 🐛 Troubleshooting

### Issue: `claude: command not found`

**Solutions:**

1. **Restart terminal** - Shell config needs to reload

   ```bash
   source ~/.zshrc  # or source ~/.bashrc
   ```

2. **Check if wrapper exists**

   ```bash
   ls -l /usr/local/bin/claude
   ```

3. **Manual wrapper installation** (if failed during setup)

   ```bash
   # The setup script leaves wrapper at /tmp/claude-wrapper.sh
   sudo mv /tmp/claude-wrapper.sh /usr/local/bin/claude
   sudo chmod +x /usr/local/bin/claude
   ```

4. **Use npx fallback**
   ```bash
   npx @anthropic-ai/claude-code --version
   ```

### Issue: Agent files not installed

**Verify bundled resources:**

```bash
# Check if resources are bundled in package
ls -la packages/@wundr/computer-setup/resources/agents/
# Should show 65 .md files
```

**Re-run installation:**

```bash
pnpm --filter @wundr.io/computer-setup run setup --profile fullstack
```

### Issue: MCP servers not working

**Check settings:**

```bash
cat ~/.claude/settings.json | jq '.mcpServers'
```

**Test Ruflo directly:**

```bash
npx ruflo@latest --version
npx ruflo@latest mcp start
```

### Issue: Sudo prompt fails

If you can't provide sudo password:

1. Setup will skip wrapper creation
2. Shell alias will be used instead (requires terminal restart)
3. Manually install wrapper later:
   ```bash
   sudo mv /tmp/claude-wrapper.sh /usr/local/bin/claude
   sudo chmod +x /usr/local/bin/claude
   ```

## 📋 Verification Checklist

After installation, verify:

- [ ] `claude --version` shows 2.0.1+
- [ ] `~/.claude/` directory exists
- [ ] `find ~/.claude/agents -name "*.md" | wc -l` shows 60+
- [ ] `cat ~/.claude/settings.json | jq '.mcpServers'` shows MCP configs
- [ ] `npx ruflo@latest --version` works
- [ ] Terminal restart or `source ~/.zshrc` loads aliases
- [ ] Can run `claude` from any directory

## 🎯 Testing on Fresh Machine

To test the complete installation flow:

```bash
# 1. Start from clean state
rm -rf ~/.claude /usr/local/bin/claude

# 2. Remove shell aliases
sed -i.bak '/Claude Code CLI/,+2d' ~/.zshrc

# 3. Run installation
cd ~/wundr
pnpm --filter @wundr.io/computer-setup run setup --profile fullstack

# 4. Verify
./packages/@wundr/computer-setup/scripts/verify-installation.sh

# 5. Test claude command
claude --version
```

## 📊 Resource Usage

- **Package size**: ~1.2MB (including 728KB of agent files)
- **Installation time**: 2-5 minutes (depending on network)
- **Disk space required**: ~10GB (for all dev tools)
- **Network**: Requires internet for npm packages and MCP servers

## 🔐 Security

- **No hardcoded credentials**: All secrets via environment variables
- **Sudo only for wrapper**: `/usr/local/bin/claude` creation only
- **Fallback aliases**: Work without sudo if wrapper fails
- **Command validation**: Whitelist in settings.json
- **Git hooks**: Quality checks before commits

## 📚 Related Documentation

- [Claude Code MCP Integration](./CLAUDE_CODE_MCP_INTEGRATION.md)
- [SPARC Methodology](../CLAUDE.md)
- [Computer Setup Fix Details](./COMPUTER_SETUP_CLAUDE_FIX.md)

## 🎉 Success!

You should now have:

- ✅ Claude Code CLI working globally
- ✅ Ruflo configured with MCP
- ✅ 65 specialized agents installed
- ✅ All development tools set up
- ✅ Quality enforcement hooks
- ✅ CLAUDE.md template ready

Start coding! Run `claude` in any git repository.
