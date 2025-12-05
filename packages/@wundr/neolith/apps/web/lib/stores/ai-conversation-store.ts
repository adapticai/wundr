/**
 * AI Conversation Store
 *
 * Zustand store for managing AI conversation state with optimistic updates,
 * SWR integration, and real-time synchronization.
 *
 * Features:
 * - List, create, update, delete conversations
 * - Add messages with optimistic updates
 * - Pin/archive conversations
 * - Search conversations
 * - Export conversations
 * - Share conversations
 * - Workspace scoping
 * - Pagination support
 *
 * @module lib/stores/ai-conversation-store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type {
  AIConversation,
  AIMessage,
  CreateAIConversationInput,
  UpdateAIConversationInput,
  AddAIMessageInput,
  AIConversationFilters,
  ExportFormat,
  ShareConversationInput,
  PaginationMetadata,
} from '@/types/ai-conversation';

/**
 * API client for AI conversations
 */
class AIConversationAPI {
  /**
   * Fetch conversations list
   */
  static async list(
    filters: AIConversationFilters
  ): Promise<{ data: AIConversation[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`/api/ai/conversations?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }
    return response.json();
  }

  /**
   * Get single conversation
   */
  static async get(id: string): Promise<{ data: AIConversation }> {
    const response = await fetch(`/api/ai/conversations/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }
    return response.json();
  }

  /**
   * Create new conversation
   */
  static async create(
    input: CreateAIConversationInput
  ): Promise<{ data: AIConversation }> {
    const response = await fetch('/api/ai/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  }

  /**
   * Update conversation
   */
  static async update(
    id: string,
    input: UpdateAIConversationInput
  ): Promise<{ data: AIConversation }> {
    const response = await fetch(`/api/ai/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error('Failed to update conversation');
    }
    return response.json();
  }

  /**
   * Delete conversation
   */
  static async delete(id: string): Promise<void> {
    const response = await fetch(`/api/ai/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
  }

  /**
   * Add message to conversation
   */
  static async addMessage(
    conversationId: string,
    input: Omit<AddAIMessageInput, 'conversationId'>
  ): Promise<{ data: AIMessage }> {
    const response = await fetch(
      `/api/ai/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to add message');
    }
    return response.json();
  }

  /**
   * Get conversation messages
   */
  static async getMessages(
    conversationId: string
  ): Promise<{ data: AIMessage[] }> {
    const response = await fetch(
      `/api/ai/conversations/${conversationId}/messages`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    return response.json();
  }

  /**
   * Export conversation
   */
  static async export(
    id: string,
    format: ExportFormat,
    options?: {
      includeMetadata?: boolean;
      includeSystemMessages?: boolean;
      includeTimestamps?: boolean;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams({ format });
    if (options?.includeMetadata) params.append('includeMetadata', 'true');
    if (options?.includeSystemMessages !== false)
      params.append('includeSystemMessages', 'true');
    if (options?.includeTimestamps) params.append('includeTimestamps', 'true');

    const response = await fetch(
      `/api/ai/conversations/${id}/export?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error('Failed to export conversation');
    }
    return response.blob();
  }

  /**
   * Share conversation
   */
  static async share(
    id: string,
    input: Omit<ShareConversationInput, 'conversationId'>
  ): Promise<void> {
    const response = await fetch(`/api/ai/conversations/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error('Failed to share conversation');
    }
  }

  /**
   * Revoke share
   */
  static async revokeShare(id: string): Promise<void> {
    const response = await fetch(`/api/ai/conversations/${id}/share`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to revoke share');
    }
  }

  /**
   * Search conversations
   */
  static async search(
    workspaceId: string,
    query: string,
    options?: {
      tags?: string[];
      limit?: number;
      page?: number;
    }
  ): Promise<{ data: AIConversation[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams({
      workspaceId,
      q: query,
      limit: String(options?.limit || 20),
      page: String(options?.page || 1),
    });
    if (options?.tags) {
      params.append('tags', options.tags.join(','));
    }

    const response = await fetch(
      `/api/ai/conversations/search?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error('Failed to search conversations');
    }
    return response.json();
  }
}

/**
 * Store state interface
 */
interface AIConversationState {
  // Data
  conversations: Map<string, AIConversation>;
  currentConversation: AIConversation | null;
  filters: AIConversationFilters | null;
  pagination: PaginationMetadata | null;

  // Loading states
  isLoading: boolean;
  isLoadingConversation: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isSendingMessage: boolean;

  // Error states
  error: string | null;

  // Actions
  setFilters: (filters: AIConversationFilters) => void;
  loadConversations: (filters: AIConversationFilters) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (
    input: CreateAIConversationInput
  ) => Promise<AIConversation>;
  updateConversation: (
    id: string,
    input: UpdateAIConversationInput
  ) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (
    conversationId: string,
    message: Omit<AddAIMessageInput, 'conversationId'>
  ) => Promise<void>;
  pinConversation: (id: string, isPinned: boolean) => Promise<void>;
  archiveConversation: (id: string, isArchived: boolean) => Promise<void>;
  exportConversation: (id: string, format: ExportFormat) => Promise<void>;
  shareConversation: (
    id: string,
    input: Omit<ShareConversationInput, 'conversationId'>
  ) => Promise<void>;
  searchConversations: (workspaceId: string, query: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

/**
 * Initial state
 */
const initialState = {
  conversations: new Map(),
  currentConversation: null,
  filters: null,
  pagination: null,
  isLoading: false,
  isLoadingConversation: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isSendingMessage: false,
  error: null,
};

/**
 * AI Conversation Store
 */
export const useAIConversationStore = create<AIConversationState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setFilters: filters => {
          set({ filters });
        },

        loadConversations: async filters => {
          set({ isLoading: true, error: null });
          try {
            const { data, pagination } = await AIConversationAPI.list(filters);

            const conversationsMap = new Map<string, AIConversation>();
            data.forEach(conv => conversationsMap.set(conv.id, conv));

            set({
              conversations: conversationsMap,
              pagination,
              filters,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
            });
          }
        },

        loadConversation: async id => {
          set({ isLoadingConversation: true, error: null });
          try {
            const { data } = await AIConversationAPI.get(id);

            // Update in map
            const conversations = new Map(get().conversations);
            conversations.set(id, data);

            set({
              currentConversation: data,
              conversations,
              isLoadingConversation: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoadingConversation: false,
            });
          }
        },

        createConversation: async input => {
          set({ isCreating: true, error: null });
          try {
            const { data } = await AIConversationAPI.create(input);

            // Add to map
            const conversations = new Map(get().conversations);
            conversations.set(data.id, data);

            set({
              conversations,
              currentConversation: data,
              isCreating: false,
            });

            return data;
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isCreating: false,
            });
            throw error;
          }
        },

        updateConversation: async (id, input) => {
          set({ isUpdating: true, error: null });
          try {
            const { data } = await AIConversationAPI.update(id, input);

            // Update in map
            const conversations = new Map(get().conversations);
            conversations.set(id, data);

            set({
              conversations,
              currentConversation:
                get().currentConversation?.id === id
                  ? data
                  : get().currentConversation,
              isUpdating: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isUpdating: false,
            });
            throw error;
          }
        },

        deleteConversation: async id => {
          set({ isDeleting: true, error: null });
          try {
            await AIConversationAPI.delete(id);

            // Remove from map
            const conversations = new Map(get().conversations);
            conversations.delete(id);

            set({
              conversations,
              currentConversation:
                get().currentConversation?.id === id
                  ? null
                  : get().currentConversation,
              isDeleting: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isDeleting: false,
            });
            throw error;
          }
        },

        addMessage: async (conversationId, message) => {
          set({ isSendingMessage: true, error: null });

          // Optimistic update
          const current = get().currentConversation;
          if (current && current.id === conversationId) {
            const optimisticMessage: AIMessage = {
              id: `temp-${Date.now()}`,
              role: message.role,
              content: message.content,
              createdAt: new Date().toISOString(),
              tokens: message.tokens,
              model: message.model,
              metadata: message.metadata,
            };

            set({
              currentConversation: {
                ...current,
                messages: [...(current.messages || []), optimisticMessage],
              },
            });
          }

          try {
            const { data } = await AIConversationAPI.addMessage(
              conversationId,
              message
            );

            // Replace optimistic message with real one
            if (current && current.id === conversationId) {
              const messages = [...(current.messages || [])];
              messages[messages.length - 1] = data;

              set({
                currentConversation: {
                  ...current,
                  messages,
                },
                isSendingMessage: false,
              });
            } else {
              set({ isSendingMessage: false });
            }

            // Reload conversation to get updated metadata
            await get().loadConversation(conversationId);
          } catch (error) {
            // Revert optimistic update on error
            if (current && current.id === conversationId) {
              const messages = [...(current.messages || [])];
              messages.pop();

              set({
                currentConversation: {
                  ...current,
                  messages,
                },
              });
            }

            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isSendingMessage: false,
            });
            throw error;
          }
        },

