# Error Handling Configuration - Quick Start Guide

## 🚀 Quick Import

```tsx
import {
  ErrorHandlingConfig,
  type StepErrorConfig,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '@/components/workflow';
```

## 📦 Basic Setup (30 seconds)

```tsx
function MyComponent() {
  const [config, setConfig] = useState<StepErrorConfig>({
    stepId: 'my-step',
    stepName: 'My Step',
    strategy: 'retry',
    retry: DEFAULT_RETRY_CONFIG,
    fallback: DEFAULT_FALLBACK_CONFIG,
    notification: DEFAULT_NOTIFICATION_CONFIG,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    logErrors: true,
  });

  return <ErrorHandlingConfig config={config} availableSteps={steps} onConfigChange={setConfig} />;
}
```

## 🎯 Common Scenarios

### 1. Critical Operation (Must Succeed)

```tsx
const criticalConfig: StepErrorConfig = {
  stepId: 'payment',
  stepName: 'Process Payment',
  strategy: 'retry',
  retry: {
    enabled: true,
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 60000,
    retryOn: ['network', 'timeout', 'server'],
    timeout: 30000,
  },
  notification: {
    enabled: true,
    channels: ['email', 'slack'],
    priority: 'critical',
    threshold: 1,
    cooldown: 5,
    recipients: ['ops@company.com'],
  },
  logErrors: true,
};
```

### 2. Graceful Degradation

```tsx
const degradableConfig: StepErrorConfig = {
  stepId: 'send-slack',
  stepName: 'Send Slack Message',
  strategy: 'fallback',
  retry: {
    enabled: true,
    maxAttempts: 2,
    backoffStrategy: 'linear',
    initialDelay: 2000,
    maxDelay: 10000,
    retryOn: ['network', 'timeout'],
    timeout: 15000,
  },
  fallback: {
    enabled: true,
    stepId: 'send-email-instead',
  },
  logErrors: true,
};
```

### 3. Non-Critical Operation

```tsx
const nonCriticalConfig: StepErrorConfig = {
  stepId: 'analytics',
  stepName: 'Track Analytics',
  strategy: 'continue',
  notification: {
    enabled: true,
    channels: ['in-app'],
    priority: 'low',
    threshold: 10,
    cooldown: 120,
    recipients: [],
  },
  logErrors: true,
};
```

### 4. Protect External Service

```tsx
const circuitBreakerConfig: StepErrorConfig = {
  stepId: 'external-api',
  stepName: 'Call External API',
  strategy: 'circuit-breaker',
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    initialDelay: 500,
    maxDelay: 30000,
    retryOn: ['network', 'timeout', 'rate-limit'],
    timeout: 20000,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 120000,
    halfOpenRequests: 5,
  },
  notification: {
    enabled: true,
    channels: ['webhook'],
    priority: 'high',
    threshold: 5,
    cooldown: 15,
    recipients: ['https://monitoring.example.com/webhook'],
  },
  logErrors: true,
};
```

## 🔧 DLQ Management

