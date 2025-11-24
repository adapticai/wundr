/**
 * @genesis/org-integration - Utility Functions
 *
 * Helper utilities for slug generation, ID mapping, and data transformation.
 */

// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Generate a URL-safe slug from a string.
 *
 * @param input - Input string to slugify
 * @param options - Slug generation options
 * @returns URL-safe slug
 *
 * @example
 * ```ts
 * generateSlug('Risk Management') // 'risk-management'
 * generateSlug('VP of Engineering', { prefix: 'vp' }) // 'vp-engineering'
 * ```
 */
export function generateSlug(input: string, options: SlugOptions = {}): string {
  const { prefix, suffix, maxLength = 80, lowercase = true } = options;

  let slug = input
    // Remove common title prefixes if specified
    .replace(/^(VP of|Director of|Head of|Chief)\s+/i, '')
    // Replace special characters with spaces
    .replace(/[^\w\s-]/g, '')
    // Replace whitespace with hyphens
    .replace(/\s+/g, '-')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');

  if (lowercase) {
    slug = slug.toLowerCase();
  }

  // Add prefix if specified
  if (prefix) {
    slug = `${prefix}-${slug}`;
  }

  // Add suffix if specified
  if (suffix) {
    slug = `${slug}-${suffix}`;
  }

  // Truncate if needed
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength).replace(/-$/, '');
  }

  return slug;
}

/**
 * Options for slug generation.
 */
export interface SlugOptions {
  /** Prefix to add to the slug */
  prefix?: string;
  /** Suffix to add to the slug */
  suffix?: string;
  /** Maximum length of the slug */
  maxLength?: number;
  /** Convert to lowercase */
  lowercase?: boolean;
}

/**
 * Generate a Slack-compatible channel name from a discipline name.
 * Slack channel names must be lowercase, max 80 chars, and only contain
 * lowercase letters, numbers, and hyphens.
 *
 * @param disciplineName - Name of the discipline
 * @param prefix - Optional prefix for the channel name
 * @returns Slack-compatible channel name
 */
export function generateChannelName(
  disciplineName: string,
  prefix?: string
): string {
  return generateSlug(disciplineName, {
    prefix,
    maxLength: 80,
    lowercase: true,
  });
}

/**
 * Generate a display name for a VP user.
 *
 * @param vpName - VP name or title
 * @returns Display name suitable for Slack
 */
export function generateDisplayName(vpName: string): string {
  // Remove VP prefix variations
  const cleaned = vpName
    .replace(/^(VP of|VP -|VP:|Vice President of)\s*/i, '')
    .trim();

  // Capitalize first letter of each word
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// ID Mapping Utilities
// ============================================================================

/**
 * Bidirectional ID mapping between source and target systems.
 */
export class IDMapper<
  TSourceId extends string = string,
  TTargetId extends string = string,
> {
  private sourceToTarget: Map<TSourceId, TTargetId> = new Map();
  private targetToSource: Map<TTargetId, TSourceId> = new Map();

  /**
   * Add a mapping between source and target IDs.
   */
  addMapping(sourceId: TSourceId, targetId: TTargetId): void {
    this.sourceToTarget.set(sourceId, targetId);
    this.targetToSource.set(targetId, sourceId);
  }

  /**
   * Get target ID from source ID.
   */
  getTargetId(sourceId: TSourceId): TTargetId | undefined {
    return this.sourceToTarget.get(sourceId);
  }

  /**
   * Get source ID from target ID.
   */
  getSourceId(targetId: TTargetId): TSourceId | undefined {
    return this.targetToSource.get(targetId);
  }

  /**
   * Check if a source ID has a mapping.
   */
  hasSourceId(sourceId: TSourceId): boolean {
    return this.sourceToTarget.has(sourceId);
  }

  /**
   * Check if a target ID has a mapping.
   */
  hasTargetId(targetId: TTargetId): boolean {
    return this.targetToSource.has(targetId);
  }

  /**
   * Remove a mapping by source ID.
   */
  removeBySourceId(sourceId: TSourceId): boolean {
    const targetId = this.sourceToTarget.get(sourceId);
    if (targetId) {
      this.sourceToTarget.delete(sourceId);
      this.targetToSource.delete(targetId);
      return true;
    }
    return false;
  }

  /**
   * Get all mappings as an array of tuples.
   */
  getAllMappings(): Array<[TSourceId, TTargetId]> {
    return Array.from(this.sourceToTarget.entries());
  }

  /**
   * Get the number of mappings.
   */
  get size(): number {
    return this.sourceToTarget.size;
  }

  /**
   * Clear all mappings.
   */
  clear(): void {
    this.sourceToTarget.clear();
    this.targetToSource.clear();
  }

  /**
   * Export mappings as a serializable object.
   */
  toJSON(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [source, target] of this.sourceToTarget) {
      result[source] = target;
    }
    return result;
  }

  /**
   * Import mappings from a serialized object.
   */
  static fromJSON<S extends string = string, T extends string = string>(
    data: Record<string, string>
  ): IDMapper<S, T> {
    const mapper = new IDMapper<S, T>();
    for (const [source, target] of Object.entries(data)) {
      mapper.addMapping(source as S, target as T);
    }
    return mapper;
  }
}

// ============================================================================
// VP Mapping Utilities
// ============================================================================

/**
 * Create a VP ID mapper from genesis VPs to Slack user IDs.
 */
export function createVPMapper(): IDMapper<string, string> {
  return new IDMapper<string, string>();
}

/**
 * Create a discipline ID mapper from genesis disciplines to Slack channel IDs.
 */
export function createDisciplineMapper(): IDMapper<string, string> {
  return new IDMapper<string, string>();
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate that a string is a valid Slack channel name.
 */
export function isValidChannelName(name: string): boolean {
  // Slack channel names: lowercase, max 80 chars, letters/numbers/hyphens only
  return /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]?$/.test(name);
}

/**
 * Validate that a string is a valid Slack user display name.
 */
export function isValidDisplayName(name: string): boolean {
  // Display names: max 80 chars, no newlines
  return name.length > 0 && name.length <= 80 && !name.includes('\n');
}

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Generate a simple hash from a string (for config hashing).
 * Note: This is not cryptographically secure.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a unique ID based on timestamp and random component.
 */
export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Safely extract a value from an object with a default.
 */
export function safeGet<T>(
  obj: Record<string, unknown>,
  key: string,
  defaultValue: T
): T {
  const value = obj[key];
  return value !== undefined && value !== null ? (value as T) : defaultValue;
}

/**
 * Deep clone an object.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge two objects deeply.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}
