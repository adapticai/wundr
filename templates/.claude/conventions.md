# Project Coding Conventions

This document defines the coding standards, naming conventions, and architectural patterns for this project.

## Table of Contents

1. [General Principles](#general-principles)
2. [Naming Conventions](#naming-conventions)
3. [Code Organization](#code-organization)
4. [TypeScript/JavaScript](#typescriptjavascript)
5. [React/Vue/Framework](#reactvueframework)
6. [API Design](#api-design)
7. [Database](#database)
8. [Testing](#testing)
9. [Documentation](#documentation)
10. [Git Conventions](#git-conventions)

## General Principles

### Code Quality Standards

1. **Readability First**: Code is read more than written
2. **Explicit Over Implicit**: Clear intent over clever tricks
3. **DRY (Don't Repeat Yourself)**: Extract reusable logic
4. **KISS (Keep It Simple)**: Simple solutions over complex ones
5. **YAGNI (You Aren't Gonna Need It)**: Don't add unused features

### File Size Limits

- **Maximum file size**: 500 lines
- **Maximum function size**: 50 lines
- **Maximum function parameters**: 5 parameters (use objects for more)

### Code Complexity

- **Cyclomatic complexity**: Maximum 10 per function
- **Nesting depth**: Maximum 4 levels
- **Line length**: Maximum 100 characters

## Naming Conventions

### General Rules

- Use descriptive, meaningful names
- Avoid abbreviations unless widely known
- Use consistent terminology across codebase
- Avoid Hungarian notation

### Case Conventions

**camelCase**: Variables, functions, methods
```javascript
const userName = 'John';
function calculateTotal() {}
```

**PascalCase**: Classes, interfaces, types, components
```typescript
class UserService {}
interface UserProfile {}
type ApiResponse = {};
```

**UPPER_SNAKE_CASE**: Constants, environment variables
```typescript
const MAX_RETRIES = 3;
const API_BASE_URL = process.env.API_BASE_URL;
```

**kebab-case**: File names, CSS classes, URLs
```
user-profile.component.tsx
user-service.ts
/api/user-profiles
```

### Specific Naming Patterns

**Boolean variables**: Use `is`, `has`, `should` prefixes
```typescript
const isAuthenticated = true;
const hasPermission = false;
const shouldUpdate = true;
```

**Functions**: Use verb prefixes
```typescript
function getUser() {}
function setUserName() {}
function validateEmail() {}
function handleClick() {}
```

**Event handlers**: Use `handle` or `on` prefix
```typescript
function handleSubmit() {}
function onUserLogin() {}
```

**Arrays**: Use plural nouns
```typescript
const users = [];
const errorMessages = [];
```

**Private members**: Use underscore prefix (TypeScript)
```typescript
class User {
  private _internalState: string;
}
```

## Code Organization

### Directory Structure

<!-- CUSTOMIZE: Match your CLAUDE.md structure -->
```
src/
├── components/          # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.styles.ts
│   │   └── index.ts
│   └── index.ts
├── features/            # Feature-based modules
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── index.ts
├── services/            # Business logic and API clients
├── utils/               # Pure utility functions
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── constants/           # Application constants
├── config/              # Configuration files
└── index.ts
```

### Import Organization

**Order of imports**:
1. External dependencies (React, libraries)
2. Internal modules (services, utils)
3. Relative imports (components, hooks)
4. Type imports
5. Styles

```typescript
// External dependencies
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal modules
import { apiClient } from '@/services/api';
import { formatDate } from '@/utils/date';

// Relative imports
import { Button } from '../Button';
import { useAuth } from './useAuth';

// Type imports
import type { User, UserProfile } from '@/types';

// Styles
import styles from './Component.module.css';
```

### Module Exports

**Use named exports** (preferred):
```typescript
export function formatDate() {}
export const MAX_LENGTH = 100;
```

**Default exports** for components only:
```typescript
export default function UserProfile() {}
```

**Barrel exports** for clean imports:
```typescript
// components/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
```

## TypeScript/JavaScript

### TypeScript Usage

**Always use TypeScript**:
- Enable strict mode
- No implicit any
- Use interfaces for objects
- Use type for unions/intersections

**Type Definitions**:
```typescript
// Interface for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Type for unions/intersections
type Status = 'pending' | 'active' | 'inactive';
type UserWithStatus = User & { status: Status };

// Generic types
interface ApiResponse<T> {
  data: T;
  error?: string;
}
```

### Variable Declarations

**Prefer const, then let, never var**:
```typescript
const immutableValue = 'constant';
let mutableValue = 'variable';
```

### Function Declarations

**Use function declarations for top-level functions**:
```typescript
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Use arrow functions for callbacks and inline functions**:
```typescript
const numbers = [1, 2, 3];
const doubled = numbers.map(n => n * 2);
```

### Async/Await

**Prefer async/await over promises**:
```typescript
// Good
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch user');
  }
}

// Avoid
function fetchUser(id: string): Promise<User> {
  return apiClient.get(`/users/${id}`)
    .then(response => response.data)
    .catch(error => {
      throw new Error('Failed to fetch user');
    });
}
```

### Error Handling

**Always handle errors explicitly**:
```typescript
// Good
async function processData() {
  try {
    const data = await fetchData();
    return processResult(data);
  } catch (error) {
    logger.error('Data processing failed', { error });
    throw new ApplicationError('Unable to process data', { cause: error });
  }
}
```

### Object and Array Operations

**Use spread operator and destructuring**:
```typescript
// Spread
const newUser = { ...oldUser, name: 'Updated' };
const merged = [...array1, ...array2];

// Destructuring
const { id, name, email } = user;
const [first, second, ...rest] = array;
```

**Use optional chaining and nullish coalescing**:
```typescript
const userName = user?.profile?.name ?? 'Anonymous';
const count = data?.items?.length ?? 0;
```

## React/Vue/Framework

<!-- CUSTOMIZE: Choose your framework conventions -->

### React Conventions

**Functional components only**:
```typescript
interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export function UserProfile({ userId, onUpdate }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return (
    <div className="user-profile">
      {user && <h1>{user.name}</h1>}
    </div>
  );
}
```

**Custom hooks**:
```typescript
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}
```

**Component organization**:
1. Imports
2. Type definitions
3. Component function
4. Styled components / CSS modules
5. Export

### State Management

**Local state**: Use `useState` for component-specific state
**Shared state**: Use Context API or state management library
**Server state**: Use React Query or SWR

```typescript
// Local state
const [count, setCount] = useState(0);

// Context
const theme = useContext(ThemeContext);

// Server state
const { data, isLoading } = useQuery(['users'], fetchUsers);
```

## API Design

### REST API Conventions

**URL Structure**:
```
GET    /api/users              # List users
GET    /api/users/:id          # Get user
POST   /api/users              # Create user
PUT    /api/users/:id          # Update user (full)
PATCH  /api/users/:id          # Update user (partial)
DELETE /api/users/:id          # Delete user
```

**Request/Response Format**:
```typescript
// Request
interface CreateUserRequest {
  name: string;
  email: string;
}

// Response (success)
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    total?: number;
  };
}

// Response (error)
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

**HTTP Status Codes**:
- `200`: Success (GET, PUT, PATCH)
- `201`: Created (POST)
- `204`: No Content (DELETE)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

### GraphQL Conventions

<!-- CUSTOMIZE: If using GraphQL -->
```graphql
# Queries
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
  }
}

# Mutations
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    user {
      id
      name
    }
    errors {
      field
      message
    }
  }
}
```

## Database

### Table Naming

- Use lowercase with underscores
- Use plural for table names
- Use singular for column names

```sql
-- Tables
users
user_profiles
order_items

-- Columns
id
user_name
created_at
```

### Primary Keys

- Use `id` as primary key name
- Use UUIDs or auto-incrementing integers
- Never expose sequential IDs externally

### Foreign Keys

- Use `{table}_id` format
- Add proper indexes
- Define ON DELETE and ON UPDATE behavior

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Timestamps

Always include:
- `created_at`: Record creation time
- `updated_at`: Last modification time
- Optional: `deleted_at` for soft deletes

## Testing

### Test File Organization

```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx    # Co-located tests
tests/
├── unit/                       # Unit tests
├── integration/                # Integration tests
└── e2e/                        # End-to-end tests
```

### Test Naming

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Test implementation
    });

    it('should throw error when email is invalid', async () => {
      // Test implementation
    });
  });
});
```

### Test Structure (AAA Pattern)

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 }
  ];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(35);
});
```

### Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for critical paths
- Test edge cases and error conditions
- Mock external dependencies

## Documentation

### Code Comments

**When to comment**:
- Complex algorithms
- Non-obvious business logic
- Workarounds and hacks
- Public APIs

**When NOT to comment**:
- Self-explanatory code
- Redundant information
- Outdated comments (delete them)

```typescript
// Good: Explains WHY
// Using binary search because dataset can exceed 10k items
function findUser(users: User[], id: string): User | undefined {
  // Implementation
}

// Bad: Explains WHAT (already obvious)
// Loop through users
for (const user of users) {
  // Process user
}
```

### JSDoc for Public APIs

```typescript
/**
 * Calculates the total price of items including tax and discounts.
 *
 * @param items - Array of items to calculate total for
 * @param options - Optional calculation parameters
 * @param options.taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @param options.discountCode - Optional discount code to apply
 * @returns Total price including all adjustments
 * @throws {ValidationError} If items array is empty
 *
 * @example
 * ```typescript
 * const total = calculateTotal(
 *   [{ price: 100, quantity: 2 }],
 *   { taxRate: 0.08 }
 * );
 * // Returns: 216 (200 + 8% tax)
 * ```
 */
export function calculateTotal(
  items: Item[],
  options?: CalculationOptions
): number {
  // Implementation
}
```

### README Structure

Every module/package should have a README with:
1. Purpose and overview
2. Installation instructions
3. Usage examples
4. API documentation
5. Configuration options
6. Contributing guidelines

## Git Conventions

### Branch Naming

```
feature/user-authentication
bugfix/login-validation
hotfix/security-patch
refactor/database-queries
docs/api-documentation
```

### Commit Messages (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples**:
```
feat(auth): add OAuth2 authentication

Implement OAuth2 login flow with Google and GitHub providers.
Includes token refresh and session management.

Closes #123
```

```
fix(api): handle null response from user service

Add null check before accessing user data to prevent
runtime errors when service returns empty response.
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
```

## Code Review Guidelines

### What to Look For

**Functionality**:
- Does it work as intended?
- Are edge cases handled?
- Are errors handled properly?

**Code Quality**:
- Follows conventions?
- Well-structured and readable?
- Appropriate abstractions?

**Testing**:
- Adequate test coverage?
- Tests are meaningful?
- Tests are maintainable?

**Documentation**:
- Public APIs documented?
- Complex logic explained?
- README updated if needed?

### Review Etiquette

- Be respectful and constructive
- Explain WHY, not just WHAT
- Suggest alternatives, don't demand
- Approve when good enough, not perfect
- Respond to feedback promptly

## Enforcement

These conventions are enforced through:

1. **Linting**: ESLint, Prettier
2. **Type checking**: TypeScript strict mode
3. **Testing**: Minimum coverage requirements
4. **Code review**: Manual review process
5. **CI/CD**: Automated checks on pull requests

## Questions and Updates

- Questions about conventions? Ask in team chat
- Propose changes via pull request
- Review and update conventions quarterly

---

**Last Updated**: [Date]
**Version**: 1.0.0
