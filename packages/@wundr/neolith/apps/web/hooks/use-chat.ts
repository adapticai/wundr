'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';

import type {
  Message,
  Channel,
  Thread,
  TypingUser,
  SendMessageInput,
  UpdateMessageInput,
  MessageFilters,
  Reaction,
  User,
} from '@/types/chat';

// =============================================================================
// Hook Return Types
// =============================================================================

/**
 * Return type for the useMessages hook
 */
export interface UseMessagesReturn {
  /** List of messages */
  messages: Message[];
  /** Whether messages are loading */
  isLoading: boolean;
  /** Whether loading more messages */
  isLoadingMore: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether there are more messages to load */
  hasMore: boolean;
  /** Load more messages */
  loadMore: () => void;
  /** Refetch messages */
  refetch: () => void;
  /** Optimistically add a message */
  addOptimisticMessage: (message: Message) => void;
  /** Update a message optimistically */
  updateOptimisticMessage: (messageId: string, updates: Partial<Message>) => void;
  /** Remove a message optimistically */
  removeOptimisticMessage: (messageId: string) => void;
}

/**
 * Return type for the useThread hook
 */
export interface UseThreadReturn {
  /** Thread data */
  thread: Thread | null;
  /** Whether thread is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch thread */
  refetch: () => Promise<void>;
  /** Add an optimistic reply to the thread */
  addOptimisticReply: (message: Message) => void;
}

/**
 * Return type for the useSendMessage hook
 */
export interface UseSendMessageReturn {
  /** Send a new message - returns optimistic ID and the created message */
  sendMessage: (input: SendMessageInput, currentUser: User) => Promise<{ optimisticId: string; message: Message | null }>;
  /** Edit an existing message */
  editMessage: (messageId: string, input: UpdateMessageInput) => Promise<Message | null>;
  /** Delete a message */
  deleteMessage: (messageId: string) => Promise<boolean>;
  /** Whether a mutation is in progress */
  isSending: boolean;
  /** Error if mutation failed */
  error: Error | null;
}

/**
 * Return type for the useReactions hook
 */
export interface UseReactionsReturn {
  /** Toggle a reaction (add if not present, remove if present) */
  toggleReaction: (emoji: string) => Promise<Reaction[] | null>;
  /** Whether a reaction toggle is in progress */
  isToggling: boolean;
  /** Error if toggle failed */
  error: Error | null;
}

/**
 * Return type for the useTypingIndicator hook
 */
export interface UseTypingIndicatorReturn {
  /** Users currently typing */
  typingUsers: TypingUser[];
  /** Start typing indicator */
  startTyping: () => void;
  /** Stop typing indicator */
  stopTyping: () => void;
  /** Formatted string of typing users (e.g., "User1 is typing..." or "User1, User2 are typing...") */
  typingText: string;
}

/**
 * Return type for the useChannel hook (chat version)
 */
export interface UseChatChannelReturn {
  /** Channel data */
  channel: Channel | null;
  /** Whether channel is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch channel */
  refetch: () => Promise<void>;
}

/**
 * Return type for the useMentionSuggestions hook
 */
export interface UseMentionSuggestionsReturn {
  /** List of suggested users */
  users: User[];
  /** Whether suggestions are loading */
  isLoading: boolean;
  /** Search for users */
  searchUsers: (query: string) => void;
}

/**
 * Hook for fetching and subscribing to channel messages
 */
