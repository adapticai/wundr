# Computer Setup - Quick Reference Card

## 🚀 Quick Start

```bash
# Install everything
wundr computer-setup claude-config

# Validate installation
~/.claude/scripts/validate-setup.sh

# Check configuration
~/.claude/scripts/check-config.sh
```

## 📋 Common Commands

### Installation

```bash
# Dry-run to preview
wundr computer-setup claude-config --dry-run

# Install with overwrite
wundr computer-setup claude-config --overwrite

# Install without backup
wundr computer-setup claude-config --skip-backup

# Verbose output
wundr computer-setup claude-config --verbose
```

### Backup Management

```bash
# List all backups
wundr computer-setup backup --list

# Create manual backup
wundr computer-setup backup --create

# Verify backup
wundr computer-setup backup --verify <backup-id>

# Clean old backups
wundr computer-setup backup --cleanup
```

### Rollback

```bash
# Rollback to latest
wundr computer-setup rollback

# Rollback to specific backup
wundr computer-setup rollback --backup <backup-id>

# Dry-run rollback
wundr computer-setup rollback --dry-run --verbose
```

## 📁 Installed Files

```
~/.claude/
├── CLAUDE.md                      # Main configuration
├── conventions.json               # Code conventions
├── hooks/
│   ├── pre-commit                # Pre-commit hook
│   └── post-checkout             # Post-checkout hook
├── agents/
│   ├── backend-developer.json    # Backend template
│   ├── frontend-developer.json   # Frontend template
│   └── fullstack-developer.json  # Fullstack template
├── workflows/
│   ├── feature-development.json  # Feature workflow
│   └── bug-fix.json             # Bug fix workflow
└── scripts/
    ├── validate-setup.sh         # Validation script
    └── check-config.sh           # Config check script
```

## 🔧 Customization

### Edit Agent Templates

```bash
vi ~/.claude/agents/backend-developer.json
```

### Add Custom Workflow

```bash
vi ~/.claude/workflows/my-workflow.json
```

### Modify Conventions

```bash
vi ~/.claude/conventions.json
```

### Create Custom Hook

```bash
vi ~/.claude/hooks/pre-push
chmod +x ~/.claude/hooks/pre-push
```

## ⚠️ Troubleshooting

### Installation Failed

```bash
# Check permissions
chmod -R u+w ~/.claude

# Retry with verbose
wundr computer-setup claude-config --verbose
```

### Rollback Not Working

```bash
# Verify backup first
wundr computer-setup backup --verify <backup-id>

# Try specific backup
wundr computer-setup rollback --backup <backup-id> --verbose
```

### Validation Failed

```bash
# Reinstall missing components
wundr computer-setup claude-config --overwrite

# Run validation again
~/.claude/scripts/validate-setup.sh
```

## 🎯 Best Practices

1. **Always backup before changes**

   ```bash
   wundr computer-setup backup --create
   ```

2. **Test with dry-run**

   ```bash
   wundr computer-setup claude-config --dry-run
   ```

3. **Validate after install**

   ```bash
   ~/.claude/scripts/validate-setup.sh
   ```

4. **Clean old backups**

   ```bash
   wundr computer-setup backup --cleanup
   ```

5. **Version control customizations**
   ```bash
   cd ~/.claude && git init && git add . && git commit -m "Initial"
   ```

## 📊 Directory Structure

### Main Configuration

- `~/.claude/` - Claude Code configurations
- `~/.wundr/backups/` - Backup storage

### Backups

- `~/.wundr/backups/metadata.json` - Backup metadata
- `~/.wundr/backups/backup-<timestamp>/` - Backup files

## 🔑 Key Features

✅ Automated CLAUDE.md installation ✅ Pre-configured hooks ✅ Code conventions ✅ Agent templates
✅ Git-worktree workflows ✅ Validation scripts ✅ Backup/rollback system ✅ Dry-run support ✅
Overwrite protection

## 📖 More Information

- Full Guide: `/docs/COMPUTER_SETUP_CLAUDE_CONFIG.md`
- Implementation: `/docs/IMPLEMENTATION_SUMMARY_COMPUTER_SETUP.md`
- Support: https://github.com/adapticai/wundr/issues

---

**Quick Help**: `wundr computer-setup --help`
