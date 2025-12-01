# Documentation Conventions

**Version**: 1.0.0 **Last Updated**: 2024-11-21 **Category**: Documentation

This document defines documentation standards, comment guidelines, and MCP tool integration for
documentation quality.

---

## Table of Contents

1. [Documentation Philosophy](#documentation-philosophy)
2. [Code Comments](#code-comments)
3. [JSDoc/TSDoc Standards](#jsdoctsdoc-standards)
4. [README Guidelines](#readme-guidelines)
5. [API Documentation](#api-documentation)
6. [Architecture Documentation](#architecture-documentation)
7. [MCP Tool Integration](#mcp-tool-integration)

---

## Documentation Philosophy

### Core Principles

1. **Document the Why, Not the What**: Code shows _what_, docs explain _why_
2. **Keep It Close**: Documentation should live near the code
3. **Keep It Updated**: Outdated docs are worse than no docs
4. **Be Concise**: Clear and brief over verbose and detailed
5. **Write for Humans**: Use plain language, avoid jargon

### Documentation Types

| Type              | Purpose               | Location                |
| ----------------- | --------------------- | ----------------------- |
| Code Comments     | Explain complex logic | Inline in code          |
| JSDoc/TSDoc       | API documentation     | Above functions/classes |
| README            | Project overview      | Root directory          |
| Architecture Docs | System design         | `/docs/architecture/`   |
| API Docs          | Endpoint reference    | `/docs/api/`            |
| Guides            | How-to tutorials      | `/docs/guides/`         |

---

## Code Comments

### When to Comment

**DO comment:**

- Complex algorithms
- Business logic reasoning
- Non-obvious optimizations
- Workarounds and hacks
- Security considerations
- TODO items with tickets

**DON'T comment:**

- Self-explanatory code
- What the code does (obvious from reading)
- Redundant information
- Outdated comments

### Comment Examples

**Good Comments:**

```typescript
// Use binary search because dataset can exceed 100k items
// and linear search would cause noticeable UI lag
function findItem(sortedItems: Item[], id: string): Item | undefined {
  // Binary search implementation
}

// SECURITY: Sanitize HTML to prevent XSS attacks
// See: https://owasp.org/www-community/xss-filter-evasion-cheatsheet
const sanitizedInput = sanitizeHtml(userInput);

// WORKAROUND: Safari doesn't support CSS gap in flex containers
// TODO(#1234): Remove when Safari 15+ is baseline
const legacySpacing = { marginRight: '8px' };
```

**Bad Comments:**

```typescript
// Loop through users
for (const user of users) {
}

// Set the name to John
const name = 'John';

// This function gets the user
function getUser(id: string): User {}
```

### Comment Tags

| Tag        | Purpose                | Example                           |
| ---------- | ---------------------- | --------------------------------- |
| `TODO`     | Future work needed     | `// TODO(#123): Add caching`      |
| `FIXME`    | Known bug to fix       | `// FIXME: Race condition here`   |
| `HACK`     | Temporary workaround   | `// HACK: Browser bug workaround` |
| `NOTE`     | Important information  | `// NOTE: Order matters here`     |
| `SECURITY` | Security consideration | `// SECURITY: Input validation`   |
| `PERF`     | Performance note       | `// PERF: O(n) complexity`        |

---

## JSDoc/TSDoc Standards

### Function Documentation

````typescript
/**
 * Calculates the total price of items including tax and discounts.
 *
 * @param items - Array of items to calculate total for
 * @param options - Optional calculation parameters
 * @param options.taxRate - Tax rate as decimal (0.08 = 8%)
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
export function calculateTotal(items: Item[], options?: CalculationOptions): number {
  // Implementation
}
````

### Class Documentation

````typescript
/**
 * Service for managing user operations.
 *
 * Handles user CRUD operations, authentication, and profile management.
 * All methods require valid authentication unless noted otherwise.
 *
 * @example
 * ```typescript
 * const userService = new UserService(database, authProvider);
 * const user = await userService.getById('123');
 * ```
 */
export class UserService {
  /**
   * Creates a new UserService instance.
   *
   * @param database - Database connection instance
   * @param authProvider - Authentication provider for token validation
   */
  constructor(
    private readonly database: Database,
    private readonly authProvider: AuthProvider
  ) {}

  /**
   * Retrieves a user by their unique identifier.
   *
   * @param id - The user's unique identifier
   * @returns The user object if found
   * @throws {NotFoundError} If user doesn't exist
   * @throws {AuthorizationError} If caller lacks permission
   */
  async getById(id: string): Promise<User> {
    // Implementation
  }
}
````

### Interface Documentation

```typescript
/**
 * Configuration options for the API client.
 */
export interface ApiClientConfig {
  /**
   * Base URL for API requests.
   * @default 'https://api.example.com'
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Number of retry attempts for failed requests.
   * Set to 0 to disable retries.
   * @default 3
   */
  retries?: number;

  /**
   * Custom headers to include in all requests.
   */
  headers?: Record<string, string>;
}
```

### Type Documentation

```typescript
/**
 * Possible states for a user account.
 *
 * - `pending` - Account created but not verified
 * - `active` - Account verified and in good standing
 * - `suspended` - Account temporarily disabled
 * - `deleted` - Account marked for deletion
 */
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleted';

/**
 * Result of an operation that may fail.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to Error)
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
```

---

## README Guidelines

### README Structure

````markdown
# Project Name

Brief description of the project (1-2 sentences).

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

```bash
npm install project-name
```
````

## Quick Start

```typescript
import { Something } from 'project-name';

const result = Something.doThing();
```

## Documentation

- [Full Documentation](./docs)
- [API Reference](./docs/api)
- [Examples](./examples)

## Configuration

| Option    | Type   | Default   | Description |
| --------- | ------ | --------- | ----------- |
| `option1` | string | 'default' | Description |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT License - see [LICENSE](./LICENSE)

````

### README Best Practices

- Lead with a clear project description
- Show installation and quick start first
- Include badges (build status, coverage, version)
- Link to detailed documentation
- Keep updated with code changes

---

## API Documentation

### OpenAPI/Swagger

```yaml
openapi: 3.0.3
info:
  title: User API
  description: |
    API for managing user accounts and profiles.

    ## Authentication
    All endpoints require Bearer token authentication.

    ## Rate Limiting
    - 100 requests per minute per API key
    - 1000 requests per hour per user
  version: 1.0.0

paths:
  /users:
    get:
      summary: List all users
      description: |
        Returns a paginated list of users.
        Results can be filtered and sorted.
      parameters:
        - name: page
          in: query
          description: Page number for pagination
          schema:
            type: integer
            default: 1
            minimum: 1
````

### Endpoint Documentation Template

````markdown
## GET /api/users/:id

Retrieves a user by their unique identifier.

### Parameters

| Name | Type   | In   | Required | Description              |
| ---- | ------ | ---- | -------- | ------------------------ |
| id   | string | path | Yes      | User's unique identifier |

### Headers

| Name          | Required | Description  |
| ------------- | -------- | ------------ |
| Authorization | Yes      | Bearer token |

### Response

#### 200 OK

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```
````

#### 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

### Example

```bash
curl -X GET https://api.example.com/users/123 \
  -H "Authorization: Bearer your-token"
```

````

---

## Architecture Documentation

### Architecture Decision Records (ADR)

```markdown
# ADR-001: Use PostgreSQL for User Data

## Status
Accepted

## Context
We need a database for storing user data with the following requirements:
- ACID compliance for financial transactions
- Support for complex queries
- Scalability to 10M+ records

## Decision
We will use PostgreSQL as our primary database.

## Consequences

### Positive
- Strong ACID compliance
- Excellent query performance
- Rich ecosystem and tooling

### Negative
- Requires dedicated DBA knowledge
- Vertical scaling limitations

## Alternatives Considered
- MongoDB: Rejected due to ACID requirements
- MySQL: Rejected due to JSON support limitations
````

### System Design Document

```markdown
# User Authentication System

## Overview

High-level description of the system.

## Architecture Diagram

[Include diagram or link]

## Components

### Auth Service

- Purpose: Handle authentication requests
- Technology: Node.js, Express
- Dependencies: Redis, PostgreSQL

### Token Service

- Purpose: Manage JWT tokens
- Technology: Node.js
- Dependencies: Redis

## Data Flow

1. User submits credentials
2. Auth service validates against PostgreSQL
3. Token service generates JWT
4. Token stored in Redis for validation

## Security Considerations

- Tokens expire after 1 hour
- Refresh tokens valid for 7 days
- Rate limiting on auth endpoints
```

---

## MCP Tool Integration

### Documentation Quality

**Generate Claude Configuration:**

```javascript
// Generate CLAUDE.md with project guidelines
mcp__wundr__claude_config {
  configType: "claude-md",
  features: ["ai-assistance"]
}

// Generate coding conventions config
mcp__wundr__claude_config {
  configType: "conventions"
}

// Generate all documentation configs
mcp__wundr__claude_config {
  configType: "all"
}
```

**Documentation in Quality Reports:**

```javascript
// Quality report includes documentation metrics
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Compliance report checks documentation standards
mcp__wundr__governance_report {
  reportType: "compliance"
}
```

### Documentation Workflows

**Project Setup Documentation:**

```javascript
// Generate all Claude Code configuration
[BatchTool]:
  // 1. Generate CLAUDE.md
  mcp__wundr__claude_config {
    configType: "claude-md",
    features: ["ai-assistance", "governance"]
  }

  // 2. Generate hooks
  mcp__wundr__claude_config {
    configType: "hooks",
    features: ["auto-governance"]
  }

  // 3. Generate conventions
  mcp__wundr__claude_config {
    configType: "conventions",
    features: ["strict-mode"]
  }
```

**Weekly Documentation Review:**

```javascript
// Documentation quality check
[BatchTool]:
  // 1. Check patterns including documentation
  mcp__wundr__pattern_standardize {
    action: "review"
  }

  // 2. Generate weekly report
  mcp__wundr__governance_report {
    reportType: "weekly",
    format: "markdown"
  }

  // 3. View trends
  mcp__wundr__drift_detection {
    action: "trends"
  }
```

### Documentation Automation

**Auto-generate Documentation:**

```javascript
// After code changes, update documentation
mcp__wundr__claude_config {
  configType: "all"
}
```

**Pre-release Documentation Check:**

```javascript
// Ensure documentation is complete before release
[BatchTool]:
  // 1. Check compliance
  mcp__wundr__governance_report {
    reportType: "compliance"
  }

  // 2. Verify test documentation
  mcp__wundr__test_baseline {
    action: "compare"
  }

  // 3. Check dependency documentation
  mcp__wundr__dependency_analyze {
    scope: "external"
  }
```

---

## Documentation Review Checklist

### Code Review

- [ ] Public APIs have JSDoc comments
- [ ] Complex logic is explained
- [ ] No outdated comments
- [ ] Examples are provided where helpful

### PR Review

- [ ] README updated if needed
- [ ] CHANGELOG entry added
- [ ] Breaking changes documented
- [ ] Migration guide provided if needed

### Release Review

- [ ] All features documented
- [ ] API reference updated
- [ ] Examples tested and working
- [ ] Deployment instructions current

---

## Related Conventions

- [01-general-principles.md](./01-general-principles.md) - Core principles
- [05-api-design.md](./05-api-design.md) - API documentation
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [MCP Tools Conventions](./08-mcp-tools.md)
