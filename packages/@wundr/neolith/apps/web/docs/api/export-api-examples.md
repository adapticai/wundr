# Export API Examples

## Overview

The Export API provides comprehensive workspace data export functionality with support for both
synchronous (small datasets) and asynchronous (large datasets) operations.

## Endpoints

### 1. GET /api/workspaces/{workspaceId}/export

Export workspace data synchronously (for datasets <10k records) or create async job.

**Query Parameters:**

- `type` (required): Data type to export
  - `channels` - Channel metadata
  - `messages` - Channel messages
  - `tasks` - Workspace tasks
  - `files` - Uploaded files metadata
  - `members` - Workspace members
  - `vps` - Orchestrators
  - `workflows` - Workflow definitions
  - `all` - All data types
- `format` (optional): Export format (default: `json`)
  - `json` - JSON format
  - `csv` - CSV format (flattened)
- `startDate` (optional): ISO datetime filter (inclusive)
- `endDate` (optional): ISO datetime filter (inclusive)

**Example Request (Synchronous - Small Dataset):**

```bash
curl -X GET \
  "https://api.neolith.app/api/workspaces/ws_123/export?type=channels&format=json" \
  -H "Authorization: Bearer <token>"
```

**Example Response (Synchronous):**

```json
{
  "workspaceId": "ws_123",
  "exportedAt": "2025-11-27T10:30:00Z",
  "type": "channels",
  "data": {
    "workspace": {
      "id": "ws_123",
      "name": "My Workspace",
      "slug": "my-workspace",
      "description": "Workspace description",
      "visibility": "PRIVATE",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-11-27T10:00:00Z"
    },
    "channels": [
      {
        "id": "ch_1",
        "name": "general",
        "slug": "general",
        "description": "General discussion",
        "type": "PUBLIC",
        "isArchived": false,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
      }
    ]
  },
  "metadata": {
    "totalRecords": 1,
    "format": "json",
    "dateRange": {
      "from": null,
      "to": null
    }
  }
}
```

**Example Response (Async - Large Dataset):**

```json
{
  "async": true,
  "jobId": "job_abc123",
  "status": "PENDING",
  "estimatedRecords": 25000,
  "message": "Export job created. Use GET /api/workspaces/{workspaceId}/export/jobs/{jobId} to check status."
}
```

**Example Request (CSV Format):**

```bash
curl -X GET \
  "https://api.neolith.app/api/workspaces/ws_123/export?type=tasks&format=csv&startDate=2025-01-01T00:00:00Z" \
  -H "Authorization: Bearer <token>" \
  -o tasks-export.csv
```

**Example CSV Response:**

```csv
# Tasks
id,title,description,status,priority,dueDate,tags,createdById,assignedToId,createdAt,updatedAt
task_1,"Implement feature","Feature details","IN_PROGRESS","HIGH","2025-12-01T00:00:00Z","backend,api","user_1","user_2","2025-11-01T00:00:00Z","2025-11-27T10:00:00Z"
task_2,"Fix bug","Bug description","TODO","MEDIUM",,"bug,frontend","user_1",,"2025-11-15T00:00:00Z","2025-11-15T00:00:00Z"
```

---

### 2. POST /api/workspaces/{workspaceId}/export

Create an async export job (for backward compatibility or explicit async requests).

**Request Body:**

```json
{
  "type": "messages",
  "format": "json",
  "startDate": "2025-11-01T00:00:00Z",
  "endDate": "2025-11-30T23:59:59Z"
}
```

**Example Request:**

```bash
curl -X POST \
  "https://api.neolith.app/api/workspaces/ws_123/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "all",
    "format": "csv",
    "startDate": "2025-01-01T00:00:00Z"
  }'
```

**Example Response:**

```json
{
  "async": true,
  "jobId": "job_xyz789",
  "status": "PENDING",
  "createdAt": "2025-11-27T10:30:00Z",
  "message": "Export job created. Use GET /api/workspaces/{workspaceId}/export/jobs/{jobId} to check status."
}
```

---

### 3. GET /api/workspaces/{workspaceId}/export/jobs

List all export jobs for a workspace.

**Query Parameters:**

- `status` (optional): Filter by job status
  - `PENDING` - Waiting to start
  - `PROCESSING` - Currently running
  - `COMPLETED` - Finished successfully
  - `FAILED` - Failed with error
