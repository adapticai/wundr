# Task Management API Documentation

## Overview

The Task Management API provides comprehensive CRUD operations for managing tasks in Orchestrator (Orchestrator) autonomous systems. It supports task creation, assignment, dependency validation, status tracking, and efficient polling for Orchestrator daemons.

**Base URL:** `/api/tasks`

**Authentication:** Session-based (except polling endpoint)

**Version:** 1.0.0

---

## Table of Contents

1. [Core Endpoints](#core-endpoints)
2. [Data Models](#data-models)
3. [Status Transitions](#status-transitions)
4. [Priority Levels](#priority-levels)
5. [Dependency Validation](#dependency-validation)
6. [Error Codes](#error-codes)
7. [Examples](#examples)

---

## Core Endpoints

### 1. List Tasks

**Endpoint:** `GET /api/tasks`

**Description:** Retrieve a paginated list of tasks with filtering and sorting.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| vpId | string | No | - | Filter by Orchestrator ID |
| workspaceId | string | No | - | Filter by workspace ID |
| status | string\|string[] | No | - | Filter by status(es) |
| priority | string\|string[] | No | - | Filter by priority(ies) |
| search | string | No | - | Search by title or description |
| tags | string[] | No | - | Filter by tags (AND operation) |
| assignedToId | string | No | - | Filter by assignee |
| includeCompleted | boolean | No | false | Include DONE and CANCELLED tasks |
| page | number | No | 1 | Pagination page (1-indexed) |
| limit | number | No | 20 | Items per page (max 100) |
| sortBy | string | No | createdAt | Sort field (createdAt, updatedAt, priority, dueDate, title, status) |
| sortOrder | string | No | desc | Sort direction (asc, desc) |

**Response:** 200 OK

```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Implement authentication",
      "description": "Add JWT-based auth to API",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "vpId": "vp_123",
      "workspaceId": "ws_123",
      "createdById": "user_456",
      "assignedToId": "user_789",
      "estimatedHours": 8,
      "dueDate": "2025-12-31T00:00:00Z",
      "tags": ["auth", "backend"],
      "dependsOn": ["task_456"],
      "metadata": {},
      "createdAt": "2025-01-10T10:00:00Z",
      "updatedAt": "2025-01-11T15:30:00Z",
      "completedAt": null,
      "vp": {
        "id": "vp_123",
        "role": "Senior Backend Engineer",
        "user": {
          "id": "user_123",
          "name": "Backend Bot",
          "email": "backend@bot.local"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### 2. Create Task

**Endpoint:** `POST /api/tasks`

**Description:** Create a new task with dependency validation.

**Authentication:** Required

**Request Body:**

```json
{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication to the API",
  "priority": "HIGH",
  "status": "TODO",
  "vpId": "vp_123",
  "workspaceId": "ws_123",
  "channelId": "ch_456",
  "estimatedHours": 8,
  "dueDate": "2025-12-31T00:00:00Z",
  "tags": ["auth", "backend"],
  "dependsOn": ["task_456"],
  "assignedToId": "user_789",
  "metadata": {
    "customField": "customValue"
  }
}
```

**Validation Rules:**

- `title`: Required, 1-500 characters
- `vpId`: Required, valid CUID
- `workspaceId`: Required, valid CUID
- `priority`: Optional, defaults to MEDIUM
- `status`: Optional, defaults to TODO
- `dependsOn`: Validated for circular dependencies
- `tags`: Array of strings, max 50 chars each
- `estimatedHours`: Positive integer, max 1000

**Response:** 201 Created

```json
{
  "data": {
    "id": "task_789",
    "title": "Implement user authentication",
    "priority": "HIGH",
    "status": "TODO",
    "vpId": "vp_123",
    "workspaceId": "ws_123",
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-10T10:00:00Z"
  },
  "message": "Task created successfully"
}
```

**Error Responses:**

- 400: Validation error (invalid input)
- 401: Unauthorized (not authenticated)
- 403: Forbidden (no workspace access)
- 404: Orchestrator not found in workspace

---

### 3. Get Task

**Endpoint:** `GET /api/tasks/[id]`

**Description:** Retrieve a specific task by ID.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Response:** 200 OK

```json
{
  "data": {
    "id": "task_123",
    "title": "Implement authentication",
    "priority": "HIGH",
    "status": "IN_PROGRESS",
    "vpId": "vp_123",
    "workspaceId": "ws_123",
    "estimatedHours": 8,
    "dueDate": "2025-12-31T00:00:00Z",
    "tags": ["auth", "backend"],
    "dependsOn": ["task_456"],
    "createdAt": "2025-01-10T10:00:00Z",
    "updatedAt": "2025-01-11T15:30:00Z",
    "completedAt": null
  }
}
```

**Error Responses:**

- 401: Unauthorized
- 403: Forbidden (no workspace access)
- 404: Task not found

---

### 4. Update Task

**Endpoint:** `PATCH /api/tasks/[id]`

**Description:** Update a specific task. Only provided fields are updated.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Request Body:** (all fields optional)

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "CRITICAL",
  "status": "IN_PROGRESS",
  "estimatedHours": 10,
  "dueDate": "2025-12-25T00:00:00Z",
  "tags": ["urgent", "critical"],
  "dependsOn": ["task_789"],
  "assignedToId": "user_456",
  "metadata": { "updated": true }
}
```

**Status Transition Rules:**

- Cannot transition to `IN_PROGRESS` or `DONE` if dependencies are incomplete
- Cannot transition to `BLOCKED` from `DONE`
- Can transition to `CANCELLED` from any status

**Response:** 200 OK

```json
{
  "data": { ... },
  "message": "Task updated successfully"
}
```

**Error Responses:**

- 400: Validation error or invalid state transition
- 401: Unauthorized
- 403: Forbidden
- 404: Task not found or assignee not found

---

### 5. Delete Task

**Endpoint:** `DELETE /api/tasks/[id]`

**Description:** Delete a specific task permanently.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Response:** 200 OK

```json
{
  "data": null,
  "message": "Task deleted successfully"
}
```

**Error Responses:**

- 401: Unauthorized
- 403: Forbidden
- 404: Task not found

---

### 6. Assign Tasks

**Endpoint:** `POST /api/tasks/assign`

**Description:** Assign one or more tasks to a user (human or VP).

**Authentication:** Required

**Request Body:**

```json
{
  "taskIds": ["task_123", "task_456"],
  "assigneeId": "user_789",
  "reason": "User has capacity for these tasks",
  "metadata": { "assignmentPriority": "urgent" }
}
```

**Response:** 200 OK / 207 Multi-Status

```json
{
  "data": {
    "assigned": [
      {
        "taskId": "task_123",
        "success": true,
        "data": { ... }
      }
    ],
    "failed": [
      {
        "taskId": "task_456",
        "success": false,
        "error": "Task not found"
      }
    ],
    "notFound": ["task_999"]
  },
  "summary": {
    "total": 3,
    "successful": 1,
    "failed": 1,
    "notFound": 1
  },
  "message": "Partial assignment completed"
}
```

---

### 7. Poll Tasks (VP Daemon)

**Endpoint:** `POST /api/tasks/poll`

**Description:** Poll for tasks assigned to a VP. Used by Orchestrator daemon services.

**Authentication:** Not required (service-to-service)

**Request Body:**

```json
{
  "vpId": "vp_123",
  "workspaceId": "ws_123",
  "status": ["TODO", "IN_PROGRESS"],
  "minPriority": "HIGH",
  "since": "2025-01-10T10:00:00Z",
  "limit": 100
}
```

**Response:** 200 OK

```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Implement feature",
      "priority": "HIGH",
      "status": "TODO",
      "vpId": "vp_123",
      "estimatedHours": 8,
      "dueDate": "2025-12-31T00:00:00Z",
      "tags": ["feature"],
      "dependsOn": [],
      "createdAt": "2025-01-10T10:00:00Z",
      "updatedAt": "2025-01-10T10:00:00Z"
    }
  ],
  "metadata": {
    "vpId": "vp_123",
    "workspaceId": "ws_123",
    "polledAt": "2025-01-10T15:30:00Z",
    "since": "2025-01-10T10:00:00Z",
    "tasksReturned": 50,
    "hasMore": true
  }
}
```

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| status | Filter by status array (filters multiple statuses) |
| minPriority | Minimum priority (CRITICAL > HIGH > MEDIUM > LOW) |
| since | Only return tasks updated after this timestamp (delta updates) |
| limit | Max tasks to return (default 100, max 1000) |

---

### 8. Get Orchestrator Backlog

**Endpoint:** `GET /api/orchestrators/[id]/backlog`

**Description:** Retrieve a VP's task backlog with priority-based sorting.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Orchestrator ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string\|string[] | - | Filter by status |
| priority | string\|string[] | - | Filter by priority |
| includeCompleted | boolean | false | Include completed tasks |
| sortBy | string | priority | Sort field (priority, dueDate, createdAt, status) |
| sortOrder | string | asc | Sort direction (asc, desc) |
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |

**Response:** 200 OK

```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Critical task",
      "priority": "CRITICAL",
      "status": "TODO",
      "vpId": "vp_123",
      "dueDate": "2025-01-15T00:00:00Z",
      "estimatedHours": 4,
      "tags": ["critical"],
      "createdAt": "2025-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 25,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "metrics": {
    "vpId": "vp_123",
    "total": 25,
    "byStatus": {
      "todo": 15,
      "inProgress": 5,
      "blocked": 2,
      "done": 3
    },
    "completionRate": "12.00"
  }
}
```

---

## Data Models

### Task Object

```typescript
interface Task {
  id: string;                    // CUID
  title: string;                 // Task title (1-500 chars)
  description: string | null;    // Detailed description
  priority: TaskPriority;        // CRITICAL | HIGH | MEDIUM | LOW
  status: TaskStatus;            // TODO | IN_PROGRESS | BLOCKED | DONE | CANCELLED
  vpId: string;                  // Assigned Orchestrator ID
  workspaceId: string;           // Workspace ID
  channelId: string | null;      // Optional channel context
  createdById: string;           // Creator user ID
  assignedToId: string | null;   // Assigned to user/VP
  estimatedHours: number | null; // Estimated hours
  dueDate: Date | null;          // Due date
  tags: string[];                // Category tags
  dependsOn: string[];           // Dependency task IDs
  metadata: Record<string, unknown>; // Custom data
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
  completedAt: Date | null;      // Completion timestamp
}
```

### Priority Levels

**Ordinal Values:**

```
CRITICAL  → 0 (Highest)
HIGH      → 1
MEDIUM    → 2
LOW       → 3 (Lowest)
```

**Usage in Sorting:**
- Default sort is always by priority ascending (CRITICAL first)
- Can be overridden with `sortBy` parameter

### Status Values

| Status | Description |
|--------|-------------|
| TODO | Task not started |
| IN_PROGRESS | Task is being worked on |
| BLOCKED | Task is blocked by dependencies or other issues |
| DONE | Task completed successfully |
| CANCELLED | Task cancelled and will not be completed |

---

## Dependency Validation

### Circular Dependency Detection

The API automatically detects and prevents circular dependencies:

```
Task A → Task B → Task C → Task A  ❌ REJECTED
```

### Dependency Rules

1. **Cannot transition to IN_PROGRESS/DONE** if dependencies are incomplete
2. **Dependencies must exist** in the same workspace
3. **Circular references** are automatically detected
4. **Self-dependencies** are rejected

### Example

```javascript
// Valid: Parent → Child dependency
POST /api/tasks
{
  "title": "Child Task",
  "vpId": "vp_123",
  "workspaceId": "ws_123",
  "dependsOn": ["parent_task_123"]
}

// Invalid: Circular dependency
POST /api/tasks
{
  "title": "Task A",
  "dependsOn": ["task_b"]  // if task_b depends on this task
}
// Error: CIRCULAR_DEPENDENCY
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNAUTHORIZED | 401 | User not authenticated |
| FORBIDDEN | 403 | User lacks permission |
| VALIDATION_ERROR | 400 | Input validation failed |
| NOT_FOUND | 404 | Task not found |
| VP_NOT_FOUND | 404 | Orchestrator not found in workspace |
| WORKSPACE_NOT_FOUND | 404 | Workspace not found |
| ASSIGNEE_NOT_FOUND | 404 | Assignee user not found |
| DEPENDENCY_VIOLATION | 400 | Invalid task dependencies |
| CIRCULAR_DEPENDENCY | 400 | Circular dependency detected |
| INVALID_STATE_TRANSITION | 400 | Invalid status transition |
| INTERNAL_ERROR | 500 | Server error |
| BULK_OPERATION_PARTIAL | 207 | Partial bulk operation success |

### Error Response Format

```json
{
  "error": "Invalid task dependencies",
  "code": "DEPENDENCY_VIOLATION",
  "details": {
    "circularDependencies": ["task_456"],
    "unresolvedDependencies": ["task_999"]
  }
}
```

---

## Status Transitions

### Valid Transitions

```
TODO → IN_PROGRESS, BLOCKED, CANCELLED
IN_PROGRESS → BLOCKED, DONE, CANCELLED
BLOCKED → IN_PROGRESS, CANCELLED (if unblocked)
DONE → (terminal state)
CANCELLED → (terminal state)
```

### Transition Rules

- **IN_PROGRESS/DONE**: Requires all dependencies to be DONE or CANCELLED
- **BLOCKED**: Indicates task cannot proceed (optional manual state)
- **DONE/CANCELLED**: Terminal states, cannot transition further

---

## Examples

### Example 1: Create Task with Dependencies

```bash
curl -X POST https://api.example.com/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement feature",
    "description": "Build new feature based on requirements",
    "priority": "HIGH",
    "vpId": "vp_123",
    "workspaceId": "ws_123",
    "estimatedHours": 16,
    "dueDate": "2025-12-31T00:00:00Z",
    "tags": ["feature", "high-priority"],
    "dependsOn": ["task_design_123", "task_review_456"]
  }'
```

**Response:**

```json
{
  "data": {
    "id": "task_impl_789",
    "title": "Implement feature",
    "status": "TODO",
    "priority": "HIGH",
    "dependsOn": ["task_design_123", "task_review_456"],
    "createdAt": "2025-01-10T10:00:00Z"
  },
  "message": "Task created successfully"
}
```

### Example 2: Update Task Status (with validation)

```bash
curl -X PATCH https://api.example.com/api/tasks/task_impl_789 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

**Success Response (if dependencies are done):**

```json
{
  "data": {
    "id": "task_impl_789",
    "status": "IN_PROGRESS",
    "updatedAt": "2025-01-10T11:00:00Z"
  },
  "message": "Task updated successfully"
}
```

**Error Response (if dependencies incomplete):**

```json
{
  "error": "Cannot start task. Unfinished dependencies: Design, Code Review",
  "code": "INVALID_STATE_TRANSITION"
}
```

### Example 3: Assign Multiple Tasks

```bash
curl -X POST https://api.example.com/api/tasks/assign \
  -H "Content-Type: application/json" \
  -d '{
    "taskIds": ["task_123", "task_456", "task_789"],
    "assigneeId": "vp_999",
    "reason": "VP has capacity for these tasks"
  }'
```

**Response:**

```json
{
  "data": {
    "assigned": [
      {
        "taskId": "task_123",
        "success": true,
        "data": { ... }
      },
      {
        "taskId": "task_456",
        "success": true,
        "data": { ... }
      }
    ],
    "failed": [],
    "notFound": ["task_789"]
  },
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 0,
    "notFound": 1
  }
}
```

### Example 4: Orchestrator Daemon Polling

```bash
curl -X POST https://api.example.com/api/tasks/poll \
  -H "Content-Type: application/json" \
  -d '{
    "vpId": "vp_123",
    "workspaceId": "ws_123",
    "status": ["TODO", "IN_PROGRESS"],
    "minPriority": "HIGH",
    "limit": 100
  }'
```

**Response:**

```json
{
  "data": [
    {
      "id": "task_critical_1",
      "title": "Critical bug fix",
      "priority": "CRITICAL",
      "status": "TODO",
      "estimatedHours": 2,
      "dueDate": "2025-01-12T00:00:00Z"
    },
    {
      "id": "task_high_2",
      "title": "Implement feature",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "estimatedHours": 8
    }
  ],
  "metadata": {
    "tasksReturned": 2,
    "hasMore": false,
    "polledAt": "2025-01-10T12:00:00Z"
  }
}
```

### Example 5: Get Orchestrator Backlog

```bash
curl -X GET "https://api.example.com/api/orchestrators/vp_123/backlog?status=TODO,IN_PROGRESS&priority=CRITICAL,HIGH&sortBy=priority" \
  -H "Authorization: Bearer token"
```

**Response:**

```json
{
  "data": [
    {
      "id": "task_1",
      "title": "Critical bug",
      "priority": "CRITICAL",
      "status": "TODO",
      "dueDate": "2025-01-12T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 25,
    "totalPages": 1
  },
  "metrics": {
    "total": 25,
    "byStatus": {
      "todo": 15,
      "inProgress": 8,
      "blocked": 2
    },
    "completionRate": "0.00"
  }
}
```

---

## Webhooks (Future)

Task webhooks will be available to notify external systems of task state changes:

- `task.created`
- `task.updated`
- `task.completed`
- `task.assigned`

---

## Rate Limiting

- **Default:** 100 requests per minute per user
- **Polling endpoint:** 1000 requests per minute per VP

---

## Versioning

Current version: **1.0.0**

Version management via `X-API-Version` header (default: latest)

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/neolith/issues
- Email: api-support@neolith.ai
- Slack: #api-support
