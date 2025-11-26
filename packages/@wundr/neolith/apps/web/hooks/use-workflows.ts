'use client';

/**
 * @neolith/hooks/use-workflows - Workflow Management Hooks
 *
 * Provides hooks for creating, managing, and executing automated workflows.
 * Includes support for workflow templates and a visual workflow builder.
 *
 * @packageDocumentation
 * @module @neolith/hooks/use-workflows
 *
 * @example
 * ```typescript
 * // List and create workflows
 * const { workflows, createWorkflow } = useWorkflows(workspaceId);
 *
 * // Manage a single workflow
 * const { workflow, activateWorkflow, executeWorkflow } = useWorkflow(workflowId);
 *
 * // View execution history
 * const { executions, cancelExecution } = useWorkflowExecutions(workflowId);
 *
 * // Use workflow templates
 * const { templates, createFromTemplate } = useWorkflowTemplates();
 *
 * // Build workflows visually
 * const { trigger, actions, validate, getWorkflowData } = useWorkflowBuilder();
 * ```
 */

import { useCallback, useEffect, useState, useMemo, useReducer } from 'react';

import type {
  Workflow,
  WorkflowStatus,
  WorkflowExecution,
  ExecutionStatus,
  WorkflowTemplate,
  WorkflowTemplateCategory,
  TriggerConfig,
  ActionConfig,
  WorkflowVariable,
  CreateWorkflowInput,
  UpdateWorkflowInput,
} from '@/types/workflow';

// =============================================================================
// useWorkflows - Fetch and manage list of workflows
// =============================================================================

/**
 * Options for the useWorkflows hook
 */
export interface UseWorkflowsOptions {
  /** Filter by workflow status */
  status?: WorkflowStatus | 'all';
  /** Filter by trigger type */
  triggerType?: string;
}

/**
 * Return type for the useWorkflows hook
 */
export interface UseWorkflowsReturn {
  /** List of workflows */
  workflows: Workflow[];
  /** Whether workflows are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Total count of workflows */
  totalCount: number;
  /** Count of filtered workflows */
  filteredCount: number;
  /** Create a new workflow */
  createWorkflow: (input: CreateWorkflowInput) => Promise<Workflow | null>;
  /** Refetch workflows */
  mutate: () => void;
}

/**
 * Hook for fetching and managing workflows in a workspace.
 *
 * Provides a list of workflows with filtering capabilities and
 * a method to create new workflows.
 *
 * @param workspaceId - The workspace ID to fetch workflows for
 * @param options - Optional filtering options
 * @returns Workflow list and management methods
 *
 * @example
 * ```typescript
 * const {
 *   workflows,
 *   isLoading,
 *   totalCount,
 *   filteredCount,
 *   createWorkflow,
 *   mutate
 * } = useWorkflows(workspaceId, { status: 'active' });
 *
 * // Create a new workflow
 * const workflow = await createWorkflow({
 *   name: 'Welcome Message',
 *   trigger: { type: 'user.joined', config: {} },
 *   actions: [{ type: 'message.send', config: { content: 'Welcome!' } }]
 * });
 * ```
 */
