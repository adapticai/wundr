# 🛠️ Wundr Development Guide

## Running Computer Setup in Development Mode

The computer setup feature can be tested without building the entire project. Here are several ways to run it:

### Method 1: Using Dev Scripts (Recommended)

```bash
# Interactive setup with dry-run (safe)
./scripts/dev-computer-setup.sh

# With specific profile
./scripts/dev-computer-setup.sh --profile frontend

# Actually install (careful!)
./scripts/dev-computer-setup.sh --no-dry-run --profile backend

# General CLI in dev mode
./scripts/dev-cli.sh computer-setup --help
```

### Method 2: Using npm/pnpm Scripts

```bash
# Run computer setup
npm run dev:computer-setup

# With options
npm run dev:computer-setup -- --profile frontend --dry-run

# Run project creation
npm run dev:create

# Run analysis
npm run dev:analyze
```

### Method 3: Direct TypeScript Execution

```bash
# Run the CLI directly
npx tsx packages/@wundr/cli/src/index.ts computer-setup --help

# Run with profile
npx tsx packages/@wundr/cli/src/index.ts computer-setup --profile frontend --dry-run

# Run the dedicated dev script
npx tsx packages/@wundr/computer-setup/dev.ts --help
```

### Method 4: Computer Setup Dev Commands

The `dev.ts` file provides specific testing commands:

```bash
# Validate system requirements
npx tsx packages/@wundr/computer-setup/dev.ts validate

# List available profiles
npx tsx packages/@wundr/computer-setup/dev.ts list-profiles

# Show profile details
npx tsx packages/@wundr/computer-setup/dev.ts show-profile frontend

# Check installed tools
npx tsx packages/@wundr/computer-setup/dev.ts check-tools

# Dry-run a profile
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend
```

## Safety Features

### Always Use Dry-Run First!

The computer setup will modify your system. Always test with `--dry-run` first:

```bash
# Safe - shows what would be done
npm run dev:computer-setup -- --dry-run

# Dangerous - actually installs
npm run dev:computer-setup -- --no-dry-run
```

### Profile Options

- `frontend` - React, Vue, Next.js development tools
- `backend` - Node.js, databases, API development
- `fullstack` - Combined frontend + backend tools
- `devops` - Docker, Kubernetes, cloud tools
- `ml` - Python, Jupyter, machine learning tools
- `mobile` - React Native, mobile development

## Project Creation in Dev Mode

### Create New Projects

```bash
# Interactive mode
npm run dev:create

# Create specific project types
npm run dev:create -- frontend my-app
npm run dev:create -- backend my-api
npm run dev:create -- monorepo my-platform

# With options
npm run dev:create -- frontend my-app --no-install --no-git
```

### List Available Templates

```bash
npx tsx packages/@wundr/cli/src/index.ts create project --list
```

## Troubleshooting

### Missing Dependencies

If you get module not found errors:

```bash
# Install dependencies
pnpm install

# Install tsx globally if needed
npm install -g tsx

# Build core packages first
pnpm build --filter=@wundr/core --filter=@wundr/config
```

### TypeScript Errors

If TypeScript complains, you can bypass with:

```bash
# Use ts-node with transpile-only
npx ts-node --transpile-only packages/@wundr/cli/src/index.ts computer-setup
```

### Permission Errors

Some installations require elevated permissions:

```bash
# On macOS/Linux (use with caution!)
sudo npm run dev:computer-setup -- --no-dry-run --profile devops

# Better: run specific commands that need sudo individually
```

## Development Workflow

### 1. Make Changes

Edit files in `packages/@wundr/computer-setup/src/`

### 2. Test Without Building

```bash
# Test your changes immediately
npx tsx packages/@wundr/computer-setup/dev.ts validate
```

### 3. Run Integration Tests

```bash
# Dry-run full setup
./scripts/dev-computer-setup.sh --profile frontend
```

### 4. Build When Ready

```bash
# Build the package
cd packages/@wundr/computer-setup
npm run build

# Or build everything
pnpm build
```

## Interactive Development

### Watch Mode

```bash
# Start watch mode for automatic recompilation
npm run build:watch

# In another terminal, run commands
npm run dev:computer-setup
```

### Debug Mode

```bash
# Run with Node.js inspector
node --inspect -r tsx/cjs packages/@wundr/cli/src/index.ts computer-setup

# With VS Code debugger
# Add breakpoints and use launch.json configuration
```

## Environment Variables

```bash
# Enable verbose logging
WUNDR_LOG_LEVEL=debug npm run dev:computer-setup

# Skip network checks
WUNDR_OFFLINE=true npm run dev:computer-setup

# Custom config path
WUNDR_CONFIG=/path/to/config.json npm run dev:computer-setup
```

## Quick Test Commands

```bash
# Check if everything works
npx tsx packages/@wundr/computer-setup/dev.ts check-tools

# See what would be installed for frontend dev
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend

# Test the CLI help system
npx tsx packages/@wundr/cli/src/index.ts --help
npx tsx packages/@wundr/cli/src/index.ts computer-setup --help
npx tsx packages/@wundr/cli/src/index.ts create --help
```

## Safety Checklist

- [ ] Always use `--dry-run` first
- [ ] Review the list of tools to be installed
- [ ] Backup important configs before running
- [ ] Run in a test environment if possible
- [ ] Check disk space before installation
- [ ] Have network connection for downloads

---

Remember: The computer setup modifies your system. Always test with `--dry-run` first!