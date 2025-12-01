# Golden Standards

## Naming Conventions

### Services

- Use `*Service` suffix (e.g., `UserService`, `OrderService`)
- No abbreviations (❌ `UserSvc`, ✅ `UserService`)
- Service names should reflect their domain responsibility

### Interfaces & Types

- No `I` prefix for interfaces (❌ `IUser`, ✅ `User`)
- Use interfaces for object shapes
- Use type aliases for unions, intersections, and mapped types

### Enums

- PascalCase names with UPPER_SNAKE_CASE values

```typescript
enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST',
}
```

### Functions & Methods

- camelCase for function names
- Verb-first naming (e.g., `getUserById`, `calculateTotal`)
- Boolean-returning functions should start with `is`, `has`, `can`

## Type System Guidelines

### When to Use Interfaces

```typescript
// ✅ Good - object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ Good - extensible contracts
interface Repository<T> {
  find(id: string): Promise<T | null>;
  save(item: T): Promise<T>;
}
```

### When to Use Type Aliases

```typescript
// ✅ Good - unions
type Status = 'pending' | 'approved' | 'rejected';

// ✅ Good - intersections
type AuditedUser = User & AuditInfo;

// ✅ Good - utility types
type ReadonlyUser = Readonly<User>;
```

## Error Handling

### Base Error Class

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Domain-specific errors
export class ValidationError extends AppError {
  constructor(
    message: string,
    public fields: string[]
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}
```

### Error Handling Pattern

```typescript
// ✅ Good
try {
  const user = await userService.findById(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }
  return user;
} catch (error) {
  if (error instanceof AppError) {
    logger.warn(error.message, { code: error.code });
    throw error;
  }
  logger.error('Unexpected error', error);
  throw new AppError('Internal server error', 'INTERNAL_ERROR');
}

// ❌ Bad - never throw strings
throw 'User not found'; // Never do this!
```

## Service Architecture

### Base Service Pattern

```typescript
export abstract class BaseService {
  protected logger: Logger;
  private isRunning = false;

  constructor(protected readonly name: string) {
    this.logger = new Logger(name);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`${this.name} is already running`);
      return;
    }

    this.logger.info(`Starting ${this.name}...`);
    await this.onStart();
    this.isRunning = true;
    this.logger.info(`${this.name} started successfully`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn(`${this.name} is not running`);
      return;
    }

    this.logger.info(`Stopping ${this.name}...`);
    await this.onStop();
    this.isRunning = false;
    this.logger.info(`${this.name} stopped successfully`);
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
}
```

### Service Implementation

```typescript
export class UserService extends BaseService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus
  ) {
    super('UserService');
  }

  protected async onStart(): Promise<void> {
    await this.userRepository.connect();
    await this.eventBus.subscribe('user.*', this.handleUserEvents);
  }

  protected async onStop(): Promise<void> {
    await this.eventBus.unsubscribe('user.*');
    await this.userRepository.disconnect();
  }

  // Business methods...
}
```

## Async/Await Patterns

### Always Use Async/Await

```typescript
// ✅ Good
async function getUser(id: string): Promise<User> {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }
  return user;
}

// ❌ Bad - avoid promise chains
function getUser(id: string): Promise<User> {
  return userRepository.findById(id).then(user => {
    if (!user) throw new NotFoundError('User', id);
    return user;
  });
}
```

### Parallel Execution

```typescript
// ✅ Good - parallel when independent
const [user, orders, preferences] = await Promise.all([
  getUserById(userId),
  getOrdersByUserId(userId),
  getPreferencesByUserId(userId),
]);

// ❌ Bad - sequential when could be parallel
const user = await getUserById(userId);
const orders = await getOrdersByUserId(userId);
const preferences = await getPreferencesByUserId(userId);
```

## Module Organization

### File Structure

```
src/
├── types/           # Shared types and interfaces
│   ├── user.ts
│   └── order.ts
├── errors/          # Error classes
│   └── index.ts
├── services/        # Business logic
│   ├── base/
│   │   └── BaseService.ts
│   ├── UserService.ts
│   └── OrderService.ts
├── repositories/    # Data access layer
│   └── UserRepository.ts
├── utils/          # Pure utility functions
│   └── validation.ts
└── config/         # Configuration
    └── index.ts
```

### Import Order

```typescript
// 1. Node built-ins
import { promises as fs } from 'fs';
import path from 'path';

// 2. External dependencies
import express from 'express';
import { Logger } from 'winston';

// 3. Internal dependencies
import { AppError } from '@/errors';
import { User } from '@/types/user';

// 4. Relative imports
import { validateEmail } from './utils';
```

## Anti-Patterns to Avoid

### ❌ Wrapper Services

```typescript
// Bad - unnecessary wrapper
class EnhancedUserService {
  constructor(private userService: UserService) {}

  async getUser(id: string) {
    // Just forwarding calls
    return this.userService.getUser(id);
  }
}
```

### ❌ Mixed Concerns

```typescript
// Bad - service doing too much
class UserService {
  async createUser(data: any) {
    // Validation should be separate
    if (!data.email.includes('@')) {
      throw new Error('Invalid email');
    }

    // Direct DB access - should use repository
    const result = await db.query('INSERT INTO users...');

    // Email sending - should be event-driven
    await sendEmail(data.email, 'Welcome!');

    return result;
  }
}
```

### ❌ Inconsistent Error Handling

```typescript
// Bad - mixing error types
function processData(data: any) {
  if (!data) throw 'No data'; // String
  if (!data.id) throw new Error('No ID'); // Generic Error
  if (!data.valid) return null; // Null return
  // Inconsistent!
}
```
