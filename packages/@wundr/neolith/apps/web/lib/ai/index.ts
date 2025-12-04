/**
 * AI Library - Main Export
 *
 * Centralized exports for AI functionality including types, validation,
 * configuration, prompts, and greetings.
 *
 * @module lib/ai
 */

// Core types
export type {
  AIMessage,
  ToolCall,
  EntityType,
  ExtractedEntityData,
  ChatConfig,
  StreamingState,
} from './types';

export { getEntityDisplayName } from './types';

// Configuration
export {
  AI_CONFIG,
  getSystemPrompt,
  getDefaultChatConfig,
  type SystemPromptKey,
} from './config';

// Validation
export {
  ENTITY_SCHEMAS,
  validateEntityData,
  getRequiredFields,
  getOptionalFields,
} from './validation';

// Prompts
export { ENTITY_PROMPTS, getEntityPrompt } from './prompts';

// Greetings
export { ENTITY_GREETINGS, getGreeting } from './greetings';
