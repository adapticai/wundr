/**
 * @wundr.io/agent-observability - Sensitive Data Redactor
 *
 * Provides redaction capabilities for removing or masking sensitive data
 * from observability events before storage or transmission.
 *
 * Supports pattern-based redaction using regular expressions and
 * field-based redaction for known sensitive field names.
 */

import * as crypto from 'crypto';

import { DEFAULT_REDACTION_CONFIG } from './types';

import type {
  RedactionConfig,
  RedactionPattern,
  ObservabilityEvent,
} from './types';

/**
 * Result of a redaction operation
 */
export interface RedactionResult {
  /** The redacted data */
  data: Record<string, unknown>;
  /** Whether any redaction occurred */
  wasRedacted: boolean;
  /** Fields that were redacted */
  redactedFields: string[];
  /** Hashes of original values (if preserveHash enabled) */
  valueHashes: Record<string, string>;
}

/**
 * Sensitive Data Redactor
 *
 * Applies configurable redaction rules to remove or mask sensitive
 * information from observability data. Supports both pattern-based
 * and field-based redaction strategies.
 *
 * @example
 * ```typescript
 * const redactor = new SensitiveDataRedactor({
 *   enabled: true,
 *   patterns: [
 *     { name: 'api_key', pattern: 'api_key=\\w+', replacement: 'api_key=[REDACTED]' }
 *   ],
 *   sensitiveFields: ['password', 'secret']
 * });
 *
 * const result = redactor.redact({ password: 'secret123', data: 'safe' });
 * // result.data = { password: '[REDACTED]', data: 'safe' }
 * ```
 */
export class SensitiveDataRedactor {
  private config: RedactionConfig;
  private compiledPatterns: Map<string, RegExp> = new Map();

  /**
   * Creates a new SensitiveDataRedactor instance
   *
   * @param config - Redaction configuration
   */
  constructor(config: Partial<RedactionConfig> = {}) {
    this.config = {
      ...DEFAULT_REDACTION_CONFIG,
      ...config,
      patterns: [...(config.patterns || DEFAULT_REDACTION_CONFIG.patterns)],
      sensitiveFields: [
        ...DEFAULT_REDACTION_CONFIG.sensitiveFields,
        ...(config.sensitiveFields || []),
      ],
    };

    this.compilePatterns();
  }

  /**
   * Redact sensitive data from an object
   *
   * @param data - Data to redact
   * @param path - Current path in the object (for nested redaction tracking)
   * @returns Redaction result with redacted data and metadata
   */
  redact(data: Record<string, unknown>, path: string = ''): RedactionResult {
    if (!this.config.enabled) {
      return {
        data,
        wasRedacted: false,
        redactedFields: [],
        valueHashes: {},
      };
    }

    const result: RedactionResult = {
      data: {},
      wasRedacted: false,
      redactedFields: [],
      valueHashes: {},
    };

    for (const [key, value] of Object.entries(data)) {
      const currentPath = path ? `${path}.${key}` : key;
      const redactedEntry = this.redactValue(key, value, currentPath, result);
      result.data[key] = redactedEntry;
    }

    return result;
  }

  /**
   * Redact sensitive data from an observability event
   *
   * @param event - Event to redact
   * @returns Redacted event
   */
  redactEvent(event: ObservabilityEvent): ObservabilityEvent {
    if (!this.config.enabled) {
      return event;
    }

    // Redact message
    const redactedMessage = this.redactString(event.message);

    // Redact data payload
    const dataResult = this.redact(event.data);

    // Redact metadata attributes
    const metadataResult = this.redact(
      event.metadata.attributes as Record<string, unknown>
    );

    // Redact error information
    let redactedError = event.error;
    if (event.error) {
      redactedError = {
        ...event.error,
        message: this.redactString(event.error.message),
        stack: event.error.stack
          ? this.redactString(event.error.stack)
          : undefined,
      };
    }

    const allRedactedFields = [
      ...dataResult.redactedFields,
      ...metadataResult.redactedFields.map(f => `metadata.attributes.${f}`),
    ];

    const wasRedacted =
      dataResult.wasRedacted ||
      metadataResult.wasRedacted ||
      redactedMessage !== event.message;

    if (wasRedacted && redactedMessage !== event.message) {
      allRedactedFields.push('message');
    }

    return {
      ...event,
      message: redactedMessage,
      data: dataResult.data,
      metadata: {
        ...event.metadata,
        attributes: metadataResult.data,
      },
      error: redactedError,
      redacted: wasRedacted,
      redactedFields: allRedactedFields,
    };
  }

  /**
   * Add a new redaction pattern
   *
   * @param pattern - Pattern to add
   */
  addPattern(pattern: RedactionPattern): void {
    this.config.patterns.push(pattern);
    if (pattern.enabled) {
      this.compilePattern(pattern);
    }
  }

  /**
   * Remove a redaction pattern by name
   *
   * @param name - Name of the pattern to remove
   * @returns True if pattern was removed
   */
  removePattern(name: string): boolean {
    const index = this.config.patterns.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.config.patterns.splice(index, 1);
    this.compiledPatterns.delete(name);
    return true;
  }

