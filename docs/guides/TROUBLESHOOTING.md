# Refactoring Troubleshooting Guide

## Common Issues and Solutions

### 1. Analysis Scripts Failing

#### Symptom: AST Analyzer Crashes

```
Error: Cannot read properties of undefined (reading 'getText')
```

**Solution:**

```bash
# Check for syntax errors in source files
npx tsc --noEmit

# Run analyzer with debug flag
DEBUG=true npx ts-node scripts/enhanced-ast-analyzer.ts

# Analyze specific directory only
npx ts-node scripts/enhanced-ast-analyzer.ts --dir src/services
```

#### Symptom: Out of Memory

```
FATAL ERROR: Reached heap limit Allocation failed
```

**Solution:**

```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=8192" npx ts-node scripts/enhanced-ast-analyzer.ts

# Process in smaller chunks
find src -name "*.ts" -type f | split -l 100 - chunks/chunk_
for chunk in chunks/chunk_*; do
  npx ts-node scripts/analyze-files.ts < "$chunk"
done
```

### 2. Consolidation Issues

#### Symptom: Import Not Found After Consolidation

```
Cannot find module '@company/core-types' or its corresponding type declarations
```

**Solution:**

```bash
# Rebuild TypeScript project references
pnpm run build --force

# Update tsconfig paths
# Check tsconfig.json for:
{
  "compilerOptions": {
    "paths": {
      "@company/*": ["packages/*/src", "packages/*/dist"]
    }
  }
}

# Clear cache and reinstall
rm -rf node_modules .turbo
pnpm install
```

#### Symptom: Circular Dependency After Moving Files

```
Error: Circular dependency detected: A -> B -> C -> A
```

**Solution:**

```typescript
// Option 1: Extract shared interface
// Before: user.service.ts imports from order.service.ts
// After: Both import from shared-types.ts

// Option 2: Dependency injection
export class UserService {
  private orderService?: OrderService;

  setOrderService(service: OrderService) {
    this.orderService = service;
  }
}

// Option 3: Event-based decoupling
export class UserService extends BaseService {
  onOrderCreated(orderId: string) {
    // Handle without direct import
  }
}
```

### 3. Type Errors After Refactoring

#### Symptom: Type Mismatch After Consolidation

```
Type 'User' is not assignable to type 'IUser'
```

**Solution:**

```typescript
// Add type assertion temporarily
const user = userData as unknown as User;

// Or create migration type
type LegacyUser = IUser;
type User = LegacyUser & {
  // new properties
};

// Update gradually
function migrateUser(legacy: LegacyUser): User {
  return {
    ...legacy,
    // add new properties with defaults
  };
}
```

#### Symptom: Generic Type Parameters Lost

```
Type 'Repository' requires 1 type argument
```

**Solution:**

```typescript
// Preserve generics during consolidation
// Bad:
export interface Repository {
  find(id: string): Promise<any>;
}

// Good:
export interface Repository<T> {
  find(id: string): Promise<T | null>;
}

// With default type:
export interface Repository<T = unknown> {
  find(id: string): Promise<T | null>;
}
```

### 4. Test Failures

#### Symptom: Mocking Fails After Standardization

```
Cannot spy on a class instance
```

**Solution:**

```typescript
// Update mocks to match new structure
// Before:
jest.mock('../services/UserService');

// After:
jest.mock('@company/services', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
    // ... other methods
  })),
}));

// Or use manual mocks
// packages/services/__mocks__/index.ts
export const UserService = jest.fn();
```

#### Symptom: Integration Tests Timeout

```
Timeout - Async callback was not invoked within 5000ms
```

**Solution:**

```typescript
// Increase timeout for complex tests
jest.setTimeout(10000);

// Or per test:
it('should complete complex operation', async () => {
  // test code
}, 10000);

// Check for missing await
// Bad:
it('should work', () => {
  service.asyncMethod(); // Missing await!
});

// Good:
it('should work', async () => {
  await service.asyncMethod();
});
```

### 5. Build and Bundle Issues

#### Symptom: Build Order Incorrect

```
error TS6305: Output file has not been built from source file
```

**Solution:**

```bash
# Check TypeScript project references
# Each package tsconfig.json should have:
{
  "references": [
    { "path": "../core-types" },
    { "path": "../utils" }
  ]
}

# Build in correct order
pnpm run build --filter @company/core-types
pnpm run build --filter @company/utils
pnpm run build --filter @company/services

# Or use Turborepo (automatic order)
pnpm turbo build
```

#### Symptom: Module Resolution Fails in Production

```
Error: Cannot find module '@company/services'
```

**Solution:**

```json
// Check package.json exports
{
  "name": "@company/services",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    }
  },
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts"
}
```

### 6. Performance Issues

#### Symptom: Slow TypeScript Compilation

```
Build takes > 5 minutes
```

**Solution:**

