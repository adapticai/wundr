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
}

/**
 * Configuration shape expected from the Wundr config system.
 */
export interface WundrToolPolicyConfig {
  tools?: ToolPolicyConfig & {
    subagents?: {
      tools?: ToolPolicy;
    };
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
// Pattern Compilation
// ============================================================================

/**
 * A compiled pattern for efficient repeated matching.
 */
type CompiledPattern =
  | { kind: 'all' }
  | { kind: 'exact'; value: string }
  | { kind: 'regex'; value: RegExp; source: string };

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
 * - `*` matches all tools.
 * - A name without wildcards is an exact match.
 * - A name with `*` wildcards is compiled to a RegExp.
 */
function compilePattern(pattern: string): CompiledPattern {
  const normalized = normalizeToolName(pattern);

  if (!normalized) {
    return { kind: 'exact', value: '' };
  }

  if (normalized === '*') {
    return { kind: 'all' };
  }

  if (!normalized.includes('*')) {
    return { kind: 'exact', value: normalized };
  }

  // Escape regex special characters, then convert `*` wildcards to `.*`.
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexSource = `^${escaped.replaceAll('\\*', '.*')}$`;

  return {
    kind: 'regex',
    value: new RegExp(regexSource),
    source: normalized,
  };
}

/**
 * Compile a list of tool name patterns, expanding groups first.
 * Empty/invalid entries are filtered out.
 */
function compilePatterns(patterns?: string[]): CompiledPattern[] {
  if (!Array.isArray(patterns)) {
    return [];
  }

  return expandToolGroups(patterns)
    .map(compilePattern)
    .filter((p) => p.kind !== 'exact' || p.value !== '');
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
        if (name === pattern.value) return true;
        break;
      case 'regex':
        if (pattern.value.test(name)) return true;
        break;
    }
  }
  return false;
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
    if (!isToolAllowedByPolicy(name, policy)) {
      return { allowed: false, deniedBy: layer };
    }
  }

  return { allowed: true };
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
    if (!policy) continue;
    const key = normalizeMemberKey(rawKey);
    if (!key) continue;
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
    if (!key) continue;
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
    if (!policy?.allow) continue;
    for (const value of policy.allow) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed) {
        entries.push(trimmed);
      }
    }
  }
  return entries;
}
