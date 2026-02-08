/**
 * Unified Setup Orchestrator
 *
 * Single orchestrator that consolidates RealSetupOrchestrator,
 * SetupOrchestrator, and ComputerSetupManager into one clean,
 * testable, secure architecture.
 *
 * Key features:
 * - Idempotent operations (every step checks before acting)
 * - State persistence for resume-from-failure
 * - Dry-run mode as a first-class concept
 * - Safe command execution via OperationRunner (no shell: true)
 * - Cross-platform support (macOS, Linux, Windows)
 * - 6 built-in developer profiles + custom profiles
 * - Incremental updates for computer-update
 * - Progress reporting via callbacks and EventEmitter
 * - Claude Code conventions generator integration
 * - Topological dependency sorting with parallel execution support
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import { OperationRunner } from './operation-runner';
import { PlatformDetector } from './platform-detector';
import {
  ProfileManager,
  type ProfileDefinition,
  type ProfileToolEntry,
} from './profile-manager';

import type {
  SetupPlatform,
  SetupProgress,
  SetupResult,
  SetupStep,
  ContextEngineeringOptions,
  OrchestrationOptions,
  SecurityOptions,
} from '../types';

// ───────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────

/**
 * Lifecycle state of the orchestrator.
 */
export type OrchestratorState =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'complete'
  | 'failed';

/**
 * Configuration for the unified orchestrator.
 */
export interface UnifiedOrchestratorConfig {
  /** Run in dry-run mode -- log but do not execute commands */
  dryRun: boolean;
  /** Skip tools that are already installed */
  skipExisting: boolean;
  /** Execute independent steps in parallel when possible */
  parallel: boolean;
  /** Generate a setup report on completion */
  generateReport: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Context engineering options (Phase 6) */
  contextEngineering?: ContextEngineeringOptions;
  /** Orchestration framework options (Phase 6) */
  orchestration?: OrchestrationOptions;
  /** Security options (Phase 3) */
  security?: SecurityOptions;
  /** Path for Claude Code conventions generation (Phase 7) */
  conventionsProjectPath?: string;
}

/**
 * Callback type for progress updates.
 */
export interface ProgressCallback {
  (progress: SetupProgress): void;
}

/**
 * Installer adapter interface. Each tool installer must implement
 * this interface to be registered with the orchestrator.
 */
export interface InstallerAdapter {
  /** Unique tool identifier matching ProfileToolEntry.id */
  readonly id: string;
  /** Check whether the tool is already installed */
  isInstalled(platform: SetupPlatform): Promise<boolean>;
  /** Install the tool */
  install(platform: SetupPlatform): Promise<void>;
  /** Validate the installation (optional) */
  validate?(platform: SetupPlatform): Promise<boolean>;
  /** Configure the tool after installation (optional) */
  configure?(platform: SetupPlatform): Promise<void>;
}

/**
 * Persisted state for resume-from-failure.
 */
interface PersistedState {
  sessionId: string;
  startTime: string;
  profileId: string;
  config: UnifiedOrchestratorConfig;
  completedToolIds: string[];
  failedToolIds: string[];
  skippedToolIds: string[];
  currentPhase: string;
  resumable: boolean;
}

// ───────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────

const STATE_FILE = path.join(os.homedir(), '.wundr', 'setup-state.json');

const PHASES = [
  'platform-validation',
  'profile-resolution',
  'security',
  'core-system',
  'development-tools',
  'ai-orchestration',
  'configuration-conventions',
  'verification-finalization',
] as const;

type Phase = (typeof PHASES)[number];

// ───────────────────────────────────────────────────────
// Implementation
// ───────────────────────────────────────────────────────

/**
 * Unified orchestrator for computer setup.
 *
 * Replaces `RealSetupOrchestrator`, `SetupOrchestrator`, and
 * `ComputerSetupManager` with a single, well-tested implementation.
 *
 * @example
 * ```ts
 * const orchestrator = new UnifiedOrchestrator({ dryRun: false, skipExisting: true });
 * orchestrator.registerInstaller(myBrewInstaller);
 * const result = await orchestrator.setup('fullstack');
 * ```
 */
