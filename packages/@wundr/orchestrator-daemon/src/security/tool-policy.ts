/**
 * Multi-Layer Tool Access Control System
 *
 * Ported from OpenClaw's tool policy system. Provides a configurable, multi-layer
 * policy engine that controls which tools are accessible to agents based on:
 *
 *   1. Global policies     - System-wide tool restrictions
 *   2. Provider policies   - Per LLM provider (e.g. "openai", "anthropic/claude-3")
 *   3. Agent policies      - Per agent type (e.g. "coder", "researcher")
 *   4. Group policies      - Per agent group/team with per-member overrides
 *   5. Subagent policies   - Inherited from parent + additional restrictions
 *
 * A tool must be permitted by ALL layers to be accessible (conjunctive evaluation).
 * Within each layer, deny patterns take precedence over allow patterns.
 *
 * Enhanced features ported from OpenClaw:
 *   - Compiled pattern caching for high-throughput evaluation
 *   - Tool categories with risk levels (read-only, write, execute, network, admin)
 *   - Approval requirements per tool/category
 *   - Tool argument validation rules
 *   - Per-tool rate limiting
 *   - Session-scoped tool permissions
 *   - Policy inheritance and override chains
 *   - Tool usage audit logging
 *
 * @module @wundr/orchestrator-daemon/security/tool-policy
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single allow/deny policy specification.
 * Patterns support exact names, wildcards (`file_*`), and the special `*` (all) token.
 * Tool group references (e.g. `group:fs`) are expanded before pattern compilation.
 */
export interface ToolPolicy {
  /** Tool name patterns that are explicitly permitted. Empty/undefined = open (all allowed). */
  allow?: string[];
  /** Tool name patterns that are explicitly blocked. Evaluated before allow. */
  deny?: string[];
}

/**
 * Extended policy configuration that supports additive allow entries and profiles.
 */
export interface ToolPolicyConfig extends ToolPolicy {
  /** Additive allow entries merged into the base allowlist. */
  alsoAllow?: string[];
  /** Named profile preset (e.g. "minimal", "coding", "full"). */
  profile?: string;
  /** Provider-specific overrides keyed by provider name or model ID. */
  byProvider?: Record<string, ToolPolicyConfig>;
}

/**
 * Resolved policy with source tracking for debugging/audit.
 */
export interface ResolvedToolPolicy extends ToolPolicy {
  /** Where this policy originated from. */
  source: ToolPolicySource;
}

/**
 * Tracks the origin of a resolved policy for debugging.
 */
export interface ToolPolicySource {
  layer: 'global' | 'provider' | 'agent' | 'group' | 'subagent' | 'profile' | 'default';
  /** Human-readable config key path hint (e.g. "tools.byProvider.openai.deny"). */
  key?: string;
}

/**
 * The complete set of resolved policies for a single evaluation context.
 */
export interface EffectiveToolPolicies {
  agentId?: string;
  globalPolicy?: ToolPolicy;
  globalProviderPolicy?: ToolPolicy;
  agentPolicy?: ToolPolicy;
  agentProviderPolicy?: ToolPolicy;
  groupPolicy?: ToolPolicy;
  subagentPolicy?: ToolPolicy;
  profile?: string;
  providerProfile?: string;
  /** Additive allow entries to merge at the profile stage. */
  profileAlsoAllow?: string[];
  providerProfileAlsoAllow?: string[];
}

/**
 * Result of a policy evaluation, including the reason for denial.
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  /** Which layer denied the tool, if blocked. */
  deniedBy?: ToolPolicySource['layer'];
  /** The specific pattern that caused denial, if available. */
  deniedByPattern?: string;
  /** The tool category, if classified. */
  category?: ToolCategory;
  /** The risk level of the tool, if classified. */
  riskLevel?: ToolRiskLevel;
  /** Whether the tool requires explicit approval before execution. */
  requiresApproval?: boolean;
}

/**
 * Configuration shape expected from the Wundr config system.
 */
export interface WundrToolPolicyConfig {
  tools?: ToolPolicyConfig & {
    subagents?: {
      tools?: ToolPolicy;
    };
    /** Tool category configuration with risk levels and approval requirements. */
    categories?: Record<string, ToolCategoryConfig>;
    /** Per-tool argument validation rules. */
    argumentRules?: Record<string, ToolArgumentRule[]>;
    /** Per-tool rate limiting configuration. */
    rateLimits?: Record<string, ToolRateLimitConfig>;
    /** Whether to enable audit logging for tool usage. */
    auditEnabled?: boolean;
  };
  agents?: Record<string, {
    tools?: ToolPolicyConfig;
  }>;
  groups?: Record<string, GroupToolPolicyConfig>;
}

/**
 * Group-level tool policy with optional per-member overrides.
 */
export interface GroupToolPolicyConfig extends ToolPolicyConfig {
  toolsByMember?: Record<string, ToolPolicyConfig>;
}

/**
 * Group evaluation context for resolving group-level policies.
 */
export interface GroupPolicyContext {
  groupId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
}

/**
 * Named profile identifier.
 */
export type ToolProfileId = 'minimal' | 'coding' | 'analysis' | 'full';

// ============================================================================
// Tool Categories & Risk Levels
// ============================================================================

/**
 * Risk levels for tool categories, ordered from least to most dangerous.
 * Used to enforce approval requirements and rate limits by default.
 */
export type ToolRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Broad functional categories for tools. Each tool belongs to exactly one category.
 * Categories determine default risk levels and approval requirements.
 */
export type ToolCategory = 'read-only' | 'write' | 'execute' | 'network' | 'admin' | 'session';

/**
 * Configuration for a tool category.
 */
export interface ToolCategoryConfig {
  /** Risk level for this category (overrides the built-in default). */
  riskLevel?: ToolRiskLevel;
  /** Whether tools in this category require explicit approval before execution. */
  requiresApproval?: boolean;
  /** Additional deny patterns applied to tools in this category. */
  deny?: string[];
}

/**
 * Built-in classification of tools into categories with default risk levels.
 */
