/**
 * VP Daemon Identity Manager
 *
 * Manages the VP Supervisor's identity (Name, Face, Email, Slack handle).
 * Supports loading identity from config files, environment variables, or defaults.
 */
import * as os from 'os';
import * as path from 'path';

import * as fs from 'fs-extra';
import * as yaml from 'yaml';

import { AppError, ConfigurationError } from '../core/errors';

/**
 * VP Identity configuration
 */
export interface VPIdentity {
  name: string;
  email: string;
  avatarUrl: string;
  slackId: string;
  slackHandle?: string;
  title?: string;
  department?: string;
  timezone?: string;
}

/**
 * Slack-compatible profile object
 */
export interface SlackProfile {
  display_name: string;
  real_name: string;
  email: string;
  image_original: string;
  image_512: string;
  image_192: string;
  image_72: string;
  image_48: string;
  image_24: string;
  status_text?: string;
  status_emoji?: string;
  title?: string;
}

/**
 * Configuration options for IdentityManager
 */
export interface IdentityManagerConfig {
  configPath?: string;
  enableEnvOverride?: boolean;
  enableLogging?: boolean;
  defaultIdentity?: Partial<VPIdentity>;
}

/**
 * Default identity values
 */
const DEFAULT_IDENTITY: VPIdentity = {
  name: 'VP Supervisor',
  email: 'vp-supervisor@wundr.io',
  avatarUrl: 'https://wundr.io/assets/vp-avatar.png',
  slackId: '',
  slackHandle: '@vp-supervisor',
  title: 'Virtual Product Supervisor',
  department: 'Engineering',
  timezone: 'UTC',
};

/**
 * Environment variable mapping
 */
const ENV_VAR_MAP: Record<keyof VPIdentity, string> = {
  name: 'VP_NAME',
  email: 'VP_EMAIL',
  avatarUrl: 'VP_AVATAR_URL',
  slackId: 'VP_SLACK_ID',
  slackHandle: 'VP_SLACK_HANDLE',
  title: 'VP_TITLE',
  department: 'VP_DEPARTMENT',
  timezone: 'VP_TIMEZONE',
};

/**
 * Identity Manager for VP Daemon
 *
 * Manages loading, updating, and validating VP identity configuration.
 * Supports multiple configuration sources with precedence:
 * 1. Environment variables (highest priority)
 * 2. Config file (~/.wundr/vp-daemon/config.yaml)
 * 3. Default values (lowest priority)
 */
export class IdentityManager {
  private readonly config: Required<IdentityManagerConfig>;
  private identity: VPIdentity | null = null;
  private configFilePath: string;

  constructor(config: IdentityManagerConfig = {}) {
    this.config = {
      configPath:
        config.configPath ||
        path.join(os.homedir(), '.wundr', 'vp-daemon', 'config.yaml'),
      enableEnvOverride: config.enableEnvOverride ?? true,
      enableLogging: config.enableLogging ?? false,
      defaultIdentity: config.defaultIdentity || {},
    };
    this.configFilePath = this.config.configPath;
  }

