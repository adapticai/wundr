/**
 * @genesis/core - Utility Functions
 *
 * Common utility functions for the core service layer.
 *
 * @packageDocumentation
 */

import * as crypto from 'crypto';

// =============================================================================
// Slug Generation
// =============================================================================

/**
 * Generates a URL-safe slug from a string.
 *
 * @param input - The string to convert to a slug
 * @param options - Configuration options for slug generation
 * @returns A URL-safe slug
 *
 * @example
 * ```typescript
 * generateSlug('John Doe - OrchestratorEngineering');
 * // Returns: 'john-doe-orchestrator-engineering'
 *
 * generateSlug('Test User', { appendUniqueSuffix: true });
 * // Returns: 'test-user-a1b2c3'
 * ```
 */
export function generateSlug(
  input: string,
  options: {
    maxLength?: number;
    separator?: string;
    appendUniqueSuffix?: boolean;
  } = {},
): string {
  const { maxLength = 50, separator = '-', appendUniqueSuffix = false } = options;

  // Convert to lowercase and replace non-alphanumeric chars with separator
  let slug = input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/[\s_-]+/g, separator) // Replace spaces, underscores, hyphens with separator
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), ''); // Trim separators from ends

  // Truncate if necessary (leave room for suffix if needed)
  const suffixLength = appendUniqueSuffix ? 8 : 0;
  const targetLength = maxLength - suffixLength;

  if (slug.length > targetLength) {
    slug = slug.substring(0, targetLength).replace(new RegExp(`${separator}+$`), '');
  }

  // Append unique suffix if requested
  if (appendUniqueSuffix) {
    const suffix = generateShortId();
    slug = `${slug}${separator}${suffix}`;
  }

  return slug;
}

/**
 * Generates a unique email address for a Orchestrator.
 *
 * @param name - The Orchestrator's name
 * @param organizationSlug - The organization's slug
 * @param domain - The email domain (default: 'vp.genesis.local')
 * @returns A unique email address
 */
export function generateOrchestratorEmail(
  name: string,
  organizationSlug: string,
  domain: string = 'vp.genesis.local',
): string {
  const slug = generateSlug(name, { maxLength: 30 });
  const uniqueId = generateShortId(6);
  return `${slug}-${uniqueId}@${organizationSlug}.${domain}`;
}

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generates a short unique identifier.
 *
 * @param length - The length of the ID (default: 8)
 * @returns A random alphanumeric string
 */
export function generateShortId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += chars[byte % chars.length];
    }
  }

  return result;
}

/**
 * Generates a CUID-like identifier.
 * Note: For actual CUIDs, use the Prisma @default(cuid()) directive.
 *
 * @returns A CUID-like string
 */
export function generateCUID(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `c${timestamp}${randomPart}`;
}

// =============================================================================
// API Key Generation
// =============================================================================

/**
 * Generates a secure API key.
 *
 * @param prefix - Optional prefix for the key (e.g., 'gns_' for genesis)
 * @returns A secure API key string
 *
 * @example
 * ```typescript
 * const key = generateAPIKey('gns_');
 * // Returns: 'gns_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
 * ```
 */
export function generateAPIKey(prefix: string = 'gns_'): string {
  // Generate 32 bytes of random data (256 bits)
  const randomBytes = crypto.randomBytes(32);
  const base64 = randomBytes.toString('base64url');

  return `${prefix}${base64}`;
}

/**
 * Hashes an API key using SHA-256.
 *
 * @param key - The API key to hash
 * @returns The SHA-256 hash of the key
 */
export function hashAPIKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Extracts the prefix from an API key for identification.
 *
 * @param key - The full API key
 * @param prefixLength - Length of the prefix to extract (default: 12)
 * @returns The key prefix
 */
export function extractKeyPrefix(key: string, prefixLength: number = 12): string {
  return key.substring(0, prefixLength);
}

/**
 * Validates the format of an API key.
 *
 * @param key - The API key to validate
 * @param expectedPrefix - Expected prefix (default: 'gns_')
 * @returns Whether the key format is valid
 */
export function isValidAPIKeyFormat(key: string, expectedPrefix: string = 'gns_'): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  if (!key.startsWith(expectedPrefix)) {
    return false;
  }

  // Key should be prefix + 43 base64url chars (32 bytes = 43 base64 chars)
  const expectedLength = expectedPrefix.length + 43;
  if (key.length !== expectedLength) {
    return false;
  }

  // Check that the rest of the key is valid base64url
  const keyPart = key.substring(expectedPrefix.length);
  return /^[A-Za-z0-9_-]+$/.test(keyPart);
}

/**
 * Compares an API key with a stored hash using constant-time comparison.
 *
 * @param key - The API key to verify
 * @param storedHash - The stored hash to compare against
 * @returns Whether the key matches the hash
 */
export function verifyAPIKey(key: string, storedHash: string): boolean {
  const keyHash = hashAPIKey(key);

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(keyHash), Buffer.from(storedHash));
  } catch {
    // If buffers are different lengths, timingSafeEqual throws
    return false;
  }
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Checks if a date has expired.
 *
 * @param date - The date to check
 * @returns Whether the date has passed
 */
export function isExpired(date: Date | string | undefined): boolean {
  if (!date) {
    return false;
  }

  const expiry = typeof date === 'string' ? new Date(date) : date;
  return expiry.getTime() < Date.now();
}

/**
 * Creates an expiration date from now.
 *
 * @param days - Number of days until expiration
 * @returns The expiration date
 */
export function createExpirationDate(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validates an email address format.
 *
 * @param email - The email to validate
 * @returns Whether the email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a slug format.
 *
 * @param slug - The slug to validate
 * @returns Whether the slug format is valid
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

// =============================================================================
// Object Utilities
// =============================================================================

/**
 * Deep merges two objects, with the second object's values taking precedence.
 *
 * @param target - The target object
 * @param source - The source object to merge
 * @returns The merged object
 */
export function deepMerge<T extends object>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        targetValue as object,
        sourceValue as object,
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key as string] = sourceValue;
    }
  }

  return result;
}

/**
 * Safely gets a value from a nested object path.
 *
 * @param obj - The object to get the value from
 * @param path - The dot-separated path to the value
 * @param defaultValue - The default value if path doesn't exist
 * @returns The value at the path or the default value
 */
export function safeGet<T>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    if (typeof current !== 'object') {
      return defaultValue;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}
