# Agent Backlog System API - Quick Reference

## Endpoints Overview

### 1. Orchestrator Backlog Management

#### Get VP's Task Backlog

```
GET /api/workspaces/{workspaceId}/orchestrators/{vpId}/backlog
```

**Query Parameters:**

- `status` - Filter by status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
- `priority` - Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
- `includeCompleted` - Include completed tasks (default: false)
- `includeStats` - Include task statistics (default: false)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `sortBy` - Sort field (priority, dueDate, createdAt, status)
- `sortOrder` - Sort direction (asc, desc)

**Response:**

```json
{
  "data": [...tasks],
  "vp": {
    "id": "vp_123",
    "role": "Backend Engineer",
    "user": {...}
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 42,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "statistics": {
    "total": 42,
    "byStatus": {...},
    "byPriority": {...},
    "completionRate": "65.50"
  }
}
```

#### Add Task to VP's Backlog

```
POST /api/workspaces/{workspaceId}/orchestrators/{vpId}/backlog
```

**Request Body:**

```json
{
  "title": "Implement feature X",
  "description": "Detailed description...",
  "priority": "HIGH",
  "status": "TODO",
  "estimatedHours": 8,
  "dueDate": "2025-12-31T00:00:00Z",
  "tags": ["feature", "backend"],
  "dependsOn": ["task_123"],
  "assignedToId": "user_456",
  "channelId": "channel_789",
  "metadata": {...}
}
```

**Response:**

```json
{
  "data": {...task},
  "message": "Task added to Orchestrator backlog successfully"
}
```

---

### 2. Task Polling

#### Get Next Available Task for VP

```
GET /api/workspaces/{workspaceId}/orchestrators/{vpId}/next-task
```

**Query Parameters:**

- `status` - Filter by status (default: TODO)
- `minPriority` - Minimum priority (CRITICAL, HIGH, MEDIUM, LOW)
- `capabilities` - Comma-separated list of required capabilities
- `deadlineWithinHours` - Consider tasks with deadline within X hours

**Response:**

```json
{
  "data": {...task},
  "vp": {
    "id": "vp_123",
    "role": "Backend Engineer",
    "user": {...}
  },
  "metadata": {
    "totalAvailable": 5,
    "totalCandidates": 12,
    "selectionCriteria": {
      "priority": "HIGH",
      "hasDependencies": false,
      "hasDueDate": true
    }
  }
}
```

**No Tasks Available:**

```json
{
  "data": null,
  "message": "No available tasks for this VP",
  "metadata": {
    "totalCandidates": 3,
    "blockedByDependencies": 3
  }
}
```

---

### 3. Task Assignment

#### Assign Task to Orchestrator or User

```
POST /api/workspaces/{workspaceId}/tasks/{taskId}/assign
```

**Request Body:**

```json
{
  "assigneeId": "vp_123",
  "assigneeType": "VP",
  "notes": "Assignment reason or context",
  "metadata": {...}
}
```

**Response:**

```json
{
  "data": {...task},
  "message": "Task assigned to John Doe successfully",
  "metadata": {
    "previousAssignee": "Unassigned",
    "newAssignee": "John Doe",
    "assigneeType": "VP"
  }
}
```

---

### 4. Task Completion

#### Mark Task as Complete

```
POST /api/workspaces/{workspaceId}/tasks/{taskId}/complete
```

**Request Body:**

```json
{
  "result": {
    "status": "success",
    "testsAdded": 15,
    "coverage": 92
  },
  "notes": "Implementation complete with comprehensive tests",
  "artifacts": [
    "https://github.com/repo/pull/123",
    "file_xyz_documentation",
    "https://deploy.example.com/build/456"
  ],
  "metadata": {...}
}
```

**Response:**

```json
{
  "data": {...task},
  "message": "Task marked as complete successfully",
  "metadata": {
    "completedAt": "2025-11-27T10:30:00Z",
    "completedBy": "John Doe",
    "artifactCount": 3,
    "channelNotified": true
  }
}
```

---

## Priority Ordering

Tasks are prioritized in this order:

1. **CRITICAL** - Urgent, blocking issues
2. **HIGH** - Important features or fixes
3. **MEDIUM** - Standard tasks (default)
4. **LOW** - Nice-to-have enhancements

---

## Task Status Flow

```
TODO → IN_PROGRESS → DONE
  ↓         ↓
BLOCKED  CANCELLED
```

---

## Error Codes

| Code                  | Description                                        |
| --------------------- | -------------------------------------------------- |
| `VP_NOT_FOUND`        | Orchestrator does not exist or is not in workspace |
| `WORKSPACE_NOT_FOUND` | Workspace does not exist                           |
| `TASK_NOT_FOUND`      | Task does not exist in workspace                   |
| `UNAUTHORIZED`        | Authentication required                            |
| `FORBIDDEN`           | Insufficient permissions                           |
| `VALIDATION_ERROR`    | Invalid request data                               |
| `ALREADY_COMPLETED`   | Task is already marked as complete                 |
| `INVALID_STATE`       | Task cannot transition to requested state          |
| `NO_AVAILABLE_TASKS`  | No tasks available for Orchestrator                |
| `INTERNAL_ERROR`      | Server error occurred                              |

