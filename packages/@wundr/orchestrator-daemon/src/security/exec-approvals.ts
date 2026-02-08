/**
 * Execution Approval System for Wundr Orchestrator Daemon
 *
 * Ported from OpenClaw's exec-approvals.ts and adapted to Wundr's
 * MCP tool registry, charter safety heuristics, and session-scoped
 * execution model.
 *
 * Provides:
 * - Shell command parsing with pipe/chain/quoting awareness
 * - Executable path resolution and verification
 * - Allowlist pattern matching (glob-based)
 * - Safe binary detection
 * - Per-tool execution policies
 * - Session-scoped approval state management
 *
 * NOTE: This module does NOT execute any commands. It only analyzes
 * command strings and produces allow/deny/prompt verdicts. Actual
 * execution happens in the ToolExecutor after approval.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Logger } from '../utils/logger';

import type { CharterSafetyHeuristics } from '../charter/types';

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Controls what is permitted to run */
export type ExecSecurity = 'deny' | 'allowlist' | 'full';

/** Controls when to prompt the user for approval */
export type ExecAsk = 'off' | 'on-miss' | 'always';

/** The decision returned from an approval request */
export type ExecApprovalDecision = 'allow-once' | 'allow-always' | 'deny';

/** Combined policy for a session or agent */
export interface ExecPolicy {
  security: ExecSecurity;
  ask: ExecAsk;
  askFallback: ExecSecurity;
}

