# Orchestrator Coordination API Reference

Quick reference guide for Orchestrator Cross-Coordination API endpoints.

## Base URL

All endpoints are under: `/api/orchestrators`

## Authentication

All endpoints require authentication via session token.

## Endpoints

### 1. Delegate Task

Transfer task ownership from one Orchestrator to another.

**Endpoint**: `POST /api/orchestrators/:id/delegate`

**Parameters**:
- `:id` - Source Orchestrator ID (path parameter)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| toVpId | string | Yes | Target Orchestrator ID (cuid) |
| taskId | string | Yes | Task ID to delegate (cuid) |
| note | string | No | Delegation note (max 1000 chars) |
| priority | enum | No | Priority override (LOW, MEDIUM, HIGH, CRITICAL) |
| dueDate | string | No | Due date override (ISO 8601) |

**Example**:
```bash
curl -X POST /api/orchestrators/vp_123/delegate \
  -H "Content-Type: application/json" \
  -d '{
    "toVpId": "vp_456",
    "taskId": "task_789",
    "note": "Better suited for your expertise",
    "priority": "HIGH"
  }'
```

**Success Response** (200):
```json
{
  "data": {
    "success": true,
    "taskId": "task_789",
    "fromVpId": "vp_123",
    "toVpId": "vp_456",
    "delegatedAt": "2024-11-26T17:00:00.000Z",
    "message": "Task successfully delegated from Backend Engineer to Frontend Engineer"
  },
  "message": "Task delegated successfully"
}
```

**Error Responses**:
- `400` - Validation error, invalid input
- `401` - Unauthorized
- `403` - Forbidden, insufficient permissions
- `404` - Orchestrator or task not found
- `500` - Internal server error

---

### 2. Request Collaboration

Request collaboration from other Orchestrators on a task.

**Endpoint**: `POST /api/orchestrators/:id/collaborate`

**Parameters**:
- `:id` - Primary Orchestrator ID (path parameter)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| taskId | string | Yes | Task ID requiring collaboration (cuid) |
| requiredVpIds | string[] | Yes | Array of Orchestrator IDs (1-10, cuid) |
| roles | object | No | Map of Orchestrator ID to role name |
| note | string | No | Collaboration note (max 1000 chars) |

**Example**:
```bash
curl -X POST /api/orchestrators/vp_123/collaborate \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_789",
    "requiredVpIds": ["vp_456", "vp_789"],
    "roles": {
      "vp_456": "code_reviewer",
      "vp_789": "tech_advisor"
    },
    "note": "Need both frontend and backend expertise"
  }'
```

**Success Response** (200):
```json
{
  "data": {
    "success": true,
    "taskId": "task_789",
    "primaryVpId": "vp_123",
    "collaboratorVpIds": ["vp_456", "vp_789"],
    "createdAt": "2024-11-26T17:00:00.000Z",
    "message": "Collaboration request sent to 2 VP(s)"
  },
  "message": "Collaboration request sent successfully"
}
```

---

### 3. Handoff Task

Handoff a task to another Orchestrator with context transfer.

**Endpoint**: `POST /api/orchestrators/:id/handoff`

**Parameters**:
- `:id` - Source Orchestrator ID (path parameter)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| toVpId | string | Yes | Target Orchestrator ID (cuid) |
| taskId | string | Yes | Task ID to handoff (cuid) |
| context | object | No | Handoff context data |
| notes | string | No | Handoff notes (max 2000 chars) |

**Example**:
```bash
curl -X POST /api/orchestrators/vp_123/handoff \
  -H "Content-Type: application/json" \
  -d '{
    "toVpId": "vp_456",
    "taskId": "task_789",
    "context": {
      "progress": "50%",
      "blockers": ["Waiting for API keys"],
      "completedSteps": ["Research", "Design"],
      "nextSteps": ["Implementation", "Testing"]
    },
    "notes": "Frontend complete, backend needs work"
  }'
```

**Success Response** (200):
```json
{
  "data": {
    "success": true,
    "taskId": "task_789",
    "fromVpId": "vp_123",
    "toVpId": "vp_456",
    "context": { ... },
    "handoffAt": "2024-11-26T17:00:00.000Z",
    "message": "Task handed off from Backend Engineer to Frontend Engineer"
  },
  "message": "Task handed off successfully"
}
```

