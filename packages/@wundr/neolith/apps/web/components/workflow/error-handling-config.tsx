'use client';

/**
 * Workflow Error Handling Configuration
 *
 * Comprehensive error handling configuration for workflow steps with:
 * - Per-step retry settings with exponential backoff
 * - Fallback step configuration
 * - Error notification rules
 * - Dead letter queue (DLQ) viewer
 * - Manual retry interface
 * - Error recovery wizard
 * - Multiple error handling strategies
 */

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Error handling strategies available for workflow steps
 */
export type ErrorStrategy =
  | 'stop' // Stop workflow execution immediately
  | 'continue' // Continue to next step, log error
  | 'retry' // Retry the failed step
  | 'fallback' // Execute fallback step
  | 'circuit-breaker'; // Stop after threshold of failures

/**
 * Error types that can be categorized and handled differently
 */
export type ErrorType =
  | 'network' // Network/connectivity errors
  | 'timeout' // Request timeout errors
  | 'validation' // Data validation errors
  | 'authentication' // Auth/permission errors
  | 'rate-limit' // API rate limiting errors
  | 'server' // Server-side errors (5xx)
  | 'client' // Client-side errors (4xx)
  | 'unknown'; // Uncategorized errors

/**
 * Backoff strategies for retry attempts
 */
export type BackoffStrategy =
  | 'fixed' // Fixed delay between retries
  | 'linear' // Linear increase in delay
  | 'exponential' // Exponential backoff
  | 'fibonacci'; // Fibonacci sequence backoff

/**
 * Notification channels for error alerts
 */
export type NotificationChannel =
  | 'email'
  | 'slack'
  | 'webhook'
  | 'sms'
  | 'in-app';

/**
 * Priority levels for error notifications
 */
export type ErrorPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  retryOn: ErrorType[]; // Which error types to retry
  timeout: number; // milliseconds
}

/**
 * Configuration for fallback behavior
 */
export interface FallbackConfig {
  enabled: boolean;
  stepId?: string; // ID of the fallback step
  condition?: string; // Optional condition expression
}

/**
 * Configuration for error notifications
 */
export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  priority: ErrorPriority;
  threshold: number; // Number of errors before notifying
  cooldown: number; // Minutes between notifications
  recipients: string[]; // Email addresses, webhook URLs, etc.
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number; // Number of failures to open circuit
  successThreshold: number; // Number of successes to close circuit
  timeout: number; // How long to wait before half-open (ms)
  halfOpenRequests: number; // Max requests in half-open state
}

/**
 * Complete error handling configuration for a step
 */
export interface StepErrorConfig {
  stepId: string;
  stepName: string;
  strategy: ErrorStrategy;
  retry: RetryConfig;
  fallback: FallbackConfig;
  notification: NotificationConfig;
  circuitBreaker: CircuitBreakerConfig;
  logErrors: boolean;
  customHandlerCode?: string; // Optional custom error handler
}

/**
 * Dead letter queue entry
 */
export interface DLQEntry {
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

/**
 * Error recovery action
 */
export interface RecoveryAction {
  id: string;
  type: 'retry' | 'skip' | 'fix-and-retry' | 'delete';
  dlqEntryIds: string[];
  fixedPayload?: unknown;
  timestamp: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000,
  maxDelay: 60000,
  retryOn: ['network', 'timeout', 'rate-limit', 'server'],
  timeout: 30000,
};

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: false,
};

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: false,
  channels: ['in-app'],
  priority: 'medium',
  threshold: 1,
  cooldown: 60,
  recipients: [],
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: false,
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  halfOpenRequests: 3,
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  return `${(ms / 3600000).toFixed(1)}h`;
}

function calculateBackoff(attempt: number, config: RetryConfig): number {
  const { backoffStrategy, initialDelay, maxDelay } = config;
  let delay = initialDelay;

  switch (backoffStrategy) {
    case 'fixed':
      delay = initialDelay;
      break;
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'exponential':
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;
    case 'fibonacci':
      delay = initialDelay * fibonacci(attempt);
      break;
  }

  return Math.min(delay, maxDelay);
}