- `limit` (optional): Number of jobs to return (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**

```bash
curl -X GET \
  "https://api.neolith.app/api/workspaces/ws_123/export/jobs?status=COMPLETED&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "jobs": [
    {
      "id": "job_abc123",
      "type": "all",
      "format": "JSON",
      "status": "COMPLETED",
      "progress": 100,
      "recordCount": 5432,
      "fileSize": 2457600,
      "fileUrl": "https://s3.amazonaws.com/exports/ws_123/job_abc123.json",
      "error": null,
      "dateRange": {
        "from": "2025-01-01T00:00:00Z",
        "to": "2025-11-30T23:59:59Z"
      },
      "requestedBy": "user_1",
      "createdAt": "2025-11-27T10:00:00Z",
      "startedAt": "2025-11-27T10:00:05Z",
      "completedAt": "2025-11-27T10:02:30Z",
      "duration": 145
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 4. GET /api/workspaces/{workspaceId}/export/jobs/{jobId}

Get status and details of a specific export job.

**Example Request:**

```bash
curl -X GET \
  "https://api.neolith.app/api/workspaces/ws_123/export/jobs/job_abc123" \
  -H "Authorization: Bearer <token>"
```

**Example Response (In Progress):**

```json
{
  "id": "job_abc123",
  "workspaceId": "ws_123",
  "type": "messages",
  "format": "CSV",
  "status": "PROCESSING",
  "progress": 65,
  "recordCount": null,
  "fileSize": null,
  "fileUrl": null,
  "error": null,
  "dateRange": {
    "from": "2025-01-01T00:00:00Z",
    "to": null
  },
  "requestedBy": "user_1",
  "createdAt": "2025-11-27T10:30:00Z",
  "startedAt": "2025-11-27T10:30:05Z",
  "completedAt": null,
  "duration": null
}
```

**Example Response (Completed):**

```json
{
  "id": "job_abc123",
  "workspaceId": "ws_123",
  "type": "messages",
  "format": "CSV",
  "status": "COMPLETED",
  "progress": 100,
  "recordCount": 12543,
  "fileSize": 5242880,
  "fileUrl": "https://s3.amazonaws.com/exports/ws_123/job_abc123.csv",
  "error": null,
  "dateRange": {
    "from": "2025-01-01T00:00:00Z",
    "to": null
  },
  "requestedBy": "user_1",
  "createdAt": "2025-11-27T10:30:00Z",
  "startedAt": "2025-11-27T10:30:05Z",
  "completedAt": "2025-11-27T10:35:22Z",
  "duration": 317
}
```

**Example Response (Failed):**

```json
{
  "id": "job_abc123",
  "workspaceId": "ws_123",
  "type": "all",
  "format": "JSON",
  "status": "FAILED",
  "progress": 45,
  "recordCount": null,
  "fileSize": null,
  "fileUrl": null,
  "error": "Database connection timeout while fetching messages",
  "dateRange": {
    "from": null,
    "to": null
  },
  "requestedBy": "user_1",
  "createdAt": "2025-11-27T10:30:00Z",
  "startedAt": "2025-11-27T10:30:05Z",
  "completedAt": "2025-11-27T10:32:10Z",
  "duration": 125
}
```

---

### 5. DELETE /api/workspaces/{workspaceId}/export/jobs/{jobId}

Cancel a pending/processing job or delete a completed/failed job.

**Example Request:**

```bash
curl -X DELETE \
  "https://api.neolith.app/api/workspaces/ws_123/export/jobs/job_abc123" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "message": "Export job deleted successfully",
  "jobId": "job_abc123"
}
```

---

## Export Data Types

### Channels Export (type=channels)

```json
{
  "channels": [
    {
      "id": "ch_1",
      "name": "general",
      "slug": "general",
      "description": "General discussion",
      "type": "PUBLIC",
      "isArchived": false,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Messages Export (type=messages)

```json
{
  "messages": [
    {
      "id": "msg_1",
      "content": "Hello, world!",
      "type": "TEXT",
      "channelId": "ch_1",
      "authorId": "user_1",
      "createdAt": "2025-11-27T10:00:00Z",
      "updatedAt": "2025-11-27T10:00:00Z"
    }
  ]
}
```

### Tasks Export (type=tasks)

```json
{
  "tasks": [
    {
      "id": "task_1",
      "title": "Implement feature",
      "description": "Feature details",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "dueDate": "2025-12-01T00:00:00Z",
      "tags": ["backend", "api"],
      "createdById": "user_1",
      "assignedToId": "user_2",
      "createdAt": "2025-11-01T00:00:00Z",
      "updatedAt": "2025-11-27T10:00:00Z"
    }
  ]
}
```

### Members Export (type=members)

```json
{
  "members": [
    {
      "id": "member_1",
      "role": "OWNER",
      "userId": "user_1",
      "joinedAt": "2025-01-01T00:00:00Z",
      "user": {
        "id": "user_1",
        "email": "user@example.com",
        "name": "John Doe",
        "displayName": "John"
      }
    }
  ]
}
```

### VPs Export (type=vps)

```json
{
  "vps": [
    {
      "id": "vp_1",
      "discipline": "Engineering",
      "role": "Backend Developer",
      "status": "ONLINE",
      "userId": "user_vp_1",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-11-27T10:00:00Z"
    }
  ]
}
```

### Workflows Export (type=workflows)

```json
{
  "workflows": [
    {
      "id": "wf_1",
      "name": "Deploy to Production",
      "description": "Automated deployment workflow",
      "status": "ACTIVE",
      "trigger": {
        "type": "manual",
        "conditions": []
      },
      "actions": [
        {
          "type": "deploy",
          "config": {
            "environment": "production"
          }
        }
      ],
      "tags": ["deployment", "production"],
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-11-27T10:00:00Z"
    }
  ]
}
```

---

## Authentication & Permissions

All export endpoints require:

- Valid authentication token
- Workspace membership
- `ADMIN` or `OWNER` role in the workspace

**Error Responses:**

```json
// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 403 Forbidden
{
  "error": "Forbidden: Only workspace admins can export data"
}

// 404 Not Found
{
  "error": "Workspace not found or access denied"
}
```

---

## Best Practices

1. **Use GET for small exports** (<10k records) to get immediate results
2. **Use POST for large exports** to create async jobs with progress tracking
3. **Filter by date range** to reduce export size and improve performance
4. **Choose appropriate format**:
   - Use JSON for complex nested data and re-importing
   - Use CSV for spreadsheet analysis and simple tabular data
5. **Poll job status** every 5-10 seconds for async exports
6. **Clean up old jobs** to save storage space

---

## Rate Limits

- Maximum 10 concurrent export jobs per workspace
- Maximum 100 export requests per hour per workspace
- Synchronous exports limited to 10k records
- CSV exports automatically flatten nested objects
