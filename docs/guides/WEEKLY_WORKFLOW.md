# Weekly Refactoring Workflow

## Monday: Analysis & Planning

### Morning (2 hours)
1. **Run Fresh Analysis**
   ```bash
   # Pull latest changes
   git checkout refactor/monorepo
   git pull origin refactor/monorepo
   git merge origin/main  # Incorporate hotfixes

   # Run comprehensive analysis
   ./scripts/analyze-all.sh .
   ```

2. **Review Dashboard**
   - Open `analysis-output/[timestamp]/dashboard.html`
   - Note critical issues count
   - Check trend vs last week

3. **Compare with Previous Week**
   ```bash
   ./scripts/governance-system.ts check
   ```

### Afternoon (2 hours)
1. **Prioritize Work**
   - Review consolidation batches
   - Select 3-5 batches for the week
   - Assign to team members

2. **Team Sync Meeting**
   - Share analysis results
   - Discuss priorities
   - Assign batches

## Tuesday-Thursday: Execution

### Daily Routine
1. **Morning Standup (15 min)**
   - Progress on assigned batches
   - Blockers
   - Need for AI assistance?

2. **Consolidation Work**
   ```bash
   # Process assigned batch
   npx ts-node scripts/consolidation-manager.ts process batch-001.json

   # If using AI assistance
   npx ts-node scripts/ai-merge-helper.ts generate batch-001.json
   ```

3. **Testing After Each Change**
   ```bash
   # Run affected tests
   pnpm test -- --findRelatedTests src/modified-file.ts

   # Run type checking
   pnpm type-check

   # Check for circular dependencies
   npx ts-node scripts/check-dependencies.ts
   ```

4. **Commit Practices**
   ```bash
   # Use conventional commits
   git commit -m "refactor(types): consolidate User interfaces

   - Merged IUser, UserInterface, and UserType into single User interface
   - Updated 47 import statements
   - No breaking changes"
   ```

### End of Day
1. **Update Progress**
   ```bash
   npx ts-node scripts/consolidation-manager.ts status
   ```

2. **Push Changes**
   ```bash
   git push origin refactor/monorepo
   ```

## Friday: Review & Report

### Morning (2 hours)
1. **Generate Progress Report**
   ```bash
   # Re-run analysis to measure improvement
   ./scripts/analyze-all.sh .

   # Generate weekly report
   ./scripts/governance-system.ts weekly-report
   ```

2. **Review Metrics**
   - Duplicates eliminated
   - Dead code removed
   - Test coverage change
   - Build time improvement

### Afternoon (2 hours)
1. **Team Retrospective**
   - What went well?
   - What was challenging?
   - Process improvements?

2. **Prepare for Next Week**
   - Update consolidation batches
   - Document learnings
   - Plan next priorities

## Key Performance Indicators (KPIs)

### Weekly Targets
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Duplicate Reduction | -20% | `analysis-report.json` → `summary.duplicateClusters` |
| Unused Exports | -50% | `analysis-report.json` → `summary.unusedExports` |
| Test Coverage | +5% | `pnpm test:coverage` |
| Type Safety | 100% | `pnpm type-check` (0 errors) |
| Circular Dependencies | 0 | `circular-deps.json` |

### Progress Tracking
```bash
# Create weekly snapshot
mkdir -p progress/week-$(date +%U)
cp analysis-output/latest/*.json progress/week-$(date +%U)/

# Generate trend report
npx ts-node scripts/generate-trends.ts progress/
```

## Batch Processing Guidelines

### Small Batches (1-2 hours)
- 5-10 duplicate interfaces/types
- 20-30 unused exports
- 1-2 wrapper pattern refactors

### Medium Batches (Half day)
- Service standardization (1-2 services)
- Error handling updates (1 module)
- Import reorganization (1 package)

### Large Batches (Full day)
- Package extraction
- Cross-cutting concern refactor
- Major pattern standardization

## Common Scenarios

### Merge Conflicts
```bash
# If main has diverged significantly
git checkout main
git pull origin main
git checkout refactor/monorepo
git rebase main

# Resolve conflicts favoring refactored code
git add .
git rebase --continue
```

### Failed Tests After Refactor
1. Check if behavior changed unintentionally
2. Update test to match new structure
3. If test reveals issue, revert and fix

### Circular Dependency Introduced
```bash
# Identify the cycle
npx madge --circular src

# Common solutions:
# 1. Extract shared interface to core-types
# 2. Use dependency injection
# 3. Create a separate coordination module
```

## Automation Opportunities

### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run on changed files only
npx lint-staged

# Check for new duplicates
npx ts-node scripts/check-new-duplicates.ts
```

### CI Integration
```yaml
# .github/workflows/refactor-check.yml
name: Refactor Quality Check
on:
  pull_request:
    branches: [refactor/monorepo]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run analyze:all
      - run: pnpm run governance:check
      - uses: actions/upload-artifact@v3
        with:
          name: analysis-reports
          path: analysis-output/
```

## Escalation Path

### When to Escalate
- Circular dependency that can't be resolved
- Major architectural decision needed
- Significant performance regression
- Breaking change consideration

### Escalation Process
1. Document the issue clearly
2. Prepare options with pros/cons
3. Schedule architecture review
4. Get decision documented in ADR

## Success Criteria

### Week is Successful If:
- ✅ All assigned batches processed
- ✅ No increase in technical debt metrics
- ✅ All tests passing
- ✅ Team knowledge sharing happened
- ✅ Progress documented

### Red Flags:
- ❌ Drift detection shows regression
- ❌ Test coverage decreased
- ❌ Build time increased significantly
- ❌ Team confusion about patterns
