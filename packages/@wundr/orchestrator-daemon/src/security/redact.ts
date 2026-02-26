/**
 * Credential Redaction Framework for Wundr Orchestrator Daemon
 *
 * Ported from OpenClaw's redaction system (src/logging/redact.ts,
 * src/config/redact-snapshot.ts, src/logging/redact-identifier.ts)
 * and extended with comprehensive provider-specific patterns, stream-safe
 * buffered redaction, custom pattern registration, and statistics tracking.
 *
 * Provides:
 *  - Regex-based text scrubbing for logs and tool output
 *  - Config object redaction with sentinel round-trip support
 *  - One-way SHA-256 hashing for correlation identifiers
 *  - Environment variable display formatting
 *  - Deep WebSocket payload redaction
 *  - Stream-safe redaction with partial-match buffering
 *  - Runtime custom pattern registration
 *  - Redaction statistics (match counts by category)
 *
 * @module @wundr/orchestrator-daemon/security/redact
 */

import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RedactSensitiveMode = 'off' | 'tools' | 'all';

export interface RedactOptions {
  mode?: RedactSensitiveMode;
  patterns?: string[];
  /** When true, increment counters in {@link RedactionStats}. */
  trackStats?: boolean;
}

/**
 * A named redaction pattern that can be registered at runtime.
 */
export interface CustomRedactPattern {
  /** Human-readable name for statistics and debugging. */
  name: string;
  /** Regex source string (not /slash/ delimited) or a RegExp instance. */
  pattern: string | RegExp;
  /**
   * Optional category for statistics grouping.
   * Falls back to `name` if not provided.
   */
  category?: string;
}

/**
 * Per-category counters for redaction hits.
 */
export interface RedactionStatsSnapshot {
  /** Total redaction operations performed. */
  totalRedactions: number;
  /** Breakdown by category name. */
  categories: Record<string, number>;
  /** Timestamp of the last reset. */
  lastResetAt: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REDACT_MODE: RedactSensitiveMode = 'tools';
const DEFAULT_REDACT_MIN_LENGTH = 18;
const DEFAULT_REDACT_KEEP_START = 6;
const DEFAULT_REDACT_KEEP_END = 4;

/**
 * Sentinel value used to replace sensitive config fields in API/WS responses.
 * Write-side handlers detect this sentinel and restore the original value
 * from the on-disk config so that a round-trip through a UI does not corrupt
 * credentials.
 */
export const REDACTED_SENTINEL = '__WUNDR_REDACTED__';

// ---------------------------------------------------------------------------
// Redaction statistics (singleton)
// ---------------------------------------------------------------------------

class RedactionStatsTracker {
  private totalRedactions = 0;
  private categories: Map<string, number> = new Map();
  private lastResetAt: Date = new Date();

  increment(category: string, count = 1): void {
    this.totalRedactions += count;
    this.categories.set(category, (this.categories.get(category) ?? 0) + count);
  }

  snapshot(): RedactionStatsSnapshot {
    const cats: Record<string, number> = {};
    for (const [key, value] of this.categories) {
      cats[key] = value;
    }
    return {
      totalRedactions: this.totalRedactions,
      categories: cats,
      lastResetAt: new Date(this.lastResetAt.getTime()),
    };
  }