export function useWorkflows(
  workspaceId: string,
  options?: UseWorkflowsOptions,
): UseWorkflowsReturn {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    if (!workspaceId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.status && options.status !== 'all') {
        params.set('status', options.status);
      }
      if (options?.triggerType) {
        params.set('triggerType', options.triggerType);
      }

      const url = `/api/workspaces/${workspaceId}/workflows?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      setWorkflows(
        data.workflows.map((w: Workflow) => ({
          ...w,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, options?.status, options?.triggerType]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const filteredWorkflows = useMemo(() => {
    let result = [...workflows];
    if (options?.status && options.status !== 'all') {
      result = result.filter((w) => w.status === options.status);
    }
    return result;
  }, [workflows, options?.status]);

  const createWorkflow = useCallback(
    async (input: CreateWorkflowInput): Promise<Workflow | null> => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to create workflow');
        }

        const data = await response.json();
        // API returns { workflow, message }
        setWorkflows((prev) => [data.workflow, ...prev]);
        return data.workflow;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workspaceId],
  );

  return {
    workflows: filteredWorkflows,
    isLoading,
    error,
    totalCount: workflows.length,
    filteredCount: filteredWorkflows.length,
    createWorkflow,
    mutate: fetchWorkflows,
  };
}

// =============================================================================
// useWorkflow - Fetch and manage single workflow
// =============================================================================

/**
 * Return type for the useWorkflow hook
 */
export interface UseWorkflowReturn {
  /** The workflow or null if not found */
  workflow: Workflow | null;
  /** Whether the workflow is loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Update the workflow */
  updateWorkflow: (input: UpdateWorkflowInput) => Promise<Workflow | null>;
  /** Delete the workflow */
  deleteWorkflow: () => Promise<boolean>;
  /** Activate the workflow */
  activateWorkflow: () => Promise<boolean>;
  /** Deactivate the workflow */
  deactivateWorkflow: () => Promise<boolean>;
  /** Execute the workflow */
  executeWorkflow: (testMode?: boolean) => Promise<WorkflowExecution | null>;
  /** Test the workflow */
  testWorkflow: () => Promise<WorkflowExecution | null>;
  /** Refetch the workflow data */
  refetch: () => void;
}

/**
 * Hook for managing a single workflow.
 *
 * Provides methods to update, delete, activate, deactivate,
 * and execute a workflow.
 *
 * @param workspaceId - The workspace ID containing the workflow
 * @param workflowId - The workflow ID to manage
 * @returns Workflow data and management methods
 *
 * @example
 * ```typescript
 * const {
 *   workflow,
 *   isLoading,
 *   updateWorkflow,
 *   deleteWorkflow,
 *   activateWorkflow,
 *   deactivateWorkflow,
 *   executeWorkflow,
 *   testWorkflow
 * } = useWorkflow(workspaceId, workflowId);
 *
 * // Activate the workflow
 * await activateWorkflow();
 *
 * // Execute with test mode
 * const execution = await testWorkflow();
 * ```
 */
export function useWorkflow(workspaceId: string, workflowId: string): UseWorkflowReturn {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!workspaceId || !workflowId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Workflow not found');
        }
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      // API returns { workflow, executions, statistics }
      setWorkflow({
        ...data.workflow,
        createdAt: data.workflow.createdAt,
        updatedAt: data.workflow.updatedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const updateWorkflow = useCallback(
    async (input: UpdateWorkflowInput): Promise<Workflow | null> => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to update workflow');
        }

        const data = await response.json();
        // API returns { workflow, message }
        setWorkflow(data.workflow);
        return data.workflow;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workspaceId, workflowId],
  );

  const deleteWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      // API archives the workflow (soft delete)
      setWorkflow(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workspaceId, workflowId]);

  const activateWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to activate workflow');
      }

      const data = await response.json();
      // API returns { workflow, message }
      setWorkflow(data.workflow);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workspaceId, workflowId]);

  const deactivateWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}/deactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate workflow');
      }

      const data = await response.json();
      // API returns { workflow, message }
      setWorkflow(data.workflow);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workspaceId, workflowId]);

  const executeWorkflow = useCallback(
    async (testMode = false): Promise<WorkflowExecution | null> => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/workflows/${workflowId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testMode }),
        });

        if (!response.ok) {
          throw new Error('Failed to execute workflow');
        }

        const data = await response.json();
        // API returns { execution }
        return data.execution;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workspaceId, workflowId],
  );

  const testWorkflow = useCallback(async (): Promise<WorkflowExecution | null> => {
    return executeWorkflow(true);
  }, [executeWorkflow]);

  return {
    workflow,
    isLoading,
    error,
    updateWorkflow,
    deleteWorkflow,
    activateWorkflow,
    deactivateWorkflow,
    executeWorkflow,
    testWorkflow,
    refetch: fetchWorkflow,
  };
}

// =============================================================================
// useWorkflowExecutions - Fetch workflow execution history
// =============================================================================

/**
 * Options for the useWorkflowExecutions hook
 */
export interface UseWorkflowExecutionsOptions {
  /** Filter by execution status */
  status?: ExecutionStatus;
  /** Maximum number of executions to fetch */
  limit?: number;
}

/**
 * Return type for the useWorkflowExecutions hook
 */
export interface UseWorkflowExecutionsReturn {
  /** List of workflow executions */
  executions: WorkflowExecution[];
  /** Whether executions are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Whether there are more executions to load */
  hasMore: boolean;
  /** Load more executions */
  loadMore: () => void;
  /** Cancel an execution */
  cancelExecution: (executionId: string) => Promise<boolean>;
  /** Refetch the executions */
  refetch: () => void;
}

/**
 * Hook for fetching workflow execution history.
 *
 * Provides paginated execution logs with filtering and
 * the ability to cancel running executions.
 *
 * @param workspaceId - The workspace ID containing the workflow
 * @param workflowId - The workflow ID to fetch executions for
 * @param options - Optional filtering and pagination options
 * @returns Execution list and management methods
 *
 * @example
 * ```typescript
 * const {
 *   executions,
 *   isLoading,
 *   hasMore,
 *   loadMore,
 *   cancelExecution,
 *   refetch
 * } = useWorkflowExecutions(workspaceId, workflowId, { status: 'running', limit: 20 });
 *
 * // Cancel a running execution
 * await cancelExecution(executionId);
 *
 * // Load more executions
 * if (hasMore) loadMore();
 * ```
 */
export function useWorkflowExecutions(
  workspaceId: string,
  workflowId: string,
  options?: UseWorkflowExecutionsOptions,
): UseWorkflowExecutionsReturn {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchExecutions = useCallback(
    async (loadMore = false) => {
      if (!workspaceId || !workflowId) {
return;
}

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.status) {
params.set('status', options.status);
}
        const limit = options?.limit ?? 20;
        params.set('limit', String(limit));

        const currentOffset = loadMore ? offset : 0;
        params.set('offset', String(currentOffset));

        const url = `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch executions');
        }

        const data = await response.json();
        // API returns { executions, total }
        const newExecutions = data.executions.map((e: WorkflowExecution) => ({
          ...e,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
        }));

        if (loadMore) {
          setExecutions((prev) => [...prev, ...newExecutions]);
          setOffset(currentOffset + newExecutions.length);
        } else {
          setExecutions(newExecutions);
          setOffset(newExecutions.length);
        }

        setHasMore((loadMore ? offset + newExecutions.length : newExecutions.length) < data.total);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, workflowId, options?.status, options?.limit, offset],
  );

  useEffect(() => {
    setOffset(0);
    fetchExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workflowId, options?.status, options?.limit]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchExecutions(true);
    }
  }, [hasMore, isLoading, fetchExecutions]);

  const cancelExecution = useCallback(
    async (executionId: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/workflows/${workflowId}/executions/${executionId}/cancel`,
          { method: 'POST' },
        );

        if (!response.ok) {
          throw new Error('Failed to cancel execution');
        }

        setExecutions((prev) =>
          prev.map((e) =>
            e.id === executionId ? { ...e, status: 'cancelled' as ExecutionStatus } : e,
          ),
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return false;
      }
    },
    [workspaceId, workflowId],
  );

  return {
    executions,
    isLoading,
    error,
    hasMore,
    loadMore,
    cancelExecution,
    refetch: () => fetchExecutions(false),
  };
}

// =============================================================================
// useWorkflowTemplates - Fetch workflow templates
// =============================================================================

/**
 * Return type for the useWorkflowTemplates hook
 */
export interface UseWorkflowTemplatesReturn {
  /** List of workflow templates */
  templates: WorkflowTemplate[];
  /** Whether templates are loading */
  isLoading: boolean;
  /** Error that occurred during fetch */
  error: Error | null;
  /** Create a workflow from a template */
  createFromTemplate: (
    templateId: string,
    workspaceId: string,
    overrides?: Partial<CreateWorkflowInput>
  ) => Promise<Workflow | null>;
}

/**
 * Hook for fetching workflow templates.
 *
 * Provides pre-built workflow templates that can be used as
 * starting points for new workflows.
 *
 * @param category - Optional category to filter templates
 * @returns Template list and creation method
 *
 * @example
 * ```typescript
 * const {
 *   templates,
 *   isLoading,
 *   createFromTemplate
 * } = useWorkflowTemplates('notifications');
 *
 * // Create a workflow from a template
 * const workflow = await createFromTemplate(
 *   templateId,
 *   workspaceId,
 *   { name: 'My Custom Workflow' }
 * );
 * ```
 */
export function useWorkflowTemplates(
  category?: WorkflowTemplateCategory,
): UseWorkflowTemplatesReturn {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (category) {
params.set('category', category);
}

      const url = `/api/workflow-templates?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createFromTemplate = useCallback(
    async (
      templateId: string,
      workspaceId: string,
      overrides?: Partial<CreateWorkflowInput>,
    ): Promise<Workflow | null> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/workflows/from-template`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId, ...overrides }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to create workflow from template');
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [],
  );

  return {
    templates,
    isLoading,
    error,
    createFromTemplate,
  };
}

// =============================================================================
// useWorkflowBuilder - Manage workflow builder state
// =============================================================================

/**
 * Internal state for the workflow builder.
 * @internal
 */
interface BuilderState {
  /** Current trigger configuration */
  trigger: TriggerConfig | null;
  /** List of action configurations in order */
  actions: ActionConfig[];
  /** List of workflow variables */
  variables: WorkflowVariable[];
  /** Validation errors by field name */
  errors: Record<string, string>;
}

/**
 * Action types for the workflow builder reducer.
 * @internal
 */
type BuilderAction =
  | { type: 'SET_TRIGGER'; payload: TriggerConfig }
  | { type: 'ADD_ACTION'; payload: Omit<ActionConfig, 'id' | 'order'> }
  | { type: 'UPDATE_ACTION'; payload: { id: string; config: Partial<ActionConfig> } }
  | { type: 'REMOVE_ACTION'; payload: string }
  | { type: 'REORDER_ACTIONS'; payload: ActionConfig[] }
  | { type: 'ADD_VARIABLE'; payload: WorkflowVariable }
  | { type: 'REMOVE_VARIABLE'; payload: string }
  | { type: 'SET_ERRORS'; payload: Record<string, string> }
  | { type: 'RESET'; payload?: Partial<Workflow> };

/**
 * Reducer function for the workflow builder state.
 * @internal
 */
function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_TRIGGER':
      return { ...state, trigger: action.payload };
    case 'ADD_ACTION': {
      const newAction: ActionConfig = {
        ...action.payload,
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        order: state.actions.length,
      };
      return { ...state, actions: [...state.actions, newAction] };
    }
    case 'UPDATE_ACTION':
      return {
        ...state,
        actions: state.actions.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload.config } : a,
        ),
      };
    case 'REMOVE_ACTION':
      return {
        ...state,
        actions: state.actions
          .filter((a) => a.id !== action.payload)
          .map((a, index) => ({ ...a, order: index })),
      };
    case 'REORDER_ACTIONS':
      return { ...state, actions: action.payload };
    case 'ADD_VARIABLE':
      return { ...state, variables: [...state.variables, action.payload] };
    case 'REMOVE_VARIABLE':
      return {
        ...state,
        variables: state.variables.filter((v) => v.name !== action.payload),
      };
    case 'SET_ERRORS':
      return { ...state, errors: action.payload };
    case 'RESET':
      return {
        trigger: action.payload?.trigger ?? null,
        actions: action.payload?.actions ?? [],
        variables: action.payload?.variables ?? [],
        errors: {},
      };
    default:
      return state;
  }
}

/**
 * Return type for the useWorkflowBuilder hook
 */
export interface UseWorkflowBuilderReturn {
  /** Current trigger configuration */
  trigger: TriggerConfig | null;
  /** List of action configurations */
  actions: ActionConfig[];
  /** List of workflow variables */
  variables: WorkflowVariable[];
  /** Validation errors */
  errors: Record<string, string>;
  /** Set the trigger configuration */
  setTrigger: (trigger: TriggerConfig) => void;
  /** Add an action to the workflow */
  addAction: (action: Omit<ActionConfig, 'id' | 'order'>) => void;
  /** Update an action configuration */
  updateAction: (id: string, config: Partial<ActionConfig>) => void;
  /** Remove an action from the workflow */
  removeAction: (id: string) => void;
  /** Reorder actions in the workflow */
  reorderActions: (actions: ActionConfig[]) => void;
  /** Add a variable to the workflow */
  addVariable: (variable: WorkflowVariable) => void;
  /** Remove a variable from the workflow */
  removeVariable: (name: string) => void;
  /** Validate the workflow configuration */
  validate: () => boolean;
  /** Get the workflow data for submission */
  getWorkflowData: () => CreateWorkflowInput | null;
  /** Reset the builder state */
  reset: (initialWorkflow?: Partial<Workflow>) => void;
}

/**
 * Hook for building workflows with a visual interface.
 *
 * Provides state management for workflow triggers, actions, and variables
 * with validation and data extraction for submission.
 *
 * @param initialWorkflow - Optional initial workflow to populate the builder
 * @returns Builder state and manipulation methods
 *
 * @example
 * ```typescript
 * const {
 *   trigger,
 *   actions,
 *   variables,
 *   errors,
 *   setTrigger,
 *   addAction,
 *   updateAction,
 *   removeAction,
 *   reorderActions,
 *   addVariable,
 *   removeVariable,
 *   validate,
 *   getWorkflowData,
 *   reset
 * } = useWorkflowBuilder();
 *
 * // Set a trigger
 * setTrigger({ type: 'message.created', config: { channelId: '123' } });
 *
 * // Add an action
 * addAction({ type: 'message.send', config: { content: 'Auto-reply' } });
 *
 * // Validate and get workflow data
 * if (validate()) {
 *   const workflowData = getWorkflowData();
 *   // Submit workflowData to API
 * }
 * ```
 */
export function useWorkflowBuilder(
  initialWorkflow?: Partial<Workflow>,
): UseWorkflowBuilderReturn {
  const [state, dispatch] = useReducer(builderReducer, {
    trigger: initialWorkflow?.trigger ?? null,
    actions: initialWorkflow?.actions ?? [],
    variables: initialWorkflow?.variables ?? [],
    errors: {},
  });

  const setTrigger = useCallback((trigger: TriggerConfig) => {
    dispatch({ type: 'SET_TRIGGER', payload: trigger });
  }, []);

  const addAction = useCallback((action: Omit<ActionConfig, 'id' | 'order'>) => {
    dispatch({ type: 'ADD_ACTION', payload: action });
  }, []);

  const updateAction = useCallback((id: string, config: Partial<ActionConfig>) => {
    dispatch({ type: 'UPDATE_ACTION', payload: { id, config } });
  }, []);

  const removeAction = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ACTION', payload: id });
  }, []);

  const reorderActions = useCallback((actions: ActionConfig[]) => {
    dispatch({ type: 'REORDER_ACTIONS', payload: actions });
  }, []);

  const addVariable = useCallback((variable: WorkflowVariable) => {
    dispatch({ type: 'ADD_VARIABLE', payload: variable });
  }, []);

  const removeVariable = useCallback((name: string) => {
    dispatch({ type: 'REMOVE_VARIABLE', payload: name });
  }, []);

  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!state.trigger) {
      errors.trigger = 'A trigger is required';
    }

    if (state.actions.length === 0) {
      errors.actions = 'At least one action is required';
    }

    dispatch({ type: 'SET_ERRORS', payload: errors });
    return Object.keys(errors).length === 0;
  }, [state.trigger, state.actions]);

  const getWorkflowData = useCallback((): CreateWorkflowInput | null => {
    if (!validate()) {
return null;
}
    if (!state.trigger) {
return null;
}

    return {
      name: '',
      trigger: state.trigger,
      actions: state.actions.map(({ id: _id, ...rest }) => rest),
      variables: state.variables.map(({ source: _source, ...rest }) => rest),
    };
  }, [validate, state.trigger, state.actions, state.variables]);

  const reset = useCallback((initialData?: Partial<Workflow>) => {
    dispatch({ type: 'RESET', payload: initialData });
  }, []);

  return {
    trigger: state.trigger,
    actions: state.actions,
    variables: state.variables,
    errors: state.errors,
    setTrigger,
    addAction,
    updateAction,
    removeAction,
    reorderActions,
    addVariable,
    removeVariable,
    validate,
    getWorkflowData,
    reset,
  };
}
