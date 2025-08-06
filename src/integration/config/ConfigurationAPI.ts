/**
 * Configuration API for Consumer Dashboard Integration
 * Provides a flexible system for consumers to customize the Wundr dashboard
 */

import { z } from 'zod';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Configuration Schema Definitions
export const BrandingConfigSchema = z.object({
  appName: z.string().default('Wundr Dashboard'),
  logo: z.string().optional(),
  primaryColor: z.string().default('#0066CC'),
  secondaryColor: z.string().default('#6B7280'),
  favicon: z.string().optional(),
  customCss: z.string().optional(),
});

export const AnalysisConfigSchema = z.object({
  defaultPath: z.string().default('./'),
  excludePatterns: z.array(z.string()).default(['node_modules', 'dist', 'build']),
  includeExtensions: z.array(z.string()).default(['.ts', '.tsx', '.js', '.jsx']),
  maxFileSize: z.number().default(1024 * 1024), // 1MB
  enableRealtime: z.boolean().default(false),
});

export const IntegrationConfigSchema = z.object({
  webhooks: z.array(z.object({
    event: z.string(),
    url: z.string(),
    headers: z.record(z.string()).optional(),
  })).default([]),
  apiEndpoints: z.array(z.object({
    name: z.string(),
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    headers: z.record(z.string()).optional(),
  })).default([]),
  customScripts: z.array(z.object({
    name: z.string(),
    command: z.string(),
    description: z.string(),
    safetyLevel: z.enum(['safe', 'moderate', 'unsafe']).default('moderate'),
  })).default([]),
});

export const DashboardConfigSchema = z.object({
  branding: BrandingConfigSchema,
  analysis: AnalysisConfigSchema,
  integration: IntegrationConfigSchema,
  plugins: z.array(z.string()).default([]),
  environment: z.enum(['development', 'production']).default('development'),
  port: z.number().default(3000),
  basePath: z.string().default('/'),
});

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

/**
 * Configuration API Manager
 * Handles loading, validation, and persistence of dashboard configuration
 */
export class ConfigurationAPI {
  private static readonly CONFIG_FILENAME = 'wundr.config.json';
  private static readonly ENV_PREFIX = 'WUNDR_';
  
  private config: DashboardConfig;
  private configPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.configPath = path.join(projectRoot, ConfigurationAPI.CONFIG_FILENAME);
    this.config = this.getDefaultConfig();
  }

  /**
   * Load configuration from file and environment variables
   */
  async loadConfig(): Promise<DashboardConfig> {
    try {
      // Load from file if exists
      if (existsSync(this.configPath)) {
        const fileContent = await readFile(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = DashboardConfigSchema.parse(fileConfig);
      }

      // Override with environment variables
      this.applyEnvironmentOverrides();
      
      return this.config;
    } catch (error: any) {
      throw new Error(`Failed to load configuration: ${error?.message || error}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config: Partial<DashboardConfig>): Promise<void> {
    try {
      const mergedConfig = { ...this.config, ...config };
      const validatedConfig = DashboardConfigSchema.parse(mergedConfig);
      
      await mkdir(path.dirname(this.configPath), { recursive: true });
      await writeFile(this.configPath, JSON.stringify(validatedConfig, null, 2));
      
      this.config = validatedConfig;
    } catch (error: any) {
      throw new Error(`Failed to save configuration: ${error?.message || error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  /**
   * Update specific configuration section
   */
  async updateConfig<K extends keyof DashboardConfig>(section: K, value: DashboardConfig[K]): Promise<void> {
    const updatedConfig = { ...this.config };
    updatedConfig[section] = value;
    await this.saveConfig(updatedConfig);
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(config: unknown): DashboardConfig {
    return DashboardConfigSchema.parse(config);
  }

  /**
   * Generate default configuration
   */
  private getDefaultConfig(): DashboardConfig {
    return DashboardConfigSchema.parse({});
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    const env = process.env;
    
    // Branding overrides
    const appName = env[`${ConfigurationAPI.ENV_PREFIX}APP_NAME`];
    if (appName) {
      this.config.branding.appName = appName;
    }
    const primaryColor = env[`${ConfigurationAPI.ENV_PREFIX}PRIMARY_COLOR`];
    if (primaryColor) {
      this.config.branding.primaryColor = primaryColor;
    }
    const logo = env[`${ConfigurationAPI.ENV_PREFIX}LOGO`];
    if (logo) {
      this.config.branding.logo = logo;
    }

    // Analysis overrides
    const defaultPath = env[`${ConfigurationAPI.ENV_PREFIX}DEFAULT_PATH`];
    if (defaultPath) {
      this.config.analysis.defaultPath = defaultPath;
    }
    const excludePatterns = env[`${ConfigurationAPI.ENV_PREFIX}EXCLUDE_PATTERNS`];
    if (excludePatterns) {
      this.config.analysis.excludePatterns = excludePatterns.split(',');
    }

    // Server overrides
    const port = env[`${ConfigurationAPI.ENV_PREFIX}PORT`];
    if (port) {
      this.config.port = parseInt(port, 10);
    }
    const environment = env[`${ConfigurationAPI.ENV_PREFIX}ENVIRONMENT`];
    if (environment && (environment === 'development' || environment === 'production')) {
      this.config.environment = environment;
    }
  }

  /**
   * Create configuration template for consumers
   */
  static createTemplate(): DashboardConfig {
    return DashboardConfigSchema.parse({
      branding: {
        appName: 'My Project Dashboard',
        primaryColor: '#0066CC',
        secondaryColor: '#6B7280',
      },
      analysis: {
        defaultPath: './',
        excludePatterns: ['node_modules', 'dist', 'build', '.git'],
        includeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py'],
      },
      integration: {
        customScripts: [
          {
            name: 'run-tests',
            command: 'npm test',
            description: 'Run project tests',
            safetyLevel: 'safe',
          },
          {
            name: 'build-project',
            command: 'npm run build',
            description: 'Build the project',
            safetyLevel: 'safe',
          },
        ],
      },
    });
  }
}

/**
 * Configuration Builder for fluent API
 */
export class ConfigurationBuilder {
  private config: Partial<DashboardConfig> = {};

  branding(branding: Partial<BrandingConfig>): ConfigurationBuilder {
    this.config.branding = {
      appName: 'Wundr Dashboard',
      primaryColor: '#0066CC',
      secondaryColor: '#6B7280',
      ...this.config.branding,
      ...branding
    };
    return this;
  }

  analysis(analysis: Partial<AnalysisConfig>): ConfigurationBuilder {
    this.config.analysis = {
      defaultPath: './',
      excludePatterns: ['node_modules', 'dist', 'build'],
      includeExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      maxFileSize: 1024 * 1024,
      enableRealtime: false,
      ...this.config.analysis,
      ...analysis
    };
    return this;
  }

  integration(integration: Partial<IntegrationConfig>): ConfigurationBuilder {
    this.config.integration = {
      webhooks: [],
      apiEndpoints: [],
      customScripts: [],
      ...this.config.integration,
      ...integration
    };
    return this;
  }

  plugins(plugins: string[]): ConfigurationBuilder {
    this.config.plugins = plugins;
    return this;
  }

  port(port: number): ConfigurationBuilder {
    this.config.port = port;
    return this;
  }

  build(): Partial<DashboardConfig> {
    return { ...this.config };
  }
}

export default ConfigurationAPI;