  reset(): void {
    this.totalRedactions = 0;
    this.categories.clear();
    this.lastResetAt = new Date();
  }
}

const statsTracker = new RedactionStatsTracker();

/**
 * Returns a snapshot of redaction statistics.
 */
export function getRedactionStats(): RedactionStatsSnapshot {
  return statsTracker.snapshot();
}

/**
 * Reset all redaction statistics counters.
 */
export function resetRedactionStats(): void {
  statsTracker.reset();
}

// ---------------------------------------------------------------------------
// Default redaction patterns
// ---------------------------------------------------------------------------

/**
 * Category tags for statistics tracking. Each pattern in the default set
 * is associated with a category so that stats.categories reports
 * meaningful breakdowns.
 */
interface CategorizedPattern {
  category: string;
  source: string;
}

const CATEGORIZED_PATTERNS: CategorizedPattern[] = [
  // === Structural patterns ===

  // ENV-style assignments: OPENAI_API_KEY=sk-1234...
  {
    category: 'env-assignment',
    source: String.raw`\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)\b\s*[=:]\s*(["']?)([^\s"'\\]+)\1`,
  },

  // JSON fields: {"apiKey":"sk-..."}
  {
    category: 'json-field',
    source: String.raw`"(?:apiKey|api_key|token|secret|password|passwd|accessToken|access_token|refreshToken|refresh_token|clientSecret|client_secret|apiSecret|api_secret|jwtSecret|jwt_secret|privateKey|private_key|secretKey|secret_key|authToken|auth_token|bearerToken|bearer_token)"\s*:\s*"([^"]+)"`,
  },

  // CLI flags: --api-key sk-...
  {
    category: 'cli-flag',
    source: String.raw`--(?:api[-_]?key|token|secret|password|passwd|jwt[-_]?secret|client[-_]?secret|auth[-_]?token)\s+(["']?)([^\s"']+)\1`,
  },

  // Authorization headers
  {
    category: 'bearer-token',
    source: String.raw`Authorization\s*[:=]\s*Bearer\s+([A-Za-z0-9._\-+=]+)`,
  },
  {
    category: 'bearer-token',
    source: String.raw`\bBearer\s+([A-Za-z0-9._\-+=]{18,})\b`,
  },

  // Basic Auth headers: Authorization: Basic <base64>
  {
    category: 'basic-auth',
    source: String.raw`Authorization\s*[:=]\s*Basic\s+([A-Za-z0-9+/=]{10,})`,
  },

  // OAuth access/refresh tokens in URL params
  {
    category: 'oauth-token',
    source: String.raw`[?&](?:access_token|refresh_token|client_secret|code)=([A-Za-z0-9._\-+=]{10,})`,
  },

  // PEM private key blocks
  {
    category: 'pem-private-key',
    source: String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----`,
  },

  // PGP private key blocks
  {
    category: 'pgp-private-key',
    source: String.raw`-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----`,
  },

  // SSH private keys (OpenSSH format)
  {
    category: 'ssh-private-key',
    source: String.raw`-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----`,
  },

  // SSH public keys (ssh-rsa, ssh-ed25519, ecdsa-sha2-*)
  {
    category: 'ssh-public-key',
    source: String.raw`\b((?:ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp(?:256|384|521))\s+[A-Za-z0-9+/=]{40,}(?:\s+\S+)?)\b`,
  },

  // Password fields in YAML/TOML/INI config files
  {
    category: 'config-password',
    source: String.raw`(?:^|[\n\r])[ \t]*(?:password|passwd|secret|api_key|api[-_]?secret|auth[-_]?token|private[-_]?key|jwt[-_]?secret)[ \t]*[:=][ \t]*(["']?)([^\s"'\n\r]+)\1`,
  },

  // === Provider-specific token prefixes ===

  // OpenAI keys: sk-..., sk-proj-...
  {
    category: 'openai',
    source: String.raw`\b(sk-[A-Za-z0-9_-]{8,})\b`,
  },

  // GitHub personal access tokens
  {
    category: 'github',
    source: String.raw`\b(ghp_[A-Za-z0-9]{20,})\b`,
  },

  // GitHub fine-grained personal access tokens
  {
    category: 'github',
    source: String.raw`\b(github_pat_[A-Za-z0-9_]{20,})\b`,
  },

  // GitHub OAuth access tokens
  {
    category: 'github',
    source: String.raw`\b(gho_[A-Za-z0-9]{20,})\b`,
  },

  // GitHub user-to-server tokens
  {
    category: 'github',
    source: String.raw`\b(ghu_[A-Za-z0-9]{20,})\b`,
  },

  // GitHub server-to-server tokens
  {
    category: 'github',
    source: String.raw`\b(ghs_[A-Za-z0-9]{20,})\b`,
  },

  // GitHub refresh tokens
  {
    category: 'github',
    source: String.raw`\b(ghr_[A-Za-z0-9]{20,})\b`,
  },

  // Slack bot/user tokens
  {
    category: 'slack',
    source: String.raw`\b(xox[baprs]-[A-Za-z0-9-]{10,})\b`,
  },

  // Slack app-level tokens
  {
    category: 'slack',
    source: String.raw`\b(xapp-[A-Za-z0-9-]{10,})\b`,
  },

  // Groq API keys
  {
    category: 'groq',
    source: String.raw`\b(gsk_[A-Za-z0-9_-]{10,})\b`,
  },

  // Google AI / GCP API keys
  {
    category: 'gcp',
    source: String.raw`\b(AIza[0-9A-Za-z\-_]{20,})\b`,
  },

  // GCP service account private key ID (hex, typically 40 chars in JSON)
  {
    category: 'gcp',
    source: String.raw`"private_key_id"\s*:\s*"([a-f0-9]{40,})"`,
  },

  // GCP service account JSON private key (embedded PEM -- caught by PEM rule,
  // but this catches the JSON-escaped version: -----BEGIN ...\\n...)
  {
    category: 'gcp',
    source: String.raw`"private_key"\s*:\s*"(-----BEGIN[^"]+-----)"`,
  },

  // Perplexity API keys
  {
    category: 'perplexity',
    source: String.raw`\b(pplx-[A-Za-z0-9_-]{10,})\b`,
  },

  // npm tokens
  {
    category: 'npm',
    source: String.raw`\b(npm_[A-Za-z0-9]{10,})\b`,
  },

  // Telegram bot tokens (numeric:alphanumeric)
  {
    category: 'telegram',
    source: String.raw`\b(\d{6,}:[A-Za-z0-9_-]{20,})\b`,
  },

  // AWS access key IDs (always start with AKIA)
  {
    category: 'aws',
    source: String.raw`\b(AKIA[0-9A-Z]{16})\b`,
  },

  // AWS secret access keys (40-char base64-ish following an assignment)
  {
    category: 'aws',
    source: String.raw`\b((?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*)(["']?)([A-Za-z0-9/+=]{40})\2`,
  },

  // AWS session tokens (long base64 strings in known context)
  {
    category: 'aws',
    source: String.raw`\b((?:aws_session_token|AWS_SESSION_TOKEN)\s*[=:]\s*)(["']?)([A-Za-z0-9/+=]{100,})\2`,
  },

  // Anthropic API keys: sk-ant-api03-...
  {
    category: 'anthropic',
    source: String.raw`\b(sk-ant-[A-Za-z0-9_-]{10,})\b`,
  },

  // Azure subscription keys and cognitive services keys
  {
    category: 'azure',
    source: String.raw`\b([a-f0-9]{32})\b(?=.*(?:azure|cognitive|subscription))/i`,
  },

  // Azure AD client secrets (format: xxx~xxxxxx)
  {
    category: 'azure',
    source: String.raw`\b([A-Za-z0-9~._-]{34,})\b(?=.*(?:AZURE_CLIENT_SECRET|azure_client_secret))`,
  },

  // Azure connection strings
  {
    category: 'azure',
    source: String.raw`(?:AccountKey|SharedAccessKey|sig)=([A-Za-z0-9+/=]{20,})`,
  },

  // Stripe API keys: sk_live_, sk_test_, pk_live_, pk_test_, rk_live_, rk_test_
  {
    category: 'stripe',
    source: String.raw`\b((?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,})\b`,
  },

  // Stripe webhook signing secrets
  {
    category: 'stripe',
    source: String.raw`\b(whsec_[A-Za-z0-9]{10,})\b`,
  },

  // Twilio account SID and auth token patterns
  {
    category: 'twilio',
    source: String.raw`\b(AC[a-f0-9]{32})\b`,
  },
  {
    category: 'twilio',
    source: String.raw`\b(SK[a-f0-9]{32})\b`,
  },

  // SendGrid API keys
  {
    category: 'sendgrid',
    source: String.raw`\b(SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43})\b`,
  },

  // Mailgun API keys
  {
    category: 'mailgun',
    source: String.raw`\b(key-[A-Za-z0-9]{32})\b`,
  },

  // Heroku API keys
  {
    category: 'heroku',
    source: String.raw`\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b(?=.*(?:HEROKU|heroku))`,
  },

  // DigitalOcean personal access tokens
  {
    category: 'digitalocean',
    source: String.raw`\b(dop_v1_[a-f0-9]{64})\b`,
  },

  // DigitalOcean OAuth tokens
  {
    category: 'digitalocean',
    source: String.raw`\b(doo_v1_[a-f0-9]{64})\b`,
  },

  // Datadog API and app keys
  {
    category: 'datadog',
    source: String.raw`\b(DD(?:_API_KEY|_APP_KEY)\s*[=:]\s*)(["']?)([a-f0-9]{32,40})\2`,
  },

  // Datadog API keys (standalone hex patterns near known identifiers)
  {
    category: 'datadog',
    source: String.raw`\b(ddapi_[A-Za-z0-9]{32,})\b`,
  },

  // Database connection URLs with embedded credentials
  {
    category: 'database-url',
    source: String.raw`\b((?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss|amqp|amqps):\/\/)([^:]+):([^@]+)@`,
  },

  // Redis URLs with password-only auth: redis://:password@host
  {
    category: 'database-url',
    source: String.raw`\b(redis(?:s)?:\/\/):([^@]+)@`,
  },

  // JWT tokens (three base64url segments separated by dots)
  {
    category: 'jwt',
    source: String.raw`\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b`,
  },

  // Credit card numbers (13-19 digits, optionally separated by spaces/dashes)
  // Covers Visa (4xxx), Mastercard (5xxx, 2xxx), Amex (3xxx), Discover (6xxx)
  {
    category: 'credit-card',
    source: String.raw`\b([3-6]\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7})\b`,
  },

  // Supabase service role / anon keys
  {
    category: 'supabase',
    source: String.raw`\b(sbp_[A-Za-z0-9]{20,})\b`,
  },

  // Vercel tokens
  {
    category: 'vercel',
    source: String.raw`\b(vercel_[A-Za-z0-9_-]{20,})\b`,
  },

  // Linear API keys
  {
    category: 'linear',
    source: String.raw`\b(lin_api_[A-Za-z0-9]{20,})\b`,
  },

  // Shopify access tokens
  {
    category: 'shopify',
    source: String.raw`\b(shpat_[A-Fa-f0-9]{32})\b`,
  },

  // Shopify shared secrets
  {
    category: 'shopify',
    source: String.raw`\b(shpss_[A-Fa-f0-9]{32})\b`,
  },

  // GitLab personal/project/group tokens
  {
    category: 'gitlab',
    source: String.raw`\b(glpat-[A-Za-z0-9_-]{20,})\b`,
  },

  // Bitbucket app passwords / tokens
  {
    category: 'bitbucket',
    source: String.raw`\b(ATBB[A-Za-z0-9]{20,})\b`,
  },

  // Hashicorp Vault tokens
  {
    category: 'vault',
    source: String.raw`\b(hvs\.[A-Za-z0-9_-]{20,})\b`,
  },

  // Hashicorp Terraform Cloud tokens
  {
    category: 'terraform',
    source: String.raw`\b([A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9_-]{60,})\b`,
  },

  // Doppler tokens
  {
    category: 'doppler',
    source: String.raw`\b(dp\.(?:st|ct|sa|scim)\.[A-Za-z0-9_-]{20,})\b`,
  },

  // Fastly API tokens
  {
    category: 'fastly',
    source: String.raw`\b(fastly_[A-Za-z0-9_-]{20,})\b`,
  },
];

/**
 * Flat list of default pattern source strings (for backward compat).
 */
const DEFAULT_REDACT_PATTERNS: string[] = CATEGORIZED_PATTERNS.map(
  p => p.source
);

/**
 * Map from compiled pattern source back to its category name.
 */
const patternCategoryMap = new Map<string, string>();
for (const cp of CATEGORIZED_PATTERNS) {
  patternCategoryMap.set(cp.source, cp.category);
}

// ---------------------------------------------------------------------------
// Custom pattern registry (runtime)
// ---------------------------------------------------------------------------

const customPatterns: CategorizedPattern[] = [];

/**
 * Register one or more custom redaction patterns at runtime.
 *
 * These patterns are appended to the default set and participate in all
 * subsequent redaction calls (unless the caller provides explicit patterns
 * via {@link RedactOptions.patterns}).
 *
 * @param patterns - Patterns to register.
 *
 * @example
 * ```ts
 * registerRedactPatterns([
 *   { name: 'internal-api-key', pattern: String.raw`\b(intkey_[A-Za-z0-9]{32})\b` },
 * ]);
 * ```
 */
export function registerRedactPatterns(patterns: CustomRedactPattern[]): void {
  for (const p of patterns) {
    const source = p.pattern instanceof RegExp ? p.pattern.source : p.pattern;
    const category = p.category ?? p.name;
    customPatterns.push({ category, source });
    patternCategoryMap.set(source, category);
  }
  // Invalidate the compiled cache so the next call picks up new patterns.
  compiledDefaultCache = null;
}

/**
 * Remove all custom patterns registered via {@link registerRedactPatterns}.
 * Built-in patterns are not affected.
 */
export function clearCustomRedactPatterns(): void {
  customPatterns.length = 0;
  compiledDefaultCache = null;
}

/**
 * Returns the current count of registered custom patterns.
 */
export function getCustomPatternCount(): number {
  return customPatterns.length;
}

// ---------------------------------------------------------------------------
// Sensitive key detection (for config objects)
// ---------------------------------------------------------------------------

/**
 * Patterns that identify sensitive config field names.
 * A config key matching any of these will have its value replaced with
 * the redaction sentinel during display.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /token/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /api.?key/i,
  /credential/i,
  /private.?key/i,
  /auth.?key/i,
  /signing.?key/i,
  /encryption.?key/i,
  /access.?key/i,
  /connection.?string/i,
];

/**
 * Returns true if a config object key name indicates a sensitive value.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

// ---------------------------------------------------------------------------
// Sensitive environment variable names
// ---------------------------------------------------------------------------

/**
 * Environment variable names that should always have their values redacted
 * when logged. This is a superset of the config-level sensitive key
 * detection -- it covers variables whose *name* alone signals sensitivity
 * even if it doesn't match the generic key patterns above.
 */
const SENSITIVE_ENV_KEYS: ReadonlySet<string> = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DAEMON_JWT_SECRET',
  'REDIS_PASSWORD',
  'REDIS_URL',
  'DATABASE_URL',
  'NEOLITH_API_KEY',
  'NEOLITH_API_SECRET',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_PAT',
  'SLACK_TOKEN',
  'SLACK_SIGNING_SECRET',
  'OPENAI_ORG_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_AUTH_TOKEN',
  'SENDGRID_API_KEY',
  'MAILGUN_API_KEY',
  'AZURE_CLIENT_SECRET',
  'AZURE_SUBSCRIPTION_KEY',
  'GCP_SERVICE_ACCOUNT_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'DATADOG_API_KEY',
  'DATADOG_APP_KEY',
  'DD_API_KEY',
  'DD_APP_KEY',
  'HEROKU_API_KEY',
  'DIGITALOCEAN_ACCESS_TOKEN',
  'VERCEL_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAULT_TOKEN',
  'TERRAFORM_TOKEN',
  'LINEAR_API_KEY',
  'GITLAB_TOKEN',
  'BITBUCKET_TOKEN',
  'NPM_TOKEN',
  'SHOPIFY_API_SECRET',
  'FASTLY_API_TOKEN',
  'DOPPLER_TOKEN',
]);

/**
 * Returns true if an environment variable name is known to hold a secret.
 * Also falls back to the generic key-name heuristic if the exact name
 * is not in the hardcoded set.
 */
export function isSensitiveEnvKey(key: string): boolean {
  if (SENSITIVE_ENV_KEYS.has(key)) {
    return true;
  }
  return isSensitiveKey(key);
}

// ---------------------------------------------------------------------------
// Pattern compilation
// ---------------------------------------------------------------------------

/**
 * Parse a pattern string into a RegExp.
 * Accepts either `/pattern/flags` notation or a bare regex string.
 * Returns null for empty or invalid patterns (never throws).
 */
function parsePattern(raw: string): RegExp | null {
  if (!raw.trim()) {
    return null;
  }
  const match = raw.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    if (match) {
      const flags = match[2].includes('g') ? match[2] : `${match[2]}g`;
      return new RegExp(match[1], flags);
    }
    return new RegExp(raw, 'gi');
  } catch {
    return null;
  }
}

