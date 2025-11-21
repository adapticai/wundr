# @wundr.io/core

[![npm version](https://img.shields.io/npm/v/@wundr.io/core.svg?style=flat)](https://www.npmjs.com/package/@wundr.io/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

> Foundational utilities for systematic excellence in the Wundr.io ecosystem

@wundr.io/core provides the essential building blocks for the Wundr platform—production-ready
logging, event-driven architecture, robust error handling, and type-safe utilities. Built with
TypeScript and designed for enterprise reliability, it eliminates boilerplate while enforcing best
practices from day one.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Key Features](#key-features)
- [Core Capabilities](#core-capabilities)
  - [Logging System](#logging-system)
  - [Event Bus](#event-bus)
  - [Error Handling](#error-handling)
  - [Result Pattern](#result-pattern)
  - [Validation Utilities](#validation-utilities)
  - [Performance Monitoring](#performance-monitoring)
- [Integration with @wundr.io Packages](#integration-with-wundrio-packages)
- [API Overview](#api-overview)
- [Best Practices](#best-practices)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# npm
npm install @wundr.io/core

# yarn
yarn add @wundr.io/core

# pnpm
pnpm add @wundr.io/core
```

## Quick Start

```typescript
import { createLogger, getEventBus, success, failure } from '@wundr.io/core';

// 1. Structured logging with Winston
const logger = createLogger({ level: 'debug', colorize: true });
logger.info('Application started', { version: '1.0.0' });

// 2. Event-driven architecture
const events = getEventBus();
events.on('user:created', async event => {
  logger.info('New user created', event.payload);
});
events.emit('user:created', { userId: '123', name: 'Alice' });

// 3. Type-safe error handling with Result pattern
function divide(a: number, b: number) {
  if (b === 0) {
    return failure(new ValidationError('Division by zero'));
  }
  return success(a / b);
}

const result = divide(10, 2);
if (result.success) {
  logger.info(`Result: ${result.data}`); // Result: 5
}
```

## Key Features

- **Production-Grade Logging** - Winston-powered structured logging with colorization, timestamps,
  and file output
- **Event Bus Architecture** - Type-safe pub/sub messaging with event history and automatic error
  handling
- **Robust Error Handling** - Custom error classes with context, Result pattern for functional error
  handling
- **Type-Safe Utilities** - Comprehensive validation, async helpers, object manipulation, and string
  utilities
- **Performance Monitoring** - Built-in timing utilities and performance tracking
- **Zero Configuration** - Sensible defaults with full customization options
- **Enterprise Ready** - Used across all @wundr.io packages for consistency and reliability

## Core Capabilities

### Logging System

Production-ready logging built on Winston with colorization, structured metadata, and multiple
output formats.

#### Basic Usage

```typescript
import { createLogger, getLogger, log } from '@wundr.io/core';

// Create a custom logger
const logger = createLogger({
  level: 'info',
  format: 'detailed',
  colorize: true,
  timestamp: true,
  file: './logs/app.log',
});

logger.debug('Debug message', { context: 'startup' });
logger.info('User authenticated', { userId: '123' });
logger.warn('Rate limit approaching', { current: 95, limit: 100 });
logger.error(new Error('Database connection failed'), { retries: 3 });

// Use default logger for quick logging
log.info('Quick log message');
```

#### Logger Configuration

```typescript
interface LoggerConfig {
  level?: string; // 'debug' | 'info' | 'warn' | 'error' (default: 'info')
  format?: 'json' | 'simple' | 'detailed'; // Output format (default: 'detailed')
  colorize?: boolean; // Colorize output (default: true)
  timestamp?: boolean; // Include timestamps (default: true)
  file?: string; // Optional file output path
  console?: boolean; // Enable console output (default: true)
}
```

#### Child Loggers

```typescript
const logger = createLogger();
const userLogger = logger.child({ module: 'user-service' });

userLogger.info('User action'); // Includes module: 'user-service' in all logs
```

### Event Bus

Type-safe event-driven architecture with pub/sub messaging, event history, and automatic error
recovery.

#### Basic Usage

```typescript
import { getEventBus, createEventBus } from '@wundr.io/core';

const events = getEventBus();

// Subscribe to events
const unsubscribe = events.on<{ userId: string }>('user:login', async event => {
  console.log(`User ${event.payload.userId} logged in at ${event.timestamp}`);
});

// Emit events
events.emit('user:login', { userId: '123' }, 'auth-service');

// One-time subscription
events.once('app:ready', async event => {
  console.log('Application is ready');
});

// Unsubscribe
unsubscribe();
```

#### Event History

```typescript
const events = getEventBus();

// Get last 10 events
const recentEvents = events.getHistory(undefined, 10);

// Get events by type
const loginEvents = events.getHistory('user:login');

// Clear history
events.clearHistory();
```

#### Advanced Features

```typescript
// Get listener count
const count = events.getListenerCount('user:login');

// Get all event types with listeners
const types = events.getEventTypes();

// Remove all listeners
events.removeAllListeners('user:login');
```

### Error Handling

Structured error classes with context, timestamps, and serialization support.

#### Built-in Error Classes

```typescript
import {
  BaseWundrError,
  ValidationError,
  ConfigurationError,
  PluginError,
  EventBusError,
} from '@wundr.io/core';

// Validation errors
throw new ValidationError('Invalid email format', {
  field: 'email',
  value: 'invalid-email',
  rule: 'email',
});

// Configuration errors
throw new ConfigurationError('Missing API key', {
  configFile: '.env',
  requiredKey: 'API_KEY',
});

// Custom errors with context
const error = new BaseWundrError('Operation failed', 'CUSTOM_ERROR_CODE', {
  operation: 'database-query',
  table: 'users',
});

// Error serialization
console.log(error.toJSON());
// {
//   name: 'BaseWundrError',
//   message: 'Operation failed',
//   code: 'CUSTOM_ERROR_CODE',
//   timestamp: '2025-01-21T...',
//   stack: '...',
//   context: { operation: 'database-query', table: 'users' }
// }
```

### Result Pattern

Functional error handling that eliminates try/catch blocks and makes error states explicit.

#### Basic Usage

```typescript
import { success, failure, isSuccess, isFailure } from '@wundr.io/core';

function parseJSON(input: string) {
  try {
    const data = JSON.parse(input);
    return success(data);
  } catch (error) {
    return failure(new ValidationError('Invalid JSON', { input }));
  }
}

const result = parseJSON('{"name":"Alice"}');

if (isSuccess(result)) {
  console.log('Parsed:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

#### Function Wrapping

```typescript
import { wrapWithResult, wrapWithResultAsync } from '@wundr.io/core';

// Wrap synchronous functions
const safeDivide = wrapWithResult((a: number, b: number) => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
});

const result = safeDivide(10, 0);
// result: { success: false, error: WundrError }

// Wrap async functions
const safeApiCall = wrapWithResultAsync(async (url: string) => {
  const response = await fetch(url);
  return response.json();
});

const apiResult = await safeApiCall('https://api.example.com/data');
if (apiResult.success) {
  console.log('Data:', apiResult.data);
}
```

### Validation Utilities

Type-safe validation with Zod integration for schema validation.

```typescript
import { validateSchema } from '@wundr.io/core';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

const userData = { name: 'Alice', email: 'alice@example.com', age: 25 };
const result = validateSchema(UserSchema, userData);

if (result.success) {
  console.log('Valid user:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

### Performance Monitoring

Built-in utilities for tracking execution time and performance metrics.

```typescript
import { Timer, measureAsync } from '@wundr.io/core';

// Manual timing
const timer = new Timer();
// ... perform operation
const elapsed = timer.stop();
console.log(`Operation took ${elapsed}ms`);

// Automatic async timing
const result = await measureAsync('database-query', async () => {
  return await db.query('SELECT * FROM users');
});

console.log(`Query took ${result.duration}ms`);
console.log('Data:', result.data);
```

## Integration with @wundr.io Packages

@wundr.io/core is the foundational package used across the entire Wundr ecosystem.

### Used By

- **[@wundr.io/config](../config)** - Configuration management with core logging and validation
- **[@wundr.io/cli](../cli)** - CLI framework with event bus and structured logging
- **[@wundr.io/computer-setup](../computer-setup)** - Machine provisioning with core utilities
- **[@wundr.io/analysis-engine](../analysis-engine)** - Code analysis with logging and error
  handling
- **[@wundr.io/plugin-system](../plugin-system)** - Plugin architecture using event bus
- **[@wundr.io/project-templates](../project-templates)** - Template generation with validation

### Example: Building on Core

```typescript
// Your custom @wundr.io package
import { createLogger, getEventBus, ValidationError } from '@wundr.io/core';

export class MyService {
  private logger = createLogger({ level: 'debug' });
  private events = getEventBus();

  async execute(input: string) {
    this.logger.info('Service executing', { input });

    if (!input) {
      throw new ValidationError('Input required');
    }

    this.events.emit('service:started', { input });

    // Business logic here

    this.events.emit('service:completed', { result: 'success' });
    this.logger.info('Service completed');
  }
}
```

### Part of the @wundr.io Ecosystem

@wundr.io/core provides the infrastructure that powers the complete Wundr platform:

- **Setup Stage**: Used by @wundr.io/computer-setup for developer machine provisioning
- **Create Stage**: Foundation for @wundr.io/project-templates scaffolding
- **Govern Stage**: Powers @wundr.io/analysis-engine code quality enforcement

Learn more about the full platform at [wundr.io](https://wundr.io).

## API Overview

### Logging

```typescript
// Logger creation
createLogger(config?: LoggerConfig): Logger
getLogger(): Logger
setDefaultLogger(logger: Logger): void

// Quick logging
log.debug(message: string, meta?: Record<string, unknown>): void
log.info(message: string, meta?: Record<string, unknown>): void
log.warn(message: string, meta?: Record<string, unknown>): void
log.error(message: string | Error, meta?: Record<string, unknown>): void
```

### Events

```typescript
// Event bus
createEventBus(maxHistorySize?: number): EventBus
getEventBus(): EventBus
setDefaultEventBus(eventBus: EventBus): void

// EventBus interface
emit<T>(type: string, payload: T, source?: string): void
on<T>(type: string, handler: EventHandler<T>): () => void
once<T>(type: string, handler: EventHandler<T>): void
off<T>(type: string, handler: EventHandler<T>): void
removeAllListeners(type?: string): void
getHistory(type?: string, limit?: number): EventBusEvent[]
clearHistory(): void
getListenerCount(type: string): number
getEventTypes(): string[]
```

### Error Handling

```typescript
// Error classes
class BaseWundrError extends Error
class ValidationError extends BaseWundrError
class ConfigurationError extends BaseWundrError
class PluginError extends BaseWundrError
class EventBusError extends BaseWundrError

// Result pattern
success<T>(data: T): { success: true; data: T }
failure<E>(error: E): { success: false; error: E }
isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T }
isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E }
wrapWithResult<T, R>(fn: (...args: T) => R): (...args: T) => Result<R, WundrError>
wrapWithResultAsync<T, R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<Result<R, WundrError>>
```

### Utilities

```typescript
// Async utilities
retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>
sleep(ms: number): Promise<void>
timeout<T>(promise: Promise<T>, ms: number): Promise<T>

// Object utilities
deepClone<T>(obj: T): T
deepMerge<T>(target: T, ...sources: Partial<T>[]): T
pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>
omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>

// String utilities
camelCase(str: string): string
kebabCase(str: string): string
snakeCase(str: string): string
capitalize(str: string): string

// Performance
class Timer
measureAsync<T>(name: string, fn: () => Promise<T>): Promise<{ data: T; duration: number }>
```

For complete API documentation, visit [docs.wundr.io/core](https://wundr.io/docs/core).

## Best Practices

### 1. Use Structured Logging

```typescript
// ❌ Bad: Unstructured logs
logger.info(`User ${userId} performed action ${action}`);

// ✅ Good: Structured metadata
logger.info('User action performed', { userId, action, timestamp: Date.now() });
```

### 2. Leverage the Event Bus for Decoupling

```typescript
// ❌ Bad: Tight coupling
class UserService {
  createUser(data: UserData) {
    const user = db.create(data);
    emailService.sendWelcome(user); // Tight coupling
    analyticsService.track(user); // Tight coupling
    return user;
  }
}

// ✅ Good: Event-driven architecture
class UserService {
  constructor(private events = getEventBus()) {}

  createUser(data: UserData) {
    const user = db.create(data);
    this.events.emit('user:created', user);
    return user;
  }
}

// Subscribers handle their own concerns
events.on('user:created', async event => {
  await emailService.sendWelcome(event.payload);
});
events.on('user:created', async event => {
  await analyticsService.track(event.payload);
});
```

### 3. Use Result Pattern for Explicit Error Handling

```typescript
// ❌ Bad: Exceptions for control flow
function getUser(id: string): User {
  const user = db.find(id);
  if (!user) throw new Error('User not found');
  return user;
}

// ✅ Good: Explicit error states
function getUser(id: string): Result<User, ValidationError> {
  const user = db.find(id);
  if (!user) {
    return failure(new ValidationError('User not found', { userId: id }));
  }
  return success(user);
}
```

### 4. Create Child Loggers for Context

```typescript
// ✅ Good: Context-aware logging
const logger = createLogger();
const userLogger = logger.child({ module: 'user-service' });
const authLogger = logger.child({ module: 'auth-service' });

userLogger.info('Action performed'); // Includes module: 'user-service'
authLogger.info('Login attempt'); // Includes module: 'auth-service'
```

### 5. Use Type-Safe Event Payloads

```typescript
// ✅ Good: Strongly typed events
interface UserCreatedPayload {
  userId: string;
  email: string;
  timestamp: number;
}

events.on<UserCreatedPayload>('user:created', async event => {
  // event.payload is fully typed
  console.log(event.payload.userId); // Type-safe
});

events.emit<UserCreatedPayload>('user:created', {
  userId: '123',
  email: 'user@example.com',
  timestamp: Date.now(),
});
```

## Contributing

We welcome contributions to @wundr.io/core! This package is part of the larger Wundr monorepo.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adapticai/wundr.git
cd wundr

# Install dependencies
pnpm install

# Build core package
cd packages/@wundr/core
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Running Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Specific test file
pnpm test logger.test.ts
```

### Code Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

### Contribution Guidelines

1. **Report Bugs**:
   [Open an issue](https://github.com/adapticai/wundr/issues/new?template=bug_report.md)
2. **Suggest Features**:
   [Feature request](https://github.com/adapticai/wundr/issues/new?template=feature_request.md)
3. **Submit PRs**: Read our [Contributing Guide](../../../CONTRIBUTING.md)
4. **First Time?**: Check out
   [Good First Issues](https://github.com/adapticai/wundr/labels/good%20first%20issue)

Please read our [Code of Conduct](../../../CODE_OF_CONDUCT.md) before contributing.

## License

MIT © [Wundr.io](https://wundr.io)

See [LICENSE](../../../LICENSE) file for details.

---

**Part of the @wundr.io ecosystem** - From chaos to excellence, systematically.

Made with precision by the [Wundr.io](https://wundr.io) team
