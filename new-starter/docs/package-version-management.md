# Package Version Management Guide

## Overview

This document outlines the changes made to resolve Node.js module version mismatches and provides best practices for package version management in this project.

## Problem Identified

The project was experiencing NODE_MODULE_VERSION mismatches, specifically:
- `better-sqlite3` compiled against NODE_MODULE_VERSION 127 (Node.js 22.x)
- Current environment requiring NODE_MODULE_VERSION 115 (Node.js 20.x)

Root causes:
1. Hardcoded package versions with `@alpha` tags
2. Inconsistent Node.js versions between development and runtime
3. Cached npx packages compiled against different Node.js versions

## Changes Made

### 1. Removed Version Pinning

All instances of `claude-flow@alpha` have been replaced with `claude-flow` (latest stable) in:
- `/scripts/setup/08-claude.sh`
- `/scripts/setup/03-node-tools.sh`
- `/fix-all-claude-flow.sh`
- `/CLAUDE.md`
- `/.claude/settings.json`
- `/docs/troubleshooting.md`

### 2. Updated NVM Installation

Changed NVM installation from hardcoded version to latest:
- **Before**: `https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh`
- **After**: `https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh`

### 3. Created Fix Script

Added `/scripts/fix-node-modules.sh` to:
- Clear all npm/npx caches
- Remove and reinstall packages with native dependencies
- Rebuild native modules
- Ensure consistent Node.js version

## Best Practices

### Package Installation

✅ **DO:**
```bash
# Install latest stable version
npm install -g package-name

# Use npx without version specification
npx package-name

# Update to latest
npm update -g package-name
```

❌ **DON'T:**
```bash
# Avoid hardcoding specific versions unless necessary
npm install -g package-name@alpha
npm install -g package-name@1.2.3

# Don't pin npx versions
npx package-name@alpha
```

### Version Management Strategy

1. **Production Dependencies**: Use exact versions in package.json for stability
2. **Development Tools**: Use latest stable versions without pinning
3. **Global Tools**: Always install latest unless specific version required
4. **Native Modules**: Rebuild when changing Node.js versions

### Node.js Version Consistency

Maintain consistency across environments:
```bash
# Use Node.js 20 LTS for best compatibility
nvm install 20
nvm use 20
nvm alias default 20
```

## Troubleshooting

### MODULE_VERSION Mismatch

If you encounter NODE_MODULE_VERSION errors:

1. **Quick Fix**:
   ```bash
   ./scripts/fix-node-modules.sh
   ```

2. **Manual Fix**:
   ```bash
   # Clear caches
   npm cache clean --force
   rm -rf ~/.npm/_npx
   
   # Reinstall with correct Node version
   nvm use 20
   npm rebuild
   ```

### Native Module Issues

For packages with native dependencies (like better-sqlite3):

```bash
# Force rebuild
npm rebuild better-sqlite3

# Or reinstall
npm uninstall better-sqlite3
npm install better-sqlite3
```

### Global Package Issues

If global packages fail:

```bash
# Clear global package
npm uninstall -g package-name

# Clear npm cache
npm cache clean --force

# Reinstall
npm install -g package-name
```

## Maintenance

### Regular Updates

Schedule regular updates to prevent version drift:

```bash
# Check outdated global packages
npm outdated -g

# Update all global packages
npm update -g

# Check local packages
npx npm-check-updates
```

### CI/CD Considerations

- Use Node.js 20 LTS in CI/CD pipelines
- Clear caches in CI builds when experiencing issues
- Use `npm ci` for reproducible builds
- Consider using lock files for production deployments

## Version Locking Exceptions

Some cases where version pinning IS appropriate:

1. **Production deployments**: Lock all dependencies
2. **Breaking changes**: Pin before major version updates
3. **Security patches**: Pin to specific patched versions
4. **Compatibility requirements**: When specific versions are required

## Monitoring

Track package health:

```bash
# Security audit
npm audit

# License check
npx license-checker

# Dependency tree
npm ls
```

## Summary

The key principle is to use latest stable versions for development tools while maintaining version control for production dependencies. This approach:

- Reduces module mismatch errors
- Ensures access to latest features and fixes
- Maintains production stability
- Simplifies maintenance

When in doubt, use latest stable versions and only pin when there's a specific requirement.