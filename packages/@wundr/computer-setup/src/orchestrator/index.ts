/**
 * Setup Orchestrator
 * Coordinates the entire computer setup process
 */

import { EventEmitter } from 'events';

import { getLogger } from '../utils/logger';

import type { ConfiguratorService } from '../configurators';
import type { InstallerRegistry } from '../installers';
import type { ProfileManager } from '../profiles';
import type {
  DeveloperProfile,
  SetupOptions,
  SetupResult,
  SetupStep,
  SetupProgress} from '../types';
import type { SetupValidator } from '../validators';

/**
 * Setup report structure returned by generateSetupReport
 */
interface SetupReport {
  timestamp: Date;
  profile: DeveloperProfile;
  platform: SetupOptions['platform'];
  result: {
    success: boolean;
    completed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  installedTools: Awaited<ReturnType<SetupValidator['getInstalledTools']>>;
  configurations: ReturnType<ConfiguratorService['getConfigurationChanges']>;
  credentials: Awaited<ReturnType<SetupValidator['getCredentialSetups']>>;
  warnings: string[];
  errors: string[];
  nextSteps: string[];
}

// Real event bus implementation - production ready
class EventBus extends EventEmitter {
  private static instance: EventBus;
  private busLogger = getLogger('computer-setup:eventbus');

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  override emit(event: string, data?: unknown): boolean {
    if (process.env.LOG_LEVEL === 'debug') {
      this.busLogger.debug(`[EVENT] ${event}`, data ? JSON.stringify(data) : '');
    }
    return super.emit(event, data);
  }

  override on(event: string, handler: (...args: unknown[]) => void): this {
    return super.on(event, handler);
  }

  override once(event: string, handler: (...args: unknown[]) => void): this {
    return super.once(event, handler);
  }

  override off(event: string, handler: (...args: unknown[]) => void): this {
    return super.off(event, handler);
  }
}

const logger = getLogger('computer-setup:orchestrator');
const eventBus = EventBus.getInstance();

export class SetupOrchestrator extends EventEmitter {
  private profileManager: ProfileManager;
  private installerRegistry: InstallerRegistry;
  private configuratorService: ConfiguratorService;
  private validator: SetupValidator;
  private progress: SetupProgress;
  private activeSteps: Map<string, SetupStep> = new Map();
  private completedSteps: Set<string> = new Set();
  private failedSteps: Set<string> = new Set();

  constructor(
    profileManager: ProfileManager,
    installerRegistry: InstallerRegistry,
    configuratorService: ConfiguratorService,
    validator: SetupValidator,
  ) {
    super();
    this.profileManager = profileManager;
    this.installerRegistry = installerRegistry;
    this.configuratorService = configuratorService;
    this.validator = validator;
    this.progress = this.initializeProgress();
  }

  /**
   * Initialize progress tracking
   */
  private initializeProgress(): SetupProgress {
    return {
      totalSteps: 0,
      completedSteps: 0,
      currentStep: '',
      percentage: 0,
      estimatedTimeRemaining: 0,
      logs: [],
    };
  }

  /**
   * Orchestrate the complete setup process
   */
  async orchestrate(options: SetupOptions): Promise<SetupResult> {
    const startTime = Date.now();
    
    logger.info('Starting setup orchestration', {
      profile: options.profile.name,
      platform: options.platform.os,
      mode: options.mode,
    });

    // Emit setup started event
    eventBus.emit('setup:started', { options });

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
      // Phase 1: Validation
      await this.validatePhase(options, result);

      // Phase 2: Preparation
      await this.preparationPhase(options, result);

      // Phase 3: Installation
      await this.installationPhase(options, result);

      // Phase 4: Configuration
      await this.configurationPhase(options, result);

      // Phase 5: Verification
      await this.verificationPhase(options, result);

      // Phase 6: Finalization
      await this.finalizationPhase(options, result);

      result.success = result.failedSteps.length === 0;

    } catch (error) {
      logger.error('Setup orchestration failed', error);
      result.errors.push(error as Error);
    } finally {
      result.duration = Date.now() - startTime;
      
      // Emit setup completed event
      eventBus.emit('setup:completed', { result });
    }

    return result;
  }

  /**
   * Phase 1: Validation
   */
  private async validatePhase(options: SetupOptions, result: SetupResult): Promise<void> {
    logger.info('Phase 1: Validation');
    this.updateProgress('Validating system requirements', 0);

    // Validate platform
    const platformValid = await this.validator.validatePlatform(options.platform);
    if (!platformValid) {
      throw new Error('Platform validation failed');
    }

    // Check disk space
    const hasSpace = await this.validator.checkDiskSpace(10 * 1024 * 1024 * 1024);
    if (!hasSpace) {
      result.warnings.push('Low disk space detected');
    }

    // Check network
    const hasNetwork = await this.validator.checkNetworkConnectivity();
    if (!hasNetwork && !options.dryRun) {
      throw new Error('No network connectivity');
    }

    this.updateProgress('Validation complete', 10);
  }