  /**
   * Enable or disable a pattern by name
   *
   * @param name - Pattern name
   * @param enabled - Whether to enable or disable
   * @returns True if pattern was found and updated
   */
  setPatternEnabled(name: string, enabled: boolean): boolean {
    const pattern = this.config.patterns.find(p => p.name === name);
    if (!pattern) {
      return false;
    }

    pattern.enabled = enabled;
    if (enabled) {
      this.compilePattern(pattern);
    } else {
      this.compiledPatterns.delete(name);
    }
    return true;
  }

  /**
   * Add a sensitive field name
   *
   * @param fieldName - Field name to add
   */
  addSensitiveField(fieldName: string): void {
    if (!this.config.sensitiveFields.includes(fieldName)) {
      this.config.sensitiveFields.push(fieldName);
    }
  }

  /**
   * Remove a sensitive field name
   *
   * @param fieldName - Field name to remove
   * @returns True if field was removed
   */
  removeSensitiveField(fieldName: string): boolean {
    const index = this.config.sensitiveFields.indexOf(fieldName);
    if (index === -1) {
      return false;
    }

    this.config.sensitiveFields.splice(index, 1);
    return true;
  }

  /**
   * Enable or disable redaction globally
   *
   * @param enabled - Whether redaction is enabled
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if redaction is enabled
   *
   * @returns True if redaction is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current configuration
   *
   * @returns Current redaction configuration
   */
  getConfig(): RedactionConfig {
    return { ...this.config };
  }

  /**
   * Get list of active pattern names
   *
   * @returns Array of enabled pattern names
   */
  getActivePatterns(): string[] {
    return this.config.patterns.filter(p => p.enabled).map(p => p.name);
  }

  /**
   * Test if a string would be redacted
   *
   * @param value - String to test
   * @returns True if the string would be redacted
   */
  wouldRedact(value: string): boolean {
    for (const [, regex] of this.compiledPatterns) {
      if (regex.test(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Redact a single value
   *
   * @param key - Field key
   * @param value - Value to potentially redact
   * @param path - Full path to this value
   * @param result - Result object to update
   * @returns Redacted value
   */
  private redactValue(
    key: string,
    value: unknown,
    path: string,
    result: RedactionResult
  ): unknown {
    // Check if field name is in sensitive fields list
    if (this.isSensitiveField(key)) {
      result.wasRedacted = true;
      result.redactedFields.push(path);

      if (this.config.preserveHash && typeof value === 'string') {
        result.valueHashes[path] = this.hashValue(value);
      }

      return '[REDACTED]';
    }

    // Handle different value types
    if (typeof value === 'string') {
      const redacted = this.redactString(value);
      if (redacted !== value) {
        result.wasRedacted = true;
        result.redactedFields.push(path);

        if (this.config.preserveHash) {
          result.valueHashes[path] = this.hashValue(value);
        }
      }
      return redacted;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.redactValue(String(index), item, `${path}[${index}]`, result)
      );
    }

    if (value !== null && typeof value === 'object') {
      const nestedResult = this.redact(value as Record<string, unknown>, path);
      if (nestedResult.wasRedacted) {
        result.wasRedacted = true;
        result.redactedFields.push(...nestedResult.redactedFields);
        Object.assign(result.valueHashes, nestedResult.valueHashes);
      }
      return nestedResult.data;
    }

    return value;
  }

  /**
   * Redact patterns from a string value
   *
   * @param value - String to redact
   * @returns Redacted string
   */
  private redactString(value: string): string {
    let result = value;

    for (const pattern of this.config.patterns) {
      if (!pattern.enabled) {
        continue;
      }

      const regex = this.compiledPatterns.get(pattern.name);
      if (regex) {
        result = result.replace(regex, pattern.replacement);
      }
    }

    return result;
  }

  /**
   * Check if a field name is in the sensitive fields list
   *
   * @param fieldName - Field name to check
   * @returns True if field is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveFields.some(sensitive =>
      lowerFieldName.includes(sensitive.toLowerCase())
    );
  }

  /**
   * Hash a value for verification purposes
   *
   * @param value - Value to hash
   * @returns Hash string
   */
  private hashValue(value: string): string {
    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(value)
      .digest('hex');
  }

  /**
   * Compile all enabled patterns to RegExp objects
   */
  private compilePatterns(): void {
    this.compiledPatterns.clear();
    for (const pattern of this.config.patterns) {
      if (pattern.enabled) {
        this.compilePattern(pattern);
      }
    }
  }

  /**
   * Compile a single pattern to RegExp
   *
   * @param pattern - Pattern to compile
   */
  private compilePattern(pattern: RedactionPattern): void {
    try {
      const regex = new RegExp(pattern.pattern, 'gi');
      this.compiledPatterns.set(pattern.name, regex);
    } catch (error) {
      console.error(
        `Failed to compile redaction pattern "${pattern.name}": ${error}`
      );
    }
  }
}

/**
 * Create a pre-configured redactor with common patterns
 *
 * @param additionalConfig - Additional configuration to merge
 * @returns Configured SensitiveDataRedactor instance
 */
export function createDefaultRedactor(
  additionalConfig: Partial<RedactionConfig> = {}
): SensitiveDataRedactor {
  return new SensitiveDataRedactor(additionalConfig);
}
