'use client';

import * as React from 'react';

import type {
  ChatMessage,
  EntitySpec,
  EntityType,
  WorkspaceContext,
} from '../types';

/**
 * Props for useConversationalCreation hook
 */
interface UseConversationalCreationProps {
  entityType: EntityType;
  workspaceId?: string;
  existingSpec?: EntitySpec;
  onSpecGenerated?: (spec: EntitySpec) => void;
}

/**
 * Hook for managing conversational entity creation
 *
 * Handles:
 * - Sending messages to LLM API
 * - Managing loading and error states
 * - Tracking generated spec
 * - Streaming responses
 */
export function useConversationalCreation({
  entityType,
  workspaceId,
  existingSpec,
  onSpecGenerated,
}: UseConversationalCreationProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generatedSpec, setGeneratedSpec] = React.useState<EntitySpec | null>(
    existingSpec || null
  );
  const [workspaceContext, setWorkspaceContext] =
    React.useState<WorkspaceContext | null>(null);

  // Fetch workspace context on mount
  React.useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceContext(workspaceId);
    }
  }, [workspaceId]);

  const fetchWorkspaceContext = async (id: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${id}/creation-context`
      );
      if (response.ok) {
        const data = await response.json();
        setWorkspaceContext(data);
      }
    } catch (err) {
      console.error('Failed to fetch workspace context:', err);
    }
  };

  const sendMessage = async (
    userMessage: string,
    conversationHistory: ChatMessage[]
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/creation/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          messages: [
            ...conversationHistory,
            {
              id: `user-${Date.now()}`,
              role: 'user',
              content: userMessage,
              timestamp: new Date(),
            },
          ],
          workspaceContext,
          existingSpec: generatedSpec,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if spec was generated
      if (data.spec) {
        setGeneratedSpec(data.spec);
        if (onSpecGenerated) {
          onSpecGenerated(data.spec);
        }
      }

      return data.message;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  const resetConversation = () => {
    setGeneratedSpec(null);
    setError(null);
  };

  return {
    sendMessage,
    isLoading,
    error,
    clearError,
    generatedSpec,
    hasGeneratedSpec: generatedSpec !== null,
    workspaceContext,
    resetConversation,
  };
}
