/**
 * React Hook: useLLMChat
 *
 * Client-side hook for interacting with LLM chat API
 */

import { useState, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
}

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens?: number;
  provider: string;
  model: string;
  cost: number;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse<T = string> {
  data: T;
  usage: LLMUsage;
}

/**
 * Hook for simple chat completions
 */
export function useLLMChat() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<LLMUsage | null>(null);

  const chat = useCallback(
    async (prompt: string, options?: ChatOptions): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            responseFormat: 'text',
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to generate chat completion'
          );
        }

        const result: { success: boolean; data: string; usage: LLMUsage } =
          await response.json();

        setLastUsage(result.usage);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const chatJSON = useCallback(
    async <T = any>(
      prompt: string,
      options?: ChatOptions
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            responseFormat: 'json',
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to generate chat completion'
          );
        }

        const result: { success: boolean; data: T; usage: LLMUsage } =
          await response.json();

        setLastUsage(result.usage);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const chatStructured = useCallback(
    async <T = any>(
      prompt: string,
      schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
      },
      options?: ChatOptions
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            responseFormat: 'json',
            schema,
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to generate chat completion'
          );
        }

        const result: { success: boolean; data: T; usage: LLMUsage } =
          await response.json();

        setLastUsage(result.usage);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const chatWithHistory = useCallback(
    async (
      messages: ChatMessage[],
      options?: ChatOptions
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/llm/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            responseFormat: 'text',
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to generate chat completion'
          );
        }

        const result: { success: boolean; data: string; usage: LLMUsage } =
          await response.json();

        setLastUsage(result.usage);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    chat,
    chatJSON,
    chatStructured,
    chatWithHistory,
    loading,
    error,
    lastUsage,
  };
}

/**
 * Hook for image analysis
 */
export function useLLMImageAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<LLMUsage | null>(null);

  const analyzeImage = useCallback(
    async (
      imageBase64: string,
      prompt?: string,
      options?: ChatOptions & { detail?: 'low' | 'high' | 'auto' }
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/llm/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64,
            prompt,
            detail: options?.detail,
            options,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze image');
        }

        const result: { success: boolean; data: string; usage: LLMUsage } =
          await response.json();

        setLastUsage(result.usage);
        return result.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    analyzeImage,
    loading,
    error,
    lastUsage,
  };
}