export function useMessages(channelId: string, filters?: MessageFilters): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const subscriptionRef = useRef<(() => void) | null>(null);

  const fetchMessages = useCallback(
    async (loadMore = false) => {
      if (!channelId) {
return;
}

      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters?.limit) {
params.set('limit', String(filters.limit));
}
        if (filters?.search) {
params.set('search', filters.search);
}

        // If loading more, use cursor-based pagination
        if (loadMore && messages.length > 0) {
          // Use the oldest message ID as cursor and fetch before it
          params.set('cursor', messages[0].id);
          params.set('direction', 'before');
        } else if (filters?.before) {
          params.set('cursor', filters.before);
          params.set('direction', 'before');
        } else if (filters?.after) {
          params.set('cursor', filters.after);
          params.set('direction', 'after');
        }

        const response = await fetch(`/api/channels/${channelId}/messages?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const result = await response.json();

        interface ApiMessage {
          id: string;
          content: string;
          type: string;
          channelId: string;
          createdAt: string;
          updatedAt: string;
          editedAt?: string | null;
          author: {
            id: string;
            name?: string;
            displayName?: string;
            avatarUrl?: string;
            image?: string;
          };
          reactions?: Reaction[];
          replyCount?: number;
          mentions?: string[];
          attachments?: unknown[];
          parentId?: string | null;
        }

        const newMessages: Message[] = result.data.map((m: ApiMessage) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
          editedAt: m.editedAt ? new Date(m.editedAt) : null,
          // Transform author's avatarUrl to image for UI compatibility
          author: {
            ...m.author,
            name: m.author.displayName || m.author.name || 'Unknown',
            image: m.author.avatarUrl || m.author.image,
          },
          reactions: m.reactions || [],
          replyCount: m.replyCount || 0,
          mentions: m.mentions || [],
          attachments: m.attachments || [],
        }));

        if (loadMore) {
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          setMessages(newMessages);
        }
        setHasMore(result.pagination?.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [channelId, filters?.limit, filters?.before, filters?.after, filters?.search],
  );

  // Initial fetch
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Subscribe to real-time updates via SSE
  useEffect(() => {
    if (!channelId) {
      return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let isMounted = true;

    const subscribe = (): (() => void) | null => {
      const eventSource = new EventSource(`/api/channels/${channelId}/subscribe`);

      // Handle error events from server
      eventSource.addEventListener('error', (event) => {
        try {
          // Try to parse as MessageEvent with data
          const messageEvent = event as MessageEvent;
          if (messageEvent.data) {
            const errorData = JSON.parse(messageEvent.data);
            console.error('[Channel Subscribe] Server error:', errorData);
          }
        } catch (parseError) {
          // Generic error event (connection failed, etc.)
          console.warn('[Channel Subscribe] Connection error:', parseError);
        }
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Reset reconnect attempts on successful message
          reconnectAttempts = 0;

          if (data.type === 'new_message') {
            const newMessage: Message = {
              ...data.message,
              createdAt: new Date(data.message.createdAt),
              updatedAt: new Date(data.message.updatedAt),
              editedAt: data.message.editedAt ? new Date(data.message.editedAt) : null,
              // Transform author's avatarUrl to image for UI compatibility
              author: data.message.author ? {
                ...data.message.author,
                name: data.message.author.displayName || data.message.author.name || 'Unknown',
                image: data.message.author.avatarUrl || data.message.author.image,
              } : data.message.author,
              // Ensure required fields have defaults
              reactions: data.message.reactions || [],
              replyCount: data.message.replyCount || 0,
              mentions: data.message.mentions || [],
              attachments: data.message.attachments || [],
            };
            setMessages((prev) => {
              // Avoid duplicates by checking if message already exists
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              return [...prev, newMessage];
            });
          } else if (data.type === 'message_updated') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message.id
                  ? {
                      ...m,
                      ...data.message,
                      createdAt: new Date(data.message.createdAt),
                      updatedAt: new Date(data.message.updatedAt),
                      editedAt: data.message.editedAt
                        ? new Date(data.message.editedAt)
                        : null,
                      // Transform author's avatarUrl to image for UI compatibility
                      author: data.message.author ? {
                        ...data.message.author,
                        name: data.message.author.displayName || data.message.author.name || 'Unknown',
                        image: data.message.author.avatarUrl || data.message.author.image,
                      } : m.author,
                    }
                  : m,
              ),
            );
          } else if (data.type === 'message_deleted') {
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
          }
        } catch (parseError) {
          console.error('[Channel Subscribe] Failed to parse message:', parseError);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();

        // Implement exponential backoff for reconnection
        if (isMounted && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.warn(`[Channel Subscribe] Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

          setTimeout(() => {
            if (isMounted) {
              subscriptionRef.current = subscribe();
            }
          }, backoffTime);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('[Channel Subscribe] Max reconnection attempts reached');
          setError(new Error('Real-time connection failed after multiple attempts'));
        }
      };

      return () => eventSource.close();
    };

    subscriptionRef.current = subscribe();

    return () => {
      isMounted = false;
      subscriptionRef.current?.();
    };
  }, [channelId]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchMessages(true);
    }
  }, [fetchMessages, isLoadingMore, hasMore]);

  const refetch = useCallback(() => {
    fetchMessages(false);
  }, [fetchMessages]);

  // Add optimistic message
  const addOptimisticMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Update message optimistically
  const updateOptimisticMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
    );
  }, []);

  // Remove message optimistically
  const removeOptimisticMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  };
}

