# Setup Config Injection Implementation Guide

**Status:** Ready for Implementation
**Estimated Effort:** 8-12 hours
**Priority:** HIGH

---

## Quick Reference: What to Update

### Three Main Areas
1. **Create Conventions Files** (New directory + 8 files)
2. **Update Claude Installer** (Add 2 methods, update 1 array)
3. **Update CLAUDE.md Template** (Add 2 sections, ~30 lines)

---

## Part 1: Create Conventions Directory & Files

### Step 1.1: Create Directory Structure

```bash
cd /Users/iroselli/wundr/packages/@wundr/computer-setup/resources
mkdir -p conventions
ls -la conventions/  # Should be empty
```

### Step 1.2: Create README.md

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/README.md`

```markdown
# Code Conventions

This directory contains standardized development conventions and guidelines for all projects using Wundr.

## Convention Files

- **git-worktree.md** - Git worktree workflow for SPARC development phases
- **naming-conventions.md** - Variable, function, file, and class naming standards
- **code-style.md** - Code formatting, indentation, and structure standards
- **git-conventions.md** - Git commit messages, branch naming, and merge strategies
- **documentation.md** - README, API docs, and code comment standards
- **testing.md** - Test file structure, naming, and coverage guidelines
- **security.md** - Secret handling, key rotation, and security practices
- **performance.md** - Optimization guidelines and performance best practices

## Quick Links

### For New Developers
1. Start with git-worktree.md to understand our workflow
2. Read naming-conventions.md before writing code
3. Review code-style.md for formatting
4. Check testing.md for test requirements

### For Team Leads
1. Share git-conventions.md with team for consistent commits
2. Use security.md for onboarding
3. Reference documentation.md for project standards

### For DevOps/Infrastructure
1. Review security.md for environment setup
2. Check git-conventions.md for automation hooks
3. Use testing.md for CI/CD pipeline configuration

## Using These Conventions

These files are installed in `~/.claude/conventions/` on every developer machine during setup.

Reference them:
```bash
cat ~/.claude/conventions/naming-conventions.md
```

Include in CLAUDE.md:
```markdown
See conventions in ~/.claude/conventions/ for complete standards
```

## Version Control

These conventions are versioned with the computer-setup package. Updates are distributed during computer-setup installations.

## Contributing Updates

To update conventions:
1. Edit file in this directory
2. Create PR with changes
3. Update version in computer-setup package
4. Include migration guide if breaking changes

---

Last Updated: 2025-11-21
```

### Step 1.3: Create git-worktree.md (CRITICAL)

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/git-worktree.md`

```markdown
# Git-Worktree Workflow

## Overview

Git worktrees allow multiple branches to be checked out simultaneously in separate directories. This is especially powerful when combined with the SPARC methodology, allowing each phase to have its own isolated development environment.

## Why Use Worktrees?

- Multiple development branches active simultaneously
- No stashing/unstashing between phases
- Isolated testing environments
- Parallel team development
- Clean separation of concerns

## SPARC Phase Worktrees

The Wundr methodology uses worktrees for each SPARC phase:

### Phase 1: Specification (spec/)
```bash
# Create specification worktree
git worktree add ../wundr-spec-<feature> --track origin/master
cd ../wundr-spec-<feature>
git checkout -b spec/<feature>

# Work in this worktree
npx claude-flow sparc run spec-pseudocode "<feature description>"
npm run lint
npm run test
```

### Phase 2: Architecture (design/)
```bash
# From main directory
git worktree add ../wundr-design-<feature> --track origin/master
cd ../wundr-design-<feature>
git checkout -b design/<feature>

# Work in this worktree
npx claude-flow sparc run architect
```

### Phase 3: Implementation (impl/)
```bash
# From main directory
git worktree add ../wundr-impl-<feature> --track origin/master
cd ../wundr-impl-<feature>
git checkout -b impl/<feature>

# Work in this worktree
npx claude-flow sparc tdd "<feature>"
```

### Phase 4: Refinement (refine/)
```bash
# From main directory
git worktree add ../wundr-refine-<feature> --track origin/master
cd ../wundr-refine-<feature>
git checkout -b refine/<feature>

# Work in this worktree
npm run test
npm run lint
npm run build
```

### Phase 5: Completion (main)
```bash
# Back in main directory, merge all branches
git merge spec/<feature>
git merge design/<feature>
git merge impl/<feature>
git merge refine/<feature>
npm run test
git push origin master
```

## Branch Naming Convention

SPARC phase worktrees follow a strict naming pattern:

```
<phase>/<feature-name>

