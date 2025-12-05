# Scheduled Reports API Documentation

Complete API documentation for the scheduled reports system.

## Base URL

```
/api/workspaces/{workspaceSlug}/reports/scheduled
```

## Authentication

All endpoints require authentication via NextAuth session. Include session cookie in requests.

## Endpoints

### List Scheduled Reports

Get a paginated list of scheduled reports for a workspace.

**Endpoint:** `GET /api/workspaces/{workspaceSlug}/reports/scheduled`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reportType` | string | - | Filter by report type |
| `isActive` | boolean | - | Filter by active status |
| `tag` | string | - | Filter by tag |
| `limit` | number | 50 | Number of results (max 100) |
| `offset` | number | 0 | Pagination offset |
| `sortBy` | enum | createdAt | Sort field: `name`, `createdAt`, `lastRun`, `nextRun` |
| `sortOrder` | enum | desc | Sort order: `asc`, `desc` |

**Response:** `200 OK`

```json
{
  "reports": [
    {
      "id": "clx123abc",
      "name": "Weekly Channel Analytics",
      "description": "Weekly summary of channel activity",
      "reportType": "channel-analytics",
      "cronExpression": "0 9 * * 1",
      "cronDescription": "Every Monday at 9:00",
      "timezone": "America/New_York",
      "exportFormats": ["pdf", "excel"],
      "emailDelivery": {
        "enabled": true,
        "recipients": ["team@example.com"],
        "subject": "Weekly Channel Analytics Report",
        "includeAttachment": true,
        "includeInlinePreview": false,
        "sendOnlyIfData": true,
        "ccRecipients": [],
        "bccRecipients": []
      },
      "parameters": {
        "dateRange": {
          "type": "last-7-days"
        },
        "channelIds": ["ch1", "ch2"]
      },
      "isActive": true,
      "tags": ["weekly", "analytics"],
      "lastRun": "2024-12-01T09:00:00Z",
      "lastRunStatus": "success",
      "nextRun": "2024-12-08T09:00:00Z",
      "runCount": 52,
      "failureCount": 2,
      "createdBy": {
        "id": "user123",
        "name": "John Doe",
        "email": "john@example.com",
        "avatarUrl": "https://..."
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-12-01T09:05:00Z"
    }
  ],
  "total": 15,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  },
  "workspace": {
    "id": "ws123",
    "name": "Acme Corp",
    "slug": "acme-corp"
  }
}
```

### Create Scheduled Report

Create a new scheduled report.

**Endpoint:** `POST /api/workspaces/{workspaceSlug}/reports/scheduled`

**Request Body:**

```json
{
  "name": "Daily User Engagement",
  "description": "Track daily active users and engagement metrics",
  "reportType": "user-engagement",
  "cronExpression": "0 8 * * *",
  "timezone": "UTC",
  "exportFormats": ["pdf", "csv"],
  "emailDelivery": {
    "enabled": true,
    "recipients": ["analytics@example.com"],
    "subject": "Daily User Engagement Report",
    "includeAttachment": true,
    "includeInlinePreview": false,
    "sendOnlyIfData": false
  },
  "parameters": {
    "dateRange": {
      "type": "last-7-days"
    },
    "minActivityLevel": "medium"
  },
  "isActive": true,
  "tags": ["daily", "engagement"]
}
```

**Response:** `201 Created`

```json
{
  "id": "clx456def",
  "name": "Daily User Engagement",
  "description": "Track daily active users and engagement metrics",
  "reportType": "user-engagement",
  "cronExpression": "0 8 * * *",
  "cronDescription": "Every day at 8:00",
  "timezone": "UTC",
  "exportFormats": ["pdf", "csv"],
  "emailDelivery": { /* ... */ },
  "parameters": { /* ... */ },
  "isActive": true,
  "tags": ["daily", "engagement"],
  "lastRun": null,
  "lastRunStatus": null,
  "nextRun": "2024-12-07T08:00:00Z",
  "runCount": 0,
  "failureCount": 0,
  "createdBy": { /* ... */ },
  "createdAt": "2024-12-06T10:30:00Z",
  "updatedAt": "2024-12-06T10:30:00Z"
}
```

**Validation Errors:** `400 Bad Request`

```json
{
  "error": "Validation failed",
  "details": {
    "cronExpression": ["Invalid cron expression format"],
    "emailDelivery": {
      "recipients": ["At least one recipient is required"]
    }
  }
}
```

### Get Scheduled Report

Get detailed information about a specific scheduled report.

**Endpoint:** `GET /api/workspaces/{workspaceSlug}/reports/scheduled/{reportId}`

**Response:** `200 OK`

```json
{
  "id": "clx123abc",
  "name": "Weekly Channel Analytics",
  /* ... all report fields ... */
  "executionHistory": [
    {
      "id": "exec123",
      "status": "COMPLETED",
      "startedAt": "2024-12-01T09:00:00Z",
      "completedAt": "2024-12-01T09:02:30Z",
      "recordCount": 1234,
      "fileSize": 567890,
      "error": null,
      "duration": 150000
    },
    {
      "id": "exec122",
      "status": "FAILED",
      "startedAt": "2024-11-24T09:00:00Z",
      "completedAt": "2024-11-24T09:01:00Z",
      "recordCount": null,
      "fileSize": null,
      "error": "Database connection timeout",
      "duration": 60000
    }
  ]
}
```

### Update Scheduled Report

Update an existing scheduled report.

**Endpoint:** `PUT /api/workspaces/{workspaceSlug}/reports/scheduled/{reportId}`

**Request Body:** (All fields optional)

```json
{
  "name": "Updated Report Name",
  "isActive": false,
  "cronExpression": "0 10 * * 1",
  "emailDelivery": {
    "enabled": true,
    "recipients": ["newteam@example.com"]
  }
}
```

**Response:** `200 OK` - Returns updated report object

**Permissions:**
- GUEST: Cannot update
- MEMBER: Can update own reports
- ADMIN/OWNER: Can update any report

### Delete Scheduled Report

Delete a scheduled report.

**Endpoint:** `DELETE /api/workspaces/{workspaceSlug}/reports/scheduled/{reportId}`

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Scheduled report deleted successfully"
}
```

