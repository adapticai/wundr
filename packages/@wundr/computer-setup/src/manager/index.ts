/**
 * Computer Setup Manager
 * Orchestrates the complete setup process for new developer machines
 */

import { EventEmitter } from 'events';
// import { getLogger } from '@wundr/core'; // TODO: Fix core exports
const getLogger = (name: string) => ({
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  debug: (...args: any[]) => console.debug(...args)
});
import { WundrConfigManager } from '@wundr.io/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  DeveloperProfile, 
  SetupOptions, 
  SetupResult, 
  SetupStep,
  SetupProgress,
  SetupPlatform 
} from '../types';
import { ProfileManager } from '../profiles';
import { InstallerRegistry } from '../installers';
import { ConfiguratorService } from '../configurators';
import { SetupValidator } from '../validators';

const logger = getLogger('computer-setup');

export class ComputerSetupManager extends EventEmitter {
  private profileManager: ProfileManager;
  private installerRegistry: InstallerRegistry;
  private configuratorService: ConfiguratorService;
  private validator: SetupValidator;
  private configManager: WundrConfigManager;
  private steps: SetupStep[] = [];
  private progress: SetupProgress = {
    totalSteps: 0,
    completedSteps: 0,
    currentStep: '',
    percentage: 0,
    estimatedTimeRemaining: 0,
    logs: []
  };

  constructor(configPath?: string) {
    super();
    this.configManager = new WundrConfigManager({});
    this.profileManager = new ProfileManager(this.configManager);
    const platform: SetupPlatform = {
      os: process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux',
      arch: process.arch as 'x64' | 'arm64',
      node: process.version,
      shell: process.env.SHELL || 'bash'
    };
    this.installerRegistry = new InstallerRegistry(platform);
    this.configuratorService = new ConfiguratorService();
    this.validator = new SetupValidator();
  }

