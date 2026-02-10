/**
 * Skills System
 *
 * SKILL.md-based skill system for the Wundr orchestrator daemon.
 * Provides modular, extensible, auto-discovered capabilities through
 * Markdown files with YAML frontmatter.
 *
 * Architecture:
 * - skill-loader: Discovery and parsing of SKILL.md files
 * - skill-scanner: Security scanning for malicious patterns
 * - skill-registry: Centralized registry with lifecycle management
 * - skill-executor: Runtime invocation with argument substitution
 * - skill-dependencies: Topological dependency resolution
 * - skill-validator: Structural and availability validation
 * - skill-search: Full-text and faceted metadata indexing
 * - skill-watcher: Hot-reload via filesystem monitoring
 * - skill-analytics: Usage tracking and reporting
 * - types: Complete type system for the skills framework
 *
 * @example
 * ```typescript
 * import {
 *   SkillRegistry,
 *   SkillExecutor,
 *   parseSkillCommand,
 * } from './skills';
 *
 * // Initialize registry
 * const registry = new SkillRegistry({
 *   workspaceDir: '/path/to/project',
 *   config: { enabled: true },
 * });
 * await registry.load();
 *
 * // Create executor
 * const executor = new SkillExecutor(registry);
 *
 * // Parse and execute a user command
 * const cmd = parseSkillCommand('/review-pr 123');
 * if (cmd) {
 *   const result = await executor.execute(cmd.skillName, {
 *     arguments: cmd.arguments,
 *   });
 *   if (result.success) {
 *     console.log(result.renderedPrompt);
 *   }
 * }
 * ```
 *
 * @module skills
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  // Core types
  Skill,
  SkillEntry,
  SkillSource,
  SkillFrontmatter,
  ParsedSkillFrontmatter,

  // Hooks
  SkillHooks,

  // Install preferences
  SkillInstallPreference,
  SkillsInstallPreferences,

  // Metadata
  WundrSkillMetadata,
  SkillInstallSpec,
  SkillInvocationPolicy,

  // Registry
  SkillSnapshot,
  SkillCommandSpec,
  SkillEligibilityContext,

  // Execution
  SkillExecutionOptions,
  SkillExecutionResult,

  // Scanner
  SkillScanSeverity,
  SkillScanFinding,
  SkillScanSummary,
  SkillScanOptions,

  // Configuration
  SkillConfigEntry,
  SkillsConfig,
  SkillsChangeEvent,

  // Search
  SkillSearchQuery,
  SkillSearchResult,

  // Command Execution
  CommandExecutionResult,
  CommandExecutionOptions,

  // Validation
  SkillValidationSeverity,
  SkillValidationIssue,
  SkillValidationResult,

  // Caching
  SkillCacheEntry,

  // Versioning
  SkillVersionInfo,

  // Analytics
  SkillUsageEntry,
  SkillAnalyticsSummary,

  // Dependencies
  SkillDependencyResolution,

  // File watching
  SkillFileEvent,
} from './types';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export {
  parseFrontmatter,
  resolveWundrMetadata,
  resolveInvocationPolicy,
  resolveHooks,
  resolveSkillFrontmatter,
  resolveInstallPreferences,
  resolveDiscoveryDirs,
  loadSkillsFromDir,
  loadAllSkillEntries,
  resolveBundledSkillsDir,
  formatSkillsForPrompt,
  buildVersionInfo,
  getAllVersionInfo,
  clearParseCache,
  getParseCacheSize,
  normalizeStringList,
  parseBooleanValue,
  resolveUserPath,
} from './skill-loader';

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export {
  isScannable,
  scanSource,
  scanSkillBody,
  scanDirectory,
  scanDirectoryWithSummary,
  scanSkillComplete,
  hasCriticalFindings,
  formatScanReport,
} from './skill-scanner';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export { SkillRegistry } from './skill-registry';
export type { SkillRegistryEvents } from './skill-registry';

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export {
  SkillExecutor,
  parseSkillCommand,
  findMatchingSkill,
} from './skill-executor';

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export {
  resolveDependencies,
  resolveDependenciesBatch,
  wouldCreateCycle,
} from './skill-dependencies';

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export {
  validateSkill,
  validateAllSkills,
  formatValidationReport,
} from './skill-validator';

// ---------------------------------------------------------------------------
// Search Index
// ---------------------------------------------------------------------------

export { SkillSearchIndex } from './skill-search';

// ---------------------------------------------------------------------------
// File Watcher
// ---------------------------------------------------------------------------

export { SkillWatcher } from './skill-watcher';
export type { SkillChangeCallback } from './skill-watcher';

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export { SkillAnalytics } from './skill-analytics';
