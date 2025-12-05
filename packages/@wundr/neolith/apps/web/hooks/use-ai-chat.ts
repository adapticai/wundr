'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { AIMessage, ChatConfig, EntityType } from '@/lib/ai/types';

/**
 * Error types for AI chat operations
 */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NETWORK_ERROR'
      | 'AUTH_ERROR'
      | 'RATE_LIMIT'
      | 'INVALID_INPUT'
      | 'PROVIDER_ERROR'
      | 'TIMEOUT'
      | 'ABORT',
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * AI provider types
 */
export type AIProvider = 'openai' | 'anthropic' | 'deepseek';

/**
 * Message status for optimistic updates
 */
export type MessageStatus = 'sending' | 'sent' | 'error' | 'streaming';

/**
 * Extended AI message with local state
 */
export interface LocalAIMessage extends AIMessage {
  status?: MessageStatus;
  error?: AIError;
  retryCount?: number;
  localId?: string;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

/**
 * Chat session metadata
 */
export interface ChatSession {
  id: string;
  entityType?: EntityType;
  provider: AIProvider;
  model: string;
  createdAt: Date;
  lastMessageAt: Date;
  tokenUsage: TokenUsage;
  messageCount: number;
}

/**
 * Options for useAIChat hook
 */
export interface UseAIChatOptions {
  /** Unique session identifier */
  sessionId?: string;
  /** Entity type for context */
  entityType?: EntityType;
  /** Workspace slug for context */
  workspaceSlug?: string;
  /** Custom chat configuration */
  config?: Partial<ChatConfig>;
  /** AI provider to use */
  provider?: AIProvider;
  /** Custom API endpoint */
  apiEndpoint?: string;
  /** Enable automatic retry on error */
  autoRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable draft message persistence */
  enableDrafts?: boolean;
  /** Callback when token usage updates */
  onTokenUsage?: (usage: TokenUsage) => void;
  /** Callback when error occurs */
  onError?: (error: AIError) => void;
  /** Initial messages */
  initialMessages?: AIMessage[];
}

/**
 * Return type for useAIChat hook
 */
export interface UseAIChatReturn {
  /** Current messages in the chat */
  messages: LocalAIMessage[];
  /** Whether chat is loading */
  isLoading: boolean;
  /** Whether a message is being sent */
  isSending: boolean;
  /** Current error if any */
  error: AIError | null;
  /** Chat session metadata */
  session: ChatSession | null;
  /** Send a new message */
  sendMessage: (
    content: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  /** Regenerate the last assistant message */
  regenerate: () => Promise<void>;
  /** Stop the current streaming response */
  stop: () => void;
  /** Clear all messages */
  clear: () => void;
  /** Delete a specific message */
  deleteMessage: (messageId: string) => Promise<void>;
  /** Edit a message */
  editMessage: (messageId: string, content: string) => Promise<void>;
  /** Retry a failed message */
  retryMessage: (messageId: string) => Promise<void>;
  /** Load chat history */
  loadHistory: (beforeMessageId?: string) => Promise<void>;
  /** Whether more history is available */
  hasMoreHistory: boolean;
  /** Current draft message */
  draft: string;
  /** Update draft message */
  setDraft: (content: string) => void;
  /** Cumulative token usage */
  tokenUsage: TokenUsage;
}

const DEFAULT_CONFIG: ChatConfig = {
  model: 'gpt-4o-mini',
  maxTokens: 4096,
  temperature: 0.7,
};

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const DRAFT_STORAGE_KEY = 'ai-chat-draft';

/**
 * Main AI chat hook with comprehensive features
 *
 * Provides full-featured AI chat with:
 * - Optimistic updates
 * - Retry logic with exponential backoff
 * - Token usage tracking
 * - Draft message persistence
 * - Multiple provider support
 * - Error handling with specific error types
 * - AbortController for cancellation
 * - History pagination
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading, error } = useAIChat({
 *   sessionId: 'session-123',
 *   entityType: 'workspace',
 *   provider: 'openai',
 *   onTokenUsage: (usage) => console.log('Tokens used:', usage.totalTokens),
 * });
 *
 * // Send a message
 * await sendMessage('Hello, how can I create a workspace?');
 * ```
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    sessionId,
    entityType,
    workspaceSlug,
    config: customConfig,
    provider = 'openai',
    apiEndpoint = '/api/ai/chat',
    autoRetry = true,
    maxRetries = MAX_RETRY_ATTEMPTS,
    enableDrafts = true,
    onTokenUsage,
    onError,
    initialMessages = [],
  } = options;

  const [messages, setMessages] = useState<LocalAIMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<AIError | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });
  const [draft, setDraftState] = useState('');
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...customConfig }),
    [customConfig]
  );

  // Load draft from localStorage
  useEffect(() => {
    if (enableDrafts && sessionId) {
      const key = `${DRAFT_STORAGE_KEY}-${sessionId}`;
      const savedDraft = localStorage.getItem(key);
      if (savedDraft) {
        setDraftState(savedDraft);
      }
    }
  }, [sessionId, enableDrafts]);

  // Save draft to localStorage
  const setDraft = useCallback(
    (content: string) => {
      setDraftState(content);
      if (enableDrafts && sessionId) {
        const key = `${DRAFT_STORAGE_KEY}-${sessionId}`;
        if (content) {
          localStorage.setItem(key, content);
        } else {
          localStorage.removeItem(key);
        }
      }
    },
    [sessionId, enableDrafts]
  );

  // Fetch session metadata
  const { data: session, mutate: mutateSession } = useSWR<ChatSession>(
    sessionId ? `/api/ai/sessions/${sessionId}` : null,
    async url => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new AIError(
          'Failed to load session',
          'NETWORK_ERROR',
          res.status
        );
      }
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  /**
   * Create an optimistic message
   */
  const createOptimisticMessage = useCallback(
    (content: string, role: 'user' | 'assistant'): LocalAIMessage => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return {
        id: localId,
        localId,
        role,
        content,
        createdAt: new Date(),
        status: 'sending',
      };
    },
    []
  );

