# 22 - CI/CD Pipeline and TypeScript Strict Mode Migration

## Status: DESIGN COMPLETE

## 1. Executive Summary

The Wundr monorepo has an extensive collection of GitHub Actions workflows (24 files) built
incrementally over time. Many overlap in responsibilities, contain syntax errors (double-quoted
PNPM_VERSION strings), reference outdated branch names (`master` vs `main`), and use deprecated
actions. This design consolidates the CI/CD pipeline into a single canonical `ci.yml` workflow with
clear separation of concerns, and defines a phased TypeScript strict mode migration plan across all
15 packages.

## 2. Current State Audit

### 2.1 Existing Workflow Inventory

| Workflow File                | Purpose                           | Issues                                                                           |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `ci.yml`                     | Basic CI                          | Targets `master`, YAML syntax error (`"8.15.1""`), uses old pnpm/action-setup@v2 |
| `ci-modern.yml`              | Advanced CI with change detection | Same PNPM_VERSION typo, 9-node test matrix (3 OS x 3 Node) is excessive          |
| `cd.yml`                     | Continuous Deployment             | Targets `master`, hardcoded kubectl versions                                     |
| `enterprise-ci.yml`          | Enterprise CI pipeline            | YAML indentation error on `run_install: false`, emoji-heavy                      |
| `release.yml`                | Release pipeline                  | PNPM_VERSION typo (`"8.15.1"'`), uses deprecated `actions/create-release@v1`     |
| `security.yml`               | Security scans                    | 7 scan jobs with significant overlap, daily schedule may be excessive            |
| `build.yml`                  | Build validation                  | Redundant with ci.yml                                                            |
| `build-validation.yml`       | Build checks                      | Redundant with ci.yml                                                            |
| `test.yml`                   | Test suite                        | Redundant with ci.yml                                                            |
| `test-suite.yml`             | Extended tests                    | Redundant with ci.yml                                                            |
| `deploy.yml`                 | Deployment                        | Overlaps with cd.yml                                                             |
| `npm-publish.yml`            | NPM publishing                    | Overlaps with release.yml                                                        |
| `npm-publish-auto.yml`       | Auto NPM publishing               | Overlaps with release.yml                                                        |
| `enterprise-release.yml`     | Enterprise release                | Overlaps with release.yml                                                        |
| `dependencies.yml`           | Dependency checks                 | Overlaps with dependency-update.yml                                              |
| `dependency-update.yml`      | Dependency updates                | Weekly schedule                                                                  |
| `drift-detection.yml`        | Config drift                      | Unclear scope                                                                    |
| `monitoring.yml`             | Monitoring                        | Unclear scope                                                                    |
| `performance-monitoring.yml` | Perf monitoring                   | Overlaps with enterprise-ci benchmarks                                           |
| `refactor-check.yml`         | Refactoring validation            | Niche use case                                                                   |
| `weekly-report.yml`          | Weekly reports                    | Low priority                                                                     |
| `branch-protection.yml`      | Branch protection                 | Should be repo settings, not workflow                                            |

**Key problems identified:**

1. **24 workflow files** with massive duplication -- a maintenance burden
2. **Syntax errors** in PNPM_VERSION across 4+ workflows (double quotes)
3. **Branch inconsistency**: some target `master`, some `main`, some both
4. **Deprecated actions**: `actions/create-release@v1`, `pnpm/action-setup@v2`
5. **No turbo remote cache** in most workflows (TURBO_TOKEN only in enterprise-ci)
6. **No coverage threshold enforcement** -- the 80% gate is aspirational, not enforced
7. **Excessive matrix builds**: 3 OS x 3 Node versions = 9 jobs for basic CI

### 2.2 TypeScript Strict Mode Audit

