/**
 * Unified Security Module for Wundr Orchestrator Daemon
 *
 * This barrel module provides a single import surface for all security subsystems:
 *
 *   - **exec-approvals**: Shell command parsing, allowlist/denylist matching,
 *     safe binary detection, and session-scoped approval workflows.
 *
 *   - **redact**: Pattern-based credential detection (AWS, OpenAI, Anthropic,
 *     GitHub, JWT, database URLs), config object redaction, log integration.
 *
 *   - **tool-policy**: Multi-layer policy evaluation with compiled regex patterns,
 *     tool group expansion, provider/agent/group precedence, subagent isolation.
 *
 *   - **validation**: Zod schemas for all input types (WebSocket messages, batch
 *     jobs, plugin manifests), path traversal prevention, command injection
 *     prevention, HTML/SQL sanitization.
 *
 *   - **audit**: 60+ automated security checks, report generation with text and
 *     markdown formatters, severity levels (critical/warn/info).
 *
 *   - **env-sanitizer**: Environment variable sanitization for subprocess
 *     spawning, blocking dangerous vars (NODE_OPTIONS, DYLD_*, LD_PRELOAD),
 *     PATH sanitization, injection detection, allowlist-based filtering,
 *     and audit logging. Ported from OpenClaw's bash-tools.exec.ts and
 *     node-host/runner.ts.
 *
 *   - **skill-scanner**: Static analysis of plugin source code for malicious
 *     patterns (shell invocation, eval, crypto-mining, data exfiltration).
 *
 * @module @wundr/orchestrator-daemon/security
 */

// ============================================================================
// Execution Approvals
// ============================================================================

// ============================================================================
// Convenience: SecurityGate (combines exec-approvals + tool-policy + redaction)
// ============================================================================

import {
  sanitizeEnv as sanitizeEnvVars,
  checkEnvForApproval as checkEnvApproval,
  buildSubprocessEnv as buildSafeEnv,
  type EnvSanitizerConfig,
  type EnvSanitizeResult,
} from './env-sanitizer';
import {
  ExecApprovalGate,
  createApprovalState,
  type ExecApprovalState,
  type GateEvaluation,
  type CreateApprovalStateOptions,
} from './exec-approvals';
import { redactSensitiveText, type RedactOptions } from './redact';
import {
  resolveEffectiveToolPolicy,
  evaluateToolPolicy,
  type EffectiveToolPolicies,
  type WundrToolPolicyConfig,
} from './tool-policy';

export {
  // Types
  type ExecSecurity,
  type ExecAsk,
  type ExecApprovalDecision,
  type ExecPolicy,
  type AllowlistEntry,
  type ToolPolicy as ExecToolPolicy,
  type CommandResolution,
  type CommandSegment,
  type CommandAnalysis,
  type AllowlistEvaluation,
  type ArgumentSafetyResult,
  type EnvSafetyResult,
  type ExecApprovalState,
  type GateVerdict,
  type GateEvaluation,
  type CreateApprovalStateOptions,

  // Constants
  DEFAULT_SAFE_BINS,

  // Command analysis
  resolveCommandResolution,
  resolveCommandResolutionFromArgv,
  analyzeShellCommand,
  analyzeArgvCommand,

  // Allowlist matching
  matchAllowlist,
  evaluateExecAllowlist,
  evaluateShellAllowlist,

  // Safe binary detection
  normalizeSafeBins,
  resolveSafeBins,
  isSafeBinUsage,

  // Denylist
  matchesDenylist,
  matchesStructuralDeny,

  // Path traversal detection
  detectPathTraversal,

  // Argument injection detection
  detectArgumentInjection,

  // Environment variable safety
  checkEnvSafety,

  // Write-path protection
  detectWritePath,
  isWritePathProtected,

  // Policy
  requiresExecApproval,
  minSecurity,
  maxAsk,
  buildToolPolicies,
  getToolPolicy,

  // State management
  createApprovalState,
  addAllowlistEntry,
  recordAllowlistUse,

  // Gate (main entry point)
  ExecApprovalGate,
} from './exec-approvals';

// ============================================================================
// Credential Redaction
// ============================================================================

