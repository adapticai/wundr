/**
 * Skills System Type Definitions
 *
 * Defines the complete type system for the SKILL.md-based skills framework.
 * Compatible with OpenClaw's skill format while extending it for Wundr's
 * orchestrator daemon architecture.
 *
 * Covers: frontmatter parsing, dependency resolution, versioning, caching,
 * install preferences, analytics, hot-reload, and metadata indexing.
 *
 * @module skills/types
 */

// ---------------------------------------------------------------------------
// Installation
// ---------------------------------------------------------------------------

/**
 * Specification for how to install a skill's dependencies.
 * Supports multiple package managers and installation methods.
 */
export interface SkillInstallSpec {
  /** Unique identifier for this install option */
  id?: string;
  /** Installation method */
  kind: 'brew' | 'apt' | 'node' | 'go' | 'uv' | 'download';
  /** Human-readable label for display */
  label?: string;
  /** Binary names this install provides */
  bins?: string[];
  /** OS restrictions for this install method */
  os?: string[];
  /** Homebrew formula name */
  formula?: string;
  /** Package name (apt, node, go, uv) */
  package?: string;
  /** Node module name */
  module?: string;
  /** Download URL */
  url?: string;
  /** Archive format */
  archive?: string;
  /** Whether to extract the download */
  extract?: boolean;
  /** Number of directory levels to strip from archive */
  stripComponents?: number;
  /** Target directory for installation */
  targetDir?: string;
}

/**
 * Install preference for the skills system (OpenClaw-compatible).
 * Controls whether skill installs proceed automatically.
 */
export type SkillInstallPreference = 'accept' | 'reject' | 'ask';

/**
 * Resolved install preferences for the skills system.
 */
