/**
 * Dynamic Prompting System for MCP Tools
 *
 * This module provides a dynamic prompting system that can hot-swap system prompts
 * based on detected context, supporting multiple persona merging strategies and
 * a library of reusable personas.
 *
 * @module mcp-tools/dynamic-prompting
 *
 * @example
 * ```typescript
 * import {
 *   createDynamicPromptManager,
 *   createPersonaLibrary,
 *   ContextDetector,
 * } from '@wundr/mcp-tools/dynamic-prompting';
 *
 * // Create a manager with default configuration
 * const manager = createDynamicPromptManager();
 *
 * // Resolve a system prompt based on context
 * const result = manager.resolveSystemPrompt(
 *   'Implement a new React component',
 *   ['src/components/Button.tsx'],
 *   ['frontend', 'implementation']
 * );
 *
 * console.log(result.systemPrompt);
 * console.log(result.activePersonas);
 * ```
 */

// Core types
export type {
  ContextSignals,
  DetectedContext,
  DetectionRule,
  DomainType,
  DynamicPromptConfig,
  DynamicPromptingArgs,
  DynamicPromptingResult,
  MergingStrategy,
  PersonaConfig,
  PersonaLibrary,
  PersonaPriority,
  ResolvedPrompt,
  TaskType,
} from './types.js';

// Context detection
export { ContextDetector } from './context-detector.js';

// Persona library
export {
  PersonaLibraryImpl,
  builtInPersonas,
  createPersonaLibrary,
} from './persona-library.js';

// Prompt manager
export {
  DynamicPromptManager,
  createDynamicPromptManager,
} from './prompt-manager.js';
