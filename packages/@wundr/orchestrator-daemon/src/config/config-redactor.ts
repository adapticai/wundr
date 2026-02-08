/**
 * Config Redactor: Secret Masking and Restoration for UI Round-Trips
 *
 * Ported from OpenClaw's redact-snapshot.ts. Uses a sentinel value to replace
 * sensitive config fields in API/UI responses. On write-back, the sentinel is
 * detected and the original value is restored from the on-disk config, so
 * credentials are never corrupted during round-trips through the dashboard.
 *
 * @module @wundr/orchestrator-daemon/config/config-redactor
 */

import type { ConfigSnapshot } from './config-loader';

// =============================================================================
// Constants
// =============================================================================

/**
 * Sentinel value used to replace sensitive config fields.
 *
 * Write-side handlers detect this sentinel and restore the original value
 * from the persisted config, so a round-trip through the UI does not
 * corrupt credentials.
 */
export const REDACTED_SENTINEL = '__WUNDR_REDACTED__';

/**
 * Patterns that identify sensitive config field names.
 * Matched against the immediate key name (not the full path).
 */
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /api.?key/i,
  /apiSecret/i,
  /keyHash/i,
  /privateKey/i,
  /credential/i,
];

// =============================================================================
// Detection
// =============================================================================

/**
 * Test whether a key name matches any sensitive pattern.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Test whether a dot-path refers to a sensitive field.
 * Checks only the leaf key name.
 */
export function isSensitivePath(dotPath: string): boolean {
  const parts = dotPath.split('.');
  const leaf = parts[parts.length - 1];
  return leaf ? isSensitiveKey(leaf) : false;
}

// =============================================================================
// Redaction
// =============================================================================

/**
 * Deep-walk an object and replace values whose key matches a sensitive pattern
 * with the redaction sentinel.
 */
function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key) && value !== null && value !== undefined) {
      result[key] = REDACTED_SENTINEL;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Redact all sensitive fields in a config object, returning a new copy.
 *
 * The original object is not modified.
 */
export function redactConfig<T>(value: T): T {
  return redactObject(value) as T;
}

// =============================================================================
// Raw Text Redaction
// =============================================================================

/**
 * Collect all sensitive string values from a config object.
 * Used for text-based redaction of the raw JSON/JSON5 source.
 */
function collectSensitiveValues(obj: unknown): string[] {
  const values: string[] = [];
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return values;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      values.push(...collectSensitiveValues(item));
    }
    return values;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key) && typeof value === 'string' && value.length > 0) {
      values.push(value);
    } else if (typeof value === 'object' && value !== null) {
      values.push(...collectSensitiveValues(value));
    }
  }
  return values;
}

/**
 * Replace known sensitive values in a raw JSON string with the sentinel.
 * Values are replaced longest-first to avoid partial matches.
 */
function redactRawText(raw: string, config: unknown): string {
  const sensitiveValues = collectSensitiveValues(config);
  // Sort longest-first to avoid partial matches
  sensitiveValues.sort((a, b) => b.length - a.length);

  let result = raw;
  for (const value of sensitiveValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), REDACTED_SENTINEL);
  }

  // Also scrub key-value patterns that look like sensitive fields
  const keyValuePattern =
    /(^|[{\s,])((["'])([^"']+)\3|([A-Za-z0-9_$.-]+))(\s*:\s*)(["'])([^"']*)\7/g;
  result = result.replace(
    keyValuePattern,
    (
      match,
      prefix,
      keyExpr,
      _keyQuote,
      keyQuoted,
      keyBare,
      sep,
      valQuote,
      val,
    ) => {
      const key = (keyQuoted ?? keyBare) as string | undefined;
      if (!key || !isSensitiveKey(key)) {
        return match;
      }
      if (val === REDACTED_SENTINEL) {
        return match;
      }
      return `${prefix}${keyExpr}${sep}${valQuote}${REDACTED_SENTINEL}${valQuote}`;
    },
  );

  return result;
}

/**
 * Redact a config snapshot for safe transmission to the UI.
 *
 * Both `config` (the parsed object) and `raw` (the JSON source) are scrubbed
 * so no credential can leak through either path. The `hash` is preserved.
 */
export function redactSnapshot(snapshot: ConfigSnapshot): ConfigSnapshot {
  const redactedConfig = redactConfig(snapshot.config);
  const redactedRaw = snapshot.raw
    ? redactRawText(snapshot.raw, snapshot.config)
    : null;

  return {
    ...snapshot,
    config: redactedConfig,
    raw: redactedRaw,
  };
}

// =============================================================================
// Restoration
// =============================================================================

/**
 * Deep-walk `incoming` and replace any REDACTED_SENTINEL values (on sensitive
 * keys) with the corresponding value from `original`.
 *
 * This is called before writing config to disk, so that credentials survive
 * a UI round-trip unmodified.
 *
 * Throws if a redacted key has no corresponding original value, which would
 * indicate a corrupted write attempt.
 */
export function restoreRedactedValues(
  incoming: unknown,
  original: unknown,
): unknown {
  if (incoming === null || incoming === undefined) {
    return incoming;
  }
  if (typeof incoming !== 'object') {
    return incoming;
  }
  if (Array.isArray(incoming)) {
    const origArr = Array.isArray(original) ? original : [];
    return incoming.map((item, i) =>
      restoreRedactedValues(item, origArr[i]),
    );
  }

  const orig =
    original && typeof original === 'object' && !Array.isArray(original)
      ? (original as Record<string, unknown>)
      : {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    incoming as Record<string, unknown>,
  )) {
    if (isSensitiveKey(key) && value === REDACTED_SENTINEL) {
      if (!(key in orig)) {
        throw new Error(
          `config write rejected: "${key}" is redacted; set an explicit value instead of ${REDACTED_SENTINEL}`,
        );
      }
      result[key] = orig[key];
    } else if (typeof value === 'object' && value !== null) {
      result[key] = restoreRedactedValues(value, orig[key]);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Check whether any value in an object tree is the redaction sentinel.
 * Useful for pre-write validation.
 */
export function containsRedactedSentinel(obj: unknown): boolean {
  if (obj === REDACTED_SENTINEL) {
    return true;
  }
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }
  if (Array.isArray(obj)) {
    return obj.some(containsRedactedSentinel);
  }
  return Object.values(obj as Record<string, unknown>).some(
    containsRedactedSentinel,
  );
}

/**
 * List all dot-paths in an object that contain the redaction sentinel.
 * Useful for error reporting.
 */
export function listRedactedPaths(
  obj: unknown,
  prefix = '',
): string[] {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return [];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) =>
      listRedactedPaths(item, `${prefix}[${i}]`),
    );
  }
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (value === REDACTED_SENTINEL) {
      paths.push(childPath);
    } else if (typeof value === 'object' && value !== null) {
      paths.push(...listRedactedPaths(value, childPath));
    }
  }
  return paths;
}
