# Web Client Troubleshooting Guide

## Common Issues and Solutions

### 1. Webpack Runtime Errors
**Error**: "Cannot read properties of undefined (reading 'call')"

**Solution**:
- Clear the Next.js cache: `rm -rf .next`
- Webpack cache has been disabled in `next.config.ts` to prevent this issue
- Restart the dev server

### 2. Missing Dependencies
**Error**: "Cannot find module 'tailwindcss-animate'"

**Solution**:
- Run `pnpm install` from the monorepo root
- All dependencies have been added to package.json

### 3. Package Manager Conflicts
**Warning**: "Found multiple lockfiles"

**Solution**:
- Use only `pnpm` for this monorepo
- Remove any `package-lock.json` files
- The `.npmrc` file enforces pnpm usage

### 4. Port Conflicts
**Warning**: "Port 3000 is in use"

**Solution**:
- The dev server will automatically use the next available port (3001)
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill -9`

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run tests
pnpm test
```

## Important Notes

1. Always run commands from `/tools/web-client` directory
2. Install dependencies from the monorepo root: `pnpm install`
3. The AnalysisProvider context is wrapped around the dashboard layout
4. Webpack cache is disabled to prevent runtime errors