/** Cache for compiled default + custom patterns. */
let compiledDefaultCache: RegExp[] | null = null;

/**
 * Resolve an optional user-supplied pattern list into compiled RegExp[].
 * Falls back to DEFAULT_REDACT_PATTERNS + custom patterns if none provided.
 */
function resolvePatterns(value?: string[]): RegExp[] {
  if (value?.length) {
    return value.map(parsePattern).filter((re): re is RegExp => Boolean(re));
  }
  if (compiledDefaultCache) {
    return compiledDefaultCache;
  }
  const allSources = [
    ...DEFAULT_REDACT_PATTERNS,
    ...customPatterns.map(p => p.source),
  ];
  compiledDefaultCache = allSources
    .map(parsePattern)
    .filter((re): re is RegExp => Boolean(re));
  return compiledDefaultCache;
}

// ---------------------------------------------------------------------------
// Token masking
// ---------------------------------------------------------------------------

/**
 * Mask a single token string.
 * Tokens shorter than DEFAULT_REDACT_MIN_LENGTH (18) are fully masked
 * as `***`. Longer tokens preserve the first 6 and last 4 characters
 * with an ellipsis in between: `sk-pro...cdef`.
 */
function maskToken(token: string): string {
  if (token.length < DEFAULT_REDACT_MIN_LENGTH) {
    return '***';
  }
  const start = token.slice(0, DEFAULT_REDACT_KEEP_START);
  const end = token.slice(-DEFAULT_REDACT_KEEP_END);
  return `${start}...${end}`;
}

