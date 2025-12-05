# Error Handling Configuration Component

## Overview

The `ErrorHandlingConfig` component provides a comprehensive error handling configuration interface for workflow steps, enabling robust error recovery strategies, retry mechanisms, fallback execution, and dead letter queue (DLQ) management.

## Features

### 1. Error Retry Settings
- **Configurable retry attempts** (1-10 attempts)
- **Multiple backoff strategies**:
  - Fixed delay
  - Linear backoff
  - Exponential backoff
  - Fibonacci sequence backoff
- **Per-error-type retry configuration**
- **Timeout settings**
- **Visual retry schedule preview**

### 2. Fallback Step Configuration
- Execute alternative steps on failure
- Conditional fallback execution
- Support for graceful degradation patterns
- Integration with workflow step selection

### 3. Error Notification Rules
- **Multiple notification channels**:
  - Email
  - Slack
  - Webhook
  - SMS
  - In-app notifications
- **Priority levels**: Critical, High, Medium, Low
- **Threshold-based notifications**
- **Cooldown periods** to prevent notification spam
- **Recipient management**

### 4. Dead Letter Queue (DLQ) Viewer
- View failed workflow executions
- Display error details and stack traces
- Manual retry interface
- Bulk operations support
- Payload inspection
- Error categorization

### 5. Circuit Breaker Pattern
- Prevent cascading failures
- Configurable failure/success thresholds
- Half-open state support
- Automatic service protection

### 6. Error Recovery Wizard
- Step-by-step configuration guide
- Pre-configured templates
- Quick setup for common scenarios
- Configuration review and validation

## Installation

The component is part of the workflow components package:

```tsx
import { ErrorHandlingConfig } from '@/components/workflow';
```

## Basic Usage

```tsx
import { ErrorHandlingConfig, type StepErrorConfig } from '@/components/workflow';

function MyWorkflowEditor() {
  const [errorConfig, setErrorConfig] = useState<StepErrorConfig>({
    stepId: 'send-email',
    stepName: 'Send Welcome Email',
    strategy: 'retry',
    retry: DEFAULT_RETRY_CONFIG,
    fallback: DEFAULT_FALLBACK_CONFIG,
    notification: DEFAULT_NOTIFICATION_CONFIG,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    logErrors: true,
  });

  const availableSteps = [
    { id: 'send-email', name: 'Send Welcome Email' },
    { id: 'send-sms', name: 'Send SMS Notification' },
  ];

  return (
    <ErrorHandlingConfig
      config={errorConfig}
      availableSteps={availableSteps}
      onConfigChange={setErrorConfig}
    />
  );
}
```

## Advanced Usage

### With DLQ Management

```tsx
function WorkflowErrorManagement() {
  const [errorConfig, setErrorConfig] = useState<StepErrorConfig>({...});
  const [dlqEntries, setDLQEntries] = useState<DLQEntry[]>([]);

  const handleRetryDLQEntry = async (entryId: string, fixedPayload?: unknown) => {
    const response = await fetch(`/api/workflows/dlq/${entryId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: fixedPayload }),
    });

    if (response.ok) {
      await loadDLQEntries();
    }
  };

  const handleDeleteDLQEntry = async (entryId: string) => {
    await fetch(`/api/workflows/dlq/${entryId}`, { method: 'DELETE' });
    await loadDLQEntries();
  };

  return (
    <ErrorHandlingConfig
      config={errorConfig}
      availableSteps={steps}
      dlqEntries={dlqEntries}
      onConfigChange={setErrorConfig}
      onRetryDLQEntry={handleRetryDLQEntry}
      onDeleteDLQEntry={handleDeleteDLQEntry}
    />
  );
}
```

### Read-Only Mode

```tsx
<ErrorHandlingConfig
  config={errorConfig}
  availableSteps={steps}
  onConfigChange={() => {}}
  readOnly={true}
