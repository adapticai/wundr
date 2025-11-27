/**
 * Slug and ID generation utilities
 *
 * This module provides utilities for generating URL-safe slugs and unique identifiers
 * for various entities in the organization genesis system. All generated IDs use UUIDv4
 * for uniqueness guarantees.
 *
 * @module utils/slug
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a URL-safe slug from a name.
 *
 * Converts a human-readable name into a URL-safe slug by:
 * 1. Converting to lowercase
 * 2. Trimming whitespace
 * 3. Replacing non-alphanumeric characters with hyphens
 * 4. Removing leading and trailing hyphens
 *
 * @param name - The human-readable name to convert
 * @returns A URL-safe slug string
 *
 * @example
 * ```typescript
 * generateSlug('My Organization Name'); // 'my-organization-name'
 * generateSlug('  Test & Demo!  '); // 'test-demo'
 * generateSlug('CamelCaseText'); // 'camelcasetext'
 * ```
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique ID with optional prefix.
 *
 * Creates a UUIDv4-based identifier, optionally prefixed with a type identifier
 * for easier categorization and debugging.
 *
 * @param prefix - Optional prefix to prepend to the UUID (e.g., 'vp', 'org')
 * @returns A unique identifier string in format `{prefix}_{uuid}` or just `{uuid}`
 *
 * @example
 * ```typescript
 * generateId(); // 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * generateId('user'); // 'user_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateId(prefix?: string): string {
  const uuid = uuidv4();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Generate a Orchestrator (VP) ID.
 *
 * Creates a unique identifier for a Orchestrator entity with the 'vp' prefix.
 *
 * @returns A Orchestrator-prefixed unique identifier (e.g., 'vp_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const vpId = generateOrchestratorId(); // 'vp_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateOrchestratorId(): string {
  return generateId('vp');
}

/**
 * Generate a discipline ID.
 *
 * Creates a unique identifier for a discipline/department entity with the 'disc' prefix.
 *
 * @returns A discipline-prefixed unique identifier (e.g., 'disc_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const disciplineId = generateDisciplineId(); // 'disc_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateDisciplineId(): string {
  return generateId('disc');
}

/**
 * Generate a session manager ID.
 *
 * Creates a unique identifier for a session manager entity with the 'sm' prefix.
 *
 * @returns A session manager-prefixed unique identifier (e.g., 'sm_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const smId = generateSessionManagerId(); // 'sm_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateSessionManagerId(): string {
  return generateId('sm');
}

/**
 * Generate an agent ID.
 *
 * Creates a unique identifier for an agent entity with the 'agent' prefix.
 *
 * @returns An agent-prefixed unique identifier (e.g., 'agent_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const agentId = generateAgentId(); // 'agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateAgentId(): string {
  return generateId('agent');
}

/**
 * Generate an organization ID.
 *
 * Creates a unique identifier for an organization entity with the 'org' prefix.
 *
 * @returns An organization-prefixed unique identifier (e.g., 'org_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const orgId = generateOrgId(); // 'org_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateOrgId(): string {
  return generateId('org');
}

/**
 * Generate a session ID.
 *
 * Creates a unique identifier for a session entity with the 'sess' prefix.
 *
 * @returns A session-prefixed unique identifier (e.g., 'sess_a1b2c3d4-...')
 *
 * @example
 * ```typescript
 * const sessionId = generateSessionId(); // 'sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 * ```
 */
export function generateSessionId(): string {
  return generateId('sess');
}

/**
 * Validate that a string is a valid slug.
 *
 * Checks if the provided string conforms to the slug format:
 * - Contains only lowercase letters and numbers
 * - Segments separated by single hyphens
 * - Does not start or end with a hyphen
 *
 * @param slug - The string to validate as a slug
 * @returns `true` if the string is a valid slug, `false` otherwise
 *
 * @example
 * ```typescript
 * isValidSlug('my-organization'); // true
 * isValidSlug('test123'); // true
 * isValidSlug('my-org-name'); // true
 * isValidSlug('Invalid Slug'); // false
 * isValidSlug('-invalid'); // false
 * isValidSlug('invalid-'); // false
 * isValidSlug(''); // false
 * ```
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Ensure a slug is unique by appending a number if needed.
 *
 * If the base slug already exists in the list of existing slugs,
 * appends an incrementing number until a unique slug is found.
 *
 * @param baseSlug - The desired slug to make unique
 * @param existingSlugs - Array of slugs that already exist
 * @returns A unique slug, either the original or with a numeric suffix
 *
 * @example
 * ```typescript
 * const existing = ['my-org', 'my-org-1', 'other-org'];
 *
 * ensureUniqueSlug('new-org', existing); // 'new-org' (not in list)
 * ensureUniqueSlug('my-org', existing); // 'my-org-2' (my-org and my-org-1 exist)
 * ensureUniqueSlug('other-org', existing); // 'other-org-1'
 * ```
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: string[],
): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let candidateSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(candidateSlug)) {
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }

  return candidateSlug;
}