export {
  // Types
  type RedactSensitiveMode,
  type RedactOptions,
  type CustomRedactPattern,
  type RedactionStatsSnapshot,

  // Constants
  REDACTED_SENTINEL,

  // Text redaction
  redactSensitiveText,
  getDefaultRedactPatterns,

  // Custom pattern registration
  registerRedactPatterns,
  clearCustomRedactPatterns,
  getCustomPatternCount,

  // Redaction statistics
  getRedactionStats,
  resetRedactionStats,

  // Config redaction
  redactConfigObject,
  redactConfigSnapshot,
  restoreRedactedValues,

  // Key detection
  isSensitiveKey,
  isSensitiveEnvKey,

  // Identifier hashing
  redactIdentifier,

  // Environment variable formatting
  formatEnvValue,

  // WebSocket payload redaction
  redactWsPayload,

  // Stream-safe redaction
  RedactingStream,

  // Redacting logger
  RedactingLogger,
  createRedactingLogger,
  LogLevel as RedactLogLevel,
} from './redact';

// ============================================================================
// Tool Policy System
// ============================================================================

export {
  // Types
  type ToolPolicy,
  type ToolPolicyConfig,
  type ResolvedToolPolicy,
  type ToolPolicySource,
  type EffectiveToolPolicies,
  type PolicyEvaluationResult,
  type WundrToolPolicyConfig,
  type GroupToolPolicyConfig,
  type GroupPolicyContext,
  type ToolProfileId,

  // Tool categories & risk levels
  type ToolRiskLevel,
  type ToolCategory,
  type ToolCategoryConfig,

  // Argument validation
  type ToolArgumentRule,
  type ArgumentValidationResult,

  // Rate limiting
  type ToolRateLimitConfig,

  // Session-scoped permissions
  type SessionToolPermissions,
  type CreateSessionPermissionsOptions,

  // Audit logging
  type ToolAuditEntry,
  type ToolAuditListener,

  // Constants
  TOOL_GROUPS,

  // Pattern matching
  normalizeToolName,
  expandToolGroups,
  normalizeToolList,

  // Pattern cache management
  clearPatternCache,
  getPatternCacheSize,

  // Single-layer evaluation
  isToolAllowedByPolicy,

  // Multi-layer evaluation
  isToolAllowedByPolicies,
  evaluateToolPolicy,

  // Comprehensive evaluation (all features combined)
  evaluateToolAccess,

  // Tool category queries
  getToolClassification,
  getToolsByCategory,
  getToolsAtOrAboveRisk,
  toolRequiresApproval,

  // Argument validation
  validateToolArguments,

  // Rate limiting
  checkToolRateLimit,
  getToolRateLimitStatus,

  // Session-scoped permissions
  createSessionToolPermissions,
  grantSessionTool,
  revokeSessionTool,
  isToolAllowedBySession,

  // Tool filtering
  filterToolNamesByPolicy,
  filterToolsByPolicy,
  filterToolsByPolicies,

  // Policy resolution
  resolveEffectiveToolPolicy,
  resolveSubagentToolPolicy,
  resolveGroupToolPolicy,
  resolveToolProfilePolicy,
  collectPolicies,
  collectExplicitAllowlist,

  // Subagent utilities
  getDefaultSubagentDenyList,
  isDefaultSubagentDenied,

  // Audit logging
  ToolAuditLogger,

  // Errors
  ToolPolicyDeniedError,
  ToolArgumentValidationError,
  ToolRateLimitError,
} from './tool-policy';

// ============================================================================
// Input Validation
// ============================================================================

export {
  // Errors
  ValidationError,
  CommandInjectionError,
  PathTraversalError,

  // Constants
  DEFAULT_ALLOWED_BINARIES,

  // WebSocket message validation
  WSMessageSchema,
  SpawnSessionPayloadSchema,
  ExecuteTaskPayloadSchema,
  SessionStatusPayloadSchema,
  StopSessionPayloadSchema,
  validateWSMessage,
  type ValidatedWSMessage,

  // Batch job validation
  BatchCommandSchema,
  BatchJobSchema,
  validateBatchJob,
  type ValidatedBatchCommand,
  type ValidatedBatchJob,

  // Variable interpolation
  resolveVariables,

  // Safe command building
  SafeCommandBuilder,
  type SafeCommand,
  containsShellMetacharacters,

  // Path traversal prevention
  safePath,
  isWithinBoundary,
  safeFilename,

  // Plugin validation
  PluginManifestSchema,
  validatePluginName,
  type ValidatedPluginManifest,

  // Input sanitization
  stripControlChars,
  sanitizeForHTML,
  sanitizeForSQL,
  truncate,
  redactCredentials,
} from './validation';

