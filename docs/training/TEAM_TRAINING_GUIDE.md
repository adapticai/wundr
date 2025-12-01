# Team Training Guide: Monorepo Refactoring

## Overview

This guide helps team members understand and contribute to the monorepo refactoring effort.

## Training Modules

### Module 1: Understanding the Problem (1 hour)

#### Learning Objectives

- Understand technical debt accumulation
- Identify anti-patterns in the codebase
- Recognize the impact on productivity

#### Activities

1. **Code Review Exercise**

   ```typescript
   // Example 1: Spot the issues
   export interface User {
     id: string;
     name: string;
   }

   export interface IUser {
     userId: string;
     userName: string;
   }

   export type UserType = {
     user_id: string;
     user_name: string;
   };

   // Discussion: What problems do you see?
   ```

2. **Dependency Graph Analysis**
   - Open `analysis-output/latest/dependency-graph.svg`
   - Identify circular dependencies
   - Discuss impact on build times

3. **Real Impact Metrics**
   - Current build time: X minutes
   - Test execution time: Y minutes
   - Time to add new feature: Z hours
   - Bug fix turnaround: W days

### Module 2: Monorepo Architecture (2 hours)

#### Learning Objectives

- Understand monorepo benefits
- Learn package boundaries
- Master import patterns

#### Key Concepts

1. **Package Structure**

   ```
   monorepo/
   ├── packages/           # Shared libraries
   │   ├── core-types/    # All TypeScript interfaces/types
   │   ├── errors/        # Error classes and handling
   │   ├── utils/         # Shared utilities
   │   ├── models/        # Data models
   │   └── services/      # Business logic
   ├── apps/              # Applications
   │   ├── api/           # REST API
   │   └── worker/        # Background jobs
   └── tools/             # Build tools
   ```

2. **Import Patterns**

   ```typescript
   // ❌ Bad: Relative imports across packages
   import { User } from '../../../packages/core-types/src/user';

   // ✅ Good: Package imports
   import { User } from '@company/core-types';

   // ❌ Bad: Circular imports
   // packages/services/src/user.ts
   import { OrderService } from './order';
   // packages/services/src/order.ts
   import { UserService } from './user';

   // ✅ Good: Dependency injection
   export class UserService {
     constructor(private orderService?: OrderService) {}
   }
   ```

3. **Package Boundaries**
   - `core-types`: No dependencies (except TypeScript)
   - `utils`: Depends only on core-types
   - `services`: Can depend on core-types, utils, models
   - Apps: Can depend on any package

#### Hands-on Exercise

```bash
# Create a new feature following architecture
1. Add type to core-types
2. Add utility function to utils
3. Add service logic
4. Integrate in API

# Commands:
cd packages/core-types/src
echo "export interface Feature { id: string; }" >> feature.ts

cd ../../utils/src
echo "export const validateFeature = (f: Feature) => true;" >> feature.ts

# Build and verify
pnpm build
```

### Module 3: Refactoring Tools and Scripts (2 hours)

#### Learning Objectives

- Master analysis tools
- Use consolidation scripts
- Understand automation

#### Tool Overview

1. **Analysis Tools**

   ```bash
   # Complete analysis
   ./scripts/analyze-all.sh

   # Specific analysis
   npx ts-node scripts/enhanced-ast-analyzer.ts
   npx ts-node scripts/similarity-detector.ts
   npx ts-node scripts/dependency-mapper.ts
   ```

2. **Consolidation Tools**

   ```bash
   # Process a batch
   npx ts-node scripts/consolidation-manager.ts process batch-001.json

   # Check status
   npx ts-node scripts/consolidation-manager.ts status

   # Generate AI prompts
   npx ts-node scripts/ai-merge-helper.ts generate batch-001.json
   ```

3. **Standardization Tools**

   ```bash
   # Apply patterns
   npx ts-node scripts/pattern-standardizer.ts run

   # Check what needs manual review
   npx ts-node scripts/pattern-standardizer.ts review
   ```

#### Practice Session

1. Run analysis on a sample directory
2. Interpret the results
3. Create a consolidation plan
4. Execute the consolidation
5. Verify the results

### Module 4: Golden Standards and Patterns (1.5 hours)

#### Learning Objectives

- Internalize coding standards
- Recognize approved patterns
- Avoid anti-patterns

#### Key Standards

1. **Error Handling**

   ```typescript
   // ❌ Bad
   throw 'User not found';
   throw new Error('User not found');

   // ✅ Good
   throw new NotFoundError('User', userId);
   throw new ValidationError('Invalid email', ['email']);
   ```

2. **Service Pattern**

   ```typescript
   // ✅ Standard service
   export class FeatureService extends BaseService {
     constructor(
       private readonly repo: FeatureRepository,
       private readonly eventBus: EventBus
     ) {
       super('FeatureService');
     }

     protected async onStart(): Promise<void> {
       await this.repo.connect();
     }

     protected async onStop(): Promise<void> {
       await this.repo.disconnect();
     }

     async getFeature(id: string): Promise<Feature> {
       const feature = await this.repo.findById(id);
       if (!feature) {
         throw new NotFoundError('Feature', id);
       }
       return feature;
     }
   }
   ```

3. **Type Definitions**

   ```typescript
   // ✅ Good: Interface for objects
   export interface Feature {
     id: string;
     name: string;
     enabled: boolean;
   }

   // ✅ Good: Type for unions
   export type FeatureStatus = 'draft' | 'active' | 'archived';

   // ✅ Good: Enum with string values
   export enum FeatureFlag {
     BETA = 'BETA',
     EXPERIMENTAL = 'EXPERIMENTAL',
     STABLE = 'STABLE',
   }
   ```

