/**
 * @neolith/core - Agent Enumerations
 *
 * Shared enumerations for agent-related entities.
 *
 * @packageDocumentation
 */

/**
 * Status of an agent (Session Manager or Subagent).
 */
export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ERROR';

/**
 * Scope of a subagent's visibility.
 */
export type AgentScope = 'UNIVERSAL' | 'DISCIPLINE' | 'WORKSPACE' | 'PRIVATE';

/**
 * Type guard for AgentStatus.
 */
export function isAgentStatus(value: unknown): value is AgentStatus {
  return ['ACTIVE', 'INACTIVE', 'PAUSED', 'ERROR'].includes(value as string);
}

/**
 * Type guard for AgentScope.
 */
export function isAgentScope(value: unknown): value is AgentScope {
  return ['UNIVERSAL', 'DISCIPLINE', 'WORKSPACE', 'PRIVATE'].includes(value as string);
}
