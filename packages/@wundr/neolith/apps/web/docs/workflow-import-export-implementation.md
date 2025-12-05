# Workflow Import/Export Implementation

## Overview

Comprehensive workflow import/export functionality with validation, conflict resolution, and batch operations.

## Components

### 1. WorkflowExport Component

**Location**: `/apps/web/components/workflow/workflow-export.tsx`

**Features**:
- Single and batch workflow export
- JSON format with customizable options
- Export options:
  - Include/exclude execution history (last 50 runs)
  - Include/exclude metadata (dates, run counts)
  - Include/exclude workflow variables
  - Include/exclude permission settings
  - Pretty print JSON formatting
- Real-time file size estimation
- Copy to clipboard functionality
- Download as JSON file
- Comprehensive export summary

**Props**:
```typescript
interface WorkflowExportProps {
  workflows: Workflow[];
  selectedWorkflowIds?: WorkflowId[];
  workspaceSlug: string;
  onExportComplete?: (result: ExportResult) => void;
  onExportError?: (error: Error) => void;
  trigger?: React.ReactNode;
}
```

**Usage**:
```tsx
import { WorkflowExport } from '@/components/workflow';

<WorkflowExport
  workflows={workflows}
  selectedWorkflowIds={['wf_1', 'wf_2']}
  workspaceSlug={workspaceSlug}
  onExportComplete={(result) => {
    console.log('Exported:', result.fileName);
  }}
/>
```

### 2. WorkflowImport Component

**Location**: `/apps/web/components/workflow/workflow-import.tsx`

**Features**:
- Drag-and-drop file upload
- File browser selection
- JSON validation with detailed error messages
- Conflict resolution strategies:
  - **Skip**: Don't import if workflow exists
  - **Rename**: Add counter suffix (e.g., "My Workflow (2)")
  - **Overwrite**: Replace existing workflow
- Multi-workflow batch import
- Visual validation feedback:
  - Valid workflows (green checkmark)
  - Invalid workflows (red X)
  - Warnings (yellow badge)
- Expandable error/warning details
- Import progress tracking
- Import results summary

**Props**:
```typescript
interface WorkflowImportProps {
  workspaceSlug: string;
  existingWorkflows?: Workflow[];
  onImportComplete?: (results: ImportResult[]) => void;
  onImportError?: (error: Error) => void;
  trigger?: React.ReactNode;
}
```

**Usage**:
```tsx
import { WorkflowImport } from '@/components/workflow';

<WorkflowImport
  workspaceSlug={workspaceSlug}
  existingWorkflows={existingWorkflows}
  onImportComplete={(results) => {
    const success = results.filter(r => r.success).length;
    console.log(`Imported ${success} workflows`);
  }}
/>
```

## API Routes

### 1. Export API

**Location**: `/apps/web/app/api/workspaces/[workspaceSlug]/workflows/export/route.ts`

**Endpoints**:

#### GET `/api/workspaces/:workspaceSlug/workflows/export`
Export workflows via query parameters.

**Query Parameters**:
- `ids` (required): Comma-separated workflow IDs
- `includeExecutionHistory` (optional): Include last 50 executions (default: false)
- `includeMetadata` (optional): Include timestamps, run counts (default: true)
- `includeVariables` (optional): Include workflow variables (default: true)
- `includePermissions` (optional): Include permission settings (default: false)
- `prettyPrint` (optional): Format JSON with indentation (default: true)

**Example**:
```bash
GET /api/workspaces/ws_123/workflows/export?ids=wf_1,wf_2&includeExecutionHistory=true
```

