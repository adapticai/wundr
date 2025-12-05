# Workflow Import/Export Quick Reference

## Quick Start

### Export Workflows

```tsx
import { WorkflowExport } from '@/components/workflow';

// Single workflow
<WorkflowExport
  workflows={[workflow]}
  workspaceSlug="my-workspace"
/>

// Multiple workflows
<WorkflowExport
  workflows={allWorkflows}
  selectedWorkflowIds={['wf_1', 'wf_2', 'wf_3']}
  workspaceSlug="my-workspace"
  onExportComplete={(result) => {
    console.log(`Exported: ${result.fileName} (${result.size} bytes)`);
  }}
/>
```

### Import Workflows

```tsx
import { WorkflowImport } from '@/components/workflow';

<WorkflowImport
  workspaceSlug='my-workspace'
  existingWorkflows={existingWorkflows}
  onImportComplete={results => {
    const success = results.filter(r => r.success).length;
    toast.success(`Imported ${success} workflows`);
  }}
/>;
```

## API Endpoints

### Export via GET

```bash
# Export single workflow
GET /api/workspaces/{workspaceSlug}/workflows/export?ids=wf_123

# Export multiple workflows with execution history
GET /api/workspaces/{workspaceSlug}/workflows/export?ids=wf_1,wf_2&includeExecutionHistory=true

# Export with all options
GET /api/workspaces/{workspaceSlug}/workflows/export?ids=wf_123&includeExecutionHistory=true&includeMetadata=true&includePermissions=true&prettyPrint=true
```

### Export via POST

```bash
curl -X POST /api/workspaces/my-workspace/workflows/export \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIds": ["wf_1", "wf_2"],
    "options": {
      "includeExecutionHistory": true,
      "includeMetadata": true,
      "prettyPrint": true
    }
  }'
```

### Import via POST

```bash
curl -X POST /api/workspaces/my-workspace/workflows/import \
  -H "Content-Type: application/json" \
  -d '{
    "workflows": [
      {
        "name": "Welcome Flow",
        "description": "Onboard new users",
        "trigger": { "type": "user_join" },
        "actions": [
          {
            "type": "send_message",
            "order": 0,
            "config": {
              "channelId": "ch_welcome",
              "message": "Welcome!"
            }
          }
        ]
      }
    ],
    "conflictResolution": "rename"
  }'
```

## Export Options

| Option                    | Type    | Default | Description                          |
| ------------------------- | ------- | ------- | ------------------------------------ |
| `includeExecutionHistory` | boolean | false   | Include last 50 workflow executions  |
| `includeMetadata`         | boolean | true    | Include timestamps, run counts, etc. |
| `includeVariables`        | boolean | true    | Include workflow variables           |
| `includePermissions`      | boolean | false   | Include permission settings          |
| `prettyPrint`             | boolean | true    | Format JSON with indentation         |

## Import Options

| Option               | Type                              | Default  | Description                     |
| -------------------- | --------------------------------- | -------- | ------------------------------- |
| `conflictResolution` | 'skip' \| 'rename' \| 'overwrite' | 'rename' | How to handle name conflicts    |
| `validateOnly`       | boolean                           | false    | Only validate without importing |

## Conflict Resolution Strategies

### Skip

Workflows with existing names are not imported.

```typescript
conflictResolution: 'skip';
```

### Rename (Default)

Adds counter suffix to duplicate names.

```typescript
conflictResolution: 'rename';
// "My Workflow" becomes "My Workflow (2)"
```

### Overwrite

Replaces existing workflows with same name.

```typescript
conflictResolution: 'overwrite';
// Warning: Permanently deletes existing workflow!
```

## Export Format

### Minimal Export

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-05T20:00:00Z",
  "workflow": {
    "name": "Welcome Flow",
    "trigger": { "type": "user_join" },
    "actions": [...]
  }
}
```

### Full Export

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-12-05T20:00:00Z",
  "workflow": {
    "id": "wf_123",
    "name": "Welcome Flow",
    "description": "Onboard new users",
    "status": "active",
    "trigger": { "type": "user_join" },
    "actions": [...],
    "variables": [...],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T10:30:00Z",
    "runCount": 150,
    "errorCount": 2
  },
  "executionHistory": [...],
  "permissions": [...]
}
```

## Common Patterns

### Backup All Workflows

```tsx
function BackupWorkflows({ workflows, workspaceSlug }) {
  return (
    <WorkflowExport
      workflows={workflows}
      workspaceSlug={workspaceSlug}
      onExportComplete={result => {
        // Save to external storage
        saveToStorage(result.fileName);
      }}
      trigger={
        <Button>
          <Save className='mr-2' />
          Backup All Workflows
        </Button>
      }
    />
  );
}
```

### Restore from Backup

```tsx
function RestoreWorkflows({ workspaceSlug }) {
  return (
    <WorkflowImport
      workspaceSlug={workspaceSlug}
      onImportComplete={results => {
        router.refresh();
        toast.success(`Restored ${results.length} workflows`);
      }}
      trigger={
        <Button variant='outline'>
          <Upload className='mr-2' />
          Restore from Backup
        </Button>
      }
    />
  );
}
```

