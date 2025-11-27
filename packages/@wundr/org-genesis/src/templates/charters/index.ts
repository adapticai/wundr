/**
 * @packageDocumentation
 * Built-in charter templates.
 *
 * This module exports charter templates for Orchestrator (Orchestrator) entities
 * and Session Manager entities. Charters define the identity, capabilities,
 * constraints, and governance rules for organizational entities.
 *
 * @module templates/charters
 *
 * @example
 * ```typescript
 * import {
 *   ORCHESTRATOR_CHARTER_TEMPLATE_VERSION,
 *   SESSION_MANAGER_TEMPLATE_VERSION,
 * } from '@wundr/org-genesis/templates/charters';
 *
 * console.log(`Orchestrator Template: v${ORCHESTRATOR_CHARTER_TEMPLATE_VERSION}`);
 * console.log(`Session Manager Template: v${SESSION_MANAGER_TEMPLATE_VERSION}`);
 * ```
 */

// Import versions for aggregation
import { SESSION_MANAGER_TEMPLATE_VERSION } from './session-manager-template.js';
import { ORCHESTRATOR_CHARTER_TEMPLATE_VERSION } from './orchestrator-template.js';

// Re-export Session Manager charter template
export * from './session-manager-template.js';

// Re-export Orchestrator charter template
export * from './orchestrator-template.js';

/**
 * Version identifier for all charter templates.
 *
 * @remarks
 * This is the aggregate version for the charter templates module.
 * Individual templates may have their own version identifiers.
 */
export const CHARTER_TEMPLATES_VERSION = '1.0.0';

/**
 * Available charter template types.
 *
 * @remarks
 * These are the types of charter templates available in the system:
 * - `orchestrator` - Orchestrator charter template for Tier 1 entities
 * - `session-manager` - Session Manager charter template for session coordination
 */
export const CHARTER_TEMPLATE_TYPES = ['orchestrator', 'session-manager'] as const;

/**
 * Type representing available charter template types.
 */
export type CharterTemplateType = (typeof CHARTER_TEMPLATE_TYPES)[number];

/**
 * Map of charter template types to their version identifiers.
 *
 * @example
 * ```typescript
 * import { CHARTER_TEMPLATE_VERSIONS } from '@wundr/org-genesis/templates/charters';
 *
 * const orchestratorVersion = CHARTER_TEMPLATE_VERSIONS.orchestrator;
 * console.log(`Orchestrator Charter version: ${orchestratorVersion}`);
 * ```
 */
export const CHARTER_TEMPLATE_VERSIONS: Record<CharterTemplateType, string> = {
  'session-manager': SESSION_MANAGER_TEMPLATE_VERSION,
  orchestrator: ORCHESTRATOR_CHARTER_TEMPLATE_VERSION,
};