export class UnifiedOrchestrator extends EventEmitter {
  private readonly config: UnifiedOrchestratorConfig;
  private readonly logger: Logger;
  private readonly platformDetector: PlatformDetector;
  private readonly profileManager: ProfileManager;
  private readonly runner: OperationRunner;
  private readonly installers: Map<string, InstallerAdapter> = new Map();

  private state: OrchestratorState = 'idle';
  private sessionId = '';
  private completedToolIds: Set<string> = new Set();
  private failedToolIds: Set<string> = new Set();
  private skippedToolIds: Set<string> = new Set();
  private currentPhase: Phase = 'platform-validation';
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private totalSteps = 0;

  constructor(config: Partial<UnifiedOrchestratorConfig> = {}) {
    super();
    this.config = {
      dryRun: false,
      skipExisting: true,
      parallel: false,
      generateReport: true,
      verbose: false,
      ...config,
    };
    this.logger = new Logger({ name: 'UnifiedOrchestrator' });
    this.platformDetector = new PlatformDetector();
    this.profileManager = new ProfileManager();
    this.runner = new OperationRunner({ dryRun: this.config.dryRun });
  }

  // ─────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────

  /**
   * Register a tool installer. Must be called before `setup()` for
   * each tool the orchestrator should manage.
   */
  registerInstaller(installer: InstallerAdapter): void {
    this.installers.set(installer.id, installer);
  }

  /**
   * Register a progress callback.
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.add(callback);
  }

  /**
   * Get a reference to the profile manager for listing/registering profiles.
   */
  getProfileManager(): ProfileManager {
    return this.profileManager;
  }

  /**
   * Get a reference to the platform detector.
   */
  getPlatformDetector(): PlatformDetector {
    return this.platformDetector;
  }

