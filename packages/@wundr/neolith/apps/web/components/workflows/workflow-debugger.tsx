'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type {
  Workflow,
  TriggerConfig,
  ActionConfig,
  ActionResult,
  WorkflowVariable,
  ExecutionStatus,
  ActionResultStatus,
} from '@/types/workflow';

export interface WorkflowDebuggerProps {
  workflow: Workflow;
  className?: string;
  onExecutionComplete?: (results: DebugExecution) => void;
}

interface DebugExecution {
  id: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggerData: Record<string, unknown>;
  actionResults: ActionResult[];
  variables: Record<string, unknown>;
  breakpoints: Set<string>;
}

interface Breakpoint {
  actionId: string;
  enabled: boolean;
  condition?: string;
}

interface MockService {
  id: string;
  name: string;
  enabled: boolean;
  responses: Record<string, unknown>;
}

const DEFAULT_MOCK_SERVICES: MockService[] = [
  {
    id: 'http',
    name: 'HTTP Requests',
    enabled: false,
    responses: {
      default: { status: 200, body: { success: true } },
    },
  },
  {
    id: 'channels',
    name: 'Channel Operations',
    enabled: false,
    responses: {
      create: { id: 'mock-channel-123', name: 'test-channel' },
      invite: { success: true },
    },
  },
  {
    id: 'messages',
    name: 'Message Operations',
    enabled: false,
    responses: {
      send: { id: 'mock-message-123', timestamp: new Date().toISOString() },
    },
  },
];

