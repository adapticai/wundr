/**
 * Profile System Type Definitions
 *
 * Canonical types for the upgraded cross-platform developer profile system.
 * Profiles are composable, version-pinned, platform-aware data structures
 * that separate WHAT to install from HOW to install it.
 *
 * @module profiles/profile-types
 */

import type { SetupPlatform } from '../types';

// ---------------------------------------------------------------------------
// Profile identity
// ---------------------------------------------------------------------------

/**
 * Supported developer profile archetypes.
 */
export type ProfileType =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'devops'
  | 'data-science'
  | 'mobile';

/**
 * Tool categories used for grouping and dependency ordering.
 */
export type ToolCategory =
  | 'system'
  | 'language'
  | 'framework'
  | 'package-manager'
  | 'container'
  | 'database'
  | 'cloud'
  | 'editor'
  | 'ai'
  | 'monitoring'
  | 'ci'
  | 'mobile'
  | 'data-science'
  | 'utility';

// ---------------------------------------------------------------------------
// Tool specifications
// ---------------------------------------------------------------------------

/**
 * A semver version string or the literal "latest".
 *
 * @example "22.0.0", "3.12.2", "latest"
 */
export type ToolVersion = string;

/**
 * Platform-agnostic tool specification.
 *
 * Describes a single tool that a profile requires, including optional
 * version pinning and per-platform install overrides.
 */
export interface ToolSpec {
  /** Unique tool identifier (e.g., "node", "docker", "terraform"). */
  name: string;

  /** Human-readable display name. */
  displayName: string;

  /** Tool category for grouping and ordering. */
  category: ToolCategory;

  /** Desired version. Omit or set to "latest" for the newest stable. */
  version?: ToolVersion;

  /** Whether this tool is required (true) or optional (false). */
  required: boolean;

  /**
   * Tool IDs that must be installed before this one.
   *
   * @example ["homebrew", "git"]
   */
  dependencies?: string[];

  /**
   * Default command to validate the tool is installed.
   * The adapter may override this per-platform.
   *
   * @example "node --version"
   */
  validateCommand?: string;

  /**
   * Per-platform install command overrides.
   * Keys are SetupPlatform.os values.
   */
  platformOverrides?: Partial<Record<SetupPlatform['os'], PlatformInstallSpec>>;
}

/**
 * Platform-specific install instructions for a single tool.
 */
export interface PlatformInstallSpec {
  /** Install command (e.g., "brew install node@22"). */
  installCommand?: string;

  /** Override validate command for this platform. */
  validateCommand?: string;

  /** Whether the tool is supported on this platform. */
  supported: boolean;

  /** Human-readable reason if unsupported. */
  unsupportedReason?: string;

  /**
   * Alternative package manager commands, keyed by manager name.
   *
   * @example { "apt": "sudo apt install nodejs", "dnf": "sudo dnf install nodejs" }
   */
  alternativeCommands?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Claude Code conventions per profile
// ---------------------------------------------------------------------------

/**
 * Claude Code integration settings recommended for a profile.
 */
export interface ProfileClaudeConventions {
  /** Recommended agent IDs from the Claude Code agent catalog. */
  recommendedAgents: string[];

  /** Recommended MCP tool patterns. */
  mcpTools: string[];

  /** Preferred memory architecture. */
  memoryArchitecture: 'basic' | 'tiered' | 'memgpt';

  /** Recommended skills. */
  skills: string[];

  /** Recommended slash commands. */
  commands: string[];

  /** Extra CLAUDE.md instructions to append. */
  claudeInstructions?: string;
}

// ---------------------------------------------------------------------------
// Profile definition
// ---------------------------------------------------------------------------

/**
 * Complete definition of a developer profile.
 *
 * This is the canonical representation. Built-in profiles ship as static
 * instances; custom profiles are deserialized from JSON.
 */
export interface ProfileDefinition {
  /** Profile archetype. */
  type: ProfileType;

  /** Human-readable name (e.g., "Frontend Developer"). */
  displayName: string;

  /** One-line description. */
  description: string;

  /** Ordered list of tools this profile installs. */
  tools: ToolSpec[];

  /** VS Code / editor extensions to install. */
  extensions: string[];

  /** Global npm / pip packages to install. */
  globalPackages: Record<string, string[]>;

  /** Estimated setup time in minutes. */
  estimatedTimeMinutes: number;

  /** Claude Code conventions for this profile. */
  claudeConventions: ProfileClaudeConventions;
}

// ---------------------------------------------------------------------------
// Customization and composition
// ---------------------------------------------------------------------------

/**
 * User-supplied overrides applied on top of a base profile.
 */
export interface ProfileOverride {
  /** Tools to add (merged into the base). */
  addTools?: ToolSpec[];

  /** Tool names to remove from the base. */
  removeTools?: string[];

  /** Version overrides keyed by tool name. */
  versionPins?: Record<string, ToolVersion>;

  /** Additional extensions. */
  addExtensions?: string[];

  /** Extensions to remove. */
  removeExtensions?: string[];

  /** Additional global packages keyed by ecosystem (npm, pip, etc.). */
  addGlobalPackages?: Record<string, string[]>;

