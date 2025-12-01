/**
 * Computer Setup Manager
 * Orchestrates the complete setup process for new developer machines
 */

import { EventEmitter } from 'events';
import * as path from 'path';

import { WundrConfigManager } from '@wundr.io/config';
import * as fs from 'fs-extra';

import { ConfiguratorService } from '../configurators';
import { InstallerRegistry } from '../installers';
import { ProfileManager } from '../profiles';
import { getLogger } from '../utils/logger';
import { SetupValidator } from '../validators';

import type {
  DeveloperProfile,
  SetupOptions,
  SetupReport,
  SetupResult,
  SetupStep,
  SetupProgress,
  SetupPlatform,
} from '../types';

/**
 * Configuration structure for profile-specific tools
 * Note: This extends DeveloperProfile.tools with simplified boolean flags
 */
interface ProfileToolsConfig {
  languages: Record<string, boolean>;
  packageManagers: Record<string, boolean>;
  git: { enabled: boolean };
  containers: {
    docker: boolean;
    dockerCompose: boolean;
    kubernetes?: boolean;
    podman?: boolean;
  };
  cloudCLIs: Record<string, boolean>;
  databases: Record<string, boolean>;
  monitoring: Record<string, boolean>;
  communication: {
    slack?: boolean;
    teams?: boolean;
    discord?: boolean;
    zoom?: boolean;
  };
  frameworks?: Record<string, boolean>;
}

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
    logs: [],
  };

  constructor(_configPath?: string) {
    super();
    this.configManager = new WundrConfigManager({});
    this.profileManager = new ProfileManager(this.configManager);
    const platform: SetupPlatform = {
      os:
        process.platform === 'win32'
          ? 'win32'
          : process.platform === 'darwin'
            ? 'darwin'
            : 'linux',
      arch: process.arch as 'x64' | 'arm64',
      node: process.version,
      shell: process.env.SHELL || 'bash',
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
   * Get a profile by name
   */
  async getProfile(profileName: string): Promise<DeveloperProfile> {
    // Try to get the profile from the ProfileManager first
    const profile = await this.profileManager.getProfile(profileName);

    if (profile) {
      return profile;
    }

    // If not found, create a default one based on the name
    const normalizedName = profileName.toLowerCase().replace(/\s+/g, '');

    // Map common profile names to full names
    const profileMap: Record<string, string> = {
      frontend: 'Frontend Developer',
      backend: 'Backend Developer',
      fullstack: 'Full Stack Developer',
      fullstackdeveloper: 'Full Stack Developer',
      devops: 'DevOps Engineer',
      ml: 'Machine Learning Engineer',
      mobile: 'Mobile Developer',
    };

    const fullProfileName = profileMap[normalizedName] || profileName;

    // Return a default profile based on the name
    // Use unknown cast to handle simplified ProfileToolsConfig -> DeveloperProfile.tools type conversion
    return {
      id: normalizedName,
      name: fullProfileName,
      role: normalizedName,
      email: '',
      preferences: {
        shell: 'zsh',
        editor: 'vscode',
        theme: 'auto',
        gitConfig: {
          userName: '',
          userEmail: '',
          signCommits: true,
          defaultBranch: 'main',
          aliases: {},
        },
        aiTools: {
          claudeCode: true,
          claudeFlow: true,
          mcpTools: ['all'],
          swarmAgents: ['default'],
          memoryAllocation: '2GB',
        },
      },
      tools: this.getToolsForProfile(
        normalizedName
      ) as unknown as DeveloperProfile['tools'],
      createdAt: new Date(),
    } as DeveloperProfile;
  }

  /**
   * Get the default profile
   */
  async getDefaultProfile(): Promise<DeveloperProfile> {
    // First try to get from ProfileManager
    const defaultProfile = this.profileManager.getDefaultProfile();
    if (defaultProfile) {
      return defaultProfile;
    }
    // Fallback to getting fullstack profile
    return this.getProfile('fullstack');
  }

  /**
   * Get tools configuration for a profile
   */
  private getToolsForProfile(profile: string): ProfileToolsConfig {
    const baseTools = {
      languages: { node: true, typescript: true, python: false },
      packageManagers: {
        npm: true,
        pnpm: true,
        yarn: false,
        brew: process.platform === 'darwin',
      },
      git: { enabled: true },
      containers: { docker: true, dockerCompose: true, kubernetes: false },
      cloudCLIs: { aws: false, gcloud: false, azure: false },
      databases: { postgresql: false, redis: false, mongodb: false },
      monitoring: { datadog: false, newRelic: false, sentry: false },
      communication: { slack: false },
    };

    switch (profile) {
      case 'frontend':
        return {
          ...baseTools,
          languages: { ...baseTools.languages, javascript: true },
          frameworks: { react: true, vue: true, nextjs: true },
        };
      case 'backend':
        return {
          ...baseTools,
          languages: { ...baseTools.languages, python: true },
          databases: { ...baseTools.databases, postgresql: true, redis: true },
        };
      case 'fullstack':
      case 'fullstackdeveloper':
        return {
          ...baseTools,
          languages: { ...baseTools.languages, javascript: true, python: true },
          containers: {
            ...baseTools.containers,
            docker: true,
            dockerCompose: true,
          },
          frameworks: { react: true, nextjs: true },
          databases: { ...baseTools.databases, postgresql: true, redis: true },
        };
      case 'devops':
        return {
          ...baseTools,
          containers: { ...baseTools.containers, kubernetes: true },
          cloudCLIs: { ...baseTools.cloudCLIs, aws: true, gcloud: true },
        };
      default:
        return baseTools;
    }
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
      duration: 0,
    };

    try {
      logger.info('Starting computer setup', {
        profile: options.profile.name,
        platform: options.platform.os,
        mode: options.mode,
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
        failed: result.failedSteps.length,
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
      throw new Error(
        `Platform ${platform.os} ${platform.arch} is not supported`
      );
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
    steps.push(
      ...(await this.installerRegistry.getSystemSteps(options.platform))
    );

    // Development tools
    if (profile.tools?.languages?.node) {
      steps.push(
        ...(await this.installerRegistry.getNodeSteps(
          profile.tools.languages.node
        ))
      );
    }
    if (profile.tools?.languages?.python) {
      steps.push(
        ...(await this.installerRegistry.getPythonSteps(
          profile.tools.languages.python
        ))
      );
    }

    // Package managers
    if (
      profile.tools?.packageManagers?.brew &&
      options.platform.os === 'darwin'
    ) {
      steps.push(...(await this.installerRegistry.getBrewSteps()));
    }

    // Container tools
    if (profile.tools?.containers?.docker) {
      steps.push(...(await this.installerRegistry.getDockerSteps()));
    }

    // AI tools
    if (profile.preferences?.aiTools?.claudeCode) {
      steps.push(...(await this.installerRegistry.getClaudeCodeSteps()));
    }
    if (profile.preferences?.aiTools?.claudeFlow) {
      steps.push(
        ...(await this.installerRegistry.getClaudeFlowSteps(
          profile.preferences.aiTools.swarmAgents || []
        ))
      );
    }

    // Communication tools
    if (profile.tools?.communication?.slack) {
      steps.push(...(await this.installerRegistry.getSlackSteps()));
    }

    // Git configuration
    if (profile.preferences?.gitConfig) {
      steps.push(
        ...(await this.configuratorService.getGitConfigSteps(
          profile.preferences.gitConfig
        ))
      );
    }

    // Editor setup
    if (profile.preferences?.editor) {
      steps.push(
        ...(await this.configuratorService.getEditorSteps(
          profile.preferences?.editor
        ))
      );
    }

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
      if (visited.has(step.id)) {
        return;
      }
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
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
   * Run pre-flight checks
   */
  private async runPreflightChecks(options: SetupOptions): Promise<void> {
    logger.info('Running pre-flight checks');

    // Check disk space
    const hasSpace = await this.validator.checkDiskSpace(
      10 * 1024 * 1024 * 1024
    ); // 10GB
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
  private async executeStep(
    step: SetupStep,
    options: SetupOptions
  ): Promise<void> {
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
  private async runPostSetup(
    profile: DeveloperProfile,
    _options: SetupOptions
  ): Promise<void> {
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
    if (profile.preferences?.editor === 'vscode') {
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
  ): Promise<SetupReport> {
    const report = {
      timestamp: new Date(),
      profile: profile,
      platform: options.platform,
      installedTools: await this.validator.getInstalledTools(),
      configurations: await this.configuratorService.getConfigurationChanges(),
      credentials: await this.validator.getCredentialSetups(),
      nextSteps: this.generateNextSteps(profile, result),
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
  private generateNextSteps(
    profile: DeveloperProfile,
    result: SetupResult
  ): string[] {
    const steps: string[] = [];

    steps.push('1. Restart your terminal to apply shell configurations');
    steps.push('2. Run "wundr doctor" to verify installation');

    if (profile.preferences.gitConfig.sshKey) {
      steps.push('3. Add your SSH key to GitHub/GitLab');
    }

    if (profile.tools?.communication?.slack) {
      steps.push('4. Sign in to Slack workspaces');
    }

    if (result.failedSteps.length > 0) {
      steps.push(
        '5. Review failed steps and run "wundr setup --retry" to complete'
      );
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
