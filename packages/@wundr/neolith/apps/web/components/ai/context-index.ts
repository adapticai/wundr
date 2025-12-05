/**
 * AI Context Components Index
 *
 * Export point for AI context-related components.
 */

export { ContextSources } from './context-sources';
export { ContextPreview } from './context-preview';
export { ContextManager } from './context-manager';

// Re-export types
export type {
  ContextSource,
  ContextItem,
  BuiltContext,
} from '@/lib/ai/context-builder';
