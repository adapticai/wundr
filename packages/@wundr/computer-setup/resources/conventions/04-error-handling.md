# Error Handling Conventions

**Version**: 1.0.0 **Last Updated**: 2024-11-21 **Category**: Code Quality

This document defines error handling patterns, error types, and MCP tool integration for consistent
error management.

---

## Table of Contents

1. [Error Handling Philosophy](#error-handling-philosophy)
2. [Error Types](#error-types)
3. [Error Patterns](#error-patterns)
4. [Logging Conventions](#logging-conventions)
5. [API Error Responses](#api-error-responses)
6. [MCP Tool Integration](#mcp-tool-integration)
7. [Enforcement](#enforcement)

---

## Error Handling Philosophy

### Core Principles

1. **Fail Fast**: Detect and report errors as early as possible
2. **Fail Safely**: Errors should never expose sensitive information
3. **Be Specific**: Use typed errors with clear messages
4. **Be Recoverable**: Provide enough context to debug and fix
5. **Be Consistent**: Use the same patterns throughout the codebase

### Never Do This

```typescript
// NEVER: Catch and ignore
try {
  riskyOperation();
} catch (e) {
  // Silent failure - debugging nightmare
}

// NEVER: Generic error
throw new Error('Something went wrong');

// NEVER: String throws
throw 'Error occurred';

// NEVER: Expose internal details
throw new Error(`Database connection failed: ${connectionString}`);
```

---

## Error Types

### Base Error Class

```typescript
// src/errors/base.ts
export abstract class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode?: number;
      isOperational?: boolean;
      cause?: Error;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
```

### Specific Error Classes

```typescript
// src/errors/domain.ts

export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly violations: string[];

  constructor(
    message: string,
    options: {
      field?: string;
      violations?: string[];
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      cause: options.cause,
    });
    this.field = options.field;
    this.violations = options.violations ?? [];
  }
}

export class NotFoundError extends AppError {
  public readonly resource: string;
  public readonly resourceId?: string;

  constructor(resource: string, resourceId?: string) {
    super(`${resource} not found${resourceId ? `: ${resourceId}` : ''}`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      context: { resource, resourceId },
    });
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, {
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
    });
  }
}

export class AuthorizationError extends AppError {
  constructor(action: string, resource: string) {
    super(`Not authorized to ${action} ${resource}`, {
      code: 'FORBIDDEN',
      statusCode: 403,
      context: { action, resource },
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      context,
    });
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string,
    options: { cause?: Error; context?: Record<string, unknown> } = {}
  ) {
    super(`${service} service error: ${message}`, {
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      cause: options.cause,
      context: { service, ...options.context },
    });
    this.service = service;
    this.originalError = options.cause;
  }
}
```

### Error Type Hierarchy

```
AppError (base)
├── ValidationError (400)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── ExternalServiceError (502)
└── InternalError (500)
```

---

## Error Patterns

### Try-Catch Pattern

```typescript
// Good: Typed error handling
async function getUser(id: string): Promise<User> {
  try {
    const user = await database.users.findById(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  } catch (error) {
    // Re-throw app errors
    if (error instanceof AppError) {
      throw error;
    }

    // Wrap unknown errors
    logger.error('Failed to fetch user', { id, error });
    throw new InternalError('Unable to fetch user', { cause: error as Error });
  }
}
```

### Result Type Pattern

```typescript
// Alternative: Result type for explicit error handling
type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E };

async function getUserSafe(id: string): Promise<Result<User>> {
  try {
    const user = await database.users.findById(id);

    if (!user) {
      return {
        success: false,
        error: new NotFoundError('User', id),
      };
    }

    return { success: true, data: user };
  } catch (error) {
    return {
      success: false,
      error: new InternalError('Unable to fetch user', { cause: error as Error }),
    };
  }
}

// Usage
const result = await getUserSafe('123');
if (!result.success) {
  // Handle error
  handleError(result.error);
  return;
}
// Use result.data safely
```

### Validation Pattern

```typescript
// Input validation with clear errors
function validateUserInput(input: unknown): CreateUserInput {
  const violations: string[] = [];

  if (!isObject(input)) {
    throw new ValidationError('Invalid input format');
  }

  const { name, email, password } = input as Record<string, unknown>;

  if (typeof name !== 'string' || name.length < 2) {
    violations.push('Name must be at least 2 characters');
  }

  if (!isValidEmail(email)) {
    violations.push('Invalid email format');
  }

  if (!isValidPassword(password)) {
    violations.push('Password must be at least 8 characters with numbers and letters');
  }

  if (violations.length > 0) {
    throw new ValidationError('Validation failed', { violations });
  }

  return { name, email, password } as CreateUserInput;
}
```

### Async Error Boundary

```typescript
// Wrap async operations with error boundary
async function withErrorBoundary<T>(operation: () => Promise<T>, context: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`${context} failed`, { error });
    throw new InternalError(`${context} failed`, { cause: error as Error });
  }
}

// Usage
const user = await withErrorBoundary(() => userService.getUser(id), 'Fetching user');
```

---

## Logging Conventions

### Log Levels

| Level   | When to Use                          | Example                    |
| ------- | ------------------------------------ | -------------------------- |
| `error` | Errors requiring immediate attention | Database connection failed |
| `warn`  | Potential issues, degraded service   | Rate limit approaching     |
| `info`  | Notable events, audit trail          | User logged in             |
| `debug` | Debugging information                | Request payload            |

### Structured Logging

```typescript
// Good: Structured log with context
logger.error('Failed to process payment', {
  userId: user.id,
  orderId: order.id,
  amount: order.total,
  error: {
    code: error.code,
    message: error.message,
  },
});

// Avoid: String concatenation
logger.error(`Failed to process payment for user ${user.id}: ${error.message}`);
```

### Error Logging Pattern

```typescript
// Log error with full context
function logError(error: unknown, context: Record<string, unknown> = {}): void {
  if (error instanceof AppError) {
    logger.error(error.message, {
      ...context,
      errorCode: error.code,
      errorContext: error.context,
      stack: error.stack,
      cause: error.cause?.message,
    });
  } else if (error instanceof Error) {
    logger.error(error.message, {
      ...context,
      stack: error.stack,
    });
  } else {
    logger.error('Unknown error', {
      ...context,
      error,
    });
  }
}
```

---

## API Error Responses

### Response Format

```typescript
// Success response
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    total?: number;
    timestamp: string;
  };
}

// Error response
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
```

### Error Handler Middleware

```typescript
// Express error handler
function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string;

  if (error instanceof AppError) {
    // Log operational errors at warning level
    if (error.isOperational) {
      logger.warn('Operational error', {
        requestId,
        path: req.path,
        ...error.context,
      });
    } else {
      logger.error('Non-operational error', {
        requestId,
        path: req.path,
        stack: error.stack,
      });
    }

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    });
    return;
  }

  // Unknown errors - log and return generic message
  logger.error('Unhandled error', {
    requestId,
    path: req.path,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
```

---

## MCP Tool Integration

### Pattern Standardization

**Check and Fix Error Handling:**

```javascript
// Check for consistent error handling
mcp__wundr__pattern_standardize {
  action: "check",
  rules: ["consistent-error-handling"]
}

// Auto-fix error handling patterns
mcp__wundr__pattern_standardize {
  action: "run",
  rules: ["consistent-error-handling"]
}

// What it fixes:
// - throw 'string' -> throw new AppError('string')
// - catch(e) {} -> proper error handling
// - Missing error types -> typed errors
```

**Review Manual Fixes Needed:**

```javascript
// Find error patterns needing manual attention
mcp__wundr__pattern_standardize {
  action: "review"
}

// Output includes:
// - Error handling without logging
// - Generic error catches
// - Missing error type definitions
```

### Quality Monitoring

```javascript
// Generate quality report
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Check compliance with error handling standards
mcp__wundr__governance_report {
  reportType: "compliance"
}
```

### Pre-Commit Error Check

```javascript
// Pre-commit error handling verification
[BatchTool]:
  // 1. Auto-fix error patterns
  mcp__wundr__pattern_standardize {
    action: "run",
    rules: ["consistent-error-handling"]
  }

  // 2. Check for remaining issues
  mcp__wundr__pattern_standardize {
    action: "check",
    rules: ["consistent-error-handling"]
  }

  // 3. Verify no quality drift
  mcp__wundr__drift_detection {
    action: "detect"
  }
```

---

## Enforcement

### ESLint Rules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Disallow empty catch blocks
    'no-empty': ['error', { allowEmptyCatch: false }],

    // Require proper error handling in promises
    'promise/catch-or-return': 'error',
    'promise/no-return-wrap': 'error',

    // Disallow throw literals
    'no-throw-literal': 'error',

    // Prefer error in catch
    'prefer-promise-reject-errors': 'error',

    // TypeScript: require explicit return types
    '@typescript-eslint/explicit-function-return-type': 'error',
  },
};
```

### Code Review Checklist

- [ ] All errors extend AppError base class
- [ ] Error messages are user-friendly
- [ ] Sensitive data is not exposed in errors
- [ ] Errors are logged with appropriate context
- [ ] Unknown errors are wrapped, not swallowed
- [ ] Error responses follow API format
- [ ] MCP pattern check passes

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [02-typescript-javascript.md](./02-typescript-javascript.md) - TypeScript standards
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [API Design Conventions](./05-api-design.md)