---

### 4. Resolve Conflict

Resolve conflicts between multiple VPs.

**Endpoint**: `POST /api/orchestrators/conflicts`

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vpIds | string[] | Yes | Orchestrator IDs involved (2-10, cuid) |
| conflictType | enum | Yes | Conflict type (see below) |
| resolution | object | Yes | Resolution details |
| taskId | string | No | Related task ID (cuid) |
| workspaceId | string | No | Related workspace ID (cuid) |
| note | string | No | Resolution note (max 2000 chars) |

**Conflict Types**:
- `resource_conflict`
- `priority_conflict`
- `dependency_conflict`
- `ownership_conflict`
- `deadline_conflict`
- `other`

**Example**:
```bash
curl -X POST /api/orchestrators/conflicts \
  -H "Content-Type: application/json" \
  -d '{
    "vpIds": ["vp_123", "vp_456"],
    "conflictType": "priority_conflict",
    "resolution": {
      "decision": "Split into parallel tasks",
      "vp_123_tasks": ["backend_api"],
      "vp_456_tasks": ["frontend_ui"]
    },
    "taskId": "task_789",
    "note": "Both Orchestrators can work on different aspects"
  }'
```

**Success Response** (200):
```json
{
  "data": {
    "success": true,
    "conflictType": "priority_conflict",
    "involvedVpIds": ["vp_123", "vp_456"],
    "resolution": { ... },
    "resolvedAt": "2024-11-26T17:00:00.000Z",
    "message": "Conflict of type 'priority_conflict' resolved for 2 VP(s)"
  },
  "message": "Conflict resolved successfully"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "errors": {
      "fieldName": ["error message"]
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| VP_COORDINATION_NOT_FOUND | Orchestrator or task not found |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| VALIDATION_ERROR | Invalid input data |
| VP_NOT_FOUND | Specified Orchestrator doesn't exist |
| TASK_NOT_FOUND | Specified task doesn't exist |
| DIFFERENT_ORGANIZATION | Orchestrators in different organizations |
| INVALID_OWNERSHIP | Task doesn't belong to Orchestrator |
| INTERNAL_ERROR | Server error |

## Rate Limiting

Standard rate limits apply:
- 100 requests per minute per user
- 1000 requests per hour per organization

## Metadata Structure

Task metadata includes coordination history:

```typescript
{
  delegations?: [{
    fromVpId: string;
    toVpId: string;
    delegatedAt: string; // ISO 8601
    note?: string;
  }];
  collaborators?: [{
    vpId: string;
    role: string;
    addedAt: string; // ISO 8601
  }];
  handoffs?: [{
    fromVpId: string;
    toVpId: string;
    context: object;
    handoffAt: string; // ISO 8601
  }];
  conflicts?: [{
    type: string;
    vpIds: string[];
    resolution: object;
    resolvedAt: string; // ISO 8601
  }];
}
```

## Best Practices

1. **Delegation**: Use for permanent task transfers
2. **Collaboration**: Use for temporary multi-VP work
3. **Handoff**: Use when transferring in-progress work with context
4. **Conflict Resolution**: Document all decisions for audit trail

## SDK Usage (Future)

```typescript
import { VPCoordinationClient } from '@neolith/sdk';

const client = new VPCoordinationClient();

// Delegate
await client.delegate({
  fromVpId: 'vp_123',
  toVpId: 'vp_456',
  taskId: 'task_789',
  note: 'Better fit for your skills'
});

// Collaborate
await client.collaborate({
  vpId: 'vp_123',
  taskId: 'task_789',
  requiredVpIds: ['vp_456', 'vp_789'],
  roles: { 'vp_456': 'reviewer' }
});

// Handoff
await client.handoff({
  fromVpId: 'vp_123',
  toVpId: 'vp_456',
  taskId: 'task_789',
  context: { progress: '50%' }
});

// Resolve conflict
await client.resolveConflict({
  vpIds: ['vp_123', 'vp_456'],
  conflictType: 'priority_conflict',
  resolution: { decision: 'split_tasks' }
});
```

## Support

For issues or questions:
- Documentation: `/docs/VP_COORDINATION_IMPLEMENTATION.md`
- API Issues: Create ticket in issue tracker
- Security: Report via security@neolith.ai