**Permissions:**
- GUEST: Cannot delete
- MEMBER: Can delete own reports
- ADMIN/OWNER: Can delete any report

### Trigger Manual Execution

Manually trigger a scheduled report to run immediately.

**Endpoint:** `POST /api/workspaces/{workspaceSlug}/reports/scheduled/{reportId}/trigger`

**Response:** `202 Accepted`

```json
{
  "success": true,
  "message": "Report generation triggered successfully",
  "executionJob": {
    "id": "exec789",
    "status": "PENDING",
    "progress": 0,
    "createdAt": "2024-12-06T10:45:00Z"
  }
}
```

**Error - Concurrent Execution:** `409 Conflict`

```json
{
  "error": "A report of this type is already running. Please wait for it to complete."
}
```

## Report Types

Available report types:

| Type | Description |
|------|-------------|
| `workspace-activity` | Overall workspace activity and usage |
| `channel-analytics` | Channel-specific metrics and engagement |
| `user-engagement` | User activity and engagement patterns |
| `task-completion` | Task and project completion metrics |
| `workflow-execution` | Workflow automation performance |
| `security-audit` | Security events and compliance |
| `export-summary` | Data export activity summary |
| `custom` | Custom report configuration |

## Cron Expression Format

Standard cron format: `minute hour day-of-month month day-of-week`

### Examples

```
0 9 * * *       - Every day at 9:00 AM
0 9 * * 1       - Every Monday at 9:00 AM
0 0 1 * *       - First day of every month at midnight
0 */6 * * *     - Every 6 hours
30 8 * * 1-5    - Weekdays at 8:30 AM
0 0 1 */3 *     - First day of every quarter
```

### Presets

