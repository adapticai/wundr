'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { EntityType } from '@/lib/ai/types';

/**
 * Context source types
 */
export type ContextSource =
  | 'workspace'
  | 'channel'
  | 'user'
  | 'session'
  | 'history'
  | 'document'
  | 'external';

/**
 * Context priority levels for injection order
 */
export type ContextPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Context item with metadata
 */
export interface ContextItem {
  id: string;
  source: ContextSource;
  priority: ContextPriority;
  content: string;
  metadata?: Record<string, unknown>;
  tokens?: number;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Context injection strategy
 */
export type InjectionStrategy =
  | 'prepend' // Add context at the start of the prompt
  | 'append' // Add context at the end of the prompt
  | 'system' // Include in system message
  | 'metadata'; // Include as metadata

/**
 * Context configuration
 */
export interface ContextConfig {
  /** Maximum total tokens for context */
  maxTokens: number;
  /** Injection strategy */
  strategy: InjectionStrategy;
  /** Auto-prune old context */
  autoPrune: boolean;
  /** Prune strategy */
  pruneStrategy: 'oldest' | 'lowest-priority' | 'least-used';
  /** Enable context compression */
  enableCompression: boolean;
  /** Compression threshold (% of maxTokens) */
  compressionThreshold: number;
}

/**
 * Workspace context data
 */
export interface WorkspaceContext {
  id: string;
  name: string;
  description?: string;
  preferences?: Record<string, unknown>;
  activeTasks?: number;
  activeChannels?: number;
}

/**
 * User context data
 */
export interface UserContext {
  id: string;
  name: string;
  email: string;
  role?: string;
  preferences?: Record<string, unknown>;
  recentActivity?: string[];
}

/**
 * Session context data
 */
export interface SessionContext {
  id: string;
  entityType?: EntityType;
  startedAt: Date;
  messageCount: number;
  topics?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Options for useAIContext hook
 */
export interface UseAIContextOptions {
  /** Workspace slug for context */
  workspaceSlug?: string;
  /** Channel ID for context */
  channelId?: string;
  /** Entity type for context */
  entityType?: EntityType;
  /** Session ID for context */
  sessionId?: string;
  /** Context configuration */
  config?: Partial<ContextConfig>;
  /** Enable automatic context gathering */
  autoGather?: boolean;
  /** Custom API endpoint */
  apiEndpoint?: string;
  /** Callback when context updates */
  onContextUpdate?: (items: ContextItem[]) => void;
}

/**
 * Return type for useAIContext hook
 */
export interface UseAIContextReturn {
  /** Current context items */
  items: ContextItem[];
  /** Total token count */
  totalTokens: number;
  /** Whether context is loading */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
  /** Add context item */
  addItem: (
    source: ContextSource,
    content: string,
    options?: {
      priority?: ContextPriority;
      metadata?: Record<string, unknown>;
      expiresIn?: number;
    }
  ) => void;
  /** Remove context item */
  removeItem: (itemId: string) => void;
  /** Clear all context */
  clear: () => void;
  /** Get workspace context */
  workspaceContext: WorkspaceContext | null;
  /** Get user context */
  userContext: UserContext | null;
  /** Get session context */
  sessionContext: SessionContext | null;
  /** Build prompt with injected context */
  buildPrompt: (userPrompt: string) => string;
  /** Get context as system message */
  getSystemMessage: () => string;
  /** Get context metadata */
  getMetadata: () => Record<string, unknown>;
  /** Compress context to fit token limit */
  compress: () => void;
  /** Prune low-priority context */
  prune: (targetTokens?: number) => void;
  /** Refresh context from sources */
  refresh: () => Promise<void>;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 2000,
  strategy: 'system',
  autoPrune: true,
  pruneStrategy: 'lowest-priority',
  enableCompression: false,
  compressionThreshold: 0.8,
};

const TOKENS_PER_CHAR = 0.25; // Rough estimate

/**
 * Hook for managing AI context injection
 *
 * Features:
 * - Multi-source context gathering (workspace, user, session, etc.)
 * - Token-aware context management
 * - Priority-based context injection
 * - Automatic pruning when token limit exceeded
 * - Context compression
 * - Multiple injection strategies
 * - Expiring context items
 * - Real-time context updates
 *
 * @example
 * ```tsx
 * const {
 *   addItem,
 *   buildPrompt,
 *   workspaceContext,
 *   totalTokens,
 * } = useAIContext({
 *   workspaceSlug: 'my-workspace',
 *   entityType: 'orchestrator',
 *   config: { maxTokens: 1500 },
 * });
 *
 * // Add custom context
 * addItem('document', 'Important project guidelines...', {
 *   priority: 'high',
 *   expiresIn: 3600000, // 1 hour
 * });
 *
 * // Build prompt with context
 * const fullPrompt = buildPrompt('How do I create a new task?');
 * ```
 */
export function useAIContext(
  options: UseAIContextOptions = {}
): UseAIContextReturn {
  const {
    workspaceSlug,
    channelId,
    entityType,
    sessionId,
    config: customConfig,
    autoGather = true,
    apiEndpoint = '/api/ai/context',
    onContextUpdate,
  } = options;

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...customConfig }),
    [customConfig]
  );

  const [items, setItems] = useState<ContextItem[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const itemIdCounter = useRef(0);

  // Fetch workspace context
  const { data: workspaceData } = useSWR<WorkspaceContext>(
    workspaceSlug ? `${apiEndpoint}/workspace/${workspaceSlug}` : null,
    async url => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch workspace context');
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  // Fetch user context
  const { data: userData } = useSWR<UserContext>(
    `${apiEndpoint}/user`,
    async url => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch user context');
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  // Fetch session context
  const { data: sessionData } = useSWR<SessionContext>(
    sessionId ? `${apiEndpoint}/session/${sessionId}` : null,
    async url => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch session context');
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  const isLoading = (workspaceSlug && !workspaceData) || !userData;

  /**
   * Estimate token count for text
   */
  const estimateTokens = useCallback((text: string): number => {
    return Math.ceil(text.length * TOKENS_PER_CHAR);
  }, []);

  /**
   * Calculate total tokens
   */
  const totalTokens = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.tokens || 0), 0);
  }, [items]);

  /**
   * Add context item
   */
  const addItem = useCallback(
    (
      source: ContextSource,
      content: string,
      options?: {
        priority?: ContextPriority;
        metadata?: Record<string, unknown>;
        expiresIn?: number;
      }
    ) => {
      const newItem: ContextItem = {
        id: `ctx-${++itemIdCounter.current}`,
        source,
        priority: options?.priority || 'medium',
        content,
        metadata: options?.metadata,
        tokens: estimateTokens(content),
        createdAt: new Date(),
        expiresAt: options?.expiresIn
          ? new Date(Date.now() + options.expiresIn)
          : undefined,
      };

      setItems(prev => {
        const updated = [...prev, newItem];

        // Auto-prune if needed
        if (config.autoPrune) {
          const total = updated.reduce(
            (sum, item) => sum + (item.tokens || 0),
            0
          );
          if (total > config.maxTokens) {
            return pruneItems(updated, config.maxTokens, config.pruneStrategy);
          }
        }

        return updated;
      });
    },
    [config.autoPrune, config.maxTokens, config.pruneStrategy, estimateTokens]
  );

  /**
   * Remove context item
   */
  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  /**
   * Clear all context
   */
  const clear = useCallback(() => {
    setItems([]);
  }, []);

  /**
   * Prune items to fit target tokens
   */
  const pruneItems = (
    items: ContextItem[],
    targetTokens: number,
    strategy: ContextConfig['pruneStrategy']
  ): ContextItem[] => {
    let sorted = [...items];

    // Sort based on strategy
    switch (strategy) {
      case 'oldest':
        sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'lowest-priority':
        const priorityMap: Record<ContextPriority, number> = {
          critical: 4,
          high: 3,
          medium: 2,
          low: 1,
        };
        sorted.sort(
          (a, b) => priorityMap[a.priority] - priorityMap[b.priority]
        );
        break;
      case 'least-used':
        // Would need usage tracking - fallback to oldest
        sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
    }

    // Keep items until we hit the target
    const kept: ContextItem[] = [];
    let currentTokens = 0;

    for (const item of sorted.reverse()) {
      const itemTokens = item.tokens || 0;
      if (currentTokens + itemTokens <= targetTokens) {
        kept.push(item);
        currentTokens += itemTokens;
      } else {
        // Skip critical items from pruning
        if (item.priority === 'critical') {
          kept.push(item);
        }
      }
    }

    return kept;
  };

  /**
   * Prune low-priority context
   */
  const prune = useCallback(
    (targetTokens?: number) => {
      const target = targetTokens || config.maxTokens;
      setItems(prev => pruneItems(prev, target, config.pruneStrategy));
    },
    [config.maxTokens, config.pruneStrategy]
  );

  /**
   * Compress context (placeholder for future ML-based compression)
   */
  const compress = useCallback(() => {
    // For now, just prune to compression threshold
    const threshold = config.maxTokens * config.compressionThreshold;
    prune(threshold);
  }, [config.maxTokens, config.compressionThreshold, prune]);

  /**
   * Build prompt with injected context
   */
  const buildPrompt = useCallback(
    (userPrompt: string): string => {
      if (config.strategy === 'system' || config.strategy === 'metadata') {
        // Context not included in user prompt
        return userPrompt;
      }

      // Remove expired items
      const validItems = items.filter(
        item => !item.expiresAt || item.expiresAt > new Date()
      );

      // Sort by priority
      const priorityMap: Record<ContextPriority, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const sorted = [...validItems].sort(
        (a, b) => priorityMap[b.priority] - priorityMap[a.priority]
      );

      const contextText = sorted.map(item => item.content).join('\n\n');

      if (config.strategy === 'prepend') {
        return `${contextText}\n\n${userPrompt}`;
      } else {
        // append
        return `${userPrompt}\n\n${contextText}`;
      }
    },
    [items, config.strategy]
  );

  /**
   * Get context as system message
   */
  const getSystemMessage = useCallback((): string => {
    const validItems = items.filter(
      item => !item.expiresAt || item.expiresAt > new Date()
    );

    const sections: string[] = [];

    // Add workspace context
    if (workspaceData) {
      sections.push(
        `Workspace: ${workspaceData.name}${workspaceData.description ? `\nDescription: ${workspaceData.description}` : ''}`
      );
    }

    // Add user context
    if (userData) {
      sections.push(
        `User: ${userData.name} (${userData.email})${userData.role ? `\nRole: ${userData.role}` : ''}`
      );
    }

    // Add session context
    if (sessionData) {
      sections.push(
        `Session started: ${sessionData.startedAt.toISOString()}\nMessage count: ${sessionData.messageCount}${sessionData.topics?.length ? `\nTopics: ${sessionData.topics.join(', ')}` : ''}`
      );
    }

    // Add entity type
    if (entityType) {
      sections.push(`Entity type: ${entityType}`);
    }

    // Add custom context items
    const priorityMap: Record<ContextPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const sorted = [...validItems].sort(
      (a, b) => priorityMap[b.priority] - priorityMap[a.priority]
    );

    sorted.forEach(item => {
      sections.push(`[${item.source}] ${item.content}`);
    });

    return sections.join('\n\n');
  }, [items, workspaceData, userData, sessionData, entityType]);

  /**
   * Get context metadata
   */
  const getMetadata = useCallback((): Record<string, unknown> => {
    return {
      workspace: workspaceData,
      user: userData,
      session: sessionData,
      entityType,
      customItems: items.map(item => ({
        source: item.source,
        priority: item.priority,
        metadata: item.metadata,
      })),
    };
  }, [items, workspaceData, userData, sessionData, entityType]);

  /**
   * Refresh context from sources
   */
  const refresh = useCallback(async () => {
    try {
      // Trigger SWR revalidation
      // This would be implemented with mutate() from SWR
      // For now, just clear expired items
      setItems(prev =>
        prev.filter(item => !item.expiresAt || item.expiresAt > new Date())
      );
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to refresh context');
      setError(error);
    }
  }, []);

  /**
   * Auto-gather context on mount
   */
  useEffect(() => {
    if (!autoGather) return;

    // Add workspace context
    if (workspaceData) {
      const content = `Workspace: ${workspaceData.name}${workspaceData.description ? `. ${workspaceData.description}` : ''}`;
      addItem('workspace', content, {
        priority: 'high',
        metadata: workspaceData as unknown as Record<string, unknown>,
      });
    }

    // Add user context
    if (userData) {
      const content = `User: ${userData.name} (${userData.role || 'member'})`;
      addItem('user', content, {
        priority: 'medium',
        metadata: userData as unknown as Record<string, unknown>,
      });
    }

    // Add session context
    if (sessionData) {
      const content = `Session: ${sessionData.messageCount} messages exchanged`;
      addItem('session', content, {
        priority: 'low',
        metadata: sessionData as unknown as Record<string, unknown>,
      });
    }
  }, [autoGather, workspaceData, userData, sessionData]); // Intentionally not including addItem

  /**
   * Notify on context updates
   */
  useEffect(() => {
    onContextUpdate?.(items);
  }, [items, onContextUpdate]);

  /**
   * Clean up expired items periodically
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setItems(prev =>
        prev.filter(item => !item.expiresAt || item.expiresAt > new Date())
      );
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return {
    items,
    totalTokens,
    isLoading,
    error,
    addItem,
    removeItem,
    clear,
    workspaceContext: workspaceData || null,
    userContext: userData || null,
    sessionContext: sessionData || null,
    buildPrompt,
    getSystemMessage,
    getMetadata,
    compress,
    prune,
    refresh,
  };
}
