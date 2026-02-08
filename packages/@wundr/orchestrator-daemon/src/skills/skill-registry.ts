/**
 * Skill Registry
 *
 * Centralized registry for managing loaded skills with lifecycle management,
 * eligibility filtering, prompt building, and command spec generation.
 *
 * The registry is the primary integration point between the skills system
 * and the orchestrator daemon. It handles:
 *
 * - Loading skills from all configured directories
 * - Security scanning before registration
 * - Eligibility filtering (binary/env/config requirements)
 * - Building formatted prompts for system context injection
 * - Generating slash command specs from registered skills
 * - Snapshot versioning for cache invalidation
 *
 * @module skills/skill-registry
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  loadAllSkillEntries,
  formatSkillsForPrompt,
  resolveWundrMetadata,
  resolveInvocationPolicy,
} from './skill-loader';
import {
  scanSkillComplete,
  hasCriticalFindings,
  formatScanReport,
} from './skill-scanner';
import type {
  Skill,
  SkillCommandSpec,
  SkillConfigEntry,
  SkillEligibilityContext,
  SkillEntry,
  SkillScanSummary,
  SkillSnapshot,
  SkillsConfig,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKILL_COMMAND_MAX_LENGTH = 32;
const SKILL_COMMAND_FALLBACK = 'skill';
const SKILL_COMMAND_DESCRIPTION_MAX_LENGTH = 100;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Events emitted by the SkillRegistry.
 */
export interface SkillRegistryEvents {
  /** Emitted when skills are loaded or reloaded */
  loaded: { count: number; version: number };
  /** Emitted when a skill fails security scan */
  scanFailed: { skillName: string; summary: SkillScanSummary };
  /** Emitted on any error during operation */
  error: { message: string; context?: Record<string, unknown> };
}

type EventListener<K extends keyof SkillRegistryEvents> = (
  data: SkillRegistryEvents[K],
) => void;

/**
 * Central registry for all loaded and validated skills.
 *
 * Usage:
 * ```typescript
 * const registry = new SkillRegistry({
 *   workspaceDir: '/path/to/project',
 *   config: { enabled: true },
 * });
 * await registry.load();
 *
 * const snapshot = registry.buildSnapshot();
 * const commands = registry.buildCommandSpecs();
 * const skill = registry.getSkill('review-pr');
 * ```
 */
export class SkillRegistry {
  private entries: Map<string, SkillEntry> = new Map();
  private version = 0;
  private workspaceDir: string;
  private config?: SkillsConfig;
  private managedSkillsDir?: string;
  private bundledSkillsDir?: string;
  private listeners: Map<string, Set<EventListener<any>>> = new Map();
  private scanResults: Map<string, SkillScanSummary> = new Map();

  constructor(opts: {
    workspaceDir: string;
    config?: SkillsConfig;
    managedSkillsDir?: string;
    bundledSkillsDir?: string;
  }) {
    this.workspaceDir = opts.workspaceDir;
    this.config = opts.config;
    this.managedSkillsDir = opts.managedSkillsDir;
    this.bundledSkillsDir = opts.bundledSkillsDir;
  }

  // -------------------------------------------------------------------------
  // Event Emitter
  // -------------------------------------------------------------------------