  /**
   * Phase 2: Preparation
   */
  private async preparationPhase(options: SetupOptions, _result: SetupResult): Promise<void> {
    logger.info('Phase 2: Preparation');
    this.updateProgress('Preparing installation', 15);

    // Load profile
    const profile = await this.profileManager.loadProfile(options.profile);

    // Generate installation steps
    const steps = await this.generateInstallationPlan(profile, options);
    this.activeSteps = new Map(steps.map(s => [s.id, s]));
    this.progress.totalSteps = steps.length;

    // Apply team configuration if specified
    if (profile.team) {
      await this.applyTeamConfiguration(profile.team);
    }

    this.updateProgress('Preparation complete', 20);
  }

  /**
   * Phase 3: Installation
   */
  private async installationPhase(options: SetupOptions, result: SetupResult): Promise<void> {
    logger.info('Phase 3: Installation');
    this.updateProgress('Installing tools', 25);

    const steps = Array.from(this.activeSteps.values());
    const installSteps = steps.filter(s => s.category === 'system' || s.category === 'development');

    if (options.parallel) {
      await this.executeParallel(installSteps, options, result);
    } else {
      await this.executeSequential(installSteps, options, result);
    }

    this.updateProgress('Installation complete', 60);
  }

  /**
   * Phase 4: Configuration
   */
  private async configurationPhase(options: SetupOptions, result: SetupResult): Promise<void> {
    logger.info('Phase 4: Configuration');
    this.updateProgress('Configuring tools', 65);

    const steps = Array.from(this.activeSteps.values());
    const configSteps = steps.filter(s => s.category === 'configuration');

    await this.executeSequential(configSteps, options, result);

    // Generate shell configuration
    await this.configuratorService.generateShellConfig(options.profile);

    this.updateProgress('Configuration complete', 80);
  }

  /**
   * Phase 5: Verification
   */
  private async verificationPhase(options: SetupOptions, result: SetupResult): Promise<void> {
    logger.info('Phase 5: Verification');
    this.updateProgress('Verifying setup', 85);

    if (!options.dryRun) {
      const isValid = await this.validator.validateFullSetup(options.profile);
      if (!isValid) {
        result.warnings.push('Some tools failed validation');
      }
    }

    this.updateProgress('Verification complete', 95);
  }

  /**
   * Phase 6: Finalization
   */
  private async finalizationPhase(options: SetupOptions, result: SetupResult): Promise<void> {
    logger.info('Phase 6: Finalization');
    this.updateProgress('Finalizing setup', 98);

    // Save profile
    await this.profileManager.saveProfile(options.profile);

    // Generate report
    if (options.generateReport) {
      result.report = await this.generateSetupReport(options, result);
    }

    // Cleanup temporary files
    await this.cleanup();

    this.updateProgress('Setup complete', 100);
  }

  /**
   * Generate installation plan
   */
  private async generateInstallationPlan(
    profile: DeveloperProfile,
    options: SetupOptions,
  ): Promise<SetupStep[]> {
    const steps: SetupStep[] = [];

    // Get platform-specific steps
    steps.push(...await this.installerRegistry.getSystemSteps(options.platform));

    // Get tool installation steps
    if (profile.tools?.languages?.node) {
      steps.push(...await this.installerRegistry.getNodeSteps(profile.tools.languages.node));
    }

    if (profile.tools?.languages?.python) {
      steps.push(...await this.installerRegistry.getPythonSteps(profile.tools.languages.python));
    }

    if (profile.tools?.containers?.docker) {
      steps.push(...await this.installerRegistry.getDockerSteps());
    }

    // Get configuration steps
    steps.push(...await this.configuratorService.getGitConfigSteps(profile.preferences.gitConfig));
    steps.push(...await this.configuratorService.getEditorSteps(profile.preferences?.editor || 'vscode'));

    // Sort by dependencies
    return this.sortByDependencies(steps);
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallel(
    steps: SetupStep[],
    options: SetupOptions,
    result: SetupResult,
  ): Promise<void> {
    // Group steps by dependencies
    const groups = this.groupByDependencies(steps);

    for (const group of groups) {
      const promises = group.map(step => this.executeStep(step, options, result));
      await Promise.allSettled(promises);
    }
  }

  /**
   * Execute steps sequentially
   */
  private async executeSequential(
    steps: SetupStep[],
    options: SetupOptions,
    result: SetupResult,
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, options, result);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: SetupStep,
    options: SetupOptions,
    result: SetupResult,
  ): Promise<void> {
    try {
      this.updateProgress(`Executing: ${step.name}`, null);
      logger.info(`Executing step: ${step.name}`);

      if (options.dryRun) {
        logger.info(`[DRY RUN] Would execute: ${step.name}`);
        result.completedSteps.push(step.id);
        return;
      }

      // Check if already completed
      if (this.completedSteps.has(step.id)) {
        logger.info(`Step already completed: ${step.name}`);
        return;
      }

      // Validate prerequisites
      if (step.validator) {
        const isValid = await step.validator();
        if (isValid && options.skipExisting) {
          logger.info(`Skipping existing: ${step.name}`);
          result.skippedSteps.push(step.id);
          return;
        }
      }

      // Execute installation
      await step.installer();
      
      this.completedSteps.add(step.id);
      result.completedSteps.push(step.id);
      
      logger.info(`Step completed: ${step.name}`);
      eventBus.emit('step:completed', { step });

    } catch (error) {
      logger.error(`Step failed: ${step.name}`, error);
      
      this.failedSteps.add(step.id);
      result.failedSteps.push(step.id);
      result.errors.push(error as Error);
      
      eventBus.emit('step:failed', { step, error });

      // Attempt rollback
      if (step.rollback) {
        try {
          await step.rollback();
          logger.info(`Rollback successful: ${step.name}`);
        } catch (rollbackError) {
          logger.error(`Rollback failed: ${step.name}`, rollbackError);
        }
      }

      if (step.required) {
        throw error;
      }
    }
  }

