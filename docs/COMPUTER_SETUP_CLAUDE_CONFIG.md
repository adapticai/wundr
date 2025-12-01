# Computer Setup - Claude Code Configuration Guide

## Overview

The enhanced `computer-setup` command now includes comprehensive Claude Code configuration
management, enabling automated installation of CLAUDE.md, hooks, conventions, agent templates,
git-worktree workflows, and validation scripts.

## Features

### 1. Enhanced CLAUDE.md Installation

- Copies enhanced CLAUDE.md to `~/.claude/`
- Includes SPARC methodology, MCP tools integration, and best practices
- Automatically backs up existing configurations

### 2. Hooks Installation

- Pre-commit hooks for linting and type checking
- Post-checkout hooks for dependency installation
- Executable scripts with proper permissions

### 3. Conventions Configuration

- File naming conventions (PascalCase, camelCase, etc.)
- Code style settings (indentation, quotes, semicolons)
- Import ordering and grouping
- Testing requirements and coverage thresholds
- Git commit message standards

### 4. Agent Templates

- Backend Developer template
- Frontend Developer template
- Fullstack Developer template
- Customizable agent roles and responsibilities

### 5. Git-Worktree Workflows

- Feature development workflow
- Bug fix workflow
- Isolation-based development patterns

### 6. Validation Scripts

- Setup validation script (`validate-setup.sh`)
- Configuration check script (`check-config.sh`)
- Automated health checks

### 7. Backup and Rollback

- Automatic backup creation before installation
- Manual backup management
- One-command rollback capability
- Backup verification and cleanup

## Commands

### Install Claude Code Configuration

```bash
# Interactive installation
wundr computer-setup claude-config

# Dry-run to see what would be installed
wundr computer-setup claude-config --dry-run

# Overwrite existing configurations
wundr computer-setup claude-config --overwrite

# Skip backup creation
wundr computer-setup claude-config --skip-backup

# Verbose output
wundr computer-setup claude-config --verbose
```

### Manage Backups

```bash
# List all backups
wundr computer-setup backup --list

# Create manual backup
wundr computer-setup backup --create

# Verify backup integrity
wundr computer-setup backup --verify <backup-id>

# Clean up old backups (keeps 5 most recent)
wundr computer-setup backup --cleanup
```

### Rollback Configuration

```bash
# Rollback to latest backup
wundr computer-setup rollback

# Rollback to specific backup
wundr computer-setup rollback --backup <backup-id>

# Dry-run rollback
wundr computer-setup rollback --dry-run --verbose

# Rollback with detailed output
wundr computer-setup rollback --backup <backup-id> --verbose
```

## Directory Structure

After installation, your `~/.claude/` directory will have:

```
~/.claude/
├── CLAUDE.md                    # Enhanced configuration
├── conventions.json             # Code conventions
├── hooks/
│   ├── pre-commit              # Pre-commit hook
│   └── post-checkout           # Post-checkout hook
├── agents/
│   ├── backend-developer.json  # Backend agent template
│   ├── frontend-developer.json # Frontend agent template
│   └── fullstack-developer.json # Fullstack agent template
├── workflows/
│   ├── feature-development.json # Feature workflow
│   └── bug-fix.json            # Bug fix workflow
├── scripts/
│   ├── validate-setup.sh       # Validation script
│   └── check-config.sh         # Configuration check
└── templates/                   # Additional templates
```

## Installed Files

### CLAUDE.md

Enhanced configuration including:

- SPARC methodology guidelines
- MCP tools integration
- Concurrent execution patterns
- Agent coordination protocols
- Hooks integration
- Advanced features (v2.0.0)

### conventions.json

```json
{
  "fileNaming": {
    "components": "PascalCase",
    "utilities": "camelCase",
    "constants": "UPPER_SNAKE_CASE",
    "types": "PascalCase"
  },
  "codeStyle": {
    "indentation": 2,
    "quotes": "single",
    "semicolons": true,
    "trailingComma": "es5"
  },
  "imports": {
    "order": ["external", "internal", "parent", "sibling", "index"],
    "grouping": true
  },
  "testing": {
    "framework": "jest",
    "coverage": {
      "statements": 80,
      "branches": 80,
      "functions": 80,
      "lines": 80
    }
  },
  "git": {
    "commitMessage": "conventional-commits",
    "branchNaming": "feature/*, fix/*, chore/*"
  }
}
```

