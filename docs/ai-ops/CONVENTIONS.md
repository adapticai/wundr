# Conventions

## Purpose

Defines naming, structural, and coding conventions for the Wundr monorepo. This prevents AI agents
from introducing inconsistent patterns.

## General Principles

- Prefer extension over duplication
- Reuse existing packages and utilities before creating new ones
- Keep business logic out of presentation components
- Avoid one-off patterns that diverge from established conventions
- Files should stay under 500 lines

## Naming

### Packages

- Scoped under `@wundr/` for platform packages
- Scoped under `@neolith/` for Neolith platform packages
- Scoped under `@genesis/` for Genesis sub-packages
- Use kebab-case for package names: `@wundr/agent-memory`

### Files

- TypeScript source: `camelCase.ts` or `kebab-case.ts` (follow existing pattern in package)
- React components: `PascalCase.tsx`
- Test files: `*.test.ts` or `*.spec.ts`
- Configuration: `kebab-case.config.ts`

### Code

- Components: `PascalCase`
- Hooks: `useX` (e.g., `useWorkspace`)
- Utility functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` only when genuinely constant
- Types/Interfaces: `PascalCase` (e.g., `AgentConfig`, `WorkspaceSettings`)
- Enums: `PascalCase` with `PascalCase` members

## TypeScript

- Use `strict: true` in tsconfig where supported
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `readonly` for immutable properties
- Prefer `unknown` over `any`; use type guards for narrowing
- Export types explicitly from package entry points

## React (Neolith)

- Prefer server components where appropriate (Next.js App Router)
- Use client components (`"use client"`) only when interactivity requires it
- Keep view components thin; extract logic into hooks or utilities
- Extract repeated patterns into `@neolith/ui` shared components
- Use Tailwind CSS for styling; follow existing spacing scale

## Forms

- Centralize validation using Zod schemas
- Use shared form primitives from `@neolith/ui`
- Do not duplicate validation logic between client and server

## Data Fetching (Neolith)

- Database access goes through `@neolith/database` Prisma client only
- Co-locate query logic with the feature that uses it
- Avoid ad hoc fetching in leaf components
- Respect existing cache/revalidation strategy

## Styling

- Use Tailwind CSS consistently
- Follow existing spacing scale and color tokens
- Avoid arbitrary values unless justified
- Use `class-variance-authority` (CVA) for component variants
- Use `tailwind-merge` for conditional class composition

## Testing

- Unit tests: `*.test.ts` co-located or in `tests/` directory
- Integration tests: `*.integration.test.ts`
- E2E tests: Playwright specs in dedicated test directories
- Use Jest for unit/integration, Vitest where configured, Playwright for E2E

## Git

- Conventional commit messages: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Branches from `master`
- Changesets for version management (`@changesets/cli`)
- Husky hooks enforce lint-staged on commit

## Imports

- Prefer workspace package imports over relative paths across packages
- Use path aliases where configured in `tsconfig.json`
- Group imports: external deps, then workspace deps, then relative imports
- No circular imports between packages