  /**
   * Sort steps by dependencies
   */
  private sortByDependencies(steps: SetupStep[]): SetupStep[] {
    const sorted: SetupStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: SetupStep) => {
      if (visited.has(step.id)) {
return;
}
      if (visiting.has(step.id)) {
        logger.warn(`Circular dependency detected: ${step.id}`);
        return;
      }

      visiting.add(step.id);

      for (const depId of step.dependencies) {
        const dep = steps.find(s => s.id === depId);
        if (dep) {
visit(dep);
}
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  /**
   * Group steps by dependency levels
   */
  private groupByDependencies(steps: SetupStep[]): SetupStep[][] {
    const groups: SetupStep[][] = [];
    const remaining = new Set(steps);
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const group: SetupStep[] = [];

      for (const step of remaining) {
        const depsResolved = step.dependencies.every(dep => completed.has(dep));
        if (depsResolved) {
          group.push(step);
        }
      }

      if (group.length === 0) {
        // Circular dependency or unresolved dependencies
        logger.warn('Could not resolve dependencies for remaining steps');
        groups.push(Array.from(remaining));
        break;
      }

      for (const step of group) {
        remaining.delete(step);
        completed.add(step.id);
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Apply team configuration
   */
  private async applyTeamConfiguration(team: string): Promise<void> {
    logger.info(`Applying team configuration: ${team}`);
    
    // This would fetch and apply team-specific settings
    // For now, we'll just log it
    eventBus.emit('team:config:applied', { team });
  }

  /**
   * Generate setup report
   */
  private async generateSetupReport(
    options: SetupOptions,
    result: SetupResult,
  ): Promise<SetupReport> {
    const report = {
      timestamp: new Date(),
      profile: options.profile,
      platform: options.platform,
      result: {
        success: result.success,
        completed: result.completedSteps.length,
        failed: result.failedSteps.length,
        skipped: result.skippedSteps.length,
        duration: result.duration,
      },
      installedTools: await this.validator.getInstalledTools(),
      configurations: this.configuratorService.getConfigurationChanges(),
      credentials: await this.validator.getCredentialSetups(),
      warnings: result.warnings,
      errors: result.errors.map(e => e.message),
      nextSteps: this.generateNextSteps(options.profile, result),
    };

    eventBus.emit('report:generated', { report });
    return report;
  }

  /**
   * Update progress
   */
  private updateProgress(step: string, percentage: number | null): void {
    this.progress.currentStep = step;
    
    if (percentage !== null) {
      this.progress.percentage = percentage;
    }

    this.progress.logs.push(`[${new Date().toISOString()}] ${step}`);
    
    this.emit('progress', this.progress);
    eventBus.emit('progress:updated', this.progress);
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up temporary files');
    // Cleanup implementation
  }

  /**
   * Get current progress
   */
  getProgress(): SetupProgress {
    return this.progress;
  }

  /**
   * Cancel setup
   */
  async cancel(): Promise<void> {
    logger.info('Cancelling setup');
    eventBus.emit('setup:cancelled');

    // Rollback any in-progress steps
    for (const [id, step] of this.activeSteps) {
      if (!this.completedSteps.has(id) && !this.failedSteps.has(id)) {
        if (step.rollback) {
          try {
            await step.rollback();
          } catch (error) {
            logger.error(`Rollback failed for ${step.name}`, error);
          }
        }
      }
    }
  }

  /**
   * Generate next steps for the user
   */
  private generateNextSteps(profile: DeveloperProfile, result: SetupResult): string[] {
    const steps: string[] = [];

    steps.push('1. Restart your terminal to apply shell configurations');
    steps.push('2. Run "wundr doctor" to verify installation');

    if (profile.preferences?.gitConfig?.sshKey) {
      steps.push('3. Add your SSH key to GitHub/GitLab');
    }

    if (profile.tools?.communication?.slack) {
      steps.push('4. Sign in to Slack workspaces');
    }

    if (result.failedSteps.length > 0) {
      steps.push('5. Review failed steps and run "wundr setup --retry" to complete');
    }

    steps.push('6. Review team onboarding documentation');
    steps.push('7. Clone and set up your first project');

    return steps;
  }
}