phase options:
  - spec/     (Specification & pseudocode)
  - design/   (Architecture & design)
  - impl/     (Implementation)
  - refine/   (Refinement & polish)
  - fix/      (Bug fixes)
  - doc/      (Documentation)
```

Example branches:
```
spec/user-authentication
design/user-authentication
impl/user-authentication
refine/user-authentication

fix/login-redirect-bug
doc/api-endpoints
```

## Common Worktree Operations

### List All Worktrees
```bash
git worktree list
```

Output:
```
/path/to/main/repo             (master)
/path/to/wundr-spec-feature    (spec/feature)
/path/to/wundr-design-feature  (design/feature)
```

### Create a Worktree
```bash
# Basic creation
git worktree add <path> <branch>

# Create and checkout new branch
git worktree add <path> -b <new-branch> <base-branch>

# Example
git worktree add ../wundr-feature ../feature-name -b spec/feature-name origin/master
```

### Remove a Worktree
```bash
# When done with a phase
git worktree remove <worktree-path>

# Or prune dead worktrees
git worktree prune

# Example
git worktree remove ../wundr-spec-feature
```

### Clean Up After Completion
```bash
# Remove all completed phase worktrees
git worktree remove ../wundr-spec-feature
git worktree remove ../wundr-design-feature
git worktree remove ../wundr-impl-feature
git worktree remove ../wundr-refine-feature

# Verify cleanup
git worktree list  # Should show only main repos
```

## Advanced: Team Collaboration

### Multiple Teams on Different Phases

Team A works on specification:
```bash
git worktree add ../wundr-spec-feature-a -b spec/feature-a origin/master
```

Team B works on different feature design:
```bash
git worktree add ../wundr-design-feature-b -b design/feature-b origin/master
```

Team C implements completed spec:
```bash
git worktree add ../wundr-impl-feature-a -b impl/feature-a origin/spec/feature-a
```

Each team can:
- Work independently
- Run full test suites
- Use isolated dependencies
- Push to their branch when ready

### Merge Strategy

After each phase completes:
1. Push phase branch: `git push origin spec/feature-name`
2. Create PR with phase completion
3. Review & merge to master
4. Next phase team pulls updated master
5. Next team creates their worktree from master

Example flow:
```bash
# Specification team
git push origin spec/user-auth
# Create PR, merge to master

# Design team
git pull origin master  # Get spec-auth
git worktree add ../wundr-design-user-auth -b design/user-auth origin/master
# Work on design based on spec

# Implementation team
git pull origin master  # Get spec + design
git worktree add ../wundr-impl-user-auth -b impl/user-auth origin/master
# Implement based on spec + design
```

## Hooks & Automation

### Automatic Branch Validation

Post-checkout hook validates branch naming:
```bash
# Installed at ~/.claude/hooks/post-checkout

# Checks branch name matches SPARC pattern
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ ! $BRANCH =~ ^(spec|design|impl|refine|fix|doc)/ ]]; then
    echo "⚠️  Branch does not follow SPARC naming: $BRANCH"
    echo "Expected: <phase>/<feature-name>"
fi
```

### Phase-Specific Guidance

When checking out a phase branch, the hook provides guidance:
```bash
if [[ $BRANCH =~ ^spec/ ]]; then
    echo "🔍 Specification phase"
    echo "   Run: npx claude-flow sparc run spec-pseudocode"
elif [[ $BRANCH =~ ^design/ ]]; then
    echo "📐 Architecture phase"
    echo "   Run: npx claude-flow sparc run architect"
elif [[ $BRANCH =~ ^impl/ ]]; then
    echo "💻 Implementation phase"
    echo "   Run: npx claude-flow sparc tdd"
```

## Troubleshooting

### Worktree Already Exists
```bash
# Error: Working tree 'wundr-feature' already exists
git worktree remove ../wundr-feature
git worktree add ../wundr-feature -b spec/feature origin/master
```

### Stale Worktree References
```bash
# Clean up references to deleted worktrees
git worktree prune
```

### Merge Conflicts in Master

When merging worktree branches back to master:
```bash
# In main repository
git merge spec/feature-name