/**
 * Hook for fetching thread messages
 */
export function useThread(parentId: string): UseThreadReturn {
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchThread = useCallback(async () => {
    if (!parentId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${parentId}/thread`);
      if (!response.ok) {
        throw new Error('Failed to fetch thread');
      }

      const result = await response.json();

      interface ApiAuthor {
        id: string;
        name?: string;
        displayName?: string;
        avatarUrl?: string;
        image?: string;
      }

      // Helper to transform author data
      const transformAuthor = (author: ApiAuthor | null | undefined) => author ? ({
        ...author,
        name: author.displayName || author.name || 'Unknown',
        image: author.avatarUrl || author.image,
      }) : author;

      interface ApiThreadMessage {
        id: string;
        content: string;
        type: string;
        channelId: string;
        createdAt: string;
        updatedAt: string;
        editedAt?: string | null;
        author: ApiAuthor;
        reactions?: Reaction[];
        replyCount?: number;
        mentions?: string[];
        attachments?: unknown[];
        parentId?: string | null;
      }

      interface ApiParticipant {
        id: string;
        name?: string;
        avatarUrl?: string;
        image?: string;
      }

      setThread({
        parentMessage: {
          ...result.data.parentMessage,
          createdAt: new Date(result.data.parentMessage.createdAt),
          updatedAt: new Date(result.data.parentMessage.updatedAt),
          editedAt: result.data.parentMessage.editedAt ? new Date(result.data.parentMessage.editedAt) : null,
          author: transformAuthor(result.data.parentMessage.author),
          reactions: result.data.parentMessage.reactions || [],
          replyCount: result.data.parentMessage.replyCount || 0,
          mentions: result.data.parentMessage.mentions || [],
          attachments: result.data.parentMessage.attachments || [],
        } as Message,
        messages: result.data.replies.map((m: ApiThreadMessage) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
          editedAt: m.editedAt ? new Date(m.editedAt) : null,
          author: transformAuthor(m.author),
          reactions: m.reactions || [],
          replyCount: m.replyCount || 0,
          mentions: m.mentions || [],
          attachments: m.attachments || [],
        })),
        participants: (result.data.participants || []).map((p: ApiParticipant) => ({
          ...p,
          name: p.name || 'Unknown',
          image: p.avatarUrl || p.image,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const addOptimisticReply = useCallback((message: Message) => {
    setThread((prev) => {
      if (!prev) {
return null;
}
      return {
        ...prev,
        messages: [...prev.messages, message],
      };
    });
  }, []);

  return {
    thread,
    isLoading,
    error,
    refetch: fetchThread,
    addOptimisticReply,
  };
}

/**
 * Hook for sending messages with optimistic updates
 */
export function useSendMessage(): UseSendMessageReturn {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (
      input: SendMessageInput,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _currentUser: User,
    ): Promise<{ optimisticId: string; message: Message | null }> => {
      setIsSending(true);
      setError(null);

      // Create optimistic message ID
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Note: The optimistic message is created in the calling component for more control
      // This hook just provides the ID and handles the API call

      try {
        // Send as JSON to match API expectations
        const response = await fetch(`/api/channels/${input.channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: input.content,
            type: input.type || 'TEXT',
            parentId: input.parentId,
            metadata: input.metadata || {},
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const result = await response.json();
        const message: Message = {
          ...result.data,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          // Transform author's avatarUrl to image for UI compatibility
          author: result.data.author ? {
            ...result.data.author,
            name: result.data.author.displayName || result.data.author.name,
            image: result.data.author.avatarUrl || result.data.author.image,
          } : result.data.author,
        };

        return { optimisticId, message };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return { optimisticId, message: null };
      } finally {
        setIsSending(false);
      }
    },
    [],
  );

  const editMessage = useCallback(
    async (messageId: string, input: UpdateMessageInput): Promise<Message | null> => {
      setIsSending(true);
      setError(null);

      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('Failed to edit message');
        }

        const result = await response.json();
        return {
          ...result.data,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          editedAt: new Date(result.data.editedAt),
          // Transform author's avatarUrl to image for UI compatibility
          author: result.data.author ? {
            ...result.data.author,
            name: result.data.author.displayName || result.data.author.name,
            image: result.data.author.avatarUrl || result.data.author.image,
          } : result.data.author,
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      return false;
    } finally {
      setIsSending(false);
    }
  }, []);

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    isSending,
    error,
  };
}