  /** Override Claude conventions. */
  claudeConventions?: Partial<ProfileClaudeConventions>;
}

/**
 * Result of composing one or more profiles with optional overrides.
 */
export interface ComposedProfile {
  /** The profile types that were composed. */
  sourceProfiles: ProfileType[];

  /** Combined display name. */
  displayName: string;

  /** Merged, deduplicated tool list. */
  tools: ToolSpec[];

  /** Merged extensions. */
  extensions: string[];

  /** Merged global packages. */
  globalPackages: Record<string, string[]>;

  /** Merged Claude conventions. */
  claudeConventions: ProfileClaudeConventions;

  /** Estimated total setup time in minutes. */
  estimatedTimeMinutes: number;

  /** Conflicts detected during composition. */
  conflicts: ProfileConflict[];
}

/**
 * A conflict detected when merging two profiles.
 */
export interface ProfileConflict {
  /** The tool with the conflict. */
  toolName: string;

  /** The conflicting field. */
  field: 'version' | 'required' | 'category';

  /** Value from profile A. */
  valueA: string;

  /** Value from profile B. */
  valueB: string;

  /** How the conflict was resolved. */
  resolution: string;
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/**
 * Serializable manifest for sharing team profiles.
 */
export interface ProfileManifest {
  /** Manifest schema version. */
  version: string;

  /** Human-readable manifest name. */
  name: string;

  /** Description of this team configuration. */
  description: string;

  /** ISO 8601 creation timestamp. */
  createdAt: string;

  /** ISO 8601 last-modified timestamp. */
  updatedAt: string;

  /** Base profile types. */
  baseProfiles: ProfileType[];

  /** Overrides applied on top of the base profiles. */
  overrides: ProfileOverride;

  /** SHA-256 checksum of the canonical JSON (excluding this field). */
  checksum: string;
}

// ---------------------------------------------------------------------------
// Rollback / Snapshot
// ---------------------------------------------------------------------------

/**
 * A point-in-time snapshot of installed tool state, used for rollback.
 */
export interface ProfileSnapshot {
  /** Unique snapshot ID. */
  id: string;

  /** ISO 8601 timestamp when the snapshot was taken. */
  timestamp: string;

  /** Platform at the time of snapshot. */
  platform: SetupPlatform;

  /** Installed tools with their versions. */
  installedTools: InstalledToolRecord[];

  /** Profile that was active when snapshot was taken. */
  profileTypes: ProfileType[];
}

/**
 * Record of a single installed tool in a snapshot.
 */
export interface InstalledToolRecord {
  /** Tool name. */
  name: string;

  /** Installed version. */
  version: string;

  /** Install location / binary path. */
  location: string;

  /** Category. */
  category: ToolCategory;
}

// ---------------------------------------------------------------------------
// Validation results
// ---------------------------------------------------------------------------

/**
 * Result of validating a profile against the current system.
 */
export interface ProfileValidationResult {
  /** Whether all required tools pass validation. */
  valid: boolean;

  /** Tools that passed validation. */
  passed: ToolValidationEntry[];

  /** Tools that failed validation. */
  failed: ToolValidationEntry[];

  /** Tools not supported on this platform. */
  unsupported: ToolValidationEntry[];

  /** Warnings (e.g., optional tool missing). */
  warnings: string[];

  /** Errors (required tool missing or wrong version). */
  errors: string[];
}

/**
 * Validation entry for a single tool.
 */
export interface ToolValidationEntry {
  /** Tool name. */
  toolName: string;

  /** Expected version (from profile). */
  expectedVersion?: string;

  /** Actual installed version (if any). */
  installedVersion?: string;

  /** Whether the tool is installed. */
  installed: boolean;

  /** Whether the version matches. */
  versionMatch: boolean;

  /** Human-readable status message. */
  message: string;
}

/**
 * Result of checking for tool updates.
 */
export interface UpdateCheckResult {
  /** Tools with available updates. */
  updatesAvailable: ToolUpdateInfo[];

  /** Tools already at latest version. */
  upToDate: string[];

  /** Tools that could not be checked. */
  checkFailed: string[];
}

/**
 * Update information for a single tool.
 */
export interface ToolUpdateInfo {
  /** Tool name. */
  toolName: string;

  /** Currently installed version. */
  currentVersion: string;

  /** Latest available version. */
  latestVersion: string;

  /** Whether the update is a major version bump. */
  isMajorUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------

/**
 * Detected system package manager with its capabilities.
 */
export interface DetectedPackageManager {
  /** Manager name (e.g., "brew", "apt", "dnf", "winget"). */
  name: string;

  /** Full path to the binary. */
  path: string;

  /** Manager version string. */
  version: string;

  /** Whether this is the primary manager for the platform. */
  primary: boolean;
}

/**
 * Result of detecting available package managers.
 */
export interface PackageManagerDetectionResult {
  /** The primary package manager for this platform. */
  primary: DetectedPackageManager | null;

  /** All detected package managers. */
  all: DetectedPackageManager[];

  /** The platform that was detected. */
  platform: SetupPlatform;

  /** Linux distribution family (if applicable). */
  linuxFamily?: 'debian' | 'redhat' | 'arch' | 'suse' | 'alpine' | 'unknown';
}