```tsx
function WorkflowWithDLQ() {
  const [config, setConfig] = useState<StepErrorConfig>({...});
  const [dlqEntries, setDLQEntries] = useState<DLQEntry[]>([]);

  // Retry failed execution
  const handleRetry = async (entryId: string, fixedPayload?: unknown) => {
    await fetch(`/api/workflows/dlq/${entryId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ payload: fixedPayload }),
    });
    await loadDLQEntries();
  };

  // Delete failed execution
  const handleDelete = async (entryId: string) => {
    await fetch(`/api/workflows/dlq/${entryId}`, { method: 'DELETE' });
    await loadDLQEntries();
  };

  return (
    <ErrorHandlingConfig
      config={config}
      availableSteps={steps}
      dlqEntries={dlqEntries}
      onConfigChange={setConfig}
      onRetryDLQEntry={handleRetry}
      onDeleteDLQEntry={handleDelete}
    />
  );
}
```

## 📊 Backoff Strategy Cheat Sheet

| Strategy    | Formula           | Example (initial: 1s) |
| ----------- | ----------------- | --------------------- |
| Fixed       | constant          | 1s, 1s, 1s, 1s        |
| Linear      | n × initial       | 1s, 2s, 3s, 4s        |
| Exponential | 2^(n-1) × initial | 1s, 2s, 4s, 8s, 16s   |
| Fibonacci   | fib(n) × initial  | 1s, 1s, 2s, 3s, 5s    |

**Recommendation**: Use **Exponential** for most cases.

## 🎨 Error Type Icons

| Type           | Icon | Use Case               |
| -------------- | ---- | ---------------------- |
| network        | ⚡   | Connection failures    |
| timeout        | 🕐   | Request timeouts       |
| validation     | ⚠️   | Data validation errors |
| authentication | ❌   | Auth/permission errors |
| rate-limit     | ⚠️   | API rate limits        |
| server         | ⚠️   | 5xx errors             |
| client         | ⚠️   | 4xx errors             |
| unknown        | ℹ️   | Uncategorized          |

## 🔔 Notification Priority Guide

| Priority | Use Case                   | Example                    |
| -------- | -------------------------- | -------------------------- |
| Critical | System failures, data loss | Payment processing failure |
| High     | Important but recoverable  | External API down          |
| Medium   | Minor issues, degraded     | Rate limit warnings        |
| Low      | Informational              | Analytics tracking failed  |

## 🛡️ Circuit Breaker Settings

### Conservative (Production)

```tsx
circuitBreaker: {
  enabled: true,
  failureThreshold: 5,    // Open after 5 failures
  successThreshold: 3,    // Close after 3 successes
  timeout: 60000,         // Wait 1 minute
  halfOpenRequests: 3,    // Test with 3 requests
}
```

### Aggressive (Testing)

```tsx
circuitBreaker: {
  enabled: true,
  failureThreshold: 2,
  successThreshold: 1,
  timeout: 10000,
  halfOpenRequests: 1,
}
```

## 📝 Props Reference

```tsx
interface ErrorHandlingConfigProps {
  config: StepErrorConfig;
  availableSteps: Array<{ id: string; name: string }>;
  dlqEntries?: DLQEntry[];
  onConfigChange: (config: StepErrorConfig) => void;
  onRetryDLQEntry?: (entryId: string, fixedPayload?: unknown) => Promise<void>;
  onDeleteDLQEntry?: (entryId: string) => Promise<void>;
  readOnly?: boolean;
}
```

## 🎯 Best Practices

### ✅ DO

- Use exponential backoff for network retries
- Set reasonable max delays (30-60s)
- Configure notifications with cooldowns
- Only retry transient errors
- Use circuit breaker for external services
- Monitor DLQ regularly

### ❌ DON'T

- Retry validation errors
- Set very short cooldown periods
- Retry authentication errors
- Use fixed backoff for network issues
- Ignore DLQ entries
- Set max delay too high (>5 minutes)

## 📖 More Examples

See `error-handling-config-demo.tsx` for comprehensive examples.

## 📚 Full Documentation

See `ERROR_HANDLING_README.md` for complete documentation.

## 🐛 Troubleshooting

### Component not rendering

- Check if all required props are provided
- Verify `availableSteps` is not empty
- Check console for TypeScript errors

### Retry not working

- Verify `retry.enabled` is `true`
- Check `retry.retryOn` includes the error type
- Ensure `maxAttempts` > 1

### Notifications not sending

- Verify `notification.enabled` is `true`
- Check `threshold` is reached
- Verify `cooldown` period has passed
- Check `recipients` array is populated

### DLQ entries not showing

- Verify `dlqEntries` prop is provided
- Check if entries exist for the step
- Ensure entries are properly typed

## 🔗 Related Components

- `WorkflowAnalytics` - Error metrics and trends
- `ExecutionHistory` - Workflow execution logs
- `ScheduleConfig` - Schedule configuration
- `WorkflowPermissions` - Access control

---

**Quick Start**: Copy one of the common scenarios above and customize to your needs!