// ============================================================================
// Security Audit
// ============================================================================

export {
  // Types
  type SecurityAuditSeverity,
  type SecurityAuditFinding,
  type SecurityAuditSummary,
  type SecurityAuditReport,
  type SecurityAuditOptions,
  type WebSocketProbeResult,
  type ProgressPhase,
  type ProgressCallback,

  // Individual check collectors
  collectDaemonConfigFindings,
  collectWebSocketSecurityFindings,
  collectJwtSecurityFindings,
  collectCorsFindings,
  collectRateLimitFindings,
  collectTlsFindings,
  collectEnvSecurityFindings,
  collectLoggingFindings,
  collectApiKeyFindings,
  collectRedisSecurityFindings,
  collectDatabaseSecurityFindings,
  collectMcpToolSafetyFindings,
  collectDistributedSecurityFindings,
  collectNeolithSecurityFindings,
  collectMonitoringSecurityFindings,
  collectMemorySecurityFindings,
  collectTokenBudgetFindings,
  collectFilesystemFindings,
  collectDependencyFindings,
  collectPluginCodeSafetyFindings,

  // Report generation
  formatAuditReportText,
  formatAuditReportMarkdown,
  formatAuditReportHtml,

  // Main entry point
  runSecurityAudit,
} from './audit';

// ============================================================================
// Environment Variable Sanitization
// ============================================================================

export {
  // Types
  type EnvSanitizeResult,
  type EnvBlockedEntry,
  type EnvModifiedEntry,
  type EnvBlockReason,
  type EnvAuditSeverity,
  type EnvAuditEvent,
  type EnvSanitizerConfig,

  // Core sanitization
  sanitizeEnv,
  validateEnvForExec,
  buildSubprocessEnv,

  // PATH sanitization
  sanitizePath,

  // Logging redaction
  redactEnvForLogging,
  isSensitiveEnvVar,

  // Platform-specific queries
  getDangerousVarList,
  getDangerousPrefixList,

  // Exec-approval integration
  checkEnvForApproval,

  // Errors
  EnvSecurityError,
} from './env-sanitizer';

// ============================================================================
// Skill/Plugin Scanner
// ============================================================================

export {
  type SkillScanSeverity,
  type SkillScanFinding,
  type SkillScanSummary,
} from './skill-scanner';

/**
 * SecurityGate is a high-level facade that combines execution approval gating,
 * tool policy evaluation, and output redaction into a single integration point.
 *
 * Use this class when wiring security into the ToolExecutor or SessionExecutor
 * rather than importing each subsystem separately.
 *
 * @example
 * ```ts
 * const gate = new SecurityGate({
 *   toolPolicyConfig: wundrConfig,
 *   approvalOptions: { security: 'allowlist', ask: 'on-miss' },
 * });
 *
 * // Before executing a tool call:
 * const result = gate.evaluateToolCall({
 *   toolName: 'bash_execute',
 *   toolParams: { command: 'npm test' },
 *   agentId: 'coder',
 *   sessionState: session.approvalState,
 * });
 *
 * if (result.verdict === 'deny') {
 *   throw new Error(result.reason);
 * }
 * ```
 */
export class SecurityGate {
  private execGate: ExecApprovalGate;
  private toolPolicyConfig: WundrToolPolicyConfig | undefined;
  private redactOptions: RedactOptions | undefined;
  private envSanitizerConfig: EnvSanitizerConfig | undefined;