  /**
   * Handle API errors with retry logic
   */
  const handleAPIError = useCallback(
    async (
      error: unknown,
      retryFn: () => Promise<void>,
      retryCount = 0
    ): Promise<void> => {
      let aiError: AIError;

      if (error instanceof AIError) {
        aiError = error;
      } else if (error instanceof Error) {
        if (error.name === 'AbortError') {
          aiError = new AIError('Request aborted', 'ABORT');
        } else {
          aiError = new AIError(error.message, 'NETWORK_ERROR');
        }
      } else {
        aiError = new AIError('Unknown error occurred', 'NETWORK_ERROR');
      }

      // Check if we should retry
      if (
        autoRetry &&
        retryCount < maxRetries &&
        (aiError.code === 'NETWORK_ERROR' || aiError.code === 'TIMEOUT')
      ) {
        const delay =
          RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
        await retryFn();
        return;
      }

      setError(aiError);
      onError?.(aiError);
    },
    [autoRetry, maxRetries, onError]
  );

  /**
   * Update token usage
   */
  const updateTokenUsage = useCallback(
    (newUsage: Partial<TokenUsage>) => {
      setTokenUsage(prev => {
        const updated = {
          promptTokens: prev.promptTokens + (newUsage.promptTokens || 0),
          completionTokens:
            prev.completionTokens + (newUsage.completionTokens || 0),
          totalTokens: prev.totalTokens + (newUsage.totalTokens || 0),
          cost: (prev.cost || 0) + (newUsage.cost || 0),
        };
        onTokenUsage?.(updated);
        return updated;
      });
    },
    [onTokenUsage]
  );

