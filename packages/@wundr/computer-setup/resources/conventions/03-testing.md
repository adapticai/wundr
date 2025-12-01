# Testing Conventions

**Version**: 1.0.0 **Last Updated**: 2024-11-21 **Category**: Quality Assurance

This document defines testing standards, patterns, and MCP tool integration for test coverage
management.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Organization](#test-organization)
3. [Test Naming](#test-naming)
4. [Test Structure](#test-structure)
5. [Mocking Patterns](#mocking-patterns)
6. [Coverage Requirements](#coverage-requirements)
7. [MCP Tool Integration](#mcp-tool-integration)
8. [Enforcement](#enforcement)

---

## Testing Philosophy

### Test-Driven Development (TDD)

**The TDD Cycle:**

1. **RED**: Write a failing test
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code while tests pass

**Benefits:**

- Tests document expected behavior
- Forces modular, testable design
- Prevents over-engineering
- Builds confidence in changes

### Testing Pyramid

```
         /\
        /  \      E2E Tests (few)
       /----\     - Critical user journeys
      /      \    - Slow, expensive
     /--------\   Integration Tests (some)
    /          \  - Component interactions
   /------------\ - Database, API tests
  /              \ Unit Tests (many)
 /________________\ - Fast, isolated
                   - Business logic
```

**Distribution Target:**

- Unit Tests: 70%
- Integration Tests: 20%
- E2E Tests: 10%

---

## Test Organization

### Directory Structure

```
project-root/
├── src/
│   ├── services/
│   │   └── user.service.ts
│   └── utils/
│       └── validation.ts
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   └── user.service.test.ts
│   │   └── utils/
│   │       └── validation.test.ts
│   ├── integration/
│   │   └── api/
│   │       └── users.api.test.ts
│   └── e2e/
│       └── user-flow.e2e.test.ts
└── src/
    └── components/
        └── UserProfile/
            ├── UserProfile.tsx
            └── UserProfile.test.tsx  # Co-located test
```

### File Naming

| Test Type   | Pattern                 | Example                   |
| ----------- | ----------------------- | ------------------------- |
| Unit        | `*.test.ts`             | `user.service.test.ts`    |
| Integration | `*.integration.test.ts` | `api.integration.test.ts` |
| E2E         | `*.e2e.test.ts`         | `checkout.e2e.test.ts`    |
| Spec style  | `*.spec.ts`             | `user.spec.ts`            |

### Co-location vs Separation

**Co-locate for:**

- Component tests (React, Vue)
- Simple utility tests
- Tests tightly coupled to implementation

**Separate in `/tests/` for:**

- Integration tests
- E2E tests
- Tests spanning multiple modules

---

## Test Naming

### Describe Blocks

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    describe('when input is valid', () => {
      it('should create user with correct properties', () => {});
      it('should hash the password', () => {});
    });

    describe('when input is invalid', () => {
      it('should throw ValidationError for missing email', () => {});
      it('should throw ValidationError for invalid email format', () => {});
    });
  });
});
```

### Test Names

**Use `should` + expected behavior:**

```typescript
// Good: clear expected behavior
it('should return user by id', () => {});
it('should throw NotFoundError when user does not exist', () => {});
it('should hash password before saving', () => {});

// Avoid: vague or implementation-focused
it('works correctly', () => {});
it('calls hashPassword function', () => {});
```

**Include context when helpful:**

```typescript
it('should apply 10% discount when user has 10+ purchases', () => {});
it('should rate limit requests exceeding 100/minute', () => {});
```

---

## Test Structure

### AAA Pattern (Arrange-Act-Assert)

```typescript
describe('calculateTotal', () => {
  it('should calculate total with tax', () => {
    // Arrange
    const items = [
      { name: 'Widget', price: 10, quantity: 2 },
      { name: 'Gadget', price: 5, quantity: 3 },
    ];
    const taxRate = 0.08;

    // Act
    const total = calculateTotal(items, { taxRate });

    // Assert
    expect(total).toBe(37.8); // 35 + 8% tax
  });
});
```

### Setup and Teardown

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockDb: MockDatabase;

  beforeAll(async () => {
    // One-time setup (e.g., start test database)
    await setupTestDatabase();
  });

  afterAll(async () => {
    // One-time cleanup
    await teardownTestDatabase();
  });

  beforeEach(() => {
    // Per-test setup
    mockDb = createMockDatabase();
    service = new UserService(mockDb);
  });

  afterEach(() => {
    // Per-test cleanup
    jest.clearAllMocks();
  });

  it('should get user by id', async () => {
    mockDb.users.findById.mockResolvedValue({ id: '1', name: 'John' });

    const user = await service.getUser('1');

    expect(user.name).toBe('John');
  });
});
```

### Test Fixtures

```typescript
// tests/fixtures/users.ts
export const validUser = {
  id: 'test-user-1',
  name: 'Test User',
  email: 'test@example.com',
  createdAt: new Date('2024-01-01'),
};

export const invalidUserInput = {
  name: '', // Invalid: empty
  email: 'not-an-email', // Invalid: bad format
};

// Usage
import { validUser, invalidUserInput } from './fixtures/users';

it('should validate user input', () => {
  expect(() => validateUser(invalidUserInput)).toThrow(ValidationError);
});
```

---

## Mocking Patterns

### Module Mocks

```typescript
// Mock entire module
jest.mock('@/services/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock specific functions
jest.mock('@/utils/logger', () => ({
  ...jest.requireActual('@/utils/logger'),
  error: jest.fn(),
}));
```

### Manual Mocks

```typescript
// __mocks__/database.ts
export class MockDatabase {
  users = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

export const createMockDatabase = () => new MockDatabase();
```

### Spy Functions

```typescript
// Spy on existing implementation
const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

// Verify calls
expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error));

// Restore
consoleSpy.mockRestore();
```

### Test Doubles

```typescript
// Factory function for test doubles
function createMockUserService(overrides = {}): UserService {
  return {
    getUser: jest.fn().mockResolvedValue(validUser),
    createUser: jest.fn().mockResolvedValue(validUser),
    updateUser: jest.fn().mockResolvedValue(validUser),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Usage with override
const mockService = createMockUserService({
  getUser: jest.fn().mockRejectedValue(new NotFoundError()),
});
```

---

## Coverage Requirements

### Minimum Thresholds

| Metric     | Minimum | Target |
| ---------- | ------- | ------ |
| Lines      | 80%     | 90%    |
| Branches   | 75%     | 85%    |
| Functions  | 80%     | 90%    |
| Statements | 80%     | 90%    |

### Critical Path Coverage

**100% coverage required for:**

- Authentication logic
- Authorization checks
- Payment processing
- Data validation
- Error handling paths

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Stricter for critical paths
    './src/services/auth/**/*.ts': {
      branches: 90,
      functions: 100,
      lines: 95,
      statements: 95,
    },
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
};
```

---

## MCP Tool Integration

### Test Baseline Management

**Create Coverage Baseline:**

```javascript
// Establish baseline at project milestone
mcp__wundr__test_baseline {
  action: "create",
  testType: "all",
  threshold: 80
}

// Create baseline for specific test type
mcp__wundr__test_baseline {
  action: "create",
  testType: "unit",
  threshold: 85
}
```

**Compare Against Baseline:**

```javascript
// Check for coverage regression
mcp__wundr__test_baseline {
  action: "compare",
  testType: "all"
}

// Output indicates:
// - REGRESSION: Coverage dropped
// - STABLE: Coverage maintained
// - IMPROVED: Coverage increased
```

**Update Baseline:**

```javascript
// Update baseline after improvements
mcp__wundr__test_baseline {
  action: "update",
  testType: "all",
  threshold: 85  // Increase threshold
}
```

### Quality Reporting

```javascript
// Generate quality report including test metrics
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Weekly report with test coverage trends
mcp__wundr__governance_report {
  reportType: "weekly",
  period: "7d"
}
```

### Pre-Merge Workflow

```javascript
// Pre-merge test verification
[BatchTool]:
  // 1. Compare test coverage against baseline
  mcp__wundr__test_baseline {
    action: "compare",
    testType: "all"
  }

  // 2. Check code quality drift
  mcp__wundr__drift_detection {
    action: "detect"
  }

  // 3. Verify compliance
  mcp__wundr__governance_report {
    reportType: "compliance"
  }
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Coverage Check

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Tests
        run: npm run test:coverage

      - name: Check Coverage Baseline
        run: |
          # MCP tool integration via CLI
          wundr-cli test-baseline compare --type all

      - name: Generate Quality Report
        run: |
          wundr-cli governance-report --type quality --format markdown
```

---

## Enforcement

### Pre-commit Hooks

```bash
#!/bin/sh
# .husky/pre-commit

# Run tests
npm run test

# Check coverage meets threshold
npm run test:coverage

# MCP baseline check (if available)
wundr-cli test-baseline compare --type all || exit 1
```

### CI Requirements

- All tests must pass
- Coverage must meet thresholds
- No coverage regression allowed
- New code must have tests

### Review Checklist

- [ ] New features have corresponding tests
- [ ] Test names clearly describe expected behavior
- [ ] Mocks are appropriate and not over-mocking
- [ ] Edge cases are tested
- [ ] Error conditions are tested
- [ ] Coverage hasn't regressed

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [04-error-handling.md](./04-error-handling.md) - Error handling patterns
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [Error Handling Conventions](./04-error-handling.md)
