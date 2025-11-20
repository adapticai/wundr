# Wundr CLI Installation Guide

**Version:** 1.0.0
**Package:** `@wundr.io/cli`

---

## 📦 Installation Options

The Wundr CLI provides the `wundr` command for all Wundr platform operations. Choose the installation method that best suits your needs:

### Option 1: Global Installation via npm (Recommended)

**Best for:** End users who want the CLI available system-wide

```bash
npm install -g @wundr.io/cli
```

After installation, verify:
```bash
wundr --version
wundr --help
```

### Option 2: Global Link for Development

**Best for:** Contributors developing the Wundr CLI itself

```bash
# From the repository root
cd packages/@wundr/cli
pnpm link --global
```

This creates a symlink to your local development version. Changes to the source code will be immediately available (after rebuild).

Verify:
```bash
which wundr
# Should show: /Users/[user]/.local/share/pnpm/wundr

wundr --version
```

### Option 3: Run via npx (No Installation)

**Best for:** One-off usage or trying out the CLI without installing

```bash
npx @wundr.io/cli <command>
```

Example:
```bash
npx @wundr.io/cli claude-setup optimize
npx @wundr.io/cli computer-setup --profile fullstack
```

**Note:** This downloads and caches the package temporarily. First run may be slower.

### Option 4: Run from Source (Development Only)

**Best for:** Active development and debugging

```bash
# From the repository root
npx tsx packages/@wundr/cli/src/index.ts <command>
```

Example:
```bash
npx tsx packages/@wundr/cli/src/index.ts claude-setup optimize
```

This runs the TypeScript source directly without compilation.

---

## 🔍 Verification

After installation, verify the CLI is working:

```bash
# Check version
wundr --version

# View available commands
wundr --help

# Test a specific command
wundr claude-setup --help
```

Expected output:
```
██╗    ██╗██╗   ██╗███╗   ██╗██████╗ ██████╗
██║    ██║██║   ██║████╗  ██║██╔══██╗██╔══██╗
██║ █╗ ██║██║   ██║██╔██╗ ██║██║  ██║██████╔╝
██║███╗██║██║   ██║██║╚██╗██║██║  ██║██╔══██╗
╚███╔███╔╝╚██████╔╝██║ ╚████║██████╔╝██║  ██║
 ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝

The Intelligent CLI-Based Coding Agents Orchestrator v1.0.0
```

---

## 📋 Available Commands

Once installed, you have access to all Wundr commands:

### Computer Setup
```bash
wundr computer-setup              # Interactive setup wizard
wundr computer-setup --profile fullstack
wundr computer-setup validate
```

### Claude Code Setup
```bash
wundr claude-setup                # Complete Claude ecosystem
wundr claude-setup optimize       # Standalone optimizations
wundr claude-setup mcp            # Install MCP tools
wundr claude-setup agents         # Configure agents
wundr claude-setup validate       # Validate installation
```

### Project Creation
```bash
wundr create frontend my-app      # Next.js project
wundr create backend my-api       # Fastify API
wundr create monorepo my-platform # Turborepo
```

### Code Analysis
```bash
wundr analyze                     # Analyze codebase
wundr govern baseline             # Create governance baseline
wundr govern check                # Check for drift
```

---

## 🔧 Troubleshooting

### Issue: `wundr: command not found`

**Cause:** The CLI is not in your PATH

**Solution:**

For npm global install:
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH (in ~/.zshrc or ~/.bashrc)
export PATH="$PATH:$(npm config get prefix)/bin"
```

For pnpm link:
```bash
# Check pnpm global bin directory
pnpm bin -g

# Add to PATH (in ~/.zshrc or ~/.bashrc)
export PATH="$PATH:$(pnpm bin -g)"
```

Then restart your terminal:
```bash
exec $SHELL
```

### Issue: `MODULE_TYPELESS_PACKAGE_JSON` Warning

**Cause:** Some dependencies don't specify module type

**Impact:** Cosmetic warning, doesn't affect functionality

**Solution:** Can be safely ignored, or add `"type": "module"` to offending package.json files

### Issue: Permission Denied

**Cause:** Insufficient permissions for global installation

**Solution:**

```bash
# Use sudo (not recommended)
sudo npm install -g @wundr.io/cli

# OR configure npm to use a directory you own (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @wundr.io/cli
```

---

## 🔄 Updating

### Global Installation
```bash
npm update -g @wundr.io/cli
```

### Development Link
```bash
cd packages/@wundr/cli
git pull origin main
pnpm install
pnpm build
```

The symlink will automatically use the updated version.

---

## 🗑️ Uninstallation

### Global Installation
```bash
npm uninstall -g @wundr.io/cli
```

### Development Link
```bash
pnpm unlink --global @wundr.io/cli
```

Verify removal:
```bash
which wundr
# Should return: wundr not found
```

---

## 📚 Additional Resources

- [Main README](../README.md) - Platform overview
- [Claude Code Optimization Guide](./CLAUDE-CODE-STANDALONE-OPTIMIZATION.md) - Optimization setup
- [Computer Setup Guide](../packages/@wundr/computer-setup/README.md) - Full setup documentation

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Run `wundr --help` for command reference
3. Check the [GitHub Issues](https://github.com/adapticai/wundr/issues)
4. File a new issue with:
   - Output of `wundr --version`
   - Output of `which wundr`
   - Your OS and Node version
   - Full error message

---

**Generated with Claude Code** 🤖
