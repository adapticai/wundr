/**
 * @packageDocumentation
 * Built-in discipline templates.
 *
 * This module exports all built-in discipline pack templates used for
 * organizational generation. Each discipline defines a complete configuration
 * bundle including CLAUDE.md settings, MCP servers, hooks, and agent mappings.
 *
 * @module templates/disciplines
 *
 * @example
 * ```typescript
 * import {
 *   ENGINEERING_DISCIPLINE_ID,
 *   LEGAL_DISCIPLINE_ID,
 *   ALL_DISCIPLINE_IDS,
 * } from '@wundr/org-genesis/templates/disciplines';
 *
 * // Check if a discipline is built-in
 * if (ALL_DISCIPLINE_IDS.includes(disciplineId)) {
 *   console.log('Built-in discipline');
 * }
 * ```
 */

// Re-export all discipline templates
export * from './engineering.js';
export * from './legal.js';
export * from './hr.js';
export * from './marketing.js';
export * from './finance.js';
export * from './operations.js';

// Import discipline IDs for aggregation
import { ENGINEERING_DISCIPLINE_ID } from './engineering.js';
import { LEGAL_DISCIPLINE_ID } from './legal.js';
import { HR_DISCIPLINE_ID } from './hr.js';
import { MARKETING_DISCIPLINE_ID } from './marketing.js';
import { FINANCE_DISCIPLINE_ID } from './finance.js';
import { OPERATIONS_DISCIPLINE_ID } from './operations.js';

/**
 * Array of all built-in discipline IDs.
 *
 * @remarks
 * This array contains the identifiers for all pre-defined discipline templates
 * that ship with the org-genesis package. These can be used to quickly bootstrap
 * organizational structures or as references for creating custom disciplines.
 *
 * @example
 * ```typescript
 * import { ALL_DISCIPLINE_IDS } from '@wundr/org-genesis/templates/disciplines';
 *
 * // Iterate over all built-in disciplines
 * for (const id of ALL_DISCIPLINE_IDS) {
 *   console.log(`Available discipline: ${id}`);
 * }
 * ```
 */
export const ALL_DISCIPLINE_IDS: readonly string[] = [
  ENGINEERING_DISCIPLINE_ID,
  LEGAL_DISCIPLINE_ID,
  HR_DISCIPLINE_ID,
  MARKETING_DISCIPLINE_ID,
  FINANCE_DISCIPLINE_ID,
  OPERATIONS_DISCIPLINE_ID,
] as const;

/**
 * Version identifier for the discipline templates.
 *
 * @remarks
 * Used for compatibility checking and cache invalidation when
 * discipline templates are updated.
 */
export const DISCIPLINE_TEMPLATES_VERSION = '1.0.0';