const TOOL_CATEGORY_MAP: Record<string, { category: ToolCategory; riskLevel: ToolRiskLevel }> = {
  // Read-only tools -- safe, no side effects.
  file_read:           { category: 'read-only', riskLevel: 'none' },
  file_list:           { category: 'read-only', riskLevel: 'none' },
  memory_search:       { category: 'read-only', riskLevel: 'none' },
  memory_get:          { category: 'read-only', riskLevel: 'none' },
  codebase_analysis:   { category: 'read-only', riskLevel: 'none' },
  drift_detection:     { category: 'read-only', riskLevel: 'none' },
  dependency_analyze:  { category: 'read-only', riskLevel: 'low' },

  // Write tools -- modify state but within the workspace.
  file_write:          { category: 'write', riskLevel: 'low' },
  file_edit:           { category: 'write', riskLevel: 'low' },
  file_delete:         { category: 'write', riskLevel: 'medium' },
  pattern_standardize: { category: 'write', riskLevel: 'low' },
  governance_report:   { category: 'write', riskLevel: 'low' },
  git_helpers:         { category: 'write', riskLevel: 'low' },
  git_worktree:        { category: 'write', riskLevel: 'medium' },
  test_baseline:       { category: 'write', riskLevel: 'low' },

  // Execute tools -- run arbitrary code or commands.
  bash_execute:        { category: 'execute', riskLevel: 'high' },

  // Network tools -- make outbound requests.
  web_fetch:           { category: 'network', riskLevel: 'medium' },
  web_search:          { category: 'network', riskLevel: 'low' },

  // Session/admin tools -- orchestrate agents or access system state.
  session_spawn:       { category: 'session', riskLevel: 'medium' },
  session_list:        { category: 'session', riskLevel: 'low' },
  session_status:      { category: 'session', riskLevel: 'none' },
  session_send:        { category: 'session', riskLevel: 'medium' },
  session_history:     { category: 'session', riskLevel: 'low' },
};

/**
 * Default risk levels per category (used when a tool is not in the explicit map).
 */
const CATEGORY_DEFAULT_RISK: Record<ToolCategory, ToolRiskLevel> = {
  'read-only': 'none',
  'write':     'low',
  'execute':   'high',
  'network':   'medium',
  'admin':     'critical',
  'session':   'medium',
};

/**
 * Categories that require explicit approval by default.
 */
const APPROVAL_REQUIRED_CATEGORIES = new Set<ToolCategory>(['execute', 'admin']);

// ============================================================================
// Tool Argument Validation
// ============================================================================

/**
 * A rule that validates tool arguments before execution.
 * Rules are evaluated in order; the first failing rule causes denial.
 */
export interface ToolArgumentRule {
  /** The argument name/key to validate (supports dot-notation for nested args). */
  argument: string;
  /** The validation type. */
  check: 'required' | 'forbidden' | 'pattern' | 'max-length' | 'one-of';
  /** For 'pattern': a regex string to match against. */
  pattern?: string;
  /** For 'max-length': the maximum allowed length. */
  maxLength?: number;
  /** For 'one-of': allowed values. */
  values?: string[];
  /** Human-readable reason for the rule (included in denial messages). */
  reason?: string;
}

/**
 * Result of argument validation.
 */
export interface ArgumentValidationResult {
  valid: boolean;
  /** The rule that failed, if any. */
  failedRule?: ToolArgumentRule;
  /** Human-readable failure message. */
  message?: string;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Rate limit configuration for a tool.
 */
export interface ToolRateLimitConfig {
  /** Maximum number of invocations allowed within the window. */
  maxInvocations: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

/**
 * Tracks invocation timestamps for rate limiting. Stored per-session.
 */
interface RateLimitBucket {
  /** Timestamps of recent invocations (kept within the current window). */
  timestamps: number[];
}

// ============================================================================
// Session-Scoped Tool Permissions
// ============================================================================

/**
 * Session-scoped tool permission state. Created per-session to track
 * runtime grants, revocations, rate limit buckets, and audit entries.
 */
export interface SessionToolPermissions {
  /** Session identifier for audit correlation. */
  sessionId: string;
  /** Timestamp of creation. */
  createdAt: number;
  /** Tools explicitly granted during this session (overrides deny for this session). */
  grants: Set<string>;
  /** Tools explicitly revoked during this session (overrides allow for this session). */
  revocations: Set<string>;
  /** Per-tool rate limit buckets. */
  rateLimitBuckets: Map<string, RateLimitBucket>;
  /** Ordered list of audit entries for this session. */
  auditLog: ToolAuditEntry[];
}

/**
 * Options for creating a new session tool permission state.
 */
export interface CreateSessionPermissionsOptions {
  sessionId: string;
  /** Initial set of tool names to grant. */
  initialGrants?: string[];
  /** Initial set of tool names to revoke. */
  initialRevocations?: string[];
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * A single audit log entry recording a tool usage event.
 */
export interface ToolAuditEntry {
  /** Timestamp of the event (ms since epoch). */
  timestamp: number;
  /** The tool that was invoked or evaluated. */
  toolName: string;
  /** The normalized tool name. */
  normalizedToolName: string;
  /** The category of the tool, if classified. */
  category?: ToolCategory;
  /** The risk level of the tool, if classified. */
  riskLevel?: ToolRiskLevel;
  /** The outcome of the evaluation. */
  outcome: 'allowed' | 'denied' | 'rate-limited' | 'argument-invalid' | 'approval-required';
  /** Which policy layer denied the tool, if blocked. */
  deniedBy?: ToolPolicySource['layer'] | 'rate-limit' | 'argument-validation' | 'session-revocation';
  /** The agent that requested the tool. */
  agentId?: string;
  /** The session in which the tool was requested. */
  sessionId?: string;
  /** Duration of the policy evaluation in microseconds. */
  evaluationUs?: number;
}

/**
 * Listener callback for audit events. Register via `ToolAuditLogger.addListener`.
 */
export type ToolAuditListener = (entry: ToolAuditEntry) => void;

// ============================================================================
// Constants
// ============================================================================

/**
 * Tool name aliases for backward compatibility and convenience.
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
  bash: 'bash_execute',
  read: 'file_read',
  write: 'file_write',
  edit: 'file_edit',
  delete: 'file_delete',
  list: 'file_list',
  fetch: 'web_fetch',
  search: 'web_search',
};

/**
 * Named tool groups that can be referenced in policies using `group:<name>` syntax.
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  'group:fs': ['file_read', 'file_write', 'file_list', 'file_delete', 'file_edit'],
  'group:runtime': ['bash_execute'],
  'group:web': ['web_fetch', 'web_search'],
  'group:sessions': [
    'session_spawn',
    'session_list',
    'session_status',
    'session_send',
    'session_history',
  ],
  'group:memory': ['memory_search', 'memory_get'],
  'group:analysis': [
    'dependency_analyze',
    'codebase_analysis',
    'drift_detection',
    'pattern_standardize',
    'governance_report',
  ],
  'group:git': ['git_helpers', 'git_worktree'],
  'group:testing': ['test_baseline'],
  'group:wundr': [
    'file_read',
    'file_write',
    'file_list',
    'file_delete',
    'file_edit',
    'bash_execute',
    'web_fetch',
    'web_search',
    'session_spawn',
    'session_list',
    'session_status',
    'session_send',
    'session_history',
    'memory_search',
    'memory_get',
    'dependency_analyze',
    'codebase_analysis',
    'drift_detection',
    'pattern_standardize',
    'governance_report',
    'git_helpers',
    'git_worktree',
    'test_baseline',
  ],
};

/**
 * Preset tool profiles that provide commonly used policy configurations.
 */
const TOOL_PROFILES: Record<ToolProfileId, ToolPolicy> = {
  minimal: {
    allow: ['session_status'],
  },
  coding: {
    allow: ['group:fs', 'group:runtime', 'group:sessions', 'group:memory', 'group:git'],
  },
  analysis: {
    allow: ['group:analysis', 'file_read', 'file_list', 'group:git'],
  },
  full: {
    // No restrictions -- allow everything.
  },
};

/**
 * Tools denied to subagents by default. Subagents should not perform session
 * orchestration, access dangerous runtime tools, or query memory directly
 * (the parent agent passes relevant context in the spawn prompt).
 */
const DEFAULT_SUBAGENT_TOOL_DENY: string[] = [
  // Session management -- parent agent orchestrates.
  'session_list',
  'session_history',
  'session_send',
  'session_spawn',
  'session_status',
  // Dangerous runtime tools.
  'bash_execute',
  'file_delete',
  // Memory -- parent passes relevant context in spawn prompt.
  'memory_search',
  'memory_get',
];

// ============================================================================
// Pattern Compilation (with caching)
// ============================================================================

/**
 * A compiled pattern for efficient repeated matching.
 */
type CompiledPattern =
  | { kind: 'all' }
  | { kind: 'exact'; value: string }
  | { kind: 'regex'; value: RegExp; source: string };

/**
 * LRU-bounded cache for compiled pattern lists. Prevents repeated compilation
 * of the same allow/deny lists across evaluation calls. The cache key is a
 * stable serialization of the input pattern array.
 *
 * Ported from OpenClaw's pattern compilation strategy but enhanced with
 * caching to avoid O(n) regex construction on every `isToolAllowedByPolicy` call.
 */
const PATTERN_CACHE_MAX = 256;
const patternCache = new Map<string, CompiledPattern[]>();

/**
 * Build a stable cache key for a pattern list.
 */
function patternCacheKey(patterns: string[]): string {
  return patterns.join('\x00');
}

/**
 * Evict the oldest entry when the cache exceeds its limit.
 */
function evictPatternCache(): void {
  if (patternCache.size <= PATTERN_CACHE_MAX) {
    return;
  }
  // Map iteration order is insertion order; delete the first key.
  const first = patternCache.keys().next();
  if (!first.done) {
    patternCache.delete(first.value);
  }
}

/**
 * Normalize a tool name: lowercase, trim, and resolve aliases.
 */
export function normalizeToolName(name: string): string {
  const normalized = name.trim().toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}

/**
 * Expand tool group references in a list of tool names/patterns.
 * Group references (e.g. `group:fs`) are replaced with their constituent tool names.
 * The result is deduplicated.
 */
export function expandToolGroups(list?: string[]): string[] {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }

