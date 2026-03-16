# PR Checklist

## Purpose

Self-review gate for Claude before marking any task complete. Use this as a final verification even
when not literally creating a pull request.

## Before Marking Complete

- [ ] Request fully addressed (not partially, not over-engineered)
- [ ] Relevant docs consulted (ARCHITECTURE, SERVICE_BOUNDARIES, CONVENTIONS)
- [ ] Minimal blast radius maintained (only necessary files changed)
- [ ] No unrelated files modified
- [ ] Existing conventions followed (naming, structure, patterns)
- [ ] Build succeeds (`pnpm build`)
- [ ] TypeScript compiles cleanly (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] New tests added if behavior changed
- [ ] Edge cases considered
- [ ] No security vulnerabilities introduced
- [ ] No hardcoded secrets
- [ ] Package boundaries respected
- [ ] Review notes documented (if significant change)
- [ ] Lessons captured in `tasks/lessons.md` if mistakes occurred

## For Database Changes

- [ ] Migration created if schema changed
- [ ] Prisma client regenerated
- [ ] Backwards-compatible migration (no data loss)

## For UI Changes (Neolith)

- [ ] Responsive behavior verified
- [ ] Accessibility basics checked
- [ ] Server/client component boundary correct
- [ ] Shared components used from `@neolith/ui`

## For New Packages

- [ ] Registered in `pnpm-workspace.yaml`
- [ ] Follows `@wundr/` or `@neolith/` scoping convention
- [ ] Extends shared configuration (ESLint, TypeScript, etc.)
- [ ] Has `build`, `test`, and `lint` scripts
- [ ] Added to `turbo.json` pipeline if needed

## For Agent/Orchestration Changes

- [ ] Token budget impact assessed
- [ ] Agent boundaries maintained
- [ ] Memory management correct
- [ ] Prompt security not bypassed
