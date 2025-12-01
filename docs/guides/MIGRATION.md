# Migration Guide: Updating to Enhanced Claude Code / Claude Flow

Complete guide for migrating existing projects to use the enhanced Claude Code and Claude Flow
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

- **Standard Claude Code setup** → Enhanced Claude Flow integration
- **Claude Flow v1.x** → Claude Flow v2.0+
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
├── .claude-flow/     # Enhanced config
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
git branch backup/pre-claude-flow-migration
git add .
git commit -m "Backup before Claude Flow migration"

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

### Path 1: New Claude Flow Installation (Recommended)

For projects not using Claude Flow:

```bash
# 1. Install Claude Flow
npm install -g @ruvnet/claude-flow@alpha

# 2. Initialize Claude Flow
npx claude-flow@alpha init

# 3. Add MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# 4. Configure for your project
npx claude-flow@alpha config init --interactive
```

### Path 2: Upgrade from Claude Flow v1.x

For existing Claude Flow users:

```bash
# 1. Check current version
npx claude-flow --version

# 2. Uninstall old version
npm uninstall -g claude-flow

# 3. Install new version
npm install -g @ruvnet/claude-flow@alpha

# 4. Migrate configuration
npx claude-flow@alpha migrate --from v1

# 5. Update MCP server
claude mcp remove claude-flow
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

### Path 3: Template-Based Migration

For specific project types:

```bash
# 1. Install Claude Flow
npm install -g @ruvnet/claude-flow@alpha

# 2. Initialize with template
npx claude-flow@alpha init --template react
# or: nextjs, nodejs-backend, python, etc.

# 3. Merge with existing config
npx claude-flow@alpha config merge .claude-flow.template

# 4. Review and adjust
nano .claude-flow/config.json
```

## Step-by-Step Migration

### Step 1: Install Claude Flow

```bash
# Global installation
npm install -g @ruvnet/claude-flow@alpha

# Verify installation
npx claude-flow@alpha --version
# Should show: 2.0.0 or higher
```

### Step 2: Initialize Project

```bash
# Navigate to project
cd /path/to/your/project

# Initialize Claude Flow
npx claude-flow@alpha init

# Answer prompts:
# - Project type: [react/nodejs/python/other]
# - Use SPARC methodology: [yes]
# - Enable git hooks: [yes]
# - Enable neural training: [yes]
```

**What this creates**:

```
.claude-flow/
├── config.json           # Main configuration
├── agents.config.json    # Agent setup
├── hooks.config.json     # Hook automation
└── README.md            # Getting started guide
```

### Step 3: Configure MCP Server

```bash
# Remove old MCP server (if exists)
claude mcp list
claude mcp remove claude-flow  # if exists

# Add new MCP server
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Verify
claude mcp list
# Should show: claude-flow (running)
```

### Step 4: Configure Agents

```bash
# List available agents
npx claude-flow@alpha agent types

# Configure agents for your project
npx claude-flow@alpha agent configure coder \
  --languages "typescript,javascript" \
  --frameworks "react,express"

npx claude-flow@alpha agent configure tester \
  --framework jest \
  --coverage-min 80

npx claude-flow@alpha agent configure reviewer \
  --checks "security,performance,best-practices"
```

**Edit `.claude-flow/agents.config.json`**:

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
npx claude-flow@alpha hooks install

# Configure hooks
npx claude-flow@alpha hooks configure pre-commit \
  --enabled true \
  --hooks "format,lint,type-check"

npx claude-flow@alpha hooks configure post-edit \
  --enabled true \
  --hooks "format,update-docs"
```

**Edit `.claude-flow/hooks.config.json`**:

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
npx claude-flow@alpha sparc init

# Test SPARC workflow
npx claude-flow@alpha sparc run spec-pseudocode "Test task"

# List available modes
npx claude-flow@alpha sparc modes
```

### Step 7: Migrate Existing Configuration

If you have existing `.claude/` configuration:

```bash
# Merge existing configuration
npx claude-flow@alpha config merge .claude/config.json

