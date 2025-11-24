/**
 * @packageDocumentation
 * Built-in templates for organizational generation.
 *
 * This module serves as the main entry point for all template modules,
 * including disciplines, charters, and agents. Templates provide
 * pre-configured building blocks for generating organizational structures.
 *
 * @module templates
 *
 * @example
 * ```typescript
 * import {
 *   // Discipline templates
 *   ENGINEERING_DISCIPLINE_ID,
 *   ALL_DISCIPLINE_IDS,
 *
 *   // Charter templates
 *   VP_CHARTER_TEMPLATE_VERSION,
 *   CHARTER_TEMPLATE_TYPES,
 *
 *   // Agent templates
 *   UNIVERSAL_AGENTS_VERSION,
 *   AGENT_TEMPLATE_CATEGORIES,
 *
 *   // Version info
 *   TEMPLATES_VERSION,
 * } from '@wundr/org-genesis/templates';
 * ```
 */

// Re-export all discipline templates
export * from './disciplines/index.js';

// Re-export all charter templates
export * from './charters/index.js';

// Re-export all agent templates
export * from './agents/index.js';

/**
 * Version identifier for the templates module.
 *
 * @remarks
 * This is the aggregate version for all template modules.
 * Individual modules may have their own version identifiers.
 */
export const TEMPLATES_VERSION = '1.0.0';

/**
 * Available template module types.
 *
 * @remarks
 * Templates are organized into three main categories:
 * - `disciplines` - Work domain configuration bundles
 * - `charters` - Entity identity and governance definitions
 * - `agents` - Worker agent definitions and capabilities
 */
export const TEMPLATE_MODULES = ['disciplines', 'charters', 'agents'] as const;

/**
 * Type representing available template module types.
 */
export type TemplateModule = (typeof TEMPLATE_MODULES)[number];
