# Wundr Monorepo Setup Guide

This document outlines the monorepo best practices and tooling implemented in the Wundr repository.

## Overview

The Wundr repository has been restructured to follow modern monorepo best practices with the following key improvements:

- **pnpm workspaces** for efficient package management
- **Shared configurations** for ESLint, Prettier, Jest, and TypeScript
- **Automated code quality** with pre-commit hooks
- **CI/CD pipeline** with GitHub Actions
- **Package scaffolding** with templates

## Project Structure

```
wundr/
├── packages/           # Core library packages
├── apps/              # Applications
├── tools/             # Development tools
├── config/            # Shared configurations
│   ├── eslint-config/
│   ├── prettier-config/
│   ├── jest-config/
│   └── typescript-config/
├── scripts/           # Build and utility scripts
├── templates/         # Package templates
└── pnpm-workspace.yaml
```

## Package Management

### Using pnpm Workspaces

The repository uses pnpm workspaces for managing multiple packages:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
  - 'config/*'
```

### Common Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run tests across all packages
pnpm test

# Run linting across all packages
pnpm lint

# Format code across all packages
pnpm format

# Type check all packages
pnpm typecheck

# Clean all build artifacts
pnpm clean
```

### Creating New Packages

Use the provided scaffolding tool to create new packages:

```bash
pnpm create:package
```

This will prompt you for:
- Package name
- Description
- Package type (library or application)

## Code Quality

### ESLint Configuration

All packages extend the shared ESLint configuration:

```json
{
  "eslintConfig": {
    "extends": "@wundr/eslint-config"
  }
}
```

### Prettier Configuration

All packages use the shared Prettier configuration:

```json
{
  "prettier": "@wundr/prettier-config"
}
```

### Pre-commit Hooks

Husky and lint-staged are configured to run quality checks before commits:

- ESLint fixes
- Prettier formatting
- TypeScript type checking

## Testing

### Shared Jest Configuration

All packages extend the base Jest configuration:

```javascript
const baseConfig = require('@wundr/jest-config');

module.exports = {
  ...baseConfig,
  displayName: 'package-name'
};
```

### Coverage Requirements

- Branches: 75%
- Functions: 75%
- Lines: 80%
- Statements: 80%

## TypeScript

### Shared Configuration

All packages extend the base TypeScript configuration:

```json
{
  "extends": "@wundr/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Path Mappings

The following path mappings are available:
- `@/*` → `src/*`
- `@config/*` → `config/*`
- `@tests/*` → `tests/*`

## CI/CD Pipeline

GitHub Actions workflow includes:

1. **Linting** - Checks code style
2. **Type Checking** - Validates TypeScript
3. **Testing** - Runs all tests with coverage
4. **Building** - Builds all packages
5. **Security Scanning** - Audits dependencies

## Package Template

New packages are created with:

- TypeScript configuration
- Jest setup
- ESLint and Prettier
- Build scripts
- README template

## Development Workflow

1. **Create a new package**: `pnpm create:package`
2. **Install dependencies**: `pnpm install`
3. **Write code** following the established patterns
4. **Run tests**: `pnpm test:watch`
5. **Check types**: `pnpm typecheck`
6. **Commit changes** (pre-commit hooks will run automatically)

## Best Practices

1. **Keep packages focused** - Each package should have a single, clear purpose
2. **Document exports** - All public APIs should be well-documented
3. **Write tests first** - Follow TDD practices
4. **Use shared configs** - Don't duplicate configuration
5. **Version carefully** - Follow semantic versioning

## Migration Guide

When migrating existing code to the monorepo structure:

1. Move code to appropriate package directory
2. Update imports to use workspace protocol
3. Add package.json extending shared configs
4. Update tests to use shared Jest config
5. Run full test suite to verify

## Troubleshooting

### Common Issues

**Issue**: Dependencies not resolving
**Solution**: Run `pnpm install` from the root directory

**Issue**: Type errors in IDE
**Solution**: Restart TypeScript service in your editor

**Issue**: Pre-commit hooks not running
**Solution**: Run `pnpm prepare` to reinstall hooks

## Next Steps

- Set up automated dependency updates with Renovate
- Implement changesets for coordinated releases
- Add package documentation generation
- Set up performance monitoring