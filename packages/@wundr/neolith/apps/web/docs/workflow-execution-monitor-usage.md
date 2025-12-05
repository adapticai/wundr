# Workflow Execution Monitor Usage Guide

## Overview

The Workflow Execution Monitor provides real-time monitoring and management of workflow executions
with automatic updates, step-by-step progress tracking, and interactive error handling.

## Features

- **Real-time Updates**: Automatic polling or Server-Sent Events (SSE) for live execution tracking
- **Progress Visualization**: Visual progress bars and timeline showing execution flow
- **Step Status**: Detailed status for each action in the workflow
- **Error Management**: Highlighted errors with detailed messages and retry capabilities
- **Action Controls**: Cancel running executions or retry failed steps
- **Performance Metrics**: Duration tracking and estimated time remaining

## Components

### ExecutionMonitor

Main component for displaying and managing workflow execution.

```tsx
import { ExecutionMonitor } from '@/components/workflows';

function WorkflowExecutionPage({ workspaceId, workflowId, executionId }) {
  return (
    <ExecutionMonitor
      workspaceId={workspaceId}
      workflowId={workflowId}
      executionId={executionId}
      enablePolling={true}
      onComplete={execution => {
        console.log('Execution completed:', execution);
      }}
    />
  );
}
```

### useWorkflowExecution Hook

Hook for programmatic access to execution state and controls.

```tsx
import { useWorkflowExecution } from '@/hooks';

function CustomExecutionMonitor({ workspaceId, workflowId, executionId }) {
  const {
    execution,
    isLoading,
    progress,
    isRunning,
    canCancel,
    cancelExecution,
    retryStep,
    refreshExecution,
  } = useWorkflowExecution(workspaceId, workflowId, executionId, {
    enablePolling: true,
    pollingInterval: 2000,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Execution Status: {execution?.status}</h2>
      {progress && (
        <div>
          Progress: {progress.completedSteps}/{progress.totalSteps} steps ({progress.percentage}%)
        </div>
      )}
      {canCancel && <button onClick={cancelExecution}>Cancel Execution</button>}
    </div>
  );
}
```

## Props Reference

### ExecutionMonitor Props

| Prop            | Type     | Required | Description                                |
| --------------- | -------- | -------- | ------------------------------------------ |
| `workspaceId`   | string   | Yes      | Workspace containing the workflow          |
| `workflowId`    | string   | Yes      | Workflow being executed                    |
| `executionId`   | string   | Yes      | Specific execution to monitor              |
| `enablePolling` | boolean  | No       | Enable automatic polling (default: true)   |
| `enableSSE`     | boolean  | No       | Enable Server-Sent Events (default: false) |
| `onComplete`    | function | No       | Callback when execution completes          |
| `onCancel`      | function | No       | Callback when execution is cancelled       |
| `className`     | string   | No       | Additional CSS classes                     |

### useWorkflowExecution Options

| Option                  | Type    | Default | Description                                     |
| ----------------------- | ------- | ------- | ----------------------------------------------- |
| `enablePolling`         | boolean | true    | Enable real-time polling for running executions |
| `pollingInterval`       | number  | 2000    | Polling interval in milliseconds                |
| `enableSSE`             | boolean | false   | Enable Server-Sent Events for real-time updates |
| `autoRefreshOnComplete` | boolean | true    | Auto-refresh when execution completes           |

### useWorkflowExecution Return Values

| Value              | Type                                       | Description                            |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| `execution`        | WorkflowExecution \| null                  | Current execution data                 |
| `isLoading`        | boolean                                    | Whether data is loading                |
| `error`            | Error \| null                              | Any error that occurred                |
| `progress`         | ExecutionProgress \| null                  | Progress information                   |
| `isRunning`        | boolean                                    | Whether execution is currently running |
| `canCancel`        | boolean                                    | Whether execution can be cancelled     |
| `canRetry`         | boolean                                    | Whether execution can be retried       |
| `cancelExecution`  | () => Promise<boolean>                     | Cancel the running execution           |
| `retryStep`        | (actionId: string) => Promise<boolean>     | Retry a specific failed step           |
| `retryExecution`   | () => Promise<WorkflowExecution \| null>   | Retry entire execution                 |
| `refreshExecution` | () => void                                 | Manually refresh execution data        |
| `getActionResult`  | (actionId: string) => ActionResult \| null | Get result for specific action         |

## Usage Examples

### Basic Usage

```tsx
import { ExecutionMonitor } from '@/components/workflows';

export default function ExecutionPage({ params }) {
  return (
    <div className='p-6'>
      <h1>Workflow Execution</h1>
      <ExecutionMonitor
        workspaceId={params.workspaceId}
        workflowId={params.workflowId}
        executionId={params.executionId}
      />
    </div>
  );
}
```

### With Server-Sent Events

```tsx
<ExecutionMonitor
  workspaceId={workspaceId}
  workflowId={workflowId}
  executionId={executionId}
  enableSSE={true}
  enablePolling={false}
  onComplete={execution => {
    toast.success('Workflow completed successfully!');
  }}
/>
```

### Custom Progress Display

```tsx
import { useWorkflowExecution } from '@/hooks';
import { Progress } from '@/components/ui/progress';

function CustomProgressMonitor({ workspaceId, workflowId, executionId }) {
  const { execution, progress, isRunning } = useWorkflowExecution(
    workspaceId,
    workflowId,
    executionId
  );

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <span>
          {progress?.completedSteps} / {progress?.totalSteps} steps
        </span>
        <span>{progress?.percentage}%</span>
      </div>
      <Progress value={progress?.percentage} />
      {isRunning && progress?.estimatedTimeRemaining && (
        <p className='text-sm text-muted-foreground'>
          Estimated time remaining: {formatDuration(progress.estimatedTimeRemaining)}
        </p>
      )}
    </div>
  );
}
```

