# Wundr Monorepo Workspace Setup

## Package Manager

This monorepo uses **pnpm** as the package manager. Do not use npm or yarn.

## Running the Web Client

```bash
# From monorepo root
pnpm install

# Navigate to web-client
cd tools/web-client

# Start development server
pnpm dev
```

## Important Notes

1. **Always use pnpm** - The workspace is configured for pnpm
2. **Install from root** - Run `pnpm install` from the monorepo root
3. **Lockfile** - Only `pnpm-lock.yaml` should exist (no package-lock.json)

## Workspace Packages

- `/config/*` - Shared configuration packages
- `/tools/web-client` - Dashboard web application
- `/mcp-tools` - MCP integration tools
- `/packages/*` - Core packages (when created)
- `/apps/*` - Applications (when created)

## Common Issues

### Missing dependencies

Run `pnpm install` from the monorepo root, not individual packages.

### Multiple lockfiles warning

Remove any `package-lock.json` files and use only `pnpm-lock.yaml`.