  constructor(options?: {
    toolPolicyConfig?: WundrToolPolicyConfig;
    redactOptions?: RedactOptions;
    envSanitizerConfig?: EnvSanitizerConfig;
  }) {
    this.execGate = new ExecApprovalGate();
    this.toolPolicyConfig = options?.toolPolicyConfig;
    this.redactOptions = options?.redactOptions;
    this.envSanitizerConfig = options?.envSanitizerConfig;
  }

  /**
   * Create a fresh approval state for a new session.
   */
  createSessionState(options?: CreateApprovalStateOptions): ExecApprovalState {
    return createApprovalState(options);
  }

  /**
   * Resolve effective tool policies for a given context.
   */
  resolveToolPolicies(params: {
    agentId?: string;
    modelProvider?: string;
    modelId?: string;
    groupId?: string | null;
    memberId?: string | null;
    memberName?: string | null;
    isSubagent?: boolean;
  }): EffectiveToolPolicies {
    return resolveEffectiveToolPolicy({
      config: this.toolPolicyConfig,
      ...params,
    });
  }

  /**
   * Evaluate a tool call against both tool-level policies and exec approval gating.
   *
   * Returns a unified GateEvaluation. If the tool-level policy denies the tool,
   * the exec approval gate is not consulted (short-circuit).
   */
  evaluateToolCall(params: {
    toolName: string;
    toolParams: Record<string, unknown>;
    sessionState: ExecApprovalState;
    agentId?: string;
    modelProvider?: string;
    modelId?: string;
    groupId?: string | null;
    memberId?: string | null;
    isSubagent?: boolean;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }): GateEvaluation {
    // Step 1: Check tool-level policy
    const policies = this.resolveToolPolicies({
      agentId: params.agentId,
      modelProvider: params.modelProvider,
      modelId: params.modelId,
      groupId: params.groupId,
      memberId: params.memberId,
      isSubagent: params.isSubagent,
    });

    const policyResult = evaluateToolPolicy(params.toolName, policies);
    if (!policyResult.allowed) {
      return {
        verdict: 'deny',
        reason: `Tool "${params.toolName}" denied by ${policyResult.deniedBy ?? 'unknown'} policy`,
        toolName: params.toolName,
      };
    }

    // Step 2: Check exec approval gate (handles bash_execute, file access, generic tools)
    return this.execGate.evaluate({
      state: params.sessionState,
      toolName: params.toolName,
      toolParams: params.toolParams,
      cwd: params.cwd,
      env: params.env,
    });
  }

  /**
   * Redact sensitive content from tool output before broadcasting.
   */
  redactOutput(text: string): string {
    return redactSensitiveText(text, this.redactOptions);
  }

  /**
   * Record a user's approval decision in the session state.
   */
  recordDecision(
    state: ExecApprovalState,
    command: string,
    decision: 'allow-once' | 'allow-always' | 'deny',
    addToAllowlistOnAlways?: boolean,
  ): void {
    this.execGate.recordDecision(state, command, decision, addToAllowlistOnAlways);
  }

  /**
   * Sanitize environment variables for a subprocess.
   *
   * Combines the instance-level EnvSanitizerConfig with any per-call overrides.
   * Returns a clean env map and an audit trail of blocked/modified variables.
   */
  sanitizeEnv(
    env: Record<string, string>,
    overrides?: Partial<EnvSanitizerConfig>,
  ): EnvSanitizeResult {
    return sanitizeEnvVars(env, { ...this.envSanitizerConfig, ...overrides });
  }

  /**
   * Build a complete, sanitized environment for subprocess spawning.
   *
   * Starts from the process environment, strips dangerous variables,
   * merges overrides, and sanitizes PATH.
   */
  buildSubprocessEnv(
    overrides?: Record<string, string> | null,
    extra?: { sessionId?: string; agentId?: string; cwd?: string },
  ): EnvSanitizeResult {
    return buildSafeEnv(overrides, {
      ...this.envSanitizerConfig,
      ...extra,
    });
  }

  /**
   * Check environment variables as part of the exec-approval flow.
   * Returns a verdict indicating whether the env is safe for execution.
   */
  checkEnvForApproval(env: Record<string, string>): {
    approved: boolean;
    blockedCount: number;
    criticalCount: number;
    message: string;
  } {
    return checkEnvApproval(env, this.envSanitizerConfig);
  }
}