You can also use preset values:
- `0 * * * *` - HOURLY
- `0 0 * * *` - DAILY
- `0 0 * * 0` - WEEKLY (Sunday)
- `0 0 1 * *` - MONTHLY
- `0 0 1 */3 *` - QUARTERLY

### Restrictions

- Minimum frequency: 1 hour
- Maximum recipients: 50 (primary), 20 (CC), 20 (BCC)
- Maximum export formats: 5

## Export Formats

Supported export formats:

| Format | Description | Size | Best For |
|--------|-------------|------|----------|
| `pdf` | PDF document | Medium | Presentations, reports |
| `csv` | Comma-separated values | Small | Data analysis, Excel |
| `json` | JSON data | Small | API integration, processing |
| `excel` | Excel workbook (.xlsx) | Medium | Advanced spreadsheet analysis |
| `html` | HTML document | Small | Email previews, web viewing |

## Email Delivery Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Enable email delivery |
| `recipients` | string[] | - | Primary recipients (required if enabled) |
| `subject` | string | - | Email subject (auto-generated if omitted) |
| `includeAttachment` | boolean | true | Attach report file |
| `includeInlinePreview` | boolean | false | Include HTML preview in email body |
| `sendOnlyIfData` | boolean | false | Skip email if report has no data |
| `ccRecipients` | string[] | [] | CC recipients |
| `bccRecipients` | string[] | [] | BCC recipients |

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Request validation failed |
| 401 | `UNAUTHORIZED` | Authentication required |
| 403 | `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| 404 | `NOT_FOUND` | Report or workspace not found |
| 409 | `CONCURRENT_EXECUTION` | Report already running |
| 500 | `INTERNAL_ERROR` | Server error |

## Rate Limits

- List reports: 60 requests/minute
- Create report: 10 requests/minute
- Update report: 30 requests/minute
- Trigger execution: 5 requests/minute per report

## Best Practices

1. **Cron Expressions:**
   - Use meaningful schedules (e.g., business hours)
   - Consider timezone of recipients
   - Avoid scheduling all reports at the same time

2. **Email Delivery:**
   - Keep recipient lists manageable
   - Use descriptive subject lines
   - Enable `sendOnlyIfData` for optional reports

3. **Parameters:**
   - Use appropriate date ranges
   - Filter to relevant data only
   - Test parameters before scheduling

4. **Monitoring:**
   - Check execution history regularly
   - Set up alerts for failures
   - Review email delivery success

5. **Performance:**
   - Limit concurrent report executions
   - Use appropriate export formats
   - Consider data volume when scheduling

## Examples

### Create Daily Active Users Report

```bash
curl -X POST \
  https://api.example.com/api/workspaces/acme-corp/reports/scheduled \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Daily Active Users",
    "reportType": "user-engagement",
    "cronExpression": "0 8 * * *",
    "timezone": "America/New_York",
    "exportFormats": ["pdf", "csv"],
    "emailDelivery": {
      "enabled": true,
      "recipients": ["analytics@example.com"],
      "includeAttachment": true
    },
    "parameters": {
      "dateRange": {
        "type": "last-7-days"
      }
    },
    "isActive": true
  }'
```

### Update Report Recipients

```bash
curl -X PUT \
  https://api.example.com/api/workspaces/acme-corp/reports/scheduled/clx123abc \
  -H 'Content-Type: application/json' \
  -d '{
    "emailDelivery": {
      "enabled": true,
      "recipients": ["team@example.com", "manager@example.com"],
      "ccRecipients": ["observer@example.com"]
    }
  }'
```

### Pause a Report

```bash
curl -X PUT \
  https://api.example.com/api/workspaces/acme-corp/reports/scheduled/clx123abc \
  -H 'Content-Type: application/json' \
  -d '{"isActive": false}'
```

### Trigger Manual Execution

```bash
curl -X POST \
  https://api.example.com/api/workspaces/acme-corp/reports/scheduled/clx123abc/trigger
```
