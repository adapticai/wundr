# No Version Locking Policy

## 🚨 CRITICAL POLICY: Always Use Latest Stable Versions

This repository follows a **NO VERSION LOCKING** policy for all setup scripts and development tools. This policy ensures maximum compatibility and prevents version mismatch issues.

## Core Principle

**ALWAYS install the latest stable version of any tool, library, or dependency in setup scripts.**

## Why This Policy?

1. **Prevents NODE_MODULE_VERSION mismatches** - Native modules compiled against different Node versions
2. **Ensures compatibility** - Latest versions work with current environments
3. **Security** - Latest versions include security patches
4. **Features** - Access to newest features and improvements
5. **Simplicity** - No need to maintain version matrices

## Implementation Guidelines

### ✅ CORRECT Patterns

```bash
# Homebrew - use formula names without versions
brew install python          # NOT python@3.12
brew install postgresql       # NOT postgresql@16
brew install node            # NOT node@20

# npm/yarn/pnpm - install without version specs
npm install -g package-name   # NOT package-name@1.2.3
npm install -g claude-flow    # NOT claude-flow@alpha
npx package-name             # NOT npx package-name@version

# Node.js via NVM - use aliases
nvm install lts/*            # NOT nvm install 20
nvm install node             # Latest current version
nvm alias default lts/*      # NOT nvm alias default 20

# Docker - use rolling tags
FROM node:lts-alpine         # NOT FROM node:20-alpine
FROM python:latest          # NOT FROM python:3.12
FROM postgres:alpine        # NOT FROM postgres:16-alpine

# GitHub Actions - use main branch
uses: actions/checkout@main  # NOT actions/checkout@v4
uses: actions/setup-node@main # NOT actions/setup-node@v4

# Package.json - use caret ranges
"typescript": "^5.0.0"       # NOT "5.9.2"
"eslint": "^8.0.0"          # NOT "8.50.0"
```

### ❌ INCORRECT Patterns

```bash
# NEVER do this in setup scripts:
brew install python@3.12
npm install -g package@alpha
nvm install 20
FROM node:20-alpine
uses: actions/checkout@v4
"typescript": "5.9.2"
```

## Exceptions

Version locking IS appropriate ONLY in these specific cases:

### 1. Production Deployments
- `package-lock.json` for reproducible builds
- Docker images for production containers
- Tagged releases

### 2. Breaking Changes
- Temporary pin before major version migration
- Document reason and migration plan

### 3. Security Patches
- Pin to specific patched version temporarily
- Document CVE and update plan

### 4. Known Incompatibilities
- Document the incompatibility
- Create issue to track resolution
- Update as soon as compatible

## File-Specific Rules

### Setup Scripts (`/scripts/setup/*.sh`)
- **NEVER** hardcode versions
- Use `latest`, `lts/*`, or no version specification
- Let package managers resolve latest stable

### Docker Files
- Use `lts-alpine` or `latest` tags
- Never use specific version numbers
- Production images can be exceptions

### GitHub Actions
- Use `@main` branch references
- Avoid `@v1`, `@v2`, `@v3` tags
- Let actions auto-update

### Package.json
- Development packages: Use `^` (caret) ranges
- Production packages: Can use exact versions
- Global tools: Always latest

## Maintenance

### Regular Updates

```bash
# Check for updates
npm outdated -g
brew outdated
nvm ls-remote

# Update everything
npm update -g
brew upgrade
nvm install node --reinstall-packages-from=node
```

### Verification

```bash
# Verify no hardcoded versions
grep -r "@[0-9]\+\." scripts/
grep -r ":[0-9]\+\." Dockerfile*
grep -r "@v[0-9]\+" .github/
```

## Troubleshooting

### If Version Mismatches Occur

1. **Clear all caches**:
   ```bash
   npm cache clean --force
   rm -rf ~/.npm/_npx
   rm -rf node_modules
   ```

2. **Rebuild native modules**:
   ```bash
   npm rebuild
   ```

3. **Use fix script**:
   ```bash
   ./scripts/fix-node-modules.sh
   ```

## Enforcement

This policy is enforced through:

1. **Code reviews** - Reject PRs with hardcoded versions
2. **CI checks** - Automated version checking
3. **Pre-commit hooks** - Warn about version locks
4. **Documentation** - This policy document

## Examples of Changes Made

Based on this policy, the following changes were made:

- `python@3.12` → `python`
- `postgresql@16` → `postgresql`  
- `node:20-alpine` → `node:lts-alpine`
- `actions/checkout@v4` → `actions/checkout@main`
- `claude-flow@alpha` → `claude-flow`
- `nvm install 20` → `nvm install lts/*`

## Summary

**The golden rule: In setup scripts, ALWAYS use latest stable versions without version specifications.**

This ensures:
- Maximum compatibility
- Latest security patches
- Newest features
- Simplified maintenance
- No version conflicts

When in doubt, use latest!