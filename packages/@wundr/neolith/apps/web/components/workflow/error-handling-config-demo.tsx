'use client';

/**
 * Error Handling Configuration Demo
 *
 * Example implementation showing how to use the ErrorHandlingConfig component
 * with realistic workflow scenarios and error handling strategies.
 */

import React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  ErrorHandlingConfig,
  type StepErrorConfig,
  type DLQEntry,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './error-handling-config';

// ============================================================================
// Demo Data
// ============================================================================

const availableSteps = [
  { id: 'step-1', name: 'Send Welcome Email' },
  { id: 'step-2', name: 'Create User Profile' },
  { id: 'step-3', name: 'Assign Default Role' },
  { id: 'step-4', name: 'Send Slack Notification' },
  { id: 'step-5', name: 'Update Analytics' },
  { id: 'step-6', name: 'Send Fallback Email' },
];

const mockDLQEntries: DLQEntry[] = [
  {
    id: 'dlq-1',
    workflowId: 'workflow-123',
    stepId: 'step-1',
    stepName: 'Send Welcome Email',
    errorType: 'network',
    errorMessage: 'SMTP server connection timeout',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    attemptCount: 3,
    payload: {
      to: 'user@example.com',
      subject: 'Welcome to our platform',
      template: 'welcome-email',
    },
    stack: `Error: SMTP connection timeout
    at SMTPClient.connect (smtp.ts:45)
    at EmailService.send (email.ts:123)
    at WorkflowEngine.executeStep (engine.ts:234)`,
  },
  {
    id: 'dlq-2',
    workflowId: 'workflow-123',
    stepId: 'step-4',
    stepName: 'Send Slack Notification',
    errorType: 'rate-limit',
    errorMessage: 'Slack API rate limit exceeded',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    attemptCount: 5,
    payload: {
      channel: '#notifications',
      message: 'New user signup',
      user: 'john@example.com',
    },
  },
  {
    id: 'dlq-3',
    workflowId: 'workflow-123',
    stepId: 'step-2',
    stepName: 'Create User Profile',
    errorType: 'validation',
    errorMessage: 'Invalid email format provided',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    attemptCount: 1,
    payload: {
      email: 'invalid-email',
      name: 'John Doe',
      plan: 'premium',
    },
  },
];

// ============================================================================
// Example Configurations
// ============================================================================

const aggressiveRetryConfig: StepErrorConfig = {
  stepId: 'step-1',
  stepName: 'Send Welcome Email',
  strategy: 'retry',
  retry: {
    enabled: true,
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 60000,
    retryOn: ['network', 'timeout', 'rate-limit', 'server'],
    timeout: 30000,
  },
  fallback: DEFAULT_FALLBACK_CONFIG,
  notification: {
    enabled: true,
    channels: ['email', 'slack'],
    priority: 'high',
    threshold: 3,
    cooldown: 30,
    recipients: ['admin@example.com', 'https://hooks.slack.com/services/...'],
  },
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  logErrors: true,
};

const fallbackConfig: StepErrorConfig = {
  stepId: 'step-4',
  stepName: 'Send Slack Notification',
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
    stepId: 'step-6',
    condition: "error.type === 'rate-limit' || error.attemptCount >= 2",
  },
  notification: {
    enabled: true,
    channels: ['in-app'],
    priority: 'medium',
    threshold: 1,
    cooldown: 60,
    recipients: [],
  },
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  logErrors: true,
};

const circuitBreakerConfig: StepErrorConfig = {
  stepId: 'step-5',
  stepName: 'Update Analytics',
  strategy: 'circuit-breaker',
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffStrategy: 'fibonacci',
    initialDelay: 500,
    maxDelay: 30000,
    retryOn: ['network', 'timeout', 'server'],
    timeout: 20000,
  },
  fallback: DEFAULT_FALLBACK_CONFIG,
  notification: {
    enabled: true,
    channels: ['email', 'webhook'],
    priority: 'critical',
    threshold: 5,
    cooldown: 15,
    recipients: ['ops@example.com', 'https://monitoring.example.com/webhook'],
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 120000,
    halfOpenRequests: 5,
  },
  logErrors: true,
};

const continueOnErrorConfig: StepErrorConfig = {
  stepId: 'step-3',
  stepName: 'Assign Default Role',
  strategy: 'continue',
  retry: DEFAULT_RETRY_CONFIG,
  fallback: DEFAULT_FALLBACK_CONFIG,
  notification: {
    enabled: true,
    channels: ['in-app'],
    priority: 'low',
    threshold: 10,
    cooldown: 120,
    recipients: [],
  },
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  logErrors: true,
};

// ============================================================================
// Main Demo Component
// ============================================================================