  /**
   * Register an event listener.
   */
  on<K extends keyof SkillRegistryEvents>(
    event: K,
    listener: EventListener<K>,
  ): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => { this.listeners.get(key)?.delete(listener); };
  }

  private emit<K extends keyof SkillRegistryEvents>(
    event: K,
    data: SkillRegistryEvents[K],
  ): void {
    const key = event as string;
    const set = this.listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(data);
      } catch (err) {
        console.warn(`[SkillRegistry] Event listener error (${key}):`, err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  /**
   * Load (or reload) all skills from configured directories.
   *
   * Process:
   * 1. Discover SKILL.md files from all directories
   * 2. Parse frontmatter and resolve metadata
   * 3. Run security scans (if enabled in config)
   * 4. Filter by eligibility requirements
   * 5. Register in the internal map
   * 6. Bump version for cache invalidation
   */
  async load(eligibility?: SkillEligibilityContext): Promise<void> {
    if (this.config?.enabled === false) {
      this.entries.clear();
      return;
    }

    // Step 1-2: Discover and parse
    const allEntries = loadAllSkillEntries(
      this.workspaceDir,
      this.config,
      this.managedSkillsDir,
      this.bundledSkillsDir,
    );

    // Step 3: Security scan
    const securityConfig = this.config?.security;
    const scanOnLoad = securityConfig?.scanOnLoad !== false;
    const blockCritical = securityConfig?.blockCritical !== false;

    const validEntries: SkillEntry[] = [];
    for (const entry of allEntries) {
      if (scanOnLoad) {
        try {
          const summary = await scanSkillComplete(
            entry.skill.baseDir,
            entry.skill.body,
            entry.skill.filePath,
          );
          this.scanResults.set(entry.skill.name, summary);

          if (blockCritical && hasCriticalFindings(summary)) {
            this.emit('scanFailed', {
              skillName: entry.skill.name,
              summary,
            });
            console.warn(
              `[SkillRegistry] Skill "${entry.skill.name}" blocked by security scan:\n` +
              formatScanReport(summary),
            );
            continue;
          }
        } catch (err) {
          console.warn(
            `[SkillRegistry] Security scan failed for "${entry.skill.name}":`,
            err,
          );
          // If scan itself fails, still allow the skill unless configured otherwise
        }
      }
      validEntries.push(entry);
    }

    // Step 4: Filter by eligibility
    const eligible = filterSkillEntries(validEntries, this.config, eligibility);

    // Step 5: Register
    this.entries.clear();
    for (const entry of eligible) {
      this.entries.set(entry.skill.name, entry);
    }

    // Step 6: Bump version
    this.version = bumpVersion(this.version);
    this.emit('loaded', { count: this.entries.size, version: this.version });
  }

  /**
   * Update the workspace directory and reload.
   */
  async setWorkspaceDir(
    workspaceDir: string,
    eligibility?: SkillEligibilityContext,
  ): Promise<void> {
    this.workspaceDir = workspaceDir;
    await this.load(eligibility);
  }

  /**
   * Update configuration and reload.
   */
  async updateConfig(
    config: SkillsConfig,
    eligibility?: SkillEligibilityContext,
  ): Promise<void> {
    this.config = config;
    await this.load(eligibility);
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /**
   * Get a skill entry by name.
   */
  getEntry(name: string): SkillEntry | undefined {
    return this.entries.get(name);
  }

  /**
   * Get the Skill definition by name.
   */
  getSkill(name: string): Skill | undefined {
    return this.entries.get(name)?.skill;
  }

  /**
   * Get all registered skill entries.
   */
  getAllEntries(): SkillEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get all registered skill names.
   */
  getSkillNames(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Check if a skill is registered.
   */
  hasSkill(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Get the number of registered skills.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Get the current version number.
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get security scan results for a skill (if scan was performed).
   */
  getScanResult(name: string): SkillScanSummary | undefined {
    return this.scanResults.get(name);
  }

  // -------------------------------------------------------------------------
  // Prompt Building
  // -------------------------------------------------------------------------

  /**
   * Build a SkillSnapshot for injecting into system context.
   * The snapshot includes the formatted prompt and metadata for all
   * eligible skills (excluding those with disableModelInvocation).
   */
  buildSnapshot(filterNames?: string[]): SkillSnapshot {
    let entries = Array.from(this.entries.values());

    // Apply name filter if provided
    if (filterNames && filterNames.length > 0) {
      const normalized = new Set(filterNames.map(n => n.trim()).filter(Boolean));
      entries = entries.filter(e => normalized.has(e.skill.name));
    }

    // Exclude skills that disable model invocation from the prompt
    const promptEntries = entries.filter(
      e => !e.invocation.disableModelInvocation,
    );
    const resolvedSkills = promptEntries.map(e => e.skill);
    const prompt = formatSkillsForPrompt(resolvedSkills);

    return {
      prompt,
      skills: entries.map(e => ({
        name: e.skill.name,
        primaryEnv: e.metadata?.primaryEnv,
        category: e.metadata?.category,
      })),
      resolvedSkills,
      version: this.version,
    };
  }

  /**
   * Build just the prompt string for system context injection.
   */
  buildPrompt(filterNames?: string[]): string {
    return this.buildSnapshot(filterNames).prompt;
  }

  // -------------------------------------------------------------------------
  // Command Spec Generation
  // -------------------------------------------------------------------------

  /**
   * Build slash command specifications from all registered skills.
   * Handles name sanitization, deduplication, and description truncation.
   *
   * @param reservedNames - Set of already-used command names to avoid collisions
   * @returns Array of command specs ready for registration
   */
  buildCommandSpecs(reservedNames?: Set<string>): SkillCommandSpec[] {
    const used = new Set<string>();
    if (reservedNames) {
      for (const name of reservedNames) {
        used.add(name.toLowerCase());
      }
    }

    const specs: SkillCommandSpec[] = [];
    const entries = Array.from(this.entries.values())
      .filter(e => e.invocation.userInvocable);

    for (const entry of entries) {
      const rawName = entry.skill.name;
      const base = sanitizeSkillCommandName(rawName);
      const unique = resolveUniqueCommandName(base, used);
      used.add(unique.toLowerCase());

      const rawDescription = entry.skill.description.trim() || rawName;
      const description = rawDescription.length > SKILL_COMMAND_DESCRIPTION_MAX_LENGTH
        ? rawDescription.slice(0, SKILL_COMMAND_DESCRIPTION_MAX_LENGTH - 1) + '...'
        : rawDescription;

      specs.push({
        name: unique,
        skillName: rawName,
        description,
      });
    }

    return specs;
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /**
   * Export the registry state for debugging, logging, or API responses.
   */
  exportState(): {
    version: number;
    skillCount: number;
    skills: Array<{
      name: string;
      description: string;
      source: string;
      category?: string;
      context?: string;
      hasScanResult: boolean;
    }>;
  } {
    return {
      version: this.version,
      skillCount: this.entries.size,
      skills: Array.from(this.entries.values()).map(e => ({
        name: e.skill.name,
        description: e.skill.description,
        source: e.skill.source,
        category: e.metadata?.category,
        context: e.skill.frontmatter.context,
        hasScanResult: this.scanResults.has(e.skill.name),
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Eligibility Filtering
// ---------------------------------------------------------------------------

/**
 * Filter skill entries based on configuration and runtime eligibility.
 */
function filterSkillEntries(
  entries: SkillEntry[],
  config?: SkillsConfig,
  eligibility?: SkillEligibilityContext,
): SkillEntry[] {
  return entries.filter(entry => shouldIncludeSkill(entry, config, eligibility));
}

/**
 * Determine whether a single skill should be included based on all eligibility rules.
 */
function shouldIncludeSkill(
  entry: SkillEntry,
  config?: SkillsConfig,
  eligibility?: SkillEligibilityContext,
): boolean {
  const skillKey = entry.metadata?.skillKey ?? entry.skill.name;

  // Check per-skill config override
  const skillConfig = resolveSkillConfig(config, skillKey);
  if (skillConfig?.enabled === false) return false;

  // Check bundled allowlist
  const allowBundled = config?.allowBundled;
  if (allowBundled && allowBundled.length > 0 && entry.skill.source === 'bundled') {
    if (!allowBundled.includes(skillKey) && !allowBundled.includes(entry.skill.name)) {
      return false;
    }
  }

  // Check OS restrictions
  const osList = entry.metadata?.os ?? [];
  if (osList.length > 0) {
    const currentPlatform = process.platform;
    const remotePlatforms = eligibility?.remote?.platforms ?? [];
    if (!osList.includes(currentPlatform) && !remotePlatforms.some(p => osList.includes(p))) {
      return false;
    }
  }

  // Skills marked as "always" bypass requirement checks
  if (entry.metadata?.always === true) return true;

  // Check required binaries (all must be present)
  const requiredBins = entry.metadata?.requires?.bins ?? [];
  if (requiredBins.length > 0) {
    for (const bin of requiredBins) {
      if (!hasBinary(bin) && !eligibility?.remote?.hasBin?.(bin)) {
        return false;
      }
    }
  }

  // Check anyBins (at least one must be present)
  const requiredAnyBins = entry.metadata?.requires?.anyBins ?? [];
  if (requiredAnyBins.length > 0) {
    const anyFound = requiredAnyBins.some(bin => hasBinary(bin))
      || eligibility?.remote?.hasAnyBin?.(requiredAnyBins);
    if (!anyFound) return false;
  }

  // Check required environment variables
  const requiredEnv = entry.metadata?.requires?.env ?? [];
  if (requiredEnv.length > 0) {
    for (const envName of requiredEnv) {
      if (process.env[envName]) continue;
      if (skillConfig?.env?.[envName]) continue;
      if (skillConfig?.apiKey && entry.metadata?.primaryEnv === envName) continue;
      return false;
    }
  }

  // Check required config paths
  const requiredConfig = entry.metadata?.requires?.config ?? [];
  if (requiredConfig.length > 0) {
    for (const configPath of requiredConfig) {
      if (!isConfigPathTruthy(config, configPath)) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSkillConfig(
  config: SkillsConfig | undefined,
  skillKey: string,
): SkillConfigEntry | undefined {
  return config?.entries?.[skillKey];
}

function isConfigPathTruthy(
  config: SkillsConfig | undefined,
  pathStr: string,
): boolean {
  const parts = pathStr.split('.').filter(Boolean);
  let current: unknown = config;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return false;
    current = (current as Record<string, unknown>)[part];
  }
  if (current === undefined || current === null) return false;
  if (typeof current === 'boolean') return current;
  if (typeof current === 'number') return current !== 0;
  if (typeof current === 'string') return current.trim().length > 0;
  return true;
}

function hasBinary(bin: string): boolean {
  const pathEnv = process.env['PATH'] ?? '';
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  for (const part of parts) {
    const candidate = path.join(part, bin);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function sanitizeSkillCommandName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.slice(0, SKILL_COMMAND_MAX_LENGTH) || SKILL_COMMAND_FALLBACK;
}

function resolveUniqueCommandName(base: string, used: Set<string>): string {
  const normalizedBase = base.toLowerCase();
  if (!used.has(normalizedBase)) return base;

  for (let index = 2; index < 1000; index++) {
    const suffix = `_${index}`;
    const maxBaseLength = Math.max(1, SKILL_COMMAND_MAX_LENGTH - suffix.length);
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }

  return `${base.slice(0, Math.max(1, SKILL_COMMAND_MAX_LENGTH - 2))}_x`;
}

function bumpVersion(current: number): number {
  const now = Date.now();
  return now <= current ? current + 1 : now;
}
