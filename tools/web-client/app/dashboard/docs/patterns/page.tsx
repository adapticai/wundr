import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { readDocFile } from '@/lib/docs-utils';
import path from 'path';

// This would be fetched from the filesystem in a real app
const getPatternsContent = async () => {
  try {
    // Try to read from the project's docs directory
    const docsPath = path.join(process.cwd(), '../../docs/standards/GOLDEN_STANDARDS.md');
    const docContent = await readDocFile(docsPath);
    
    if (docContent) {
      return {
        content: docContent.content,
        frontmatter: {
          title: 'Golden Patterns & Standards',
          description: 'Best practices and recommended patterns for code organization',
          category: 'standards',
          tags: ['patterns', 'standards', 'best-practices'],
          ...docContent.frontmatter
        }
      };
    }
  } catch (_error) {
    console.log('Could not read from filesystem, using fallback content');
  }

  // Fallback content
  return {
    content: `# Golden Patterns & Standards

This section outlines the recommended patterns and standards for code organization, naming conventions, and architectural decisions in your monorepo refactoring journey.

## Naming Conventions

### Services
- Use \`*Service\` suffix (e.g., \`UserService\`, \`OrderService\`)
- No abbreviations (❌ \`UserSvc\`, ✅ \`UserService\`)
- Service names should reflect their domain responsibility

### Interfaces & Types
- No \`I\` prefix for interfaces (❌ \`IUser\`, ✅ \`User\`)
- Use interfaces for object shapes
- Use type aliases for unions, intersections, and mapped types

### Enums
- PascalCase names with UPPER_SNAKE_CASE values
\`\`\`typescript
enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUEST = 'GUEST'
}
\`\`\`

### Functions & Methods
- camelCase for function names
- Verb-first naming (e.g., \`getUserById\`, \`calculateTotal\`)
- Boolean-returning functions should start with \`is\`, \`has\`, \`can\`

## Type System Guidelines

### When to Use Interfaces
\`\`\`typescript
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
\`\`\`

### When to Use Type Aliases
\`\`\`typescript
// ✅ Good - unions
type Status = 'pending' | 'approved' | 'rejected';

// ✅ Good - intersections
type AuditedUser = User & AuditInfo;

// ✅ Good - utility types
type ReadonlyUser = Readonly<User>;
\`\`\`

## Error Handling

### Base Error Class
\`\`\`typescript
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
  constructor(message: string, public fields: string[]) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(\`\${resource} with id \${id} not found\`, 'NOT_FOUND', 404);
  }
}
\`\`\`

### Error Handling Pattern
\`\`\`typescript
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
\`\`\`

## Service Architecture

### Base Service Pattern
\`\`\`typescript
export abstract class BaseService {
  protected logger: Logger;
  private isRunning = false;

  constructor(protected readonly name: string) {
    this.logger = new Logger(name);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(\`\${this.name} is already running\`);
      return;
    }

    this.logger.info(\`Starting \${this.name}...\`);
    await this.onStart();
    this.isRunning = true;
    this.logger.info(\`\${this.name} started successfully\`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn(\`\${this.name} is not running\`);
      return;
    }

    this.logger.info(\`Stopping \${this.name}...\`);
    await this.onStop();
    this.isRunning = false;
    this.logger.info(\`\${this.name} stopped successfully\`);
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
}
\`\`\`

### Service Implementation
\`\`\`typescript
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
\`\`\`

## Async/Await Patterns

### Always Use Async/Await
\`\`\`typescript
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
  return userRepository.findById(id)
    .then(user => {
      if (!user) throw new NotFoundError('User', id);
      return user;
    });
}
\`\`\`

### Parallel Execution
\`\`\`typescript
// ✅ Good - parallel when independent
const [user, orders, preferences] = await Promise.all([
  getUserById(userId),
  getOrdersByUserId(userId),
  getPreferencesByUserId(userId)
]);

// ❌ Bad - sequential when could be parallel
const user = await getUserById(userId);
const orders = await getOrdersByUserId(userId);
const preferences = await getPreferencesByUserId(userId);
\`\`\`

## Module Organization

### File Structure
\`\`\`
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
\`\`\`

### Import Order
\`\`\`typescript
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
\`\`\`

## Anti-Patterns to Avoid

### ❌ Wrapper Services
\`\`\`typescript
// Bad - unnecessary wrapper
class EnhancedUserService {
  constructor(private userService: UserService) {}

  async getUser(id: string) {
    // Just forwarding calls
    return this.userService.getUser(id);
  }
}
\`\`\`

### ❌ Mixed Concerns
\`\`\`typescript
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
\`\`\`

### ❌ Inconsistent Error Handling
\`\`\`typescript
// Bad - mixing error types
function processData(data: any) {
  if (!data) throw 'No data';  // String
  if (!data.id) throw new Error('No ID');  // Generic Error
  if (!data.valid) return null;  // Null return
  // Inconsistent!
}
\`\`\`

## Best Practices Summary

1. **Consistency is Key**: Follow the same patterns throughout your codebase
2. **Single Responsibility**: Each class/function should have one clear purpose
3. **Explicit Error Handling**: Always handle errors explicitly and consistently
4. **Type Safety**: Leverage TypeScript's type system to prevent runtime errors
5. **Testability**: Write code that's easy to test and mock
6. **Documentation**: Keep code self-documenting with clear naming and comments where needed

These patterns form the foundation of maintainable, scalable code. Apply them consistently for the best results in your refactoring journey.`,
    frontmatter: {
      title: 'Golden Patterns & Standards',
      description: 'Best practices and recommended patterns for code organization',
      category: 'standards',
      tags: ['patterns', 'standards', 'best-practices']
    }
  };
};

export default async function PatternsPage() {
  const { content, frontmatter } = await getPatternsContent();

  const currentPage = {
    title: 'Golden Patterns',
    slug: 'patterns',
    path: '/dashboard/docs/patterns',
    category: 'standards',
    description: 'Best practices and recommended patterns for refactoring',
    tags: ['patterns', 'standards', 'best-practices'],
    order: 3
  };

  return (
    <DocsLayout currentPage={currentPage}>
      <div className="max-w-4xl space-y-6">
        {/* Search functionality */}
        <SearchableContent 
          content={content}
          onNavigate={(sectionId) => {
            const element = document.getElementById(sectionId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />

        {/* Main content */}
        <MarkdownRenderer
          content={content}
          frontmatter={frontmatter}
          showMetadata={true}
          showTableOfContents={true}
        />
      </div>
    </DocsLayout>
  );
}