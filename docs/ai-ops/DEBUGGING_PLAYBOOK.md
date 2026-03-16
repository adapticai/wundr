# Debugging Playbook

## Purpose

Provides structured debugging procedures for common failure scenarios in the Wundr monorepo. Claude
should consult this before asking the user for debugging guidance.

## If the build fails

Check in order:

1. `pnpm build` output for the specific failing package
2. TypeScript errors: `pnpm typecheck`
3. Turborepo dependency graph: does the failing package depend on a package that hasn't built yet?
4. Check `turbo.json` for correct pipeline dependencies
5. Check `tsconfig.json` references and path mappings

Common causes:

- Missing or stale build output from a dependency package
- Circular dependency between packages
- TypeScript strict mode violations after dependency update
- Import path mismatch after package rename or restructure

Recovery:

```bash
pnpm clean && pnpm install && pnpm build
```

## If tests fail

Check in order:

1. Read the specific test failure output
2. Check if the test depends on build artifacts (run build first)
3. Check if the test requires environment variables (see `.env.example`)
4. Check if the test requires a running database
5. Check for stale Jest cache: `npx jest --clearCache`

Common causes:

- Missing build step before running tests
- Environment variables not set
- Database not running for integration tests
- Snapshot tests out of date
- Module resolution issues in monorepo

## If Neolith web app won't start

Check in order:

1. `@neolith/database` - Is Prisma client generated? (`pnpm db:push`)
2. Environment variables - Are all required vars in `.env`?
3. Port conflicts - Check `PORT_ALLOCATION.md` for assigned ports
4. Dependency builds - Have all `@neolith/*` packages been built?
5. Node modules - Try `pnpm install` to resolve missing deps

Common causes:

- Prisma client not generated after schema change
- Missing DATABASE_URL environment variable
- Port already in use by another service
- Stale node_modules after branch switch

## If a package import fails at runtime

Check in order:

1. Is the package listed in the consumer's `package.json`?
2. Has the package been built? (check for `dist/` directory)
3. Does the package's `main`/`exports` field point to the right file?
4. Is the import path correct (scoped name vs relative)?

Common causes:

- Package not built (missing `dist/`)
- Wrong `main` or `exports` field in package.json
- Circular dependency causing undefined imports
- Turborepo cache serving stale build output

## If CLI commands fail

Check in order:

1. Is `@wundr/cli` built? (`pnpm --filter @wundr/cli build`)
2. Are dependencies available? (`pnpm install`)
3. Check the specific command handler in `packages/@wundr/cli/src/`
4. Check for missing environment variables

## If agent orchestration hangs or fails

Check in order:

1. Token budget - Has the budget been exhausted?
2. Agent memory - Is the memory store accessible?
3. AI provider - Is the API key valid and the service up?
4. Timeout settings - Is the timeout too short for the task?
5. Orchestrator logs in `logs/` directory

Common causes:

- Expired or invalid API key
- Token budget exceeded
- Agent stuck in retry loop
- Memory store corruption

## If deployment fails (Railway/Netlify)

Check in order:

1. Build logs from the platform
2. Environment variables set correctly on the platform
3. `railway.json` or `netlify.toml` configuration
4. Docker configuration if using containerized deploy
5. Database migration status

Common causes:

- Missing environment variable on platform
- Build command incorrect in platform config
- Node version mismatch
- Database not provisioned or migrated

Recovery:

```bash
# Railway
railway logs
railway variables

# Netlify
netlify status
netlify build --dry
```

## If Turborepo caching causes issues

Symptoms: changes not reflected after build, stale test results

Fix:

```bash
# Clear Turborepo cache
pnpm turbo:clean

# Or manually
rm -rf .turbo/cache node_modules/.cache
pnpm build
```

## If pnpm workspace resolution fails

Symptoms: "Cannot find module" for workspace packages

Check:

1. Package is listed in `pnpm-workspace.yaml`
2. Package name matches exactly in both `package.json` files
3. Version specifier is `workspace:*` for internal deps

Fix:

```bash
pnpm install --force
```
