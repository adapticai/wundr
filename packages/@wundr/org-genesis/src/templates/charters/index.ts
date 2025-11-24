/**
 * @packageDocumentation
 * Built-in charter templates.
 *
 * This module exports charter templates for VP (Virtual Person) entities
 * and Session Manager entities. Charters define the identity, capabilities,
 * constraints, and governance rules for organizational entities.
 *
 * @module templates/charters
 *
 * @example
 * ```typescript
 * import {
 *   VP_CHARTER_TEMPLATE_VERSION,
 *   SESSION_MANAGER_TEMPLATE_VERSION,
 * } from '@wundr/org-genesis/templates/charters';
 *
 * console.log(`VP Template: v${VP_CHARTER_TEMPLATE_VERSION}`);
 * console.log(`Session Manager Template: v${SESSION_MANAGER_TEMPLATE_VERSION}`);
 * ```
 */

// Import versions for aggregation
import { SESSION_MANAGER_TEMPLATE_VERSION } from './session-manager-template.js';
import { VP_CHARTER_TEMPLATE_VERSION } from './vp-template.js';

// Re-export Session Manager charter template
export * from './session-manager-template.js';

// Re-export VP charter template
export * from './vp-template.js';

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
 * - `vp` - Virtual Person charter template for Tier 1 entities
 * - `session-manager` - Session Manager charter template for session coordination
 */
export const CHARTER_TEMPLATE_TYPES = ['vp', 'session-manager'] as const;

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
 * const vpVersion = CHARTER_TEMPLATE_VERSIONS.vp;
 * console.log(`VP Charter version: ${vpVersion}`);
 * ```
 */
export const CHARTER_TEMPLATE_VERSIONS: Record<CharterTemplateType, string> = {
  'session-manager': SESSION_MANAGER_TEMPLATE_VERSION,
  vp: VP_CHARTER_TEMPLATE_VERSION,
};