| Package                                | `strict` | `strictNullChecks` | `strictFunctionTypes` | `strictPropertyInitialization` | `noImplicitAny` | `noImplicitReturns` | Extends                                |
| -------------------------------------- | -------- | ------------------ | --------------------- | ------------------------------ | --------------- | ------------------- | -------------------------------------- |
| `config/typescript/tsconfig.base.json` | `true`   | `true`             | `true`                | `true`                         | `true`          | `true`              | - (canonical base)                     |
| `@wundr/core`                          | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone                             |
| `@wundr/config`                        | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone                             |
| `@wundr/dashboard`                     | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone (Next.js)                   |
| `@wundr/environment`                   | -        | -                  | -                     | -                              | -               | -                   | `tsconfig.base.json` (strict via base) |
| `@wundr/plugin-system`                 | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone                             |
| `@wundr/security`                      | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone                             |
| `@wundr/computer-setup`                | -        | `false` (override) | -                     | `false` (override)             | -               | -                   | root `tsconfig.json` (`strict: false`) |
| `@wundr/docs`                          | `false`  | -                  | -                     | -                              | -               | -                   | standalone                             |
| `packages/analysis-engine`             | -        | -                  | -                     | -                              | -               | -                   | `tsconfig.base.json` (strict via base) |
| `packages/cli`                         | -        | -                  | -                     | -                              | -               | -                   | root `tsconfig.base.json`              |
| `packages/core`                        | -        | -                  | -                     | -                              | -               | -                   | root `tsconfig.json` (`strict: false`) |
| `packages/shared-config`               | -        | -                  | -                     | -                              | -               | -                   | root `tsconfig.json` (`strict: false`) |
| `packages/web-client`                  | -        | -                  | -                     | -                              | -               | -                   | `tsconfig.base.json` (strict via base) |
| `tools/web-client`                     | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone (Next.js)                   |
| `tests/`                               | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | `tsconfig.base.json`                   |
| `tsconfig.dev.json` (root)             | `false`  | -                  | -                     | -                              | -               | -                   | standalone                             |
| `tsconfig.integration.json`            | `true`   | (via strict)       | (via strict)          | (via strict)                   | (via strict)    | -                   | standalone                             |

**Inheritance chain summary:**

- `config/typescript/tsconfig.base.json` -- fully strict, the gold standard
- Root `tsconfig.json` (missing) / `tsconfig.dev.json` -- `strict: false`, the problem
- Several packages extend the non-strict root, inheriting `strict: false`

**Packages requiring migration (strict: false or missing strict flags):**

1. `@wundr/computer-setup` -- explicitly overrides `strictNullChecks: false`,
   `strictPropertyInitialization: false`
2. `@wundr/docs` -- `strict: false`
3. `packages/core` -- extends root tsconfig (strict: false)
4. `packages/shared-config` -- extends root tsconfig (strict: false)
5. `packages/cli` -- extends root tsconfig.base.json (ambiguous -- needs verification)
6. Root `tsconfig.dev.json` -- `strict: false`

**Packages already strict:**

- `@wundr/core`, `@wundr/config`, `@wundr/dashboard`, `@wundr/plugin-system`, `@wundr/security`
- `@wundr/environment`, `packages/analysis-engine`, `packages/web-client` (via tsconfig.base.json)
- `tools/web-client`, `tests/`

## 3. CI/CD Pipeline Design

### 3.1 Architecture: Consolidated Pipeline

Replace the 24 overlapping workflows with a focused set:

| Workflow     | File           | Trigger                          | Purpose                                |
| ------------ | -------------- | -------------------------------- | -------------------------------------- |
| **CI**       | `ci.yml`       | push (main/develop), PR          | Lint, typecheck, test, build, coverage |
| **Release**  | `release.yml`  | Keep existing (fix bugs)         | Version, changelog, publish            |
| **CD**       | `cd.yml`       | Keep existing (fix bugs)         | Deploy staging/production              |
| **Security** | `security.yml` | Keep existing (reduce to weekly) | CodeQL, Trivy, license checks          |

All other workflows are candidates for archival or deletion.

### 3.2 New CI Workflow Design

```
Trigger: push(main, develop) + pull_request(main, develop)
Concurrency: cancel-in-progress per branch

Job DAG:
  install -----> lint ---------> build
      |                           |
      +--------> typecheck ------+
      |                           |
      +--------> test:unit ------+-> coverage-gate
      |                               |
      +--------> test:integration ----+
      |
      +--------> security-audit

All jobs share:
  - pnpm cache (via actions/setup-node cache)
  - Turbo remote cache (TURBO_TOKEN + TURBO_TEAM)
  - Node 20 only (Node 18 tested weekly, not per-PR)
```

### 3.3 Key Design Decisions

**1. Single OS, single Node version for PRs.** The 3x3 matrix (9 jobs) in ci-modern.yml wastes
minutes. Cross-OS bugs are rare for a Node.js/TypeScript monorepo. Run ubuntu-latest + Node 20 for
all PRs. Reserve multi-OS testing for weekly scheduled runs.

**2. Turbo remote cache on every run.** Pass `TURBO_TOKEN` and `TURBO_TEAM` as environment variables
so incremental builds skip unchanged packages. This is the single biggest speed improvement.

**3. Coverage threshold as a hard gate.** Use `--coverage.thresholds.lines 80` (vitest) or a custom
check to fail CI when coverage drops below 80%. The existing workflows upload coverage but never
enforce it.

**4. pnpm version from packageManager field.** Read `packageManager` from `package.json` instead of
hardcoding `PNPM_VERSION`. The current hardcoded `8.15.1` is stale -- the repo declares
`pnpm@10.23.0`.