#### Code Review Exercise

Review PRs together, focusing on:

- Adherence to standards
- Pattern recognition
- Suggesting improvements

### Module 5: Testing During Refactoring (1 hour)

#### Learning Objectives

- Maintain test coverage
- Update tests efficiently
- Use tests as safety net

#### Testing Strategy

1. **Before Refactoring**

   ```bash
   # Capture baseline
   pnpm test -- --coverage --json > baseline-coverage.json

   # Run specific tests
   pnpm test -- --findRelatedTests src/services/user.ts
   ```

2. **During Refactoring**

   ```typescript
   // Update imports in tests
   // Before:
   import { UserService } from '../../../src/services/user';

   // After:
   import { UserService } from '@company/services';

   // Update mocks
   jest.mock('@company/services', () => ({
     UserService: jest.fn().mockImplementation(() => ({
       findById: jest.fn().mockResolvedValue(mockUser),
     })),
   }));
   ```

3. **After Refactoring**

   ```bash
   # Verify coverage maintained
   pnpm test -- --coverage

   # Run integration tests
   pnpm test:integration

   # Check for flaky tests
   pnpm test -- --runInBand
   ```

### Module 6: Git Workflow for Large Refactors (1 hour)

#### Learning Objectives

- Manage long-lived branches
- Handle conflicts efficiently
- Maintain clean history

#### Best Practices

1. **Commit Strategy**

   ```bash
   # Atomic commits
   git add packages/core-types/src/user.ts
   git commit -m "refactor(types): extract User interface to core-types"

   git add src/services/user.ts tests/user.test.ts
   git commit -m "refactor(services): update UserService imports"

   # Not this:
   git add .
   git commit -m "big refactor"
   ```

2. **Rebase Strategy**

   ```bash
   # Daily rebase from main
   git fetch origin
   git rebase origin/main

   # Interactive rebase to clean history
   git rebase -i HEAD~10
   # squash related commits
   # reword for clarity
   ```

3. **Conflict Resolution**

   ```bash
   # For import conflicts, prefer refactored version
   git checkout --theirs -- '**/imports.ts'

   # For type conflicts, may need manual merge
   git mergetool

   # Test after resolution
   pnpm test -- --no-cache
   ```

## Assessment and Certification

### Skills Checklist

#### Level 1: Basic Contributor

- [ ] Can run analysis scripts
- [ ] Understands monorepo structure
- [ ] Can process simple consolidation batches
- [ ] Follows golden standards
- [ ] Updates tests after refactoring

#### Level 2: Independent Contributor

- [ ] Can interpret analysis results
- [ ] Creates consolidation plans
- [ ] Uses AI assistance effectively
- [ ] Resolves merge conflicts
- [ ] Identifies anti-patterns

#### Level 3: Lead Contributor

- [ ] Can modify analysis scripts
- [ ] Designs package boundaries
- [ ] Reviews and guides others
- [ ] Makes architectural decisions
- [ ] Drives process improvements

### Practical Assessment

Complete these tasks independently:

1. **Analysis Task**
   - Run analysis on `src/modules/legacy`
   - Identify top 3 issues
   - Propose solutions

2. **Consolidation Task**
   - Given 3 duplicate interfaces
   - Create consolidated version
   - Update all usages
   - Ensure tests pass

3. **Architecture Task**
   - Design package structure for new feature
   - Justify boundaries
   - Create implementation plan

## Resources and Support

### Documentation

- `GOLDEN_STANDARDS.md` - Coding standards
- `docs/architecture/` - Architecture decisions
- `TROUBLESHOOTING.md` - Common issues

### Tools Reference

- Analysis scripts: `scripts/README.md`
- Monorepo setup: `MONOREPO.md`
- CI/CD: `.github/workflows/README.md`

### Communication Channels

- Slack: #refactoring-team
- Daily standup: 9:30 AM
- Weekly review: Friday 2 PM
- Office hours: Tuesday/Thursday 3-4 PM

### Pair Programming Schedule

- New team members paired for first week
- Complex refactors always paired
- Knowledge sharing sessions weekly

## Quick Reference Card

### Daily Commands

```bash
# Start your day
git pull origin refactor/monorepo
pnpm install

# Analyze your work area
./scripts/analyze-all.sh src/your-area

# Process a batch
npx ts-node scripts/consolidation-manager.ts process batch-X.json

# Test your changes
pnpm test -- --findRelatedTests
pnpm type-check

# End your day
git push origin refactor/monorepo
```

### Decision Tree

```
Is it a duplicate?
├─ Yes → Use consolidation-manager
├─ No → Is it following standards?
   ├─ No → Use pattern-standardizer
   └─ Yes → Is it in the right package?
      ├─ No → Move to correct package
      └─ Yes → ✅ Done
```

### Emergency Contacts

- Tech Lead: @tech-lead
- Architecture: @architect
- DevOps: @devops-team

## Continuous Learning

### Weekly Learning Topics

- Week 1: Advanced TypeScript patterns
- Week 2: Performance optimization
- Week 3: Testing strategies
- Week 4: Build optimization

### Recommended Reading

1. "Effective TypeScript" by Dan Vanderkam
2. "Clean Architecture" by Robert Martin
3. Monorepo tools documentation

### Experimentation Time

- 20% time for refactoring improvements
- Propose new tools or patterns
- Share learnings with team