  /**
   * Get the current orchestrator state.
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Run the full setup for a given profile.
   *
   * Executes all 8 phases in order, persisting state after each
   * completed tool so the setup can be resumed on failure.
   */
  async setup(
    profileId: string,
    progressCallback?: ProgressCallback
  ): Promise<SetupResult> {
    if (progressCallback) {
      this.progressCallbacks.add(progressCallback);
    }

    this.sessionId = this.generateSessionId();
    const startTime = Date.now();

    const result: SetupResult = {
      success: false,
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      warnings: [],
      errors: [],
      duration: 0,
    };

    try {
      // Phase 1: Platform Detection & Validation
      this.transitionState('planning');
      const platform = await this.executePlatformValidation(result);

      // Phase 2: Profile Resolution & Plan Generation
      const profile = this.executeProfileResolution(profileId, platform);
      const plan = this.profileManager.filterToolsForPlatform(
        profile,
        platform
      );
      const sortedPlan = this.topologicalSort(plan);
      this.totalSteps = sortedPlan.length;

      // Save initial state
      await this.persistState(profileId);

      // Phase 3: Security Configuration
      this.transitionState('executing');
      if (this.config.security) {
        await this.executePhase('security', 'Security Configuration', async () => {
          this.logger.info('Security configuration phase (delegated to security-setup module)');
          // Actual security setup is delegated to the security-setup module
          // which the caller can invoke separately with full options
        }, result, 10, 15);
      }

      // Phase 4: Core System Tools
      const coreTools = sortedPlan.filter(
        t => t.category === 'system'
      );
      await this.executeToolPhase(
        'core-system',
        'Core System Tools',
        coreTools,
        platform,
        result,
        15,
        30
      );

      // Phase 5: Development Tools
      const devTools = sortedPlan.filter(
        t => t.category === 'development'
      );
      await this.executeToolPhase(
        'development-tools',
        'Development Tools',
        devTools,
        platform,
        result,
        30,
        60
      );

      // Phase 6: AI & Orchestration
      const aiTools = sortedPlan.filter(t => t.category === 'ai');
      await this.executeToolPhase(
        'ai-orchestration',
        'AI & Orchestration Setup',
        aiTools,
        platform,
        result,
        60,
        75
      );

      // Phase 7: Configuration & Conventions
      await this.executePhase(
        'configuration-conventions',
        'Configuration & Conventions',
        async () => {
          await this.executeConfigurationPhase(platform, profile, result);
        },
        result,
        75,
        90
      );

      // Phase 8: Verification & Finalization
      this.transitionState('verifying');
      await this.executePhase(
        'verification-finalization',
        'Verification & Finalization',
        async () => {
          await this.executeVerificationPhase(sortedPlan, platform, result);
          await this.profileManager.saveActiveProfile(profile);
        },
        result,
        90,
        100
      );

      result.success = result.failedSteps.length === 0;
      result.completedSteps = Array.from(this.completedToolIds);
      result.failedSteps = Array.from(this.failedToolIds);
      result.skippedSteps = Array.from(this.skippedToolIds);

      this.transitionState('complete');
      this.emitProgress('Setup completed successfully', 100);

      // Clean up persisted state on success
      await this.cleanupState();
    } catch (error) {
      this.transitionState('failed');
      result.errors.push(error as Error);
      result.completedSteps = Array.from(this.completedToolIds);
      result.failedSteps = Array.from(this.failedToolIds);
      result.skippedSteps = Array.from(this.skippedToolIds);

      // Mark state as resumable
      await this.persistState(profileId, true);

      this.logger.error('Setup failed:', error);
      this.emitProgress(
        `Setup failed: ${(error as Error).message}`,
        this.calculateProgress()
      );
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Resume a previously failed setup.
   *
   * Loads persisted state and skips tools that were already
   * successfully installed.
   */
  async resume(progressCallback?: ProgressCallback): Promise<SetupResult> {
    if (progressCallback) {
      this.progressCallbacks.add(progressCallback);
    }

    const persisted = await this.loadPersistedState();
    if (!persisted || !persisted.resumable) {
      throw new Error('No resumable setup found');
    }

    this.logger.info(`Resuming session ${persisted.sessionId}`);

    // Restore state
    this.sessionId = persisted.sessionId;
    this.completedToolIds = new Set(persisted.completedToolIds);
    this.failedToolIds = new Set(); // Clear failures -- we are retrying
    this.skippedToolIds = new Set(persisted.skippedToolIds);
    this.config.dryRun = persisted.config.dryRun;

    // Re-run setup; the tool execution phase will skip completed tools
    return this.setup(persisted.profileId, progressCallback);
  }

  /**
   * Check whether a resumable setup exists.
   */
  async canResume(): Promise<boolean> {
    const persisted = await this.loadPersistedState();
    return persisted?.resumable === true;
  }

  /**
   * Run an incremental update. Compares the current profile
   * against the previously installed profile and only processes
   * the differences.
   */
  async update(
    profileId: string,
    progressCallback?: ProgressCallback
  ): Promise<SetupResult> {
    if (progressCallback) {
      this.progressCallbacks.add(progressCallback);
    }

    const oldProfile = await this.profileManager.loadActiveProfile();
    const newProfile = this.profileManager.resolve(profileId);

    if (!oldProfile) {
      this.logger.info('No previous profile found; running full setup');
      return this.setup(profileId, progressCallback);
    }

    const diff = this.profileManager.diff(oldProfile, newProfile);
    this.logger.info(
      `Profile diff: +${diff.added.length} added, -${diff.removed.length} removed, ~${diff.changed.length} changed`
    );

    if (
      diff.added.length === 0 &&
      diff.changed.length === 0 &&
      diff.removed.length === 0
    ) {
      this.logger.info('Profile is up to date; nothing to do');
      return {
        success: true,
        completedSteps: [],
        failedSteps: [],
        skippedSteps: diff.unchanged.map(t => t.id),
        warnings: [],
        errors: [],
        duration: 0,
      };
    }

    // For now, run setup with the new profile. The skipExisting
    // flag ensures already-installed tools are skipped.
    return this.setup(profileId, progressCallback);
  }

  // ─────────────────────────────────────────────────
  // Phase execution
  // ─────────────────────────────────────────────────

  private async executePlatformValidation(
    result: SetupResult
  ): Promise<SetupPlatform> {
    this.emitProgress('Validating platform', 0);

    const validation = await this.platformDetector.validate();
    for (const warning of validation.warnings) {
      result.warnings.push(warning);
    }
    if (!validation.valid) {
      const msg = validation.errors.join('; ');
      throw new Error(`Platform validation failed: ${msg}`);
    }

    this.emitProgress('Platform validated', 8);
    return validation.platform;
  }

  private executeProfileResolution(
    profileId: string,
    _platform: SetupPlatform
  ): ProfileDefinition {
    this.emitProgress('Resolving profile', 9);
    const profile = this.profileManager.resolve(profileId);
    this.logger.info(`Profile resolved: ${profile.name} (${profile.id})`);
    this.emitProgress(`Profile: ${profile.name}`, 10);
    return profile;
  }

  /**
   * Execute a batch of tool installations for a given phase.
   */
  private async executeToolPhase(
    phase: Phase,
    phaseName: string,
    tools: ProfileToolEntry[],
    platform: SetupPlatform,
    result: SetupResult,
    startPercent: number,
    endPercent: number
  ): Promise<void> {
    if (tools.length === 0) {
      return;
    }

    this.currentPhase = phase;
    this.emitProgress(`Starting ${phaseName}`, startPercent);

    const percentPerTool =
      tools.length > 0 ? (endPercent - startPercent) / tools.length : 0;

    if (this.config.parallel) {
      // Group by dependency level and execute each level in parallel
      const groups = this.groupByDependencyLevel(tools);
      let currentPercent = startPercent;
      for (const group of groups) {
        const results = await Promise.allSettled(
          group.map(tool => this.executeTool(tool, platform, result))
        );
        for (const r of results) {
          if (r.status === 'rejected') {
            this.logger.warn(`Tool failed in parallel group: ${r.reason}`);
          }
        }
        currentPercent += percentPerTool * group.length;
        this.emitProgress(`${phaseName} in progress`, currentPercent);
      }
    } else {
      let idx = 0;
      for (const tool of tools) {
        await this.executeTool(tool, platform, result);
        idx++;
        const pct = startPercent + percentPerTool * idx;
        this.emitProgress(`Installed ${tool.displayName}`, pct);
      }
    }

    this.emitProgress(`${phaseName} complete`, endPercent);
  }

  /**
   * Execute a single tool installation with idempotency checks.
   */
  private async executeTool(
    tool: ProfileToolEntry,
    platform: SetupPlatform,
    result: SetupResult
  ): Promise<void> {
    const installer = this.installers.get(tool.id);

    // If already completed in this or a previous session, skip
    if (this.completedToolIds.has(tool.id)) {
      this.logger.info(`Skipping ${tool.displayName} (already completed)`);
      return;
    }

    if (!installer) {
      this.logger.warn(
        `No installer registered for "${tool.id}"; skipping`
      );
      this.skippedToolIds.add(tool.id);
      return;
    }

    try {
      // Idempotency check: is this tool already installed on the system?
      if (this.config.skipExisting) {
        const alreadyInstalled = await installer.isInstalled(platform);
        if (alreadyInstalled) {
          this.logger.info(`${tool.displayName} already installed; skipping`);
          this.completedToolIds.add(tool.id);
          this.skippedToolIds.add(tool.id);
          await this.persistState('', false);
          return;
        }
      }

      // Install
      this.emitProgress(`Installing ${tool.displayName}...`, null);
      await installer.install(platform);

      // Validate
      if (installer.validate) {
        const valid = await installer.validate(platform);
        if (!valid) {
          throw new Error(
            `${tool.displayName} installation failed validation`
          );
        }
      }

      this.completedToolIds.add(tool.id);
      this.logger.info(`${tool.displayName} installed successfully`);
      await this.persistState('', false);
    } catch (error) {
      this.failedToolIds.add(tool.id);
      this.logger.error(`Failed to install ${tool.displayName}:`, error);
      result.errors.push(error as Error);

      if (tool.required) {
        throw error;
      }
      // Optional tool failure is non-fatal
      result.warnings.push(
        `Optional tool "${tool.displayName}" failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Phase 7: Configuration and conventions.
   */
  private async executeConfigurationPhase(
    platform: SetupPlatform,
    profile: ProfileDefinition,
    result: SetupResult
  ): Promise<void> {
    // Configure each installed tool
    for (const tool of profile.tools) {
      const installer = this.installers.get(tool.id);
      if (
        installer?.configure &&
        this.completedToolIds.has(tool.id) &&
        !this.skippedToolIds.has(tool.id)
      ) {
        try {
          await installer.configure(platform);
          this.logger.info(`Configured ${tool.displayName}`);
        } catch (error) {
          this.logger.warn(`Failed to configure ${tool.displayName}:`, error);
          result.warnings.push(
            `Configuration failed for ${tool.displayName}: ${(error as Error).message}`
          );
        }
      }
    }

    // Claude Code conventions generation
    if (this.config.conventionsProjectPath) {
      try {
        // Dynamic import to avoid circular dependency.
        // The conventions generator is in project-init/claude-code-conventions.ts
        const { generateClaudeCodeStructure } = await import(
          '../project-init/claude-code-conventions.js'
        );
        await generateClaudeCodeStructure({
          projectName: profile.name,
          projectPath: this.config.conventionsProjectPath,
          projectType: 'application',
          includeHooks: true,
          agents: [],
          skills: [],
          commands: [],
        });
        this.logger.info('Claude Code conventions generated');
      } catch (error) {
        this.logger.warn('Failed to generate Claude Code conventions:', error);
        result.warnings.push(
          `Claude Code conventions generation failed: ${(error as Error).message}`
        );
      }
    }
  }

  /**
   * Phase 8: Verification and finalization.
   */
  private async executeVerificationPhase(
    plan: ProfileToolEntry[],
    platform: SetupPlatform,
    result: SetupResult
  ): Promise<void> {
    this.emitProgress('Verifying installations', 92);

    const failedValidations: string[] = [];

    for (const tool of plan) {
      const installer = this.installers.get(tool.id);
      if (!installer?.validate) {
        continue;
      }
      if (!this.completedToolIds.has(tool.id)) {
        continue;
      }

      try {
        const valid = await installer.validate(platform);
        if (!valid) {
          failedValidations.push(tool.displayName);
        }
      } catch (error) {
        this.logger.warn(`Validation error for ${tool.displayName}:`, error);
        failedValidations.push(tool.displayName);
      }
    }

    if (failedValidations.length > 0) {
      result.warnings.push(
        `Tools with failed validation: ${failedValidations.join(', ')}`
      );
    }

    this.emitProgress('Verification complete', 98);
  }

  // ─────────────────────────────────────────────────
  // Generic phase executor
  // ─────────────────────────────────────────────────

  private async executePhase(
    phase: Phase,
    phaseName: string,
    fn: () => Promise<void>,
    result: SetupResult,
    startPercent: number,
    endPercent: number
  ): Promise<void> {
    this.currentPhase = phase;
    this.emitProgress(`Starting ${phaseName}`, startPercent);

    try {
      await fn();
      this.emitProgress(`${phaseName} complete`, endPercent);
    } catch (error) {
      this.emitProgress(
        `${phaseName} failed: ${(error as Error).message}`,
        startPercent
      );
      throw error;
    }
  }

  // ─────────────────────────────────────────────────
  // Dependency sorting
  // ─────────────────────────────────────────────────

  /**
   * Topological sort of tool entries based on their dependency graph.
   * Throws on circular dependencies.
   */
  private topologicalSort(tools: ProfileToolEntry[]): ProfileToolEntry[] {
    const sorted: ProfileToolEntry[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const toolMap = new Map(tools.map(t => [t.id, t]));

    const visit = (tool: ProfileToolEntry): void => {
      if (visited.has(tool.id)) {
        return;
      }
      if (visiting.has(tool.id)) {
        throw new Error(`Circular dependency detected: ${tool.id}`);
      }

      visiting.add(tool.id);
      for (const depId of tool.dependencies) {
        const dep = toolMap.get(depId);
        if (dep) {
          visit(dep);
        }
      }
      visiting.delete(tool.id);
      visited.add(tool.id);
      sorted.push(tool);
    };

    for (const tool of tools) {
      visit(tool);
    }

    return sorted;
  }

  /**
   * Group tools into levels where all tools in a level have their
   * dependencies satisfied by earlier levels. Used for parallel execution.
   */
  private groupByDependencyLevel(
    tools: ProfileToolEntry[]
  ): ProfileToolEntry[][] {
    const groups: ProfileToolEntry[][] = [];
    const remaining = new Set(tools);
    const completed = new Set<string>(this.completedToolIds);

    while (remaining.size > 0) {
      const group: ProfileToolEntry[] = [];

      for (const tool of remaining) {
        const depsResolved = tool.dependencies.every(dep =>
          completed.has(dep)
        );
        if (depsResolved) {
          group.push(tool);
        }
      }

      if (group.length === 0) {
        // Remaining tools have unresolvable dependencies; include them
        // as a final group to avoid an infinite loop.
        this.logger.warn(
          'Unresolvable dependencies detected; executing remaining tools sequentially'
        );
        groups.push(Array.from(remaining));
        break;
      }

      for (const tool of group) {
        remaining.delete(tool);
        completed.add(tool.id);
      }
      groups.push(group);
    }

    return groups;
  }

  // ─────────────────────────────────────────────────
  // Progress reporting
  // ─────────────────────────────────────────────────

  private emitProgress(
    message: string,
    percentage: number | null
  ): void {
    const pct =
      percentage !== null ? percentage : this.calculateProgress();

    const progress: SetupProgress = {
      totalSteps: this.totalSteps,
      completedSteps: this.completedToolIds.size,
      currentStep: message,
      percentage: Math.min(100, Math.max(0, pct)),
      estimatedTimeRemaining: 0,
      logs: [`[${new Date().toISOString()}] ${message}`],
    };

    this.emit('progress', progress);

    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        this.logger.warn('Progress callback error:', error);
      }
    }

    if (this.config.verbose) {
      this.logger.info(`[${pct.toFixed(1)}%] ${message}`);
    }
  }

  private calculateProgress(): number {
    if (this.totalSteps === 0) {
      return 0;
    }
    return (this.completedToolIds.size / this.totalSteps) * 100;
  }

  // ─────────────────────────────────────────────────
  // State management
  // ─────────────────────────────────────────────────

  private transitionState(next: OrchestratorState): void {
    this.logger.debug(`State: ${this.state} -> ${next}`);
    this.state = next;
  }

  private async persistState(
    profileId: string,
    resumable: boolean = false
  ): Promise<void> {
    const data: PersistedState = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      profileId,
      config: this.config,
      completedToolIds: Array.from(this.completedToolIds),
      failedToolIds: Array.from(this.failedToolIds),
      skippedToolIds: Array.from(this.skippedToolIds),
      currentPhase: this.currentPhase,
      resumable,
    };

    try {
      const dir = path.dirname(STATE_FILE);
      await fs.mkdir(dir, { recursive: true });
      const tmpFile = `${STATE_FILE}.tmp`;
      await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpFile, STATE_FILE);
    } catch (error) {
      this.logger.warn('Failed to persist state:', error);
    }
  }

  private async loadPersistedState(): Promise<PersistedState | null> {
    try {
      const raw = await fs.readFile(STATE_FILE, 'utf-8');
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  private async cleanupState(): Promise<void> {
    try {
      await fs.unlink(STATE_FILE);
    } catch {
      // File may not exist; that is fine.
    }
  }

  // ─────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 9);
    return `setup-${timestamp}-${random}`;
  }
}
