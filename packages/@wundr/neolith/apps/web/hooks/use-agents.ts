'use client';

/**
 * @neolith/hooks/use-agents - Agent Management Hooks
 *
 * Provides hooks for creating, managing, and monitoring AI agents.
 * Agents are specialized worker agents for task automation.
 *
 * @packageDocumentation
 * @module @neolith/hooks/use-agents
 */

import { useCallback, useEffect, useState, useMemo } from 'react';

import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentFilters,
} from '@/types/agent';

// =============================================================================
// Types
// =============================================================================

/**
 * Return type for the useAgents hook
 */
export interface UseAgentsReturn {
  /** Filtered list of agents */
  agents: Agent[];
  /** Complete list of agents (unfiltered) */
  allAgents: Agent[];
  /** Whether agents are currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the agents */
  refetch: () => void;
  /** Total count of agents */
  totalCount: number;
  /** Count of agents after filtering */
  filteredCount: number;
}

/**
 * Return type for the useAgent hook
 */
export interface UseAgentReturn {
  /** The agent data, or null if not loaded */
  agent: Agent | null;
  /** Whether the agent is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the agent data */
  refetch: () => void;
}

/**
 * Return type for the useAgentMutations hook
 */
export interface UseAgentMutationsReturn {
  /** Create a new agent */
  createAgent: (input: CreateAgentInput) => Promise<Agent | null>;
  /** Update an existing agent */
  updateAgent: (id: string, input: UpdateAgentInput) => Promise<Agent | null>;
  /** Delete an agent */
  deleteAgent: (id: string) => Promise<boolean>;
  /** Pause an agent */
  pauseAgent: (id: string) => Promise<Agent | null>;
  /** Resume an agent */
  resumeAgent: (id: string) => Promise<Agent | null>;
  /** Whether a mutation is in progress */
  isLoading: boolean;
  /** Error object if mutation failed */
  error: Error | null;
}

// =============================================================================
// useAgents Hook
// =============================================================================

/**
 * Hook for fetching a list of agents with filtering
 *
 * Fetches agents for a workspace with optional filtering by type,
 * status, and search query.
 *
 * @param workspaceId - The workspace ID to fetch agents for
 * @param filters - Optional filters to apply
 * @returns Agents list, loading state, and counts
 *
 * @example
 * ```tsx
 * function AgentList() {
 *   const { agents, isLoading, totalCount, filteredCount } = useAgents(
 *     'ws-123',
 *     { status: 'active', type: 'coding' }
 *   );
 *
 *   return (
 *     <div>
 *       <p>Showing {filteredCount} of {totalCount} agents</p>
 *       {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgents(
  workspaceId: string,
  filters?: AgentFilters
): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!workspaceId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build query params
        const params = new URLSearchParams();
        if (filters?.type) {
          params.set('type', filters.type);
        }
        if (filters?.status) {
          params.set('status', filters.status);
        }
        if (filters?.search) {
          params.set('search', filters.search);
        }
        if (filters?.page !== undefined) {
          params.set('page', String(filters.page));
        }
        if (filters?.limit !== undefined) {
          params.set('limit', String(filters.limit));
        }

        const queryString = params.toString();
        const url = queryString
          ? `/api/workspaces/${workspaceId}/agents?${queryString}`
          : `/api/workspaces/${workspaceId}/agents`;

        const response = await fetch(url, { signal });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to fetch agents');
        }
        const result: { data: Agent[] } = await response.json();

        setAgents(result.data || []);
      } catch (err) {
        // Don't set error for aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setAgents([]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      workspaceId,
      filters?.type,
      filters?.status,
      filters?.search,
      filters?.page,
      filters?.limit,
    ]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchAgents(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchAgents]);

  const refetch = useCallback(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Filter agents locally for immediate feedback
  const filteredAgents = useMemo(() => {
    let result = [...agents];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        agent =>
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description?.toLowerCase().includes(searchLower) ||
          agent.type?.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.type) {
      result = result.filter(agent => agent.type === filters.type);
    }

    if (filters?.status) {
      result = result.filter(agent => agent.status === filters.status);
    }

    return result;
  }, [agents, filters]);

  return {
    agents: filteredAgents,
    allAgents: agents,
    isLoading,
    error,
    refetch,
    totalCount: agents.length,
    filteredCount: filteredAgents.length,
  };
}

// =============================================================================
// useAgent Hook
// =============================================================================

/**
 * Hook for fetching and managing a single agent
 *
 * Fetches agent data by ID and provides a refetch capability.
 *
 * @param workspaceId - The workspace ID containing the agent
 * @param agentId - The agent ID to fetch
 * @returns Agent data and loading state
 *
 * @example
 * ```tsx
 * function AgentProfile({ agentId }: { agentId: string }) {
 *   const { agent, isLoading, error, refetch } = useAgent('ws-123', agentId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h1>{agent?.name}</h1>
 *       <p>{agent?.description}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgent(workspaceId: string, agentId: string): UseAgentReturn {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAgent = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!workspaceId || !agentId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/agents/${agentId}`,
          { signal }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to fetch agent');
        }
        const result: { data: Agent } = await response.json();
        setAgent(result.data);
      } catch (err) {
        // Don't set error for aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setAgent(null);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, agentId]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchAgent(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchAgent]);

  const refetch = useCallback((): void => {
    fetchAgent();
  }, [fetchAgent]);

  return {
    agent,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// useAgentMutations Hook
// =============================================================================

/**
 * Hook for agent mutations (create, update, delete)
 *
 * Provides CRUD operations and additional actions for managing agents.
 *
 * @param workspaceId - The workspace ID for the agents
 * @returns Mutation functions and loading state
 *
 * @example
 * ```tsx
 * function AgentManager() {
 *   const { createAgent, updateAgent, deleteAgent, pauseAgent, isLoading } = useAgentMutations('ws-123');
 *
 *   const handleCreate = async () => {
 *     const newAgent = await createAgent({
 *       name: 'Code Reviewer',
 *       type: 'coding',
 *       systemPrompt: 'Review code for best practices...'
 *     });
 *     if (newAgent) {
 *       console.log('Created agent:', newAgent.id);
 *     }
 *   };
 *
 *   return <button onClick={handleCreate} disabled={isLoading}>Create Agent</button>;
 * }
 * ```
 */
export function useAgentMutations(
  workspaceId: string
): UseAgentMutationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createAgent = useCallback(
    async (input: CreateAgentInput): Promise<Agent | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to create agent');
        }

        const result: { data: Agent } = await response.json();
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  const updateAgent = useCallback(
    async (id: string, input: UpdateAgentInput): Promise<Agent | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/agents/${id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to update agent');
        }

        const result: { data: Agent } = await response.json();
        return result.data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  const deleteAgent = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/agents/${id}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to delete agent');
        }

        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId]
  );

  const pauseAgent = useCallback(
    async (id: string): Promise<Agent | null> => {
      return updateAgent(id, { status: 'paused' });
    },
    [updateAgent]
  );

  const resumeAgent = useCallback(
    async (id: string): Promise<Agent | null> => {
      return updateAgent(id, { status: 'active' });
    },
    [updateAgent]
  );

  return {
    createAgent,
    updateAgent,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    isLoading,
    error,
  };
}