export function ErrorHandlingConfigDemo() {
  const [config1, setConfig1] = React.useState<StepErrorConfig>(aggressiveRetryConfig);
  const [config2, setConfig2] = React.useState<StepErrorConfig>(fallbackConfig);
  const [config3, setConfig3] = React.useState<StepErrorConfig>(circuitBreakerConfig);
  const [config4, setConfig4] = React.useState<StepErrorConfig>(continueOnErrorConfig);

  const handleRetryDLQEntry = async (entryId: string, fixedPayload?: unknown) => {
    console.log('Retrying DLQ entry:', entryId, fixedPayload);
    // Simulate retry operation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    alert(`Successfully retried entry: ${entryId}`);
  };

  const handleDeleteDLQEntry = async (entryId: string) => {
    console.log('Deleting DLQ entry:', entryId);
    // Simulate delete operation
    await new Promise((resolve) => setTimeout(resolve, 500));
    alert(`Deleted entry: ${entryId}`);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Error Handling Configuration</h1>
        <p className="text-muted-foreground">
          Explore different error handling strategies for workflow steps
        </p>
      </div>

      <Tabs defaultValue="aggressive-retry" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="aggressive-retry">Aggressive Retry</TabsTrigger>
          <TabsTrigger value="fallback">Fallback Strategy</TabsTrigger>
          <TabsTrigger value="circuit-breaker">Circuit Breaker</TabsTrigger>
          <TabsTrigger value="continue">Continue on Error</TabsTrigger>
        </TabsList>

        {/* Aggressive Retry Example */}
        <TabsContent value="aggressive-retry">
          <Card>
            <CardHeader>
              <CardTitle>Aggressive Retry Strategy</CardTitle>
              <CardDescription>
                Best for critical operations that must succeed (e.g., payment processing, email sending).
                Uses exponential backoff with up to 5 retry attempts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorHandlingConfig
                config={config1}
                availableSteps={availableSteps}
                dlqEntries={mockDLQEntries.filter((e) => e.stepId === 'step-1')}
                onConfigChange={setConfig1}
                onRetryDLQEntry={handleRetryDLQEntry}
                onDeleteDLQEntry={handleDeleteDLQEntry}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fallback Strategy Example */}
        <TabsContent value="fallback">
          <Card>
            <CardHeader>
              <CardTitle>Fallback Strategy</CardTitle>
              <CardDescription>
                Execute alternative steps when primary step fails. Useful for graceful degradation
                (e.g., send email if Slack fails).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorHandlingConfig
                config={config2}
                availableSteps={availableSteps}
                dlqEntries={mockDLQEntries.filter((e) => e.stepId === 'step-4')}
                onConfigChange={setConfig2}
                onRetryDLQEntry={handleRetryDLQEntry}
                onDeleteDLQEntry={handleDeleteDLQEntry}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Circuit Breaker Example */}
        <TabsContent value="circuit-breaker">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Pattern</CardTitle>
              <CardDescription>
                Prevent cascading failures by temporarily disabling failing steps. Ideal for
                protecting external services and preventing resource exhaustion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorHandlingConfig
                config={config3}
                availableSteps={availableSteps}
                dlqEntries={[]}
                onConfigChange={setConfig3}
                onRetryDLQEntry={handleRetryDLQEntry}
                onDeleteDLQEntry={handleDeleteDLQEntry}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Continue on Error Example */}
        <TabsContent value="continue">
          <Card>
            <CardHeader>
              <CardTitle>Continue on Error</CardTitle>
              <CardDescription>
                Log errors and continue workflow execution. Best for non-critical operations
                that should not block the workflow (e.g., analytics tracking).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ErrorHandlingConfig
                config={config4}
                availableSteps={availableSteps}
                dlqEntries={mockDLQEntries.filter((e) => e.stepId === 'step-2')}
                onConfigChange={setConfig4}
                onRetryDLQEntry={handleRetryDLQEntry}
                onDeleteDLQEntry={handleDeleteDLQEntry}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configurations</CardTitle>
          <CardDescription>
            View all error handling configurations in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Aggressive Retry</h4>
              <pre className="text-xs bg-muted rounded p-4 overflow-x-auto">
                {JSON.stringify(config1, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Fallback Strategy</h4>
              <pre className="text-xs bg-muted rounded p-4 overflow-x-auto">
                {JSON.stringify(config2, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Circuit Breaker</h4>
              <pre className="text-xs bg-muted rounded p-4 overflow-x-auto">
                {JSON.stringify(config3, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Continue on Error</h4>
              <pre className="text-xs bg-muted rounded p-4 overflow-x-auto">
                {JSON.stringify(config4, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Basic Usage:
 *
 * ```tsx
 * import { ErrorHandlingConfig, type StepErrorConfig } from '@/components/workflow';
 *
 * function MyWorkflowEditor() {
 *   const [errorConfig, setErrorConfig] = useState<StepErrorConfig>({
 *     stepId: 'my-step',
 *     stepName: 'My Step',
 *     strategy: 'retry',
 *     retry: DEFAULT_RETRY_CONFIG,
 *     fallback: DEFAULT_FALLBACK_CONFIG,
 *     notification: DEFAULT_NOTIFICATION_CONFIG,
 *     circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
 *     logErrors: true,
 *   });
 *
 *   return (
 *     <ErrorHandlingConfig
 *       config={errorConfig}
 *       availableSteps={steps}
 *       onConfigChange={setErrorConfig}
 *     />
 *   );
 * }
 * ```
 *
 * With DLQ Management:
 *
 * ```tsx
 * function MyWorkflowEditor() {
 *   const handleRetry = async (entryId: string, fixedPayload?: unknown) => {
 *     const response = await fetch(`/api/workflows/dlq/${entryId}/retry`, {
 *       method: 'POST',
 *       body: JSON.stringify({ payload: fixedPayload }),
 *     });
 *     if (response.ok) {
 *       // Refresh DLQ entries
 *       await loadDLQEntries();
 *     }
 *   };
 *
 *   const handleDelete = async (entryId: string) => {
 *     await fetch(`/api/workflows/dlq/${entryId}`, { method: 'DELETE' });
 *     await loadDLQEntries();
 *   };
 *
 *   return (
 *     <ErrorHandlingConfig
 *       config={errorConfig}
 *       availableSteps={steps}
 *       dlqEntries={dlqEntries}
 *       onConfigChange={setErrorConfig}
 *       onRetryDLQEntry={handleRetry}
 *       onDeleteDLQEntry={handleDelete}
 *     />
 *   );
 * }
 * ```
 */