export interface SkillsInstallPreferences {
  /** Whether to prefer Homebrew for installations (default: true) */
  preferBrew: boolean;
  /** Preferred Node.js package manager */
  nodeManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  /** Install action preference for new skills (default: 'ask') */
  preference: SkillInstallPreference;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Wundr-specific skill metadata, stored under `metadata.wundr` in frontmatter.
 * Controls eligibility, categorization, and installation behavior.
 */
export interface WundrSkillMetadata {
  /** If true, skill is always included regardless of requirements */
  always?: boolean;
  /** Override skill key for config lookups */
  skillKey?: string;
  /** Primary environment variable for API key injection */
  primaryEnv?: string;
  /** Display emoji */
  emoji?: string;
  /** Skill homepage URL */
  homepage?: string;
  /** Skill category for organization */
  category?: string;
  /** OS restrictions (e.g., ['darwin', 'linux']) */
  os?: string[];
  /** Requirements that must be satisfied for eligibility */
  requires?: {
    /** All listed binaries must be in PATH */
    bins?: string[];
    /** At least one listed binary must be in PATH */
    anyBins?: string[];
    /** All listed environment variables must be set */
    env?: string[];
    /** All listed config paths must be truthy */
    config?: string[];
  };
  /** Installation options for missing dependencies */
  install?: SkillInstallSpec[];
}

/**
 * Controls how a skill can be invoked.
 */
export interface SkillInvocationPolicy {
  /** Whether users can invoke via /skill-name command (default: true) */
  userInvocable: boolean;
  /** If true, the model cannot auto-trigger this skill (default: false) */
  disableModelInvocation: boolean;
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Raw parsed frontmatter as string key-value pairs.
 * Values are the raw YAML strings before type coercion.
 */
export type ParsedSkillFrontmatter = Record<string, string>;

/**
 * Strongly-typed frontmatter after parsing and validation.
 */
export interface SkillFrontmatter {
  /** Unique skill name (required, lowercase with hyphens) */
  name: string;
  /** Description used for triggering and display (required) */
  description: string;
  /** Execution context: 'inline' runs in current session, 'fork' spawns subagent */
  context?: 'inline' | 'fork';
  /** Override the model used for this skill */
  model?: string;
  /** Required tools for this skill */
  tools?: string[];
  /** Restrict available tools when skill runs */
  allowedTools?: string[];
  /** Whether users can invoke via /skill-name (default: true) */
  userInvocable?: boolean;
  /** Prevent model from auto-triggering (default: false) */
  disableModelInvocation?: boolean;
  /** Tags for categorization and search */
  tags?: string[];
  /** Raw metadata object (may contain wundr-specific config) */
  metadata?: Record<string, unknown>;
  /** Lifecycle hooks to run before/after execution */
  hooks?: SkillHooks;
  /** Named skills this skill depends on (resolved before execution) */
  dependencies?: string[];
  /** Semantic version string (e.g., '1.2.3') */
  version?: string;
}

/**
 * Lifecycle hooks for skill execution.
 */
export interface SkillHooks {
  /** Shell command to run before the skill prompt is rendered */
  before?: string;
  /** Shell command to run after execution completes */
  after?: string;
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

/**
 * Source origin for a loaded skill, used for precedence resolution.
 */
export type SkillSource =
  | 'bundled'     // Ships with Wundr
  | 'managed'     // User's global ~/.wundr/skills/
  | 'workspace'   // Project-local ./skills/
  | 'extra';      // Configured via extraDirs

/**
 * A fully parsed and validated skill definition.
 */
export interface Skill {
  /** Unique skill name from frontmatter */
  name: string;
  /** Skill description from frontmatter */
  description: string;
  /** Absolute path to the SKILL.md file */
  filePath: string;
  /** Absolute path to the skill's base directory */
  baseDir: string;
  /** The source from which this skill was loaded */
  source: SkillSource;
  /** Raw Markdown body (instructions), without frontmatter */
  body: string;
  /** Parsed and validated frontmatter */
  frontmatter: SkillFrontmatter;
  /** Tags for categorization and search */
  tags: string[];
}

/**
 * A loaded skill entry with resolved metadata and invocation policy.
 * This is the primary unit stored in the SkillRegistry.
 */
export interface SkillEntry {
  /** The parsed skill definition */
  skill: Skill;
  /** Raw frontmatter key-value pairs */
  rawFrontmatter: ParsedSkillFrontmatter;
  /** Resolved Wundr metadata (if present) */
  metadata?: WundrSkillMetadata;
  /** Resolved invocation policy */
  invocation: SkillInvocationPolicy;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Context used to evaluate whether a skill should be included.
 * Supports both local and remote evaluation.
 */
export interface SkillEligibilityContext {
  /** Remote execution environment capabilities */
  remote?: {
    platforms: string[];
    hasBin: (bin: string) => boolean;
    hasAnyBin: (bins: string[]) => boolean;
    note?: string;
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Snapshot of the current skill state, used for prompt building
 * and caching across session boundaries.
 */
export interface SkillSnapshot {
  /** Formatted skills prompt for injection into system context */
  prompt: string;
  /** Summary of included skills */
  skills: Array<{ name: string; primaryEnv?: string; category?: string }>;
  /** Full resolved skill objects (for advanced use) */
  resolvedSkills?: Skill[];
  /** Monotonic version number for cache invalidation */
  version?: number;
}

/**
 * Command specification derived from a skill, used for registering
 * slash commands (e.g., /review-pr, /coding-agent).
 */
export interface SkillCommandSpec {
  /** Sanitized command name (e.g., 'review_pr') */
  name: string;
  /** Original skill name */
  skillName: string;
  /** Command description (max 100 chars) */
  description: string;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Options for executing a skill.
 */
export interface SkillExecutionOptions {
  /** User-provided arguments string */
  arguments?: string;
  /** Working directory for !command execution */
  workingDirectory?: string;
  /** Session ID for context */
  sessionId?: string;
  /** Override model for this execution */
  model?: string;
  /** Timeout for the entire execution in milliseconds */
  timeoutMs?: number;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Whether to execute !command lines for dynamic context injection */
  enableDynamicContext?: boolean;
}

/**
 * Result of a skill execution.
 */
export interface SkillExecutionResult {
  /** Whether the execution succeeded */
  success: boolean;
  /** The rendered prompt with substitutions and dynamic context */
  renderedPrompt?: string;
  /** Execution context: inline or fork */
  executionContext: 'inline' | 'fork';
  /** The skill that was executed */
  skillName: string;
  /** Error message if execution failed */
  error?: string;
  /** Duration of execution in milliseconds */
  durationMs?: number;
  /** Dynamic command outputs (from !command lines) */
  commandOutputs?: Array<{
    command: string;
    output: string;
    exitCode: number;
  }>;
  /** Resolved dependency prompts prepended to the rendered prompt */
  resolvedDependencies?: string[];
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/**
 * Severity levels for security scan findings.
 */
export type SkillScanSeverity = 'info' | 'warn' | 'critical';

/**
 * A single finding from the security scanner.
 */
export interface SkillScanFinding {
  /** Rule identifier that triggered this finding */
  ruleId: string;
  /** Severity level */
  severity: SkillScanSeverity;
  /** Absolute path to the file containing the finding */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Human-readable description of the finding */
  message: string;
  /** Truncated source evidence */
  evidence: string;
}

/**
 * Summary of a security scan across a skill directory.
 */
export interface SkillScanSummary {
  /** Number of files that were scanned */
  scannedFiles: number;
  /** Count of critical findings */
  critical: number;
  /** Count of warning findings */
  warn: number;
  /** Count of informational findings */
  info: number;
  /** All findings */
  findings: SkillScanFinding[];
}

/**
 * Options for controlling the security scanner.
 */
export interface SkillScanOptions {
  /** Force-include these files (relative to skill dir) */
  includeFiles?: string[];
  /** Maximum number of files to scan */
  maxFiles?: number;
  /** Maximum file size in bytes */
  maxFileBytes?: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Per-skill configuration entry.
 */
export interface SkillConfigEntry {
  /** Whether this skill is enabled */
  enabled?: boolean;
  /** Environment variable overrides for this skill */
  env?: Record<string, string>;
  /** Primary API key for the skill's primaryEnv variable */
  apiKey?: string;
}

/**
 * Skills system configuration, added to the daemon config.
 */
export interface SkillsConfig {
  /** Master switch for the skills system (default: true) */
  enabled?: boolean;
  /** Skill loading configuration */
  load?: {
    /** Additional directories to search for skills */
    extraDirs?: string[];
    /** Whether to watch for file changes (default: true) */
    watch?: boolean;
    /** Debounce interval for file watcher in ms (default: 250) */
    watchDebounceMs?: number;
  };
  /** Install preferences for skill dependencies */
  install?: {
    /** Whether to prefer Homebrew (default: true) */
    preferBrew?: boolean;
    /** Preferred Node.js package manager */
    nodeManager?: string;
    /** Install action preference (default: 'ask') */
    preference?: SkillInstallPreference;
  };
  /** Per-skill configuration entries */
  entries?: Record<string, SkillConfigEntry>;
  /** Allowlist for bundled skills (empty means all allowed) */
  allowBundled?: string[];
  /** Security configuration */
  security?: {
    /** Whether to scan skills on load (default: true) */
    scanOnLoad?: boolean;
    /** Whether to block skills with critical findings (default: true) */
    blockCritical?: boolean;
    /** Allowed command prefixes for !command syntax */
    allowedCommandPrefixes?: string[];
  };
  /** Analytics configuration */
  analytics?: {
    /** Whether to track skill usage (default: true) */
    enabled?: boolean;
    /** Maximum number of analytics entries to keep in memory */
    maxEntries?: number;
  };
  /** List of available model identifiers for skill validation */
  availableModels?: string[];
  /** List of available tool names for skill validation */
  availableTools?: string[];
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Query for searching skills in the registry.
 */
export interface SkillSearchQuery {
  /** Free-text query for fuzzy matching */
  text?: string;
  /** Substring match against skill name */
  name?: string;
  /** Match skills with any of these tags */
  tags?: string[];
  /** Match skills in this category */
  category?: string;
  /** Match skills from this source */
  source?: SkillSource;
  /** Filter by execution context */
  context?: 'inline' | 'fork';
  /** Filter by model name */
  model?: string;
  /** Maximum results to return (default: 50) */
  limit?: number;
}

/**
 * Result item from a skill search.
 */
export interface SkillSearchResult {
  /** The matched skill entry */
  entry: SkillEntry;
  /** Match score (0-1) for ranking */
  score: number;
  /** Which fields matched */
  matchedFields: string[];
}

// ---------------------------------------------------------------------------
// Command Execution (for !command dynamic context)
// ---------------------------------------------------------------------------

/**
 * Result of executing a single !command line.
 */
export interface CommandExecutionResult {
  /** The original command string */
  command: string;
  /** Stdout output (truncated to maxOutputBytes) */
  output: string;
  /** Process exit code */
  exitCode: number;
  /** Whether the command timed out */
  timedOut: boolean;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Options for controlling !command execution within skills.
 */
export interface CommandExecutionOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Timeout per command in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Maximum output size in bytes (default: 65536) */
  maxOutputBytes?: number;
  /** Allowed command prefixes (if empty, all are allowed) */
  allowedPrefixes?: string[];
  /** Environment variables to pass to the command */
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Severity levels for validation issues.
 */
export type SkillValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation finding for a skill.
 */
export interface SkillValidationIssue {
  /** Validation rule that triggered the issue */
  rule: string;
  /** Severity level */
  severity: SkillValidationSeverity;
  /** Human-readable description */
  message: string;
  /** The skill field that triggered the issue */
  field?: string;
}

/**
 * Result of validating a single skill.
 */
export interface SkillValidationResult {
  /** Name of the validated skill */
  skillName: string;
  /** Whether validation passed (no errors, warnings allowed) */
  valid: boolean;
  /** All validation issues found */
  issues: SkillValidationIssue[];
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/**
 * Cached parse result for a SKILL.md file.
 * Avoids re-parsing unchanged files on subsequent loads.
 */
export interface SkillCacheEntry {
  /** Absolute path to the SKILL.md file */
  filePath: string;
  /** File modification time at parse time (ms since epoch) */
  mtimeMs: number;
  /** File size at parse time (bytes) */
  size: number;
  /** The parsed skill (undefined if parse failed) */
  skill?: Skill;
  /** Timestamp when this cache entry was created */
  cachedAt: number;
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

/**
 * Version information for a loaded skill.
 */
export interface SkillVersionInfo {
  /** Skill name */
  name: string;
  /** Current version string (from frontmatter or computed hash) */
  currentVersion: string;
  /** Previous version string (undefined on first load) */
  previousVersion?: string;
  /** Whether the skill was updated since last load */
  updated: boolean;
  /** File modification time */
  mtimeMs: number;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * A single usage analytics entry for a skill execution.
 */
export interface SkillUsageEntry {
  /** Name of the executed skill */
  skillName: string;
  /** Timestamp of execution (ms since epoch) */
  timestamp: number;
  /** Duration of execution in milliseconds */
  durationMs: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Execution context used */
  executionContext: 'inline' | 'fork';
  /** Session ID (if available) */
  sessionId?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Aggregated analytics summary for a single skill.
 */
export interface SkillAnalyticsSummary {
  /** Skill name */
  skillName: string;
  /** Total number of executions */
  totalExecutions: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Average execution duration in milliseconds */
  avgDurationMs: number;
  /** Timestamp of last execution */
  lastExecutedAt: number;
  /** Timestamp of first recorded execution */
  firstExecutedAt: number;
}

// ---------------------------------------------------------------------------
// Dependency Resolution
// ---------------------------------------------------------------------------

/**
 * Result of resolving a skill's dependency graph.
 */
export interface SkillDependencyResolution {
  /** Topologically ordered list of skill names to execute */
  order: string[];
  /** Whether the resolution succeeded (no cycles, all deps found) */
  resolved: boolean;
  /** Missing dependency names */
  missing: string[];
  /** Dependency cycle path (if a cycle was detected) */
  cyclePath?: string[];
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Event emitted when skills change (file watch, manual refresh, etc.)
 */
export interface SkillsChangeEvent {
  /** Workspace directory that changed */
  workspaceDir?: string;
  /** Reason for the change */
  reason: 'watch' | 'manual' | 'reload';
  /** Path of the changed file (if applicable) */
  changedPath?: string;
}

/**
 * Event emitted when a skill file is created, modified, or deleted.
 */
export interface SkillFileEvent {
  /** Type of file system event */
  type: 'add' | 'change' | 'unlink';
  /** Absolute path to the changed file */
  filePath: string;
  /** Skill name affected (if determinable) */
  skillName?: string;
}
