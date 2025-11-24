/**
 * @packageDocumentation
 * Built-in agent templates.
 *
 * This module exports agent templates for both universal agents (available
 * across all disciplines) and specialized agents (domain-specific capabilities).
 *
 * @module templates/agents
 *
 * @example
 * ```typescript
 * import {
 *   UNIVERSAL_AGENTS_VERSION,
 *   SPECIALIZED_AGENTS_VERSION,
 *   AGENT_TEMPLATES_VERSION,
 * } from '@wundr/org-genesis/templates/agents';
 *
 * console.log(`Universal Agents: v${UNIVERSAL_AGENTS_VERSION}`);
 * console.log(`Specialized Agents: v${SPECIALIZED_AGENTS_VERSION}`);
 * ```
 */

// Re-export universal agent templates
// Import versions for aggregation
import { SPECIALIZED_AGENTS_VERSION } from './specialized-agents.js';
import { UNIVERSAL_AGENTS_VERSION } from './universal-agents.js';

export * from './universal-agents.js';

// Re-export specialized agent templates
export * from './specialized-agents.js';

/**
 * Version identifier for all agent templates.
 *
 * @remarks
 * This is the aggregate version for the agent templates module.
 * Individual template categories may have their own version identifiers.
 */
export const AGENT_TEMPLATES_VERSION = '1.0.0';

/**
 * Available agent template categories.
 *
 * @remarks
 * Agent templates are organized into categories:
 * - `universal` - Agents available across all disciplines
 * - `specialized` - Domain-specific agents for particular disciplines
 */
export const AGENT_TEMPLATE_CATEGORIES = ['universal', 'specialized'] as const;

/**
 * Type representing available agent template categories.
 */
export type AgentTemplateCategory = (typeof AGENT_TEMPLATE_CATEGORIES)[number];

/**
 * Map of agent template categories to their version identifiers.
 *
 * @example
 * ```typescript
 * import { AGENT_TEMPLATE_VERSIONS } from '@wundr/org-genesis/templates/agents';
 *
 * const universalVersion = AGENT_TEMPLATE_VERSIONS.universal;
 * console.log(`Universal agents version: ${universalVersion}`);
 * ```
 */
export const AGENT_TEMPLATE_VERSIONS: Record<AgentTemplateCategory, string> = {
  universal: UNIVERSAL_AGENTS_VERSION,
  specialized: SPECIALIZED_AGENTS_VERSION,
};