### Agent Templates

Each template includes:

- Name and role
- Responsibilities
- Required tools
- Development patterns

Example (Backend Developer):

```json
{
  "name": "Backend Developer",
  "role": "backend-dev",
  "responsibilities": [
    "Design RESTful and GraphQL APIs",
    "Implement database models and queries",
    "Create authentication and authorization",
    "Write comprehensive API documentation"
  ],
  "tools": ["node", "typescript", "postgresql", "redis"],
  "patterns": ["Controller-Service-Repository", "DTO pattern", "Middleware pattern"]
}
```

### Git-Worktree Workflows

Example (Feature Development):

```json
{
  "name": "Feature Development Workflow",
  "description": "Workflow for developing new features in isolation",
  "steps": [
    {
      "name": "Create worktree",
      "command": "git worktree add ../feature-name feature/name"
    },
    {
      "name": "Setup environment",
      "command": "cd ../feature-name && npm install"
    },
    {
      "name": "Run tests",
      "command": "npm test"
    },
    {
      "name": "Commit changes",
      "command": "git add . && git commit -m \"feat: description\""
    }
  ]
}
```

### Validation Scripts

#### validate-setup.sh

Checks for:

- Required files (CLAUDE.md, conventions.json)
- Required directories (hooks, agents, workflows)
- Proper permissions

#### check-config.sh

Verifies:

- Claude CLI installation
- Node.js version
- Git installation
- Required tools

## Usage Examples

### Complete Setup Workflow

```bash
# 1. Install Claude Code configuration
wundr computer-setup claude-config --verbose

# 2. Validate installation
~/.claude/scripts/validate-setup.sh

# 3. Check configuration
~/.claude/scripts/check-config.sh

# 4. List created backups
wundr computer-setup backup --list
```

### Updating Configuration

```bash
# 1. Current configuration is automatically backed up
wundr computer-setup claude-config --overwrite

# 2. If something goes wrong, rollback
wundr computer-setup rollback

# 3. Verify rollback
~/.claude/scripts/validate-setup.sh
```

### Backup Management

```bash
# Create manual backup before major changes
wundr computer-setup backup --create
# Enter: ~/.claude/CLAUDE.md,~/.claude/conventions.json

# Make changes...

# If needed, rollback to specific backup
wundr computer-setup backup --list
wundr computer-setup rollback --backup backup-2025-11-21T10-30-00-000Z

# Clean up old backups periodically
wundr computer-setup backup --cleanup
```

## Integration with Computer Setup

The Claude Code configuration installation integrates seamlessly with the main computer-setup
workflow:

```bash
# During interactive setup
wundr computer-setup

# You'll be prompted:
# "Do you want to set up AI development tools (Claude Code, Claude Flow)?"
# Answer: Yes

# This will:
# 1. Install Claude CLI
# 2. Install Claude Flow MCP tools
# 3. Run claude-config installer
# 4. Set up agent templates
# 5. Configure git-worktree workflows
# 6. Install validation scripts
```

## Customization

### Modifying Agent Templates

```bash
# Edit agent templates
vi ~/.claude/agents/backend-developer.json

# Add custom responsibilities, tools, or patterns
{
  "name": "Backend Developer",
  "role": "backend-dev",
  "responsibilities": [
    "Your custom responsibility"
  ],
  "tools": ["custom-tool"],
  "patterns": ["Custom pattern"]
}
```

### Creating Custom Workflows

```bash
# Create new workflow
vi ~/.claude/workflows/custom-workflow.json

{
  "name": "Custom Workflow",
  "description": "Your workflow description",
  "steps": [
    {
      "name": "Step 1",
      "command": "your-command"
    }
  ]
}
```

### Adding Hooks

```bash
# Create custom hook
vi ~/.claude/hooks/pre-push

#!/bin/bash
# Your custom pre-push hook
npm test
```