**Response**:
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-05T20:00:00Z",
  "workflow": {
    "id": "wf_1",
    "name": "Welcome Flow",
    "description": "Onboard new users",
    "trigger": { "type": "user_join" },
    "actions": [...],
    "metadata": {...}
  },
  "executionHistory": [...]
}
```

#### POST `/api/workspaces/:workspaceSlug/workflows/export`
Export workflows via POST body for more control.

**Request Body**:
```json
{
  "workflowIds": ["wf_1", "wf_2"],
  "options": {
    "includeExecutionHistory": true,
    "includeMetadata": true,
    "includeVariables": true,
    "includePermissions": false,
    "prettyPrint": true
  }
}
```

### 2. Import API

**Location**: `/apps/web/app/api/workspaces/[workspaceSlug]/workflows/import/route.ts`

**Endpoint**:

#### POST `/api/workspaces/:workspaceSlug/workflows/import`
Import workflows from JSON with validation and conflict resolution.

**Request Body**:
```json
{
  "workflows": [
    {
      "name": "Welcome Flow",
      "description": "Onboard new users",
      "trigger": { "type": "user_join" },
      "actions": [...]
    }
  ],
  "conflictResolution": "rename",
  "validateOnly": false
}
```

**Parameters**:
- `workflows` (required): Array of workflow objects
- `conflictResolution` (optional): "skip" | "rename" | "overwrite" (default: "rename")
- `validateOnly` (optional): Only validate without importing (default: false)

**Response**:
```json
{
  "success": true,
  "message": "Import complete: 2 imported, 0 failed",
  "results": [
    {
      "success": true,
      "workflowName": "Welcome Flow",
      "workflowId": "wf_new_1",
      "warnings": ["Workflow renamed from 'Welcome Flow' to 'Welcome Flow (2)'"]
    }
  ],
  "summary": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "warnings": 1
  }
}
```

## Validation

### Workflow Validation Rules

The import process validates:

1. **Required Fields**:
   - `name`: Must be a non-empty string
   - `trigger`: Must be a valid trigger configuration
   - `actions`: Must be an array with at least one action

2. **Trigger Validation**:
   - Must have a valid `type` field
   - Type-specific configuration validation

3. **Action Validation**:
   - Each action must have `type` and `config` fields
   - Configuration must match action type schema

4. **Name Conflict Detection**:
   - Checks against existing workflows in workspace
   - Applies conflict resolution strategy

### Validation Errors

Errors are categorized by severity:

- **Errors**: Block import, must be fixed
- **Warnings**: Allow import with notification

Example validation errors:
```typescript
{
  field: 'trigger.type',
  message: 'Trigger type is required',
  severity: 'error'
}
```

## Export Format

### Standard Export Format

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-05T20:00:00Z",
  "workflow": {
    "id": "wf_123",
    "name": "Welcome Flow",
    "description": "Onboard new users",
    "status": "active",
    "workspaceId": "ws_123",
    "trigger": {
      "type": "user_join"
    },
    "actions": [
      {
        "type": "send_message",
        "order": 0,
        "config": {
          "channelId": "ch_welcome",
          "message": "Welcome to the workspace!"
        },
        "errorHandling": {
          "onError": "retry",
          "retryCount": 3,
          "retryDelay": 5000
        }
      }
    ],
    "variables": [],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T10:30:00Z",
    "createdBy": "user_123",
    "lastRunAt": "2025-12-01T12:00:00Z",
    "runCount": 150,
    "errorCount": 2
  },
  "executionHistory": [
    {
      "id": "exec_1",
      "status": "completed",
      "startedAt": "2025-12-01T12:00:00Z",
      "completedAt": "2025-12-01T12:00:05Z",
      "triggeredBy": "user_456"
    }
  ],
  "permissions": []
}
```

### Batch Export Format

When exporting multiple workflows, the format is an array:

```json
[
  {
    "version": "1.0.0",
    "exportedAt": "2025-12-05T20:00:00Z",
    "workflow": {...}
  },
  {
    "version": "1.0.0",
    "exportedAt": "2025-12-05T20:00:00Z",
    "workflow": {...}
  }
]
```

## Security

### Authentication & Authorization

- All import/export operations require authentication
- User must be a workspace member
- Workspace access is verified before any operation
- Sensitive data (API keys, secrets) should be excluded from exports

### Data Privacy

- Execution history includes only basic metadata
- User IDs are preserved but personal data is excluded
- Permission exports include role/team info but not credentials

## Error Handling

### Client-Side Errors

- File parsing errors (invalid JSON)
- Validation errors (missing required fields)
- Network errors (failed API requests)
- Browser compatibility issues

### Server-Side Errors

- Database errors (Prisma)
- Workspace access denied
- Duplicate workflow names
- Invalid workflow data

### Error Recovery

- Detailed error messages with field-level granularity
- Partial import support (some workflows succeed, some fail)
- Rollback on critical errors
- User-friendly error explanations

## Performance

### Optimization Strategies

1. **Batch Processing**: Import/export multiple workflows efficiently
2. **Lazy Loading**: Fetch execution history only when requested
3. **Streaming**: Large file support through chunked processing
4. **Caching**: Validate once, use multiple times