**5. Dependency caching strategy.**

- pnpm store: cached by `actions/setup-node` with `cache: 'pnpm'`
- Turbo cache: remote cache with signature verification
- No manual `actions/cache` needed -- the built-in caching is sufficient

### 3.4 Coverage Reporting

```yaml
# Coverage gate approach
- name: Enforce coverage threshold
  run: |
    COVERAGE=$(jq '.total.lines.pct' coverage/coverage-summary.json)
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "::error::Coverage $COVERAGE% is below 80% threshold"
      exit 1
    fi
```

### 3.5 PR Checks (Required Status Checks)

Configure these as required status checks in GitHub branch protection:

| Check Name         | Required | Description                    |
| ------------------ | -------- | ------------------------------ |
| `lint`             | Yes      | ESLint + Prettier format check |
| `typecheck`        | Yes      | tsc --noEmit                   |
| `test-unit`        | Yes      | Vitest unit tests              |
| `test-integration` | Yes      | Integration test suite         |
| `security-audit`   | Yes      | npm audit (high/critical)      |
| `build`            | Yes      | turbo build succeeds           |
| `coverage-gate`    | Yes      | >= 80% line coverage           |

### 3.6 Release Pipeline Fixes

The existing `release.yml` needs:

1. Fix PNPM_VERSION syntax error (`"8.15.1"'` -> `"10.23.0"`)
2. Replace deprecated `actions/create-release@v1` with `softprops/action-gh-release@v2`
3. Use `pnpm/action-setup@v4` (not v2)
4. Consider migrating to Changesets (`@changesets/cli` is already a devDependency)

## 4. TypeScript Strict Mode Migration Plan

### 4.1 Migration Strategy

**Approach: Incremental per-package, flag-by-flag.**

Rather than enabling `strict: true` all at once (which enables 7 sub-flags simultaneously), enable
flags one at a time per package. This keeps PR sizes manageable and allows CI to catch regressions.

**Flag enablement order (least to most disruptive):**

1. `strictBindCallApply` -- rarely triggers errors
2. `strictFunctionTypes` -- catches contravariance bugs, moderate error count
3. `noImplicitReturns` -- forces explicit returns, usually quick fixes
4. `noImplicitAny` -- biggest batch of errors, but most valuable
5. `strictNullChecks` -- most impactful, requires careful null/undefined handling
6. `strictPropertyInitialization` -- requires constructor/definite assignment fixes

### 4.2 Package Migration Order

**Wave 1: Low-risk, small packages (Week 1-2)**

| Package                  | Estimated Errors | Rationale                           |
| ------------------------ | ---------------- | ----------------------------------- |
| `packages/shared-config` | ~5-10            | Small config package, few files     |
| `packages/core` (legacy) | ~10-20           | Small, likely just type annotations |
| Root `tsconfig.dev.json` | ~0               | Development config, not compiled    |

**Wave 2: Medium-risk packages (Week 3-4)**

| Package        | Estimated Errors | Rationale                            |
| -------------- | ---------------- | ------------------------------------ |
| `@wundr/docs`  | ~15-25           | Docusaurus, mostly generated types   |
| `packages/cli` | ~20-40           | CLI package, well-defined boundaries |

**Wave 3: High-risk packages (Week 5-8)**

| Package                 | Estimated Errors | Rationale                                                     |
| ----------------------- | ---------------- | ------------------------------------------------------------- |
| `@wundr/computer-setup` | ~30-60           | Explicitly disabled strictNullChecks, needs careful attention |

### 4.3 Migration Technique per Package

For each package, create a separate PR per flag:

```
PR 1: feat(@wundr/computer-setup): enable strictBindCallApply
PR 2: feat(@wundr/computer-setup): enable strictFunctionTypes
PR 3: feat(@wundr/computer-setup): enable noImplicitReturns
PR 4: feat(@wundr/computer-setup): enable noImplicitAny
PR 5: feat(@wundr/computer-setup): enable strictNullChecks
PR 6: feat(@wundr/computer-setup): enable strictPropertyInitialization
PR 7: feat(@wundr/computer-setup): enable strict: true (umbrella)
```

### 4.4 Common Fix Patterns

**`noImplicitAny` fixes:**

```typescript
// Before
function process(data) { ... }
// After
function process(data: ProcessInput): ProcessOutput { ... }
```

**`strictNullChecks` fixes:**

```typescript
// Before
const user = getUser(); // User | undefined
console.log(user.name); // Error: possibly undefined

// After (option A: guard)
const user = getUser();
if (!user) throw new Error('User not found');
console.log(user.name);

// After (option B: optional chaining)
const user = getUser();
console.log(user?.name ?? 'Unknown');
```