  /**
   * Send a message to the AI
   */
  const sendMessage = useCallback(
    async (content: string, metadata?: Record<string, unknown>) => {
      if (!content.trim()) return;

      setIsSending(true);
      setError(null);

      // Create optimistic user message
      const userMessage = createOptimisticMessage(content, 'user');
      setMessages(prev => [...prev, userMessage]);

      // Clear draft
      setDraft('');

      // Create optimistic assistant message
      const assistantMessage = createOptimisticMessage('', 'assistant');
      assistantMessage.status = 'streaming';
      setMessages(prev => [...prev, assistantMessage]);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      const attemptSend = async (retryCount = 0): Promise<void> => {
        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              messages: [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
              })),
              entityType,
              workspaceSlug,
              provider,
              config,
              metadata,
            }),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new AIError(
              errorData.error || 'Failed to send message',
              response.status === 429
                ? 'RATE_LIMIT'
                : response.status === 401
                  ? 'AUTH_ERROR'
                  : 'PROVIDER_ERROR',
              response.status
            );
          }

          // Handle streaming response
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          if (!reader) {
            throw new AIError('No response body', 'PROVIDER_ERROR');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Update streaming message
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.localId === assistantMessage.localId) {
                lastMsg.content = buffer;
                lastMsg.status = 'streaming';
              }
              return updated;
            });
          }

          // Finalize message
          setMessages(prev => {
            const updated = [...prev];
            const userMsg = updated.find(
              m => m.localId === userMessage.localId
            );
            const assistMsg = updated.find(
              m => m.localId === assistantMessage.localId
            );

            if (userMsg) {
              userMsg.status = 'sent';
              delete userMsg.localId;
            }
            if (assistMsg) {
              assistMsg.status = 'sent';
              delete assistMsg.localId;
            }

            return updated;
          });

          // Update token usage (would come from response headers in real implementation)
          updateTokenUsage({
            promptTokens: Math.ceil(content.length / 4),
            completionTokens: Math.ceil(buffer.length / 4),
            totalTokens: Math.ceil((content.length + buffer.length) / 4),
          });

          // Update session
          await mutateSession();
        } catch (err) {
          await handleAPIError(
            err,
            () => attemptSend(retryCount + 1),
            retryCount
          );

          // Mark messages as error
          setMessages(prev => {
            const updated = [...prev];
            const userMsg = updated.find(
              m => m.localId === userMessage.localId
            );
            const assistMsg = updated.find(
              m => m.localId === assistantMessage.localId
            );

            if (userMsg) {
              userMsg.status = 'error';
              userMsg.retryCount = retryCount;
            }
            if (assistMsg) {
              // Remove failed assistant message
              const index = updated.indexOf(assistMsg);
              if (index > -1) updated.splice(index, 1);
            }

            return updated;
          });
        } finally {
          setIsSending(false);
          abortControllerRef.current = null;
        }
      };

      await attemptSend();
    },
    [
      messages,
      sessionId,
      entityType,
      workspaceSlug,
      provider,
      config,
      apiEndpoint,
      createOptimisticMessage,
      setDraft,
      updateTokenUsage,
      mutateSession,
      handleAPIError,
    ]
  );

  /**
   * Regenerate the last assistant message
   */
  const regenerate = useCallback(async () => {
    const lastAssistantIndex = messages.findLastIndex(
      m => m.role === 'assistant'
    );
    if (lastAssistantIndex === -1) return;

    const lastUserMessage = messages
      .slice(0, lastAssistantIndex)
      .findLast(m => m.role === 'user');

    if (!lastUserMessage) return;

    // Remove last assistant message
    setMessages(prev => prev.slice(0, lastAssistantIndex));

    // Resend user message
    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  /**
   * Stop the current streaming response
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsSending(false);
  }, []);

  /**
   * Clear all messages
   */
  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  }, []);

  /**
   * Delete a specific message
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages(prev =>
      prev.filter(m => m.id !== messageId && m.localId !== messageId)
    );
  }, []);

  /**
   * Edit a message
   */
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      setMessages(prev => {
        const updated = [...prev];
        const message = updated.find(
          m => m.id === messageId || m.localId === messageId
        );
        if (message) {
          message.content = content;
        }
        return updated;
      });
    },
    []
  );

  /**
   * Retry a failed message
   */
  const retryMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find(
        m => m.id === messageId || m.localId === messageId
      );
      if (!message || message.role !== 'user') return;

      await deleteMessage(messageId);
      await sendMessage(message.content);
    },
    [messages, deleteMessage, sendMessage]
  );

  /**
   * Load chat history
   */
  const loadHistory = useCallback(
    async (beforeMessageId?: string) => {
      if (!sessionId) return;

      try {
        const url = new URL(
          `/api/ai/sessions/${sessionId}/messages`,
          window.location.origin
        );
        if (beforeMessageId) {
          url.searchParams.set('before', beforeMessageId);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new AIError(
            'Failed to load history',
            'NETWORK_ERROR',
            response.status
          );
        }

        const data = await response.json();
        const historyMessages: LocalAIMessage[] = data.messages || [];

        setMessages(prev => [...historyMessages, ...prev]);
        setHasMoreHistory(data.hasMore || false);
      } catch (err) {
        const error =
          err instanceof AIError
            ? err
            : new AIError('Failed to load history', 'NETWORK_ERROR');
        setError(error);
        onError?.(error);
      }
    },
    [sessionId, onError]
  );

  return {
    messages,
    isLoading: !session && !!sessionId,
    isSending,
    error,
    session: session || null,
    sendMessage,
    regenerate,
    stop,
    clear,
    deleteMessage,
    editMessage,
    retryMessage,
    loadHistory,
    hasMoreHistory,
    draft,
    setDraft,
    tokenUsage,
  };
}
