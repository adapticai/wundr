import os from 'os';
import path from 'path';

import fs from 'fs-extra';
import { z } from 'zod';

import { errorHandler } from './error-handler';
import { logger } from './logger';

import type { WundrConfig } from '../types';

// Zod schema for configuration validation
const WundrConfigSchema = z.object({
  version: z.string(),
  defaultMode: z.enum(['cli', 'interactive', 'chat', 'tui']).default('cli'),
  plugins: z.array(z.string()).default([]),
  integrations: z
    .object({
      github: z
        .object({
          token: z.string(),
          owner: z.string(),
          repo: z.string(),
          webhooks: z.boolean().optional(),
        })
        .optional(),
      slack: z
        .object({
          token: z.string(),
          channel: z.string(),
          webhooks: z.boolean().optional(),
        })
        .optional(),
      jira: z
        .object({
          url: z.string(),
          email: z.string(),
          token: z.string(),
        })
        .optional(),
    })
    .default({}),
  ai: z.object({
    provider: z.string().default('claude'),
    model: z.string().default('claude-3'),
    apiKey: z.string().optional(),
  }),
  analysis: z.object({
    patterns: z
      .array(z.string())
      .default(['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']),
    excludes: z
      .array(z.string())
      .default(['**/node_modules/**', '**/dist/**', '**/build/**']),
    maxDepth: z.number().default(10),
  }),
  governance: z.object({
    rules: z.array(z.string()).default([]),
    severity: z.enum(['error', 'warning', 'info']).default('warning'),
  }),
});

/**
 * Configuration management system
 */
export class ConfigManager {
  private config: WundrConfig | null = null;
  private configPath: string;
  private userConfigDir: string;

  constructor() {
    this.userConfigDir = path.join(os.homedir(), '.wundr');
    this.configPath = path.join(this.userConfigDir, 'config.json');
  }