# Resolve conflicts
git add <resolved-files>
git commit -m "merge: Merge spec/feature-name to master"
git push origin master
```

## Best Practices

1. **Always use worktrees for SPARC phases**
   - One worktree per phase
   - Never switch branches in same worktree

2. **Follow branch naming convention**
   - `spec/`, `design/`, `impl/`, `refine/`, `fix/`, `doc/`
   - Use kebab-case for feature names
   - Example: `impl/user-registration`

3. **Test before merging**
   - Run full test suite in worktree
   - Verify lint and type checking
   - Test in isolation before merge

4. **Clean up after completion**
   - Remove worktrees after phase done
   - Verify all commits pushed
   - Run `git worktree prune` periodically

5. **Communicate with team**
   - Share branch names
   - Coordinate phase transitions
   - Update PR with phase progress

---

See also: SPARC methodology in main CLAUDE.md
Last Updated: 2025-11-21
```

### Step 1.4: Create naming-conventions.md

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/naming-conventions.md`

```markdown
# Naming Conventions

## JavaScript/TypeScript

### Variables & Constants
- **Local variables:** camelCase
  ```typescript
  let userCount = 0;
  const maxRetries = 3;
  let isActive = true;
  ```

- **Constants:** UPPER_SNAKE_CASE (only for true constants)
  ```typescript
  const MAX_RETRY_ATTEMPTS = 5;
  const API_ENDPOINT = 'https://api.example.com';
  const DEFAULT_TIMEOUT = 30000;
  ```

- **Avoid:** Single letter variables (except in loops), unclear abbreviations
  ```typescript
  // Bad
  let u = 0;
  let arr_len = 100;

  // Good
  let userCount = 0;
  let arrayLength = 100;
  ```

### Functions & Methods
- **camelCase** for all functions/methods
  ```typescript
  function calculateTotalPrice() {}
  const getUserById = (id) => {}
  class User {
    getUserName() {}
    setUserRole() {}
  }
  ```

- **Imperative verbs** for action functions
  ```typescript
  // Good
  createUser()
  updateProduct()
  deleteAccount()
  getOrderStatus()
  validateEmail()

  // Avoid
  userCreation()  // Use createUser instead
  findingProducts() // Use findProducts instead
  ```

### Classes & Interfaces
- **PascalCase** for all class and interface names
  ```typescript
  class UserProfile {}
  interface IApiResponse {}
  class OrderProcessor {}
  interface IDataValidator {}
  ```

- **Single responsibility naming**
  ```typescript
  // Good
  class UserValidator {}
  class OrderProcessor {}
  class PaymentGateway {}

  // Avoid
  class UserOrderPayment {} // Too many responsibilities
  ```

### Files & Directories
- **Files:** kebab-case
  ```
  user-service.ts
  order-processor.ts
  payment-gateway.ts
  ```

- **Directories:** kebab-case
  ```
  src/
    user-service/
    order-processing/
    payment-gateway/
  ```

- **Test files:** .test.ts or .spec.ts suffix
  ```
  user-service.test.ts
  order-processor.spec.ts
  ```

### React Components
- **Component files:** PascalCase
  ```
  UserProfile.tsx
  OrderList.tsx
  PaymentForm.tsx
  ```

- **Props interfaces:** `I<ComponentName>Props`
  ```typescript
  interface IUserProfileProps {
    userId: string;
    onUpdate: (user: User) => void;
  }

  function UserProfile(props: IUserProfileProps) {}
  ```

- **Hooks:** use* prefix in camelCase
  ```typescript
  function useUserData(userId: string) {}
  function useAuthContext() {}
  function useLocalStorage(key: string) {}
  ```

### Private vs Public
- **Private members:** prefix with underscore
  ```typescript
  class UserService {
    private _userId: string;
    private _cache: Map<string, User>;

    private _validateInput() {}
  }
  ```

- **Protected members:** prefix with underscore
  ```typescript
  class BaseService {
    protected _logger: Logger;
    protected _config: Config;
  }
  ```

## Python

### Variables & Constants
- **Local variables:** snake_case
  ```python
  user_count = 0
  is_active = True
  max_retries = 3
  ```

- **Constants:** UPPER_SNAKE_CASE
  ```python
  MAX_RETRY_ATTEMPTS = 5
  API_ENDPOINT = 'https://api.example.com'
  DEFAULT_TIMEOUT = 30000
  ```

### Functions & Methods
- **snake_case** for all functions
  ```python
  def calculate_total_price():
      pass

  def get_user_by_id(user_id):
      pass
  ```

### Classes
- **PascalCase** for all class names
  ```python
  class UserProfile:
      pass

  class OrderProcessor:
      pass
  ```