---

## Authentication

All endpoints require authentication via NextAuth session:

```typescript
// Automatic via session cookie
// Or via Orchestrator service account credentials
```

---

## Usage Examples

### Example 1: Orchestrator Polling for Work

```bash
# 1. Orchestrator daemon polls for next task
curl -X GET \
  "https://api.example.com/api/workspaces/ws_123/orchestrators/vp_456/next-task?status=TODO&minPriority=MEDIUM" \
  -H "Cookie: next-auth.session-token=..."

# 2. Orchestrator self-assigns the task
curl -X POST \
  "https://api.example.com/api/workspaces/ws_123/tasks/task_789/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "assigneeId": "vp_456",
    "assigneeType": "VP",
    "notes": "Auto-assigned via polling"
  }'

# 3. Orchestrator completes the task
curl -X POST \
  "https://api.example.com/api/workspaces/ws_123/tasks/task_789/complete" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "notes": "Feature implemented successfully",
    "artifacts": ["https://github.com/repo/pull/123"]
  }'
```

### Example 2: Human Assigning Tasks

```bash
# 1. Get VP's current backlog
curl -X GET \
  "https://api.example.com/api/workspaces/ws_123/orchestrators/vp_456/backlog?includeStats=true" \
  -H "Cookie: next-auth.session-token=..."

# 2. Add new task to VP's backlog
curl -X POST \
  "https://api.example.com/api/workspaces/ws_123/orchestrators/vp_456/backlog" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "title": "Add user authentication",
    "priority": "HIGH",
    "estimatedHours": 8,
    "tags": ["auth", "security"]
  }'

# 3. Assign specific task to VP
curl -X POST \
  "https://api.example.com/api/workspaces/ws_123/tasks/task_new/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "assigneeId": "vp_456",
    "assigneeType": "VP",
    "notes": "VP has expertise in authentication"
  }'
```

### Example 3: Monitoring Orchestrator Progress

```bash
# Get VP's backlog with statistics
curl -X GET \
  "https://api.example.com/api/workspaces/ws_123/orchestrators/vp_456/backlog?includeCompleted=true&includeStats=true&sortBy=dueDate" \
  -H "Cookie: next-auth.session-token=..."

# Response includes:
# - All tasks (including completed)
# - Statistics by status and priority
# - Completion rate
# - Sorted by deadline
```

---

## Integration with Webhooks

When a task is completed, the system triggers `task.completed` webhooks:

**Webhook Payload:**

```json
{
  "event": "task.completed",
  "task": {
    "id": "task_123",
    "title": "Implement feature X",
    "status": "DONE",
    "completedAt": "2025-11-27T10:30:00Z",
    "completedBy": "user_456",
    "vpId": "vp_789",
    "workspaceId": "ws_123"
  },
  "completion": {
    "result": {...},
    "notes": "...",
    "artifacts": [...]
  }
}
```

Configure webhooks at:

```
POST /api/workspaces/{workspaceId}/webhooks
```

---

## Rate Limits

Recommended rate limits for Orchestrator daemons:

- **Next task polling:** 1 request per 5 seconds
- **Backlog queries:** 1 request per 10 seconds
- **Task operations:** 10 requests per minute

---

## Best Practices

### For Orchestrator Daemons:

1. Poll for next task at regular intervals (5-10 seconds)
2. Self-assign task before starting work
3. Update task status to IN_PROGRESS immediately
4. Complete task with detailed artifacts
5. Handle NO_AVAILABLE_TASKS gracefully

### For Human Users:

1. Use `includeStats=true` to monitor Orchestrator performance
2. Set appropriate priorities for urgent tasks
3. Add comprehensive task descriptions
4. Tag tasks for better organization
5. Review completion artifacts

### For Integrations:

1. Subscribe to `task.completed` webhooks
2. Implement retry logic for failed deliveries
3. Validate webhook signatures
4. Process deliveries asynchronously
5. Monitor webhook delivery success rates

---

## TypeScript Types

```typescript
import type {
  AssignTaskInput,
  CompleteTaskInput,
  NextTaskFiltersInput,
  VPBacklogFiltersInput,
  AddBacklogTaskInput,
} from '@/lib/validations/task-backlog';

// Usage in client code
const assignment: AssignTaskInput = {
  assigneeId: 'vp_123',
  assigneeType: 'VP',
  notes: 'Assignment reason',
};
```

---

## Related Documentation

- [Task Management API](/docs/api-tasks.md)
- [VP Management API](/docs/api-vps.md)
- [Webhook Configuration](/docs/api-webhooks.md)
- [Workflow Automation](/docs/api-workflows.md)
