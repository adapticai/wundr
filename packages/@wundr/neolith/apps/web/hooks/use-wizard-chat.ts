'use client';

import { useCallback, useRef, useState } from 'react';

import { useWizard } from '@/contexts/wizard-context';

import type { Message, ExtractedEntityData } from '@/contexts/wizard-context';

// API Response types
interface WizardChatResponse {
  message: string;
  extractedData?: Partial<ExtractedEntityData>;
  conversationId?: string;
  suggestions?: string[];
  confidence?: number;
  metadata?: {
    processingTime?: number;
    model?: string;
  };
}

interface WizardChatStreamChunk {
  type: 'content' | 'data' | 'done' | 'error';
  content?: string;
  data?: Partial<ExtractedEntityData>;
  error?: string;
}

interface UseWizardChatOptions {
  enableStreaming?: boolean;
  onChunkReceived?: (chunk: WizardChatStreamChunk) => void;
  onComplete?: (response: WizardChatResponse) => void;
  onError?: (error: Error) => void;
}

export function useWizardChat(options: UseWizardChatOptions = {}) {
  const {
    enableStreaming = false,
    onChunkReceived,
    onComplete,
    onError,
  } = options;

  const {
    state,
    setLoading,
    setError,
    updateExtractedData,
    setConversationId,
  } = useWizard();

  const [streamingContent, setStreamingContent] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Add assistant message to context
  const addAssistantMessage = useCallback(
    (content: string, metadata?: Message['metadata']) => {
      const message: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        metadata,
      };

      // Note: This would need to be added to the context
      // For now, we'll update the extracted data if present
      if (metadata?.extractedData) {
        updateExtractedData(metadata.extractedData);
      }

      return message;
    },
    [updateExtractedData],
  );

  // Handle streaming response
  const handleStreamingResponse = useCallback(
    async (response: Response): Promise<WizardChatResponse> => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let extractedData: Partial<ExtractedEntityData> = {};
      let conversationId: string | undefined;

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data: WizardChatStreamChunk = JSON.parse(line);

              switch (data.type) {
                case 'content':
                  if (data.content) {
                    fullContent += data.content;
                    setStreamingContent(fullContent);
                  }
                  break;

                case 'data':
                  if (data.data) {
                    extractedData = { ...extractedData, ...data.data };
                    updateExtractedData(data.data);
                  }
                  break;

                case 'error':
                  throw new Error(data.error || 'Unknown streaming error');

                case 'done':
                  break;
              }

              if (onChunkReceived) {
                onChunkReceived(data);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
            }
          }
        }

        return {
          message: fullContent,
          extractedData,
          conversationId,
        };
      } finally {
        reader.releaseLock();
        setStreamingContent('');
      }
    },
    [updateExtractedData, onChunkReceived],
  );

  // Send message to wizard chat API
  const sendMessage = useCallback(
    async (userMessage: string): Promise<WizardChatResponse | null> => {
      try {
        setLoading(true);
        setError(null);

        // Cancel any ongoing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        const requestBody = {
          message: userMessage,
          entityType: state.entityType,
          conversationId: state.conversationId,
          context: {
            currentData: state.extractedData,
            messageHistory: state.messages.slice(-5), // Last 5 messages for context
          },
          streaming: enableStreaming,
        };

        const response = await fetch('/api/wizard/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`,
          );
        }

        let result: WizardChatResponse;

        if (
          enableStreaming &&
          response.headers.get('content-type')?.includes('stream')
        ) {
          result = await handleStreamingResponse(response);
        } else {
          result = await response.json();
        }

        // Update conversation ID if provided
        if (result.conversationId) {
          setConversationId(result.conversationId);
        }

        // Add assistant message
        addAssistantMessage(result.message, {
          entityType: state.entityType || undefined,
          extractedData: result.extractedData,
        });

        // Update extracted data if present
        if (result.extractedData) {
          updateExtractedData(result.extractedData);
        }

        if (onComplete) {
          onComplete(result);
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log('Request was cancelled');
            return null;
          }

          setError(error.message);

          if (onError) {
            onError(error);
          }
        }

        return null;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      state.entityType,
      state.conversationId,
      state.extractedData,
      state.messages,
      enableStreaming,
      setLoading,
      setError,
      setConversationId,
      updateExtractedData,
      addAssistantMessage,
      handleStreamingResponse,
      onComplete,
      onError,
    ],
  );

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, [setLoading]);

  // Retry last message
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...state.messages]
      .reverse()
      .find(msg => msg.role === 'user');

    if (lastUserMessage) {
      return sendMessage(lastUserMessage.content);
    }

    return null;
  }, [state.messages, sendMessage]);

  return {
    sendMessage,
    cancelRequest,
    retryLastMessage,
    isStreaming: streamingContent.length > 0,
    streamingContent,
    isLoading: state.isLoading,
    error: state.error,
  };
}

// Hook for getting wizard suggestions based on current state
export function useWizardSuggestions() {
  const { state } = useWizard();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!state.entityType) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/wizard/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: state.entityType,
          currentData: state.extractedData,
          messageHistory: state.messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [state.entityType, state.extractedData, state.messages]);

  return {
    suggestions,
    isLoading,
    fetchSuggestions,
  };
}

// Hook for validating extracted data
export function useWizardValidation() {
  const { state } = useWizard();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validate = useCallback(async () => {
    if (!state.entityType) {
      return false;
    }

    try {
      const response = await fetch('/api/wizard/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: state.entityType,
          data: state.extractedData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setValidationErrors(result.errors || {});
        return result.isValid;
      }

      return false;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }, [state.entityType, state.extractedData]);

  return {
    validationErrors,
    validate,
    hasErrors: Object.keys(validationErrors).length > 0,
  };
}
