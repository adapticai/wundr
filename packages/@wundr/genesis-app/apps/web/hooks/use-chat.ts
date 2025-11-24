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

/**
 * Hook for fetching and subscribing to channel messages
 */
export function useMessages(channelId: string, filters?: MessageFilters) {
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
        params.set('channelId', channelId);
        if (filters?.limit) {
params.set('limit', String(filters.limit));
}
        if (filters?.before) {
params.set('before', filters.before);
}
        if (filters?.after) {
params.set('after', filters.after);
}
        if (filters?.search) {
params.set('search', filters.search);
}

        // If loading more, use the oldest message ID as cursor
        if (loadMore && messages.length > 0) {
          params.set('before', messages[0].id);
        }

        const response = await fetch(`/api/channels/${channelId}/messages?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const data = await response.json();
        const newMessages: Message[] = data.messages.map((m: Message) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
          editedAt: m.editedAt ? new Date(m.editedAt) : null,
        }));

        if (loadMore) {
          setMessages((prev) => [...newMessages, ...prev]);
        } else {
          setMessages(newMessages);
        }
        setHasMore(data.hasMore ?? newMessages.length === (filters?.limit ?? 50));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [channelId, filters?.limit, filters?.before, filters?.after, filters?.search, messages],
  );

  // Initial fetch
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!channelId) {
return;
}

    // Simulated WebSocket subscription
    // In production, this would connect to a real WebSocket or SSE endpoint
    const subscribe = () => {
      // Placeholder for WebSocket connection
      const eventSource = new EventSource(`/api/channels/${channelId}/subscribe`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const newMessage: Message = {
              ...data.message,
              createdAt: new Date(data.message.createdAt),
              updatedAt: new Date(data.message.updatedAt),
            };
            setMessages((prev) => [...prev, newMessage]);
          } else if (data.type === 'message_updated') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === data.message.id
                  ? {
                      ...data.message,
                      createdAt: new Date(data.message.createdAt),
                      updatedAt: new Date(data.message.updatedAt),
                      editedAt: data.message.editedAt
                        ? new Date(data.message.editedAt)
                        : null,
                    }
                  : m,
              ),
            );
          } else if (data.type === 'message_deleted') {
            setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Retry connection after a delay
        setTimeout(subscribe, 5000);
      };

      return () => eventSource.close();
    };

    subscriptionRef.current = subscribe();

    return () => {
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
export function useThread(parentId: string) {
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

      const data = await response.json();
      setThread({
        parentMessage: {
          ...data.parentMessage,
          createdAt: new Date(data.parentMessage.createdAt),
          updatedAt: new Date(data.parentMessage.updatedAt),
        },
        messages: data.messages.map((m: Message) => ({
          ...m,
          createdAt: new Date(m.createdAt),
          updatedAt: new Date(m.updatedAt),
        })),
        participants: data.participants,
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
export function useSendMessage() {
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
        const formData = new FormData();
        formData.append('content', input.content);
        formData.append('channelId', input.channelId);
        if (input.parentId) {
formData.append('parentId', input.parentId);
}
        if (input.mentions) {
formData.append('mentions', JSON.stringify(input.mentions));
}
        if (input.attachments) {
          input.attachments.forEach((file) => {
            formData.append('attachments', file);
          });
        }

        const response = await fetch('/api/messages', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        const message: Message = {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
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

        const data = await response.json();
        return {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          editedAt: new Date(data.editedAt),
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
export function useReactions(messageId: string) {
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const toggleReaction = useCallback(
    async (emoji: string): Promise<Reaction[] | null> => {
      if (!messageId) {
return null;
}

      setIsToggling(true);
      setError(null);

      try {
        const response = await fetch(`/api/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });

        if (!response.ok) {
          throw new Error('Failed to toggle reaction');
        }

        const data = await response.json();
        return data.reactions;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        return null;
      } finally {
        setIsToggling(false);
      }
    },
    [messageId],
  );

  return {
    toggleReaction,
    isToggling,
    error,
  };
}

/**
 * Hook for typing indicator
 */
export function useTypingIndicator(channelId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for typing events
  useEffect(() => {
    if (!channelId) {
return;
}

    const eventSource = new EventSource(`/api/channels/${channelId}/typing`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.userId !== currentUserId) {
          setTypingUsers((prev) => {
            const filtered = prev.filter((t) => t.user.id !== data.userId);
            if (data.isTyping) {
              return [...filtered, { user: data.user, channelId, timestamp: Date.now() }];
            }
            return filtered;
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      eventSource.close();
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
    }).catch(() => {
      // Ignore errors
    });

    // Auto-stop typing after 5 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 5000);
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
    }).catch(() => {
      // Ignore errors
    });
  }, [channelId, isTyping]);

  // Filter out current user from typing users
  const otherTypingUsers = useMemo(
    () => typingUsers.filter((t) => t.user.id !== currentUserId),
    [typingUsers, currentUserId],
  );

  return {
    typingUsers: otherTypingUsers,
    startTyping,
    stopTyping,
  };
}

/**
 * Hook for fetching channel details
 */
export function useChannel(channelId: string) {
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

      const data = await response.json();
      setChannel({
        ...data,
        createdAt: new Date(data.createdAt),
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
export function useMentionSuggestions(channelId: string) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchUsers = useCallback(
    async (query: string) => {
      if (!channelId || query.length < 1) {
        setUsers([]);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/channels/${channelId}/members?search=${encodeURIComponent(query)}`,
        );
        if (!response.ok) {
          throw new Error('Failed to search users');
        }

        const data = await response.json();
        setUsers(data.members);
      } catch {
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [channelId],
  );

  return {
    users,
    searchUsers,
    isLoading,
  };
}
