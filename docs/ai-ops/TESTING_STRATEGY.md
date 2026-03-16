# Testing Strategy

## Purpose

Defines what "tested" means in the Wundr monorepo. Claude should reference this document to
determine appropriate testing for any change.

## Testing Hierarchy

### Unit Tests

Use for:

- Pure utility functions
- Data formatters and transformers
- Validation logic (Zod schemas, type guards)
- Domain helpers and calculations
- Individual agent behaviors

Framework: Jest (root and most packages), Vitest (Neolith packages)

### Integration Tests

Use for:

- Package-to-package interactions
- API handler logic
- Database queries (via Prisma)
- Agent orchestration workflows
- MCP tool handlers

Framework: Jest with integration config (`jest.config.integration.js`)

### End-to-End Tests

Use for:

- Critical user journeys in Neolith web app
- CLI command flows
- Full agent orchestration pipelines
- Deployment verification

Framework: Playwright (web), custom CLI test harness

### Performance Tests

Use for:

- Analysis engine on large codebases
- Agent orchestration latency
- Token budget accuracy
- Build pipeline timing

Location: `tests/performance/`

### Quality Gate Tests

Use for:

- Code quality governance rules
- Package export validation
- Dependency constraint verification

Location: `tests/quality-gates/`

## Running Tests

```bash
# All tests via Turborepo
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Performance tests
pnpm test:performance

# Quality gates
pnpm test:quality-gates

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# CI mode
pnpm test:ci
```

## Done Criteria

A task is not done until:

- Relevant unit tests pass
- Integration tests pass if cross-package behavior changed
- Critical E2E path is verified if UI changed
- No type errors introduced (`pnpm typecheck`)
- No lint regressions (`pnpm lint`)
- Build succeeds (`pnpm build`)

## When to Add Tests

Claude should add tests when:

- Adding new public API surface to a package
- Fixing a bug (regression test for the bug)
- Changing behavior of existing functions
- Adding validation or security logic

Claude may skip tests for:

- Pure configuration changes
- Documentation updates
- Dependency version bumps (rely on existing tests)
- Cosmetic UI changes (if covered by visual regression)
