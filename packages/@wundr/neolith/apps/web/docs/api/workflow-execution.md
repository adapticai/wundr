# Workflow Execution API

Comprehensive API for executing workflows and monitoring execution progress in real-time.

## Overview

The Workflow Execution API provides endpoints for:
- **Executing workflows** manually or via triggers
- **Monitoring execution progress** in real-time
- **Viewing execution history** with detailed logs
- **Cancelling running executions**
- **Streaming execution updates** via Server-Sent Events

## Endpoints

### Execute Workflow

Execute a workflow manually with optional trigger data.

```http
POST /api/workspaces/:workspaceSlug/workflows/:workflowId/execute
```

**Request Body:**

```json
{
  "triggerData": {
    "userId": "user_123",
    "action": "signup",
    "metadata": {
      "source": "web"
    }
  },
  "variables": {
    "customVar": "value"
  },
  "dryRun": false
}
```

**Response:**

```json
{
  "execution": {
    "id": "exec_abc123",
    "workflowId": "wf_def456",
    "workspaceId": "ws_ghi789",
    "status": "COMPLETED",
    "triggeredBy": "user_xyz",
    "triggerType": "manual",
    "triggerData": { ... },
    "steps": [
      {
        "actionId": "action-1",
        "actionType": "send_notification",
        "status": "success",
        "output": {
          "notificationSent": true,
          "message": "Welcome!",
          "recipient": "user_123"
        },
        "startedAt": "2024-12-05T10:00:00Z",
        "completedAt": "2024-12-05T10:00:01Z",
        "durationMs": 1000
      },
      {
        "actionId": "action-2",
        "actionType": "create_task",
        "status": "success",
        "output": {
          "taskId": "task_123",
          "title": "Onboarding checklist",
          "status": "TODO"
        },
        "startedAt": "2024-12-05T10:00:01Z",
        "completedAt": "2024-12-05T10:00:02Z",
        "durationMs": 1000
      }
    ],
    "startedAt": "2024-12-05T10:00:00Z",
    "completedAt": "2024-12-05T10:00:02Z",
    "durationMs": 2000,
    "isSimulation": false
  }
}
```

### Get Execution Status

Get the current status and progress of a workflow execution.

```http
GET /api/workspaces/:workspaceSlug/workflows/executions/:executionId
```

**Response:**

```json
{
  "execution": {
    "id": "exec_abc123",
    "workflowId": "wf_def456",
    "status": "RUNNING",
    "steps": [...],
    "startedAt": "2024-12-05T10:00:00Z",
    "workflow": {
      "id": "wf_def456",
      "name": "User Onboarding",
      "description": "Automated onboarding workflow",
      "trigger": {...},
      "status": "ACTIVE"
    }
  },
  "progress": {
    "totalSteps": 5,
    "completedSteps": 2,
    "successfulSteps": 2,
    "failedSteps": 0,
    "runningSteps": 1,
    "percentage": 40
  },
  "timing": {
    "startedAt": "2024-12-05T10:00:00Z",
    "completedAt": null,
    "durationMs": 3500,
    "isRunning": true
  }
}
```

### Cancel Execution

Cancel a running workflow execution.

```http
POST /api/workspaces/:workspaceSlug/workflows/executions/:executionId
DELETE /api/workspaces/:workspaceSlug/workflows/executions/:executionId
```

**Response:**

```json
{
  "success": true,
  "execution": {
    "id": "exec_abc123",
    "status": "CANCELLED",
    "error": "Cancelled by user",
    "completedAt": "2024-12-05T10:00:05Z"
  },
  "message": "Execution cancelled successfully"
}
```

### Stream Execution Progress

Stream real-time execution updates via Server-Sent Events.

```http
GET /api/workspaces/:workspaceSlug/workflows/executions/:executionId/stream
```

**Response:** Server-Sent Events stream