### Size Limits

- Recommended: < 5MB per export
- Maximum: 50MB (configurable)
- Workflows per batch: < 100 (recommended)

## Usage Examples

### Example 1: Export Single Workflow

```tsx
import { WorkflowExport } from '@/components/workflow';

function MyComponent() {
  return (
    <WorkflowExport
      workflows={[selectedWorkflow]}
      workspaceSlug="my-workspace"
      onExportComplete={(result) => {
        toast.success(`Exported ${result.fileName}`);
      }}
    />
  );
}
```

### Example 2: Batch Export with Options

```tsx
<WorkflowExport
  workflows={workflows}
  selectedWorkflowIds={selectedIds}
  workspaceSlug="my-workspace"
  trigger={
    <Button variant="outline">
      <Download className="mr-2" />
      Export Selected
    </Button>
  }
/>
```

### Example 3: Import with Conflict Resolution

```tsx
import { WorkflowImport } from '@/components/workflow';

function ImportButton() {
  return (
    <WorkflowImport
      workspaceSlug="my-workspace"
      existingWorkflows={existingWorkflows}
      onImportComplete={(results) => {
        const success = results.filter(r => r.success).length;
        toast.success(`Successfully imported ${success} workflows`);
      }}
      onImportError={(error) => {
        toast.error(`Import failed: ${error.message}`);
      }}
    />
  );
}
```

### Example 4: API Direct Usage

```typescript
// Export workflows
const response = await fetch(
  `/api/workspaces/${workspaceSlug}/workflows/export`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowIds: ['wf_1', 'wf_2'],
      options: {
        includeExecutionHistory: true,
        prettyPrint: true,
      },
    }),
  }
);
const exportData = await response.json();

// Import workflows
const importResponse = await fetch(
  `/api/workspaces/${workspaceSlug}/workflows/import`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflows: importData,
      conflictResolution: 'rename',
    }),
  }
);
const { results, summary } = await importResponse.json();
```

## Testing

### Unit Tests

Test files should cover:
- Workflow validation logic
- JSON parsing and serialization
- Error handling paths
- Conflict resolution strategies

### Integration Tests

- End-to-end export flow
- End-to-end import flow
- API route handlers
- Database operations

### Manual Testing Checklist

- [ ] Export single workflow
- [ ] Export multiple workflows
- [ ] Export with all options enabled
- [ ] Import valid workflow
- [ ] Import invalid workflow (should fail gracefully)
- [ ] Import with name conflicts
- [ ] Import batch with mixed valid/invalid
- [ ] Test all conflict resolution strategies
- [ ] Test drag-and-drop upload
- [ ] Test file browser upload
- [ ] Verify exported JSON structure
- [ ] Verify import result messages

## Future Enhancements

### Potential Features

1. **YAML Support**: Export/import in YAML format
2. **CSV Export**: Summary data export for analytics
3. **Version Control**: Track import/export history
4. **Template Marketplace**: Share workflows publicly
5. **Scheduled Backups**: Automatic workflow backups
6. **Differential Export**: Export only changes since last export
7. **Compression**: ZIP archive support for large exports
8. **Cloud Storage**: Direct export to S3, Google Drive, etc.

### API Enhancements

1. **Bulk Operations**: Optimize for 1000+ workflows
2. **Webhooks**: Notify external systems on import/export
3. **Rate Limiting**: Prevent abuse
4. **Audit Logging**: Track all import/export operations

## Troubleshooting

### Common Issues

**Issue**: "Workflow validation failed"
- **Solution**: Check the detailed error messages in the validation panel
- **Cause**: Missing required fields or invalid configuration

**Issue**: "Import stuck at 'Importing...'"
- **Solution**: Check browser console for errors, refresh page
- **Cause**: Network timeout or server error

**Issue**: "Export file is too large"
- **Solution**: Disable execution history, export in smaller batches
- **Cause**: Too many workflows or large execution history

**Issue**: "Duplicate workflow name"
- **Solution**: Use 'rename' conflict resolution or rename manually
- **Cause**: Workflow with same name exists in workspace

## Support

For issues or questions:
- Check the validation error messages
- Review the API error responses
- Consult the implementation code
- File an issue with reproduction steps

---

**Last Updated**: December 5, 2025
**Version**: 1.0.0
**Status**: Production Ready
