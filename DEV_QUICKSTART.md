# 🚀 Wundr Development Quick Start

## Running Computer Setup in Dev Mode

The easiest way to run computer setup scripts without building:

### 1. Check What's Installed
```bash
npx tsx packages/@wundr/computer-setup/dev.ts check-tools
```

### 2. List Available Profiles
```bash
npx tsx packages/@wundr/computer-setup/dev.ts list-profiles
```

### 3. Show Profile Details
```bash
npx tsx packages/@wundr/computer-setup/dev.ts show-profile frontend
```

### 4. Dry Run a Profile (Safe)
```bash
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend
```

### 5. Validate System
```bash
npx tsx packages/@wundr/computer-setup/dev.ts validate
```

## Using the Dev Scripts

If you prefer using the scripts:

```bash
# Interactive setup
./scripts/dev-computer-setup.sh

# With specific profile
./scripts/dev-computer-setup.sh --profile frontend

# List templates
./scripts/dev-cli.sh create project --list
```

## Module Resolution Issues?

If you get "Cannot find module" errors, install dependencies first:

```bash
# Install all dependencies
pnpm install

# Or install specific missing packages
cd packages/@wundr/project-templates
pnpm add validate-npm-package-name
```

## Direct Commands (No Scripts)

### Computer Setup Dev Commands
```bash
# Validate system
npx tsx packages/@wundr/computer-setup/dev.ts validate

# Check installed tools
npx tsx packages/@wundr/computer-setup/dev.ts check-tools

# List profiles
npx tsx packages/@wundr/computer-setup/dev.ts list-profiles

# Show specific profile
npx tsx packages/@wundr/computer-setup/dev.ts show-profile backend

# Dry run (safe test)
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend
```

### Create Projects (once dependencies are installed)
```bash
# Note: This requires dependencies to be installed
npx tsx packages/@wundr/cli/src/index.ts create frontend my-app
npx tsx packages/@wundr/cli/src/index.ts create backend my-api
npx tsx packages/@wundr/cli/src/index.ts create monorepo my-platform
```

## Common Issues & Solutions

### Issue: "tsx: command not found"
**Solution**: npx will auto-install tsx when needed

### Issue: "Cannot find module '@wundr/...'"
**Solution**: The packages need to be built first:
```bash
cd packages/@wundr/core && npm run build
cd packages/@wundr/plugin-system && npm run build
```

### Issue: "Cannot find module 'validate-npm-package-name'"
**Solution**: Install missing dependencies:
```bash
cd packages/@wundr/project-templates
pnpm add validate-npm-package-name
```

## Quick Test

Run this to quickly test if everything works:

```bash
npx tsx packages/@wundr/computer-setup/dev.ts check-tools
```

You should see a list of installed tools like:
- ✅ Git
- ✅ Node.js
- ✅ VS Code
- ⭕ Docker (not installed)

## Safety First!

Always use `--dry-run` or the `dry-run` command when testing:

```bash
# Safe - just shows what would be done
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend
```

## Need More Control?

Check out the detailed guide: [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)