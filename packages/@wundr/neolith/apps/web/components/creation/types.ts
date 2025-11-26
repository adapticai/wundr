/**
 * Types for Conversational Entity Creation
 */

/**
 * Supported entity types for conversational creation
 */
export type EntityType =
  | 'workspace'
  | 'orchestrator'
  | 'session-manager'
  | 'subagent'
  | 'workflow'
  | 'channel';

/**
 * Generated specification for an entity
 */
export interface EntitySpec {
  /** Type of entity */
  entityType: EntityType;
  /** Entity name */
  name: string;
  /** Entity description/purpose */
  description: string;
  /** Role (for agents) */
  role?: string;
  /** Charter/instructions (for agents) */
  charter?: string;
  /** Confidence level (0-1) of how complete the spec is */
  confidence: number;
  /** Fields that are missing or need more information */
  missingFields: string[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Additional entity-specific properties */
  properties?: Record<string, unknown>;
}

/**
 * Chat message in the conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Workspace context for entity creation
 */
export interface WorkspaceContext {
  id: string;
  name: string;
  /** Existing orchestrators in workspace */
  orchestrators?: Array<{ id: string; name: string; role: string }>;
  /** Existing channels in workspace */
  channels?: Array<{ id: string; name: string; type: string }>;
  /** Existing workflows in workspace */
  workflows?: Array<{ id: string; name: string; description: string }>;
}

/**
 * Request body for conversation API
 */
export interface ConversationRequest {
  entityType: EntityType;
  messages: ChatMessage[];
  workspaceContext?: WorkspaceContext;
  existingSpec?: EntitySpec;
}

/**
 * Response from conversation API
 */
export interface ConversationResponse {
  message: string;
  spec?: EntitySpec;
  shouldGenerateSpec: boolean;
}
