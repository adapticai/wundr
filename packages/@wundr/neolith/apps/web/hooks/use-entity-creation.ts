'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { getEntityDisplayName } from '@/lib/ai/types';

import type { EntityType } from '@/lib/ai/types';

/**
 * Entity creation data types based on Prisma schema
 */
export interface WorkspaceEntityData {
  name: string;
  description: string;
  organizationType?: string;
  teamSize?: 'small' | 'medium' | 'large';
  purpose?: string;
}

export interface OrchestratorEntityData {
  workspaceId: string;
  name: string;
  role: string;
  description: string;
  capabilities?: string[];
  communicationStyle?: string;
}

export interface SessionManagerEntityData {
  name: string;
  responsibilities: string;
  parentOrchestrator?: string;
  context?: string;
  channels?: string[];
  escalationCriteria?: string[];
  workspaceSlug?: string;
  workspaceId?: string;
}

export interface WorkflowEntityData {
  workspaceId: string;
  name: string;
  description: string;
  trigger: {
    type: 'schedule' | 'event' | 'manual' | 'webhook';
    config?: Record<string, unknown>;
  };
  actions: Array<{
    action: string;
    description: string;
  }>;
}

export interface ChannelEntityData {
  workspaceId: string;
  name: string;
  description?: string;
  type?: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
}

export interface SubagentEntityData {
  name: string;
  description?: string;
  sessionManagerId?: string;
  capabilities?: string[];
  isGlobal?: boolean;
}

/**
 * Map entity types to their data interfaces
 */
export type EntityDataMap = {
  workspace: WorkspaceEntityData;
  orchestrator: OrchestratorEntityData;
  'session-manager': SessionManagerEntityData;
  workflow: WorkflowEntityData;
  channel: ChannelEntityData;
  subagent: SubagentEntityData;
};

/**
 * Created entity response types
 */
export interface CreatedWorkspace {
  id: string;
  name: string;
  type: 'workspace';
  slug: string;
}

export interface CreatedOrchestrator {
  id: string;
  name: string;
  type: 'orchestrator';
  role: string;
}

export interface CreatedSessionManager {
  id: string;
  name: string;
  type: 'session-manager';
}

export interface CreatedWorkflow {
  id: string;
  name: string;
  type: 'workflow';
}

export interface CreatedChannel {
  id: string;
  name: string;
  type: 'channel';
  slug: string;
}

export interface CreatedSubagent {
  id: string;
  name: string;
  type: 'subagent';
}

/**
 * Map entity types to their response interfaces
 */
export type CreatedEntityMap = {
  workspace: CreatedWorkspace;
  orchestrator: CreatedOrchestrator;
  'session-manager': CreatedSessionManager;
  workflow: CreatedWorkflow;
  channel: CreatedChannel;
  subagent: CreatedSubagent;
};

/**
 * API response structure
 */
export interface CreateEntityResponse<T extends EntityType> {
  data: CreatedEntityMap[T];
  timestamp: string;
}

/**
 * API error response structure
 */
export interface CreateEntityError {
  error: {
    message: string;
    details?: unknown;
  };
}

/**
 * Hook options
 */
export interface UseEntityCreationOptions<T extends EntityType> {
  entityType: T;
  workspaceSlug?: string;
  redirectPath?: string | ((data: CreatedEntityMap[T]) => string);
  onSuccess?: (data: CreatedEntityMap[T]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return type
 */
export interface UseEntityCreationReturn<T extends EntityType> {
  createEntity: (data: EntityDataMap[T]) => Promise<CreatedEntityMap[T]>;
  isCreating: boolean;
  error: string | null;
  createdEntity: CreatedEntityMap[T] | null;
  reset: () => void;
}

/**
 * Custom hook for creating entities through the wizard API
 *
 * @template T - The entity type being created
 * @param options - Configuration options for entity creation
 * @returns Object with creation function and state
 *
 * @example
 * ```tsx
 * const { createEntity, isCreating, error } = useEntityCreation({
 *   entityType: 'workspace',
 *   redirectPath: (data) => `/workspaces/${data.slug}`,
 * });
 *
 * const handleSubmit = async (formData: WorkspaceEntityData) => {
 *   try {
 *     const workspace = await createEntity(formData);
 *     console.log('Created:', workspace);
 *   } catch (err) {
 *     console.error('Failed:', err);
 *   }
 * };
 * ```
 */
export function useEntityCreation<T extends EntityType>({
  entityType,
  workspaceSlug,
  redirectPath,
  onSuccess,
  onError,
}: UseEntityCreationOptions<T>): UseEntityCreationReturn<T> {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdEntity, setCreatedEntity] = React.useState<
    CreatedEntityMap[T] | null
  >(null);

  const createEntity = React.useCallback(
    async (data: EntityDataMap[T]): Promise<CreatedEntityMap[T]> => {
      setIsCreating(true);
      setError(null);

      try {
        // Prepare request payload
        const payload = workspaceSlug ? { ...data, workspaceSlug } : data;

        // Make API request
        const response = await fetch('/api/wizard/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType,
            data: payload,
          }),
        });

        // Handle error responses
        if (!response.ok) {
          const errorData: CreateEntityError = await response.json();
          throw new Error(errorData.error?.message || 'Creation failed');
        }

        // Parse success response
        const result: CreateEntityResponse<T> = await response.json();
        const createdData = result.data;

        setCreatedEntity(createdData);

        // Show success toast
        toast.success(
          `${getEntityDisplayName(entityType)} created successfully!`,
        );

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(createdData);
        }

        // Handle redirect if specified
        if (redirectPath) {
          const path =
            typeof redirectPath === 'function'
              ? redirectPath(createdData)
              : redirectPath;
          router.push(path);
        }

        return createdData;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Creation failed';
        setError(message);
        toast.error(message);

        // Call error callback if provided
        if (onError && err instanceof Error) {
          onError(err);
        }

        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [entityType, workspaceSlug, redirectPath, router, onSuccess, onError],
  );

  const reset = React.useCallback(() => {
    setIsCreating(false);
    setError(null);
    setCreatedEntity(null);
  }, []);

  return {
    createEntity,
    isCreating,
    error,
    createdEntity,
    reset,
  };
}