/**
 * Redact a PEM/PGP/SSH private key block, preserving the BEGIN/END markers
 * for debuggability while removing the actual key material.
 */
function redactKeyBlock(block: string): string {
  const lines = block.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return '***';
  }
  return `${lines[0]}\n...redacted...\n${lines[lines.length - 1]}`;
}

/**
 * Redact a database connection URL by replacing the password portion.
 * The scheme, username hint, host, and path are preserved for debugging.
 *
 * Example:
 *   postgres://admin:s3cret@db.host:5432/mydb
 *   -> postgres://admin:***@db.host:5432/mydb
 */
function redactDbUrl(
  match: string,
  scheme: string,
  user: string,
  _pass: string
): string {
  return `${scheme}${user}:***@`;
}

/**
 * Redact a Redis URL with password-only auth.
 *
 * Example:
 *   redis://:mypassword@host:6379
 *   -> redis://:***@host:6379
 */
function redactRedisUrl(match: string, scheme: string, _pass: string): string {
  return `${scheme}:***@`;
}

/**
 * Validate a potential credit card number using the Luhn algorithm.
 * Returns true if the digit sequence passes the check.
 */
function luhnCheck(digits: string): boolean {
  const stripped = digits.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(stripped)) {
    return false;
  }
  let sum = 0;
  let alternate = false;
  for (let i = stripped.length - 1; i >= 0; i--) {
    let n = parseInt(stripped[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Match-level redaction
// ---------------------------------------------------------------------------

/**
 * Given a full regex match and its capture groups, produce the redacted
 * replacement string. Handles PEM/PGP/SSH blocks, database URLs, credit
 * cards, and generic token masking.
 */
function redactMatch(fullMatch: string, groups: string[]): string {
  // PEM / PGP / SSH private key blocks
  if (
    fullMatch.includes('PRIVATE KEY-----') ||
    fullMatch.includes('PGP PRIVATE KEY BLOCK-----')
  ) {
    return redactKeyBlock(fullMatch);
  }

  // Credit card: validate with Luhn before redacting
  const stripped = fullMatch.replace(/[\s-]/g, '');
  if (/^[3-6]\d{12,18}$/.test(stripped)) {
    if (luhnCheck(stripped)) {
      // Show only last 4 digits
      return `****-****-****-${stripped.slice(-4)}`;
    }
    // Not a valid CC number, return as-is
    return fullMatch;
  }

  // Database URL patterns -- handled by dedicated replacers in redactText,
  // but in case the match flows through here generically, mask the last
  // non-empty group.
  const token =
    groups
      .filter(value => typeof value === 'string' && value.length > 0)
      .at(-1) ?? fullMatch;

  const masked = maskToken(token);

  if (token === fullMatch) {
    return masked;
  }

  return fullMatch.replace(token, masked);
}

// ---------------------------------------------------------------------------
// Text-level redaction
// ---------------------------------------------------------------------------

/**
 * Apply all compiled patterns to a string, replacing matches with
 * their redacted equivalents.
 */
function redactText(
  text: string,
  patterns: RegExp[],
  trackStats: boolean
): string {
  let result = text;

  for (const pattern of patterns) {
    const category = patternCategoryMap.get(pattern.source) ?? 'unknown';

    // Database URL patterns need special handling to preserve structure
    if (pattern.source.includes('postgres|postgresql|mysql|mongodb')) {
      let hitCount = 0;
      result = result.replace(pattern, (...args: string[]) => {
        hitCount++;
        return redactDbUrl(args[0], args[1], args[2], args[3]);
      });
      if (trackStats && hitCount > 0) {
        statsTracker.increment(category, hitCount);
      }
      continue;
    }

    if (
      pattern.source.includes('redis(?:s)?:\\/\\/') &&
      pattern.source.includes(':([^@]+)@')
    ) {
      let hitCount = 0;
      result = result.replace(pattern, (...args: string[]) => {
        hitCount++;
        return redactRedisUrl(args[0], args[1], args[2]);
      });
      if (trackStats && hitCount > 0) {
        statsTracker.increment(category, hitCount);
      }
      continue;
    }

    // Credit card pattern: validate via Luhn before redacting
    if (category === 'credit-card') {
      let hitCount = 0;
      result = result.replace(pattern, (...args: string[]) => {
        const replaced = redactMatch(args[0], args.slice(1, args.length - 2));
        if (replaced !== args[0]) {
          hitCount++;
        }
        return replaced;
      });
      if (trackStats && hitCount > 0) {
        statsTracker.increment(category, hitCount);
      }
      continue;
    }

    let hitCount = 0;
    result = result.replace(pattern, (...args: string[]) => {
      hitCount++;
      return redactMatch(args[0], args.slice(1, args.length - 2));
    });
    if (trackStats && hitCount > 0) {
      statsTracker.increment(category, hitCount);
    }
  }

  return result;
}

/**
 * Normalize a mode string to a valid RedactSensitiveMode.
 */
function normalizeMode(value?: string): RedactSensitiveMode {
  if (value === 'off') {
    return 'off';
  }
  if (value === 'all') {
    return 'all';
  }
  return DEFAULT_REDACT_MODE;
}

// ---------------------------------------------------------------------------
// Public text redaction API
// ---------------------------------------------------------------------------

/**
 * Redact sensitive credentials from arbitrary text.
 *
 * This is the primary entry point for log-line and tool-output scrubbing.
 *
 * @param text    - The text to scan and redact.
 * @param options - Optional mode and custom pattern overrides.
 * @returns       - The text with detected credentials masked.
 *
 * @example
 * ```ts
 * const safe = redactSensitiveText('OPENAI_API_KEY=sk-proj-abcdefghijklmnop');
 * // => 'OPENAI_API_KEY=sk-pro...mnop'
 * ```
 */
export function redactSensitiveText(
  text: string,
  options?: RedactOptions
): string {
  if (!text) {
    return text;
  }

  const mode = normalizeMode(options?.mode);
  if (mode === 'off') {
    return text;
  }

  const patterns = resolvePatterns(options?.patterns);
  if (!patterns.length) {
    return text;
  }

  return redactText(text, patterns, options?.trackStats ?? false);
}

/**
 * Returns a copy of the built-in default redaction pattern strings.
 * Useful for composing custom pattern sets or for test assertions.
 */
export function getDefaultRedactPatterns(): string[] {
  return [...DEFAULT_REDACT_PATTERNS];
}

// ---------------------------------------------------------------------------
// Config object redaction
// ---------------------------------------------------------------------------

/**
 * Deep-walk an object and replace values whose key matches a sensitive
 * pattern with the redaction sentinel.
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
 * Return a deep copy of `value` with all sensitive fields replaced by
 * {@link REDACTED_SENTINEL}. Sensitive fields are identified by key name
 * (e.g. `apiKey`, `password`, `token`, `secret`).
 *
 * Use this when serializing config for display in UIs or API responses.
 *
 * @example
 * ```ts
 * const safe = redactConfigObject({
 *   openai: { apiKey: 'sk-real-key', model: 'gpt-4o' },
 * });
 * // => { openai: { apiKey: '__WUNDR_REDACTED__', model: 'gpt-4o' } }
 * ```
 */
export function redactConfigObject<T>(value: T): T {
  return redactObject(value) as T;
}

/**
 * Collect all string values from sensitive keys in a config object.
 * Used for text-based redaction of raw config file source strings.
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
 * Replace known sensitive values in a raw config string with the sentinel.
 * Values are replaced longest-first to avoid partial matches that could
 * leak a shorter substring of a secret.
 *
 * Also applies key-value pattern matching for cases where the parsed
 * config object does not capture all sensitive fields (e.g. when the
 * raw text contains values not present in the parsed object).
 */
function redactRawText(raw: string, config: unknown): string {
  // Phase 1: Replace known sensitive values from the parsed config
  const sensitiveValues = collectSensitiveValues(config);
  sensitiveValues.sort((a, b) => b.length - a.length);

  let result = raw;

  for (const value of sensitiveValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), REDACTED_SENTINEL);
  }

  // Phase 2: Catch any remaining key-value pairs with sensitive key names
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
      val
    ) => {
      const key = (keyQuoted ?? keyBare) as string | undefined;
      if (!key || !isSensitiveKey(key)) {
        return match;
      }
      if (val === REDACTED_SENTINEL) {
        return match;
      }
      return `${prefix}${keyExpr}${sep}${valQuote}${REDACTED_SENTINEL}${valQuote}`;
    }
  );

  return result;
}