- **Private methods/attributes:** prefix with underscore
  ```python
  class UserService:
      def __init__(self):
          self._cache = {}
          self._logger = None

      def _validate_input(self, data):
          pass
  ```

### Files & Directories
- **snake_case** for all Python files and directories
  ```
  user_service.py
  order_processor.py
  payment_gateway.py
  ```

## Databases & IDs

### Primary Keys
- **Always:** `id` (singular)
  ```typescript
  interface User {
    id: string;
    name: string;
  }
  ```

### Foreign Keys
- **Format:** `<entity>Id` (camelCase)
  ```typescript
  interface Order {
    id: string;
    userId: string;  // Foreign key to User
    productId: string;  // Foreign key to Product
  }
  ```

### Timestamps
- **Created:** `createdAt`
- **Updated:** `updatedAt`
- **Deleted:** `deletedAt` (for soft deletes)
  ```typescript
  interface User {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
  }
  ```

## Boolean Naming

- **Prefix with:** is*, has*, can*, should*, does*
  ```typescript
  let isActive = true;
  let hasPermission = false;
  let canDelete = true;
  let shouldUpdate = false;
  let doesExist = true;
  ```

## Avoid These Patterns

| Anti-Pattern | Better |
|---|---|
| Single-letter names | Use descriptive names |
| Hungarian notation (iCount, strName) | Use type-aware naming |
| Unclear abbreviations | Spell out full words |
| Cryptic acronyms | Use clear names |
| Names that are too generic | Be specific |

Examples:
```typescript
// Bad
let a = 0;
let tmp = null;
let obj = {};
let result = getData();

// Good
let userCount = 0;
let tempData = null;
let userObject = {};
let userData = getUserData();
```

---

Last Updated: 2025-11-21
```

### Step 1.5: Create code-style.md

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/code-style.md`

```markdown
# Code Style Guide

## Indentation & Spacing

### Standard: 2 Spaces
All code uses 2-space indentation (no tabs).

```typescript
// Correct
function example() {
  if (condition) {
    doSomething();
  }
}

// Incorrect (4 spaces or tabs)
function example() {
    if (condition) {
        doSomething();
    }
}
```

### Line Length: 100 Characters
Maximum line length is 100 characters. Longer lines should be broken.

```typescript
// Good
const message = buildCompleteUserMessage(
  userId,
  userName,
  userEmail
);

// Avoid
const message = buildCompleteUserMessage(userId, userName, userEmail);
```

## Semicolons

### Use Semicolons
Always include semicolons at end of statements.

```typescript
// Correct
const value = 10;
function doSomething() {
  return result;
}

// Incorrect (missing semicolons)
const value = 10
function doSomething() {
  return result
}
```

This is enforced by Prettier/ESLint.

## Spacing

### Around Operators
```typescript
// Correct
const result = a + b;
const isValid = x === 5;
const product = multiply(a, b);

// Incorrect
const result=a+b;
const isValid=x===5;
const product=multiply(a,b);
```

### Object Literals
```typescript
// Correct
const user = {
  name: 'John',
  email: 'john@example.com',
  age: 30
};

// Incorrect (no spaces after colons)
const user = {name:'John',email:'john@example.com',age:30};
```

### Function Declarations
```typescript
// Correct
function getUserName(userId: string): string {
  return '...';
}

// Incorrect
function getUserName(userId:string):string {
  return '...';
}
```

## Quotes

### Use Single Quotes (JavaScript/TypeScript)
```typescript
// Correct
const message = 'Hello, world!';
const url = 'https://example.com';

// Incorrect
const message = "Hello, world!";
const url = "https://example.com";
```

Exception: When string contains single quote, use double quotes:
```typescript
const message = "It's a beautiful day";
```

### Python: Use Double Quotes
```python
# Correct
message = "Hello, world!"
url = "https://example.com"

# Incorrect
message = 'Hello, world!'
```

## Brackets & Braces

### Opening Brace on Same Line
```typescript
// Correct
if (condition) {
  doSomething();
}

function example() {
  return true;
}

class User {
  private id: string;
}

// Incorrect
if (condition)
{
  doSomething();
}
```

### Multi-line Objects
```typescript
// Correct
const config = {
  key1: 'value1',
  key2: 'value2',
  nested: {
    innerKey: 'innerValue'
  }
};