### Validate Before Import

```bash
# Validate only (doesn't import)
curl -X POST /api/workspaces/my-workspace/workflows/import \
  -H "Content-Type: application/json" \
  -d '{
    "workflows": [...],
    "validateOnly": true
  }'

# Response shows validation errors
{
  "success": false,
  "results": [
    {
      "success": false,
      "workflowName": "Invalid Workflow",
      "error": "Validation failed: trigger.type: Trigger type is required"
    }
  ]
}
```

### Batch Export Selected

```tsx
function ExportSelected({ workflows, selectedIds, workspaceSlug }) {
  return (
    <WorkflowExport
      workflows={workflows}
      selectedWorkflowIds={selectedIds}
      workspaceSlug={workspaceSlug}
      trigger={
        <Button disabled={selectedIds.length === 0}>Export {selectedIds.length} Selected</Button>
      }
    />
  );
}
```

## Validation Rules

### Required Fields

- ✅ `name` - Non-empty string
- ✅ `trigger` - Valid trigger configuration
- ✅ `actions` - Array with at least one action

### Optional Fields

- `description` - String
- `variables` - Array of workflow variables
- `status` - 'active' | 'inactive' | 'draft' | 'archived'

### Common Validation Errors

| Error                       | Cause                   | Fix                                       |
| --------------------------- | ----------------------- | ----------------------------------------- |
| "Workflow name is required" | Missing `name` field    | Add name to workflow object               |
| "Trigger type is required"  | Missing `trigger.type`  | Add valid trigger type                    |
| "Actions must be an array"  | Actions is not array    | Ensure actions is []                      |
| "Action X is missing type"  | Action lacks type field | Add type to each action                   |
| "Workflow already exists"   | Name conflict           | Use different name or conflict resolution |

## Error Handling

### Client-Side Errors

```tsx
<WorkflowImport
  workspaceSlug={workspaceSlug}
  onImportError={error => {
    // File parsing error
    if (error.message.includes('JSON')) {
      toast.error('Invalid JSON file');
    }
    // Network error
    else if (error.message.includes('fetch')) {
      toast.error('Network error, please retry');
    }
    // Unknown error
    else {
      toast.error(`Import failed: ${error.message}`);
    }
  }}
/>
```

### Server-Side Errors

```typescript
// API Response
{
  "success": false,
  "message": "Import complete: 1 imported, 1 failed",
  "results": [
    {
      "success": false,
      "workflowName": "Problem Workflow",
      "error": "A workflow with this name already exists"
    }
  ],
  "summary": {
    "total": 2,
    "success": 1,
    "failed": 1,
    "warnings": 0
  }
}
```

## Performance Tips

### Large Exports

- Disable execution history for faster export
- Export in batches (< 100 workflows)
- Use compression for files > 5MB

### Batch Import

- Import in chunks of 50 workflows
- Use `validateOnly` first to catch errors
- Handle partial failures gracefully

## Security Considerations

- ✅ Authentication required for all operations
- ✅ Workspace membership verified
- ✅ Sensitive data excluded from exports
- ⚠️ Never commit exported files with secrets
- ⚠️ Review imported workflows before activation

## File Naming Convention

Exports are automatically named:

- Single workflow: `workflow-{name}-{date}.json`
- Multiple workflows: `workflows-batch-{date}.json`

Example: `workflow-welcome-flow-2025-12-05.json`

## Browser Compatibility

| Feature     | Chrome | Firefox | Safari | Edge |
| ----------- | ------ | ------- | ------ | ---- |
| File Upload | ✅     | ✅      | ✅     | ✅   |
| Drag & Drop | ✅     | ✅      | ✅     | ✅   |
| Download    | ✅     | ✅      | ✅     | ✅   |
| Clipboard   | ✅     | ✅      | ✅     | ✅   |

## Keyboard Shortcuts

| Shortcut     | Action                   |
| ------------ | ------------------------ |
| Click + Hold | Drag file to upload area |
| Ctrl/Cmd + C | Copy JSON to clipboard   |
| Esc          | Close dialog             |
| Enter        | Confirm action           |

## Troubleshooting

### "Invalid JSON file"

- Ensure file is valid JSON
- Check for trailing commas
- Validate with jsonlint.com

### "Validation failed"

- Check error details in dialog
- Verify all required fields present
- Ensure trigger/action types are valid

### "Import stuck"

- Check browser console for errors
- Verify network connection
- Refresh page and retry

### "File too large"

- Disable execution history
- Export in smaller batches
- Compress large files

## Support

For detailed documentation, see:

- [Full Implementation Guide](./workflow-import-export-implementation.md)
- [Workflow Types](../types/workflow.ts)
- [Validation Schema](../lib/validations/workflow.ts)

---

**Version**: 1.0.0 **Last Updated**: December 5, 2025