export function WorkflowDebugger({
  workflow,
  className,
  onExecutionComplete,
}: WorkflowDebuggerProps) {
  const [testMode, setTestMode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [breakpoints, setBreakpoints] = useState<Map<string, Breakpoint>>(
    new Map(),
  );
  const [mockServices, setMockServices] =
    useState<MockService[]>(DEFAULT_MOCK_SERVICES);

  // Test data input
  const [testData, setTestData] = useState<string>(
    JSON.stringify(getDefaultTriggerData(workflow.trigger), null, 2),
  );
  const [testDataError, setTestDataError] = useState<string>('');

  // Execution state
  const [execution, setExecution] = useState<DebugExecution | null>(null);
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<
    Array<{
      timestamp: string;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      data?: unknown;
    }>
  >([]);

  const executionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (executionTimeoutRef.current) {
        clearTimeout(executionTimeoutRef.current);
      }
    };
  }, []);

  const addLog = useCallback(
    (
      level: 'info' | 'warn' | 'error' | 'debug',
      message: string,
      data?: unknown,
    ) => {
      setLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level,
          message,
          data,
        },
      ]);
    },
    [],
  );

  const toggleBreakpoint = useCallback((actionId: string) => {
    setBreakpoints(prev => {
      const newBreakpoints = new Map(prev);
      const existing = newBreakpoints.get(actionId);
      if (existing) {
        newBreakpoints.set(actionId, { ...existing, enabled: !existing.enabled });
      } else {
        newBreakpoints.set(actionId, { actionId, enabled: true });
      }
      return newBreakpoints;
    });
  }, []);

  const toggleMockService = useCallback((serviceId: string) => {
    setMockServices(prev =>
      prev.map(service =>
        service.id === serviceId
          ? { ...service, enabled: !service.enabled }
          : service,
      ),
    );
  }, []);

  const validateTestData = useCallback((): boolean => {
    try {
      JSON.parse(testData);
      setTestDataError('');
      return true;
    } catch (error) {
      setTestDataError(
        error instanceof Error ? error.message : 'Invalid JSON',
      );
      return false;
    }
  }, [testData]);

  const executeAction = useCallback(
    async (
      action: ActionConfig,
      triggerData: Record<string, unknown>,
      actionVariables: Record<string, unknown>,
    ): Promise<ActionResult> => {
      const startTime = Date.now();
      const result: ActionResult = {
        actionId: action.id,
        actionType: action.type,
        status: 'running',
        startedAt: new Date().toISOString(),
      };

      addLog('info', `Executing action: ${action.type}`, { actionId: action.id });

      // Check if we should use mock services
      const mockService = mockServices.find(s => {
        switch (action.type) {
          case 'http_request':
            return s.id === 'http' && s.enabled;
          case 'create_channel':
          case 'invite_to_channel':
            return s.id === 'channels' && s.enabled;
          case 'send_message':
          case 'send_dm':
            return s.id === 'messages' && s.enabled;
          default:
            return false;
        }
      });

      // Simulate execution with delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      try {
        let output: Record<string, unknown> = {};

        if (mockService) {
          // Use mock response
          addLog('debug', `Using mock service: ${mockService.name}`);
          output = (mockService.responses.default || mockService.responses) as Record<string, unknown>;
        } else {
          // Simulate real execution (in test mode, this would still be simulated)
          switch (action.type) {
            case 'send_message':
              output = {
                messageId: `msg-${Date.now()}`,
                channelId: action.config.channelId,
                content: replaceVariables(
                  action.config.message,
                  triggerData,
                  actionVariables,
                ),
              };
              break;
            case 'http_request':
              output = {
                status: 200,
                body: { success: true, timestamp: new Date().toISOString() },
                headers: { 'content-type': 'application/json' },
              };
              break;
            case 'create_channel':
              output = {
                channelId: `ch-${Date.now()}`,
                name: action.config.channelName,
                type: action.config.channelType,
              };
              break;
            case 'wait':
              output = {
                waitedFor: `${action.config.duration} ${action.config.unit}`,
              };
              break;
            case 'condition':
              const conditionResult = evaluateCondition(
                action.config.condition,
                triggerData,
                actionVariables,
              );
              output = {
                result: conditionResult,
                condition: action.config.condition,
              };
              break;
            default:
              output = { executed: true };
          }
        }

        const duration = Date.now() - startTime;
        addLog('info', `Action completed: ${action.type}`, { duration, output });

        return {
          ...result,
          status: 'completed',
          completedAt: new Date().toISOString(),
          duration,
          output,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        addLog('error', `Action failed: ${action.type}`, { error: errorMessage });

        return {
          ...result,
          status: 'failed',
          completedAt: new Date().toISOString(),
          duration,
          error: errorMessage,
        };
      }
    },
    [mockServices, addLog],
  );

  const handleRunTest = useCallback(async () => {
    if (!validateTestData()) {
      return;
    }

    setIsExecuting(true);
    setIsPaused(false);
    setCurrentStep(-1);
    setLogs([]);
    setVariables({});

    const triggerData = JSON.parse(testData);
    const executionId = `exec-${Date.now()}`;

    addLog('info', 'Starting workflow execution', {
      workflowId: workflow.id,
      executionId,
    });

    const newExecution: DebugExecution = {
      id: executionId,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggerData,
      actionResults: [],
      variables: { trigger: triggerData },
      breakpoints: new Set(
        Array.from(breakpoints.entries())
          .filter(([_, bp]) => bp.enabled)
          .map(([id]) => id),
      ),
    };

    setExecution(newExecution);
    setVariables(newExecution.variables);

    try {
      // Execute actions step by step
      for (let i = 0; i < workflow.actions.length; i++) {
        const action = workflow.actions[i];
        setCurrentStep(i);

        // Check for breakpoint
        if (newExecution.breakpoints.has(action.id)) {
          addLog('debug', `Breakpoint hit at action ${i + 1}`, {
            actionId: action.id,
          });
          setIsPaused(true);

          // Wait for user to continue
          await new Promise<void>(resolve => {
            const checkPause = () => {
              if (!isPaused) {
                resolve();
              } else {
                executionTimeoutRef.current = setTimeout(checkPause, 100);
              }
            };
            checkPause();
          });
        }

        // Execute the action
        const result = await executeAction(action, triggerData, variables);
        newExecution.actionResults.push(result);

        // Update variables with action output
        if (result.output) {
          const actionVars = {
            ...variables,
            [`action${i + 1}`]: result.output,
          };
          setVariables(actionVars);
          newExecution.variables = actionVars;
        }

        // Stop if action failed and error handling is "stop"
        if (
          result.status === 'failed' &&
          action.errorHandling?.onError === 'stop'
        ) {
          addLog('error', 'Workflow stopped due to action failure');
          newExecution.status = 'failed';
          break;
        }
      }

      const duration = Date.now() - new Date(newExecution.startedAt).getTime();
      newExecution.completedAt = new Date().toISOString();
      newExecution.duration = duration;
      newExecution.status =
        newExecution.status === 'running' ? 'completed' : newExecution.status;

      addLog('info', 'Workflow execution completed', {
        duration,
        status: newExecution.status,
      });

      setExecution(newExecution);
      onExecutionComplete?.(newExecution);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', 'Workflow execution failed', { error: errorMessage });
      newExecution.status = 'failed';
      newExecution.completedAt = new Date().toISOString();
      setExecution(newExecution);
    } finally {
      setIsExecuting(false);
      setCurrentStep(-1);
    }
  }, [
    workflow,
    testData,
    validateTestData,
    breakpoints,
    variables,
    isPaused,
    executeAction,
    addLog,
    onExecutionComplete,
  ]);

  const handleStepOver = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsExecuting(false);
    setIsPaused(false);
    setCurrentStep(-1);
    if (execution) {
      setExecution({
        ...execution,
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      });
    }
    addLog('warn', 'Execution stopped by user');
  }, [execution, addLog]);

  const handleReset = useCallback(() => {
    setExecution(null);
    setLogs([]);
    setVariables({});
    setCurrentStep(-1);
    setIsExecuting(false);
    setIsPaused(false);
  }, []);

  const activeVariables = useMemo(() => {
    return Object.entries(variables).map(([key, value]) => ({
      name: key,
      value,
      type: typeof value,
    }));
  }, [variables]);

  return (
    <div className={cn('flex h-full flex-col gap-4', className)}>
      {/* Header - Test Mode Toggle */}
      <div className='flex items-center justify-between rounded-lg border bg-card p-4'>
        <div className='flex items-center gap-3'>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              testMode ? 'bg-primary/10' : 'bg-muted',
            )}
          >
            <BugIcon
              className={cn(
                'h-5 w-5',
                testMode ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          </div>
          <div>
            <h3 className='font-semibold text-foreground'>Debug Mode</h3>
            <p className='text-sm text-muted-foreground'>
              Test and debug your workflow step-by-step
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <label
            htmlFor='test-mode-toggle'
            className='text-sm font-medium text-foreground'
          >
            {testMode ? 'Enabled' : 'Disabled'}
          </label>
          <Switch
            id='test-mode-toggle'
            checked={testMode}
            onCheckedChange={setTestMode}
          />
        </div>
      </div>

      {testMode && (
        <div className='flex flex-1 gap-4 overflow-hidden'>
          {/* Left Panel - Test Configuration */}
          <div className='flex w-96 flex-col gap-4 overflow-auto'>
            {/* Test Data Input */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-3 font-semibold text-foreground'>Test Data</h4>
              <p className='mb-3 text-sm text-muted-foreground'>
                Enter JSON data to simulate the workflow trigger
              </p>
              <div className='space-y-2'>
                <textarea
                  value={testData}
                  onChange={e => {
                    setTestData(e.target.value);
                    setTestDataError('');
                  }}
                  onBlur={validateTestData}
                  rows={10}
                  className={cn(
                    'w-full rounded-md border bg-background px-3 py-2 font-mono text-sm',
                    testDataError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : 'border-input focus:border-primary focus:ring-primary',
                    'focus:outline-none focus:ring-1',
                  )}
                  placeholder='{"message": "test", "user": {"id": "123"}}'
                />
                {testDataError && (
                  <p className='text-xs text-red-500'>{testDataError}</p>
                )}
              </div>
            </div>

            {/* Mock Services */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-3 font-semibold text-foreground'>
                Mock External Services
              </h4>
              <p className='mb-3 text-sm text-muted-foreground'>
                Enable mocking to avoid calling real external services
              </p>
              <div className='space-y-2'>
                {mockServices.map(service => (
                  <div
                    key={service.id}
                    className='flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2'
                  >
                    <span className='text-sm font-medium text-foreground'>
                      {service.name}
                    </span>
                    <Switch
                      checked={service.enabled}
                      onCheckedChange={() => toggleMockService(service.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Controls */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-3 font-semibold text-foreground'>Controls</h4>
              <div className='flex flex-col gap-2'>
                {!isExecuting ? (
                  <Button
                    onClick={handleRunTest}
                    className='w-full'
                    disabled={!testData.trim()}
                  >
                    <PlayIcon className='h-4 w-4' />
                    Run Test
                  </Button>
                ) : (
                  <>
                    {isPaused ? (
                      <Button
                        onClick={handleStepOver}
                        className='w-full'
                        variant='secondary'
                      >
                        <StepForwardIcon className='h-4 w-4' />
                        Step Over
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setIsPaused(true)}
                        className='w-full'
                        variant='secondary'
                      >
                        <PauseIcon className='h-4 w-4' />
                        Pause
                      </Button>
                    )}
                    <Button
                      onClick={handleStop}
                      className='w-full'
                      variant='destructive'
                    >
                      <StopIcon className='h-4 w-4' />
                      Stop
                    </Button>
                  </>
                )}
                {execution && !isExecuting && (
                  <Button
                    onClick={handleReset}
                    className='w-full'
                    variant='outline'
                  >
                    <RefreshIcon className='h-4 w-4' />
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel - Visual Flow */}
          <div className='flex flex-1 flex-col gap-4 overflow-auto'>
            {/* Workflow Execution Flow */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-4 font-semibold text-foreground'>
                Execution Flow
              </h4>

              {/* Trigger */}
              <div
                className={cn(
                  'rounded-lg border p-3 transition-all',
                  execution && currentStep === -1
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30',
                )}
              >
                <div className='flex items-center gap-3'>
                  <div className='flex h-8 w-8 items-center justify-center rounded-full bg-stone-500/20'>
                    <TriggerIcon className='h-4 w-4 text-stone-600 dark:text-stone-400' />
                  </div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-foreground'>
                      Trigger: {workflow.trigger.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  {execution && currentStep === -1 && (
                    <Badge variant='default'>Active</Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className='space-y-2'>
                {workflow.actions.map((action, index) => {
                  const result = execution?.actionResults.find(
                    r => r.actionId === action.id,
                  );
                  const hasBreakpoint = breakpoints.get(action.id)?.enabled;
                  const isActive = currentStep === index;
                  const isCompleted = result !== undefined;

                  return (
                    <div key={action.id}>
                      {/* Connection line */}
                      <div className='ml-4 flex h-4 items-center'>
                        <div className='h-full w-0.5 bg-border' />
                      </div>

                      {/* Action card */}
                      <div
                        className={cn(
                          'rounded-lg border p-3 transition-all',
                          isActive && 'border-primary bg-primary/5 shadow-sm',
                          isCompleted &&
                            !isActive &&
                            result.status === 'completed' &&
                            'border-green-500/50 bg-green-500/5',
                          isCompleted &&
                            !isActive &&
                            result.status === 'failed' &&
                            'border-red-500/50 bg-red-500/5',
                          !isActive &&
                            !isCompleted &&
                            'border-border bg-muted/30',
                        )}
                      >
                        <div className='flex items-center gap-3'>
                          {/* Breakpoint indicator */}
                          <button
                            type='button'
                            onClick={() => toggleBreakpoint(action.id)}
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                              hasBreakpoint
                                ? 'border-red-500 bg-red-500'
                                : 'border-border bg-background hover:border-red-500',
                            )}
                            title='Toggle breakpoint'
                          >
                            {hasBreakpoint && (
                              <div className='h-2 w-2 rounded-full bg-white' />
                            )}
                          </button>

                          {/* Step number */}
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                              isActive && 'bg-primary text-primary-foreground',
                              isCompleted &&
                                !isActive &&
                                result.status === 'completed' &&
                                'bg-green-500 text-white',
                              isCompleted &&
                                !isActive &&
                                result.status === 'failed' &&
                                'bg-red-500 text-white',
                              !isActive &&
                                !isCompleted &&
                                'bg-muted text-muted-foreground',
                            )}
                          >
                            {isCompleted && result.status === 'completed' ? (
                              <CheckIcon className='h-4 w-4' />
                            ) : isCompleted && result.status === 'failed' ? (
                              <XIcon className='h-4 w-4' />
                            ) : (
                              index + 1
                            )}
                          </div>

                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-foreground truncate'>
                              {action.type
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, c => c.toUpperCase())}
                            </p>
                            {result?.duration && (
                              <p className='text-xs text-muted-foreground'>
                                {result.duration}ms
                              </p>
                            )}
                          </div>

                          {/* Status badges */}
                          <div className='flex items-center gap-2'>
                            {isActive && (
                              <Badge variant='default'>
                                <LoadingSpinner className='mr-1 h-3 w-3' />
                                Running
                              </Badge>
                            )}
                            {isCompleted && result.status === 'completed' && (
                              <Badge className='bg-green-500 hover:bg-green-500/80'>
                                Completed
                              </Badge>
                            )}
                            {isCompleted && result.status === 'failed' && (
                              <Badge variant='destructive'>Failed</Badge>
                            )}
                          </div>
                        </div>

                        {/* Action output */}
                        {result?.output && (
                          <div className='mt-2 rounded-md bg-background p-2'>
                            <p className='mb-1 text-xs font-medium text-muted-foreground'>
                              Output:
                            </p>
                            <pre className='overflow-x-auto text-xs text-foreground'>
                              {JSON.stringify(result.output, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {result?.error && (
                          <div className='mt-2 rounded-md bg-red-500/10 p-2'>
                            <p className='text-xs text-red-600 dark:text-red-400'>
                              Error: {result.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Inspector */}
          <div className='flex w-80 flex-col gap-4 overflow-auto'>
            {/* Variable Inspector */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-3 font-semibold text-foreground'>
                Variable Inspector
              </h4>
              {activeVariables.length > 0 ? (
                <Accordion type='single' collapsible className='w-full'>
                  {activeVariables.map((variable, index) => (
                    <AccordionItem key={index} value={`var-${index}`}>
                      <AccordionTrigger className='text-sm'>
                        <div className='flex items-center gap-2'>
                          <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
                            {variable.name}
                          </code>
                          <Badge variant='outline' className='text-xs'>
                            {variable.type}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className='overflow-x-auto rounded-md bg-background p-2 text-xs text-foreground'>
                          {JSON.stringify(variable.value, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No variables available. Run the workflow to see variables.
                </p>
              )}
            </div>

            {/* Execution Logs */}
            <div className='rounded-lg border bg-card p-4'>
              <h4 className='mb-3 font-semibold text-foreground'>
                Execution Logs
              </h4>
              {logs.length > 0 ? (
                <div className='space-y-1 max-h-96 overflow-y-auto'>
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        'rounded-md p-2 text-xs',
                        log.level === 'error' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                        log.level === 'warn' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                        log.level === 'info' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        log.level === 'debug' && 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
                      )}
                    >
                      <div className='flex items-start gap-2'>
                        <span className='font-mono text-xs opacity-60'>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className='flex-1'>{log.message}</span>
                      </div>
                      {log.data !== undefined && (
                        <pre className='mt-1 overflow-x-auto font-mono text-xs opacity-75'>
                          {typeof log.data === 'object' && log.data !== null
                            ? JSON.stringify(log.data, null, 2)
                            : String(log.data)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No logs yet. Run the workflow to see execution logs.
                </p>
              )}
            </div>

            {/* Execution Summary */}
            {execution && (
              <div className='rounded-lg border bg-card p-4'>
                <h4 className='mb-3 font-semibold text-foreground'>
                  Execution Summary
                </h4>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Status:</span>
                    <Badge
                      variant={
                        execution.status === 'completed'
                          ? 'default'
                          : execution.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {execution.status}
                    </Badge>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Duration:</span>
                    <span className='font-mono text-foreground'>
                      {execution.duration ? `${execution.duration}ms` : '-'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Actions:</span>
                    <span className='font-mono text-foreground'>
                      {execution.actionResults.length} / {workflow.actions.length}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Breakpoints:</span>
                    <span className='font-mono text-foreground'>
                      {execution.breakpoints.size}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!testMode && (
        <div className='flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30'>
          <div className='text-center'>
            <BugIcon className='mx-auto h-12 w-12 text-muted-foreground opacity-50' />
            <p className='mt-3 text-sm font-medium text-muted-foreground'>
              Enable Debug Mode to start testing
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Toggle the switch above to access debugging features
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions

function getDefaultTriggerData(trigger: TriggerConfig): Record<string, unknown> {
  switch (trigger.type) {
    case 'message':
      return {
        message: {
          content: 'Test message content',
          author: {
            id: 'user-123',
            name: 'Test User',
          },
          channel: {
            id: 'channel-123',
            name: 'general',
          },
          timestamp: new Date().toISOString(),
        },
      };
    case 'schedule':
      return {
        schedule: {
          time: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
        },
      };
    case 'user_join':
      return {
        user: {
          id: 'user-123',
          name: 'New User',
          email: 'newuser@example.com',
        },
      };
    case 'channel_join':
      return {
        user: {
          id: 'user-123',
          name: 'Test User',
        },
        channel: {
          id: 'channel-123',
          name: 'general',
        },
      };
    case 'reaction':
      return {
        reaction: {
          emoji: '👍',
          user: {
            name: 'Test User',
          },
          message: {
            id: 'message-123',
          },
        },
      };
    case 'webhook':
      return {
        webhook: {
          body: { data: 'test payload' },
          headers: { 'content-type': 'application/json' },
        },
      };
    default:
      return {};
  }
}

function replaceVariables(
  template: string,
  triggerData: Record<string, unknown>,
  variables: Record<string, unknown>,
): string {
  let result = template;
  const allData = { trigger: triggerData, ...variables };

  // Replace {{variable}} patterns
  const regex = /\{\{([^}]+)\}\}/g;
  result = result.replace(regex, (match, path) => {
    const value = getNestedValue(allData, path.trim());
    return value !== undefined ? String(value) : match;
  });

  return result;
}

function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split('.').reduce((current: any, key) => current?.[key], obj);
}

function evaluateCondition(
  condition: { field: string; operator: string; value: string },
  triggerData: Record<string, unknown>,
  variables: Record<string, unknown>,
): boolean {
  const allData = { trigger: triggerData, ...variables };
  const fieldValue = getNestedValue(allData, condition.field);

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === condition.value;
    case 'contains':
      return String(fieldValue).includes(condition.value);
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return false;
  }
}

// Icons

function BugIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='m8 2 1.88 1.88' />
      <path d='M14.12 3.88 16 2' />
      <path d='M9 7.13v-1a3.003 3.003 0 1 1 6 0v1' />
      <path d='M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6' />
      <path d='M12 20v-9' />
      <path d='M6.53 9C4.6 8.8 3 7.1 3 5' />
      <path d='M6 13H2' />
      <path d='M3 21c0-2.1 1.7-3.9 3.8-4' />
      <path d='M20.97 5c0 2.1-1.6 3.8-3.5 4' />
      <path d='M22 13h-4' />
      <path d='M17.2 17c2.1.1 3.8 1.9 3.8 4' />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polygon points='5 3 19 12 5 21 5 3' />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect x='6' y='4' width='4' height='16' />
      <rect x='14' y='4' width='4' height='16' />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect x='5' y='5' width='14' height='14' rx='2' />
    </svg>
  );
}

function StepForwardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <polygon points='5 4 15 12 5 20 5 4' />
      <line x1='19' y1='5' x2='19' y2='19' />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M21 2v6h-6' />
      <path d='M3 12a9 9 0 0 1 15-6.7L21 8' />
      <path d='M3 22v-6h6' />
      <path d='M21 12a9 9 0 0 1-15 6.7L3 16' />
    </svg>
  );
}

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z' />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M20 6 9 17l-5-5' />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M18 6 6 18' />
      <path d='m6 6 12 12' />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns='http://www.w3.org/2000/svg'
      fill='none'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <circle
        className='opacity-25'
        cx='12'
        cy='12'
        r='10'
        stroke='currentColor'
        strokeWidth='4'
      />
      <path
        className='opacity-75'
        fill='currentColor'
        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
      />
    </svg>
  );
}
