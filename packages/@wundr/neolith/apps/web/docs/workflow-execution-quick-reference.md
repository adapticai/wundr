# Workflow Execution API - Quick Reference

## Execute Workflow

```bash
POST /api/workspaces/:slug/workflows/:id/execute
```

```json
{
  "triggerData": { "userId": "user_123" }
}
```

## Get Execution Status

```bash
GET /api/workspaces/:slug/workflows/executions/:executionId
```

Response includes:
- Execution details
- Progress metrics (percentage, step counts)
- Timing information

## Cancel Execution

```bash
POST /api/workspaces/:slug/workflows/executions/:executionId
# or
DELETE /api/workspaces/:slug/workflows/executions/:executionId
```

## Stream Execution Progress (SSE)

```javascript
const eventSource = new EventSource(
  '/api/workspaces/:slug/workflows/executions/:executionId/stream'
);

eventSource.addEventListener('connected', e => console.log('Connected'));
eventSource.addEventListener('step', e => console.log('Step:', JSON.parse(e.data)));
eventSource.addEventListener('progress', e => console.log('Progress:', JSON.parse(e.data)));
eventSource.addEventListener('complete', e => {
  console.log('Complete:', JSON.parse(e.data));
  eventSource.close();
});
```

## List Executions with Statistics

```bash
GET /api/workspaces/:slug/workflows/:id/executions?status=COMPLETED&limit=20
```

Response includes:
- Paginated executions list
- Status breakdown
- Success rate
- Average duration

## Built-in Action Types

### send_notification
```json
{
  "type": "send_notification",
  "config": {
    "message": "Welcome!",
    "recipient": "user_123"
  }
}
```

### create_task
```json
{
  "type": "create_task",
  "config": {
    "title": "Task title",
    "priority": "HIGH",
    "assignedTo": "user_123"
  }
}
```

### call_api
```json
{
  "type": "call_api",
  "config": {
    "url": "https://api.example.com",
    "method": "POST",
    "headers": { "Authorization": "Bearer token" },
    "body": { "data": "value" }
  }
}
```

### wait
```json
{
  "type": "wait",
  "config": { "durationMs": 5000 }
}
```

### condition
```json
{
  "type": "condition",
  "config": {
    "field": "trigger.userType",
    "operator": "equals",
    "value": "premium"
  }
}
```

## Error Handling

```json
{
  "type": "action_type",
  "config": {},
  "onError": "retry",    // "stop" | "continue" | "retry"
  "timeout": 30000       // milliseconds
}
```

- **stop** - Stop execution on error (default)
- **continue** - Continue to next action
- **retry** - Retry up to 3 times with exponential backoff

## Custom Action Handlers

```typescript
import { registerActionHandler } from '@/lib/services/workflow-execution-service';

registerActionHandler('custom_action', async (action, context) => {
  // Your custom logic
  return {
    success: true,
    output: { result: 'data' }
  };
});
```

## Execution Context

Actions receive context with:
- `workspaceId` - Current workspace
- `workflowId` - Current workflow
- `executionId` - Current execution
- `triggerData` - Trigger input data
- `previousStepResults` - Results from previous steps
- `userId` - User who triggered execution

## Progress Metrics

```typescript
{
  totalSteps: 5,
  completedSteps: 3,
  successfulSteps: 2,
  failedSteps: 1,
  runningSteps: 0,
  percentage: 60
}
```

## Execution Statuses

- `PENDING` - Queued for execution
- `RUNNING` - Currently executing
- `COMPLETED` - Finished successfully
- `FAILED` - Finished with errors
- `CANCELLED` - Cancelled by user

## Best Practices

1. Always set reasonable timeouts
2. Choose appropriate error strategies
3. Use streaming for long workflows
4. Review execution history regularly
5. Validate trigger data before execution
6. Cancel unused executions to free resources