# Review merged configuration
cat .claude-flow/config.json

# Edit as needed
nano .claude-flow/config.json
```

### Step 8: Update package.json

Add Claude Flow scripts:

```json
{
  "scripts": {
    "claude:sparc": "npx claude-flow@alpha sparc",
    "claude:agent": "npx claude-flow@alpha agent",
    "claude:tdd": "npx claude-flow@alpha sparc tdd",
    "claude:review": "npx claude-flow@alpha github review-pr",
    "claude:metrics": "npx claude-flow@alpha metrics show"
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
claude mcp status claude-flow
# Should show: Running

# 2. Verify configuration
npx claude-flow@alpha config validate
# Should show: Configuration valid

# 3. Verify agents
npx claude-flow@alpha agent list
# Should show all configured agents

# 4. Verify hooks
npx claude-flow@alpha hooks list
# Should show installed hooks

# 5. Run health check
npx claude-flow@alpha health-check
# All checks should pass

# 6. Test SPARC
npx claude-flow@alpha sparc modes
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
  "description": "Verify Claude Flow integration"
}' > test-workflow.json

# Run test workflow
npx claude-flow@alpha sparc tdd "$(cat test-workflow.json)"

# Verify output
ls .claude-flow/memory/
ls .claude-flow/metrics/
```

## Rollback Plan

If migration fails, rollback:

### Quick Rollback

```bash
# 1. Restore from backup branch
git checkout backup/pre-claude-flow-migration

# 2. Remove Claude Flow
npm uninstall -g @ruvnet/claude-flow
rm -rf .claude-flow/
rm -rf .sparc/

# 3. Remove MCP server
claude mcp remove claude-flow

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

Keep Claude Flow but disable features:

```bash
# Disable hooks
npx claude-flow@alpha hooks disable --all

# Disable MCP server
claude mcp stop claude-flow

# Use Claude Code normally
# Claude Flow won't interfere
```

## Common Migration Scenarios

### Scenario 1: React Project

```bash
# 1. Install and initialize
npm install -g @ruvnet/claude-flow@alpha
npx claude-flow@alpha init --template react

# 2. Configure for React
cat > .claude-flow/agents.config.json << 'EOF'
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
claude mcp add claude-flow npx claude-flow@alpha mcp start

# 4. Test
npx claude-flow@alpha sparc run spec-pseudocode "Create login component"
```

### Scenario 2: Node.js Backend

```bash
# 1. Initialize with backend template
npx claude-flow@alpha init --template nodejs-backend

# 2. Configure agents
npx claude-flow@alpha agent configure backend-dev \
  --specialization rest-api \
  --frameworks express,nestjs

# 3. Enable API documentation
npx claude-flow@alpha agent configure api-docs \
  --format openapi-3.0 \
  --auto-generate true

# 4. Test
npx claude-flow@alpha sparc run api-docs "Document user endpoints"
```

### Scenario 3: Monorepo

```bash
# 1. Initialize monorepo
npx claude-flow@alpha init --template monorepo

# 2. Configure packages
cat > .claude-flow/config.json << 'EOF'
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
npx claude-flow@alpha agent configure --package frontend
npx claude-flow@alpha agent configure --package backend

# 4. Test
npx claude-flow@alpha sparc tdd "Add user feature across packages"
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
npx claude-flow@alpha migrate config --from v1 --to v2
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
npx claude-flow@alpha migrate memory --from v1
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
.claude-flow/
├── config.json
├── agents.config.json
├── hooks.config.json
└── [more...]
```

**Migration**: Automatic via `npx claude-flow@alpha init`

#### Agent Configuration

**Before**: No agent system

**After**: Full agent orchestration

**Migration**: Configure agents for your workflow

## Summary

Migration checklist:

1. ✅ **Backup project**
2. ✅ **Install Claude Flow**
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
