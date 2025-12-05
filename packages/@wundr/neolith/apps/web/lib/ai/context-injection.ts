/**
 * Context Injection Utilities
 *
 * Helper functions for injecting context into AI prompts and managing context state.
 */

import {
  buildContext,
  formatContextForPrompt,
  type ContextSource,
} from './context-builder';
import { suggestContextSources } from './rag-retrieval';

/**
 * Context injection strategies
 */
export type InjectionStrategy = 'prepend' | 'append' | 'replace';

export interface InjectContextOptions {
  sources: ContextSource[];
  userMessage: string;
  workspaceId: string;
  userId: string;
  maxTokens?: number;
  strategy?: InjectionStrategy;
  systemPrompt?: string;
}

export interface InjectedPrompt {
  systemPrompt: string;
  userMessage: string;
  contextUsed: boolean;
  contextTokens: number;
  totalTokens: number;
}

/**
 * Inject context into a user message
 */
export async function injectContext(
  options: InjectContextOptions
): Promise<InjectedPrompt> {
  const {
    sources,
    userMessage,
    workspaceId,
    userId,
    maxTokens = 4000,
    strategy = 'prepend',
    systemPrompt = '',
  } = options;

  if (sources.length === 0) {
    return {
      systemPrompt,
      userMessage,
      contextUsed: false,
      contextTokens: 0,
      totalTokens: estimateMessageTokens(userMessage),
    };
  }

  // Build context
  const context = await buildContext({
    sources,
    maxTokens: maxTokens - estimateMessageTokens(userMessage) - 200, // Reserve space for message
    userId,
    query: userMessage,
  });

  const formattedContext = formatContextForPrompt(context);

  // Apply injection strategy
  let finalMessage: string;
  switch (strategy) {
    case 'prepend':
      finalMessage = `${formattedContext}\n\n---\n\nUser Question: ${userMessage}`;
      break;
    case 'append':
      finalMessage = `${userMessage}\n\n---\n\n${formattedContext}`;
      break;
    case 'replace':
      finalMessage = formattedContext;
      break;
    default:
      finalMessage = userMessage;
  }

  return {
    systemPrompt:
      systemPrompt +
      (systemPrompt ? '\n\n' : '') +
      "Use the provided context information to answer the user's question accurately.",
    userMessage: finalMessage,
    contextUsed: true,
    contextTokens: context.totalTokens,
    totalTokens: context.totalTokens + estimateMessageTokens(userMessage),
  };
}

/**
 * Estimate token count for a message
 */
function estimateMessageTokens(message: string): number {
  return Math.ceil(message.length / 4);
}

/**
 * Auto-suggest context sources based on user message
 */
export async function autoSuggestContext(
  userMessage: string,
  workspaceId: string,
  userId: string,
  limit = 5
): Promise<ContextSource[]> {
  try {
    return await suggestContextSources(userMessage, workspaceId, userId, limit);
  } catch (error) {
    console.error('[autoSuggestContext] Error:', error);
    return [];
  }
}

/**
 * Validate context sources before injection
 */
export async function validateSources(
  sources: ContextSource[],
  userId: string
): Promise<{
  valid: ContextSource[];
  invalid: ContextSource[];
  errors: string[];
}> {
  const valid: ContextSource[] = [];
  const invalid: ContextSource[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    // Basic validation
    if (!source.type || !source.id) {
      invalid.push(source);
      errors.push(`Invalid source: missing type or id`);
      continue;
    }

    // Type validation
    const validTypes: ContextSource['type'][] = [
      'workflow',
      'channel',
      'document',
      'message',
      'thread',
    ];
    if (!validTypes.includes(source.type)) {
      invalid.push(source);
      errors.push(`Invalid source type: ${source.type}`);
      continue;
    }

    valid.push(source);
  }

  return { valid, invalid, errors };
}

/**
 * Create a context cache key
 */
export function createContextCacheKey(
  sources: ContextSource[],
  query?: string
): string {
  const sourceIds = sources
    .map(s => `${s.type}:${s.id}`)
    .sort()
    .join('|');

  const queryPart = query ? `:${query.substring(0, 50)}` : '';
  return `ctx:${sourceIds}${queryPart}`;
}

/**
 * Merge multiple context sources with deduplication
 */
export function mergeSources(
  ...sourceLists: ContextSource[][]
): ContextSource[] {
  const seen = new Set<string>();
  const merged: ContextSource[] = [];

  for (const sources of sourceLists) {
    for (const source of sources) {
      const key = `${source.type}:${source.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(source);
      }
    }
  }

  return merged;
}

/**
 * Split sources by type
 */
export function splitSourcesByType(sources: ContextSource[]): {
  workflows: ContextSource[];
  channels: ContextSource[];
  documents: ContextSource[];
  messages: ContextSource[];
  threads: ContextSource[];
} {
  return {
    workflows: sources.filter(s => s.type === 'workflow'),
    channels: sources.filter(s => s.type === 'channel'),
    documents: sources.filter(s => s.type === 'document'),
    messages: sources.filter(s => s.type === 'message'),
    threads: sources.filter(s => s.type === 'thread'),
  };
}

/**
 * Calculate optimal token distribution across sources
 */
export function calculateTokenDistribution(
  sources: ContextSource[],
  totalTokens: number
): Map<string, number> {
  const distribution = new Map<string, number>();

  if (sources.length === 0) return distribution;

  // Calculate weights
  const totalWeight = sources.reduce((sum, s) => sum + (s.weight || 1.0), 0);

  // Distribute tokens proportionally
  for (const source of sources) {
    const weight = source.weight || 1.0;
    const tokens = Math.floor((weight / totalWeight) * totalTokens);
    distribution.set(`${source.type}:${source.id}`, tokens);
  }

  return distribution;
}

/**
 * Context injection for streaming responses
 */
export async function injectContextForStream(
  options: InjectContextOptions
): Promise<{
  initialPrompt: string;
  contextMetadata: {
    sources: ContextSource[];
    tokens: number;
    truncated: boolean;
  };
}> {
  const injected = await injectContext(options);

  return {
    initialPrompt: injected.userMessage,
    contextMetadata: {
      sources: options.sources,
      tokens: injected.contextTokens,
      truncated: false, // Would be determined by buildContext
    },
  };
}
