'use client';

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

interface UseWorkflowsOptions {
  status?: WorkflowStatus | 'all';
  triggerType?: string;
}

interface UseWorkflowsReturn {
  workflows: Workflow[];
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  filteredCount: number;
  createWorkflow: (input: CreateWorkflowInput) => Promise<Workflow | null>;
  mutate: () => void;
}

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

        const workflow = await response.json();
        setWorkflows((prev) => [workflow, ...prev]);
        return workflow;
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

interface UseWorkflowReturn {
  workflow: Workflow | null;
  isLoading: boolean;
  error: Error | null;
  updateWorkflow: (input: UpdateWorkflowInput) => Promise<Workflow | null>;
  deleteWorkflow: () => Promise<boolean>;
  activateWorkflow: () => Promise<boolean>;
  deactivateWorkflow: () => Promise<boolean>;
  executeWorkflow: (testMode?: boolean) => Promise<WorkflowExecution | null>;
  testWorkflow: () => Promise<WorkflowExecution | null>;
  refetch: () => void;
}

export function useWorkflow(workflowId: string): UseWorkflowReturn {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Workflow not found');
        }
        throw new Error('Failed to fetch workflow');
      }

      const data = await response.json();
      setWorkflow({
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const updateWorkflow = useCallback(
    async (input: UpdateWorkflowInput): Promise<Workflow | null> => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to update workflow');
        }

        const updated = await response.json();
        setWorkflow(updated);
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workflowId],
  );

  const deleteWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      setWorkflow(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workflowId]);

  const activateWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/activate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to activate workflow');
      }

      const updated = await response.json();
      setWorkflow(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workflowId]);

  const deactivateWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/deactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate workflow');
      }

      const updated = await response.json();
      setWorkflow(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    }
  }, [workflowId]);

  const executeWorkflow = useCallback(
    async (testMode = false): Promise<WorkflowExecution | null> => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testMode }),
        });

        if (!response.ok) {
          throw new Error('Failed to execute workflow');
        }

        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      }
    },
    [workflowId],
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

interface UseWorkflowExecutionsOptions {
  status?: ExecutionStatus;
  limit?: number;
}

interface UseWorkflowExecutionsReturn {
  executions: WorkflowExecution[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  cancelExecution: (executionId: string) => Promise<boolean>;
  refetch: () => void;
}

export function useWorkflowExecutions(
  workflowId: string,
  options?: UseWorkflowExecutionsOptions,
): UseWorkflowExecutionsReturn {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchExecutions = useCallback(
    async (loadMore = false) => {
      if (!workflowId) {
return;
}

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.status) {
params.set('status', options.status);
}
        if (options?.limit) {
params.set('limit', String(options.limit));
}
        if (loadMore && cursor) {
params.set('cursor', cursor);
}

        const url = `/api/workflows/${workflowId}/executions?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch executions');
        }

        const data = await response.json();
        const newExecutions = data.executions.map((e: WorkflowExecution) => ({
          ...e,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
        }));

        if (loadMore) {
          setExecutions((prev) => [...prev, ...newExecutions]);
        } else {
          setExecutions(newExecutions);
        }
        setHasMore(data.hasMore ?? false);
        setCursor(data.nextCursor ?? null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [workflowId, options?.status, options?.limit, cursor],
  );

  useEffect(() => {
    fetchExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, options?.status, options?.limit]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchExecutions(true);
    }
  }, [hasMore, isLoading, fetchExecutions]);

  const cancelExecution = useCallback(
    async (executionId: string): Promise<boolean> => {
      try {
        const response = await fetch(
          `/api/workflows/${workflowId}/executions/${executionId}/cancel`,
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
    [workflowId],
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

interface UseWorkflowTemplatesReturn {
  templates: WorkflowTemplate[];
  isLoading: boolean;
  error: Error | null;
  createFromTemplate: (
    templateId: string,
    workspaceId: string,
    overrides?: Partial<CreateWorkflowInput>
  ) => Promise<Workflow | null>;
}

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

interface BuilderState {
  trigger: TriggerConfig | null;
  actions: ActionConfig[];
  variables: WorkflowVariable[];
  errors: Record<string, string>;
}

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

interface UseWorkflowBuilderReturn {
  trigger: TriggerConfig | null;
  actions: ActionConfig[];
  variables: WorkflowVariable[];
  errors: Record<string, string>;
  setTrigger: (trigger: TriggerConfig) => void;
  addAction: (action: Omit<ActionConfig, 'id' | 'order'>) => void;
  updateAction: (id: string, config: Partial<ActionConfig>) => void;
  removeAction: (id: string) => void;
  reorderActions: (actions: ActionConfig[]) => void;
  addVariable: (variable: WorkflowVariable) => void;
  removeVariable: (name: string) => void;
  validate: () => boolean;
  getWorkflowData: () => CreateWorkflowInput | null;
  reset: (initialWorkflow?: Partial<Workflow>) => void;
}

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
