/**
 * Input Validation Framework for Wundr Orchestrator Daemon
 *
 * Provides Zod-based runtime validation for all external inputs:
 * - WebSocket messages
 * - Batch job definitions (YAML/JSON)
 * - Plugin manifests
 * - File paths (traversal prevention)
 * - Command execution (injection prevention)
 * - HTML output (XSS prevention)
 *
 * Design principles:
 * - Validate at every trust boundary (network, filesystem, plugin)
 * - Allowlist over blocklist
 * - No shell: true -- commands use spawn(file, args) exclusively
 * - Inspired by OpenClaw's exec-approvals.ts (1,542 lines of battle-tested shell analysis)
 */

import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Shell metacharacters that indicate injection attempts when found in
 * command arguments. These are characters that have special meaning in
 * sh/bash and should never appear unescaped in spawn() arguments.
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>!#~*?\n\r\\]/;

/**
 * Characters that are always dangerous in any context.
 */
const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Maximum message size in bytes to prevent memory exhaustion attacks.
 */
const MAX_WS_MESSAGE_SIZE = 1_048_576; // 1 MB

/**
 * Maximum length for string fields in WebSocket messages.
 */
const MAX_STRING_LENGTH = 10_000;

/**
 * Maximum length for session IDs and identifiers.
 */
const MAX_ID_LENGTH = 256;

/**
 * Default set of allowed binaries for batch command execution.
 * Modeled after OpenClaw's DEFAULT_SAFE_BINS but extended for Wundr's use cases.
 */
export const DEFAULT_ALLOWED_BINARIES = new Set([
  // Node.js ecosystem
  'node',
  'npm',
  'npx',
  'yarn',
  'pnpm',
  'tsx',
  'ts-node',
  'tsc',

  // Build tools
  'turbo',
  'esbuild',
  'vite',
  'webpack',
  'rollup',

  // Test runners
  'jest',
  'vitest',
  'mocha',
  'playwright',

  // Linters and formatters
  'eslint',
  'prettier',
  'biome',

  // Version control
  'git',

  // Standard POSIX utilities (safe subset)
  'echo',
  'cat',
  'ls',
  'cp',
  'mv',
  'mkdir',
  'rm',
  'grep',
  'find',
  'sort',
  'uniq',
  'head',
  'tail',
  'wc',
  'tr',
  'cut',
  'diff',
  'sed',
  'awk',
  'jq',
  'which',
  'env',
  'pwd',
  'date',
  'basename',
  'dirname',
  'realpath',

  // Wundr-specific
  'wundr',
  'claude',
]);

// ============================================================================
// Error Types
// ============================================================================

export class ValidationError extends Error {
  public readonly code: string;
  public readonly details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
  }
}

export class CommandInjectionError extends ValidationError {
  constructor(message: string, details?: unknown) {
    super('COMMAND_INJECTION', message, details);
    this.name = 'CommandInjectionError';
  }
}

export class PathTraversalError extends ValidationError {
  constructor(attemptedPath: string, boundary: string) {
    super(
      'PATH_TRAVERSAL',
      `Path "${attemptedPath}" escapes boundary "${boundary}"`,
      { attemptedPath, boundary }
    );
    this.name = 'PathTraversalError';
  }
}

// ============================================================================
// WebSocket Message Validation Schemas
// ============================================================================

/**
 * Safe string schema -- strips control characters, enforces max length.
 */
const SafeString = z
  .string()
  .max(MAX_STRING_LENGTH)
  .transform((s) => s.replace(CONTROL_CHARACTERS, ''));

/**
 * Safe identifier schema -- alphanumeric with hyphens and underscores.
 */
const SafeId = z
  .string()
  .max(MAX_ID_LENGTH)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Identifier must contain only alphanumeric characters, hyphens, and underscores'
  );

/**
 * UUID schema for session and orchestrator IDs.
 */
const UUIDString = z.string().uuid();

/**
 * Task type enum.
 */
const TaskTypeSchema = z.enum([
  'code',
  'research',
  'analysis',
  'custom',
  'general',
]);

/**
 * Priority enum.
 */
const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Task status enum.
 */
const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
]);

/**
 * Session type enum.
 */