  const normalized = list.map(normalizeToolName).filter(Boolean);
  const expanded: string[] = [];

  for (const value of normalized) {
    const group = TOOL_GROUPS[value];
    if (group) {
      expanded.push(...group);
    } else {
      expanded.push(value);
    }
  }

  return Array.from(new Set(expanded));
}

/**
 * Compile a single tool name pattern into an efficient matcher.
 *
 * Supported patterns:
 * - `*` matches all tools.
 * - `?` matches a single character.
 * - A name without wildcards is an exact match.
 * - A name with `*` or `?` wildcards is compiled to a RegExp.
 */
function compilePattern(pattern: string): CompiledPattern {
  const normalized = normalizeToolName(pattern);

  if (!normalized) {
    return { kind: 'exact', value: '' };
  }

  if (normalized === '*') {
    return { kind: 'all' };
  }

  if (!normalized.includes('*') && !normalized.includes('?')) {
    return { kind: 'exact', value: normalized };
  }

  // Escape regex special characters, then convert glob wildcards.
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`;

  return {
    kind: 'regex',
    value: new RegExp(regexSource),
    source: normalized,
  };
}

/**
 * Compile a list of tool name patterns, expanding groups first.
 * Results are cached for repeated evaluation of the same pattern lists.
 * Empty/invalid entries are filtered out.
 */
function compilePatterns(patterns?: string[]): CompiledPattern[] {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return [];
  }

  const expanded = expandToolGroups(patterns);
  if (expanded.length === 0) {
    return [];
  }

  const key = patternCacheKey(expanded);
  const cached = patternCache.get(key);
  if (cached) {
    return cached;
  }

  const compiled = expanded
    .map(compilePattern)
    .filter((p) => p.kind !== 'exact' || p.value !== '');

  patternCache.set(key, compiled);
  evictPatternCache();

  return compiled;
}

/**
 * Test whether a normalized tool name matches any of the compiled patterns.
 */
function matchesAny(name: string, patterns: CompiledPattern[]): boolean {
  for (const pattern of patterns) {
    switch (pattern.kind) {
      case 'all':
        return true;
      case 'exact':
        if (name === pattern.value) {
return true;
}
        break;
      case 'regex':
        if (pattern.value.test(name)) {
return true;
}
        break;
    }
  }
  return false;
}

/**
 * Find the specific pattern that matches a name (for audit/debugging).
 * Returns the source string of the matching pattern, or undefined.
 */
function findMatchingPattern(name: string, patterns: CompiledPattern[]): string | undefined {
  for (const pattern of patterns) {
    switch (pattern.kind) {
      case 'all':
        return '*';
      case 'exact':
        if (name === pattern.value) {
return pattern.value;
}
        break;
      case 'regex':
        if (pattern.value.test(name)) {
return pattern.source;
}
        break;
    }
  }
  return undefined;
}

// ============================================================================
// Single-Layer Policy Evaluation
// ============================================================================

/**
 * Create a reusable matcher function for a single policy layer.
 *
 * Evaluation order within a layer:
 *   1. If the name matches any `deny` pattern, return false.
 *   2. If there are no `allow` patterns, return true (open by default).
 *   3. If the name matches any `allow` pattern, return true.
 *   4. Otherwise, return false (allowlist is restrictive).
 */
function makeToolPolicyMatcher(policy: ToolPolicy): (name: string) => boolean {
  const deny = compilePatterns(policy.deny);
  const allow = compilePatterns(policy.allow);

  return (name: string): boolean => {
    const normalized = normalizeToolName(name);

    // Step 1: Deny takes precedence.
    if (matchesAny(normalized, deny)) {
      return false;
    }

    // Step 2: No allowlist = open.
    if (allow.length === 0) {
      return true;
    }

    // Step 3: Check allowlist.
    if (matchesAny(normalized, allow)) {
      return true;
    }

    // Step 4: Not in allowlist = blocked.
    return false;
  };
}

/**
 * Create a detailed matcher that returns the matching deny pattern (for audit).
 */
function makeDetailedPolicyMatcher(policy: ToolPolicy): (name: string) => { allowed: boolean; deniedByPattern?: string } {
  const deny = compilePatterns(policy.deny);
  const allow = compilePatterns(policy.allow);

  return (name: string) => {
    const normalized = normalizeToolName(name);

    const denyMatch = findMatchingPattern(normalized, deny);
    if (denyMatch !== undefined) {
      return { allowed: false, deniedByPattern: denyMatch };
    }

    if (allow.length === 0) {
      return { allowed: true };
    }

    if (matchesAny(normalized, allow)) {
      return { allowed: true };
    }

    return { allowed: false, deniedByPattern: undefined };
  };
}

/**
 * Check whether a single tool name is allowed by a single policy layer.
 * If no policy is provided, the tool is allowed (no restrictions).
 */
export function isToolAllowedByPolicy(name: string, policy?: ToolPolicy): boolean {
  if (!policy) {
    return true;
  }
  return makeToolPolicyMatcher(policy)(name);
}

// ============================================================================
// Multi-Layer Policy Evaluation
// ============================================================================

/**
 * Check whether a tool name is allowed by ALL policy layers (conjunctive evaluation).
 * Every provided policy must permit the tool for it to be accessible.
 */
export function isToolAllowedByPolicies(
  name: string,
  policies: Array<ToolPolicy | undefined>,
): boolean {
  return policies.every((policy) => isToolAllowedByPolicy(name, policy));
}

/**
 * Evaluate a tool name against all policy layers with detailed result tracking.
 * Returns which layer denied the tool (if any) for debugging and audit logging.
 * Also resolves tool category, risk level, and approval requirements.
 */
export function evaluateToolPolicy(
  name: string,
  policies: EffectiveToolPolicies,
): PolicyEvaluationResult {
  const layers: Array<{ layer: ToolPolicySource['layer']; policy?: ToolPolicy }> = [
    { layer: 'global', policy: policies.globalPolicy },
    { layer: 'provider', policy: policies.globalProviderPolicy },
    { layer: 'agent', policy: policies.agentPolicy },
    { layer: 'provider', policy: policies.agentProviderPolicy },
    { layer: 'group', policy: policies.groupPolicy },
    { layer: 'subagent', policy: policies.subagentPolicy },
  ];

  for (const { layer, policy } of layers) {
    if (!policy) {
      continue;
    }
    const matcher = makeDetailedPolicyMatcher(policy);
    const result = matcher(name);
    if (!result.allowed) {
      return {
        allowed: false,
        deniedBy: layer,
        deniedByPattern: result.deniedByPattern,
      };
    }
  }

  // Resolve category metadata for the allowed tool.
  const normalized = normalizeToolName(name);
  const classification = TOOL_CATEGORY_MAP[normalized];
  const category = classification?.category;
  const riskLevel = classification?.riskLevel ?? (category ? CATEGORY_DEFAULT_RISK[category] : undefined);
  const requiresApproval = category ? APPROVAL_REQUIRED_CATEGORIES.has(category) : undefined;

  return {
    allowed: true,
    category,
    riskLevel,
    requiresApproval,
  };
}

// ============================================================================
// Tool Category Queries
// ============================================================================

/**
 * Get the category and risk level for a tool name.
 * Returns undefined if the tool is not classified in the built-in map.
 */
export function getToolClassification(name: string): { category: ToolCategory; riskLevel: ToolRiskLevel } | undefined {
  const normalized = normalizeToolName(name);
  return TOOL_CATEGORY_MAP[normalized];
}

/**
 * Get all tool names belonging to a specific category.
 */
export function getToolsByCategory(category: ToolCategory): string[] {
  const result: string[] = [];
  for (const [tool, info] of Object.entries(TOOL_CATEGORY_MAP)) {
    if (info.category === category) {
      result.push(tool);
    }
  }
  return result;
}

/**
 * Get all tool names at or above a specific risk level.
 */
export function getToolsAtOrAboveRisk(minRisk: ToolRiskLevel): string[] {
  const levels: ToolRiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
  const minIndex = levels.indexOf(minRisk);
  if (minIndex < 0) {
    return [];
  }
  const result: string[] = [];
  for (const [tool, info] of Object.entries(TOOL_CATEGORY_MAP)) {
    if (levels.indexOf(info.riskLevel) >= minIndex) {
      result.push(tool);
    }
  }
  return result;
}

/**
 * Check whether a tool requires approval based on its category.
 * Config-level overrides (via `WundrToolPolicyConfig.tools.categories`) take precedence.
 */
export function toolRequiresApproval(
  name: string,
  config?: WundrToolPolicyConfig,
): boolean {
  const normalized = normalizeToolName(name);
  const classification = TOOL_CATEGORY_MAP[normalized];

  if (!classification) {
    return false;
  }

  // Check config-level category overrides.
  const categoryConfig = config?.tools?.categories?.[classification.category];
  if (categoryConfig?.requiresApproval !== undefined) {
    return categoryConfig.requiresApproval;
  }

  return APPROVAL_REQUIRED_CATEGORIES.has(classification.category);
}

// ============================================================================
// Tool Argument Validation
// ============================================================================

/**
 * Resolve a dot-notation path in a nested object.
 */
function resolveArgPath(args: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = args;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Validate tool arguments against a set of rules.
 *
 * Rules are evaluated in order. The first failing rule produces a denial.
 * Returns a success result if all rules pass or if no rules are configured.
 */
export function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  config?: WundrToolPolicyConfig,
): ArgumentValidationResult {
  const normalized = normalizeToolName(toolName);
  const rules = config?.tools?.argumentRules?.[normalized];

  if (!rules || rules.length === 0) {
    return { valid: true };
  }

  for (const rule of rules) {
    const value = resolveArgPath(args, rule.argument);
    const result = evaluateArgumentRule(rule, value);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Evaluate a single argument validation rule.
 */
function evaluateArgumentRule(
  rule: ToolArgumentRule,
  value: unknown,
): ArgumentValidationResult {
  switch (rule.check) {
    case 'required': {
      if (value === undefined || value === null || value === '') {
        return {
          valid: false,
          failedRule: rule,
          message: rule.reason ?? `Argument '${rule.argument}' is required`,
        };
      }
      return { valid: true };
    }

    case 'forbidden': {
      if (value !== undefined && value !== null) {
        return {
          valid: false,
          failedRule: rule,
          message: rule.reason ?? `Argument '${rule.argument}' is forbidden`,
        };
      }
      return { valid: true };
    }

    case 'pattern': {
      if (value === undefined || value === null) {
        return { valid: true };
      }
      const str = String(value);
      if (!rule.pattern) {
        return { valid: true };
      }
      const regex = new RegExp(rule.pattern);
      if (!regex.test(str)) {
        return {
          valid: false,
          failedRule: rule,
          message: rule.reason ?? `Argument '${rule.argument}' does not match pattern '${rule.pattern}'`,
        };
      }
      return { valid: true };
    }

    case 'max-length': {
      if (value === undefined || value === null) {
        return { valid: true };
      }
      const str = String(value);
      const max = rule.maxLength ?? Infinity;
      if (str.length > max) {
        return {
          valid: false,
          failedRule: rule,
          message: rule.reason ?? `Argument '${rule.argument}' exceeds max length of ${max}`,
        };
      }
      return { valid: true };
    }

    case 'one-of': {
      if (value === undefined || value === null) {
        return { valid: true };
      }
      const str = String(value);
      if (!rule.values || !rule.values.includes(str)) {
        return {
          valid: false,
          failedRule: rule,
          message: rule.reason ?? `Argument '${rule.argument}' must be one of: ${(rule.values ?? []).join(', ')}`,
        };
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check whether a tool invocation is within its rate limit.
 *
 * Updates the bucket in-place if the invocation is allowed, pruning
 * expired timestamps. Returns false (rate-limited) if the bucket
 * is full for the current window.
 */
export function checkToolRateLimit(
  toolName: string,
  session: SessionToolPermissions,
  config?: WundrToolPolicyConfig,
  now?: number,
): boolean {
  const normalized = normalizeToolName(toolName);
  const limitConfig = config?.tools?.rateLimits?.[normalized];

  if (!limitConfig) {
    return true;
  }

  const currentTime = now ?? Date.now();
  const windowStart = currentTime - limitConfig.windowMs;

  let bucket = session.rateLimitBuckets.get(normalized);
  if (!bucket) {
    bucket = { timestamps: [] };
    session.rateLimitBuckets.set(normalized, bucket);
  }

  // Prune expired timestamps.
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limitConfig.maxInvocations) {
    return false;
  }

  bucket.timestamps.push(currentTime);
  return true;
}

/**
 * Get the current rate limit status for a tool (remaining invocations, reset time).
 */
export function getToolRateLimitStatus(
  toolName: string,
  session: SessionToolPermissions,
  config?: WundrToolPolicyConfig,
  now?: number,
): { remaining: number; resetMs: number; limited: boolean } | undefined {
  const normalized = normalizeToolName(toolName);
  const limitConfig = config?.tools?.rateLimits?.[normalized];

  if (!limitConfig) {
    return undefined;
  }

  const currentTime = now ?? Date.now();
  const windowStart = currentTime - limitConfig.windowMs;

  const bucket = session.rateLimitBuckets.get(normalized);
  const timestamps = bucket?.timestamps.filter((t) => t > windowStart) ?? [];
  const remaining = Math.max(0, limitConfig.maxInvocations - timestamps.length);
  const oldestInWindow = timestamps.length > 0 ? timestamps[0] : currentTime;
  const resetMs = oldestInWindow + limitConfig.windowMs - currentTime;

  return {
    remaining,
    resetMs: Math.max(0, resetMs),
    limited: remaining === 0,
  };
}

// ============================================================================
// Session-Scoped Tool Permissions
// ============================================================================

/**
 * Create a new session-scoped tool permission state.
 */
export function createSessionToolPermissions(
  options: CreateSessionPermissionsOptions,
): SessionToolPermissions {
  const session: SessionToolPermissions = {
    sessionId: options.sessionId,
    createdAt: Date.now(),
    grants: new Set<string>(),
    revocations: new Set<string>(),
    rateLimitBuckets: new Map(),
    auditLog: [],
  };

  if (options.initialGrants) {
    for (const tool of options.initialGrants) {
      session.grants.add(normalizeToolName(tool));
    }
  }

  if (options.initialRevocations) {
    for (const tool of options.initialRevocations) {
      session.revocations.add(normalizeToolName(tool));
    }
  }

  return session;
}

/**
 * Grant a tool within a session scope. Removes from revocations if present.
 */
export function grantSessionTool(session: SessionToolPermissions, toolName: string): void {
  const normalized = normalizeToolName(toolName);
  session.revocations.delete(normalized);
  session.grants.add(normalized);
}

/**
 * Revoke a tool within a session scope. Removes from grants if present.
 */
export function revokeSessionTool(session: SessionToolPermissions, toolName: string): void {
  const normalized = normalizeToolName(toolName);
  session.grants.delete(normalized);
  session.revocations.add(normalized);
}

/**
 * Check whether a tool is allowed by session-scoped permissions.
 * Returns undefined if the session has no opinion (neither granted nor revoked).
 */
export function isToolAllowedBySession(
  name: string,
  session?: SessionToolPermissions,
): boolean | undefined {
  if (!session) {
    return undefined;
  }

  const normalized = normalizeToolName(name);

  if (session.revocations.has(normalized)) {
    return false;
  }

  if (session.grants.has(normalized)) {
    return true;
  }

  return undefined;
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Centralized audit logger for tool usage events.
 *
 * Maintains a bounded in-memory buffer of recent entries and dispatches
 * to registered listeners. Session-level logs are stored on the
 * `SessionToolPermissions.auditLog` array.
 */
export class ToolAuditLogger {
  private static readonly MAX_BUFFER_SIZE = 10_000;
  private static buffer: ToolAuditEntry[] = [];
  private static listeners: ToolAuditListener[] = [];

  /**
   * Record an audit entry. Appends to the global buffer, the session log
   * (if provided), and notifies all listeners.
   */
  static record(
    entry: ToolAuditEntry,
    session?: SessionToolPermissions,
  ): void {
    // Append to global buffer.
    ToolAuditLogger.buffer.push(entry);
    if (ToolAuditLogger.buffer.length > ToolAuditLogger.MAX_BUFFER_SIZE) {
      // Drop oldest 10% to avoid constant shifting.
      const drop = Math.floor(ToolAuditLogger.MAX_BUFFER_SIZE * 0.1);
      ToolAuditLogger.buffer = ToolAuditLogger.buffer.slice(drop);
    }

    // Append to session log.
    if (session) {
      session.auditLog.push(entry);
    }

    // Notify listeners.
    for (const listener of ToolAuditLogger.listeners) {
      try {
        listener(entry);
      } catch {
        // Swallow listener errors to avoid disrupting policy evaluation.
      }
    }
  }

  /**
   * Register a listener for audit events.
   */
  static addListener(listener: ToolAuditListener): void {
    ToolAuditLogger.listeners.push(listener);
  }

  /**
   * Remove a previously registered listener.
   */
  static removeListener(listener: ToolAuditListener): void {
    const idx = ToolAuditLogger.listeners.indexOf(listener);
    if (idx >= 0) {
      ToolAuditLogger.listeners.splice(idx, 1);
    }
  }

  /**
   * Get the current global audit buffer (read-only snapshot).
   */
  static getBuffer(): readonly ToolAuditEntry[] {
    return ToolAuditLogger.buffer;
  }

  /**
   * Get entries from the global buffer filtered by tool name.
   */
  static getEntriesForTool(toolName: string): ToolAuditEntry[] {
    const normalized = normalizeToolName(toolName);
    return ToolAuditLogger.buffer.filter((e) => e.normalizedToolName === normalized);
  }

  /**
   * Get entries from the global buffer filtered by session ID.
   */
  static getEntriesForSession(sessionId: string): ToolAuditEntry[] {
    return ToolAuditLogger.buffer.filter((e) => e.sessionId === sessionId);
  }

  /**
   * Get summary statistics from the global buffer.
   */
  static getSummary(): {
    total: number;
    allowed: number;
    denied: number;
    rateLimited: number;
    byCategory: Record<string, number>;
    byOutcome: Record<string, number>;
  } {
    let allowed = 0;
    let denied = 0;
    let rateLimited = 0;
    const byCategory: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};

    for (const entry of ToolAuditLogger.buffer) {
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] ?? 0) + 1;
      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
      }
      switch (entry.outcome) {
        case 'allowed': allowed++; break;
        case 'denied': denied++; break;
        case 'rate-limited': rateLimited++; break;
      }
    }

    return {
      total: ToolAuditLogger.buffer.length,
      allowed,
      denied,
      rateLimited,
      byCategory,
      byOutcome,
    };
  }

  /**
   * Clear the global audit buffer. Useful for testing.
   */
  static clear(): void {
    ToolAuditLogger.buffer = [];
  }

  /**
   * Remove all listeners. Useful for testing.
   */
  static clearListeners(): void {
    ToolAuditLogger.listeners = [];
  }
}

// ============================================================================
// Comprehensive Tool Evaluation (all features combined)
// ============================================================================

/**
 * Comprehensive tool evaluation that checks all policy layers, session
 * permissions, argument validation, rate limiting, and approval requirements.
 *
 * This is the recommended single entry point for tool invocation gating.
 * It produces a detailed `PolicyEvaluationResult` and records an audit entry.
 *
 * Evaluation order:
 *   1. Session-scoped revocations (immediate deny).
 *   2. Session-scoped grants (skip further allow/deny checks but still check rate limits).
 *   3. Multi-layer policy evaluation (global -> provider -> agent -> group -> subagent).
 *   4. Argument validation rules.
 *   5. Rate limiting.
 *   6. Approval requirement detection.
 */
export function evaluateToolAccess(params: {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  policies: EffectiveToolPolicies;
  session?: SessionToolPermissions;
  config?: WundrToolPolicyConfig;
  auditEnabled?: boolean;
}): PolicyEvaluationResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const normalized = normalizeToolName(params.toolName);
  const classification = TOOL_CATEGORY_MAP[normalized];

  const makeAuditEntry = (outcome: ToolAuditEntry['outcome'], deniedBy?: ToolAuditEntry['deniedBy']): ToolAuditEntry => {
    const elapsed = typeof performance !== 'undefined'
      ? Math.round((performance.now() - startTime) * 1000)
      : 0;
    return {
      timestamp: Date.now(),
      toolName: params.toolName,
      normalizedToolName: normalized,
      category: classification?.category,
      riskLevel: classification?.riskLevel,
      outcome,
      deniedBy,
      agentId: params.policies.agentId,
      sessionId: params.session?.sessionId,
      evaluationUs: elapsed,
    };
  };

  const shouldAudit = params.auditEnabled ?? params.config?.tools?.auditEnabled ?? false;

  // Step 1: Session-scoped revocations.
  if (params.session) {
    const sessionResult = isToolAllowedBySession(normalized, params.session);
    if (sessionResult === false) {
      const result: PolicyEvaluationResult = {
        allowed: false,
        deniedBy: 'global',
        deniedByPattern: `session-revocation:${normalized}`,
        category: classification?.category,
        riskLevel: classification?.riskLevel,
      };
      if (shouldAudit) {
        ToolAuditLogger.record(makeAuditEntry('denied', 'session-revocation'), params.session);
      }
      return result;
    }
  }

  // Step 2: Multi-layer policy evaluation (skipped if session grants the tool).
  const sessionGranted = params.session ? isToolAllowedBySession(normalized, params.session) : undefined;
  if (sessionGranted !== true) {
    const policyResult = evaluateToolPolicy(params.toolName, params.policies);
    if (!policyResult.allowed) {
      if (shouldAudit) {
        ToolAuditLogger.record(makeAuditEntry('denied', policyResult.deniedBy), params.session);
      }
      return policyResult;
    }
  }

  // Step 3: Argument validation.
  if (params.toolArgs && params.config) {
    const argResult = validateToolArguments(params.toolName, params.toolArgs, params.config);
    if (!argResult.valid) {
      const result: PolicyEvaluationResult = {
        allowed: false,
        deniedBy: 'global',
        deniedByPattern: argResult.message,
        category: classification?.category,
        riskLevel: classification?.riskLevel,
      };
      if (shouldAudit) {
        ToolAuditLogger.record(makeAuditEntry('argument-invalid', 'argument-validation'), params.session);
      }
      return result;
    }
  }

  // Step 4: Rate limiting.
  if (params.session && params.config) {
    const withinLimit = checkToolRateLimit(params.toolName, params.session, params.config);
    if (!withinLimit) {
      const result: PolicyEvaluationResult = {
        allowed: false,
        deniedBy: 'global',
        deniedByPattern: `rate-limit:${normalized}`,
        category: classification?.category,
        riskLevel: classification?.riskLevel,
      };
      if (shouldAudit) {
        ToolAuditLogger.record(makeAuditEntry('rate-limited', 'rate-limit'), params.session);
      }
      return result;
    }
  }

  // Step 5: Approval requirements.
  const category = classification?.category;
  const riskLevel = classification?.riskLevel ?? (category ? CATEGORY_DEFAULT_RISK[category] : undefined);
  const requiresApproval = toolRequiresApproval(params.toolName, params.config);

  if (shouldAudit) {
    const outcome = requiresApproval ? 'approval-required' : 'allowed';
    ToolAuditLogger.record(makeAuditEntry(outcome), params.session);
  }

  return {
    allowed: true,
    category,
    riskLevel,
    requiresApproval: requiresApproval || undefined,
  };
}

// ============================================================================
// Tool Filtering
// ============================================================================

/**
 * Filter a list of tool names by a single policy. Returns only the names
 * that are permitted by the policy.
 */
export function filterToolNamesByPolicy(
  toolNames: string[],
  policy?: ToolPolicy,
): string[] {
  if (!policy) {
    return toolNames;
  }

  const matcher = makeToolPolicyMatcher(policy);
  return toolNames.filter((name) => matcher(name));
}

/**
 * Filter a list of tool objects (anything with a `name` property) by a single policy.
 */
export function filterToolsByPolicy<T extends { name: string }>(
  tools: T[],
  policy?: ToolPolicy,
): T[] {
  if (!policy) {
    return tools;
  }

  const matcher = makeToolPolicyMatcher(policy);
  return tools.filter((tool) => matcher(tool.name));
}

/**
 * Filter a list of tool objects by ALL effective policies (conjunctive).
 */
export function filterToolsByPolicies<T extends { name: string }>(
  tools: T[],
  policies: EffectiveToolPolicies,
): T[] {
  const allPolicies: Array<ToolPolicy | undefined> = [
    policies.globalPolicy,
    policies.globalProviderPolicy,
    policies.agentPolicy,
    policies.agentProviderPolicy,
    policies.groupPolicy,
    policies.subagentPolicy,
  ];

  // Build a combined matcher that checks all layers.
  return tools.filter((tool) =>
    allPolicies.every((policy) => isToolAllowedByPolicy(tool.name, policy)),
  );
}

// ============================================================================
// Policy Construction Helpers
// ============================================================================

/**
 * Merge `alsoAllow` entries into a base allow list.
 *
 * - If `extra` is empty/undefined, returns the base unchanged.
 * - If `base` is empty/undefined, creates an implicit `["*", ...extra]` list
 *   (additive on top of allow-all).
 * - Otherwise, returns the union of both lists.
 */
function unionAllow(base?: string[], extra?: string[]): string[] | undefined {
  if (!Array.isArray(extra) || extra.length === 0) {
    return base;
  }

  if (!Array.isArray(base) || base.length === 0) {
    return Array.from(new Set(['*', ...extra]));
  }

  return Array.from(new Set([...base, ...extra]));
}

/**
 * Convert a `ToolPolicyConfig` (which may have `alsoAllow`) into a plain `ToolPolicy`.
 */
function pickToolPolicy(config?: ToolPolicyConfig): ToolPolicy | undefined {
  if (!config) {
    return undefined;
  }

  const allow = Array.isArray(config.allow)
    ? unionAllow(config.allow, config.alsoAllow)
    : Array.isArray(config.alsoAllow) && config.alsoAllow.length > 0
      ? unionAllow(undefined, config.alsoAllow)
      : undefined;

  const deny = Array.isArray(config.deny) ? config.deny : undefined;

  if (!allow && !deny) {
    return undefined;
  }

  return { allow, deny };
}

/**
 * Normalize a provider key for case-insensitive lookup.
 */
function normalizeProviderKey(value: string): string {
  return value.trim().toLowerCase();
}

// ============================================================================
// Provider Policy Resolution
// ============================================================================

/**
 * Resolve the provider-specific tool policy from a `byProvider` map.
 *
 * Lookup order:
 *   1. Full model ID (e.g. `openai/gpt-4`)
 *   2. Provider name (e.g. `openai`)
 *
 * Returns the first match.
 */
function resolveProviderToolPolicy(params: {
  byProvider?: Record<string, ToolPolicyConfig>;
  modelProvider?: string;
  modelId?: string;
}): ToolPolicyConfig | undefined {
  const provider = params.modelProvider?.trim();
  if (!provider || !params.byProvider) {
    return undefined;
  }

  const entries = Object.entries(params.byProvider);
  if (entries.length === 0) {
    return undefined;
  }

  const lookup = new Map<string, ToolPolicyConfig>();
  for (const [key, value] of entries) {
    const normalized = normalizeProviderKey(key);
    if (normalized) {
      lookup.set(normalized, value);
    }
  }

  const normalizedProvider = normalizeProviderKey(provider);
  const rawModelId = params.modelId?.trim().toLowerCase();
  const fullModelId =
    rawModelId && !rawModelId.includes('/')
      ? `${normalizedProvider}/${rawModelId}`
      : rawModelId;

  // Try full model ID first, then provider name.
  const candidates = [...(fullModelId ? [fullModelId] : []), normalizedProvider];

  for (const key of candidates) {
    const match = lookup.get(key);
    if (match) {
      return match;
    }
  }

  return undefined;
}

// ============================================================================
// Subagent Policy Resolution
// ============================================================================

/**
 * Resolve the tool policy for subagents, merging the default deny list
 * with any configured overrides.
 */
export function resolveSubagentToolPolicy(config?: WundrToolPolicyConfig): ToolPolicy {
  const configured = config?.tools?.subagents?.tools;
  const deny = [
    ...DEFAULT_SUBAGENT_TOOL_DENY,
    ...(Array.isArray(configured?.deny) ? configured.deny : []),
  ];
  const allow = Array.isArray(configured?.allow) ? configured.allow : undefined;

  return { allow, deny };
}

// ============================================================================
// Group Policy Resolution
// ============================================================================

/**
 * Normalize a group member identifier for case-insensitive lookup.
 */
function normalizeMemberKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  // Strip leading `@` for username-style identifiers.
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return withoutAt.toLowerCase();
}

/**
 * Resolve the tool policy for a specific group, optionally with per-member overrides.
 */
export function resolveGroupToolPolicy(params: {
  config?: WundrToolPolicyConfig;
  groupId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
}): ToolPolicy | undefined {
  if (!params.config?.groups || !params.groupId) {
    return undefined;
  }

  const groupConfig = params.config.groups[params.groupId.trim()];
  if (!groupConfig) {
    // Check for wildcard group.
    const wildcardConfig = params.config.groups['*'];
    if (!wildcardConfig) {
      return undefined;
    }
    return resolveGroupMemberPolicy(wildcardConfig, params);
  }

  return resolveGroupMemberPolicy(groupConfig, params);
}

/**
 * Resolve per-member overrides within a group config, falling back to the
 * group-level policy.
 */
function resolveGroupMemberPolicy(
  groupConfig: GroupToolPolicyConfig,
  params: { memberId?: string | null; memberName?: string | null },
): ToolPolicy | undefined {
  if (!groupConfig.toolsByMember) {
    return pickToolPolicy(groupConfig);
  }

  const entries = Object.entries(groupConfig.toolsByMember);
  if (entries.length === 0) {
    return pickToolPolicy(groupConfig);
  }

  const lookup = new Map<string, ToolPolicyConfig>();
  let wildcard: ToolPolicyConfig | undefined;

  for (const [rawKey, policy] of entries) {
    if (!policy) {
continue;
}
    const key = normalizeMemberKey(rawKey);
    if (!key) {
continue;
}
    if (key === '*') {
      wildcard = policy;
      continue;
    }
    if (!lookup.has(key)) {
      lookup.set(key, policy);
    }
  }

  // Try member ID, then member name.
  const candidates: string[] = [];
  if (params.memberId?.trim()) {
    candidates.push(params.memberId.trim());
  }
  if (params.memberName?.trim()) {
    candidates.push(params.memberName.trim());
  }

  for (const candidate of candidates) {
    const key = normalizeMemberKey(candidate);
    if (!key) {
continue;
}
    const match = lookup.get(key);
    if (match) {
      return pickToolPolicy(match);
    }
  }

  if (wildcard) {
    return pickToolPolicy(wildcard);
  }

  return pickToolPolicy(groupConfig);
}

// ============================================================================
// Profile Resolution
// ============================================================================

/**
 * Resolve a tool profile by name. Returns the profile's policy configuration,
 * or undefined if the profile is not recognized.
 */
export function resolveToolProfilePolicy(profile?: string): ToolPolicy | undefined {
  if (!profile) {
    return undefined;
  }

  const resolved = TOOL_PROFILES[profile as ToolProfileId];
  if (!resolved) {
    return undefined;
  }

  if (!resolved.allow && !resolved.deny) {
    return undefined;
  }

  return {
    allow: resolved.allow ? [...resolved.allow] : undefined,
    deny: resolved.deny ? [...resolved.deny] : undefined,
  };
}

// ============================================================================
// Effective Policy Resolution
// ============================================================================

/**
 * Resolve the complete set of effective tool policies for a given context.
 *
 * This is the primary entry point for policy resolution. It collects policies
 * from all layers and returns them as a structured object that can be passed
 * to `evaluateToolPolicy` or `filterToolsByPolicies`.
 */
export function resolveEffectiveToolPolicy(params: {
  config?: WundrToolPolicyConfig;
  agentId?: string;
  modelProvider?: string;
  modelId?: string;
  groupId?: string | null;
  memberId?: string | null;
  memberName?: string | null;
  isSubagent?: boolean;
}): EffectiveToolPolicies {
  const agentConfig = params.config?.agents?.[params.agentId ?? ''];
  const agentTools = agentConfig?.tools;
  const globalTools = params.config?.tools;

  const profile = agentTools?.profile ?? globalTools?.profile;

  const providerPolicy = resolveProviderToolPolicy({
    byProvider: globalTools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });

  const agentProviderPolicy = resolveProviderToolPolicy({
    byProvider: agentTools?.byProvider,
    modelProvider: params.modelProvider,
    modelId: params.modelId,
  });

  const groupPolicy = resolveGroupToolPolicy({
    config: params.config,
    groupId: params.groupId,
    memberId: params.memberId,
    memberName: params.memberName,
  });

  const subagentPolicy = params.isSubagent
    ? resolveSubagentToolPolicy(params.config)
    : undefined;

  return {
    agentId: params.agentId,
    globalPolicy: pickToolPolicy(globalTools),
    globalProviderPolicy: pickToolPolicy(providerPolicy),
    agentPolicy: pickToolPolicy(agentTools),
    agentProviderPolicy: pickToolPolicy(agentProviderPolicy),
    groupPolicy,
    subagentPolicy,
    profile,
    providerProfile: agentProviderPolicy?.profile ?? providerPolicy?.profile,
    profileAlsoAllow: Array.isArray(agentTools?.alsoAllow)
      ? agentTools?.alsoAllow
      : Array.isArray(globalTools?.alsoAllow)
        ? globalTools?.alsoAllow
        : undefined,
    providerProfileAlsoAllow: Array.isArray(agentProviderPolicy?.alsoAllow)
      ? agentProviderPolicy?.alsoAllow
      : Array.isArray(providerPolicy?.alsoAllow)
        ? providerPolicy?.alsoAllow
        : undefined,
  };
}

/**
 * Collect all non-undefined policies from an `EffectiveToolPolicies` object
 * into a flat array suitable for `isToolAllowedByPolicies`.
 */
export function collectPolicies(policies: EffectiveToolPolicies): Array<ToolPolicy | undefined> {
  return [
    policies.globalPolicy,
    policies.globalProviderPolicy,
    policies.agentPolicy,
    policies.agentProviderPolicy,
    policies.groupPolicy,
    policies.subagentPolicy,
  ];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when a tool is denied by the policy system.
 */
export class ToolPolicyDeniedError extends Error {
  public readonly toolName: string;
  public readonly deniedBy: ToolPolicySource['layer'] | undefined;

  constructor(toolName: string, deniedBy?: ToolPolicySource['layer']) {
    const layerHint = deniedBy ? ` (denied by ${deniedBy} policy)` : '';
    super(`Tool '${toolName}' is not permitted by the current policy${layerHint}`);
    this.name = 'ToolPolicyDeniedError';
    this.toolName = toolName;
    this.deniedBy = deniedBy;
  }
}

/**
 * Error thrown when tool arguments fail validation.
 */
export class ToolArgumentValidationError extends Error {
  public readonly toolName: string;
  public readonly failedRule: ToolArgumentRule | undefined;

  constructor(toolName: string, message: string, failedRule?: ToolArgumentRule) {
    super(message);
    this.name = 'ToolArgumentValidationError';
    this.toolName = toolName;
    this.failedRule = failedRule;
  }
}

/**
 * Error thrown when a tool invocation exceeds its rate limit.
 */
export class ToolRateLimitError extends Error {
  public readonly toolName: string;

  constructor(toolName: string, resetMs?: number) {
    const resetHint = resetMs !== undefined ? ` (resets in ${Math.ceil(resetMs / 1000)}s)` : '';
    super(`Tool '${toolName}' has exceeded its rate limit${resetHint}`);
    this.name = 'ToolRateLimitError';
    this.toolName = toolName;
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Normalize a list of tool names: lowercase, trim, resolve aliases, filter empties.
 */
export function normalizeToolList(list?: string[]): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeToolName).filter(Boolean);
}

/**
 * Get the list of tools denied to subagents by default.
 * Useful for documentation and debugging.
 */
export function getDefaultSubagentDenyList(): readonly string[] {
  return DEFAULT_SUBAGENT_TOOL_DENY;
}

/**
 * Check whether a tool name is in the default subagent deny list.
 */
export function isDefaultSubagentDenied(name: string): boolean {
  const normalized = normalizeToolName(name);
  return DEFAULT_SUBAGENT_TOOL_DENY.includes(normalized);
}

/**
 * Collect explicit allow entries from multiple policies into a flat array.
 * Useful for building combined allowlists for profile/plugin interactions.
 */
export function collectExplicitAllowlist(
  policies: Array<ToolPolicy | undefined>,
): string[] {
  const entries: string[] = [];
  for (const policy of policies) {
    if (!policy?.allow) {
continue;
}
    for (const value of policy.allow) {
      if (typeof value !== 'string') {
continue;
}
      const trimmed = value.trim();
      if (trimmed) {
        entries.push(trimmed);
      }
    }
  }
  return entries;
}

/**
 * Clear the compiled pattern cache. Useful for testing or when configuration changes.
 */
export function clearPatternCache(): void {
  patternCache.clear();
}

/**
 * Get the current size of the compiled pattern cache.
 */
export function getPatternCacheSize(): number {
  return patternCache.size;
}