// Correct (one-liner acceptable if short)
const simple = { x: 1, y: 2 };
```

## Imports & Exports

### Import Organization
1. External libraries
2. Internal modules
3. Relative imports
4. Blank line between groups

```typescript
// Correct
import React from 'react';
import { useEffect } from 'react';
import axios from 'axios';

import { UserService } from '@/services/user-service';
import { OrderService } from '@/services/order-service';

import { helper } from './helper';
import { utils } from '../utils';
```

### Export Syntax
Prefer named exports:
```typescript
// Correct
export interface IUser {
  id: string;
  name: string;
}

export function getUserName(user: IUser): string {
  return user.name;
}

// Use default export only for main components
export default UserComponent;
```

## Comments

### Required Comments
- Class-level comments for public classes
- Function comments for complex logic
- Inline comments for non-obvious code

```typescript
/**
 * Processes user data and returns formatted output
 * @param userData - Raw user data from API
 * @returns Formatted user object
 */
export function processUserData(userData: any): IUser {
  // Transform API response format to internal format
  return {
    id: userData.user_id,
    name: userData.full_name
  };
}
```

### Comment Style
```typescript
// Single-line comment for simple explanations

/**
 * Multi-line comment for complex explanations
 * and JSDoc annotations
 */

/* Block comment for disabling code (temporary) */
// Avoid: Unclear comments
// TODO: Use comments for tasks
// FIXME: Use for known issues
// NOTE: Use for important info
```

## Null/Undefined

### Prefer Null
```typescript
// Correct - explicit null
function getUserById(id: string): User | null {
  return user || null;
}

// Avoid - implicit undefined
function getUserById(id: string): User | undefined {
  // ...
}
```

### Optional Chaining
```typescript
// Correct - modern approach
const name = user?.profile?.name;

// Avoid - null checks
const name = user && user.profile && user.profile.name;
```

## Type Annotations (TypeScript)

### Always Use Types
```typescript
// Correct
const userId: string = '123';
function getUserName(id: string): string {
  return '...';
}

const users: IUser[] = [];