  /**
   * Load configuration from file or create default
   */
  async loadConfig(customPath?: string): Promise<WundrConfig> {
    const configFile = customPath || this.configPath;

    try {
      // Ensure config directory exists
      await fs.ensureDir(path.dirname(configFile));

      // Load existing config or create default
      if (await fs.pathExists(configFile)) {
        const rawConfig = await fs.readJson(configFile);
        this.config = WundrConfigSchema.parse(rawConfig);
        logger.debug(`Loaded config from: ${configFile}`);
      } else {
        this.config = this.createDefaultConfig();
        await this.saveConfig();
        logger.info('Created default configuration');
      }

      // Merge with environment variables
      this.config = this.mergeEnvironmentVariables(this.config);

      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw errorHandler.createError(
        'WUNDR_CONFIG_INVALID',
        'Failed to load or parse configuration file',
        { configPath: configFile },
        true
      );
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(customPath?: string): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    const configFile = customPath || this.configPath;

    try {
      await fs.ensureDir(path.dirname(configFile));
      await fs.writeJson(configFile, this.config, { spaces: 2 });
      logger.debug(`Saved config to: ${configFile}`);
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw errorHandler.createError(
        'WUNDR_CONFIG_INVALID',
        'Failed to save configuration file',
        { configPath: configFile },
        false
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WundrConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Update configuration values
   */
  updateConfig(updates: Partial<WundrConfig>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    this.config = { ...this.config, ...updates };
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(config?: any): { valid: boolean; errors: string[] } {
    const configToValidate = config || this.config;

    try {
      WundrConfigSchema.parse(configToValidate);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(
            issue => `${issue.path.join('.')}: ${issue.message}`
          ),
        };
      }
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get configuration value by path
   */
  get<T>(path: string, defaultValue?: T): T | undefined {
    if (!this.config) {
      return defaultValue;
    }

    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Set configuration value by path
   */
  set(path: string, value: any): void {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const keys = path.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) {
        throw new Error(`Invalid path: empty key at position ${i}`);
      }
      if (!current || typeof current !== 'object') {
        throw new Error('Invalid path: cannot set property on non-object');
      }
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const finalKey = keys[keys.length - 1];
    if (!finalKey) {
      throw new Error('Invalid path: empty final key');
    }
    if (!finalKey || !current || typeof current !== 'object') {
      throw new Error('Invalid path: cannot set property');
    }
    current[finalKey] = value;
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(): WundrConfig {
    return {
      version: '1.0.0',
      defaultMode: 'cli',
      plugins: [],
      integrations: {},
      ai: {
        provider: 'claude',
        model: 'claude-3-opus-20240229',
      },
      analysis: {
        patterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
        excludes: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        maxDepth: 10,
      },
      governance: {
        rules: [],
        severity: 'warning',
      },
    };
  }

  /**
   * Merge environment variables into configuration
   */
  private mergeEnvironmentVariables(config: WundrConfig): WundrConfig {
    const envConfig = { ...config };

    // AI API Key from environment
    if (process.env['CLAUDE_API_KEY'] && !envConfig.ai.apiKey) {
      envConfig.ai.apiKey = process.env['CLAUDE_API_KEY'];
    }

    if (
      process.env['OPENAI_API_KEY'] &&
      envConfig.ai.provider === 'openai' &&
      !envConfig.ai.apiKey
    ) {
      envConfig.ai.apiKey = process.env['OPENAI_API_KEY'];
    }

    // AI Provider and Model from environment
    if (process.env['WUNDR_AI_PROVIDER']) {
      envConfig.ai.provider = process.env['WUNDR_AI_PROVIDER'];
    }

    if (process.env['WUNDR_AI_MODEL']) {
      envConfig.ai.model = process.env['WUNDR_AI_MODEL'];
    }

    // GitHub integration
    if (process.env['GITHUB_TOKEN']) {
      envConfig.integrations.github = envConfig.integrations.github || {
        token: process.env['GITHUB_TOKEN'],
        owner: process.env['GITHUB_OWNER'] || '',
        repo: process.env['GITHUB_REPO'] || '',
      };
      if (!envConfig.integrations.github.token) {
        envConfig.integrations.github.token = process.env['GITHUB_TOKEN'];
      }
    }

    return envConfig;
  }

  /**
   * Get API key for AI provider with fallback mechanisms
   */
  getAIApiKey(provider?: string): string | undefined {
    const currentProvider = provider || this.config?.ai?.provider || 'claude';

    // First check config
    if (this.config?.ai?.apiKey) {
      return this.config.ai.apiKey;
    }

    // Then check environment variables based on provider
    switch (currentProvider.toLowerCase()) {
      case 'claude':
        return process.env['CLAUDE_API_KEY'];
      case 'openai':
        return process.env['OPENAI_API_KEY'];
      default:
        return process.env['CLAUDE_API_KEY']; // Default fallback
    }
  }

  /**
   * Set API key securely in config
   */
  async setAIApiKey(apiKey: string, provider?: string): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (provider && provider !== this.config!.ai.provider) {
      this.config!.ai.provider = provider;
    }

    this.config!.ai.apiKey = apiKey;
    await this.saveConfig();
  }

  /**
   * Check if AI is properly configured
   */
  isAIConfigured(): boolean {
    const apiKey = this.getAIApiKey();
    const provider = this.config?.ai?.provider;

    return !!(apiKey && provider);
  }

  /**
   * Get config file paths
   */
  getConfigPaths(): { user: string; project: string } {
    return {
      user: this.configPath,
      project: path.join(process.cwd(), 'wundr.config.json'),
    };
  }

  /**
   * Merge project config with user config
   */
  async loadProjectConfig(): Promise<WundrConfig> {
    const projectConfigPath = path.join(process.cwd(), 'wundr.config.json');

    // Load user config first
    await this.loadConfig();

    // Merge with project config if it exists
    if (await fs.pathExists(projectConfigPath)) {
      try {
        const projectConfig = await fs.readJson(projectConfigPath);
        const validatedProjectConfig =
          WundrConfigSchema.partial().parse(projectConfig);

        this.config = {
          ...this.config!,
          ...validatedProjectConfig,
        };

        logger.debug(`Merged project config from: ${projectConfigPath}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to load project config: ${message}`);
      }
    }

    return this.config!;
  }
}