### Error Handling and Retry

```tsx
import { useWorkflowExecution } from '@/hooks';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

function ExecutionWithErrorHandling({ workspaceId, workflowId, executionId }) {
  const { execution, error, canRetry, retryExecution, retryStep } = useWorkflowExecution(
    workspaceId,
    workflowId,
    executionId
  );

  const failedSteps = execution?.actionResults.filter(result => result.status === 'failed');

  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='space-y-4'>
      {execution?.error && (
        <Alert variant='destructive'>
          <AlertDescription>{execution.error}</AlertDescription>
        </Alert>
      )}

      {failedSteps && failedSteps.length > 0 && (
        <div className='space-y-2'>
          <h3>Failed Steps</h3>
          {failedSteps.map(step => (
            <div key={step.actionId} className='flex items-center justify-between'>
              <span>{step.error}</span>
              <Button size='sm' variant='outline' onClick={() => retryStep(step.actionId)}>
                Retry Step
              </Button>
            </div>
          ))}
        </div>
      )}

      {canRetry && <Button onClick={retryExecution}>Retry Entire Execution</Button>}
    </div>
  );
}
```

### Monitoring Multiple Executions

```tsx
import { useWorkflowExecutions } from '@/hooks';
import { ExecutionMonitor } from '@/components/workflows';

function MultipleExecutionsMonitor({ workspaceId, workflowId }) {
  const { executions, isLoading } = useWorkflowExecutions(workspaceId, workflowId, { limit: 5 });

  const runningExecutions = executions.filter(e => e.status === 'running');

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className='space-y-6'>
      <h2>Running Executions ({runningExecutions.length})</h2>
      {runningExecutions.map(execution => (
        <ExecutionMonitor
          key={execution.id}
          workspaceId={workspaceId}
          workflowId={workflowId}
          executionId={execution.id}
          enablePolling={true}
        />
      ))}
    </div>
  );
}
```

### Integration with Notifications

```tsx
import { useWorkflowExecution } from '@/hooks';
import { useEffect } from 'react';
import { toast } from 'sonner';

function ExecutionWithNotifications({ workspaceId, workflowId, executionId }) {
  const { execution, progress } = useWorkflowExecution(workspaceId, workflowId, executionId);

  useEffect(() => {
    if (execution?.status === 'completed') {
      toast.success('Workflow completed successfully!', {
        description: `Completed ${progress?.totalSteps} steps`,
      });
    } else if (execution?.status === 'failed') {
      toast.error('Workflow execution failed', {
        description: execution.error,
      });
    }
  }, [execution?.status, execution?.error, progress?.totalSteps]);

  return (
    <ExecutionMonitor workspaceId={workspaceId} workflowId={workflowId} executionId={executionId} />
  );
}
```

## API Endpoints Required

The execution monitor expects the following API endpoints:

### GET `/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/[executionId]`

Returns execution details:

```json
{
  "execution": {
    "id": "exec_123",
    "workflowId": "wf_456",
    "status": "running",
    "startedAt": "2024-01-01T10:00:00Z",
    "actionResults": [
      {
        "actionId": "action_1",
        "actionType": "send_message",
        "status": "completed",
        "duration": 1500
      }
    ]
  }
}
```

### GET `/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/[executionId]/stream` (SSE)

Server-Sent Events endpoint for real-time updates.

### POST `/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/[executionId]/cancel`

Cancels a running execution.

### POST `/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/[executionId]/retry`

Retries a failed execution.

### POST `/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/[executionId]/retry-step`

Retries a specific failed step:

```json
{
  "actionId": "action_1"
}
```

## Best Practices

1. **Use Polling for Short Executions**: For workflows that complete quickly (< 1 minute), polling
   is sufficient
2. **Use SSE for Long Executions**: For long-running workflows, SSE provides better performance
3. **Handle Errors Gracefully**: Always display error messages and provide retry options
4. **Show Progress**: Keep users informed with progress bars and estimated completion times
5. **Enable Cancellation**: Allow users to cancel long-running executions
6. **Cache Execution Data**: Use the execution data in multiple components without re-fetching
7. **Monitor Performance**: Track execution duration and identify bottlenecks

## Accessibility

The execution monitor components follow WCAG 2.1 AA guidelines:

- Proper ARIA labels for status indicators
- Keyboard navigation support
- Screen reader announcements for status changes
- High contrast color schemes
- Focus management

## Troubleshooting

### Execution not updating in real-time

- Verify `enablePolling` is set to `true`
- Check that the API endpoint returns fresh data
- Ensure polling interval is appropriate for your use case

### SSE connection drops

- Implement reconnection logic in your SSE endpoint
- Fall back to polling if SSE fails
- Check for proxy/firewall issues

### Memory leaks with multiple monitors

- Ensure components are properly unmounted
- Clean up polling intervals in `useEffect` cleanup
- Use `React.memo` for execution list items

## Performance Considerations

- **Polling Interval**: Balance between responsiveness and server load (default 2000ms)
- **Batch Updates**: Group multiple step updates in single API response
- **Virtualization**: Use virtual scrolling for workflows with many steps
- **Debouncing**: Debounce manual refresh requests
- **Caching**: Cache completed executions to reduce API calls