/**
 * Redact a config snapshot -- both the parsed object and the raw text.
 *
 * @param config  - The parsed config object.
 * @param raw     - The raw config file text (JSON, JSON5, etc.), or null.
 * @returns       - An object with `config` (redacted object) and `raw` (redacted text).
 */
export function redactConfigSnapshot(
  config: Record<string, unknown>,
  raw?: string | null
): { config: Record<string, unknown>; raw: string | null } {
  const redactedConfig = redactConfigObject(config);
  const redactedRaw = raw ? redactRawText(raw, config) : null;

  return {
    config: redactedConfig,
    raw: redactedRaw,
  };
}

// ---------------------------------------------------------------------------
// Sentinel restoration (config write-back)
// ---------------------------------------------------------------------------

/**
 * Deep-walk `incoming` and replace any {@link REDACTED_SENTINEL} values
 * (on sensitive keys) with the corresponding value from `original`.
 *
 * Call this before writing user-submitted config to disk so that
 * credentials survive a UI round-trip unmodified.
 *
 * @throws {Error} If a sentinel is encountered on a sensitive key that
 *                 has no corresponding value in `original`. This prevents
 *                 silent data loss.
 *
 * @example
 * ```ts
 * const submitted = { openai: { apiKey: '__WUNDR_REDACTED__', model: 'gpt-4o' } };
 * const onDisk    = { openai: { apiKey: 'sk-real-key',        model: 'gpt-4' } };
 * const restored  = restoreRedactedValues(submitted, onDisk);
 * // => { openai: { apiKey: 'sk-real-key', model: 'gpt-4o' } }
 * ```
 */
