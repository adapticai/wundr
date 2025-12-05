'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import type { EntityType } from '@/lib/ai/types';

/**
 * Suggestion source types
 */
export type SuggestionSource =
  | 'ai'
  | 'history'
  | 'template'
  | 'popular'
  | 'recent';

/**
 * Suggestion priority levels
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * Smart suggestion item
 */
export interface Suggestion {
  id: string;
  content: string;
  source: SuggestionSource;
  priority: SuggestionPriority;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Suggestion category
 */
export interface SuggestionCategory {
  id: string;
  name: string;
  description?: string;
  suggestions: Suggestion[];
}

/**
 * Suggestion context for AI generation
 */
export interface SuggestionContext {
  entityType?: EntityType;
  currentInput?: string;
  previousMessages?: string[];
  userPreferences?: Record<string, unknown>;
  workspaceContext?: Record<string, unknown>;
}

/**
 * Options for useAISuggestions hook
 */
export interface UseAISuggestionsOptions {
  /** Context for generating suggestions */
  context?: SuggestionContext;
  /** Maximum number of suggestions */
  maxSuggestions?: number;
  /** Minimum relevance score (0-1) */
  minRelevanceScore?: number;
  /** Enable real-time suggestions */
  realTime?: boolean;
  /** Debounce delay for real-time suggestions (ms) */
  debounceDelay?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
  /** Custom API endpoint */
  apiEndpoint?: string;
  /** Callback when suggestions update */
  onSuggestionsUpdate?: (suggestions: Suggestion[]) => void;
  /** Callback when suggestion selected */
  onSuggestionSelect?: (suggestion: Suggestion) => void;
}

/**
 * Return type for useAISuggestions hook
 */
export interface UseAISuggestionsReturn {
  /** Current suggestions */
  suggestions: Suggestion[];
  /** Suggestions grouped by category */
  categorizedSuggestions: SuggestionCategory[];
  /** Whether suggestions are loading */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
  /** Refresh suggestions */
  refresh: () => Promise<void>;
  /** Generate new suggestions based on input */
  generate: (input: string) => Promise<void>;
  /** Accept a suggestion */
  accept: (suggestionId: string) => void;
  /** Dismiss a suggestion */
  dismiss: (suggestionId: string) => void;
  /** Clear all suggestions */
  clear: () => void;
  /** Add custom suggestion */
  addCustom: (content: string, metadata?: Record<string, unknown>) => void;
}

const DEFAULT_MAX_SUGGESTIONS = 5;
const DEFAULT_MIN_RELEVANCE = 0.5;
const DEFAULT_DEBOUNCE_DELAY = 300;
const DEFAULT_CACHE_TTL = 300; // 5 minutes

/**
 * Hook for AI-powered smart suggestions
 *
 * Features:
 * - Real-time suggestion generation
 * - Multiple suggestion sources (AI, history, templates)
 * - Relevance scoring and ranking
 * - Debounced input handling
 * - Caching with TTL
 * - Categorization
 * - Usage tracking for learning
 *
 * @example
 * ```tsx
 * const { suggestions, generate, accept } = useAISuggestions({
 *   context: {
 *     entityType: 'workspace',
 *     currentInput: 'Create a ',
 *   },
 *   realTime: true,
 *   onSuggestionSelect: (s) => console.log('Selected:', s.content),
 * });
 *
 * // Generate suggestions
 * await generate('project management');
 *
 * // Accept a suggestion
 * accept(suggestions[0].id);
 * ```
 */
export function useAISuggestions(
  options: UseAISuggestionsOptions = {}
): UseAISuggestionsReturn {
  const {
    context,
    maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
    minRelevanceScore = DEFAULT_MIN_RELEVANCE,
    realTime = false,
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    enableCache = true,
    cacheTTL = DEFAULT_CACHE_TTL,
    apiEndpoint = '/api/ai/suggestions',
    onSuggestionsUpdate,
    onSuggestionSelect,
  } = options;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastInputRef = useRef<string>('');

  // Generate cache key
  const cacheKey = useMemo(() => {
    if (!enableCache) return null;
    const key = JSON.stringify({
      entityType: context?.entityType,
      input: context?.currentInput,
    });
    return `ai-suggestions-${key}`;
  }, [enableCache, context?.entityType, context?.currentInput]);

  // SWR for cached suggestions
  const { data: cachedData, mutate } = useSWR<Suggestion[]>(cacheKey, null, {
    revalidateOnFocus: false,
    dedupingInterval: cacheTTL * 1000,
  });

  /**
   * Calculate relevance score based on context
   */
  const calculateRelevance = useCallback(
    (suggestion: Suggestion, input: string): number => {
      let score = suggestion.relevanceScore || 0.5;

      // Boost score for exact matches
      if (suggestion.content.toLowerCase().includes(input.toLowerCase())) {
        score += 0.2;
      }

      // Boost score based on source
      const sourceBoost: Record<SuggestionSource, number> = {
        ai: 0.1,
        history: 0.15,
        template: 0.05,
        popular: 0.1,
        recent: 0.2,
      };
      score += sourceBoost[suggestion.source] || 0;

      // Boost score based on priority
      const priorityBoost: Record<SuggestionPriority, number> = {
        high: 0.15,
        medium: 0.05,
        low: 0,
      };
      score += priorityBoost[suggestion.priority] || 0;

      return Math.min(score, 1);
    },
    []
  );

  /**
   * Fetch suggestions from API
   */
  const fetchSuggestions = useCallback(
    async (input: string): Promise<Suggestion[]> => {
      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            context,
            maxSuggestions,
            minRelevanceScore,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch suggestions: ${response.statusText}`
          );
        }

        const data = await response.json();
        return data.suggestions || [];
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return [];
        }
        throw err;
      }
    },
    [apiEndpoint, context, maxSuggestions, minRelevanceScore]
  );

  /**
   * Get suggestions from history
   */
  const getHistorySuggestions = useCallback((): Suggestion[] => {
    const historyKey = 'ai-suggestion-history';
    const stored = localStorage.getItem(historyKey);
    if (!stored) return [];

    try {
      const history: string[] = JSON.parse(stored);
      return history.slice(0, 3).map((content, i) => ({
        id: `history-${i}`,
        content,
        source: 'history' as const,
        priority: 'medium' as const,
        relevanceScore: 0.7,
        createdAt: new Date(),
      }));
    } catch {
      return [];
    }
  }, []);

  /**
   * Get template suggestions based on entity type
   */
  const getTemplateSuggestions = useCallback((): Suggestion[] => {
    const templates: Record<EntityType, string[]> = {
      workspace: [
        'Create a project management workspace',
        'Set up a development team workspace',
        'Build a customer support workspace',
      ],
      orchestrator: [
        'Create a customer support agent',
        'Build a project manager assistant',
        'Set up a code review orchestrator',
      ],
      'session-manager': [
        'Add a support channel manager',
        'Create a sales pipeline manager',
        'Set up a development workflow manager',
      ],
      workflow: [
        'Automate daily standup reporting',
        'Create a deployment approval workflow',
        'Build a customer onboarding sequence',
      ],
      channel: [
        'Create a general discussion channel',
        'Set up a team announcements channel',
        'Build a project updates channel',
      ],
      subagent: [
        'Add a data analysis specialist',
        'Create a documentation writer',
        'Set up a testing automation agent',
      ],
    };

    const entityType = context?.entityType;
    if (!entityType || !templates[entityType]) return [];

    return templates[entityType].map((content, i) => ({
      id: `template-${entityType}-${i}`,
      content,
      source: 'template' as const,
      priority: 'low' as const,
      relevanceScore: 0.6,
      createdAt: new Date(),
    }));
  }, [context?.entityType]);

  /**
   * Generate suggestions
   */
  const generate = useCallback(
    async (input: string) => {
      if (input === lastInputRef.current) return;
      lastInputRef.current = input;

      setIsLoading(true);
      setError(null);

      try {
        // Combine suggestions from multiple sources
        const [aiSuggestions, historySuggestions, templateSuggestions] =
          await Promise.all([
            fetchSuggestions(input).catch(() => []),
            Promise.resolve(getHistorySuggestions()),
            Promise.resolve(getTemplateSuggestions()),
          ]);

        const allSuggestions = [
          ...aiSuggestions,
          ...historySuggestions,
          ...templateSuggestions,
        ];

        // Calculate relevance and filter
        const scoredSuggestions = allSuggestions
          .map(s => ({
            ...s,
            relevanceScore: calculateRelevance(s, input),
          }))
          .filter(s => s.relevanceScore >= minRelevanceScore)
          .filter(s => !dismissedIds.has(s.id));

        // Sort by relevance and limit
        const topSuggestions = scoredSuggestions
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, maxSuggestions);

        setSuggestions(topSuggestions);
        onSuggestionsUpdate?.(topSuggestions);

        // Update cache
        if (enableCache && cacheKey) {
          await mutate(topSuggestions, false);
        }
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to generate suggestions');
        setError(error);
        console.error('[useAISuggestions] Error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      fetchSuggestions,
      getHistorySuggestions,
      getTemplateSuggestions,
      calculateRelevance,
      minRelevanceScore,
      maxSuggestions,
      dismissedIds,
      onSuggestionsUpdate,
      enableCache,
      cacheKey,
      mutate,
    ]
  );

  /**
   * Debounced generate for real-time suggestions
   */
  const debouncedGenerate = useCallback(
    (input: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        generate(input);
      }, debounceDelay);
    },
    [generate, debounceDelay]
  );

  /**
   * Accept a suggestion
   */
  const accept = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (!suggestion) return;

      // Save to history
      const historyKey = 'ai-suggestion-history';
      const stored = localStorage.getItem(historyKey);
      const history: string[] = stored ? JSON.parse(stored) : [];

      // Add to front and limit to 10
      const updated = [
        suggestion.content,
        ...history.filter(h => h !== suggestion.content),
      ].slice(0, 10);
      localStorage.setItem(historyKey, JSON.stringify(updated));

      // Track usage for learning
      const usageKey = 'ai-suggestion-usage';
      const usageStored = localStorage.getItem(usageKey);
      const usage: Record<string, number> = usageStored
        ? JSON.parse(usageStored)
        : {};
      usage[suggestionId] = (usage[suggestionId] || 0) + 1;
      localStorage.setItem(usageKey, JSON.stringify(usage));

      onSuggestionSelect?.(suggestion);
    },
    [suggestions, onSuggestionSelect]
  );

  /**
   * Dismiss a suggestion
   */
  const dismiss = useCallback((suggestionId: string) => {
    setDismissedIds(prev => new Set([...prev, suggestionId]));
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  /**
   * Clear all suggestions
   */
  const clear = useCallback(() => {
    setSuggestions([]);
    setDismissedIds(new Set());
    setError(null);
    lastInputRef.current = '';

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    abortControllerRef.current?.abort();
  }, []);

  /**
   * Add custom suggestion
   */
  const addCustom = useCallback(
    (content: string, metadata?: Record<string, unknown>) => {
      const customSuggestion: Suggestion = {
        id: `custom-${Date.now()}`,
        content,
        source: 'ai',
        priority: 'high',
        relevanceScore: 1,
        metadata,
        createdAt: new Date(),
      };

      setSuggestions(prev =>
        [customSuggestion, ...prev].slice(0, maxSuggestions)
      );
    },
    [maxSuggestions]
  );

  /**
   * Refresh suggestions
   */
  const refresh = useCallback(async () => {
    const input = context?.currentInput || '';
    await generate(input);
  }, [context?.currentInput, generate]);

  // Real-time suggestions on input change
  useEffect(() => {
    if (realTime && context?.currentInput) {
      debouncedGenerate(context.currentInput);
    }
  }, [realTime, context?.currentInput, debouncedGenerate]);

  // Load cached suggestions on mount
  useEffect(() => {
    if (cachedData) {
      setSuggestions(cachedData);
    }
  }, [cachedData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Categorize suggestions
   */
  const categorizedSuggestions = useMemo((): SuggestionCategory[] => {
    const categories = new Map<SuggestionSource, Suggestion[]>();

    suggestions.forEach(suggestion => {
      const existing = categories.get(suggestion.source) || [];
      categories.set(suggestion.source, [...existing, suggestion]);
    });

    const categoryNames: Record<SuggestionSource, string> = {
      ai: 'AI Recommendations',
      history: 'From Your History',
      template: 'Templates',
      popular: 'Popular Choices',
      recent: 'Recently Used',
    };

    return Array.from(categories.entries()).map(([source, items]) => ({
      id: source,
      name: categoryNames[source],
      suggestions: items,
    }));
  }, [suggestions]);

  return {
    suggestions,
    categorizedSuggestions,
    isLoading,
    error,
    refresh,
    generate,
    accept,
    dismiss,
    clear,
    addCustom,
  };
}