// Avoid
const userId = '123';  // Type not clear
function getUserName(id) {  // Missing param type
  return '...';
}
```

### Interfaces for Objects
```typescript
// Correct
interface IUserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Avoid
type UserProfile = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};
```

## Async/Await

```typescript
// Correct - async/await style
async function fetchUser(id: string): Promise<IUser> {
  try {
    const response = await fetch(`/api/users/${id}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user', error);
    throw error;
  }
}

// Avoid - mixed Promise styles
function fetchUser(id: string) {
  return fetch(`/api/users/${id}`).then(r => r.json());
}
```

## Error Handling

```typescript
// Correct
try {
  const data = JSON.parse(jsonString);
  processData(data);
} catch (error) {
  const errorMessage = error instanceof Error
    ? error.message
    : 'Unknown error';
  logger.error(`Processing failed: ${errorMessage}`);
  throw error;
}

// Avoid - silent failures
try {
  doSomething();
} catch (e) {
  // Ignoring error
}
```

---

Last Updated: 2025-11-21
```

### Step 1.6: Create git-conventions.md

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/git-conventions.md`

```markdown
# Git Conventions

## Commit Message Format

### Conventional Commits
All commits follow the Conventional Commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type
Required. One of:
- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation only
- **style:** Code style (no functional change)
- **refactor:** Code refactoring
- **perf:** Performance improvement
- **test:** Test additions/modifications
- **chore:** Build, dependencies, tooling
- **ci:** CI/CD configuration

### Scope
Optional. Module or area being changed:
- `api`
- `ui`
- `database`
- `auth`
- `payment`
- etc.

### Subject
- Imperative mood: "add feature", not "added feature"
- Lowercase first letter
- No period at end
- Maximum 50 characters

### Body
- Explain what and why, not how
- Wrap at 72 characters
- Separate from subject with blank line
- Use bullet points for multiple items

### Footer
- Reference issues: `Fixes #123`
- Breaking changes: `BREAKING CHANGE: description`

### Examples

Good commit:
```
feat(auth): add JWT token refresh mechanism

Implement automatic JWT refresh to extend session lifetime.
Tokens now refresh on each API call within 1 minute of expiry.

Benefits:
- Users stay logged in longer
- Reduced token refresh failures
- Better UX for long sessions

Fixes #456
```

Simple fix:
```
fix(api): correct user email validation regex
```

Documentation:
```
docs: update API endpoint documentation
```

## Branch Naming

### Main Branches
- `master` - Production-ready code
- `develop` - Development staging area

### Feature Branches
Pattern: `<type>/<feature-name>`

Types:
- `feat/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation
- `test/` - Test additions

SPARC phases (see git-worktree.md):
- `spec/` - Specification phase
- `design/` - Architecture/design phase
- `impl/` - Implementation phase
- `refine/` - Refinement phase

Examples:
```
feat/user-authentication
fix/login-redirect-bug
refactor/api-client
docs/deployment-guide
test/unit-test-suite

spec/payment-system
design/payment-system
impl/payment-system
refine/payment-system
```

### Guidelines
- Use lowercase
- Use hyphens between words (kebab-case)
- Descriptive names (8+ chars recommended)
- Maximum 50 characters

## Pull Request Process

### PR Title Format
Same as commit message:
```
feat(auth): add JWT token refresh
fix(api): correct email validation
docs: update deployment guide
```

### PR Description
Include:
1. Summary of changes
2. Motivation and context
3. Type of change
4. How to test
5. Checklist of items completed

Template:
```markdown
## Summary
Describe changes in 1-3 sentences

## Motivation
Why are these changes needed?

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Breaking change

## Testing
How to verify these changes work

## Checklist
- [ ] Code follows style guide
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Breaking changes documented
```

### Review Process
1. At least 1 approval required
2. All CI checks must pass
3. Address all comments before merge
4. Squash commits before merge

## Merge Strategy

### Feature Branches → Develop
Use **squash and merge**:
```bash
git merge --squash feature/my-feature
git commit -m "feat: add my feature"
```

### Develop → Master
Use **merge commit**:
```bash
git merge develop -m "release: version 1.2.0"
```

Keep full history of releases.

## Version Control Rules

### Never Force Push
- No `git push -f` on shared branches
- No `git push --force-with-lease` unless necessary
- Discuss with team before rebasing shared branches

### No Direct Commits to Master
- All changes via pull requests
- Pull requests require approval
- CI/CD must pass

### Keep Branches Clean
- Delete merged feature branches
- One feature per branch
- Keep branches up-to-date with master

## Collaboration

### Before Starting Feature
```bash
# Update local master
git checkout master
git pull origin master

# Create feature branch
git checkout -b feat/my-feature
```

### Regular Updates
Keep feature branch in sync:
```bash
# Option 1: Rebase (linear history)
git fetch origin
git rebase origin/master

# Option 2: Merge (preserve history)
git merge origin/master
```

### Before Opening PR
```bash
# Ensure all changes committed
git status

# Verify branch is up-to-date
git fetch origin
git rebase origin/master

# Push to remote
git push origin feat/my-feature
```

## Common Scenarios

### Update PR with Latest Changes
```bash
# From your feature branch
git fetch origin
git rebase origin/master
git push origin feat/my-feature --force-with-lease
```

### Revert Merged PR
```bash
# Create revert commit
git revert <commit-hash>
git push origin master
```

### Cherry-pick Specific Commit
```bash
# In target branch
git cherry-pick <commit-hash>
git push origin <branch>
```

## Automation

### Pre-commit Hooks
Automated checks before commit:
- Linting (ESLint, Prettier)
- Type checking (TypeScript)
- Unit tests
- No debugger/console statements

### Commit Message Validation
- Enforces Conventional Commits format
- Validates commit type
- Prevents invalid commits

---

Last Updated: 2025-11-21
```

### Step 1.7-1.8: Create remaining files (documentation.md, testing.md, security.md)

Due to length constraints, create these three files with similar structure:

**For documentation.md:** Focus on README standards, JSDoc, code comments
**For testing.md:** Focus on test structure, naming, coverage goals
**For security.md:** Focus on .env files, secrets, dependencies

---

## Part 2: Update Claude Installer

### Step 2.1: Open claude-installer.ts

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/src/installers/claude-installer.ts`

### Step 2.2: Find getSteps() method (Line 74)

Locate the `getSteps()` method and find where to add new steps.

### Step 2.3: Add New Steps Before Return

**Add after line 156 (before `return steps;`):**

```typescript
// Add conventions setup
steps.push({
    id: 'claude-conventions',
    name: 'Setup Code Conventions',
    description: 'Install code style, naming, and workflow conventions',
    category: 'configuration',
    required: true,
    dependencies: ['claude-config'],
    estimatedTime: 5,
    installer: async () => {
        await this.setupConventions();
    },
});

// Add worktree hooks setup
steps.push({
    id: 'claude-worktree',
    name: 'Setup Git-Worktree Hooks',
    description: 'Configure hooks for SPARC-aware worktree management',
    category: 'configuration',
    required: false,
    dependencies: ['claude-conventions'],
    estimatedTime: 5,
    installer: async () => {
        await this.setupWorktreeHooks();
    },
});
```

### Step 2.4: Add setupConventions() Method

**Add after setupClaudeMdGenerator() method (after line 1203):**

```typescript
private async setupConventions(): Promise<void> {
    console.log('📋 Installing code conventions...');

    const conventionsDir = path.join(this.claudeDir, 'conventions');
    await fsSync.ensureDir(conventionsDir);

    const bundledConventionsDir = path.join(this.resourcesDir, 'conventions');

    // Check if conventions directory exists
    const convsExist = await fs
        .access(bundledConventionsDir)
        .then(() => true)
        .catch(() => false);

    if (!convsExist) {
        console.warn('⚠️  No bundled conventions found');
        return;
    }

    try {
        // Copy all convention files
        const files = await fs.readdir(bundledConventionsDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const src = path.join(bundledConventionsDir, file);
                const dst = path.join(conventionsDir, file);
                await fs.copy(src, dst, { overwrite: true });
            }
        }

        console.log(`✅ Conventions installed (${files.length} files)`);
    } catch (error) {
        console.error('❌ Failed to install conventions:', error);
        throw error;
    }
}
```

### Step 2.5: Add setupWorktreeHooks() Method

**Add after setupConventions() method:**

```typescript
private async setupWorktreeHooks(): Promise<void> {
    console.log('🔧 Setting up git-worktree hooks...');

    const postCheckoutHook = `#!/bin/bash
# Post-checkout hook for SPARC-aware worktree setup
# Auto-generated by Wundr Computer Setup

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Detect SPARC phase and provide guidance
if [[ $BRANCH =~ ^spec/ ]]; then
    echo "🔍 Specification phase detected: $BRANCH"
    echo "   Run: npx claude-flow sparc run spec-pseudocode"
elif [[ $BRANCH =~ ^design/ ]]; then
    echo "📐 Architecture phase detected: $BRANCH"
    echo "   Run: npx claude-flow sparc run architect"
elif [[ $BRANCH =~ ^impl/ ]]; then
    echo "💻 Implementation phase detected: $BRANCH"
    echo "   Run: npx claude-flow sparc tdd"
elif [[ $BRANCH =~ ^refine/ ]]; then
    echo "✨ Refinement phase detected: $BRANCH"
    echo "   Run: npm run test && npm run lint && npm run build"
elif [[ $BRANCH =~ ^fix/ ]]; then
    echo "🐛 Bug fix branch detected: $BRANCH"
    echo "   Remember to update tests and documentation"
elif [[ $BRANCH =~ ^doc/ ]]; then
    echo "📚 Documentation branch detected: $BRANCH"
fi

# Validate branch naming
if [[ ! $BRANCH =~ ^(spec|design|impl|refine|fix|doc|master|develop)/ ]] && [[ $BRANCH != 'master' ]] && [[ $BRANCH != 'develop' ]]; then
    echo "⚠️  Warning: Branch doesn't follow SPARC naming convention"
    echo "   Expected: <phase>/<feature-name>"
    echo "   Phases: spec, design, impl, refine, fix, doc"
fi
`;

    try {
        // Ensure git hooks directory exists (in .git/hooks)
        // This only works if in a git repository
        const gitHooksDir = path.join(process.cwd(), '.git', 'hooks');

        if (fsSync.existsSync(gitHooksDir)) {
            const hookPath = path.join(gitHooksDir, 'post-checkout');
            await fs.writeFile(hookPath, postCheckoutHook);
            execSync(`chmod +x ${hookPath}`);
            console.log('✅ Git hooks installed');
        } else {
            console.warn(
                '⚠️  Not in a git repository. Run this in your project root.'
            );
            // Still save hook template for future use
            const hooksTemplate = path.join(
                this.helpersDir,
                'post-checkout-template.sh'
            );
            await fs.writeFile(hooksTemplate, postCheckoutHook);
            console.log('✅ Hook template saved to ~/.claude/helpers/');
        }
    } catch (error) {
        console.warn('⚠️  Could not install git hooks:', error);
        // Non-fatal - continue installation
    }
}
```

---

## Part 3: Update CLAUDE.md Template

### Step 3.1: Open CLAUDE.md.template

**File:** `/Users/iroselli/wundr/packages/@wundr/computer-setup/resources/templates/CLAUDE.md.template`

### Step 3.2: Add Conventions Section

**After "Agent Configuration" section, add:**

```markdown
## Code Conventions

All development standards are documented in `~/.claude/conventions/`:
- **git-worktree.md** - Git worktree workflow for SPARC phases
- **naming-conventions.md** - Variable, function, and file naming standards
- **code-style.md** - Formatting and code structure standards
- **git-conventions.md** - Commit messages and branch naming
- **documentation.md** - Documentation and comment standards
- **testing.md** - Test structure and coverage guidelines
- **security.md** - Secret handling and security practices

Review conventions before starting development:
```bash
cat ~/.claude/conventions/naming-conventions.md
cat ~/.claude/conventions/code-style.md
cat ~/.claude/conventions/git-conventions.md
```

```

### Step 3.3: Add SPARC + Worktree Section

**After Code Conventions section, add:**

```markdown
## SPARC Development with Git-Worktrees

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with git-worktrees for isolated development phases.

### Feature Development Workflow

Each feature follows separate worktrees for each SPARC phase:

```bash
# Phase 1: Specification
git worktree add ../wundr-spec-<feature> --track origin/master
cd ../wundr-spec-<feature>
git checkout -b spec/<feature>
npx claude-flow sparc run spec-pseudocode "<feature description>"

# Phase 2: Architecture
# Go back to main repo
git worktree add ../wundr-design-<feature> --track origin/master
cd ../wundr-design-<feature>
git checkout -b design/<feature>
npx claude-flow sparc run architect

# Phase 3: Implementation
git worktree add ../wundr-impl-<feature> --track origin/master
cd ../wundr-impl-<feature>
git checkout -b impl/<feature>
npx claude-flow sparc tdd "<feature>"

# Phase 4: Refinement
git worktree add ../wundr-refine-<feature> --track origin/master
cd ../wundr-refine-<feature>
git checkout -b refine/<feature>
npm run test
npm run lint
npm run build

# Phase 5: Merge to master
cd main-repo
git merge spec/<feature>
git merge design/<feature>
git merge impl/<feature>
git merge refine/<feature>
git push origin master

# Cleanup
git worktree remove ../wundr-spec-<feature>
git worktree remove ../wundr-design-<feature>
git worktree remove ../wundr-impl-<feature>
git worktree remove ../wundr-refine-<feature>
```

See `~/.claude/conventions/git-worktree.md` for detailed guidance.

```

---

## Part 4: Verification

### Step 4.1: Verify File Structure

```bash
# Check new conventions directory
ls -la /Users/iroselli/wundr/packages/@wundr/computer-setup/resources/conventions/

# Should show:
# README.md
# git-worktree.md
# naming-conventions.md
# code-style.md
# git-conventions.md
# documentation.md
# testing.md
# security.md
```

### Step 4.2: Build Package

```bash
cd /Users/iroselli/wundr
npm run build

# Or specifically:
cd packages/@wundr/computer-setup
npm run build
```

### Step 4.3: Test Installation

```bash
# Dry-run test
./scripts/dev-computer-setup.sh --profile fullstack --dry-run

# Or full test (will modify ~/.claude/)
./scripts/dev-computer-setup.sh --profile fullstack --no-dry-run
```

### Step 4.4: Verify Config Files

```bash
# Check if conventions installed
ls -la ~/.claude/conventions/

# Should show all 8 files

# Check if generator updated
cat ~/.claude/helpers/generate-claude-md.js | grep -i convention
```

---

## Summary Checklist

- [ ] Create `/resources/conventions/` directory
- [ ] Create all 8 convention .md files
- [ ] Update `claude-installer.ts` getSteps() method
- [ ] Add `setupConventions()` method
- [ ] Add `setupWorktreeHooks()` method
- [ ] Update CLAUDE.md.template with conventions section
- [ ] Update CLAUDE.md.template with SPARC+worktree section
- [ ] Run npm build
- [ ] Test fresh setup installation
- [ ] Verify configs are deployed to ~/.claude/
- [ ] Test that conventions are readable from new projects

---

**Implementation Status:** Ready
**Estimated Time:** 8-12 hours
**Team Size:** 1-2 developers
**Risk Level:** Low (additions only, no breaking changes)