  /**
   * Initialize the setup manager
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Computer Setup Manager');
    
    await this.configManager.initialize();
    // Auto-discovery handled in constructor
    await this.configuratorService.initialize();
    
    logger.info('Computer Setup Manager initialized');
  }

  /**
   * Run the complete setup process
   */
  async setup(options: SetupOptions): Promise<SetupResult> {
    const startTime = Date.now();
    const result: SetupResult = {
      success: false,
      completedSteps: [],
      failedSteps: [],
      skippedSteps: [],
      warnings: [],
      errors: [],
      duration: 0
    };

    try {
      logger.info('Starting computer setup', { 
        profile: options.profile.name,
        platform: options.platform.os,
        mode: options.mode 
      });

      // Validate platform compatibility
      await this.validatePlatform(options.platform);

      // Load or create profile
      const profile = await this.profileManager.loadProfile(options.profile);
      
      // Generate setup steps based on profile
      this.steps = await this.generateSetupSteps(profile, options);
      this.progress.totalSteps = this.steps.length;

      // Pre-flight checks
      if (!options.skipExisting) {
        await this.runPreflightChecks(options);
      }

      // Execute setup steps
      for (const step of this.steps) {
        this.progress.currentStep = step.name;
        this.emit('progress', this.progress);

        try {
          if (options.dryRun) {
            logger.info(`[DRY RUN] Would execute: ${step.name}`);
            result.completedSteps.push(step.id);
          } else {
            await this.executeStep(step, options);
            result.completedSteps.push(step.id);
          }
          
          this.progress.completedSteps++;
          this.progress.percentage = Math.round(
            (this.progress.completedSteps / this.progress.totalSteps) * 100
          );
        } catch (error) {
          logger.error(`Failed to execute step: ${step.name}`, error);
          result.failedSteps.push(step.id);
          result.errors.push(error as Error);
          
          if (step.required) {
            throw error;
          }
        }
      }

      // Post-setup configuration
      await this.runPostSetup(profile, options);

      // Generate report
      if (options.generateReport) {
        result.report = await this.generateReport(profile, options, result);
      }

      result.success = result.failedSteps.length === 0;
      logger.info('Computer setup completed', { 
        success: result.success,
        completed: result.completedSteps.length,
        failed: result.failedSteps.length 
      });

    } catch (error) {
      logger.error('Computer setup failed', error);
      result.errors.push(error as Error);
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validate platform compatibility
   */
  private async validatePlatform(platform: SetupPlatform): Promise<void> {
    const isValid = await this.validator.validatePlatform(platform);
    if (!isValid) {
      throw new Error(`Platform ${platform.os} ${platform.arch} is not supported`);
    }
  }

  /**
   * Generate setup steps based on profile
   */
  private async generateSetupSteps(
    profile: DeveloperProfile, 
    options: SetupOptions
  ): Promise<SetupStep[]> {
    const steps: SetupStep[] = [];

    // System prerequisites
    steps.push(...await this.installerRegistry.getSystemSteps(options.platform));

    // Development tools
    if (profile.tools.languages.node) {
      steps.push(...await this.installerRegistry.getNodeSteps(profile.tools.languages.node));
    }
    if (profile.tools.languages.python) {
      steps.push(...await this.installerRegistry.getPythonSteps(profile.tools.languages.python));
    }

    // Package managers
    if (profile.tools.packageManagers.brew && options.platform.os === 'darwin') {
      steps.push(...await this.installerRegistry.getBrewSteps());
    }

    // Container tools
    if (profile.tools.containers.docker) {
      steps.push(...await this.installerRegistry.getDockerSteps());
    }

    // AI tools
    if (profile.preferences.aiTools.claudeCode) {
      steps.push(...await this.installerRegistry.getClaudeCodeSteps());
    }
    if (profile.preferences.aiTools.claudeFlow) {
      steps.push(...await this.installerRegistry.getClaudeFlowSteps(
        profile.preferences.aiTools.swarmAgents
      ));
    }

    // Communication tools
    if (profile.tools.communication.slack) {
      steps.push(...await this.installerRegistry.getSlackSteps());
    }

    // Git configuration
    steps.push(...await this.configuratorService.getGitConfigSteps(
      profile.preferences.gitConfig
    ));

    // Editor setup
    steps.push(...await this.configuratorService.getEditorSteps(
      profile.preferences.editor
    ));

    // Sort steps by dependencies
    return this.sortStepsByDependencies(steps);
  }

  /**
   * Sort steps based on their dependencies
   */
  private sortStepsByDependencies(steps: SetupStep[]): SetupStep[] {
    const sorted: SetupStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: SetupStep) => {
      if (visited.has(step.id)) return;
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
      }

      visiting.add(step.id);

      for (const depId of step.dependencies) {
        const dep = steps.find(s => s.id === depId);
        if (dep) visit(dep);
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
   * Run pre-flight checks
   */
  private async runPreflightChecks(options: SetupOptions): Promise<void> {
    logger.info('Running pre-flight checks');
    
    // Check disk space
    const hasSpace = await this.validator.checkDiskSpace(10 * 1024 * 1024 * 1024); // 10GB
    if (!hasSpace) {
      throw new Error('Insufficient disk space. At least 10GB required.');
    }

    // Check network connectivity
    const hasNetwork = await this.validator.checkNetworkConnectivity();
    if (!hasNetwork) {
      throw new Error('No network connectivity detected');
    }

    // Check admin privileges if needed
    if (options.platform.os === 'darwin' || options.platform.os === 'linux') {
      const hasPrivileges = await this.validator.checkAdminPrivileges();
      if (!hasPrivileges) {
        logger.warn('Some installations may require sudo privileges');
      }
    }
  }

  /**
   * Execute a single setup step
   */
  private async executeStep(step: SetupStep, options: SetupOptions): Promise<void> {
    logger.info(`Executing step: ${step.name}`);
    this.progress.logs.push(`Starting: ${step.name}`);

    // Validate prerequisites
    if (step.validator) {
      const isValid = await step.validator();
      if (!isValid && options.skipExisting) {
        logger.info(`Skipping ${step.name} - already configured`);
        return;
      }
    }

    // Execute installation
    try {
      await step.installer();
      this.progress.logs.push(`Completed: ${step.name}`);
      logger.info(`Step completed: ${step.name}`);
    } catch (error) {
      this.progress.logs.push(`Failed: ${step.name} - ${error}`);
      
      // Attempt rollback if available
      if (step.rollback) {
        logger.info(`Attempting rollback for: ${step.name}`);
        try {
          await step.rollback();
          this.progress.logs.push(`Rolled back: ${step.name}`);
        } catch (rollbackError) {
          logger.error(`Rollback failed for ${step.name}`, rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Run post-setup tasks
   */
  private async runPostSetup(profile: DeveloperProfile, options: SetupOptions): Promise<void> {
    logger.info('Running post-setup tasks');

    // Save profile for future use
    await this.profileManager.saveProfile(profile);

    // Generate shell aliases and functions
    await this.configuratorService.generateShellConfig(profile);

    // Clone team repositories
    if (profile.team) {
      await this.configuratorService.cloneTeamRepos(profile.team);
    }

    // Install VS Code extensions
    if (profile.preferences.editor === 'vscode') {
      await this.configuratorService.installVSCodeExtensions();
    }

    // Configure AI agents
    if (profile.preferences.aiTools.claudeFlow) {
      await this.configuratorService.configureClaudeFlow(
        profile.preferences.aiTools
      );
    }

    logger.info('Post-setup tasks completed');
  }

  /**
   * Generate setup report
   */
  private async generateReport(
    profile: DeveloperProfile,
    options: SetupOptions,
    result: SetupResult
  ): Promise<any> {
    const report = {
      timestamp: new Date(),
      profile: profile,
      platform: options.platform,
      installedTools: await this.validator.getInstalledTools(),
      configurations: await this.configuratorService.getConfigurationChanges(),
      credentials: await this.validator.getCredentialSetups(),
      nextSteps: this.generateNextSteps(profile, result)
    };

    // Save report to file
    const reportPath = path.join(
      process.env.HOME || '',
      '.wundr',
      'setup-reports',
      `setup-${Date.now()}.json`
    );
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, report, { spaces: 2 });

    logger.info(`Setup report saved to: ${reportPath}`);
    return report;
  }

  /**
   * Generate next steps for the user
   */
  private generateNextSteps(profile: DeveloperProfile, result: SetupResult): string[] {
    const steps: string[] = [];

    steps.push('1. Restart your terminal to apply shell configurations');
    steps.push('2. Run "wundr doctor" to verify installation');
    
    if (profile.preferences.gitConfig.sshKey) {
      steps.push('3. Add your SSH key to GitHub/GitLab');
    }
    
    if (profile.tools.communication.slack) {
      steps.push('4. Sign in to Slack workspaces');
    }
    
    if (result.failedSteps.length > 0) {
      steps.push(`5. Review failed steps and run "wundr setup --retry" to complete`);
    }

    steps.push('6. Review team onboarding documentation');
    steps.push('7. Clone and set up your first project');

    return steps;
  }

  /**
   * Get available profiles
   */
  async getAvailableProfiles(): Promise<DeveloperProfile[]> {
    return this.profileManager.listProfiles();
  }

  /**
   * Create a new profile interactively
   */
  async createProfile(): Promise<DeveloperProfile> {
    return this.profileManager.createInteractiveProfile();
  }

  /**
   * Validate current setup
   */
  async validateSetup(profile: DeveloperProfile): Promise<boolean> {
    return this.validator.validateFullSetup(profile);
  }

  /**
   * Get setup progress
   */
  getProgress(): SetupProgress {
    return this.progress;
  }
}