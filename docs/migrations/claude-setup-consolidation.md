# Claude Setup Consolidation Migration

## Overview

This document describes the consolidation of two duplicate `claude-setup.ts` implementations into a
single, unified version.

## Migration Date

2025-11-21

## Problem

The codebase contained two separate implementations of the Claude setup command:

1. **`/src/cli/commands/claude-setup.ts`** (374 lines)
   - Function-based approach using `createClaudeSetupCommand()`
   - Focused on project-level setup with templates
   - Features: Git init, Claude Flow, MCP tools directory, CLAUDE.md generation, project templates

2. **`/packages/@wundr/cli/src/commands/claude-setup.ts`** (697 lines)
   - Class-based approach using `ClaudeSetupCommands`
   - Focused on system-wide Claude ecosystem setup
   - Features: Claude CLI, Chrome, MCP tools, agents, validation, hardware optimization

This duplication caused:

- Maintenance burden (changes needed in two places)
- Feature inconsistency between the two versions
- Confusion about which command to use
- Potential for divergent behavior

## Solution

Consolidated both implementations into a single file at:

```
/packages/@wundr/cli/src/commands/claude-setup.ts
```

The consolidated version (1280 lines) preserves ALL functionality from both implementations.

## Changes Made

### Files Removed

- `/src/cli/commands/claude-setup.ts` - Duplicate removed

### Files Modified

- `/packages/@wundr/cli/src/commands/claude-setup.ts` - Consolidated version
- `/src/cli/wundr-claude.ts` - Updated import path

### Files Created

- `/docs/migrations/claude-setup-consolidation.md` - This documentation
- `/tests/commands/claude-setup.test.ts` - Regression tests

## Feature Comparison

| Feature                      | Old `/src/cli/` | Old `/@wundr/cli/` | Consolidated                 |
| ---------------------------- | --------------- | ------------------ | ---------------------------- |
| Project setup with templates | Yes             | No                 | Yes (`project` subcommand)   |
| Git repository init          | Yes             | No                 | Yes                          |
| Claude Flow setup            | Yes             | Yes                | Yes                          |
| MCP tools directory          | Yes             | No                 | Yes                          |
| CLAUDE.md generation         | Yes             | No                 | Yes (`config` subcommand)    |
| TypeScript template          | Yes             | No                 | Yes                          |
| React template               | Yes             | No                 | Yes                          |
| Node.js template             | Yes             | No                 | Yes                          |
| Monorepo template            | Yes             | No                 | Yes                          |
| Swarm initialization         | Yes             | No                 | Yes                          |
| Claude CLI installation      | No              | Yes                | Yes                          |
| Chrome installation          | No              | Yes                | Yes                          |
| Agent configuration          | No              | Yes                | Yes (`agents` subcommand)    |
| Hardware optimization        | No              | Yes                | Yes (`optimize` subcommand)  |
| Validation with fix          | No              | Yes                | Yes (`validate` subcommand)  |
| Chrome extension setup       | No              | Yes                | Yes (`extension` subcommand) |
| Shell configuration          | No              | Yes                | Yes                          |
| Profile-based agents         | No              | Yes                | Yes                          |
| Complete 54 agents list      | No              | Yes                | Yes                          |

## New Command Structure

```
wundr claude-setup                    # Complete ecosystem installation (default)
wundr claude-setup install            # Explicit complete installation
wundr claude-setup project [path]     # Project-specific setup with templates
wundr claude-setup mcp                # Install MCP tools
wundr claude-setup agents             # Configure agents
wundr claude-setup validate           # Validate installation
wundr claude-setup extension          # Chrome extension setup
wundr claude-setup optimize           # Hardware optimization
wundr claude-setup config [path]      # Generate CLAUDE.md
```

### Options

**`install` command:**

- `--skip-chrome` - Skip Chrome installation
- `--skip-mcp` - Skip MCP tools installation
- `--skip-agents` - Skip agent configuration
- `--skip-flow` - Skip Claude Flow setup
- `-g, --global` - Install tools globally

**`project` command:**

- `-g, --global` - Install tools globally
- `--skip-mcp` - Skip MCP tools installation
- `--skip-flow` - Skip Claude Flow setup
- `-t, --template <name>` - Use template (typescript, react, nodejs, monorepo)

**`mcp` command:**

- `--tool <tool>` - Install specific tool

**`agents` command:**

- `--list` - List available agents
- `--enable <agents>` - Enable specific agents (comma-separated)
- `--profile <profile>` - Use profile (frontend, backend, fullstack, devops, ml)

**`validate` command:**

- `--fix` - Attempt to fix issues

**`optimize` command:**

- `--force` - Force reinstallation

## Import Changes

### Before

```typescript
// In /src/cli/wundr-claude.ts
import { createClaudeSetupCommand } from './commands/claude-setup.js';

// In /packages/@wundr/cli/src/cli.ts
import claudeSetupCommand from './commands/claude-setup';
```

### After

```typescript
// In /src/cli/wundr-claude.ts
import { createClaudeSetupCommand } from '../../packages/@wundr/cli/src/commands/claude-setup.js';

// In /packages/@wundr/cli/src/cli.ts (unchanged)
import claudeSetupCommand from './commands/claude-setup';
```

## Backwards Compatibility

The consolidated version exports both patterns for compatibility:

```typescript
// Class-based (default export)
import claudeSetupCommand from './claude-setup';
claudeSetupCommand(program);

// Function-based (named export)
import { createClaudeSetupCommand } from './claude-setup';
const command = createClaudeSetupCommand();
```

## Testing

Run the following commands to verify the consolidation:

```bash
# Type check
npm run typecheck

# Run tests
npm test

# Verify command works
npx wundr claude-setup --help
npx wundr claude-setup validate
```

## Rollback

If issues are encountered, restore from git:

```bash
# Restore the old file
git checkout HEAD~1 -- src/cli/commands/claude-setup.ts

# Revert the wundr-claude.ts import change
git checkout HEAD~1 -- src/cli/wundr-claude.ts

# Restore the old @wundr/cli version
git checkout HEAD~1 -- packages/@wundr/cli/src/commands/claude-setup.ts
```

## Related Issues

- Eliminates code duplication
- Unifies CLI experience
- Reduces maintenance burden
- Improves feature parity

## Diff Summary

### What Was Kept from `/src/cli/commands/claude-setup.ts`

- Git repository initialization with prompt
- Claude Flow local/global installation logic
- MCP tools directory creation with install.sh script
- CLAUDE.md generation via ClaudeConfigGenerator
- All 4 project templates (typescript, react, nodejs, monorepo)
- Swarm initialization
- Project setup validation
- Final instructions display

### What Was Kept from `/@wundr/cli/src/commands/claude-setup.ts`

- ClaudeSetupCommands class structure
- Subcommand architecture (install, mcp, agents, validate, extension, optimize)
- Claude CLI installation
- Chrome browser installation (macOS)
- Agent configuration system with profiles
- Complete 54-agent listing
- Hardware-adaptive optimization scripts
- Shell configuration (.zshrc, .bashrc)
- Validation checks with --fix option
- Chrome extension setup instructions
- Settings.json configuration

### What Was Merged

- Both implementations' MCP tool installation (script-based + specific tool)
- Combined option sets from both versions
- Unified error handling and spinner usage

### What Was Removed

- Duplicate file at `/src/cli/commands/claude-setup.ts`
- Redundant code patterns