/**
 * Hook for managing reactions
 */
export function useReactions(messageId: string): UseReactionsReturn {
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const toggleReactionRef = useRef<AbortController | null>(null);

  const toggleReaction = useCallback(
    async (emoji: string): Promise<Reaction[] | null> => {
      if (!messageId) {
        return null;
      }

      // Cancel any in-flight toggle request
      if (toggleReactionRef.current) {
        toggleReactionRef.current.abort();
      }

      const abortController = new AbortController();
      toggleReactionRef.current = abortController;

      setIsToggling(true);
      setError(null);

      try {
        interface ApiReaction {
          emoji: string;
          hasReacted: boolean;
          count?: number;
          users?: { id: string; name: string }[];
        }

        // Check if reaction already exists by fetching current reactions
        const getResponse = await fetch(`/api/messages/${messageId}/reactions`, {
          signal: abortController.signal,
        });

        if (!getResponse.ok) {
          throw new Error('Failed to fetch current reactions');
        }

        const getResult = await getResponse.json();
        const existingReaction = getResult.data?.find(
          (r: ApiReaction) => r.emoji === emoji && r.hasReacted,
        );

        // If exists, delete it; otherwise, add it
        if (existingReaction) {
          const deleteResponse = await fetch(
            `/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
            {
              method: 'DELETE',
              signal: abortController.signal,
            },
          );
          if (!deleteResponse.ok) {
            throw new Error('Failed to remove reaction');
          }
        } else {
          const addResponse = await fetch(`/api/messages/${messageId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji }),
            signal: abortController.signal,
          });
          if (!addResponse.ok) {
            throw new Error('Failed to add reaction');
          }
        }

        // Fetch updated reactions list
        const finalResponse = await fetch(`/api/messages/${messageId}/reactions`, {
          signal: abortController.signal,
        });
        if (!finalResponse.ok) {
          throw new Error('Failed to fetch reactions');
        }

        const result = await finalResponse.json();
        return result.data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was cancelled, don't set error
          return null;
        }
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      } finally {
        if (toggleReactionRef.current === abortController) {
          toggleReactionRef.current = null;
        }
        setIsToggling(false);
      }
    },
    [messageId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toggleReactionRef.current) {
        toggleReactionRef.current.abort();
      }
    };
  }, []);

  return {
    toggleReaction,
    isToggling,
    error,
  };
}

/**
 * Hook for typing indicator
 */