```bash
# Make executable
chmod +x ~/.claude/hooks/pre-push
```

## Troubleshooting

### Installation Issues

**Problem**: Installation fails with permission error

**Solution**:

```bash
# Ensure ~/.claude directory is writable
chmod -R u+w ~/.claude

# Or specify different directory
wundr computer-setup claude-config --claude-dir ~/custom-claude
```

**Problem**: CLAUDE.md not found in source

**Solution**:

```bash
# Ensure you're running from project root
cd /path/to/wundr
wundr computer-setup claude-config
```

### Backup Issues

**Problem**: Backup verification fails

**Solution**:

```bash
# List backups
wundr computer-setup backup --list

# Verify specific backup
wundr computer-setup backup --verify <backup-id>

# If corrupted, create new backup
wundr computer-setup backup --create
```

### Rollback Issues

**Problem**: Rollback doesn't restore files

**Solution**:

```bash
# Check backup integrity first
wundr computer-setup backup --verify <backup-id>

# Try dry-run to see what would be restored
wundr computer-setup rollback --backup <backup-id> --dry-run --verbose

# If backup is valid, try again
wundr computer-setup rollback --backup <backup-id> --verbose
```

## Best Practices

1. **Always backup before major changes**

   ```bash
   wundr computer-setup backup --create
   ```

2. **Test with dry-run first**

   ```bash
   wundr computer-setup claude-config --dry-run
   ```

3. **Verify after installation**

   ```bash
   ~/.claude/scripts/validate-setup.sh
   ```

4. **Keep backups clean**

   ```bash
   wundr computer-setup backup --cleanup
   ```

5. **Customize for your workflow**
   - Edit agent templates
   - Add custom workflows
   - Modify conventions

6. **Use version control for customizations**
   ```bash
   cd ~/.claude
   git init
   git add .
   git commit -m "Initial Claude Code configuration"
   ```

## Advanced Usage

### Scripted Installation

```bash
#!/bin/bash
# Automated Claude Code setup

# Install with overwrite
wundr computer-setup claude-config --overwrite --skip-backup

# Verify installation
if ~/.claude/scripts/validate-setup.sh; then
  echo "✅ Installation successful"
else
  echo "❌ Installation failed"
  exit 1
fi

# Check configuration
~/.claude/scripts/check-config.sh
```

### CI/CD Integration

```yaml
# .github/workflows/setup.yml
name: Setup Development Environment

on:
  workflow_dispatch:

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Wundr
        run: npm install -g @adapticai/wundr

      - name: Setup Claude Code
        run: |
          wundr computer-setup claude-config --skip-backup
          ~/.claude/scripts/validate-setup.sh
```

### Team Distribution

```bash
# Export your configuration
tar -czf claude-config.tar.gz -C ~/ .claude

# Team members can import
tar -xzf claude-config.tar.gz -C ~/

# Verify
~/.claude/scripts/validate-setup.sh
```

## API Reference

### BackupRollbackManager

```typescript
class BackupRollbackManager {
  constructor(backupDir?: string);

  async initialize(): Promise<void>;
  async createBackup(files: string[], reason: string): Promise<BackupMetadata>;
  async rollback(options: RollbackOptions): Promise<boolean>;
  async listBackups(): Promise<BackupMetadata[]>;
  async verifyBackup(backupId: string): Promise<boolean>;
  async cleanupOldBackups(retainCount: number): Promise<void>;
}
```

### ClaudeConfigInstaller

```typescript
class ClaudeConfigInstaller {
  constructor(options?: ClaudeConfigOptions);

  async initialize(): Promise<void>;
  async install(options?: ClaudeConfigOptions): Promise<InstallResult>;
}
```

## Support

For issues or questions:

- GitHub Issues: https://github.com/adapticai/wundr/issues
- Documentation: https://wundr.io/docs
- Community: https://wundr.io/community

## Contributing

Contributions welcome! See:

- [Contributing Guide](../CONTRIBUTING.md)
- [Development Setup](../docs/DEVELOPMENT.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
