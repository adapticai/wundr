# API Design Conventions

**Version**: 1.0.0
**Last Updated**: 2024-11-21
**Category**: Architecture

This document defines REST API design standards, request/response formats, and MCP tool integration for API quality.

---

## Table of Contents

1. [API Design Principles](#api-design-principles)
2. [URL Structure](#url-structure)
3. [HTTP Methods](#http-methods)
4. [Request/Response Format](#requestresponse-format)
5. [Status Codes](#status-codes)
6. [Versioning](#versioning)
7. [Authentication](#authentication)
8. [MCP Tool Integration](#mcp-tool-integration)
9. [Documentation](#documentation)

---

## API Design Principles

### Core Principles

1. **RESTful**: Follow REST conventions consistently
2. **Resource-Oriented**: URLs represent resources, not actions
3. **Predictable**: Consistent patterns across all endpoints
4. **Self-Documenting**: Clear naming and structure
5. **Backwards Compatible**: Changes don't break clients

### Design Checklist

- [ ] Resources are nouns, not verbs
- [ ] Consistent plural/singular usage
- [ ] HTTP methods used correctly
- [ ] Status codes are meaningful
- [ ] Error responses are structured
- [ ] Pagination is implemented
- [ ] Versioning is in place

---

## URL Structure

### Resource Naming

**Use nouns for resources:**
```
GET /api/users           # List users (noun, plural)
GET /api/users/123       # Get specific user
POST /api/users          # Create user
PUT /api/users/123       # Update user
DELETE /api/users/123    # Delete user
```

**Use kebab-case:**
```
GET /api/user-profiles   # Good
GET /api/userProfiles    # Avoid
GET /api/user_profiles   # Avoid
```

### Nested Resources

**For related resources:**
```
GET /api/users/123/orders           # User's orders
GET /api/users/123/orders/456       # Specific order
POST /api/users/123/orders          # Create order for user

# Limit nesting to 2 levels
GET /api/users/123/orders/456/items # Avoid - too deep
GET /api/orders/456/items           # Better - flatten
```

### Query Parameters

**For filtering, sorting, pagination:**
```
GET /api/users?status=active                    # Filter
GET /api/users?sort=createdAt:desc              # Sort
GET /api/users?page=2&limit=20                  # Paginate
GET /api/users?status=active&sort=name&page=1   # Combined
```

**For search:**
```
GET /api/users?search=john           # Text search
GET /api/products?q=laptop&category=electronics  # Filtered search
```

### Actions on Resources

**For non-CRUD operations, use verbs as sub-resources:**
```
POST /api/users/123/activate        # Activate user
POST /api/users/123/deactivate      # Deactivate user
POST /api/orders/456/cancel         # Cancel order
POST /api/payments/789/refund       # Process refund
```

---

## HTTP Methods

### Method Usage

| Method | Purpose | Idempotent | Request Body | Response Body |
|--------|---------|------------|--------------|---------------|
| GET | Retrieve resource | Yes | No | Yes |
| POST | Create resource | No | Yes | Yes |
| PUT | Replace resource | Yes | Yes | Yes |
| PATCH | Partial update | No | Yes | Yes |
| DELETE | Remove resource | Yes | No | Optional |

### Examples

```typescript
// GET - Retrieve
GET /api/users/123
Response: 200 OK with user data

// POST - Create
POST /api/users
Body: { name: "John", email: "john@example.com" }
Response: 201 Created with new user data

// PUT - Full update
PUT /api/users/123
Body: { name: "John", email: "john@example.com", role: "admin" }
Response: 200 OK with updated user

// PATCH - Partial update
PATCH /api/users/123
Body: { name: "Johnny" }
Response: 200 OK with updated user

// DELETE - Remove
DELETE /api/users/123
Response: 204 No Content
```

---

## Request/Response Format

### Request Format

```typescript
// Request body schema
interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
  profile?: {
    avatar?: string;
    bio?: string;
  };
}

// Example request
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "user",
  "profile": {
    "bio": "Software developer"
  }
}
```

### Success Response Format

```typescript
// Single resource
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

// Collection with pagination
interface ApiListResponse<T> {
  success: true;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Example single response
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}

// Example list response
{
  "success": true,
  "data": [
    { "id": "1", "name": "User 1" },
    { "id": "2", "name": "User 2" }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Error Response Format

```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ValidationErrorDetails[];
    requestId: string;
    timestamp: string;
  };
}

interface ValidationErrorDetails {
  field: string;
  message: string;
  code: string;
}

// Example error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "code": "MIN_LENGTH"
      }
    ],
    "requestId": "req-abc123",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## Status Codes

### Success Codes

| Code | Name | When to Use |
|------|------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST creating resource |
| 204 | No Content | Successful DELETE, no body needed |

### Client Error Codes

| Code | Name | When to Use |
|------|------|-------------|
| 400 | Bad Request | Invalid request data, validation errors |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (duplicate, version mismatch) |
| 422 | Unprocessable Entity | Valid syntax but semantic errors |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Error Codes

| Code | Name | When to Use |
|------|------|-------------|
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | External service failure |
| 503 | Service Unavailable | Server temporarily unavailable |
| 504 | Gateway Timeout | External service timeout |

---

## Versioning

### URL Versioning (Recommended)

```
GET /api/v1/users
GET /api/v2/users
```

### Implementation

```typescript
// Express router setup
import { Router } from 'express';
import v1Routes from './v1';
import v2Routes from './v2';

const router = Router();
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);

export default router;
```

### Version Deprecation

```typescript
// Deprecation header middleware
function deprecationMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Sat, 01 Jan 2025 00:00:00 GMT');
  res.setHeader('Link', '</api/v2/users>; rel="successor-version"');
  next();
}
```

---

## Authentication

### Bearer Token

```typescript
// Request with authentication
GET /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### API Key

```typescript
// Request with API key
GET /api/users
X-API-Key: sk_live_abc123...
```

### Authentication Middleware

```typescript
async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing authentication token');
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    throw new AuthenticationError('Invalid authentication token');
  }
}
```

---

## MCP Tool Integration

### API Quality Monitoring

**Analyze API Dependencies:**
```javascript
// Check for circular dependencies in API modules
mcp__wundr__dependency_analyze {
  scope: "circular",
  target: "src/api"
}

// Full dependency analysis
mcp__wundr__dependency_analyze {
  scope: "all",
  outputFormat: "graph"
}
```

**Pattern Standardization for APIs:**
```javascript
// Check API error handling consistency
mcp__wundr__pattern_standardize {
  action: "check",
  rules: [
    "consistent-error-handling",
    "async-await-pattern"
  ]
}

// Auto-fix API patterns
mcp__wundr__pattern_standardize {
  action: "run",
  dryRun: true
}
```

**Quality Reports:**
```javascript
// Generate API quality report
mcp__wundr__governance_report {
  reportType: "quality",
  format: "markdown"
}

// Check API compliance
mcp__wundr__governance_report {
  reportType: "compliance"
}
```

### Pre-Deployment Verification

```javascript
// API deployment readiness check
[BatchTool]:
  // 1. Check for circular dependencies
  mcp__wundr__dependency_analyze {
    scope: "circular"
  }

  // 2. Verify pattern compliance
  mcp__wundr__pattern_standardize {
    action: "check"
  }

  // 3. Check test coverage
  mcp__wundr__test_baseline {
    action: "compare",
    testType: "integration"
  }

  // 4. Generate compliance report
  mcp__wundr__governance_report {
    reportType: "compliance"
  }
```

### API Monitoring Workflow

```javascript
// Weekly API health check
[BatchTool]:
  // 1. Detect drift in API code
  mcp__wundr__drift_detection {
    action: "detect"
  }

  // 2. Analyze external dependencies
  mcp__wundr__dependency_analyze {
    scope: "external"
  }

  // 3. Generate weekly report
  mcp__wundr__governance_report {
    reportType: "weekly",
    period: "7d"
  }
```

---

## Documentation

### OpenAPI Specification

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: User API
  version: 1.0.0
  description: API for managing users

paths:
  /api/v1/users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
          format: email
      required:
        - id
        - name
        - email
```

### JSDoc for Controllers

```typescript
/**
 * Get user by ID
 *
 * @route GET /api/v1/users/:id
 * @param {string} id.path.required - User ID
 * @returns {ApiResponse<User>} 200 - User data
 * @returns {ApiErrorResponse} 404 - User not found
 * @returns {ApiErrorResponse} 401 - Unauthorized
 *
 * @example response - 200 - Success
 * {
 *   "success": true,
 *   "data": {
 *     "id": "123",
 *     "name": "John Doe",
 *     "email": "john@example.com"
 *   }
 * }
 */
async function getUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await userService.getById(id);
  res.json({ success: true, data: user });
}
```

---

## Related Conventions

- [04-error-handling.md](./04-error-handling.md) - Error handling patterns
- [02-typescript-javascript.md](./02-typescript-javascript.md) - TypeScript standards
- [08-mcp-tools.md](./08-mcp-tools.md) - Complete MCP tools guide

---

**Next**: [Git Workflow Conventions](./06-git-workflow.md)
