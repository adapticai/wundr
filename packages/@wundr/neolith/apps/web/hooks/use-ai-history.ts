'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

import type { AIMessage } from '@/lib/ai/types';

/**
 * Conversation metadata
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  firstMessage?: string;
  lastMessage?: string;
  entityType?: string;
  workspaceSlug?: string;
  tags?: string[];
  starred?: boolean;
  archived?: boolean;
}

/**
 * History filters
 */
export interface HistoryFilters {
  entityType?: string;
  workspaceSlug?: string;
  starred?: boolean;
  archived?: boolean;
  searchQuery?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * History export format
 */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'txt';

/**
 * Exported conversation data
 */
export interface ExportedConversation {
  conversation: Conversation;
  messages: AIMessage[];
  exportedAt: Date;
  format: ExportFormat;
}

/**
 * Options for useAIHistory hook
 */
export interface UseAIHistoryOptions {
  /** Initial filters */
  filters?: HistoryFilters;
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
  /** Refresh interval in ms */
  refreshInterval?: number;
  /** API endpoint */
  apiEndpoint?: string;
  /** Enable local caching */
  enableCache?: boolean;
  /** Callback when conversation selected */
  onConversationSelect?: (conversation: Conversation) => void;
}

/**
 * Return type for useAIHistory hook
 */
export interface UseAIHistoryReturn {
  /** List of conversations */
  conversations: Conversation[];
  /** Whether conversations are loading */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
  /** Total conversation count */
  totalCount: number;
  /** Whether more pages available */
  hasMore: boolean;
  /** Current page */
  currentPage: number;
  /** Load more conversations */
  loadMore: () => Promise<void>;
  /** Refresh conversations */
  refresh: () => Promise<void>;
  /** Search conversations */
  search: (query: string) => Promise<void>;
  /** Filter conversations */
  filter: (filters: HistoryFilters) => void;
  /** Load a specific conversation with messages */
  loadConversation: (conversationId: string) => Promise<AIMessage[]>;
  /** Delete a conversation */
  deleteConversation: (conversationId: string) => Promise<void>;
  /** Delete multiple conversations */
  deleteMany: (conversationIds: string[]) => Promise<void>;
  /** Star/unstar a conversation */
  toggleStar: (conversationId: string) => Promise<void>;
  /** Archive/unarchive a conversation */
  toggleArchive: (conversationId: string) => Promise<void>;
  /** Update conversation metadata */
  updateConversation: (
    conversationId: string,
    updates: Partial<Conversation>
  ) => Promise<void>;
  /** Export conversation */
  exportConversation: (
    conversationId: string,
    format: ExportFormat
  ) => Promise<Blob>;
  /** Export multiple conversations */
  exportMany: (
    conversationIds: string[],
    format: ExportFormat
  ) => Promise<Blob>;
  /** Clear all history */
  clearAll: () => Promise<void>;
  /** Get conversation statistics */
  getStats: () => {
    total: number;
    starred: number;
    archived: number;
    thisWeek: number;
    thisMonth: number;
  };
}

const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_API_ENDPOINT = '/api/ai/history';

/**
 * Hook for managing AI conversation history
 *
 * Features:
 * - Conversation list management
 * - Filtering and search
 * - Pagination with infinite scroll support
 * - Star/archive management
 * - Bulk operations
 * - Export functionality (JSON, CSV, Markdown, TXT)
 * - Local caching with SWR
 * - Auto-refresh capability
 * - Statistics and analytics
 *
 * @example
 * ```tsx
 * const {
 *   conversations,
 *   loadMore,
 *   search,
 *   toggleStar,
 *   exportConversation,
 * } = useAIHistory({
 *   filters: { entityType: 'workspace' },
 *   pagination: { limit: 10 },
 * });
 *
 * // Search conversations
 * await search('project setup');
 *
 * // Star a conversation
 * await toggleStar(conversations[0].id);
 *
 * // Export to JSON
 * const blob = await exportConversation(conversations[0].id, 'json');
 * ```
 */
export function useAIHistory(
  options: UseAIHistoryOptions = {}
): UseAIHistoryReturn {
  const {
    filters: initialFilters = {},
    pagination: initialPagination = {},
    autoRefresh = false,
    refreshInterval = 30000,
    apiEndpoint = DEFAULT_API_ENDPOINT,
    enableCache = true,
    onConversationSelect,
  } = options;

  const [filters, setFilters] = useState<HistoryFilters>(initialFilters);
  const [page, setPage] = useState(initialPagination.page || 1);
  const [limit] = useState(initialPagination.limit || DEFAULT_PAGE_LIMIT);
  const [sortBy] = useState(initialPagination.sortBy || 'updatedAt');
  const [sortOrder] = useState(initialPagination.sortOrder || 'desc');
  const [totalCount, setTotalCount] = useState(0);

  // Build SWR key
  const buildKey = useCallback(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.workspaceSlug)
      params.set('workspaceSlug', filters.workspaceSlug);
    if (filters.starred !== undefined)
      params.set('starred', filters.starred.toString());
    if (filters.archived !== undefined)
      params.set('archived', filters.archived.toString());
    if (filters.searchQuery) params.set('search', filters.searchQuery);
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.dateFrom)
      params.set('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString());

    return `${apiEndpoint}?${params.toString()}`;
  }, [apiEndpoint, page, limit, sortBy, sortOrder, filters]);

  // Fetch conversations with SWR
  const { data, error, isLoading, mutate } = useSWR<{
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  }>(
    buildKey(),
    async url => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        conversations: data.conversations || [],
        total: data.total || 0,
        hasMore: data.hasMore || false,
      };
    },
    {
      revalidateOnFocus: false,
      refreshInterval: autoRefresh ? refreshInterval : 0,
      dedupingInterval: enableCache ? 5000 : 0,
    }
  );

  const conversations = data?.conversations || [];
  const hasMore = data?.hasMore || false;

  // Update total count
  useEffect(() => {
    if (data?.total !== undefined) {
      setTotalCount(data.total);
    }
  }, [data?.total]);

  /**
   * Load more conversations
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    setPage(prev => prev + 1);
  }, [hasMore, isLoading]);

  /**
   * Refresh conversations
   */
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  /**
   * Search conversations
   */
  const search = useCallback(async (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
    setPage(1);
  }, []);

  /**
   * Filter conversations
   */
  const filter = useCallback((newFilters: HistoryFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  /**
   * Load a specific conversation with messages
   */
  const loadConversation = useCallback(
    async (conversationId: string): Promise<AIMessage[]> => {
      const response = await fetch(`${apiEndpoint}/${conversationId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }
      const data = await response.json();
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        onConversationSelect?.(conversation);
      }
      return data.messages || [];
    },
    [apiEndpoint, conversations, onConversationSelect]
  );

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const response = await fetch(`${apiEndpoint}/${conversationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Optimistically update
      await mutate(
        prev =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.filter(
                  c => c.id !== conversationId
                ),
                total: prev.total - 1,
              }
            : prev,
        false
      );

      // Revalidate
      await mutate();
    },
    [apiEndpoint, mutate]
  );

  /**
   * Delete multiple conversations
   */
  const deleteMany = useCallback(
    async (conversationIds: string[]) => {
      const response = await fetch(`${apiEndpoint}/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversations');
      }

      // Optimistically update
      await mutate(
        prev =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.filter(
                  c => !conversationIds.includes(c.id)
                ),
                total: prev.total - conversationIds.length,
              }
            : prev,
        false
      );

      // Revalidate
      await mutate();
    },
    [apiEndpoint, mutate]
  );

  /**
   * Toggle star status
   */
  const toggleStar = useCallback(
    async (conversationId: string) => {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;

      const newStarred = !conversation.starred;

      // Optimistically update
      await mutate(
        prev =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.map(c =>
                  c.id === conversationId ? { ...c, starred: newStarred } : c
                ),
              }
            : prev,
        false
      );

      // Update on server
      const response = await fetch(`${apiEndpoint}/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: newStarred }),
      });

      if (!response.ok) {
        // Revert on error
        await mutate();
        throw new Error('Failed to update conversation');
      }
    },
    [conversations, apiEndpoint, mutate]
  );

  /**
   * Toggle archive status
   */
  const toggleArchive = useCallback(
    async (conversationId: string) => {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;

      const newArchived = !conversation.archived;

      // Optimistically update
      await mutate(
        prev =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.map(c =>
                  c.id === conversationId ? { ...c, archived: newArchived } : c
                ),
              }
            : prev,
        false
      );

      // Update on server
      const response = await fetch(`${apiEndpoint}/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: newArchived }),
      });

      if (!response.ok) {
        // Revert on error
        await mutate();
        throw new Error('Failed to update conversation');
      }
    },
    [conversations, apiEndpoint, mutate]
  );

  /**
   * Update conversation metadata
   */
  const updateConversation = useCallback(
    async (conversationId: string, updates: Partial<Conversation>) => {
      // Optimistically update
      await mutate(
        prev =>
          prev
            ? {
                ...prev,
                conversations: prev.conversations.map(c =>
                  c.id === conversationId ? { ...c, ...updates } : c
                ),
              }
            : prev,
        false
      );

      // Update on server
      const response = await fetch(`${apiEndpoint}/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Revert on error
        await mutate();
        throw new Error('Failed to update conversation');
      }
    },
    [apiEndpoint, mutate]
  );

  /**
   * Export conversation
   */
  const exportConversation = useCallback(
    async (conversationId: string, format: ExportFormat): Promise<Blob> => {
      const response = await fetch(
        `${apiEndpoint}/${conversationId}/export?format=${format}`
      );

      if (!response.ok) {
        throw new Error('Failed to export conversation');
      }

      return await response.blob();
    },
    [apiEndpoint]
  );

  /**
   * Export multiple conversations
   */
  const exportMany = useCallback(
    async (conversationIds: string[], format: ExportFormat): Promise<Blob> => {
      const response = await fetch(
        `${apiEndpoint}/bulk-export?format=${format}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationIds }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export conversations');
      }

      return await response.blob();
    },
    [apiEndpoint]
  );

  /**
   * Clear all history
   */
  const clearAll = useCallback(async () => {
    const response = await fetch(`${apiEndpoint}/clear-all`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to clear history');
    }

    // Clear cache
    await mutate({ conversations: [], total: 0, hasMore: false }, false);
    await globalMutate(() => true, undefined, { revalidate: false });
  }, [apiEndpoint, mutate]);

  /**
   * Get conversation statistics
   */
  const getStats = useCallback(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      total: conversations.length,
      starred: conversations.filter(c => c.starred).length,
      archived: conversations.filter(c => c.archived).length,
      thisWeek: conversations.filter(c => new Date(c.createdAt) >= weekAgo)
        .length,
      thisMonth: conversations.filter(c => new Date(c.createdAt) >= monthAgo)
        .length,
    };
  }, [conversations]);

  return {
    conversations,
    isLoading,
    error: error || null,
    totalCount,
    hasMore,
    currentPage: page,
    loadMore,
    refresh,
    search,
    filter,
    loadConversation,
    deleteConversation,
    deleteMany,
    toggleStar,
    toggleArchive,
    updateConversation,
    exportConversation,
    exportMany,
    clearAll,
    getStats,
  };
}
