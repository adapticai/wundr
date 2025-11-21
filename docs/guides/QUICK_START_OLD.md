# Quick Start Guide: Claude Code + Claude Flow Integration

## 🚀 Start Here

Get up and running with enhanced Claude Code and Claude Flow integration in just 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Git configured
- Access to the repository
- 8GB+ RAM recommended

## Day 1: Essential Setup (30 minutes)

### 1. Clone and Setup (5 minutes)
```bash
# Clone the repository
git clone <your-repo-url>
cd <your-repo>

# Create refactoring branch
git checkout -b refactor/monorepo

# Install dependencies
npm install
```

### 2. Install Analysis Tools (10 minutes)
```bash
# Create scripts directory
mkdir -p scripts

# Copy the provided scripts:
# - enhanced-ast-analyzer.ts
# - consolidation-manager.ts
# - pattern-standardizer.ts
# - governance-system.ts
# - monorepo-setup.ts

# Install required packages
npm install --save-dev \
  typescript ts-node @types/node \
  ts-morph glob fastest-levenshtein \
  madge csv-writer @octokit/rest
```

### 3. Run First Analysis (10 minutes)
```bash
# Create analysis script
chmod +x scripts/analyze-all.sh

# Run analysis
./scripts/analyze-all.sh .

# Open results
open analysis-output/*/dashboard.html
```

### 4. Review Results (5 minutes)
Look for:
- **Red numbers**: Critical duplicates
- **Yellow numbers**: High priority issues
- **File list**: Biggest problem areas

## Day 2-5: First Consolidation Sprint

### Day 2: Pick Low-Hanging Fruit
```bash
# Find easiest wins
cat analysis-output/latest/consolidation-batches.json | \
  jq '.[] | select(.priority == "high" and .items | length < 5)'

# Process first batch
npx ts-node scripts/consolidation-manager.ts process batch-001.json
```

### Day 3: Use AI Assistance
```bash
# Generate prompts for complex merges
npx ts-node scripts/ai-merge-helper.ts generate batch-002.json

# Review generated prompts
cat ai-prompts/*/merge-interface-1.md

# Copy to your AI assistant and apply results
```

### Day 4: Standardize Patterns
```bash
# Auto-fix common issues
npx ts-node scripts/pattern-standardizer.ts run

# Check what needs manual review
npx ts-node scripts/pattern-standardizer.ts review
```

### Day 5: Measure Progress
```bash
# Re-run analysis
./scripts/analyze-all.sh .

# Compare with baseline
npx ts-node scripts/governance-system.ts check

# Generate report
npx ts-node scripts/governance-system.ts weekly-report
```

## Week 2: Scale Up

### Establish Routine
```yaml
Monday:
  - Run fresh analysis
  - Plan week's work
  - Assign batches

Tuesday-Thursday:
  - Process 2-3 batches daily
  - Use AI for complex merges
  - Update tests

Friday:
  - Generate reports
  - Team review
  - Plan next week
```

### Key Commands Cheatsheet
```bash
# Analysis
./scripts/analyze-all.sh                    # Full analysis

# Consolidation
npx ts-node scripts/consolidation-manager.ts process <batch>  # Process batch
npx ts-node scripts/consolidation-manager.ts status          # Check progress

# AI Assistance
npx ts-node scripts/ai-merge-helper.ts generate <batch>      # Generate prompts

# Standardization
npx ts-node scripts/pattern-standardizer.ts run              # Auto-fix patterns

# Governance
npx ts-node scripts/governance-system.ts check               # Drift check
npx ts-node scripts/governance-system.ts weekly-report       # Weekly summary

# Testing
npm test -- --findRelatedTests <file>                        # Test specific file
npm run type-check                                           # Type checking
```

## Common Scenarios

### "I have 3 similar interfaces"
```bash
# 1. Check similarity report
grep -A5 "YourInterface" analysis-output/latest/similarities.csv

# 2. Generate AI prompt
echo '[{"entities": [...]}]' > temp-batch.json
npx ts-node scripts/ai-merge-helper.ts generate temp-batch.json

# 3. Apply merge
# ... use AI to create merged version ...

# 4. Update imports
npx ts-node scripts/consolidation-manager.ts process temp-batch.json
```

### "Build is failing after refactor"
```bash
# 1. Check TypeScript errors
npx tsc --noEmit

# 2. Look for circular dependencies
npx madge --circular src

# 3. Verify imports
grep -r "import.*from.*\.\./" src/  # Find relative imports

# 4. Rebuild
npm run clean && npm run build
```

### "Tests are failing"
```bash
# 1. Run specific test
npm test -- path/to/test.spec.ts

# 2. Update mocks
# Change: jest.mock('../services/UserService')
# To: jest.mock('@company/services')

# 3. Check coverage
npm test -- --coverage
```

## Monorepo Migration (When Ready)

### Initial Setup
```bash
# 1. Create monorepo structure
npx ts-node scripts/monorepo-setup.ts init

# 2. Install pnpm (recommended)
npm install -g pnpm

# 3. Install dependencies
pnpm install

# 4. Generate migration plan
npx ts-node scripts/monorepo-setup.ts plan analysis-output/latest/analysis-report.json
```

### Migration Steps
```bash
# 1. Move types
mv src/types/* packages/core-types/src/

# 2. Update imports
find . -name "*.ts" -exec sed -i '' 's|../types|@company/core-types|g' {} \;

# 3. Build packages
pnpm build

# 4. Run tests
pnpm test
```

## Getting Help

### Quick Diagnostics
```bash
# Check environment
node --version  # Should be 18+
npm --version   # Should be 8+

# Verify setup
ls scripts/     # Should show all scripts
ls analysis-output/  # Should have results

# Test a script
npx ts-node scripts/enhanced-ast-analyzer.ts --help
```

### Common Issues

**"Cannot find module ts-morph"**
```bash
npm install --save-dev ts-morph
```

**"Out of memory"**
```bash
NODE_OPTIONS="--max-old-space-size=8192" npx ts-node scripts/enhanced-ast-analyzer.ts
```

**"Permission denied"**
```bash
chmod +x scripts/*.sh
```

### Resources
- Full guide: See complete documentation
- Golden standards: `GOLDEN_STANDARDS.md`
- Troubleshooting: `TROUBLESHOOTING.md`
- Team chat: #refactoring-help

## Success Metrics

Track your progress:

| Metric | Start | Week 1 | Week 2 | Target |
|--------|-------|--------|--------|--------|
| Duplicates | ??? | -20% | -40% | -90% |
| Unused exports | ??? | -50% | -75% | -100% |
| Build time | ??? | -10% | -20% | -50% |
| Test coverage | ??? | +5% | +10% | +20% |

## Next Steps

1. ✅ Complete Day 1 setup
2. 📊 Review your analysis results
3. 🎯 Pick your first batch
4. 🚀 Start consolidating!

Remember: **Small, consistent progress > Big, risky changes**

Good luck! 🎉
