# Migration Guide: Updating to Enhanced Claude Code / Ruflo

Complete guide for migrating existing projects to use the enhanced Claude Code and Ruflo
integration.

## Table of Contents

- [Overview](#overview)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Migration Paths](#migration-paths)
- [Step-by-Step Migration](#step-by-step-migration)
- [Post-Migration Validation](#post-migration-validation)
- [Rollback Plan](#rollback-plan)
- [Common Migration Scenarios](#common-migration-scenarios)
- [Breaking Changes](#breaking-changes)

## Overview

This guide helps you migrate from:

- **Standard Claude Code setup** → Enhanced Ruflo integration
- **Ruflo v1.x** → Ruflo v2.0+
- **Manual workflows** → Automated SPARC workflows
- **Single agent setup** → Swarm coordination

### What Changes?

**Before**:

```
Project
├── .claude/          # Basic config
└── src/              # Your code
```

**After**:

```
Project
├── .ruflo/     # Enhanced config
│   ├── agents/       # Agent configurations
│   ├── hooks/        # Automation hooks
│   ├── memory/       # Persistent memory
│   ├── templates/    # Project templates
│   └── workflows/    # SPARC workflows
├── .sparc/           # SPARC methodology
└── src/              # Your code (unchanged)
```

### Migration Timeline

- **Small project** (<100 files): 1-2 hours
- **Medium project** (100-500 files): 4-8 hours
- **Large project** (500+ files): 1-2 days
- **Monorepo**: 2-5 days

## Pre-Migration Checklist

### 1. Backup Your Project

```bash
# Create backup
git branch backup/pre-ruflo-migration
git add .
git commit -m "Backup before Ruflo migration"

# Or create zip backup
tar -czf ../project-backup-$(date +%Y%m%d).tar.gz .
```

### 2. Verify Prerequisites

```bash
# Check Node version
node --version  # Should be 18+

# Check Git status
git status      # Should be clean

# Check npm access
npm whoami      # Should show your username

# Check disk space
df -h .         # Should have at least 1GB free
```

### 3. Document Current Setup

```bash
# Save current dependencies
npm list --depth=0 > pre-migration-deps.txt

# Save current scripts
cat package.json | jq '.scripts' > pre-migration-scripts.json

# Save current configuration
if [ -d .claude ]; then
  cp -r .claude .claude.backup
fi
```

## Migration Paths

### Path 1: New Ruflo Installation (Recommended)

For projects not using Ruflo:

```bash
# 1. Install Ruflo
npm install -g @ruvnet/ruflo@latest

# 2. Initialize Ruflo
npx ruflo@latest init

# 3. Add MCP server
claude mcp add ruflo npx ruflo@latest mcp start

# 4. Configure for your project
npx ruflo@latest config init --interactive
```

### Path 2: Upgrade from Ruflo v1.x

For existing Ruflo users:

```bash
# 1. Check current version
npx ruflo --version

# 2. Uninstall old version
npm uninstall -g ruflo

# 3. Install new version
npm install -g @ruvnet/ruflo@latest

# 4. Migrate configuration
npx ruflo@latest migrate --from v1

# 5. Update MCP server
claude mcp remove ruflo
claude mcp add ruflo npx ruflo@latest mcp start
```

### Path 3: Template-Based Migration

For specific project types:

```bash
# 1. Install Ruflo
npm install -g @ruvnet/ruflo@latest

# 2. Initialize with template
npx ruflo@latest init --template react
# or: nextjs, nodejs-backend, python, etc.

# 3. Merge with existing config
npx ruflo@latest config merge .ruflo.template

# 4. Review and adjust
nano .ruflo/config.json
```

## Step-by-Step Migration

### Step 1: Install Ruflo

```bash
# Global installation
npm install -g @ruvnet/ruflo@latest

# Verify installation
npx ruflo@latest --version
# Should show: 2.0.0 or higher
```

### Step 2: Initialize Project

```bash
# Navigate to project
cd /path/to/your/project

# Initialize Ruflo
npx ruflo@latest init

# Answer prompts:
# - Project type: [react/nodejs/python/other]
# - Use SPARC methodology: [yes]
# - Enable git hooks: [yes]
# - Enable neural training: [yes]
```

**What this creates**:

```
.ruflo/
├── config.json           # Main configuration
├── agents.config.json    # Agent setup
├── hooks.config.json     # Hook automation
└── README.md            # Getting started guide
```

### Step 3: Configure MCP Server

```bash
# Remove old MCP server (if exists)
claude mcp list
claude mcp remove ruflo  # if exists

# Add new MCP server
claude mcp add ruflo npx ruflo@latest mcp start

# Verify
claude mcp list
# Should show: ruflo (running)
```

### Step 4: Configure Agents

```bash
# List available agents
npx ruflo@latest agent types

# Configure agents for your project
npx ruflo@latest agent configure coder \
  --languages "typescript,javascript" \
  --frameworks "react,express"

npx ruflo@latest agent configure tester \
  --framework jest \
  --coverage-min 80

npx ruflo@latest agent configure reviewer \
  --checks "security,performance,best-practices"
```

**Edit `.ruflo/agents.config.json`**:

```json
{
  "agents": {
    "defaults": {
      "timeout": 300000,
      "retries": 3
    },
    "overrides": {
      "coder": {
        "languages": ["typescript", "javascript"],
        "frameworks": ["react", "express"],
        "autoFormat": true
      },
      "tester": {
        "framework": "jest",
        "coverage": {
          "minimum": 80,
          "enforce": true
        }
      }
    }
  }
}
```

### Step 5: Set Up Hooks

```bash
# Install Git hooks
npx ruflo@latest hooks install

# Configure hooks
npx ruflo@latest hooks configure pre-commit \
  --enabled true \
  --hooks "format,lint,type-check"

npx ruflo@latest hooks configure post-edit \
  --enabled true \
  --hooks "format,update-docs"
```

**Edit `.ruflo/hooks.config.json`**:

```json
{
  "hooks": {
    "pre-commit": {
      "enabled": true,
      "hooks": ["format-code", "lint-code", "type-check"],
      "critical": true
    },
    "post-edit": {
      "enabled": true,
      "hooks": ["format-code", "update-docs"],
      "async": true
    }
  }
}
```

### Step 6: Initialize SPARC Workflows

```bash
# Initialize SPARC
npx ruflo@latest sparc init

# Test SPARC workflow
npx ruflo@latest sparc run spec-pseudocode "Test task"

# List available modes
npx ruflo@latest sparc modes
```

### Step 7: Migrate Existing Configuration

If you have existing `.claude/` configuration:

```bash
# Merge existing configuration
npx ruflo@latest config merge .claude/config.json

# Review merged configuration
cat .ruflo/config.json

# Edit as needed
nano .ruflo/config.json
```

### Step 8: Update package.json

Add Ruflo scripts:

```json
{
  "scripts": {
    "claude:sparc": "npx ruflo@latest sparc",
    "claude:agent": "npx ruflo@latest agent",
    "claude:tdd": "npx ruflo@latest sparc tdd",
    "claude:review": "npx ruflo@latest github review-pr",
    "claude:metrics": "npx ruflo@latest metrics show"
  }
}
```

### Step 9: Test Migration

```bash
# Test SPARC workflow
npm run claude:sparc -- run spec-pseudocode "Test migration"

# Test agent spawning
npm run claude:agent -- spawn --type coder

# Test hooks
git add .
git commit -m "test: verify hooks"
# Hooks should run automatically

# Test build
npm run build
npm test
```

## Post-Migration Validation

### Validation Checklist

```bash
# 1. Verify MCP server
claude mcp status ruflo
# Should show: Running

# 2. Verify configuration
npx ruflo@latest config validate
# Should show: Configuration valid

# 3. Verify agents
npx ruflo@latest agent list
# Should show all configured agents

# 4. Verify hooks
npx ruflo@latest hooks list
# Should show installed hooks

# 5. Run health check
npx ruflo@latest health-check
# All checks should pass

# 6. Test SPARC
npx ruflo@latest sparc modes
# Should list all modes

# 7. Test build
npm run build
# Should succeed

# 8. Test tests
npm test
# Should pass
```

### Integration Tests

```bash
# Create test workflow
echo '{
  "task": "Test migration",
  "description": "Verify Ruflo integration"
}' > test-workflow.json

# Run test workflow
npx ruflo@latest sparc tdd "$(cat test-workflow.json)"

# Verify output
ls .ruflo/memory/
ls .ruflo/metrics/
```

## Rollback Plan

If migration fails, rollback:

### Quick Rollback

```bash
# 1. Restore from backup branch
git checkout backup/pre-ruflo-migration

# 2. Remove Ruflo
npm uninstall -g @ruvnet/ruflo
rm -rf .ruflo/
rm -rf .sparc/

# 3. Remove MCP server
claude mcp remove ruflo

# 4. Restore old config (if exists)
if [ -d .claude.backup ]; then
  rm -rf .claude
  mv .claude.backup .claude
fi

# 5. Reinstall dependencies
npm install

# 6. Verify
npm run build
npm test
```

### Gradual Rollback

Keep Ruflo but disable features:

```bash
# Disable hooks
npx ruflo@latest hooks disable --all

# Disable MCP server
claude mcp stop ruflo

# Use Claude Code normally
# Ruflo won't interfere
```

## Common Migration Scenarios

### Scenario 1: React Project

```bash
# 1. Install and initialize
npm install -g @ruvnet/ruflo@latest
npx ruflo@latest init --template react

# 2. Configure for React
cat > .ruflo/agents.config.json << 'EOF'
{
  "agents": {
    "component-dev": {
      "type": "coder",
      "specialization": "react",
      "files": ["**/*.tsx", "**/*.jsx"],
      "autoImport": true
    },
    "tester": {
      "framework": "jest",
      "testRunner": "react-testing-library"
    }
  }
}
EOF

# 3. Set up MCP
claude mcp add ruflo npx ruflo@latest mcp start

# 4. Test
npx ruflo@latest sparc run spec-pseudocode "Create login component"
```

### Scenario 2: Node.js Backend

```bash
# 1. Initialize with backend template
npx ruflo@latest init --template nodejs-backend

# 2. Configure agents
npx ruflo@latest agent configure backend-dev \
  --specialization rest-api \
  --frameworks express,nestjs

# 3. Enable API documentation
npx ruflo@latest agent configure api-docs \
  --format openapi-3.0 \
  --auto-generate true

# 4. Test
npx ruflo@latest sparc run api-docs "Document user endpoints"
```

### Scenario 3: Monorepo

```bash
# 1. Initialize monorepo
npx ruflo@latest init --template monorepo

# 2. Configure packages
cat > .ruflo/config.json << 'EOF'
{
  "monorepo": {
    "enabled": true,
    "packages": {
      "frontend": {
        "template": "react",
        "path": "packages/frontend"
      },
      "backend": {
        "template": "nodejs-backend",
        "path": "packages/backend"
      }
    }
  }
}
EOF

# 3. Set up per-package agents
npx ruflo@latest agent configure --package frontend
npx ruflo@latest agent configure --package backend

# 4. Test
npx ruflo@latest sparc tdd "Add user feature across packages"
```

## Breaking Changes

### v1.x to v2.0

#### Configuration Format Changed

**Before (v1.x)**:

```json
{
  "agents": {
    "coder": { "enabled": true }
  }
}
```

**After (v2.0)**:

```json
{
  "agents": {
    "defaults": { "timeout": 300000 },
    "overrides": {
      "coder": { "enabled": true, "timeout": 600000 }
    }
  }
}
```

**Migration**:

```bash
npx ruflo@latest migrate config --from v1 --to v2
```

#### Hook System Redesigned

**Before**: Hooks were simple scripts

**After**: Hooks are modules with lifecycle

**Migration**: Re-implement hooks using new system (see Hook Development Guide)

#### Memory Format Changed

**Before**: JSON files

**After**: Structured database

**Migration**:

```bash
npx ruflo@latest migrate memory --from v1
```

### Standard Claude Code to Enhanced

#### Directory Structure

**Before**:

```
.claude/
└── config.json
```

**After**:

```
.ruflo/
├── config.json
├── agents.config.json
├── hooks.config.json
└── [more...]
```

**Migration**: Automatic via `npx ruflo@latest init`

#### Agent Configuration

**Before**: No agent system

**After**: Full agent orchestration

**Migration**: Configure agents for your workflow

## Summary

Migration checklist:

1. ✅ **Backup project**
2. ✅ **Install Ruflo**
3. ✅ **Initialize configuration**
4. ✅ **Set up MCP server**
5. ✅ **Configure agents**
6. ✅ **Install hooks**
7. ✅ **Initialize SPARC**
8. ✅ **Test integration**
9. ✅ **Validate results**
10. ✅ **Document changes**

**Next Steps**:

- [Quick Start Guide](./QUICK_START.md)
- [Agent Configuration](./AGENT_CONFIGURATION.md)
- [Hook Development](./HOOK_DEVELOPMENT.md)

---

**Pro Tip**: Migrate incrementally. Start with basic setup, add features gradually, validate at each
step.