```bash
# Enable incremental compilation
# tsconfig.json:
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}

# Use project references
tsc --build --verbose

# Profile compilation
tsc --generateTrace trace
# Open in chrome://tracing

# Exclude unnecessary files
{
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/tests/**",
    "**/dist/**"
  ]
}
```

#### Symptom: Slow Test Execution

```
Test suites take > 10 minutes
```

**Solution:**

```bash
# Run tests in parallel
jest --maxWorkers=4

# Use test sharding
jest --shard=1/3
jest --shard=2/3
jest --shard=3/3

# Cache test results
jest --cache

# Only run affected tests
jest --findRelatedTests src/modified-file.ts
```

### 7. Git and Version Control Issues

#### Symptom: Massive Merge Conflicts

```
CONFLICT (content): Merge conflict in 247 files
```

**Solution:**

```bash
# Strategy 1: Rebase in smaller chunks
git rebase -i HEAD~10
# Mark some commits as 'edit' to resolve conflicts gradually

# Strategy 2: Use tooling to help
git config merge.tool vimdiff
git mergetool

# Strategy 3: Semantic conflict resolution
# For imports, always take refactored version
git checkout --theirs -- src/**/imports.ts

# For types, may need manual review
git checkout --ours -- packages/core-types/**
```

#### Symptom: Lost History After File Move

```
git log shows only 1 commit for moved file
```

**Solution:**

```bash
# Use --follow flag
git log --follow packages/core-types/src/user.ts

# View history including renames
git log --follow --find-renames=50% -- packages/core-types/src/user.ts

# Preserve history during move
git mv src/types/user.ts packages/core-types/src/user.ts
git commit -m "refactor: move user types to core package"
```

### 8. Monorepo-Specific Issues

#### Symptom: Package Not Found in Monorepo

```
pnpm: @company/utils@workspace:* is not found
```

**Solution:**

```bash
# Check workspace configuration
cat pnpm-workspace.yaml

# Ensure package.json exists in package directory
ls packages/utils/package.json

# Clear pnpm cache
pnpm store prune

# Reinstall
pnpm install --force
```

#### Symptom: Workspace Protocol Issues

```
Error: Unsupported URL Type "workspace:"
```

**Solution:**

```json
// For production builds, replace workspace protocol
// build script:
"scripts": {
  "prepublish": "node scripts/replace-workspace-protocol.js"
}

// Script content:
const pkg = require('./package.json');
for (const [dep, version] of Object.entries(pkg.dependencies)) {
  if (version.startsWith('workspace:')) {
    pkg.dependencies[dep] = require(`../${dep}/package.json`).version;
  }
}
```

## Prevention Strategies

### 1. Pre-flight Checks

```bash
#!/bin/bash
# scripts/preflight.sh

echo "Running pre-flight checks..."

# Check for syntax errors
if ! npx tsc --noEmit; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi

# Check for circular dependencies
if npx madge --circular src | grep -q "Found"; then
  echo "❌ Circular dependencies detected"
  exit 1
fi

# Check for large files
if find src -name "*.ts" -exec wc -l {} \; | awk '$1 > 300' | grep -q .; then
  echo "⚠️ Large files detected (>300 lines)"
fi

echo "✅ Pre-flight checks passed"
```

### 2. Automated Fixes

```typescript
// scripts/auto-fix.ts
import { Project } from 'ts-morph';

export async function autoFix() {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json',
  });

  // Auto-fix common issues
  for (const sourceFile of project.getSourceFiles()) {
    // Add missing imports
    const diagnostics = sourceFile.getPreEmitDiagnostics();
    for (const diagnostic of diagnostics) {
      if (diagnostic.getCode() === 2304) {
        // Cannot find name
        const identifier = diagnostic
          .getMessageText()
          .toString()
          .match(/'([^']+)'/)?.[1];
        if (identifier) {
          // Try to auto-import
          sourceFile.addImportDeclaration({
            namedImports: [identifier],
            moduleSpecifier: '@company/core-types',
          });
        }
      }
    }

    await sourceFile.save();
  }
}
```

### 3. Monitoring and Alerts

```yaml
# .github/workflows/drift-monitor.yml
name: Drift Monitor
on:
  schedule:
    - cron: '0 8 * * 1-5' # Weekdays at 8 AM

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run governance:check
      - if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Code Drift Detected',
              body: 'Automated monitoring detected code drift. Check the workflow run for details.',
              labels: ['technical-debt', 'urgent']
            });
```

## Getting Help

### Internal Resources

1. Check `docs/architecture/decisions/` for ADRs
2. Review `GOLDEN_STANDARDS.md` for patterns
3. Search closed PRs for similar refactors

### External Resources

1. [TypeScript Handbook](https://www.typescriptlang.org/docs/)
2. [ts-morph Documentation](https://ts-morph.com/)
3. [Turborepo Documentation](https://turbo.build/repo/docs)

### Escalation

If stuck for more than 2 hours:

1. Document the issue clearly
2. Create minimal reproduction
3. Post in #refactoring-help Slack channel
4. Tag @architecture-team if architectural