/>
```

## Error Handling Strategies

### 1. Stop Workflow
Immediately stops workflow execution on error. Best for critical operations where proceeding would be unsafe.

```tsx
const config: StepErrorConfig = {
  strategy: 'stop',
  logErrors: true,
  // ... other config
};
```

### 2. Continue Workflow
Logs the error and continues to the next step. Ideal for non-critical operations.

```tsx
const config: StepErrorConfig = {
  strategy: 'continue',
  logErrors: true,
  notification: {
    enabled: true,
    threshold: 10,
    // ... notification config
  },
};
```

### 3. Retry Step
Automatically retries the failed step with configurable backoff.

```tsx
const config: StepErrorConfig = {
  strategy: 'retry',
  retry: {
    enabled: true,
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 60000,
    retryOn: ['network', 'timeout', 'rate-limit'],
    timeout: 30000,
  },
};
```

### 4. Execute Fallback
Executes an alternative step when the primary step fails.

```tsx
const config: StepErrorConfig = {
  strategy: 'fallback',
  fallback: {
    enabled: true,
    stepId: 'send-sms-fallback',
    condition: "error.type === 'network' && error.retries >= 2",
  },
};
```

### 5. Circuit Breaker
Temporarily disables the step after repeated failures to prevent cascading issues.

```tsx
const config: StepErrorConfig = {
  strategy: 'circuit-breaker',
  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 120000,
    halfOpenRequests: 5,
  },
};
```

## Backoff Strategies

### Fixed Delay
Same delay between all retry attempts.

```tsx
backoffStrategy: 'fixed'
// Delays: 1s, 1s, 1s, 1s
```

### Linear Backoff
Delay increases linearly with attempt number.

```tsx
backoffStrategy: 'linear'
// Delays: 1s, 2s, 3s, 4s
```

### Exponential Backoff
Delay doubles with each attempt (recommended for most use cases).

```tsx
backoffStrategy: 'exponential'
// Delays: 1s, 2s, 4s, 8s, 16s
```

### Fibonacci Backoff
Delay follows Fibonacci sequence.

```tsx
backoffStrategy: 'fibonacci'
// Delays: 1s, 1s, 2s, 3s, 5s, 8s
```

## Error Types

The component supports categorizing and handling different error types:

- `network` - Network connectivity errors
- `timeout` - Request timeout errors
- `validation` - Data validation errors
- `authentication` - Authentication/permission errors
- `rate-limit` - API rate limiting errors
- `server` - Server-side errors (5xx)
- `client` - Client-side errors (4xx)
- `unknown` - Uncategorized errors

## API Reference

### Props

#### `ErrorHandlingConfigProps`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `StepErrorConfig` | Yes | Current error handling configuration |
| `availableSteps` | `Array<{id: string, name: string}>` | Yes | List of available steps for fallback |
| `dlqEntries` | `DLQEntry[]` | No | Dead letter queue entries to display |
| `onConfigChange` | `(config: StepErrorConfig) => void` | Yes | Callback when configuration changes |
| `onRetryDLQEntry` | `(entryId: string, fixedPayload?: unknown) => Promise<void>` | No | Callback to retry a DLQ entry |
| `onDeleteDLQEntry` | `(entryId: string) => Promise<void>` | No | Callback to delete a DLQ entry |
| `readOnly` | `boolean` | No | Whether the component is in read-only mode |

### Types

#### `StepErrorConfig`

```typescript
interface StepErrorConfig {
  stepId: string;
  stepName: string;
  strategy: ErrorStrategy;
  retry: RetryConfig;
  fallback: FallbackConfig;
  notification: NotificationConfig;
  circuitBreaker: CircuitBreakerConfig;
  logErrors: boolean;
  customHandlerCode?: string;
}
```

#### `RetryConfig`

```typescript
interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  initialDelay: number;
  maxDelay: number;
  retryOn: ErrorType[];
  timeout: number;
}
```

#### `DLQEntry`

```typescript
interface DLQEntry {
  id: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  errorType: ErrorType;
  errorMessage: string;
  timestamp: string;
  attemptCount: number;
  payload: unknown;
  stack?: string;
}
```

## Best Practices

### 1. Choose Appropriate Strategy

- **Critical Operations** (payments, data mutations): Use `stop` or `retry` with aggressive settings
- **External API Calls**: Use `retry` with exponential backoff
- **Non-Critical Operations** (analytics, logging): Use `continue`
- **Degradable Features**: Use `fallback` with alternative implementations
- **Unreliable Services**: Use `circuit-breaker` to protect your system

### 2. Configure Retry Settings

- Start with 3-5 retry attempts
- Use exponential backoff for most scenarios
- Set reasonable max delays (30-60 seconds)
- Only retry on transient errors (network, timeout, rate-limit)

### 3. Set Up Notifications

- Use appropriate priority levels
- Set reasonable thresholds to avoid alert fatigue
- Configure cooldown periods
- Test notification channels

### 4. Monitor DLQ

- Regularly review failed executions
- Investigate patterns in errors
- Clean up old entries periodically
- Use manual retry for one-off fixes

### 5. Circuit Breaker Tuning

- Set failure threshold based on traffic volume
- Configure appropriate timeout for recovery
- Monitor circuit state changes
- Implement fallback behavior for open circuits

## Examples

See `error-handling-config-demo.tsx` for comprehensive examples of all features and strategies.

## Styling

The component uses Tailwind CSS and shadcn/ui components. It automatically adapts to light and dark themes.

## Accessibility

- Full keyboard navigation support
- ARIA labels on all interactive elements
- Screen reader friendly
- Focus management in dialogs

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Related Components

- `WorkflowAnalytics` - View error metrics and trends
- `ExecutionHistory` - View workflow execution history
- `ScheduleConfig` - Configure workflow scheduling
- `WorkflowPermissions` - Manage workflow access control

## Support

For issues or questions, please refer to the main workflow components documentation or contact the development team.