```javascript
// Client-side usage
const eventSource = new EventSource(
  '/api/workspaces/ws_123/workflows/executions/exec_456/stream'
);

// Connection established
eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected:', data.executionId);
});

// Step completed
eventSource.addEventListener('step', (event) => {
  const step = JSON.parse(event.data);
  console.log(`Step ${step.actionType}: ${step.status}`);
  console.log('Output:', step.output);
});

// Progress update
eventSource.addEventListener('progress', (event) => {
  const progress = JSON.parse(event.data);
  console.log(`Progress: ${progress.percentage}%`);
  console.log(`Completed: ${progress.completedSteps}/${progress.totalSteps}`);
});

// Execution complete
eventSource.addEventListener('complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Execution complete:', data.status);
  console.log('Duration:', data.durationMs, 'ms');
  eventSource.close();
});

// Error
eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Error:', data.message);
  eventSource.close();
});
```

**Event Types:**

1. **connected** - Initial connection established
   ```json
   {
     "executionId": "exec_123",
     "timestamp": "2024-12-05T10:00:00Z"
   }
   ```

2. **step** - Step completed
   ```json
   {
     "actionId": "action-1",
     "actionType": "send_notification",
     "status": "success",
     "output": {...},
     "durationMs": 1000
   }
   ```

3. **progress** - Progress update
   ```json
   {
     "totalSteps": 5,
     "completedSteps": 2,
     "successfulSteps": 2,
     "failedSteps": 0,
     "percentage": 40,
     "status": "RUNNING"
   }
   ```

4. **complete** - Execution finished
   ```json
   {
     "status": "COMPLETED",
     "durationMs": 5000,
     "completedAt": "2024-12-05T10:00:05Z"
   }
   ```

5. **error** - Error occurred
   ```json
   {
     "message": "Execution failed: timeout"
   }
   ```

### List Executions

List execution history for a workflow with filtering and statistics.

```http
GET /api/workspaces/:workspaceSlug/workflows/:workflowId/executions
```

**Query Parameters:**

- `status` - Filter by status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- `from` - Filter by start date (ISO 8601)
- `to` - Filter by end date (ISO 8601)
- `offset` - Pagination offset (default: 0)
- `limit` - Results per page (default: 20, max: 100)

**Response:**

```json
{
  "executions": [
    {
      "id": "exec_123",
      "workflowId": "wf_456",
      "status": "COMPLETED",
      "startedAt": "2024-12-05T10:00:00Z",
      "completedAt": "2024-12-05T10:00:05Z",
      "durationMs": 5000,
      "workflow": {
        "id": "wf_456",
        "name": "User Onboarding"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "offset": 0,
    "limit": 20,
    "hasMore": true
  },
  "statistics": {
    "total": 150,
    "byStatus": {
      "COMPLETED": 120,
      "FAILED": 25,
      "CANCELLED": 5
    },
    "successRate": 80,
    "averageDurationMs": 4500
  }
}
```

### Get Execution History

Get detailed execution history with step-by-step logs.

```http
GET /api/workspaces/:workspaceSlug/workflows/:workflowId/history
```

**Query Parameters:**

- `executionId` - Get specific execution by ID
- `status` - Filter by status
- `from` - Start date filter
- `to` - End date filter
- `limit` - Results per page
- `offset` - Pagination offset

**Response (List):**

