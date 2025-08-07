/**
 * Core environment management system
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { EnvironmentConfig, ProfileType, Platform, HealthCheckResult, SystemInfo } from '../types';
import { ProfileManager } from './profile-manager';
import { ToolManager } from './tool-manager';
import { detectPlatform, getSystemInfo } from '../utils/system';
import { createLogger } from '../utils/logger';

const logger = createLogger('EnvironmentManager');

export class EnvironmentManager {
  private config: EnvironmentConfig | null = null;
  private profileManager: ProfileManager;
  private toolManager: ToolManager;
  private configPath: string;

  constructor() {
    this.configPath = join(homedir(), '.wundr', 'environment.json');
    this.profileManager = new ProfileManager();
    this.toolManager = new ToolManager();
  }

  /**
   * Initialize a new environment configuration
   */
  async initialize(profile: ProfileType, options: {
    email?: string;
    fullName?: string;
    githubUsername?: string;
    company?: string;
    developmentPath?: string;
    skipPrompts?: boolean;
  } = {}): Promise<EnvironmentConfig> {
    logger.info('Initializing environment', { profile, options });

    const platform = await detectPlatform();
    const profileTemplate = await this.profileManager.getProfileTemplate(profile);
    
    const config: EnvironmentConfig = {
      profile,
      platform,
      tools: profileTemplate.tools,
      preferences: {
        email: options.email,
        fullName: options.fullName,
        githubUsername: options.githubUsername,
        company: options.company,
        editor: 'vscode',
        shell: platform === 'windows' ? 'powershell' : 'zsh',
        packageManager: 'pnpm',
        theme: 'dark',
        ...profileTemplate.preferences
      },
      paths: {
        home: homedir(),
        development: options.developmentPath || join(homedir(), 'Development'),
        config: join(homedir(), '.wundr'),
        cache: join(homedir(), '.wundr', 'cache'),
        logs: join(homedir(), '.wundr', 'logs')
      },
      version: '1.0.0'
    };

    this.config = config;
    await this.saveConfig();

    logger.info('Environment initialized successfully');
    return config;
  }

  /**
   * Load existing environment configuration
   */
  async loadConfig(): Promise<EnvironmentConfig | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      logger.info('Environment configuration loaded');
      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load configuration', error);
      }
      return null;
    }
  }

  /**
   * Save environment configuration
   */
  async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    await fs.mkdir(join(this.configPath, '..'), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    logger.info('Configuration saved');
  }

  /**
   * Install all tools for the current environment
   */
  async installEnvironment(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration loaded');
    }

    logger.info('Installing environment tools');

    // Create necessary directories
    await this.createDirectories();

    // Install tools in dependency order
    const sortedTools = this.toolManager.sortToolsByDependencies(this.config.tools);
    
    for (const tool of sortedTools) {
      if (this.toolManager.isToolSupported(tool, this.config.platform)) {
        await this.toolManager.installTool(tool);
      } else {
        logger.warn(`Tool ${tool.name} not supported on ${this.config.platform}`);
      }
    }

    logger.info('Environment installation completed');
  }

  /**
   * Validate the current environment
   */
  async validateEnvironment(): Promise<HealthCheckResult> {
    if (!this.config) {
      throw new Error('No configuration loaded');
    }

    logger.info('Validating environment');

    const systemInfo = await getSystemInfo();
    const toolValidations = await Promise.all(
      this.config.tools.map(tool => this.toolManager.validateTool(tool))
    );

    const healthy = toolValidations.every(result => result.valid);
    const recommendations: string[] = [];

    // Collect recommendations
    toolValidations.forEach(result => {
      if (result.suggestions) {
        recommendations.push(...result.suggestions);
      }
    });

    return {
      healthy,
      environment: this.config,
      tools: toolValidations,
      system: systemInfo,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  /**
   * Update environment configuration
   */
  async updateConfig(updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> {
    if (!this.config) {
      throw new Error('No configuration loaded');
    }

    this.config = {
      ...this.config,
      ...updates,
      preferences: {
        ...this.config.preferences,
        ...(updates.preferences || {})
      },
      paths: {
        ...this.config.paths,
        ...(updates.paths || {})
      }
    };

    await this.saveConfig();
    logger.info('Configuration updated');
    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig | null {
    return this.config;
  }

  /**
   * Create necessary directories
   */
  private async createDirectories(): Promise<void> {
    if (!this.config) return;

    const directories = Object.values(this.config.paths);
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
  }
}