const SessionTypeSchema = z.enum(['claude-code', 'claude-flow']);

/**
 * Schema for spawn_session payload.
 */
export const SpawnSessionPayloadSchema = z.object({
  orchestratorId: SafeId,
  task: z.object({
    type: TaskTypeSchema,
    description: SafeString.pipe(z.string().min(1)),
    priority: PrioritySchema,
    assignedTo: SafeId.optional(),
    status: TaskStatusSchema.default('pending'),
    metadata: z.record(z.unknown()).optional(),
  }),
  sessionType: SessionTypeSchema,
  memoryProfile: SafeId.optional(),
});

/**
 * Schema for execute_task payload.
 */
export const ExecuteTaskPayloadSchema = z.object({
  sessionId: SafeId,
  task: SafeString.pipe(z.string().min(1)),
  context: z.record(z.unknown()).optional(),
  streamResponse: z.boolean().optional(),
});

/**
 * Schema for session_status payload.
 */
export const SessionStatusPayloadSchema = z.object({
  sessionId: SafeId,
});

/**
 * Schema for stop_session payload.
 */
export const StopSessionPayloadSchema = z.object({
  sessionId: SafeId,
});

/**
 * Validated WebSocket message discriminated union.
 *
 * Each message type has its payload validated independently.
 * This replaces the unsafe `JSON.parse(data) as WSMessage` pattern.
 */
export const WSMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('pong') }),
  z.object({
    type: z.literal('spawn_session'),
    payload: SpawnSessionPayloadSchema,
  }),
  z.object({
    type: z.literal('session_status'),
    payload: SessionStatusPayloadSchema,
  }),
  z.object({ type: z.literal('daemon_status') }),
  z.object({
    type: z.literal('stop_session'),
    payload: StopSessionPayloadSchema,
  }),
  z.object({ type: z.literal('health_check') }),
  z.object({
    type: z.literal('execute_task'),
    payload: ExecuteTaskPayloadSchema,
  }),
  z.object({ type: z.literal('list_sessions') }),
]);

export type ValidatedWSMessage = z.infer<typeof WSMessageSchema>;

/**
 * Validate a raw WebSocket message buffer.
 *
 * Performs size check, JSON parse, and Zod schema validation in one call.
 * Returns a discriminated result so callers can handle errors cleanly.
 */
export function validateWSMessage(
  data: Buffer | string
): { ok: true; message: ValidatedWSMessage } | { ok: false; error: string } {
  const raw = typeof data === 'string' ? data : data.toString('utf8');

  // Size check
  if (Buffer.byteLength(raw, 'utf8') > MAX_WS_MESSAGE_SIZE) {
    return { ok: false, error: 'Message exceeds maximum allowed size' };
  }

  // JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }

  // Schema validation
  const result = WSMessageSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `Validation failed: ${issues}` };
  }

  return { ok: true, message: result.data };
}

// ============================================================================
// Batch Job Validation Schemas
// ============================================================================

/**
 * Schema for a single batch command.
 * Commands are validated to prevent injection before execution.
 */
export const BatchCommandSchema = z.object({
  command: z
    .string()
    .min(1, 'Command must not be empty')
    .max(4096, 'Command must not exceed 4096 characters'),
  args: z.array(z.string().max(4096)).optional(),
  condition: z
    .enum(['always', 'never'])
    .or(z.string().regex(/^env:[A-Za-z_][A-Za-z0-9_]*$/, 'Conditions must be "always", "never", or "env:VAR_NAME"'))
    .optional(),
  retry: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(100).max(3_600_000).optional(), // 100ms to 1 hour
  env: z.record(z.string()).optional(),
});

export type ValidatedBatchCommand = z.infer<typeof BatchCommandSchema>;

/**
 * Schema for a complete batch job definition.
 */
export const BatchJobSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_ -]*$/, 'Job name contains invalid characters'),
  description: z.string().max(1000).optional(),
  commands: z.array(BatchCommandSchema).min(1).max(500),
  parallel: z.boolean().optional().default(false),
  continueOnError: z.boolean().optional().default(false),
  variables: z.record(z.string()).optional(),
});

export type ValidatedBatchJob = z.infer<typeof BatchJobSchema>;