  /**
   * Load identity from config file or environment variables
   */
  async loadIdentity(): Promise<VPIdentity> {
    this.log('info', 'Loading VP identity...');

    // Start with defaults
    let identity: VPIdentity = {
      ...DEFAULT_IDENTITY,
      ...this.config.defaultIdentity,
    };

    // Load from config file if exists
    try {
      const fileIdentity = await this.loadFromConfigFile();
      if (fileIdentity) {
        identity = this.mergeIdentity(identity, fileIdentity);
        this.log('info', 'Loaded identity from config file');
      }
    } catch (error) {
      this.log(
        'warn',
        `Failed to load config file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Apply environment variable overrides
    if (this.config.enableEnvOverride) {
      const envIdentity = this.loadFromEnvironment();
      identity = this.mergeIdentity(identity, envIdentity);
      this.log('info', 'Applied environment variable overrides');
    }

    this.identity = identity;
    return identity;
  }

  /**
   * Update identity with new values
   */
  async updateIdentity(updates: Partial<VPIdentity>): Promise<void> {
    if (!this.identity) {
      await this.loadIdentity();
    }

    // Merge updates into current identity
    this.identity = this.mergeIdentity(this.identity!, updates);

    // Save to config file
    await this.saveToConfigFile(this.identity);

    this.log('info', 'Identity updated successfully');
  }

  /**
   * Get Slack-compatible profile object
   */
  getSlackProfile(): SlackProfile {
    if (!this.identity) {
      throw new ConfigurationError(
        'Identity not loaded. Call loadIdentity() first.',
        'identity'
      );
    }

    const { name, email, avatarUrl, title } = this.identity;

    return {
      display_name: this.identity.slackHandle?.replace('@', '') || name,
      real_name: name,
      email,
      image_original: avatarUrl,
      image_512: this.getResizedAvatarUrl(avatarUrl, 512),
      image_192: this.getResizedAvatarUrl(avatarUrl, 192),
      image_72: this.getResizedAvatarUrl(avatarUrl, 72),
      image_48: this.getResizedAvatarUrl(avatarUrl, 48),
      image_24: this.getResizedAvatarUrl(avatarUrl, 24),
      status_text: 'VP Supervisor Active',
      status_emoji: ':robot_face:',
      title: title || 'Virtual Product Supervisor',
    };
  }

  /**
   * Generate email signature
   */
  getEmailSignature(): string {
    if (!this.identity) {
      throw new ConfigurationError(
        'Identity not loaded. Call loadIdentity() first.',
        'identity'
      );
    }

    const { name, email, title, department } = this.identity;

    const lines: string[] = ['', '--', name];

    if (title) {
      lines.push(title);
    }

    if (department) {
      lines.push(department);
    }

    lines.push(email);
    lines.push('');
    lines.push('Powered by Wundr VP Daemon');

    return lines.join('\n');
  }

  /**
   * Validate that all required identity fields are present
   */
  validateIdentity(): boolean {
    if (!this.identity) {
      return false;
    }

    const requiredFields: (keyof VPIdentity)[] = [
      'name',
      'email',
      'avatarUrl',
      'slackId',
    ];

    for (const field of requiredFields) {
      const value = this.identity[field];
      if (value === undefined || value === null || value === '') {
        this.log('warn', `Missing required identity field: ${field}`);
        return false;
      }
    }

    // Validate email format
    if (!this.isValidEmail(this.identity.email)) {
      this.log('warn', 'Invalid email format');
      return false;
    }

    return true;
  }

  /**
   * Get current identity (throws if not loaded)
   */
  getIdentity(): VPIdentity {
    if (!this.identity) {
      throw new ConfigurationError(
        'Identity not loaded. Call loadIdentity() first.',
        'identity'
      );
    }
    return { ...this.identity };
  }

  /**
   * Check if identity has been loaded
   */
  isLoaded(): boolean {
    return this.identity !== null;
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configFilePath;
  }

  /**
   * Load identity from config file
   */
  private async loadFromConfigFile(): Promise<Partial<VPIdentity> | null> {
    if (!(await fs.pathExists(this.configFilePath))) {
      this.log('info', `Config file not found at ${this.configFilePath}`);
      return null;
    }

    try {
      const content = await fs.readFile(this.configFilePath, 'utf-8');
      const config = yaml.parse(content);

      if (!config || !config.identity) {
        return null;
      }

      return this.normalizeIdentityFromConfig(config.identity);
    } catch (error) {
      if (error instanceof yaml.YAMLParseError) {
        throw new ConfigurationError(
          `Invalid YAML in config file: ${error.message}`,
          'configFile'
        );
      }
      throw error;
    }
  }

  /**
   * Load identity from environment variables
   */
  private loadFromEnvironment(): Partial<VPIdentity> {
    const identity: Partial<VPIdentity> = {};

    for (const [key, envVar] of Object.entries(ENV_VAR_MAP)) {
      const value = process.env[envVar];
      if (value !== undefined && value !== '') {
        (identity as Record<string, string>)[key] = value;
      }
    }

    return identity;
  }

  /**
   * Save identity to config file
   */
  private async saveToConfigFile(identity: VPIdentity): Promise<void> {
    // Ensure config directory exists
    const configDir = path.dirname(this.configFilePath);
    await fs.ensureDir(configDir);

    // Load existing config or create new
    let config: Record<string, unknown> = {};

    if (await fs.pathExists(this.configFilePath)) {
      try {
        const content = await fs.readFile(this.configFilePath, 'utf-8');
        config = yaml.parse(content) || {};
      } catch {
        // Start fresh if parse fails
        config = {};
      }
    }

    // Update identity section
    config.identity = {
      name: identity.name,
      email: identity.email,
      avatar_url: identity.avatarUrl,
      slack_id: identity.slackId,
      slack_handle: identity.slackHandle,
      title: identity.title,
      department: identity.department,
      timezone: identity.timezone,
    };

    // Write back to file
    const yamlContent = yaml.stringify(config, {
      indent: 2,
      lineWidth: 120,
    });

    await fs.writeFile(this.configFilePath, yamlContent, 'utf-8');
    this.log('info', `Saved identity to ${this.configFilePath}`);
  }

  /**
   * Normalize identity from config file (convert snake_case to camelCase)
   */
  private normalizeIdentityFromConfig(
    config: Record<string, unknown>
  ): Partial<VPIdentity> {
    return {
      name: config.name as string | undefined,
      email: config.email as string | undefined,
      avatarUrl: (config.avatar_url || config.avatarUrl) as string | undefined,
      slackId: (config.slack_id || config.slackId) as string | undefined,
      slackHandle: (config.slack_handle || config.slackHandle) as
        | string
        | undefined,
      title: config.title as string | undefined,
      department: config.department as string | undefined,
      timezone: config.timezone as string | undefined,
    };
  }

  /**
   * Merge two identity objects, filtering out undefined values
   */
  private mergeIdentity(
    base: VPIdentity,
    updates: Partial<VPIdentity>
  ): VPIdentity {
    const result = { ...base };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    return result;
  }

  /**
   * Get resized avatar URL (attempts to use URL parameters if supported)
   */
  private getResizedAvatarUrl(url: string, size: number): string {
    // If URL already has size parameters, try to update them
    try {
      const urlObj = new URL(url);

      // Handle common image services
      if (url.includes('gravatar.com')) {
        urlObj.searchParams.set('s', String(size));
        return urlObj.toString();
      }

      if (url.includes('cloudinary.com')) {
        // Cloudinary transformation
        return url.replace(/\/upload\//, `/upload/w_${size},h_${size},c_fill/`);
      }

      // For other URLs, append size parameter
      urlObj.searchParams.set('size', String(size));
      return urlObj.toString();
    } catch {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Log message if logging is enabled
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.config.enableLogging) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      service: 'IdentityManager',
      level,
      message,
      ...context,
    };

    console.log(JSON.stringify(logEntry));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an IdentityManager with default configuration
 */
export function createIdentityManager(
  config?: IdentityManagerConfig
): IdentityManager {
  return new IdentityManager(config);
}

/**
 * Load identity with default configuration
 */
export async function loadDefaultIdentity(): Promise<VPIdentity> {
  const manager = new IdentityManager();
  return manager.loadIdentity();
}

/**
 * Quick validate identity from environment/config
 */
export async function validateCurrentIdentity(): Promise<{
  valid: boolean;
  identity: VPIdentity | null;
  missingFields: string[];
}> {
  const manager = new IdentityManager({ enableLogging: false });

  try {
    const identity = await manager.loadIdentity();
    const valid = manager.validateIdentity();

    const missingFields: string[] = [];
    if (!valid) {
      const requiredFields: (keyof VPIdentity)[] = [
        'name',
        'email',
        'avatarUrl',
        'slackId',
      ];

      for (const field of requiredFields) {
        const value = identity[field];
        if (value === undefined || value === null || value === '') {
          missingFields.push(field);
        }
      }
    }

    return { valid, identity, missingFields };
  } catch {
    return { valid: false, identity: null, missingFields: [] };
  }
}

/**
 * Generate a sample config file content
 */
export function generateSampleConfig(): string {
  const sampleConfig = {
    identity: {
      name: 'VP Supervisor',
      email: 'vp-supervisor@example.com',
      avatar_url: 'https://example.com/avatar.png',
      slack_id: 'U0123456789',
      slack_handle: '@vp-supervisor',
      title: 'Virtual Product Supervisor',
      department: 'Engineering',
      timezone: 'America/New_York',
    },
  };

  return yaml.stringify(sampleConfig, { indent: 2 });
}

/**
 * Get environment variable names for identity configuration
 */
export function getEnvironmentVariableNames(): Record<string, string> {
  return { ...ENV_VAR_MAP };
}

// Export error types for consumers
export { AppError, ConfigurationError };
