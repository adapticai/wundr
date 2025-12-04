/**
 * Type definitions for AI chat functionality
 */

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export type EntityType =
  | 'workspace'
  | 'orchestrator'
  | 'session-manager'
  | 'workflow'
  | 'channel'
  | 'subagent';

export interface ExtractedEntityData {
  entityType: EntityType;
  name: string;
  description: string;
  confidence: number;
  fields: Record<string, unknown>;
  missingFields: string[];
}

export interface ChatConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentMessageId?: string;
  buffer: string;
}

/**
 * Get display name for an entity type
 */
export function getEntityDisplayName(entityType: EntityType): string {
  const displayNames: Record<EntityType, string> = {
    workspace: 'Workspace',
    orchestrator: 'Orchestrator',
    'session-manager': 'Session Manager',
    workflow: 'Workflow',
    channel: 'Channel',
    subagent: 'Subagent',
  };

  return displayNames[entityType] || entityType;
}