/** A single entry in the command allowlist */
export interface AllowlistEntry {
  id: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

/** Per-tool policy */
export interface ToolPolicy {
  toolName: string;
  security: ExecSecurity;
  ask: ExecAsk;
  /** Glob patterns restricting which paths the tool may access */
  pathRestrictions?: string[];
  /** Argument patterns that are always denied */
  argDenyPatterns?: string[];
}

// ---------------------------------------------------------------------------
// Command analysis types
// ---------------------------------------------------------------------------

/** Result of resolving a command's binary */
export interface CommandResolution {
  rawExecutable: string;
  resolvedPath?: string;
  executableName: string;
}

/** A single parsed segment of a shell command (one pipeline stage) */
export interface CommandSegment {
  raw: string;
  argv: string[];
  resolution: CommandResolution | null;
}

/** Full analysis of a shell command string */
export interface CommandAnalysis {
  ok: boolean;
  reason?: string;
  segments: CommandSegment[];
  /** Segments grouped by chain operator (&&, ||, ;) */
  chains?: CommandSegment[][];
}

/** Result of evaluating a command against the allowlist */
export interface AllowlistEvaluation {
  analysisOk: boolean;
  allowlistSatisfied: boolean;
  allowlistMatches: AllowlistEntry[];
  segments: CommandSegment[];
}

// ---------------------------------------------------------------------------
// Session approval state
// ---------------------------------------------------------------------------

/** Per-session approval state */
export interface ExecApprovalState {
  policy: ExecPolicy;
  allowlist: AllowlistEntry[];
  toolPolicies: Map<string, ToolPolicy>;
  safeBins: Set<string>;
  /** Cached decisions keyed by a hash of the command/tool invocation */
  decisions: Map<string, ExecApprovalDecision>;
}

// ---------------------------------------------------------------------------
// Gate evaluation result
// ---------------------------------------------------------------------------

export type GateVerdict = 'allow' | 'prompt' | 'deny';

export interface GateEvaluation {
  verdict: GateVerdict;
  reason: string;
  toolName: string;
  command?: string;
  analysis?: CommandAnalysis;
  matchedEntries?: AllowlistEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SECURITY: ExecSecurity = 'deny';
const DEFAULT_ASK: ExecAsk = 'on-miss';
const DEFAULT_ASK_FALLBACK: ExecSecurity = 'deny';

export const DEFAULT_SAFE_BINS: readonly string[] = [
  'jq',
  'grep',
  'cut',
  'sort',
  'uniq',
  'head',
  'tail',
  'tr',
  'wc',
  'cat',
  'echo',
  'date',
  'env',
  'whoami',
  'uname',
  'which',
  'true',
  'false',
  'test',
  'basename',
  'dirname',
  'pwd',
  'ls',
  'find',
];

/** Tokens that are never allowed inside a pipeline segment */
const DISALLOWED_PIPELINE_TOKENS = new Set([
  '>',
  '<',
  '`',
  '\n',
  '\r',
  '(',
  ')',
]);

/** Characters that terminate double-quote escape sequences */
const DOUBLE_QUOTE_ESCAPES = new Set(['\\', '"', '$', '`', '\n', '\r']);

/** Default tool policies for Wundr's built-in MCP tools */
const DEFAULT_TOOL_POLICIES: ToolPolicy[] = [
  { toolName: 'file_read', security: 'allowlist', ask: 'off' },
  { toolName: 'file_write', security: 'allowlist', ask: 'on-miss' },
  { toolName: 'file_delete', security: 'allowlist', ask: 'always' },
  { toolName: 'bash_execute', security: 'allowlist', ask: 'on-miss' },
  { toolName: 'web_fetch', security: 'full', ask: 'off' },
  { toolName: 'file_list', security: 'full', ask: 'off' },
  { toolName: 'drift_detection', security: 'full', ask: 'off' },
  {
    toolName: 'pattern_standardize',
    security: 'allowlist',
    ask: 'on-miss',
  },
  { toolName: 'dependency_analyze', security: 'full', ask: 'off' },
];

// ---------------------------------------------------------------------------
// Utility: home directory expansion
// ---------------------------------------------------------------------------

function expandHome(value: string): string {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

// ---------------------------------------------------------------------------
// Binary resolution
// ---------------------------------------------------------------------------

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform !== 'win32') {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function resolveExecutablePath(
  rawExecutable: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): string | undefined {
  const expanded = rawExecutable.startsWith('~')
    ? expandHome(rawExecutable)
    : rawExecutable;

  // If the binary has a path separator, resolve relative or absolute
  if (expanded.includes('/') || expanded.includes('\\')) {
    if (path.isAbsolute(expanded)) {
      return isExecutableFile(expanded) ? expanded : undefined;
    }
    const base = cwd?.trim() || process.cwd();
    const candidate = path.resolve(base, expanded);
    return isExecutableFile(candidate) ? candidate : undefined;
  }

  // Otherwise search PATH
  const envPath =
    env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path ?? '';
  const entries = envPath.split(path.delimiter).filter(Boolean);

  for (const entry of entries) {
    const candidate = path.join(entry, expanded);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Parse the first token from a shell command string, respecting quotes.
 */
function parseFirstToken(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const first = trimmed[0];
  if (first === '"' || first === "'") {
    const end = trimmed.indexOf(first, 1);
    if (end > 1) return trimmed.slice(1, end);
    return trimmed.slice(1);
  }

  const match = /^[^\s]+/.exec(trimmed);
  return match ? match[0] : null;
}

/**
 * Resolve a shell command string to its binary information.
 */
export function resolveCommandResolution(
  command: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): CommandResolution | null {
  const rawExecutable = parseFirstToken(command);
  if (!rawExecutable) return null;

  const resolvedPath = resolveExecutablePath(rawExecutable, cwd, env);
  const executableName = resolvedPath
    ? path.basename(resolvedPath)
    : rawExecutable;

  return { rawExecutable, resolvedPath, executableName };
}

/**
 * Resolve an argv array to its binary information.
 */
export function resolveCommandResolutionFromArgv(
  argv: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): CommandResolution | null {
  const rawExecutable = argv[0]?.trim();
  if (!rawExecutable) return null;

  const resolvedPath = resolveExecutablePath(rawExecutable, cwd, env);
  const executableName = resolvedPath
    ? path.basename(resolvedPath)
    : rawExecutable;

  return { rawExecutable, resolvedPath, executableName };
}

// ---------------------------------------------------------------------------
// Shell command parsing
// ---------------------------------------------------------------------------

function isDoubleQuoteEscape(next: string | undefined): next is string {
  return Boolean(next && DOUBLE_QUOTE_ESCAPES.has(next));
}

type IteratorAction = 'split' | 'skip' | 'include' | { reject: string };

/**
 * Iterate through a command string while respecting shell quoting rules.
 * The callback receives each unquoted character and returns an action.
 */
function iterateQuoteAware(
  command: string,
  onChar: (
    ch: string,
    next: string | undefined,
    index: number,
  ) => IteratorAction,
):
  | { ok: true; parts: string[]; hasSplit: boolean }
  | { ok: false; reason: string } {
  const parts: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let hasSplit = false;

  const pushPart = () => {
    const trimmed = buf.trim();
    if (trimmed) parts.push(trimmed);
    buf = '';
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }

    if (!inSingle && !inDouble && ch === '\\') {
      escaped = true;
      buf += ch;
      continue;
    }

    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }

    if (inDouble) {
      if (ch === '\\' && isDoubleQuoteEscape(next)) {
        buf += ch;
        buf += next;
        i += 1;
        continue;
      }
      if (ch === '$' && next === '(') {
        return { ok: false, reason: 'unsupported shell token: $()' };
      }
      if (ch === '`') {
        return { ok: false, reason: 'unsupported shell token: `' };
      }
      if (ch === '\n' || ch === '\r') {
        return { ok: false, reason: 'unsupported shell token: newline' };
      }
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    const action = onChar(ch, next, i);
    if (typeof action === 'object' && 'reject' in action) {
      return { ok: false, reason: action.reject };
    }
    if (action === 'split') {
      pushPart();
      hasSplit = true;
      continue;
    }
    if (action === 'skip') continue;

    buf += ch;
  }

  if (escaped || inSingle || inDouble) {
    return { ok: false, reason: 'unterminated shell quote/escape' };
  }

  pushPart();
  return { ok: true, parts, hasSplit };
}

/**
 * Split a command by pipe (`|`) operators, rejecting `||`, `|&`, and other
 * dangerous shell tokens.
 */
function splitShellPipeline(
  command: string,
): { ok: boolean; reason?: string; segments: string[] } {
  let emptySegment = false;

  const result = iterateQuoteAware(command, (ch, next) => {
    if (ch === '|' && next === '|') {
      return { reject: 'unsupported shell token: ||' };
    }
    if (ch === '|' && next === '&') {
      return { reject: 'unsupported shell token: |&' };
    }
    if (ch === '|') {
      emptySegment = true;
      return 'split';
    }
    if (ch === '&' || ch === ';') {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (DISALLOWED_PIPELINE_TOKENS.has(ch)) {
      return { reject: `unsupported shell token: ${ch}` };
    }
    if (ch === '$' && next === '(') {
      return { reject: 'unsupported shell token: $()' };
    }
    emptySegment = false;
    return 'include';
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, segments: [] };
  }
  if (emptySegment || result.parts.length === 0) {
    return {
      ok: false,
      reason:
        result.parts.length === 0
          ? 'empty command'
          : 'empty pipeline segment',
      segments: [],
    };
  }

  return { ok: true, segments: result.parts };
}

/**
 * Split a command string by chain operators (`&&`, `||`, `;`) while
 * respecting quotes. Returns null when no chain operators are present.
 */
function splitCommandChain(command: string): string[] | null {
  const parts: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let foundChain = false;
  let invalidChain = false;

  const pushPart = (): boolean => {
    const trimmed = buf.trim();
    if (trimmed) {
      parts.push(trimmed);
      buf = '';
      return true;
    }
    buf = '';
    return false;
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === '\\') {
      escaped = true;
      buf += ch;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      buf += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '\\' && isDoubleQuoteEscape(next)) {
        buf += ch;
        buf += next;
        i += 1;
        continue;
      }
      if (ch === '"') inDouble = false;
      buf += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      continue;
    }

    if (ch === '&' && next === '&') {
      if (!pushPart()) invalidChain = true;
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === '|' && next === '|') {
      if (!pushPart()) invalidChain = true;
      i += 1;
      foundChain = true;
      continue;
    }
    if (ch === ';') {
      if (!pushPart()) invalidChain = true;
      foundChain = true;
      continue;
    }

    buf += ch;
  }

  const pushedFinal = pushPart();
  if (!foundChain) return null;
  if (invalidChain || !pushedFinal) return null;

  return parts.length > 0 ? parts : null;
}

/**
 * Tokenize a shell segment into an argv array, handling single/double
 * quotes and backslash escapes.
 */
function tokenizeShellSegment(segment: string): string[] | null {
  const tokens: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const pushToken = () => {
    if (buf.length > 0) {
      tokens.push(buf);
      buf = '';
    }
  };

  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];

    if (escaped) {
      buf += ch;
      escaped = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === '\\') {
      escaped = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        buf += ch;
      }
      continue;
    }
    if (inDouble) {
      const next = segment[i + 1];
      if (ch === '\\' && isDoubleQuoteEscape(next)) {
        buf += next;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = false;
      } else {
        buf += ch;
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
    if (/\s/.test(ch)) {
      pushToken();
      continue;
    }
    buf += ch;
  }

  if (escaped || inSingle || inDouble) return null;

  pushToken();
  return tokens;
}

function parseSegmentsFromParts(
  parts: string[],
  cwd?: string,
  env?: NodeJS.ProcessEnv,
): CommandSegment[] | null {
  const segments: CommandSegment[] = [];

  for (const raw of parts) {
    const argv = tokenizeShellSegment(raw);
    if (!argv || argv.length === 0) return null;

    segments.push({
      raw,
      argv,
      resolution: resolveCommandResolutionFromArgv(argv, cwd, env),
    });
  }

  return segments;
}

/**
 * Analyze a shell command string into its constituent segments,
 * handling pipelines, chain operators, and quoting.
 */
export function analyzeShellCommand(params: {
  command: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): CommandAnalysis {
  // First try splitting by chain operators (&&, ||, ;)
  const chainParts = splitCommandChain(params.command);

  if (chainParts) {
    const chains: CommandSegment[][] = [];
    const allSegments: CommandSegment[] = [];

    for (const part of chainParts) {
      const pipelineSplit = splitShellPipeline(part);
      if (!pipelineSplit.ok) {
        return { ok: false, reason: pipelineSplit.reason, segments: [] };
      }

      const segments = parseSegmentsFromParts(
        pipelineSplit.segments,
        params.cwd,
        params.env,
      );
      if (!segments) {
        return {
          ok: false,
          reason: 'unable to parse shell segment',
          segments: [],
        };
      }

      chains.push(segments);
      allSegments.push(...segments);
    }

    return { ok: true, segments: allSegments, chains };
  }

  // No chain operators -- parse as a simple pipeline
  const split = splitShellPipeline(params.command);
  if (!split.ok) {
    return { ok: false, reason: split.reason, segments: [] };
  }

  const segments = parseSegmentsFromParts(
    split.segments,
    params.cwd,
    params.env,
  );
  if (!segments) {
    return {
      ok: false,
      reason: 'unable to parse shell segment',
      segments: [],
    };
  }

  return { ok: true, segments };
}

/**
 * Analyze an argv array (pre-tokenized command).
 */
export function analyzeArgvCommand(params: {
  argv: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): CommandAnalysis {
  const argv = params.argv.filter((entry) => entry.trim().length > 0);
  if (argv.length === 0) {
    return { ok: false, reason: 'empty argv', segments: [] };
  }

  return {
    ok: true,
    segments: [
      {
        raw: argv.join(' '),
        argv,
        resolution: resolveCommandResolutionFromArgv(
          argv,
          params.cwd,
          params.env,
        ),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Glob pattern matching
// ---------------------------------------------------------------------------

function normalizeMatchTarget(value: string): string {
  return value.replace(/\\\\/g, '/').toLowerCase();
}

function globToRegExp(pattern: string): RegExp {
  let regex = '^';
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '*') {
      const next = pattern[i + 1];
      if (next === '*') {
        regex += '.*';
        i += 2;
        continue;
      }
      regex += '[^/]*';
      i += 1;
      continue;
    }

    if (ch === '?') {
      regex += '.';
      i += 1;
      continue;
    }

    regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }

  regex += '$';
  return new RegExp(regex, 'i');
}

function matchesPattern(pattern: string, target: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;

  const expanded = trimmed.startsWith('~') ? expandHome(trimmed) : trimmed;
  const normalizedPattern = normalizeMatchTarget(expanded);
  const normalizedTarget = normalizeMatchTarget(target);
  const regex = globToRegExp(normalizedPattern);

  return regex.test(normalizedTarget);
}

/**
 * Match a resolved command against allowlist entries.
 */
export function matchAllowlist(
  entries: AllowlistEntry[],
  resolution: CommandResolution | null,
): AllowlistEntry | null {
  if (!entries.length || !resolution?.resolvedPath) return null;

  const resolvedPath = resolution.resolvedPath;

  for (const entry of entries) {
    const pattern = entry.pattern?.trim();
    if (!pattern) continue;

    // Bare names (no path separator) match against the binary name
    const hasPath =
      pattern.includes('/') ||
      pattern.includes('\\') ||
      pattern.includes('~');

    if (hasPath) {
      if (matchesPattern(pattern, resolvedPath)) return entry;
    } else {
      // Match bare name against the binary basename
      if (
        resolution.executableName.toLowerCase() === pattern.toLowerCase() ||
        globToRegExp(pattern.toLowerCase()).test(
          resolution.executableName.toLowerCase(),
        )
      ) {
        return entry;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Safe binary detection
// ---------------------------------------------------------------------------

/**
 * Normalize a list of binary names into a Set for fast lookup.
 */
export function normalizeSafeBins(entries?: readonly string[]): Set<string> {
  if (!Array.isArray(entries)) return new Set();

  const normalized = entries
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return new Set(normalized);
}

/**
 * Resolve the active set of safe binaries, falling back to defaults.
 */
export function resolveSafeBins(
  entries?: readonly string[] | null,
): Set<string> {
  if (entries === undefined) return normalizeSafeBins(DEFAULT_SAFE_BINS);
  return normalizeSafeBins(entries ?? []);
}

function isPathLikeToken(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-') return false;
  if (
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('~')
  ) {
    return true;
  }
  if (trimmed.startsWith('/')) return true;
  return /^[A-Za-z]:[/\\]/.test(trimmed);
}

function defaultFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Determine whether a command invocation is a "safe" use of a known
 * read-only binary. Returns false if any arguments reference file paths
 * or existing files, which could be used for data exfiltration.
 */
export function isSafeBinUsage(params: {
  argv: string[];
  resolution: CommandResolution | null;
  safeBins: Set<string>;
  cwd?: string;
  fileExists?: (filePath: string) => boolean;
}): boolean {
  if (params.safeBins.size === 0) return false;

  const resolution = params.resolution;
  const execName = resolution?.executableName?.toLowerCase();
  if (!execName) return false;

  if (!params.safeBins.has(execName)) return false;
  if (!resolution?.resolvedPath) return false;

  const cwd = params.cwd ?? process.cwd();
  const exists = params.fileExists ?? defaultFileExists;
  const argv = params.argv.slice(1);

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token || token === '-') continue;

    if (token.startsWith('-')) {
      // Check flag values like --file=/etc/passwd
      const eqIndex = token.indexOf('=');
      if (eqIndex > 0) {
        const value = token.slice(eqIndex + 1);
        if (
          value &&
          (isPathLikeToken(value) || exists(path.resolve(cwd, value)))
        ) {
          return false;
        }
      }
      continue;
    }

    if (isPathLikeToken(token)) return false;
    if (exists(path.resolve(cwd, token))) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Allowlist evaluation
// ---------------------------------------------------------------------------

function resolveAllowlistCandidatePath(
  resolution: CommandResolution | null,
  cwd?: string,
): string | undefined {
  if (!resolution) return undefined;
  if (resolution.resolvedPath) return resolution.resolvedPath;

  const raw = resolution.rawExecutable?.trim();
  if (!raw) return undefined;

  const expanded = raw.startsWith('~') ? expandHome(raw) : raw;
  if (!expanded.includes('/') && !expanded.includes('\\')) return undefined;
  if (path.isAbsolute(expanded)) return expanded;

  const base = cwd?.trim() || process.cwd();
  return path.resolve(base, expanded);
}

function evaluateSegments(
  segments: CommandSegment[],
  params: {
    allowlist: AllowlistEntry[];
    safeBins: Set<string>;
    cwd?: string;
  },
): { satisfied: boolean; matches: AllowlistEntry[] } {
  const matches: AllowlistEntry[] = [];

  const satisfied = segments.every((segment) => {
    const candidatePath = resolveAllowlistCandidatePath(
      segment.resolution,
      params.cwd,
    );
    const candidateResolution =
      candidatePath && segment.resolution
        ? { ...segment.resolution, resolvedPath: candidatePath }
        : segment.resolution;

    const match = matchAllowlist(params.allowlist, candidateResolution);
    if (match) matches.push(match);

    const safe = isSafeBinUsage({
      argv: segment.argv,
      resolution: segment.resolution,
      safeBins: params.safeBins,
      cwd: params.cwd,
    });

    return Boolean(match || safe);
  });

  return { satisfied, matches };
}

/**
 * Evaluate a full command analysis against the allowlist and safe bins.
 */
export function evaluateExecAllowlist(params: {
  analysis: CommandAnalysis;
  allowlist: AllowlistEntry[];
  safeBins: Set<string>;
  cwd?: string;
}): { allowlistSatisfied: boolean; allowlistMatches: AllowlistEntry[] } {
  const allowlistMatches: AllowlistEntry[] = [];

  if (!params.analysis.ok || params.analysis.segments.length === 0) {
    return { allowlistSatisfied: false, allowlistMatches };
  }

  // If the analysis contains chains, evaluate each chain part separately
  if (params.analysis.chains) {
    for (const chainSegments of params.analysis.chains) {
      const result = evaluateSegments(chainSegments, {
        allowlist: params.allowlist,
        safeBins: params.safeBins,
        cwd: params.cwd,
      });
      if (!result.satisfied) {
        return { allowlistSatisfied: false, allowlistMatches: [] };
      }
      allowlistMatches.push(...result.matches);
    }
    return { allowlistSatisfied: true, allowlistMatches };
  }

  // No chains -- evaluate all segments together
  const result = evaluateSegments(params.analysis.segments, {
    allowlist: params.allowlist,
    safeBins: params.safeBins,
    cwd: params.cwd,
  });

  return {
    allowlistSatisfied: result.satisfied,
    allowlistMatches: result.matches,
  };
}

/**
 * Combined shell command analysis + allowlist evaluation.
 */
export function evaluateShellAllowlist(params: {
  command: string;
  allowlist: AllowlistEntry[];
  safeBins: Set<string>;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): AllowlistEvaluation {
  const chainParts = splitCommandChain(params.command);

  if (!chainParts) {
    const analysis = analyzeShellCommand({
      command: params.command,
      cwd: params.cwd,
      env: params.env,
    });

    if (!analysis.ok) {
      return {
        analysisOk: false,
        allowlistSatisfied: false,
        allowlistMatches: [],
        segments: [],
      };
    }

    const evaluation = evaluateExecAllowlist({
      analysis,
      allowlist: params.allowlist,
      safeBins: params.safeBins,
      cwd: params.cwd,
    });

    return {
      analysisOk: true,
      allowlistSatisfied: evaluation.allowlistSatisfied,
      allowlistMatches: evaluation.allowlistMatches,
      segments: analysis.segments,
    };
  }

  const allowlistMatches: AllowlistEntry[] = [];
  const segments: CommandSegment[] = [];

  for (const part of chainParts) {
    const analysis = analyzeShellCommand({
      command: part,
      cwd: params.cwd,
      env: params.env,
    });

    if (!analysis.ok) {
      return {
        analysisOk: false,
        allowlistSatisfied: false,
        allowlistMatches: [],
        segments: [],
      };
    }

    segments.push(...analysis.segments);

    const evaluation = evaluateExecAllowlist({
      analysis,
      allowlist: params.allowlist,
      safeBins: params.safeBins,
      cwd: params.cwd,
    });

    allowlistMatches.push(...evaluation.allowlistMatches);

    if (!evaluation.allowlistSatisfied) {
      return {
        analysisOk: true,
        allowlistSatisfied: false,
        allowlistMatches,
        segments,
      };
    }
  }

  return {
    analysisOk: true,
    allowlistSatisfied: true,
    allowlistMatches,
    segments,
  };
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

/**
 * Determine whether a command requires interactive approval based on
 * the current policy and allowlist evaluation.
 */
export function requiresExecApproval(params: {
  ask: ExecAsk;
  security: ExecSecurity;
  analysisOk: boolean;
  allowlistSatisfied: boolean;
}): boolean {
  return (
    params.ask === 'always' ||
    (params.ask === 'on-miss' &&
      params.security === 'allowlist' &&
      (!params.analysisOk || !params.allowlistSatisfied))
  );
}

export function minSecurity(a: ExecSecurity, b: ExecSecurity): ExecSecurity {
  const order: Record<ExecSecurity, number> = {
    deny: 0,
    allowlist: 1,
    full: 2,
  };
  return order[a] <= order[b] ? a : b;
}

export function maxAsk(a: ExecAsk, b: ExecAsk): ExecAsk {
  const order: Record<ExecAsk, number> = {
    off: 0,
    'on-miss': 1,
    always: 2,
  };
  return order[a] >= order[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Allowlist management
// ---------------------------------------------------------------------------

/**
 * Record that an allowlist entry was used for a specific command.
 */
export function recordAllowlistUse(
  state: ExecApprovalState,
  entry: AllowlistEntry,
  command: string,
  resolvedPath?: string,
): void {
  const idx = state.allowlist.findIndex((e) => e.id === entry.id);
  if (idx === -1) return;

  state.allowlist[idx] = {
    ...state.allowlist[idx],
    lastUsedAt: Date.now(),
    lastUsedCommand: command,
    lastResolvedPath: resolvedPath,
  };
}

/**
 * Add a new entry to the session's allowlist.
 */
export function addAllowlistEntry(
  state: ExecApprovalState,
  pattern: string,
): AllowlistEntry | null {
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  if (state.allowlist.some((entry) => entry.pattern === trimmed)) {
    return null;
  }

  const entry: AllowlistEntry = {
    id: crypto.randomUUID(),
    pattern: trimmed,
    lastUsedAt: Date.now(),
  };

  state.allowlist.push(entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Denylist (hardcoded dangerous patterns)
// ---------------------------------------------------------------------------

/** Patterns that are always denied regardless of allowlist or policy */
const HARDCODED_DENY_PATTERNS: readonly string[] = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf ~/',
  'mkfs',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  ':(){:|:&};:',
  '> /dev/sda',
  '> /dev/nvme',
  'chmod -R 777 /',
  'chown -R',
  'shutdown',
  'reboot',
  'halt',
  'init 0',
  'init 6',
];

/**
 * Check whether a command matches any hardcoded deny pattern.
 */
export function matchesDenylist(command: string): string | null {
  const normalized = command.trim().toLowerCase();

  for (const pattern of HARDCODED_DENY_PATTERNS) {
    if (normalized.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tool policy engine
// ---------------------------------------------------------------------------

/**
 * Build the initial set of tool policies, merging defaults with
 * charter safety heuristics.
 */
export function buildToolPolicies(
  charterHeuristics?: CharterSafetyHeuristics,
): Map<string, ToolPolicy> {
  const policies = new Map<string, ToolPolicy>();

  // Start with defaults
  for (const policy of DEFAULT_TOOL_POLICIES) {
    policies.set(policy.toolName, { ...policy });
  }

  if (!charterHeuristics) return policies;

  // Apply charter overrides
  for (const pattern of charterHeuristics.autoApprove) {
    const existing = policies.get(pattern);
    if (existing) {
      existing.security = 'full';
      existing.ask = 'off';
    }
  }

  for (const pattern of charterHeuristics.alwaysReject) {
    const existing = policies.get(pattern);
    if (existing) {
      existing.security = 'deny';
    } else {
      policies.set(pattern, {
        toolName: pattern,
        security: 'deny',
        ask: 'off',
      });
    }
  }

  for (const pattern of charterHeuristics.requireConfirmation) {
    const existing = policies.get(pattern);
    if (existing) {
      existing.ask = 'always';
    }
  }

  return policies;
}

/**
 * Get the effective tool policy, falling back to a restrictive default
 * for unknown tools.
 */
export function getToolPolicy(
  policies: Map<string, ToolPolicy>,
  toolName: string,
): ToolPolicy {
  const existing = policies.get(toolName);
  if (existing) return existing;

  // Unknown tools default to deny + always-ask
  return {
    toolName,
    security: 'deny',
    ask: 'always',
  };
}

// ---------------------------------------------------------------------------
// ExecApprovalState factory
// ---------------------------------------------------------------------------

export interface CreateApprovalStateOptions {
  security?: ExecSecurity;
  ask?: ExecAsk;
  askFallback?: ExecSecurity;
  safeBins?: readonly string[] | null;
  charterHeuristics?: CharterSafetyHeuristics;
  initialAllowlist?: AllowlistEntry[];
}

/**
 * Create a fresh session-scoped approval state.
 */
export function createApprovalState(
  options?: CreateApprovalStateOptions,
): ExecApprovalState {
  return {
    policy: {
      security: options?.security ?? DEFAULT_SECURITY,
      ask: options?.ask ?? DEFAULT_ASK,
      askFallback: options?.askFallback ?? DEFAULT_ASK_FALLBACK,
    },
    allowlist: options?.initialAllowlist ?? [],
    toolPolicies: buildToolPolicies(options?.charterHeuristics),
    safeBins: resolveSafeBins(options?.safeBins),
    decisions: new Map(),
  };
}

// ---------------------------------------------------------------------------
// ExecApprovalGate: the top-level evaluation entry point
// ---------------------------------------------------------------------------

/**
 * ExecApprovalGate orchestrates the full evaluation of a tool call
 * against the session's approval state. It is the single integration
 * point between the ToolExecutor and the security system.
 */
export class ExecApprovalGate {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ExecApprovalGate');
  }

  /**
   * Evaluate whether a tool invocation should be allowed, prompted,
   * or denied.
   */
  evaluate(params: {
    state: ExecApprovalState;
    toolName: string;
    toolParams: Record<string, unknown>;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }): GateEvaluation {
    const { state, toolName, toolParams, cwd, env } = params;

    // 1. Get the tool policy
    const toolPolicy = getToolPolicy(state.toolPolicies, toolName);

    // 2. If the tool is unconditionally denied, reject immediately
    if (toolPolicy.security === 'deny') {
      this.logger.info(`Tool denied by policy: ${toolName}`);
      return {
        verdict: 'deny',
        reason: `Tool "${toolName}" is denied by security policy`,
        toolName,
      };
    }

    // 3. If the tool is unconditionally allowed, permit
    if (toolPolicy.security === 'full' && toolPolicy.ask === 'off') {
      return {
        verdict: 'allow',
        reason: `Tool "${toolName}" is auto-approved by policy`,
        toolName,
      };
    }

    // 4. Special handling for bash_execute: full shell command analysis
    if (toolName === 'bash_execute') {
      return this.evaluateBashCommand(state, toolParams, cwd, env);
    }

    // 5. Special handling for file tools: path-based checks
    if (
      toolName === 'file_read' ||
      toolName === 'file_write' ||
      toolName === 'file_delete'
    ) {
      return this.evaluateFileAccess(
        state,
        toolName,
        toolPolicy,
        toolParams,
      );
    }

    // 6. For all other tools: apply the general tool policy
    return this.evaluateGenericTool(state, toolName, toolPolicy);
  }

  /**
   * Evaluate a bash_execute tool call with full shell command analysis.
   */
  private evaluateBashCommand(
    state: ExecApprovalState,
    toolParams: Record<string, unknown>,
    cwd?: string,
    env?: NodeJS.ProcessEnv,
  ): GateEvaluation {
    const command = String(toolParams.command ?? '').trim();

    if (!command) {
      return {
        verdict: 'deny',
        reason: 'Empty command',
        toolName: 'bash_execute',
        command,
      };
    }

    // Check hardcoded denylist first
    const denyMatch = matchesDenylist(command);
    if (denyMatch) {
      this.logger.warn(`Command matches denylist: "${denyMatch}"`);
      return {
        verdict: 'deny',
        reason: `Command matches deny pattern: "${denyMatch}"`,
        toolName: 'bash_execute',
        command,
      };
    }

    // Check cached decisions
    const commandHash = hashCommand(command);
    const cached = state.decisions.get(commandHash);
    if (cached === 'allow-always' || cached === 'allow-once') {
      return {
        verdict: 'allow',
        reason: 'Previously approved',
        toolName: 'bash_execute',
        command,
      };
    }
    if (cached === 'deny') {
      return {
        verdict: 'deny',
        reason: 'Previously denied',
        toolName: 'bash_execute',
        command,
      };
    }

    // If session policy is "full", allow everything (except denylist)
    if (state.policy.security === 'full') {
      return {
        verdict: 'allow',
        reason: 'Full security mode: all commands allowed',
        toolName: 'bash_execute',
        command,
      };
    }

    // Perform shell command analysis + allowlist evaluation
    const evaluation = evaluateShellAllowlist({
      command,
      allowlist: state.allowlist,
      safeBins: state.safeBins,
      cwd: cwd ?? (toolParams.cwd as string | undefined),
      env,
    });

    // Determine whether approval is required
    const needsApproval = requiresExecApproval({
      ask: state.policy.ask,
      security: state.policy.security,
      analysisOk: evaluation.analysisOk,
      allowlistSatisfied: evaluation.allowlistSatisfied,
    });

    if (!evaluation.analysisOk) {
      // Command could not be parsed -- deny or prompt
      if (state.policy.askFallback === 'deny') {
        return {
          verdict: 'deny',
          reason:
            'Shell command analysis failed: unparseable or invalid syntax',
          toolName: 'bash_execute',
          command,
        };
      }
      return {
        verdict: 'prompt',
        reason:
          'Shell command could not be analyzed; requires manual approval',
        toolName: 'bash_execute',
        command,
      };
    }

    if (evaluation.allowlistSatisfied && !needsApproval) {
      // Record usage for audit trail
      for (const match of evaluation.allowlistMatches) {
        recordAllowlistUse(state, match, command);
      }

      return {
        verdict: 'allow',
        reason: 'Command satisfies allowlist/safe-bins',
        toolName: 'bash_execute',
        command,
        matchedEntries: evaluation.allowlistMatches,
      };
    }

    if (needsApproval) {
      return {
        verdict: 'prompt',
        reason: evaluation.allowlistSatisfied
          ? 'Policy requires approval for all commands'
          : 'Command not in allowlist; requires approval',
        toolName: 'bash_execute',
        command,
        analysis: analyzeShellCommand({ command, cwd, env }),
      };
    }

    // Not satisfied, not prompting => deny
    return {
      verdict: 'deny',
      reason: 'Command not in allowlist and prompting is disabled',
      toolName: 'bash_execute',
      command,
    };
  }

  /**
   * Evaluate file access tool calls (read, write, delete).
   */
  private evaluateFileAccess(
    state: ExecApprovalState,
    toolName: string,
    toolPolicy: ToolPolicy,
    toolParams: Record<string, unknown>,
  ): GateEvaluation {
    const filePath = String(toolParams.path ?? '').trim();

    if (!filePath) {
      return {
        verdict: 'deny',
        reason: 'Empty file path',
        toolName,
      };
    }

    const resolvedPath = path.resolve(filePath);

    // Check path restrictions if defined on the policy
    if (
      toolPolicy.pathRestrictions &&
      toolPolicy.pathRestrictions.length > 0
    ) {
      const allowed = toolPolicy.pathRestrictions.some((pattern) =>
        matchesPattern(pattern, resolvedPath),
      );
      if (!allowed) {
        return {
          verdict: 'deny',
          reason: `Path "${resolvedPath}" is not in the allowed path set`,
          toolName,
        };
      }
    }

    // Check critical system paths
    const criticalPaths = ['/etc/', '/sys/', '/proc/', '/dev/', '/boot/'];
    for (const critical of criticalPaths) {
      if (
        resolvedPath === critical.slice(0, -1) ||
        resolvedPath.startsWith(critical)
      ) {
        // Allow reads of non-secret /etc files
        if (toolName === 'file_read' && resolvedPath.startsWith('/etc/')) {
          const secretPaths = [
            '/etc/shadow',
            '/etc/passwd',
            '/etc/sudoers',
            '/etc/ssh/',
          ];
          const isSecret = secretPaths.some(
            (s) =>
              resolvedPath === s || resolvedPath.startsWith(s),
          );
          if (isSecret) {
            return {
              verdict: 'deny',
              reason: `Access to sensitive system file denied: ${resolvedPath}`,
              toolName,
            };
          }
          continue;
        }

        return {
          verdict: 'deny',
          reason: `Access to critical system path denied: ${resolvedPath}`,
          toolName,
        };
      }
    }

    // Apply ask policy
    if (toolPolicy.ask === 'always') {
      return {
        verdict: 'prompt',
        reason: `File operation requires confirmation: ${toolName} -> ${resolvedPath}`,
        toolName,
      };
    }

    if (
      toolPolicy.ask === 'on-miss' &&
      toolPolicy.security === 'allowlist'
    ) {
      // For write/delete, prompt unless the path is in a safe location
      if (toolName === 'file_write' || toolName === 'file_delete') {
        const cwd = process.cwd();
        const homeDir = os.homedir();
        const tmpDir = os.tmpdir();

        const isInSafePath =
          resolvedPath.startsWith(cwd) ||
          resolvedPath.startsWith(tmpDir) ||
          resolvedPath.startsWith(path.join(homeDir, '.wundr'));

        if (!isInSafePath) {
          return {
            verdict: 'prompt',
            reason: `File ${toolName === 'file_write' ? 'write' : 'delete'} outside working directory requires approval`,
            toolName,
          };
        }
      }
    }

    return {
      verdict: 'allow',
      reason: `File access permitted: ${toolName} -> ${resolvedPath}`,
      toolName,
    };
  }

  /**
   * Evaluate generic (non-bash, non-file) tool calls.
   */
  private evaluateGenericTool(
    _state: ExecApprovalState,
    toolName: string,
    toolPolicy: ToolPolicy,
  ): GateEvaluation {
    if (toolPolicy.security === 'full') {
      return {
        verdict: 'allow',
        reason: `Tool "${toolName}" is permitted by policy`,
        toolName,
      };
    }

    if (toolPolicy.ask === 'always') {
      return {
        verdict: 'prompt',
        reason: `Tool "${toolName}" requires explicit approval`,
        toolName,
      };
    }

    if (toolPolicy.security === 'allowlist') {
      return {
        verdict: 'prompt',
        reason: `Tool "${toolName}" is in allowlist mode; requires approval`,
        toolName,
      };
    }

    return {
      verdict: 'deny',
      reason: `Tool "${toolName}" is not permitted`,
      toolName,
    };
  }

  /**
   * Record a user's approval decision in the session state.
   */
  recordDecision(
    state: ExecApprovalState,
    command: string,
    decision: ExecApprovalDecision,
    addToAllowlistOnAlways?: boolean,
  ): void {
    const commandHash = hashCommand(command);
    state.decisions.set(commandHash, decision);

    if (decision === 'allow-always' && addToAllowlistOnAlways) {
      // Extract the binary path and add to allowlist
      const resolution = resolveCommandResolution(command);
      if (resolution?.resolvedPath) {
        addAllowlistEntry(state, resolution.resolvedPath);
        this.logger.info(
          `Added to allowlist: ${resolution.resolvedPath} (from: ${command})`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashCommand(command: string): string {
  return crypto.createHash('sha256').update(command).digest('hex');
}

// ---------------------------------------------------------------------------
// Re-exports for testing and advanced usage
// ---------------------------------------------------------------------------

export {
  expandHome as _expandHome,
  DEFAULT_SECURITY,
  DEFAULT_ASK,
  DEFAULT_ASK_FALLBACK,
};
