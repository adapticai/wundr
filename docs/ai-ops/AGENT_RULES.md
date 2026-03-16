# Agent Rules

## Purpose

Defines rules that AI agents must follow when contributing code to the Wundr repository.

## Coding Standards

Claude must:

- Use TypeScript with strict mode where the package supports it
- Avoid `any` types; use proper generics or `unknown` with type guards
- Maintain consistent naming conventions across packages
- Follow existing code style within each package
- Run linters when available (`pnpm run lint`)

## Error Handling

All external calls (API, file system, database, AI providers) must include:

- Proper error types (not bare `catch(e)`)
- Meaningful error messages with context
- Graceful degradation where appropriate

Avoid silent failures. If an operation can fail, handle it explicitly.

## Logging

Logs should be:

- Structured (key-value or JSON where the package uses it)
- Meaningful (describe what happened, not just that something happened)
- Minimal (avoid excessive debug logging in production paths)

## Performance Rules

Claude should avoid:

- N+1 queries in database access
- Unbounded loops or recursion
- Synchronous blocking operations in async contexts
- Loading entire files into memory when streaming is available

Prefer:

- Batching operations
- Streaming large data
- Async/await patterns
- Turborepo caching for build performance

## Security Rules

Claude must not introduce:

- Hardcoded secrets, API keys, or credentials
- Unsanitized user input in prompts (prompt injection risk)
- Insecure authentication or authorization logic
- Unvalidated external data in SQL, shell commands, or templates

All user-facing inputs must be validated. Use Zod schemas from `@wundr/structured-output` where
applicable.

## Dependency Rules

Claude should:

- Reuse existing workspace packages before adding external dependencies
- Check if a needed utility already exists in `@wundr/core` or `packages/shared-config`
- Avoid introducing new dependencies without justification
- Prefer workspace dependencies (`workspace:*`) for internal packages
- Check bundle size impact for frontend-facing packages

## Monorepo Rules

- New packages must be registered in `pnpm-workspace.yaml`
- Package names must follow scoping convention (`@wundr/` or `@neolith/`)
- Shared configuration must extend from shared-config packages
- Build order is managed by Turborepo; respect `turbo.json` pipeline definitions
- Do not add root-level dependencies that should be package-scoped

## Change Safety

Before modifying code, Claude should consider:

- Impact radius (which packages and downstream consumers are affected?)
- Backwards compatibility (does this break existing API contracts?)
- Migration requirements (does this need a database migration?)
- Build pipeline impact (does this change affect Turborepo caching?)

## File Organization

- Source code belongs in `src/` within each package
- Tests belong in `tests/` or `__tests__/` within each package
- Configuration belongs in the package root or `config/`
- Documentation belongs in `docs/` (not the root directory)
- Never save working files to the monorepo root