**`strictPropertyInitialization` fixes:**

```typescript
// Before
class Service {
  private db: Database; // Error: not definitely assigned
}

// After (option A: definite assignment)
class Service {
  private db!: Database; // Assigned in init()
}

// After (option B: constructor)
class Service {
  constructor(private db: Database) {}
}
```

### 4.5 Strict Mode Config: `tsconfig.strict.json`

Create a shared strict base that all packages will eventually extend:

```json
{
  "extends": "./config/typescript/tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "exactOptionalPropertyTypes": false,
    "noPropertyAccessFromIndexSignature": false
  }
}
```

Note: `config/typescript/tsconfig.base.json` already has all these flags enabled. The migration is
really about ensuring all packages actually extend it (or set the flags themselves) rather than
extending the non-strict root tsconfig.

### 4.6 CI Enforcement

Add a typecheck job to CI that validates strict mode compliance:

```yaml
- name: Typecheck (strict mode)
  run: pnpm turbo typecheck
```

For packages in migration, use a `tsconfig.strict-check.json` that enables the next target flag, run
`tsc --noEmit --project tsconfig.strict-check.json`, and report errors as warnings (not blockers)
until the migration PR lands.

## 5. Implementation: New CI Workflow

See `/Users/ravi/wundr/.github/workflows/ci.yml` for the implemented workflow.

### 5.1 Workflow Highlights

- **7 focused jobs**: install, lint, typecheck, test-unit, test-integration, security-audit, build
- **Coverage gate**: Enforces 80% line coverage minimum
- **Turbo remote cache**: Configured via TURBO_TOKEN and TURBO_TEAM secrets
- **pnpm caching**: Uses actions/setup-node built-in cache
- **Concurrency control**: Cancels in-progress runs on the same branch
- **PR status summary**: Aggregated job summary posted to PR
- **Single OS/Node**: ubuntu-latest + Node 20 for speed

### 5.2 Estimated CI Runtime

| Job              | Estimated Duration | Notes                        |
| ---------------- | ------------------ | ---------------------------- |
| lint             | 2-4 min            | Turbo-cached after first run |
| typecheck        | 3-5 min            | Turbo-cached, tsc --noEmit   |
| test-unit        | 3-6 min            | Vitest/Jest with coverage    |
| test-integration | 4-8 min            | Longer-running tests         |
| security-audit   | 1-2 min            | pnpm audit + license check   |
| build            | 3-7 min            | Turbo-cached build           |
| coverage-gate    | < 1 min            | JSON threshold check         |

**Total wall-clock time (parallel): ~8-12 minutes** (vs current ~25-40 minutes with 9-matrix)

## 6. Migration: TypeScript Strict Mode Config

See `/Users/ravi/wundr/tsconfig.strict-migration.json` for the base strict config.

This file serves as documentation and a migration target. Packages that currently extend the
non-strict root should be migrated to extend `config/typescript/tsconfig.base.json` (which is
already fully strict) or set the equivalent flags directly.

## 7. Risk Assessment

| Risk                                              | Impact | Mitigation                                                                    |
| ------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Strict mode reveals many errors in computer-setup | High   | Migrate flag-by-flag, suppress with `// @ts-expect-error` for known tech debt |
| CI becomes a bottleneck on PRs                    | Medium | Turbo remote cache, single-OS/Node matrix, concurrency cancellation           |
| Existing workflows break when replaced            | Low    | Keep old workflows during transition, use `workflow_dispatch` for testing     |
| Coverage threshold too aggressive                 | Medium | Start at 70%, ratchet up to 80% over 4 sprints                                |

## 8. Success Criteria

1. **CI speed**: PR pipeline completes in under 12 minutes
2. **Coverage enforcement**: No PR merges below 80% line coverage
3. **Strict mode coverage**: All packages pass `strict: true` typecheck within 8 weeks
4. **Zero syntax errors**: All workflow YAML files pass `actionlint` validation
5. **Single source of truth**: PR checks reference exactly one CI workflow

## 9. Open Questions

1. Should we keep the multi-OS matrix as a weekly scheduled job?
2. Is the 80% coverage threshold appropriate, or should we start lower and ratchet?
3. Should changesets replace the custom release.yml changelog generation?
4. Do we want to add `exactOptionalPropertyTypes` as a stretch goal?

## 10. Files Created/Modified

| File                                         | Action   | Description                  |
| -------------------------------------------- | -------- | ---------------------------- |
| `.claude/analysis/wave2/22-cicd-pipeline.md` | Created  | This design document         |
| `.github/workflows/ci.yml`                   | Replaced | Consolidated CI workflow     |
| `tsconfig.strict-migration.json`             | Created  | Strict mode migration config |