function fibonacci(n: number): number {
  if (n <= 1) {
    return 1;
  }
  let a = 1,
    b = 1;
  for (let i = 2; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function getErrorTypeIcon(type: ErrorType) {
  switch (type) {
    case 'network':
      return <Zap className='h-4 w-4' />;
    case 'timeout':
      return <Clock className='h-4 w-4' />;
    case 'validation':
      return <AlertCircle className='h-4 w-4' />;
    case 'authentication':
      return <XCircle className='h-4 w-4' />;
    case 'rate-limit':
      return <AlertTriangle className='h-4 w-4' />;
    case 'server':
      return <AlertTriangle className='h-4 w-4' />;
    case 'client':
      return <AlertCircle className='h-4 w-4' />;
    default:
      return <Info className='h-4 w-4' />;
  }
}

function getErrorTypeBadgeVariant(
  type: ErrorType
): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (type) {
    case 'network':
    case 'timeout':
      return 'secondary';
    case 'validation':
    case 'client':
      return 'outline';
    case 'authentication':
    case 'server':
      return 'destructive';
    default:
      return 'default';
  }
}

function getPriorityBadgeVariant(
  priority: ErrorPriority
): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (priority) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export interface ErrorHandlingConfigProps {
  config: StepErrorConfig;
  availableSteps: Array<{ id: string; name: string }>;
  dlqEntries?: DLQEntry[];
  onConfigChange: (config: StepErrorConfig) => void;
  onRetryDLQEntry?: (entryId: string, fixedPayload?: unknown) => Promise<void>;
  onDeleteDLQEntry?: (entryId: string) => Promise<void>;
  readOnly?: boolean;
}

export function ErrorHandlingConfig({
  config,
  availableSteps,
  dlqEntries = [],
  onConfigChange,
  onRetryDLQEntry,
  onDeleteDLQEntry,
  readOnly = false,
}: ErrorHandlingConfigProps) {
  const [activeTab, setActiveTab] = React.useState<string>('strategy');
  const [expandedDLQEntries, setExpandedDLQEntries] = React.useState<
    Set<string>
  >(new Set());
  const [wizardStep, setWizardStep] = React.useState(0);

  const updateConfig = (updates: Partial<StepErrorConfig>) => {
    if (!readOnly) {
      onConfigChange({ ...config, ...updates });
    }
  };

  const updateRetryConfig = (updates: Partial<RetryConfig>) => {
    updateConfig({ retry: { ...config.retry, ...updates } });
  };

  const updateFallbackConfig = (updates: Partial<FallbackConfig>) => {
    updateConfig({ fallback: { ...config.fallback, ...updates } });
  };

  const updateNotificationConfig = (updates: Partial<NotificationConfig>) => {
    updateConfig({ notification: { ...config.notification, ...updates } });
  };

  const updateCircuitBreakerConfig = (
    updates: Partial<CircuitBreakerConfig>
  ) => {
    updateConfig({ circuitBreaker: { ...config.circuitBreaker, ...updates } });
  };

  const toggleDLQEntry = (entryId: string) => {
    const newExpanded = new Set(expandedDLQEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedDLQEntries(newExpanded);
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h3 className='text-lg font-semibold'>Error Handling Configuration</h3>
        <p className='text-sm text-muted-foreground'>
          Configure how errors are handled for step: {config.stepName}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='strategy'>Strategy</TabsTrigger>
          <TabsTrigger value='retry'>Retry</TabsTrigger>
          <TabsTrigger value='fallback'>Fallback</TabsTrigger>
          <TabsTrigger value='notifications'>Notifications</TabsTrigger>
          <TabsTrigger value='dlq'>
            DLQ
            {dlqEntries.length > 0 && (
              <Badge variant='destructive' className='ml-2'>
                {dlqEntries.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Strategy Tab */}
        <TabsContent value='strategy' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Error Handling Strategy</CardTitle>
              <CardDescription>
                Choose how this step should handle errors
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <RadioGroup
                value={config.strategy}
                onValueChange={value =>
                  updateConfig({ strategy: value as ErrorStrategy })
                }
                disabled={readOnly}
              >
                <div className='space-y-3'>
                  <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent'>
                    <RadioGroupItem value='stop' id='strategy-stop' />
                    <div className='flex-1'>
                      <Label
                        htmlFor='strategy-stop'
                        className='font-medium cursor-pointer'
                      >
                        Stop Workflow
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Immediately stop the workflow execution on error
                      </p>
                    </div>
                    <XCircle className='h-5 w-5 text-destructive' />
                  </div>

                  <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent'>
                    <RadioGroupItem value='continue' id='strategy-continue' />
                    <div className='flex-1'>
                      <Label
                        htmlFor='strategy-continue'
                        className='font-medium cursor-pointer'
                      >
                        Continue Workflow
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Log the error and continue to the next step
                      </p>
                    </div>
                    <ChevronRight className='h-5 w-5 text-blue-500' />
                  </div>

                  <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent'>
                    <RadioGroupItem value='retry' id='strategy-retry' />
                    <div className='flex-1'>
                      <Label
                        htmlFor='strategy-retry'
                        className='font-medium cursor-pointer'
                      >
                        Retry Step
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Automatically retry the step with configurable backoff
                      </p>
                    </div>
                    <RefreshCw className='h-5 w-5 text-yellow-500' />
                  </div>

                  <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent'>
                    <RadioGroupItem value='fallback' id='strategy-fallback' />
                    <div className='flex-1'>
                      <Label
                        htmlFor='strategy-fallback'
                        className='font-medium cursor-pointer'
                      >
                        Execute Fallback
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Execute an alternative step when this step fails
                      </p>
                    </div>
                    <RotateCcw className='h-5 w-5 text-purple-500' />
                  </div>

                  <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent'>
                    <RadioGroupItem
                      value='circuit-breaker'
                      id='strategy-circuit'
                    />
                    <div className='flex-1'>
                      <Label
                        htmlFor='strategy-circuit'
                        className='font-medium cursor-pointer'
                      >
                        Circuit Breaker
                      </Label>
                      <p className='text-sm text-muted-foreground'>
                        Temporarily disable the step after repeated failures
                      </p>
                    </div>
                    <Zap className='h-5 w-5 text-orange-500' />
                  </div>
                </div>
              </RadioGroup>

              <div className='flex items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <Label htmlFor='log-errors'>Log Errors</Label>
                  <p className='text-sm text-muted-foreground'>
                    Record errors in workflow execution logs
                  </p>
                </div>
                <Switch
                  id='log-errors'
                  checked={config.logErrors}
                  onCheckedChange={checked =>
                    updateConfig({ logErrors: checked })
                  }
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retry Tab */}
        <TabsContent value='retry' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Retry Configuration</CardTitle>
              <CardDescription>
                Configure automatic retry behavior for failed steps
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='retry-enabled'>Enable Retry</Label>
                  <p className='text-sm text-muted-foreground'>
                    Automatically retry failed steps
                  </p>
                </div>
                <Switch
                  id='retry-enabled'
                  checked={config.retry.enabled}
                  onCheckedChange={checked =>
                    updateRetryConfig({ enabled: checked })
                  }
                  disabled={readOnly}
                />
              </div>

              {config.retry.enabled && (
                <>
                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='max-attempts'>Maximum Attempts</Label>
                      <Input
                        id='max-attempts'
                        type='number'
                        min={1}
                        max={10}
                        value={config.retry.maxAttempts}
                        onChange={e =>
                          updateRetryConfig({
                            maxAttempts: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Total attempts including initial try
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='backoff-strategy'>Backoff Strategy</Label>
                      <Select
                        value={config.retry.backoffStrategy}
                        onValueChange={value =>
                          updateRetryConfig({
                            backoffStrategy: value as BackoffStrategy,
                          })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger id='backoff-strategy'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='fixed'>Fixed Delay</SelectItem>
                          <SelectItem value='linear'>Linear Backoff</SelectItem>
                          <SelectItem value='exponential'>
                            Exponential Backoff
                          </SelectItem>
                          <SelectItem value='fibonacci'>
                            Fibonacci Backoff
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='initial-delay'>Initial Delay (ms)</Label>
                      <Input
                        id='initial-delay'
                        type='number'
                        min={100}
                        max={60000}
                        step={100}
                        value={config.retry.initialDelay}
                        onChange={e =>
                          updateRetryConfig({
                            initialDelay: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='max-delay'>Maximum Delay (ms)</Label>
                      <Input
                        id='max-delay'
                        type='number'
                        min={1000}
                        max={3600000}
                        step={1000}
                        value={config.retry.maxDelay}
                        onChange={e =>
                          updateRetryConfig({
                            maxDelay: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='timeout'>Step Timeout (ms)</Label>
                      <Input
                        id='timeout'
                        type='number'
                        min={1000}
                        max={300000}
                        step={1000}
                        value={config.retry.timeout}
                        onChange={e =>
                          updateRetryConfig({
                            timeout: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Retry Preview */}
                  <div className='rounded-lg border bg-muted/50 p-4'>
                    <h4 className='text-sm font-medium mb-3'>
                      Retry Schedule Preview
                    </h4>
                    <div className='space-y-2'>
                      {Array.from({ length: config.retry.maxAttempts }).map(
                        (_, i) => {
                          const delay =
                            i === 0 ? 0 : calculateBackoff(i, config.retry);
                          return (
                            <div
                              key={i}
                              className='flex items-center gap-3 text-sm'
                            >
                              <Badge variant='outline' className='w-20'>
                                Attempt {i + 1}
                              </Badge>
                              <span className='text-muted-foreground'>
                                {i === 0
                                  ? 'Initial'
                                  : `After ${formatDuration(delay)}`}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Error Types to Retry */}
                  <div className='space-y-2'>
                    <Label>Retry on Error Types</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      {(
                        [
                          'network',
                          'timeout',
                          'rate-limit',
                          'server',
                          'validation',
                          'client',
                          'authentication',
                          'unknown',
                        ] as ErrorType[]
                      ).map(type => (
                        <div key={type} className='flex items-center space-x-2'>
                          <input
                            type='checkbox'
                            id={`retry-${type}`}
                            checked={config.retry.retryOn.includes(type)}
                            onChange={e => {
                              const retryOn = e.target.checked
                                ? [...config.retry.retryOn, type]
                                : config.retry.retryOn.filter(t => t !== type);
                              updateRetryConfig({ retryOn });
                            }}
                            disabled={readOnly}
                            className='rounded border-gray-300'
                          />
                          <Label
                            htmlFor={`retry-${type}`}
                            className='text-sm cursor-pointer capitalize'
                          >
                            {type.replace('-', ' ')}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fallback Tab */}
        <TabsContent value='fallback' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Fallback Configuration</CardTitle>
              <CardDescription>
                Configure alternative steps to execute on failure
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='fallback-enabled'>Enable Fallback</Label>
                  <p className='text-sm text-muted-foreground'>
                    Execute a fallback step when this step fails
                  </p>
                </div>
                <Switch
                  id='fallback-enabled'
                  checked={config.fallback.enabled}
                  onCheckedChange={checked =>
                    updateFallbackConfig({ enabled: checked })
                  }
                  disabled={readOnly}
                />
              </div>

              {config.fallback.enabled && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='fallback-step'>Fallback Step</Label>
                    <Select
                      value={config.fallback.stepId || ''}
                      onValueChange={value =>
                        updateFallbackConfig({ stepId: value })
                      }
                      disabled={readOnly}
                    >
                      <SelectTrigger id='fallback-step'>
                        <SelectValue placeholder='Select a fallback step...' />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSteps
                          .filter(step => step.id !== config.stepId)
                          .map(step => (
                            <SelectItem key={step.id} value={step.id}>
                              {step.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className='text-xs text-muted-foreground'>
                      This step will execute if the primary step fails
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='fallback-condition'>
                      Condition (Optional)
                    </Label>
                    <Input
                      id='fallback-condition'
                      placeholder="error.type === 'network' && error.retries >= 3"
                      value={config.fallback.condition || ''}
                      onChange={e =>
                        updateFallbackConfig({ condition: e.target.value })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      JavaScript expression to control when fallback executes
                    </p>
                  </div>

                  <div className='rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4'>
                    <div className='flex gap-2'>
                      <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                      <div className='space-y-1'>
                        <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                          Fallback Execution Flow
                        </p>
                        <p className='text-xs text-blue-700 dark:text-blue-300'>
                          When this step fails, the fallback step will execute
                          instead. The workflow will then continue from the next
                          step after the fallback completes.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value='notifications' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Error Notifications</CardTitle>
              <CardDescription>
                Configure alerts when errors occur
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='notification-enabled'>
                    Enable Notifications
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Send alerts when errors occur
                  </p>
                </div>
                <Switch
                  id='notification-enabled'
                  checked={config.notification.enabled}
                  onCheckedChange={checked =>
                    updateNotificationConfig({ enabled: checked })
                  }
                  disabled={readOnly}
                />
              </div>

              {config.notification.enabled && (
                <>
                  <div className='space-y-2'>
                    <Label>Notification Channels</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      {(
                        [
                          'email',
                          'slack',
                          'webhook',
                          'sms',
                          'in-app',
                        ] as NotificationChannel[]
                      ).map(channel => (
                        <div
                          key={channel}
                          className='flex items-center space-x-2'
                        >
                          <input
                            type='checkbox'
                            id={`channel-${channel}`}
                            checked={config.notification.channels.includes(
                              channel
                            )}
                            onChange={e => {
                              const channels = e.target.checked
                                ? [...config.notification.channels, channel]
                                : config.notification.channels.filter(
                                    c => c !== channel
                                  );
                              updateNotificationConfig({ channels });
                            }}
                            disabled={readOnly}
                            className='rounded border-gray-300'
                          />
                          <Label
                            htmlFor={`channel-${channel}`}
                            className='text-sm cursor-pointer capitalize flex items-center gap-2'
                          >
                            {channel === 'email' && (
                              <Send className='h-3 w-3' />
                            )}
                            {channel === 'in-app' && (
                              <Bell className='h-3 w-3' />
                            )}
                            {channel}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                      <Label htmlFor='priority'>Priority</Label>
                      <Select
                        value={config.notification.priority}
                        onValueChange={value =>
                          updateNotificationConfig({
                            priority: value as ErrorPriority,
                          })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger id='priority'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='critical'>Critical</SelectItem>
                          <SelectItem value='high'>High</SelectItem>
                          <SelectItem value='medium'>Medium</SelectItem>
                          <SelectItem value='low'>Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='threshold'>Error Threshold</Label>
                      <Input
                        id='threshold'
                        type='number'
                        min={1}
                        max={100}
                        value={config.notification.threshold}
                        onChange={e =>
                          updateNotificationConfig({
                            threshold: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Notify after this many errors
                      </p>
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='cooldown'>Cooldown (minutes)</Label>
                      <Input
                        id='cooldown'
                        type='number'
                        min={1}
                        max={1440}
                        value={config.notification.cooldown}
                        onChange={e =>
                          updateNotificationConfig({
                            cooldown: parseInt(e.target.value),
                          })
                        }
                        disabled={readOnly}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Minimum time between notifications
                      </p>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='recipients'>Recipients</Label>
                    <Input
                      id='recipients'
                      placeholder='email@example.com, https://hooks.slack.com/...'
                      value={config.notification.recipients.join(', ')}
                      onChange={e =>
                        updateNotificationConfig({
                          recipients: e.target.value
                            .split(',')
                            .map(r => r.trim())
                            .filter(Boolean),
                        })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Comma-separated list of email addresses or webhook URLs
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Circuit Breaker Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker</CardTitle>
              <CardDescription>
                Prevent cascading failures with circuit breaker pattern
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <Label htmlFor='circuit-enabled'>
                    Enable Circuit Breaker
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Temporarily disable step after repeated failures
                  </p>
                </div>
                <Switch
                  id='circuit-enabled'
                  checked={config.circuitBreaker.enabled}
                  onCheckedChange={checked =>
                    updateCircuitBreakerConfig({ enabled: checked })
                  }
                  disabled={readOnly}
                />
              </div>

              {config.circuitBreaker.enabled && (
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='failure-threshold'>Failure Threshold</Label>
                    <Input
                      id='failure-threshold'
                      type='number'
                      min={1}
                      max={100}
                      value={config.circuitBreaker.failureThreshold}
                      onChange={e =>
                        updateCircuitBreakerConfig({
                          failureThreshold: parseInt(e.target.value),
                        })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Open circuit after this many failures
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='success-threshold'>Success Threshold</Label>
                    <Input
                      id='success-threshold'
                      type='number'
                      min={1}
                      max={100}
                      value={config.circuitBreaker.successThreshold}
                      onChange={e =>
                        updateCircuitBreakerConfig({
                          successThreshold: parseInt(e.target.value),
                        })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Close circuit after this many successes
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='circuit-timeout'>Timeout (ms)</Label>
                    <Input
                      id='circuit-timeout'
                      type='number'
                      min={1000}
                      max={3600000}
                      step={1000}
                      value={config.circuitBreaker.timeout}
                      onChange={e =>
                        updateCircuitBreakerConfig({
                          timeout: parseInt(e.target.value),
                        })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Time before attempting half-open state
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='half-open-requests'>
                      Half-Open Requests
                    </Label>
                    <Input
                      id='half-open-requests'
                      type='number'
                      min={1}
                      max={10}
                      value={config.circuitBreaker.halfOpenRequests}
                      onChange={e =>
                        updateCircuitBreakerConfig({
                          halfOpenRequests: parseInt(e.target.value),
                        })
                      }
                      disabled={readOnly}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Max requests to test in half-open state
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DLQ Tab */}
        <TabsContent value='dlq' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                Dead Letter Queue
                {dlqEntries.length > 0 && (
                  <Badge variant='destructive'>
                    {dlqEntries.length} Failed
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                View and manage failed workflow executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dlqEntries.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <CheckCircle className='h-12 w-12 text-green-500 mb-4' />
                  <h4 className='text-lg font-medium mb-2'>
                    No Failed Executions
                  </h4>
                  <p className='text-sm text-muted-foreground'>
                    All workflow executions for this step have completed
                    successfully
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {dlqEntries.map(entry => (
                    <DLQEntryCard
                      key={entry.id}
                      entry={entry}
                      expanded={expandedDLQEntries.has(entry.id)}
                      onToggle={() => toggleDLQEntry(entry.id)}
                      onRetry={onRetryDLQEntry}
                      onDelete={onDeleteDLQEntry}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Recovery Wizard */}
      <ErrorRecoveryWizard
        config={config}
        onConfigChange={onConfigChange}
        availableSteps={availableSteps}
      />
    </div>
  );
}

// ============================================================================
// DLQ Entry Card Component
// ============================================================================

interface DLQEntryCardProps {
  entry: DLQEntry;
  expanded: boolean;
  onToggle: () => void;
  onRetry?: (entryId: string, fixedPayload?: unknown) => Promise<void>;
  onDelete?: (entryId: string) => Promise<void>;
}

function DLQEntryCard({
  entry,
  expanded,
  onToggle,
  onRetry,
  onDelete,
}: DLQEntryCardProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      try {
        await onRetry(entry.id);
      } finally {
        setIsRetrying(false);
      }
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(entry.id);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className='rounded-lg border'>
      <div
        className='flex items-center justify-between p-4 cursor-pointer hover:bg-accent'
        onClick={onToggle}
      >
        <div className='flex items-center gap-3 flex-1'>
          {expanded ? (
            <ChevronDown className='h-4 w-4 text-muted-foreground' />
          ) : (
            <ChevronRight className='h-4 w-4 text-muted-foreground' />
          )}
          <div className='flex-1'>
            <div className='flex items-center gap-2 mb-1'>
              <h4 className='font-medium'>{entry.stepName}</h4>
              <Badge variant={getErrorTypeBadgeVariant(entry.errorType)}>
                {entry.errorType}
              </Badge>
              <Badge variant='outline' className='text-xs'>
                {entry.attemptCount} attempts
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground line-clamp-1'>
              {entry.errorMessage}
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              {new Date(entry.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <div
          className='flex items-center gap-2'
          onClick={e => e.stopPropagation()}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <RefreshCw className='h-4 w-4 animate-spin' />
                  ) : (
                    <RefreshCw className='h-4 w-4' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry execution</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogTrigger asChild>
              <Button size='sm' variant='outline'>
                <Trash2 className='h-4 w-4 text-destructive' />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Failed Execution?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this failed execution from the
                  dead letter queue. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {expanded && (
        <div className='border-t p-4 space-y-4 bg-muted/50'>
          <div>
            <h5 className='text-sm font-medium mb-2'>Error Details</h5>
            <pre className='text-xs bg-background rounded p-3 overflow-x-auto'>
              {entry.errorMessage}
            </pre>
          </div>

          {entry.stack && (
            <div>
              <h5 className='text-sm font-medium mb-2'>Stack Trace</h5>
              <pre className='text-xs bg-background rounded p-3 overflow-x-auto max-h-40'>
                {entry.stack}
              </pre>
            </div>
          )}

          <div>
            <h5 className='text-sm font-medium mb-2'>Payload</h5>
            <pre className='text-xs bg-background rounded p-3 overflow-x-auto max-h-40'>
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </div>

          <div className='flex items-center gap-2 pt-2'>
            <Badge variant='outline'>Workflow: {entry.workflowId}</Badge>
            <Badge variant='outline'>Step: {entry.stepId}</Badge>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Error Recovery Wizard Component
// ============================================================================

interface ErrorRecoveryWizardProps {
  config: StepErrorConfig;
  onConfigChange: (config: StepErrorConfig) => void;
  availableSteps: Array<{ id: string; name: string }>;
}

function ErrorRecoveryWizard({
  config,
  onConfigChange,
  availableSteps,
}: ErrorRecoveryWizardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [wizardConfig, setWizardConfig] =
    React.useState<StepErrorConfig>(config);

  const steps = [
    { title: 'Strategy', description: 'Choose error handling strategy' },
    { title: 'Retry', description: 'Configure retry behavior' },
    { title: 'Fallback', description: 'Set up fallback steps' },
    { title: 'Notifications', description: 'Configure alerts' },
    { title: 'Review', description: 'Review and apply' },
  ];

  const handleComplete = () => {
    onConfigChange(wizardConfig);
    setIsOpen(false);
    setStep(0);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant='outline' className='w-full'>
          <Settings className='h-4 w-4 mr-2' />
          Quick Setup Wizard
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className='max-w-2xl'>
        <AlertDialogHeader>
          <AlertDialogTitle>Error Handling Setup Wizard</AlertDialogTitle>
          <AlertDialogDescription>
            Step {step + 1} of {steps.length}: {steps[step].description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='py-4'>
          <div className='flex justify-between mb-6'>
            {steps.map((s, i) => (
              <div
                key={i}
                className={`flex-1 ${i !== steps.length - 1 ? 'border-r' : ''}`}
              >
                <div className='flex flex-col items-center'>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i <= step
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <p className='text-xs mt-1 text-center'>{s.title}</p>
                </div>
              </div>
            ))}
          </div>

          <div className='min-h-[300px]'>
            {step === 4 ? (
              <div className='space-y-4'>
                <h4 className='font-medium'>Configuration Summary</h4>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Strategy:</span>
                    <span className='font-medium capitalize'>
                      {wizardConfig.strategy}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Retry Enabled:
                    </span>
                    <span className='font-medium'>
                      {wizardConfig.retry.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {wizardConfig.retry.enabled && (
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Max Attempts:
                      </span>
                      <span className='font-medium'>
                        {wizardConfig.retry.maxAttempts}
                      </span>
                    </div>
                  )}
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Fallback Enabled:
                    </span>
                    <span className='font-medium'>
                      {wizardConfig.fallback.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>
                      Notifications:
                    </span>
                    <span className='font-medium'>
                      {wizardConfig.notification.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Wizard step content would go here for step: {steps[step].title}
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {step > 0 && (
            <Button variant='outline' onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <AlertDialogAction onClick={handleComplete}>
              Apply Configuration
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  calculateBackoff,
  formatDuration,
  getErrorTypeIcon,
  getErrorTypeBadgeVariant,
  getPriorityBadgeVariant,
};
