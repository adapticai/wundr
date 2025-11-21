# TypeScript/JavaScript Conventions

**Version**: 1.0.0
**Last Updated**: 2024-11-21
**Category**: Language Conventions

This document defines TypeScript and JavaScript coding standards with MCP tool integration.

---

## Table of Contents

1. [TypeScript Configuration](#typescript-configuration)
2. [Type Definitions](#type-definitions)
3. [Variables and Functions](#variables-and-functions)
4. [Async/Await Patterns](#asyncawait-patterns)
5. [Module Organization](#module-organization)
6. [MCP Tool Integration](#mcp-tool-integration)
7. [Enforcement](#enforcement)

---

## TypeScript Configuration

### Recommended `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Strict Mode Requirements

**ALWAYS enable:**
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

---

## Type Definitions

### Interface vs Type

**Use `interface` for object shapes:**
```typescript
// Good: interfaces for objects
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface UserService {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
}
```

**Use `type` for unions, intersections, and utilities:**
```typescript
// Good: types for unions and complex types
type Status = 'pending' | 'active' | 'inactive';
type UserWithStatus = User & { status: Status };
type Nullable<T> = T | null;
type AsyncResult<T> = Promise<Result<T>>;
```

### Generic Types

**Define reusable generic types:**
```typescript
// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    total?: number;
    timestamp: string;
  };
}

// Result type for operations
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
async function fetchUser(id: string): Promise<ApiResponse<User>> {
  // Implementation
}
```

### Type Inference

**Let TypeScript infer when obvious:**
```typescript
// Good: inference is clear
const name = 'John';
const count = 42;
const items = [1, 2, 3];

// Good: explicit when complex
const config: ServerConfig = {
  port: 3000,
  host: 'localhost',
};

// Avoid: redundant typing
const name: string = 'John'; // Type is obvious
```

---

## Variables and Functions

### Variable Declarations

**Prefer `const`, then `let`, NEVER `var`:**
```typescript
// Good
const immutableValue = 'constant';
let mutableValue = 'variable';

// Never
var legacyValue = 'deprecated'; // NEVER use var
```

### Function Declarations

**Top-level functions: use declarations:**
```typescript
// Good: function declaration for top-level
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Callbacks and inline: use arrow functions:**
```typescript
// Good: arrow functions for callbacks
const doubled = numbers.map(n => n * 2);

const onClick = (event: MouseEvent) => {
  handleEvent(event);
};
```

**Methods: use method shorthand:**
```typescript
// Good: method shorthand in objects/classes
const service = {
  getUser(id: string) {
    return this.db.find(id);
  },
};
```

### Function Parameters

**Limit to 3 parameters, use objects for more:**
```typescript
// Good: object parameter for many options
interface CreateUserOptions {
  name: string;
  email: string;
  role?: UserRole;
  team?: string;
  permissions?: string[];
}

function createUser(options: CreateUserOptions): User {
  const { name, email, role = 'user' } = options;
  // Implementation
}

// Avoid: too many parameters
function createUser(
  name: string,
  email: string,
  role: string,
  team: string,
  permissions: string[]
): User {
  // Hard to read and maintain
}
```

---

## Async/Await Patterns

### Prefer async/await

```typescript
// Good: async/await
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch user', { id, error });
    throw new FetchError('Unable to fetch user', { cause: error });
  }
}

// Avoid: promise chains
function fetchUser(id: string): Promise<User> {
  return apiClient.get(`/users/${id}`)
    .then(response => response.data)
    .catch(error => {
      logger.error('Failed to fetch user', { id, error });
      throw new FetchError('Unable to fetch user', { cause: error });
    });
}
```

### Parallel Operations

```typescript
// Good: parallel with Promise.all
async function fetchUserData(userId: string): Promise<UserData> {
  const [user, profile, settings] = await Promise.all([
    fetchUser(userId),
    fetchProfile(userId),
    fetchSettings(userId),
  ]);

  return { user, profile, settings };
}

// Good: handle partial failures with Promise.allSettled
async function fetchMultipleUsers(ids: string[]): Promise<User[]> {
  const results = await Promise.allSettled(ids.map(fetchUser));

  const users: User[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      users.push(result.value);
    } else {
      logger.warn('Failed to fetch user', { error: result.reason });
    }
  }

  return users;
}
```

---

## Module Organization

### Import Order

Organize imports in this order:
1. External dependencies (React, libraries)
2. Internal modules (services, utils)
3. Relative imports (components, hooks)
4. Type imports
5. Styles

```typescript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 2. Internal modules
import { apiClient } from '@/services/api';
import { formatDate } from '@/utils/date';
import { logger } from '@/utils/logger';

// 3. Relative imports
import { Button } from '../Button';
import { useAuth } from './useAuth';
import { UserCard } from './UserCard';

// 4. Type imports
import type { User, UserProfile } from '@/types';
import type { ButtonProps } from '../Button';

// 5. Styles
import styles from './Component.module.css';
```

### Export Patterns

**Named exports (preferred):**
```typescript
// services/user.ts
export function getUser(id: string): Promise<User> {}
export function updateUser(id: string, data: Partial<User>): Promise<User> {}
export const USER_CACHE_TTL = 3600;
```

**Default exports for components:**
```typescript
// components/UserProfile.tsx
export default function UserProfile({ user }: UserProfileProps) {
  return <div>{user.name}</div>;
}
```

**Barrel exports:**
```typescript
// components/index.ts
export { default as UserProfile } from './UserProfile';
export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
```

---

## MCP Tool Integration

### Pattern Standardization

Use MCP tools to enforce TypeScript patterns:

**Check and Fix Patterns:**
```javascript
// Check for pattern violations
mcp__wundr__pattern_standardize {
  action: "check",
  rules: [
    "async-await-pattern",      // Convert promise chains
    "import-ordering",           // Fix import order
    "naming-conventions",        // Enforce naming
    "optional-chaining",         // Use optional chaining
    "type-assertions"            // Use 'as' keyword
  ]
}

// Auto-fix patterns
mcp__wundr__pattern_standardize {
  action: "run",
  rules: ["async-await-pattern", "import-ordering"]
}

// Preview changes first
mcp__wundr__pattern_standardize {
  action: "run",
  dryRun: true
}
```

**Pattern Rules Explained:**

| Rule | What it does | Example |
|------|-------------|---------|
| `async-await-pattern` | Converts `.then()` chains to async/await | `.then(x => x)` -> `await` |
| `import-ordering` | Sorts imports by category | Groups external, internal, relative |
| `naming-conventions` | Fixes naming violations | `user_name` -> `userName` |
| `optional-chaining` | Uses `?.` where applicable | `obj && obj.prop` -> `obj?.prop` |
| `type-assertions` | Uses `as` keyword | `<Type>value` -> `value as Type` |

### Quality Monitoring

```javascript
// Monitor code quality over time
mcp__wundr__drift_detection {
  action: "detect"
}

// Generate quality report
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}
```

### Pre-Commit Integration

```javascript
// Pre-commit TypeScript check workflow
[BatchTool]:
  // 1. Fix patterns automatically
  mcp__wundr__pattern_standardize {
    action: "run",
    rules: ["import-ordering", "naming-conventions"]
  }

  // 2. Check for remaining issues
  mcp__wundr__pattern_standardize {
    action: "review"
  }

  // 3. Verify no drift
  mcp__wundr__drift_detection {
    action: "detect"
  }
```

---

## Enforcement

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/strict',
    'plugin:import/typescript',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',

    // Imports
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'type',
      ],
      'newlines-between': 'always',
    }],
    'import/no-cycle': 'error',

    // Code style
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
  },
};
```

### Automated Checks

```bash
# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [04-error-handling.md](./04-error-handling.md) - Error handling patterns
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [Testing Conventions](./03-testing.md)