export function useTypingIndicator(channelId: string, currentUserId: string): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for typing events (API returns JSON, not SSE)
  useEffect(() => {
    if (!channelId) {
      return;
    }

    const pollTypingUsers = async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/typing`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const users = data.data?.typingUsers || [];

        // Convert API response to TypingUser format
        setTypingUsers(
          users
            .filter((u: { userId: string }) => u.userId !== currentUserId)
            .map((u: { userId: string; userName: string }) => ({
              user: { id: u.userId, name: u.userName, email: '', status: 'online' as const },
              channelId,
              timestamp: Date.now(),
            }))
        );
      } catch {
        // Silently fail - typing indicators are non-critical
      }
    };

    // Initial poll
    pollTypingUsers();

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(pollTypingUsers, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [channelId, currentUserId]);

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((t) => now - t.timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, []);

  // Send typing indicator
  const startTyping = useCallback(() => {
    if (!channelId || isTyping) {
      return;
    }

    setIsTyping(true);

    fetch(`/api/channels/${channelId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: true }),
    }).catch((error) => {
      console.error('[Typing Indicator] Failed to send start typing:', error);
    });

    // Auto-stop typing after 5 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isTyping]);

  const stopTyping = useCallback(() => {
    if (!channelId || !isTyping) {
      return;
    }

    setIsTyping(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    fetch(`/api/channels/${channelId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: false }),
    }).catch((error) => {
      console.error('[Typing Indicator] Failed to send stop typing:', error);
    });
  }, [channelId, isTyping]);

  // Filter out current user from typing users
  const otherTypingUsers = useMemo(
    () => typingUsers.filter((t) => t.user.id !== currentUserId),
    [typingUsers, currentUserId],
  );

  // Generate typing text
  const typingText = useMemo(() => {
    if (otherTypingUsers.length === 0) {
      return '';
    }
    if (otherTypingUsers.length === 1) {
      return `${otherTypingUsers[0].user.name} is typing...`;
    }
    if (otherTypingUsers.length === 2) {
      return `${otherTypingUsers[0].user.name} and ${otherTypingUsers[1].user.name} are typing...`;
    }
    return `${otherTypingUsers[0].user.name} and ${otherTypingUsers.length - 1} others are typing...`;
  }, [otherTypingUsers]);

  return {
    typingUsers: otherTypingUsers,
    startTyping,
    stopTyping,
    typingText,
  };
}

/**
 * Hook for fetching channel details
 */
export function useChannel(channelId: string): UseChatChannelReturn {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchChannel = useCallback(async () => {
    if (!channelId) {
return;
}

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/channels/${channelId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch channel');
      }

      const responseData = await response.json();
      const channelData = responseData.data;
      setChannel({
        ...channelData,
        createdAt: new Date(channelData.createdAt),
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  return {
    channel,
    isLoading,
    error,
    refetch: fetchChannel,
  };
}

/**
 * Hook for mention suggestions
 */
export function useMentionSuggestions(channelId: string): UseMentionSuggestionsReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchUsers = useCallback(
    async (query: string) => {
      // Clear existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!channelId || query.length < 1) {
        setUsers([]);
        return;
      }

      // Debounce search by 300ms
      debounceTimeoutRef.current = setTimeout(async () => {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsLoading(true);

        try {
          const response = await fetch(
            `/api/channels/${channelId}/members?search=${encodeURIComponent(query)}`,
            { signal: abortController.signal },
          );
          if (!response.ok) {
            throw new Error('Failed to search users');
          }

          const data = await response.json();
          setUsers(data.members || []);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            // Request was cancelled, don't update state
            return;
          }
          console.error('[Mention Suggestions] Search failed:', error);
          setUsers([]);
        } finally {
          if (abortControllerRef.current === abortController) {
            abortControllerRef.current = null;
          }
          setIsLoading(false);
        }
      }, 300);
    },
    [channelId],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    users,
    searchUsers,
    isLoading,
  };
}