        pinConversation: async (id, isPinned) => {
          await get().updateConversation(id, { isPinned });
        },

        archiveConversation: async (id, isArchived) => {
          await get().updateConversation(id, { isArchived });
        },

        exportConversation: async (id, format) => {
          try {
            const blob = await AIConversationAPI.export(id, format, {
              includeMetadata: true,
              includeTimestamps: true,
            });

            // Trigger download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `conversation-${id}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        },

        shareConversation: async (id, input) => {
          try {
            await AIConversationAPI.share(id, input);
            // Reload conversation to get updated share settings
            await get().loadConversation(id);
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }
        },

        searchConversations: async (workspaceId, query) => {
          set({ isLoading: true, error: null });
          try {
            const { data, pagination } = await AIConversationAPI.search(
              workspaceId,
              query
            );

            const conversationsMap = new Map<string, AIConversation>();
            data.forEach(conv => conversationsMap.set(conv.id, conv));

            set({
              conversations: conversationsMap,
              pagination,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
            });
          }
        },

        clearError: () => {
          set({ error: null });
        },

        reset: () => {
          set(initialState);
        },
      }),
      {
        name: 'ai-conversation-store',
        partialize: state => ({
          // Only persist filters, not the full conversations data
          filters: state.filters,
        }),
      }
    ),
    { name: 'AIConversationStore' }
  )
);

/**
 * Selectors for common use cases
 */
export const selectConversationsList = (state: AIConversationState) =>
  Array.from(state.conversations.values());

export const selectPinnedConversations = (state: AIConversationState) =>
  Array.from(state.conversations.values()).filter(conv => conv.isPinned);

export const selectActiveConversations = (state: AIConversationState) =>
  Array.from(state.conversations.values()).filter(conv => !conv.isArchived);

export const selectConversationById =
  (id: string) => (state: AIConversationState) =>
    state.conversations.get(id);

export const selectIsLoading = (state: AIConversationState) =>
  state.isLoading ||
  state.isLoadingConversation ||
  state.isCreating ||
  state.isUpdating ||
  state.isDeleting;