/**
 * Validate a batch job definition (from YAML or JSON source).
 */
export function validateBatchJob(
  input: unknown
): { ok: true; job: ValidatedBatchJob } | { ok: false; errors: string[] } {
  const result = BatchJobSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`
      ),
    };
  }
  return { ok: true, job: result.data };
}

// ============================================================================
// Safe Variable Interpolation
// ============================================================================

/**
 * Regex for valid variable names in batch templates.
 */
const VALID_VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Safely interpolate variables into a batch job definition.
 *
 * Unlike the original regex-based approach that replaced {{var}} directly
 * in a JSON-stringified command string (allowing JSON/shell breakout),
 * this function:
 *
 * 1. Validates variable names against a strict pattern
 * 2. Only replaces variables in string values, not in structural positions
 * 3. Returns variables as a separate map for command-level env vars
 *
 * Variables are NOT interpolated into the command string itself. Instead,
 * they are passed as environment variables to the child process, eliminating
 * the injection vector entirely.
 */
export function resolveVariables(
  vars: string | undefined
): { ok: true; variables: Record<string, string> } | { ok: false; error: string } {
  if (!vars) {
    return { ok: true, variables: {} };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(vars);
  } catch {
    // Try key=value pairs
    parsed = {};
    for (const pair of vars.split(',')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex <= 0) {
        return { ok: false, error: `Invalid variable pair: "${pair}"` };
      }
      const key = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      parsed[key] = value;
    }
  }

  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!VALID_VARIABLE_NAME.test(key)) {
      return {
        ok: false,
        error: `Invalid variable name "${key}": must match [a-zA-Z_][a-zA-Z0-9_]*`,
      };
    }
    const strValue = String(value);
    // Strip control characters from values
    variables[key] = strValue.replace(CONTROL_CHARACTERS, '');
  }

  return { ok: true, variables };
}

// ============================================================================
// Safe Command Builder
// ============================================================================

export interface SafeCommand {
  /** Absolute path to the binary, or the binary name if resolution is deferred. */
  file: string;
  /** Argument array -- never passed through a shell. */
  args: string[];
  /** Whether the binary was found in the allowlist. */
  allowed: boolean;
}

/**
 * Tokenize a command string into [binary, ...args] without shell interpretation.
 *
 * Handles simple quoting (single and double quotes) but rejects shell
 * operators and metacharacters. This is intentionally simpler than OpenClaw's
 * full shell parser -- we do NOT support pipes, redirects, or chains.
 * Commands requiring those features should be split into multiple batch steps.
 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  if (inSingle || inDouble) {
    throw new CommandInjectionError('Unterminated quote in command string', {
      command,
    });
  }

  return tokens;
}

/**
 * Check if a string contains shell metacharacters that could enable injection.
 */
export function containsShellMetacharacters(value: string): boolean {
  return SHELL_METACHARACTERS.test(value);
}

/**
 * Validate that a command argument is safe to pass to spawn().
 *
 * Rejects arguments containing shell metacharacters. This is a defense-in-depth
 * measure -- since we never use shell: true, these characters would be treated
 * literally by the kernel, but their presence strongly suggests an injection
 * attempt.
 */
function validateArgument(arg: string, index: number): void {
  if (containsShellMetacharacters(arg)) {
    throw new CommandInjectionError(
      `Argument at index ${index} contains shell metacharacters`,
      { argument: arg, index }
    );
  }
}

/**
 * Resolve a binary name to its absolute path by searching PATH.
 *
 * Modeled after OpenClaw's resolveExecutablePath() but simplified since
 * we only need forward lookup (not reverse allowlist matching).
 */
function resolveBinaryPath(binary: string): string | null {
  // If it's already an absolute path, check it exists
  if (path.isAbsolute(binary)) {
    try {
      fs.accessSync(binary, fs.constants.X_OK);
      return binary;
    } catch {
      return null;
    }
  }

  // Search PATH
  const pathEnv = process.env.PATH ?? '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);

  for (const dir of dirs) {
    const candidate = path.join(dir, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Build a safe command from a command string and optional extra arguments.
 *
 * This is the primary entry point for replacing `shell: true` patterns.
 *
 * @param commandStr - The command string (e.g., "npm run build")
 * @param extraArgs - Additional arguments to append
 * @param options - Configuration options
 * @returns A SafeCommand ready for spawn(safe.file, safe.args)
 * @throws CommandInjectionError if the command contains injection patterns
 *
 * Usage:
 *   const safe = SafeCommandBuilder.build('npm', ['run', 'build']);
 *   spawn(safe.file, safe.args, { stdio: 'inherit' }); // no shell: true
 */
export const SafeCommandBuilder = {
  build(
    commandStr: string,
    extraArgs?: string[],
    options?: {
      allowlist?: Set<string>;
      allowUnknownBinaries?: boolean;
      cwd?: string;
    }
  ): SafeCommand {
    const allowlist = options?.allowlist ?? DEFAULT_ALLOWED_BINARIES;
    const allowUnknown = options?.allowUnknownBinaries ?? false;

    // Tokenize the command string
    const tokens = tokenizeCommand(commandStr.trim());
    if (tokens.length === 0) {
      throw new CommandInjectionError('Empty command');
    }

    const [binary, ...cmdArgs] = tokens;
    if (!binary) {
      throw new CommandInjectionError('Empty command binary');
    }

    // Combine command-string args with extra args
    const allArgs = extraArgs ? [...cmdArgs, ...extraArgs] : cmdArgs;

    // Validate each argument for shell metacharacters
    for (let i = 0; i < allArgs.length; i++) {
      validateArgument(allArgs[i]!, i);
    }

    // Check the binary name (not the path) against the allowlist
    const binaryName = path.basename(binary).toLowerCase();
    const isAllowed = allowlist.has(binaryName);

    if (!isAllowed && !allowUnknown) {
      throw new CommandInjectionError(
        `Binary "${binary}" is not in the allowed list. ` +
          `Allowed: ${Array.from(allowlist).sort().join(', ')}`,
        { binary, binaryName }
      );
    }

    // Resolve to absolute path
    const resolvedPath = resolveBinaryPath(binary);
    const file = resolvedPath ?? binary;

    return { file, args: allArgs, allowed: isAllowed };
  },

  /**
   * Build a command from a pre-split argv array.
   * Useful when the binary and args are already separate.
   */
  fromArgv(
    argv: string[],
    options?: {
      allowlist?: Set<string>;
      allowUnknownBinaries?: boolean;
    }
  ): SafeCommand {
    if (argv.length === 0) {
      throw new CommandInjectionError('Empty argv');
    }

    const [binary, ...args] = argv;
    if (!binary) {
      throw new CommandInjectionError('Empty binary in argv');
    }

    return SafeCommandBuilder.build(binary, args, options);
  },
};

// ============================================================================
// Path Traversal Prevention
// ============================================================================

/**
 * Resolve a path and verify it stays within a boundary directory.
 *
 * Prevents path traversal attacks where user input like "../../etc/passwd"
 * could escape intended directories.
 *
 * @param untrustedPath - The user-supplied path to validate
 * @param boundary - The directory the path must stay within
 * @returns The resolved canonical path
 * @throws PathTraversalError if the path escapes the boundary
 */
export function safePath(untrustedPath: string, boundary: string): string {
  // Resolve both paths to absolute canonical form
  const resolvedBoundary = path.resolve(boundary);
  const resolvedTarget = path.resolve(resolvedBoundary, untrustedPath);

  // Normalize to handle trailing slashes
  const normalizedBoundary = resolvedBoundary.endsWith(path.sep)
    ? resolvedBoundary
    : resolvedBoundary + path.sep;

  // Check containment
  if (
    resolvedTarget !== resolvedBoundary &&
    !resolvedTarget.startsWith(normalizedBoundary)
  ) {
    throw new PathTraversalError(untrustedPath, boundary);
  }

  return resolvedTarget;
}

/**
 * Check if a path is within a boundary without throwing.
 */
export function isWithinBoundary(
  untrustedPath: string,
  boundary: string
): boolean {
  try {
    safePath(untrustedPath, boundary);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and normalize a filename (no directory components allowed).
 */
export function safeFilename(filename: string): string {
  const normalized = path.basename(filename);
  if (normalized !== filename || normalized === '.' || normalized === '..') {
    throw new PathTraversalError(
      filename,
      'Filename must not contain directory components'
    );
  }
  return normalized;
}

// ============================================================================
// Plugin Validation
// ============================================================================

/**
 * Schema for plugin manifest validation.
 */
export const PluginManifestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^[a-z0-9@][a-z0-9._/-]*$/,
      'Plugin name must follow npm naming conventions'
    ),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+/, 'Version must follow semver'),
  description: z.string().max(500).optional(),
  main: z.string().max(255),
  capabilities: z
    .object({
      filesystem: z
        .object({
          read: z.array(z.string().max(512)).default([]),
          write: z.array(z.string().max(512)).default([]),
        })
        .optional(),
      network: z
        .object({
          allowedHosts: z.array(z.string().max(253)).default([]),
        })
        .optional(),
      exec: z
        .object({
          allowedBinaries: z.array(z.string().max(128)).default([]),
        })
        .optional(),
    })
    .optional(),
  wundr: z
    .object({
      minVersion: z.string().optional(),
      maxVersion: z.string().optional(),
    })
    .optional(),
});

export type ValidatedPluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Validate a plugin name for safe use in filesystem paths and npm operations.
 *
 * Prevents path traversal via plugin names like "../malicious" or
 * "valid-name/../../escape".
 */
export function validatePluginName(name: string): string {
  // Must match npm naming conventions
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    throw new ValidationError(
      'INVALID_PLUGIN_NAME',
      `Invalid plugin name: "${name}"`,
      { name }
    );
  }

  // Must not contain path traversal sequences
  if (name.includes('..') || name.includes('//')) {
    throw new PathTraversalError(name, 'plugin names');
  }

  return name;
}

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Strip control characters from a string.
 *
 * Removes ASCII control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F)
 * while preserving tabs (\t), newlines (\n), and carriage returns (\r).
 */
export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHARACTERS, '');
}

/**
 * Sanitize a string for safe inclusion in HTML output.
 *
 * Escapes the five XML special characters to prevent XSS:
 * & < > " '
 */
export function sanitizeForHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a value for safe use in SQL queries.
 *
 * IMPORTANT: This should be used ONLY as a defense-in-depth measure.
 * All database queries should use parameterized queries / prepared
 * statements as the primary defense. This function provides a fallback
 * for cases where parameterized queries are not available.
 */
export function sanitizeForSQL(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\x00/g, '')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Truncate a string to a maximum length, with a configurable suffix.
 */
export function truncate(
  input: string,
  maxLength: number,
  suffix = '...'
): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength - suffix.length) + suffix;
}

// ============================================================================
// Credential Redaction
// ============================================================================

/**
 * Patterns that match common credential formats in strings.
 * Used to prevent accidental credential leakage in logs and error messages.
 */
const CREDENTIAL_PATTERNS = [
  /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"]?([^\s'"]+)/gi,
  /(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]+)/gi,
  /(?:secret|token)\s*[=:]\s*['"]?([^\s'"]+)/gi,
  /(?:authorization|auth)\s*[=:]\s*['"]?(?:bearer\s+)?([^\s'"]+)/gi,
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI API keys
  /sk-ant-[a-zA-Z0-9-]{20,}/g, // Anthropic API keys
  /ghp_[a-zA-Z0-9]{36,}/g, // GitHub PATs
  /gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth tokens
  /xoxb-[a-zA-Z0-9-]+/g, // Slack bot tokens
];

/**
 * Redact credentials from a string for safe logging.
 *
 * Replaces matched credential patterns with [REDACTED].
 */
export function redactCredentials(input: string): string {
  let result = input;
  for (const pattern of CREDENTIAL_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match) => {
      // Keep the key name, redact the value
      const eqIndex = match.search(/[=:]/);
      if (eqIndex > 0) {
        return match.slice(0, eqIndex + 1) + ' [REDACTED]';
      }
      return '[REDACTED]';
    });
  }
  return result;
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _testing = {
  tokenizeCommand,
  validateArgument,
  resolveBinaryPath,
  SHELL_METACHARACTERS,
  CONTROL_CHARACTERS,
  MAX_WS_MESSAGE_SIZE,
};