export function restoreRedactedValues(
  incoming: unknown,
  original: unknown
): unknown {
  if (incoming === null || incoming === undefined) {
    return incoming;
  }

  if (typeof incoming !== 'object') {
    return incoming;
  }

  if (Array.isArray(incoming)) {
    const origArr = Array.isArray(original) ? original : [];
    return incoming.map((item, i) => restoreRedactedValues(item, origArr[i]));
  }

  const orig =
    original && typeof original === 'object' && !Array.isArray(original)
      ? (original as Record<string, unknown>)
      : {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    incoming as Record<string, unknown>
  )) {
    if (isSensitiveKey(key) && value === REDACTED_SENTINEL) {
      if (!(key in orig)) {
        throw new Error(
          `config write rejected: "${key}" is redacted; set an explicit value instead of ${REDACTED_SENTINEL}`
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

// ---------------------------------------------------------------------------
// Identifier hashing
// ---------------------------------------------------------------------------

/**
 * Produce a one-way SHA-256 hash prefix for an identifier.
 *
 * Useful for logging correlation IDs (session IDs, connection IDs) without
 * exposing the raw values. The hash prefix is short enough to be practical
 * for log grep while being irreversible.
 *
 * @param value - The identifier string to hash.
 * @param opts  - Optional: `len` controls the hex prefix length (default 12).
 * @returns       A string like `sha256:a1b2c3d4e5f6` or `"-"` for empty input.
 */
export function redactIdentifier(
  value: string | undefined,
  opts?: { len?: number }
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '-';
  }

  const len = opts?.len ?? 12;
  const safeLen = Number.isFinite(len) ? Math.max(1, Math.floor(len)) : 12;
  const hash = crypto
    .createHash('sha256')
    .update(trimmed)
    .digest('hex')
    .slice(0, safeLen);

  return `sha256:${hash}`;
}

// ---------------------------------------------------------------------------
// Environment variable formatting
// ---------------------------------------------------------------------------

/**
 * Format an environment variable value for safe display in logs.
 *
 * If the variable name is known to be sensitive (or matches the generic
 * sensitive key heuristic), the value is replaced with `"<redacted>"`.
 * Otherwise, long values are truncated to 160 characters.
 *
 * @param value - The raw environment variable value.
 * @param key   - The environment variable name (used for sensitivity check).
 * @returns       A display-safe string.
 */
export function formatEnvValue(value: string, key?: string): string {
  if (key && isSensitiveEnvKey(key)) {
    return '<redacted>';
  }

  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 160) {
    return singleLine;
  }
  return `${singleLine.slice(0, 160)}...`;
}

// ---------------------------------------------------------------------------
// WebSocket payload redaction
// ---------------------------------------------------------------------------

/**
 * Deep-walk a WebSocket payload and redact any string values that match
 * sensitive patterns. Non-string values are passed through unchanged.
 *
 * This is designed to be called on outbound WS messages before
 * serialization, catching credentials in tool outputs, error messages,
 * task contexts, and any other dynamic string data.
 *
 * @param payload  - The payload object (or primitive) to redact.
 * @param options  - Optional redaction options (mode, custom patterns).
 * @returns          A deep copy with sensitive strings redacted.
 */
export function redactWsPayload<T>(payload: T, options?: RedactOptions): T {
  return redactPayloadValue(payload, options) as T;
}

function redactPayloadValue(value: unknown, options?: RedactOptions): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveText(value, options);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => redactPayloadValue(item, options));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    // For keys that are known to be sensitive, apply both structural
    // redaction (sentinel) and text-based redaction
    if (isSensitiveKey(key) && typeof val === 'string') {
      result[key] = redactSensitiveText(val, options);
    } else {
      result[key] = redactPayloadValue(val, options);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stream-safe redaction
// ---------------------------------------------------------------------------

/**
 * A stateful redactor for streaming contexts (e.g., chunked HTTP responses,
 * SSE streams, or process stdout piping).
 *
 * The problem with naive per-chunk redaction is that a credential may span
 * a chunk boundary (e.g., `sk-proj-abc` arrives as `sk-proj-` in chunk 1
 * and `abc...` in chunk 2). This class buffers a trailing window of each
 * chunk and re-checks it when the next chunk arrives.
 *
 * Usage:
 * ```ts
 * const stream = new RedactingStream();
 * for await (const chunk of source) {
 *   const safe = stream.write(chunk);
 *   destination.write(safe);
 * }
 * destination.write(stream.flush());
 * ```
 */
export class RedactingStream {
  private buffer = '';
  private readonly options: RedactOptions;
  /**
   * Maximum number of characters to buffer for cross-chunk matching.
   * This should be at least as long as the longest possible credential
   * that could span a boundary. 256 is generous for all known patterns.
   */
  private readonly windowSize: number;

  constructor(options?: RedactOptions, windowSize = 256) {
    this.options = options ?? {};
    this.windowSize = windowSize;
  }

  /**
   * Process a new chunk. Returns the safely redacted text that can be
   * emitted immediately. A trailing window is held back until the next
   * `write()` or `flush()` call to handle cross-boundary matches.
   */
  write(chunk: string): string {
    const combined = this.buffer + chunk;
    const redacted = redactSensitiveText(combined, this.options);

    if (redacted.length <= this.windowSize) {
      // The entire combined text fits in the buffer window; hold it all.
      this.buffer = redacted;
      return '';
    }

    // Emit everything except the trailing window.
    const emitUpTo = redacted.length - this.windowSize;
    this.buffer = redacted.slice(emitUpTo);
    return redacted.slice(0, emitUpTo);
  }

  /**
   * Flush any remaining buffered content. Call this when the stream ends.
   * The returned text has already been redacted.
   */
  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    // One final redaction pass on the remaining buffer in case the last
    // chunk completed a partial credential pattern.
    return redactSensitiveText(remaining, this.options);
  }

  /**
   * Reset the stream state, discarding any buffered content.
   */
  reset(): void {
    this.buffer = '';
  }
}

// ---------------------------------------------------------------------------
// Redacting Logger
// ---------------------------------------------------------------------------

/**
 * Log level enum matching Wundr's Logger convention.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * A logger that automatically redacts sensitive text in all messages and
 * stringified arguments before writing to the console.
 *
 * This is a drop-in replacement for Wundr's `Logger` class that adds
 * credential scrubbing. It shares the same interface so existing code
 * can switch by changing the import.
 *
 * @example
 * ```ts
 * const logger = createRedactingLogger('MyService');
 * logger.info(`Connecting with key ${apiKey}`);
 * // Console output: [2025-01-15T...] [INFO] [MyService] Connecting with key sk-pro...cdef
 * ```
 */
export class RedactingLogger {
  private level: LogLevel;
  private name: string;
  private redactOptions: RedactOptions;

  constructor(
    name: string,
    level: LogLevel = LogLevel.INFO,
    redactOptions?: RedactOptions
  ) {
    this.name = name;
    this.level = level;
    this.redactOptions = redactOptions ?? { mode: 'tools' };
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(
        `[${this.timestamp()}] [DEBUG] [${this.name}]`,
        this.redact(message),
        ...this.redactArgs(args)
      );
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(
        `[${this.timestamp()}] [INFO] [${this.name}]`,
        this.redact(message),
        ...this.redactArgs(args)
      );
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(
        `[${this.timestamp()}] [WARN] [${this.name}]`,
        this.redact(message),
        ...this.redactArgs(args)
      );
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(
        `[${this.timestamp()}] [ERROR] [${this.name}]`,
        this.redact(message),
        ...this.redactArgs(args)
      );
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  private redact(text: string): string {
    return redactSensitiveText(text, this.redactOptions);
  }

  private redactArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        return redactSensitiveText(arg, this.redactOptions);
      }
      if (arg instanceof Error) {
        // Redact the error message but preserve the stack for debugging
        const redactedMessage = redactSensitiveText(
          arg.message,
          this.redactOptions
        );
        if (redactedMessage === arg.message) {
          return arg;
        }
        const redactedError = new Error(redactedMessage);
        redactedError.name = arg.name;
        redactedError.stack = arg.stack;
        return redactedError;
      }
      if (arg && typeof arg === 'object') {
        try {
          const serialized = JSON.stringify(arg);
          const redacted = redactSensitiveText(serialized, this.redactOptions);
          if (redacted === serialized) {
            return arg;
          }
          return JSON.parse(redacted);
        } catch {
          return arg;
        }
      }
      return arg;
    });
  }
}

/**
 * Create a RedactingLogger instance.
 *
 * @param name    - Logger name (usually the subsystem or class name).
 * @param level   - Minimum log level to output. Defaults to INFO.
 * @param options - Optional redaction options (mode, custom patterns).
 */
export function createRedactingLogger(
  name: string,
  level?: LogLevel,
  options?: RedactOptions
): RedactingLogger {
  return new RedactingLogger(name, level ?? LogLevel.INFO, options);
}