```json
{
  "executions": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Response (Single Execution):**

```json
{
  "execution": {
    "id": "exec_123",
    "workflowId": "wf_456",
    "status": "COMPLETED",
    "steps": [
      {
        "actionId": "action-1",
        "actionType": "send_notification",
        "status": "success",
        "output": {...},
        "startedAt": "2024-12-05T10:00:00Z",
        "completedAt": "2024-12-05T10:00:01Z",
        "durationMs": 1000
      }
    ],
    "executionSummary": {
      "totalSteps": 5,
      "successfulSteps": 4,
      "failedSteps": 1,
      "skippedSteps": 0
    },
    "workflow": {
      "id": "wf_456",
      "name": "User Onboarding",
      "description": "Automated onboarding"
    }
  }
}
```

## Action Types

### Built-in Actions

#### 1. send_notification

Send a notification to a user.

```json
{
  "type": "send_notification",
  "config": {
    "message": "Welcome to the platform!",
    "recipient": "user_123"
  }
}
```

#### 2. create_task

Create a task in the workspace.

```json
{
  "type": "create_task",
  "config": {
    "title": "Complete onboarding",
    "description": "Fill out your profile",
    "priority": "HIGH",
    "assignedTo": "user_123"
  }
}
```

#### 3. call_api

Call an external API.

```json
{
  "type": "call_api",
  "config": {
    "url": "https://api.example.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token"
    },
    "body": {
      "event": "user_signup",
      "data": {...}
    }
  }
}
```

#### 4. wait

Wait for a specified duration.

```json
{
  "type": "wait",
  "config": {
    "durationMs": 5000
  }
}
```

#### 5. condition

Evaluate a condition.

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

**Operators:**
- `equals`, `not_equals`
- `greater_than`, `less_than`
- `contains`, `not_contains`
- `exists`, `not_exists`

## Error Handling

### Action Error Strategies

Each action can specify how to handle errors:

```json
{
  "type": "call_api",
  "config": {...},
  "onError": "retry",  // "stop" | "continue" | "retry"
  "timeout": 30000     // Timeout in milliseconds
}
```

- **stop** - Stop workflow execution (default)
- **continue** - Continue to next action
- **retry** - Retry up to 3 times with exponential backoff

### Common Error Codes

- `WORKFLOW_INVALID` - Workflow validation failed
- `WORKFLOW_NOT_FOUND` - Workflow doesn't exist
- `WORKFLOW_INACTIVE` - Workflow is not active
- `EXECUTION_NOT_FOUND` - Execution doesn't exist
- `EXECUTION_FAILED` - Execution failed
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Request validation failed

## Custom Action Handlers

Register custom action handlers in your application:

```typescript
import { registerActionHandler } from '@/lib/services/workflow-execution-service';

registerActionHandler('send_email', async (action, context) => {
  const { config } = action;

  // Validate config
  if (!config.to || !config.subject) {
    return {
      success: false,
      error: 'Email requires to and subject'
    };
  }

  // Execute action
  try {
    await emailService.send({
      to: config.to,
      subject: config.subject,
      body: config.body,
    });

    return {
      success: true,
      output: {
        emailSent: true,
        recipient: config.to,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});
```

## Best Practices

1. **Use Timeouts** - Always set reasonable timeouts for actions
2. **Handle Failures** - Choose appropriate error strategies
3. **Monitor Progress** - Use streaming for long-running workflows
4. **Log Everything** - Step results include detailed output
5. **Validate Input** - Check trigger data before execution
6. **Cancel When Needed** - Clean up resources by cancelling
7. **Review History** - Analyze execution patterns and failures

## Examples

### Execute with Progress Monitoring

```typescript
// Start execution
const { execution } = await fetch('/api/workspaces/ws_123/workflows/wf_456/execute', {
  method: 'POST',
  body: JSON.stringify({
    triggerData: { userId: 'user_789' }
  })
}).then(r => r.json());

// Stream progress
const eventSource = new EventSource(
  `/api/workspaces/ws_123/workflows/executions/${execution.id}/stream`
);

eventSource.addEventListener('progress', (event) => {
  const { percentage } = JSON.parse(event.data);
  updateProgressBar(percentage);
});

eventSource.addEventListener('complete', (event) => {
  const { status } = JSON.parse(event.data);
  showNotification(`Workflow ${status.toLowerCase()}`);
  eventSource.close();
});
```

### Cancel Long-Running Execution

```typescript
const executionId = 'exec_123';

// Cancel
await fetch(`/api/workspaces/ws_123/workflows/executions/${executionId}`, {
  method: 'POST' // or DELETE
});

// Verify cancellation
const { execution } = await fetch(
  `/api/workspaces/ws_123/workflows/executions/${executionId}`
).then(r => r.json());

console.log(execution.status); // "CANCELLED"
```

### Analyze Execution Statistics

```typescript
const { statistics } = await fetch(
  '/api/workspaces/ws_123/workflows/wf_456/executions'
).then(r => r.json());

console.log(`Success Rate: ${statistics.successRate}%`);
console.log(`Average Duration: ${statistics.averageDurationMs}ms`);
console.log('Status Breakdown:', statistics.byStatus);
```
