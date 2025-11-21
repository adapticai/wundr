# Project Conventions

> **Purpose**: This document establishes coding standards, organizational patterns, and workflow protocols to ensure consistency, maintainability, and quality across the codebase.

## Table of Contents

- [Code Style Guidelines](#code-style-guidelines)
- [File Organization Rules](#file-organization-rules)
- [Naming Conventions](#naming-conventions)
- [Documentation Standards](#documentation-standards)
- [Testing Requirements](#testing-requirements)
- [Git Workflow Patterns](#git-workflow-patterns)
- [Agent Coordination Protocols](#agent-coordination-protocols)
- [Git Worktree Usage Guidelines](#git-worktree-usage-guidelines)

---

## Code Style Guidelines

### General Principles

1. **Clarity over Cleverness**: Write code that is easy to understand, not code that shows off technical prowess
2. **Consistency**: Follow established patterns in the codebase
3. **DRY (Don't Repeat Yourself)**: Extract reusable logic into functions/modules
4. **KISS (Keep It Simple, Stupid)**: Prefer simple solutions over complex ones
5. **YAGNI (You Aren't Gonna Need It)**: Don't add functionality until it's needed

### Language-Specific Standards

#### TypeScript/JavaScript

```typescript
// ✅ GOOD: Clear, typed, well-structured
interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferences?: UserPreferences;
}

const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const profile = await database.users.findById(userId);

  if (!profile) {
    throw new NotFoundError(`User ${userId} not found`);
  }

  return profile;
};

// ❌ BAD: Unclear, untyped, poor structure
const getUser = async (id) => {
  return await db.users.find(id);
};
```

**Rules:**
- Always use TypeScript for type safety
- Prefer `const` and `let` over `var`
- Use arrow functions for callbacks and utilities
- Use async/await over raw Promises
- Maximum line length: 100 characters
- Indentation: 2 spaces
- Use semicolons consistently
- Prefer template literals over string concatenation
- Use destructuring where it improves readability

#### Python

```python
# ✅ GOOD: PEP 8 compliant, typed, clear
from typing import Optional, List
from dataclasses import dataclass

@dataclass
class UserProfile:
    id: str
    name: str
    email: str
    preferences: Optional[dict] = None

def fetch_user_profile(user_id: str) -> UserProfile:
    """
    Fetch user profile by ID.

    Args:
        user_id: Unique identifier for the user

    Returns:
        UserProfile object

    Raises:
        ValidationError: If user_id is invalid
        NotFoundError: If user not found
    """
    if not user_id:
        raise ValidationError("User ID is required")

    profile = database.users.find_by_id(user_id)

    if not profile:
        raise NotFoundError(f"User {user_id} not found")

    return profile
```

**Rules:**
- Follow PEP 8 style guide
- Use type hints for all function signatures
- Maximum line length: 88 characters (Black formatter)
- Indentation: 4 spaces
- Use dataclasses or Pydantic models for data structures
- Prefer f-strings over format() or %
- Use list comprehensions for simple transformations

### Code Organization

#### Function/Method Size
- **Target**: 10-20 lines per function
- **Maximum**: 50 lines (if exceeded, refactor into smaller functions)
- **Complexity**: Maximum cyclomatic complexity of 10

#### Class Size
- **Target**: 100-300 lines per class
- **Maximum**: 500 lines (if exceeded, split into multiple classes)

#### File Size
- **Target**: 200-400 lines per file
- **Maximum**: 500 lines (if exceeded, split into multiple files)

### Error Handling

```typescript
// ✅ GOOD: Specific errors, proper logging, graceful degradation
class UserServiceError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message);
    this.name = 'UserServiceError';
  }
}

const processUser = async (userId: string): Promise<ProcessedUser> => {
  try {
    const user = await fetchUser(userId);
    const processed = await transformUser(user);
    return processed;
  } catch (error) {
    logger.error('Failed to process user', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof ValidationError) {
      throw new UserServiceError('Invalid user data', 'VALIDATION_ERROR', error);
    }

    throw new UserServiceError('Processing failed', 'PROCESSING_ERROR', error);
  }
};

// ❌ BAD: Silent failures, generic errors
const processUser = async (userId) => {
  try {
    return await fetchUser(userId);
  } catch (e) {
    console.log(e);
    return null; // Silent failure
  }
};
```

**Rules:**
- Never swallow errors silently
- Use custom error classes for domain-specific errors
- Log errors with context and stack traces
- Validate inputs at function boundaries
- Fail fast for programming errors
- Handle recoverable errors gracefully

### Comments and Code Documentation

```typescript
// ✅ GOOD: JSDoc for public APIs, comments explain WHY
/**
 * Calculates discounted price based on user tier and purchase history.
 *
 * Business logic: Premium users get 15% off, regular users get 5% off
 * after 10 purchases. This implements the loyalty program defined in
 * SPEC-2024-003.
 *
 * @param user - User object with tier and purchase history
 * @param price - Original price in cents
 * @returns Discounted price in cents
 * @throws {ValidationError} If price is negative
 */
const calculateDiscount = (user: User, price: number): number => {
  // Edge case: Free items should never have discounts applied
  if (price === 0) return 0;

  const discountRate = user.tier === 'premium'
    ? 0.15
    : user.purchases >= 10 ? 0.05 : 0;

  return Math.floor(price * (1 - discountRate));
};

// ❌ BAD: Comments explain WHAT (redundant) not WHY
// Calculate discount
const calculateDiscount = (user, price) => {
  // Check if premium
  if (user.tier === 'premium') {
    // Return price with discount
    return price * 0.85;
  }
  return price;
};
```

**Rules:**
- Use JSDoc/docstrings for all public APIs
- Explain WHY, not WHAT (code should be self-explanatory)
- Document non-obvious business logic
- Include examples for complex functions
- Keep comments up-to-date with code changes
- Avoid commented-out code (use version control instead)

---

## File Organization Rules

### Directory Structure

```
project-root/
├── .claude/                    # Claude Code configuration
│   ├── conventions.md         # This file
│   ├── commands/              # Custom slash commands
│   └── hooks/                 # Custom hooks
├── src/                       # Source code
│   ├── modules/               # Feature modules
│   │   ├── users/
│   │   │   ├── user.service.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.repository.ts
│   │   │   ├── user.types.ts
│   │   │   └── user.test.ts
│   │   └── auth/
│   ├── shared/                # Shared utilities
│   │   ├── utils/
│   │   ├── types/
│   │   ├── constants/
│   │   └── errors/
│   ├── config/                # Configuration
│   └── index.ts               # Entry point
├── tests/                     # Test files (mirror src/)
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                      # Documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # Architecture decisions
│   └── guides/                # User guides
├── scripts/                   # Build/utility scripts
├── config/                    # Configuration files
└── dist/                      # Build output (gitignored)
```

### Module Organization

**Each module should be self-contained:**

```
module-name/
├── index.ts                   # Public exports
├── module-name.service.ts     # Business logic
├── module-name.controller.ts  # HTTP/API layer
├── module-name.repository.ts  # Data access
├── module-name.types.ts       # Type definitions
├── module-name.test.ts        # Unit tests
├── module-name.integration.test.ts  # Integration tests
└── utils/                     # Module-specific utilities
```

### File Naming Conventions

#### General Rules
- Use lowercase with hyphens: `user-service.ts`, `auth-middleware.ts`
- Use clear, descriptive names: `email-validator.ts` not `validator.ts`
- Suffix indicates purpose: `.service.ts`, `.controller.ts`, `.test.ts`

#### Specific Patterns

| File Type | Pattern | Example |
|-----------|---------|---------|
| Service | `*.service.ts` | `user.service.ts` |
| Controller | `*.controller.ts` | `auth.controller.ts` |
| Repository | `*.repository.ts` | `user.repository.ts` |
| Types | `*.types.ts` | `api.types.ts` |
| Constants | `*.constants.ts` | `http.constants.ts` |
| Utils | `*.utils.ts` | `date.utils.ts` |
| Middleware | `*.middleware.ts` | `auth.middleware.ts` |
| Unit Tests | `*.test.ts` | `user.test.ts` |
| Integration Tests | `*.integration.test.ts` | `api.integration.test.ts` |
| E2E Tests | `*.e2e.test.ts` | `checkout.e2e.test.ts` |

### Import Organization

```typescript
// 1. External dependencies (alphabetical)
import { Router } from 'express';
import { validate } from 'class-validator';
import axios from 'axios';

// 2. Internal absolute imports (alphabetical)
import { DatabaseService } from '@/shared/database';
import { Logger } from '@/shared/logger';
import { UserService } from '@/modules/users';

// 3. Relative imports (alphabetical)
import { AuthMiddleware } from './auth.middleware';
import { UserController } from './user.controller';
import type { UserDTO } from './user.types';

// 4. Type-only imports last
import type { Request, Response } from 'express';
```

**Rules:**
- Group imports by source (external, internal, relative)
- Alphabetize within each group
- Use absolute imports (`@/`) for cross-module references
- Use relative imports only within the same module
- Keep type-only imports separate

---

## Naming Conventions

### General Principles

1. **Descriptive**: Names should clearly indicate purpose
2. **Consistent**: Follow established patterns
3. **Searchable**: Avoid single-letter names (except loop counters)
4. **Pronounceable**: Use real words, not abbreviations (unless standard)

### TypeScript/JavaScript

#### Variables and Constants

```typescript
// ✅ GOOD
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';
const defaultTimeout = 5000;
let userCount = 0;
const isAuthenticated = true;

// ❌ BAD
const MAX = 3;
const url = 'https://api.example.com';
const t = 5000;
let cnt = 0;
const auth = true;
```

**Rules:**
- `UPPER_SNAKE_CASE` for constants
- `camelCase` for variables and function parameters
- Boolean variables: prefix with `is`, `has`, `should`, `can`
- Arrays: use plural nouns (`users`, `items`)
- Numbers: prefix with `num` or use descriptive suffix (`userCount`)

#### Functions and Methods

```typescript
// ✅ GOOD
const calculateTotalPrice = (items: Item[]): number => { /* ... */ };
const fetchUserById = async (id: string): Promise<User> => { /* ... */ };
const isValidEmail = (email: string): boolean => { /* ... */ };
const handleSubmit = (): void => { /* ... */ };

// ❌ BAD
const calc = (items) => { /* ... */ };
const get = async (id) => { /* ... */ };
const check = (email) => { /* ... */ };
const submit = () => { /* ... */ };
```

**Rules:**
- `camelCase` for functions and methods
- Start with verb: `get`, `set`, `calculate`, `fetch`, `handle`, `process`
- Boolean functions: prefix with `is`, `has`, `should`, `can`
- Event handlers: prefix with `handle` or `on`
- Async functions: make it clear they're async (often with `fetch`, `load`)

#### Classes and Interfaces

```typescript
// ✅ GOOD
class UserService { /* ... */ }
class HttpClient { /* ... */ }
interface UserProfile { /* ... */ }
interface PaymentGateway { /* ... */ }
type UserId = string;
type ApiResponse<T> = { data: T; status: number };

// ❌ BAD
class userservice { /* ... */ }
class client { /* ... */ }
interface user { /* ... */ }
interface gateway { /* ... */ }
```

**Rules:**
- `PascalCase` for classes, interfaces, types, and enums
- Use noun phrases
- Interfaces: describe shape/capability (e.g., `Serializable`, `UserProfile`)
- Classes: describe entity/service (e.g., `UserService`, `EmailValidator`)
- Avoid prefixes like `I` for interfaces (not `IUser`, just `User`)

#### Enums

```typescript
// ✅ GOOD
enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST',
}

enum HttpStatus {
  Ok = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
}

// ❌ BAD
enum roles {
  admin = 'admin',
  user = 'user',
}
```

**Rules:**
- `PascalCase` for enum name
- `PascalCase` for enum members
- Use string or number values explicitly
- Enum name should be singular

### Python

```python
# ✅ GOOD
MAX_RETRY_ATTEMPTS = 3
API_BASE_URL = "https://api.example.com"
default_timeout = 5000
user_count = 0
is_authenticated = True

class UserService:
    """Service for managing users."""
    pass

def calculate_total_price(items: List[Item]) -> Decimal:
    """Calculate total price from items."""
    pass

# ❌ BAD
max = 3
url = "https://api.example.com"
def calc(items):
    pass
```

**Rules:**
- `UPPER_SNAKE_CASE` for constants
- `snake_case` for variables, functions, and module names
- `PascalCase` for classes
- Boolean variables: prefix with `is_`, `has_`, `should_`, `can_`

### Files and Directories

```
✅ GOOD
user-service.ts
auth-middleware.ts
payment-gateway/
email-templates/

❌ BAD
UserService.ts
authMiddleware.ts
PaymentGateway/
emailTemplates/
```

**Rules:**
- `kebab-case` for files and directories
- Match file name to primary export (e.g., `UserService` class in `user-service.ts`)
- Use descriptive names, avoid abbreviations

---

## Documentation Standards

### README Files

Every project and major module should have a README with:

```markdown
# Project/Module Name

Brief one-sentence description.

## Overview

2-3 paragraph explanation of what this does and why it exists.

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`typescript
import { UserService } from './user-service';

const service = new UserService();
const user = await service.findById('123');
\`\`\`

## API Reference

### `UserService`

#### `findById(id: string): Promise<User>`

Finds user by ID.

**Parameters:**
- `id` - User identifier

**Returns:** Promise resolving to User object

**Throws:**
- `NotFoundError` - User not found
- `ValidationError` - Invalid ID format

## Configuration

Environment variables:
- `DATABASE_URL` - Database connection string
- `API_KEY` - Third-party API key

## Testing

\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
```

### API Documentation

Use JSDoc/docstrings for all public APIs:

```typescript
/**
 * Processes payment for an order.
 *
 * This function validates the payment details, charges the payment method,
 * and updates the order status. If payment fails, the order remains in
 * PENDING status.
 *
 * @param orderId - Unique order identifier
 * @param paymentDetails - Payment method and billing information
 * @returns Payment confirmation with transaction ID
 *
 * @throws {ValidationError} If payment details are invalid
 * @throws {PaymentError} If payment processing fails
 * @throws {NotFoundError} If order doesn't exist
 *
 * @example
 * ```typescript
 * const confirmation = await processPayment('order-123', {
 *   method: 'credit_card',
 *   token: 'tok_visa',
 * });
 * console.log(confirmation.transactionId);
 * ```
 *
 * @see {@link https://docs.payment-provider.com/api | Payment Provider API}
 */
async function processPayment(
  orderId: string,
  paymentDetails: PaymentDetails
): Promise<PaymentConfirmation> {
  // Implementation
}
```

**Required for all public functions:**
- Brief description (first line)
- Detailed explanation (if needed)
- All parameters with types and descriptions
- Return value description
- All possible thrown errors
- Example usage (for complex functions)
- Related documentation links

### Architecture Decision Records (ADRs)

For significant architectural decisions, create ADRs in `docs/architecture/`:

```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status

Accepted

## Context

We need to choose a primary database for storing user data, orders, and
product catalog. Requirements:
- ACID compliance for financial transactions
- Support for complex queries and relationships
- Scalability to 10M+ users
- Strong ecosystem and tooling

## Decision

We will use PostgreSQL as our primary database.

## Consequences

### Positive
- Strong ACID guarantees for transactions
- Rich query capabilities with SQL
- Excellent tooling (pgAdmin, monitoring)
- JSON support for flexible schemas
- Large community and expertise available

### Negative
- More complex to scale horizontally than NoSQL
- Requires careful index management
- More expensive than some alternatives

### Neutral
- Team needs PostgreSQL training
- Must set up proper backup/replication

## Alternatives Considered

- **MongoDB**: Better horizontal scaling but weaker transactions
- **MySQL**: Similar features but less advanced (no JSON support)
- **DynamoDB**: Excellent scaling but vendor lock-in

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- Team scaling requirements: SPEC-2024-001
```

### Code Comments

```typescript
// ✅ GOOD: Explain WHY and non-obvious decisions

// Use exponential backoff to avoid overwhelming the API during outages
const retryDelay = baseDelay * Math.pow(2, attemptNumber);

// Round down to avoid overcharging users (company policy)
const finalPrice = Math.floor(calculatedPrice);

// Edge case: Empty cart should skip payment processing entirely
if (cart.items.length === 0) {
  return { status: 'no_payment_required' };
}

// TODO(username): Refactor this to use new payment gateway API v2
// See: https://github.com/company/project/issues/123

// ❌ BAD: Redundant comments that explain WHAT

// Increment counter
counter++;

// Check if user is admin
if (user.role === 'admin') {
  // Return true
  return true;
}
```

**Rules:**
- Explain WHY, not WHAT
- Document edge cases and business rules
- Include references for non-obvious decisions
- Use TODO/FIXME/HACK markers with assignee and issue link
- Keep comments concise and up-to-date

---

## Testing Requirements

### Testing Philosophy

1. **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E tests
2. **Test Behavior**: Test what the code does, not how it does it
3. **Fast Feedback**: Tests should run quickly (<5 minutes for full suite)
4. **Deterministic**: Tests should never be flaky
5. **Isolated**: Tests should not depend on each other

### Coverage Requirements

| Test Type | Minimum Coverage | Target Coverage |
|-----------|-----------------|-----------------|
| Unit | 70% | 85%+ |
| Integration | 50% | 70%+ |
| E2E | Critical paths | All user flows |

### Unit Tests

**What to test:**
- Pure functions and business logic
- Error handling and edge cases
- State transitions
- Input validation

**What NOT to test:**
- Third-party libraries
- Trivial getters/setters
- Configuration files

```typescript
// user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from './user.service';
import { NotFoundError, ValidationError } from '@/shared/errors';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    };
    service = new UserService(mockRepository);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '123', name: 'John' };
      mockRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById('123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw NotFoundError when user not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('123')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid ID', async () => {
      await expect(service.findById('')).rejects.toThrow(ValidationError);
    });

    it('should handle repository errors', async () => {
      mockRepository.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.findById('123')).rejects.toThrow('DB error');
    });
  });
});
```

**Rules:**
- One test file per source file
- Use descriptive test names: `should [expected behavior] when [condition]`
- Test both happy path and error cases
- Use mocks for external dependencies
- Keep tests simple and focused (one assertion per test when possible)
- Use `beforeEach` for common setup
- Clean up resources in `afterEach`

### Integration Tests

**What to test:**
- API endpoints with real database
- Multi-module interactions
- External service integrations (with test instances)

```typescript
// api.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, TestApp } from '@/test-utils';
import { setupTestDatabase, cleanupTestDatabase } from '@/test-utils/database';

describe('User API Integration', () => {
  let app: TestApp;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanupTestDatabase();
  });

  describe('POST /users', () => {
    it('should create user and return 201', async () => {
      const response = await app.request
        .post('/users')
        .send({ name: 'John Doe', email: 'john@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(response.body.id).toBeDefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.request
        .post('/users')
        .send({ name: 'John', email: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email');
    });
  });
});
```

**Rules:**
- Use test database/services, never production
- Clean up after each test
- Test real integration points
- Use test fixtures for complex data
- Run integration tests in CI/CD

### E2E Tests

**What to test:**
- Critical user flows (signup, checkout, etc.)
- Cross-browser compatibility
- Performance benchmarks

```typescript
// checkout.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete purchase successfully', async ({ page }) => {
    // Navigate to product
    await page.goto('/products/123');

    // Add to cart
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // Go to checkout
    await page.click('[data-testid="checkout-button"]');

    // Fill payment info
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');

    // Complete purchase
    await page.click('[data-testid="pay-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Order confirmed');
  });
});
```

**Rules:**
- Use data-testid attributes for selectors
- Test only critical paths
- Keep E2E tests minimal (slow and brittle)
- Run E2E tests in staging environment
- Use visual regression testing for UI

### Test Data Management

```typescript
// test-utils/fixtures.ts
export const fixtures = {
  user: {
    valid: {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'user',
    },
    admin: {
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    },
    invalid: {
      noEmail: { name: 'John' },
      invalidEmail: { name: 'John', email: 'invalid' },
    },
  },

  order: {
    pending: {
      id: 'order-123',
      status: 'pending',
      items: [{ productId: 'prod-1', quantity: 2 }],
    },
  },
};
```

**Rules:**
- Centralize test fixtures
- Use factories for complex object creation
- Avoid hardcoded IDs (use generators)
- Keep test data realistic but minimal

---

## Git Workflow Patterns

### Branch Naming

```
feature/add-user-authentication
bugfix/fix-payment-validation
hotfix/security-patch-cors
refactor/simplify-error-handling
docs/update-api-documentation
test/add-integration-tests
chore/update-dependencies
```

**Pattern:** `<type>/<description>`

**Types:**
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Urgent production fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation only
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

**Rules:**
- Use kebab-case for description
- Keep branch names short but descriptive
- Include issue number if applicable: `feature/123-add-user-auth`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add JWT token refresh mechanism

Implements automatic token refresh to improve user experience.
Users will no longer be logged out unexpectedly.

- Add refresh token endpoint
- Update authentication middleware
- Add token expiry checks

Closes #123
```

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, missing semicolons, etc.
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance
- `perf` - Performance improvement
- `ci` - CI/CD changes

**Rules:**
- First line: max 72 characters
- Use imperative mood: "add" not "added" or "adds"
- Capitalize first letter of subject
- No period at end of subject
- Body: explain WHAT and WHY, not HOW
- Reference issues in footer

### Git Workflow

**Main Branches:**
- `main` (or `master`) - Production-ready code
- `develop` - Integration branch for features

**Supporting Branches:**
- Feature branches: `feature/*`
- Release branches: `release/*`
- Hotfix branches: `hotfix/*`

**Workflow:**

```bash
# 1. Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/add-user-auth

# 2. Make changes and commit
git add .
git commit -m "feat(auth): add user authentication"

# 3. Keep updated with develop
git fetch origin
git rebase origin/develop

# 4. Push and create PR
git push origin feature/add-user-auth
# Create Pull Request on GitHub/GitLab

# 5. After PR approval, merge to develop
# Delete feature branch after merge
git branch -d feature/add-user-auth
```

### Pull Request Guidelines

**PR Title:** Follow commit message format
```
feat(auth): Add JWT authentication
```

**PR Description Template:**
```markdown
## Description

Brief summary of changes.

## Type of Change

- [ ] Bug fix
- [x] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made

- Added JWT authentication middleware
- Updated user service to generate tokens
- Added integration tests for auth endpoints

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Related Issues

Closes #123

## Screenshots (if applicable)

[Add screenshots for UI changes]

## Checklist

- [x] Code follows project conventions
- [x] Self-review completed
- [x] Comments added for complex logic
- [x] Documentation updated
- [x] Tests added/updated
- [x] No breaking changes (or documented)
```

**PR Rules:**
- Keep PRs small (<500 lines changed when possible)
- One feature/fix per PR
- Include tests with code changes
- Update documentation
- Self-review before requesting review
- Respond to review comments promptly
- Squash commits before merging (if messy history)

### Code Review Checklist

**Reviewer responsibilities:**

- [ ] Code follows conventions
- [ ] Logic is correct and handles edge cases
- [ ] Tests are adequate
- [ ] No security vulnerabilities
- [ ] Performance implications considered
- [ ] Documentation is clear
- [ ] No unnecessary complexity
- [ ] Error handling is robust
- [ ] Breaking changes are documented
- [ ] Code is maintainable

**Review feedback format:**
- **Blocking**: Must be fixed before merge
- **Non-blocking**: Nice-to-have improvements
- **Question**: Seeking clarification

```markdown
**Blocking:** This function doesn't handle null values. Add validation.

**Non-blocking:** Consider extracting this logic into a separate function for reusability.

**Question:** Why did you choose this approach over using the existing utility?
```

---

## Agent Coordination Protocols

### Overview

When using Claude Code with MCP tools and agent swarms, follow these protocols to ensure efficient collaboration and avoid conflicts.

### Agent Types and Responsibilities

| Agent Type | Responsibilities | Primary Tools |
|------------|-----------------|---------------|
| **Coordinator** | Orchestrate work, manage dependencies | TodoWrite, task_orchestrate, swarm_init |
| **Researcher** | Analyze requirements, gather context | Read, Grep, Glob, WebSearch |
| **Planner** | Break down tasks, design approach | TodoWrite, architecture diagrams |
| **Coder** | Implement features, write code | Write, Edit, Bash |
| **Tester** | Write/run tests, validate quality | Bash (test runners), Read, Write |
| **Reviewer** | Code review, quality assurance | Read, Grep, analysis tools |

### Agent Communication Protocol

#### 1. Initialization Phase

**Coordinator starts every workflow:**

```bash
# Initialize swarm with appropriate topology
npx claude-flow@alpha mcp start
npx claude-flow@alpha swarm init --topology mesh --max-agents 6

# Set up memory context
npx claude-flow@alpha hooks session-restore --session-id "swarm-$(date +%s)"
```

#### 2. Task Distribution

**Use TodoWrite for task tracking:**

```typescript
TodoWrite({
  todos: [
    {
      id: "research-1",
      content: "Analyze codebase for authentication patterns",
      status: "in_progress",
      activeForm: "Analyzing authentication patterns",
      assignee: "researcher",
      priority: "high"
    },
    {
      id: "design-1",
      content: "Design JWT authentication architecture",
      status: "pending",
      activeForm: "Designing JWT architecture",
      assignee: "planner",
      priority: "high",
      dependsOn: ["research-1"]
    },
    {
      id: "implement-1",
      content: "Implement JWT middleware",
      status: "pending",
      activeForm: "Implementing JWT middleware",
      assignee: "coder",
      priority: "high",
      dependsOn: ["design-1"]
    },
    {
      id: "test-1",
      content: "Write integration tests for authentication",
      status: "pending",
      activeForm: "Writing authentication tests",
      assignee: "tester",
      priority: "medium",
      dependsOn: ["implement-1"]
    },
    {
      id: "review-1",
      content: "Review authentication implementation",
      status: "pending",
      activeForm: "Reviewing authentication code",
      assignee: "reviewer",
      priority: "medium",
      dependsOn: ["test-1"]
    }
  ]
});
```

#### 3. Handoff Protocol

**Before starting work:**

```bash
# Pre-task hook
npx claude-flow@alpha hooks pre-task \
  --description "Implement JWT authentication" \
  --agent-type "coder"
```

**During work:**

```bash
# After each file edit
npx claude-flow@alpha hooks post-edit \
  --file "/path/to/file.ts" \
  --memory-key "swarm/coder/jwt-implementation"

# Notify other agents
npx claude-flow@alpha hooks notify \
  --message "JWT middleware implemented, ready for testing"
```

**After completing work:**

```bash
# Post-task hook
npx claude-flow@alpha hooks post-task \
  --task-id "implement-1" \
  --status "completed"

# Update shared memory
npx claude-flow@alpha memory store \
  --key "swarm/coder/jwt-complete" \
  --value "JWT implementation complete, files: auth.middleware.ts, auth.service.ts"
```

#### 4. Conflict Resolution

**File locking protocol:**

```bash
# Before editing a file, check if another agent is working on it
npx claude-flow@alpha memory retrieve --key "locks/auth.middleware.ts"

# If unlocked, acquire lock
npx claude-flow@alpha memory store \
  --key "locks/auth.middleware.ts" \
  --value "coder-agent-$(date +%s)"

# After editing, release lock
npx claude-flow@alpha memory delete --key "locks/auth.middleware.ts"
```

### Concurrent Operations Rules

#### ✅ ALWAYS Batch Operations in Single Message

```typescript
// ✅ CORRECT: All operations in one message
[
  TodoWrite({ todos: [...5-10 todos...] }),
  Read("/path/to/file1.ts"),
  Read("/path/to/file2.ts"),
  Write("/path/to/new-file.ts", content),
  Edit("/path/to/existing.ts", oldString, newString),
  Bash("npm run build"),
]

// ❌ WRONG: Separate messages
Message 1: TodoWrite({ todos: [single todo] })
Message 2: Read("/path/to/file.ts")
Message 3: Write("/path/to/file.ts")
```

#### Dependency Management

```typescript
// ✅ CORRECT: Independent operations in parallel
[
  Read("/src/module1/file1.ts"),  // Independent
  Read("/src/module2/file2.ts"),  // Independent
  Grep({ pattern: "TODO", output_mode: "files_with_matches" }),  // Independent
]

// ✅ CORRECT: Dependent operations sequentially
// First message
Read("/src/config.ts")

// Wait for response, then second message
Edit("/src/config.ts", oldConfig, newConfig)
Bash("npm run build")  // Depends on edit completing
```

### Agent State Management

**Track agent state in memory:**

```bash
# Agent checks in
npx claude-flow@alpha memory store \
  --key "agents/coder/status" \
  --value '{"status":"active","task":"implement-1","started":"2025-01-15T10:00:00Z"}'

# Agent checks out
npx claude-flow@alpha memory store \
  --key "agents/coder/status" \
  --value '{"status":"idle","lastTask":"implement-1","completed":"2025-01-15T11:00:00Z"}'
```

### Error Handling and Recovery

**If an agent encounters an error:**

```bash
# 1. Log the error
npx claude-flow@alpha hooks notify \
  --message "ERROR: Failed to implement JWT - missing dependency"

# 2. Update task status
TodoWrite({
  todos: [{
    id: "implement-1",
    status: "blocked",
    content: "Implement JWT middleware (BLOCKED: missing jsonwebtoken package)",
    activeForm: "Blocked on missing dependency"
  }]
})

# 3. Create recovery task
TodoWrite({
  todos: [{
    id: "recover-1",
    status: "in_progress",
    content: "Install jsonwebtoken dependency",
    activeForm: "Installing dependencies",
    priority: "urgent"
  }]
})
```

### Performance Optimization

**Use hooks for automation:**

```bash
# Auto-assign agents based on file type
# In .claude/hooks/pre-task.sh
if [[ $FILE == *.test.ts ]]; then
  AGENT="tester"
elif [[ $FILE == *.service.ts ]]; then
  AGENT="coder"
fi
```

**Monitor performance:**

```bash
# Check agent metrics
npx claude-flow@alpha agent metrics --agent-id "coder-1"

# Check task bottlenecks
npx claude-flow@alpha task status --show-bottlenecks
```

---

## Git Worktree Usage Guidelines

### Overview

Git worktrees allow you to check out multiple branches simultaneously in different directories, enabling parallel development without constant branch switching.

### When to Use Worktrees

**Use worktrees for:**
- Working on multiple features simultaneously
- Testing features while developing others
- Emergency hotfixes while feature work is in progress
- Comparing implementations side-by-side
- Running long-running processes (builds, tests) while continuing work

**Don't use worktrees for:**
- Simple branch switching (use `git checkout`)
- Short-lived tasks (<1 hour)
- When you have uncommitted changes (commit or stash first)

### Worktree Setup

#### Directory Structure

```
project/                          # Main worktree
├── .git/                        # Git repository
├── src/
└── ...

project-worktrees/               # Container for additional worktrees
├── feature-auth/               # Worktree for feature/add-auth
│   ├── src/
│   └── ...
├── bugfix-payment/             # Worktree for bugfix/payment-error
│   ├── src/
│   └── ...
└── hotfix-security/            # Worktree for hotfix/security-patch
    ├── src/
    └── ...
```

#### Creating Worktrees

```bash
# Create a new worktree for a new branch
git worktree add ../project-worktrees/feature-auth -b feature/add-auth

# Create worktree for existing branch
git worktree add ../project-worktrees/bugfix-payment bugfix/payment-error

# Create worktree from remote branch
git worktree add ../project-worktrees/review-pr origin/feature/pr-123
```

#### Managing Worktrees

```bash
# List all worktrees
git worktree list

# Output:
# /Users/dev/project              abc123 [main]
# /Users/dev/project-worktrees/feature-auth   def456 [feature/add-auth]
# /Users/dev/project-worktrees/bugfix-payment ghi789 [bugfix/payment-error]

# Remove a worktree (after committing/pushing work)
git worktree remove ../project-worktrees/feature-auth

# Or delete directory and prune
rm -rf ../project-worktrees/feature-auth
git worktree prune
```

### Worktree Workflows

#### Parallel Feature Development

```bash
# Main worktree: working on feature A
cd /Users/dev/project
git checkout -b feature/add-auth
# ... make changes ...

# Need to start feature B without interrupting feature A
git worktree add ../project-worktrees/feature-notifications -b feature/add-notifications
cd ../project-worktrees/feature-notifications
# ... work on feature B ...

# Both features can be developed, built, and tested independently
```

#### Emergency Hotfix Workflow

```bash
# Currently working on a feature
cd /Users/dev/project
git checkout feature/large-refactor
# ... working on complex changes, not ready to commit ...

# Emergency: production bug needs immediate fix
git worktree add ../project-worktrees/hotfix-urgent -b hotfix/fix-critical-bug main
cd ../project-worktrees/hotfix-urgent

# Fix the bug
# ... make changes ...
git add .
git commit -m "fix: resolve critical production bug"
git push origin hotfix/fix-critical-bug

# Create PR, get it merged
# Return to feature work without losing context
cd /Users/dev/project
# ... continue feature work ...

# Clean up after hotfix is merged
git worktree remove ../project-worktrees/hotfix-urgent
```

#### Code Review Workflow

```bash
# Create worktree to review a PR
git fetch origin
git worktree add ../project-worktrees/review-pr-123 origin/feature/new-api

cd ../project-worktrees/review-pr-123

# Review code, run tests, make comments
npm install
npm test
npm run lint

# Can even make suggested changes in a new branch
git checkout -b review-suggestions
# ... make changes ...
git push origin review-suggestions

# Clean up after review
cd /Users/dev/project
git worktree remove ../project-worktrees/review-pr-123
```

### Best Practices

#### 1. Consistent Naming

```bash
# ✅ GOOD: Clear, consistent naming
git worktree add ../project-worktrees/feature-user-auth -b feature/add-user-auth
git worktree add ../project-worktrees/bugfix-payment -b bugfix/fix-payment-error
git worktree add ../project-worktrees/hotfix-security -b hotfix/security-patch

# ❌ BAD: Inconsistent, unclear naming
git worktree add ../temp1 -b feature/add-user-auth
git worktree add ../fix -b bugfix/fix-payment-error
```

#### 2. Resource Management

```bash
# Each worktree has its own:
# - node_modules/
# - Build artifacts
# - Running processes

# ✅ GOOD: Install dependencies separately
cd /Users/dev/project-worktrees/feature-auth
npm install

# ❌ BAD: Symlinking node_modules (can cause conflicts)
ln -s ../../project/node_modules node_modules
```

#### 3. Cleanup Regularly

```bash
# Weekly cleanup: remove merged branches
git worktree list | grep -v main | while read path hash branch; do
  if git branch -r --merged | grep -q "$branch"; then
    echo "Removing merged worktree: $path"
    git worktree remove "$path"
  fi
done

# Prune deleted worktrees
git worktree prune
```

#### 4. Shared Configuration

```bash
# Global git config is shared across all worktrees
# Worktree-specific config should be in .git/worktrees/<name>/config

# Set worktree-specific config
cd /Users/dev/project-worktrees/feature-auth
git config user.email "feature-work@example.com"  # Only affects this worktree
```

### Integration with Agent Workflows

**When using agents with worktrees:**

```bash
# Agent Coordinator: Create worktree for parallel implementation
git worktree add ../project-worktrees/agent-feature-1 -b feature/parallel-impl-1
git worktree add ../project-worktrees/agent-feature-2 -b feature/parallel-impl-2

# Agent 1 works in first worktree
npx claude-flow@alpha hooks pre-task \
  --description "Implement feature variant 1" \
  --workspace "../project-worktrees/agent-feature-1"

# Agent 2 works in second worktree simultaneously
npx claude-flow@alpha hooks pre-task \
  --description "Implement feature variant 2" \
  --workspace "../project-worktrees/agent-feature-2"

# Both agents work independently without conflicts
# Compare implementations after completion
git diff feature/parallel-impl-1 feature/parallel-impl-2
```

### Common Issues and Solutions

#### Issue: "Cannot add worktree - already exists"

```bash
# Solution: Prune deleted worktrees
git worktree prune

# Or remove specific worktree reference
git worktree remove ../project-worktrees/old-feature
```

#### Issue: "Branch already checked out"

```bash
# Solution: Can't check out same branch in multiple worktrees
# Create new branch from existing one
git worktree add ../project-worktrees/feature-copy -b feature/copy feature/original
```

#### Issue: Large disk usage with multiple worktrees

```bash
# Solution: Use git gc to reduce size
cd /Users/dev/project
git gc --aggressive

# Share object database (worktrees already do this automatically)
# Each worktree uses the same .git/objects
```

---

## Summary Checklist

Before committing code, verify:

- [ ] **Code Style**: Follows language-specific conventions
- [ ] **File Organization**: Files in correct directories with proper naming
- [ ] **Naming**: Variables, functions, classes follow conventions
- [ ] **Documentation**: Public APIs have JSDoc/docstrings
- [ ] **Tests**: Unit tests written, coverage meets requirements
- [ ] **Git**: Proper branch name and commit message format
- [ ] **Review**: Self-review completed, no obvious issues
- [ ] **Agents**: If using MCP, followed coordination protocols
- [ ] **Worktrees**: If used, properly managed and cleaned up

---

## Maintenance

This conventions document should be:
- **Reviewed**: Quarterly or when adding new technologies
- **Updated**: When team agrees on new patterns
- **Enforced**: Through PR reviews and automated linting
- **Referenced**: In onboarding and documentation

**Last Updated:** 2025-01-21
**Next Review:** 2025-04-21
