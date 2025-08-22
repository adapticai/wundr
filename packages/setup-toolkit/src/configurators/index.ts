/**
 * @fileoverview Configuration tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execa } from 'execa';

const execAsync = promisify(exec);

export interface ConfigurationOptions {
  force?: boolean;
  silent?: boolean;
  backup?: boolean;
  configPath?: string;
}

export interface ConfigurationResult {
  success: boolean;
  message: string;
  configPath?: string;
  backupPath?: string;
  error?: Error;
}

export interface ConfigurationValue {
  key: string;
  value: string;
  scope?: 'global' | 'local' | 'system';
}

export interface Configurator {
  name: string;
  isConfigured(): Promise<boolean>;
  getConfiguration(key?: string): Promise<ConfigurationValue[]>;
  setConfiguration(config: ConfigurationValue[], options?: ConfigurationOptions): Promise<ConfigurationResult>;
  resetConfiguration(options?: ConfigurationOptions): Promise<ConfigurationResult>;
  validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }>;
}

export abstract class BaseConfigurator implements Configurator {
  constructor(public readonly name: string) {}

  abstract isConfigured(): Promise<boolean>;
  abstract getConfiguration(key?: string): Promise<ConfigurationValue[]>;
  abstract setConfiguration(config: ConfigurationValue[], options?: ConfigurationOptions): Promise<ConfigurationResult>;
  abstract resetConfiguration(options?: ConfigurationOptions): Promise<ConfigurationResult>;
  abstract validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }>;

  protected async executeCommand(command: string, args: string[] = [], options: { silent?: boolean } = {}): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execa(command, args, {
        stdio: options.silent ? 'pipe' : 'inherit',
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error: any) {
      throw new Error(`Command failed: ${command} ${args.join(' ')} - ${error.message}`);
    }
  }

  protected getPlatform(): 'darwin' | 'linux' | 'win32' {
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
      return platform;
    }
    throw new Error(`Unsupported platform: ${platform}`);
  }

  protected async backupFile(filePath: string): Promise<string> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    if (await fs.pathExists(filePath)) {
      await fs.copy(filePath, backupPath);
    }
    return backupPath;
  }

  protected async checkCommandExists(command: string): Promise<boolean> {
    try {
      await execAsync(this.getPlatform() === 'win32' ? `where ${command}` : `which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
}

export class GitConfigurator extends BaseConfigurator {
  constructor() {
    super('Git');
  }

  async isConfigured(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git config --global user.name');
      const { stdout: email } = await execAsync('git config --global user.email');
      return stdout.trim().length > 0 && email.trim().length > 0;
    } catch {
      return false;
    }
  }

  async getConfiguration(key?: string): Promise<ConfigurationValue[]> {
    try {
      const configs: ConfigurationValue[] = [];
      
      if (key) {
        const { stdout } = await execAsync(`git config --global ${key}`);
        configs.push({
          key,
          value: stdout.trim(),
          scope: 'global',
        });
      } else {
        const commonKeys = [
          'user.name',
          'user.email',
          'init.defaultBranch',
          'core.editor',
          'pull.rebase',
          'push.default',
        ];

        for (const configKey of commonKeys) {
          try {
            const { stdout } = await execAsync(`git config --global ${configKey}`);
            if (stdout.trim()) {
              configs.push({
                key: configKey,
                value: stdout.trim(),
                scope: 'global',
              });
            }
          } catch {
            // Ignore missing configs
          }
        }
      }

      return configs;
    } catch (error: any) {
      throw new Error(`Failed to get Git configuration: ${error.message}`);
    }
  }

  async setConfiguration(config: ConfigurationValue[], options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      if (!(await this.checkCommandExists('git'))) {
        throw new Error('Git is not installed');
      }

      for (const { key, value, scope = 'global' } of config) {
        const scopeFlag = scope === 'local' ? '--local' : scope === 'system' ? '--system' : '--global';
        await this.executeCommand('git', ['config', scopeFlag, key, value], { silent: options.silent || false });
      }

      return {
        success: true,
        message: `Git configuration updated with ${config.length} settings`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to configure Git: ${error.message}`,
        error,
      };
    }
  }

  async resetConfiguration(options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      const gitConfigPath = path.join(os.homedir(), '.gitconfig');
      let backupPath: string | undefined;

      if (options.backup && await fs.pathExists(gitConfigPath)) {
        backupPath = await this.backupFile(gitConfigPath);
      }

      if (await fs.pathExists(gitConfigPath)) {
        await fs.remove(gitConfigPath);
      }

      return {
        success: true,
        message: 'Git configuration reset successfully',
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to reset Git configuration: ${error.message}`,
        error,
      };
    }
  }

  async validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }> {
    const issues: string[] = [];

    try {
      const configs = await this.getConfiguration();
      const configMap = new Map(configs.map(c => [c.key, c.value]));

      if (!configMap.has('user.name') || !configMap.get('user.name')?.trim()) {
        issues.push('user.name is not configured');
      }

      if (!configMap.has('user.email') || !configMap.get('user.email')?.trim()) {
        issues.push('user.email is not configured');
      }

      const email = configMap.get('user.email');
      if (email && !email.includes('@')) {
        issues.push('user.email appears to be invalid');
      }

      return {
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to validate configuration: ${error}`],
      };
    }
  }
}

export class NpmConfigurator extends BaseConfigurator {
  constructor() {
    super('NPM');
  }

  async isConfigured(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('npm config get registry');
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async getConfiguration(key?: string): Promise<ConfigurationValue[]> {
    try {
      const configs: ConfigurationValue[] = [];
      
      if (key) {
        const { stdout } = await execAsync(`npm config get ${key}`);
        configs.push({
          key,
          value: stdout.trim(),
          scope: 'global',
        });
      } else {
        const { stdout } = await execAsync('npm config list');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          const match = line.match(/^([^=]+)\s*=\s*(.+)$/);
          if (match && match[1] && match[2]) {
            const [, configKey, value] = match;
            configs.push({
              key: configKey.trim(),
              value: value.trim().replace(/^"(.*)"$/, '$1'),
              scope: 'global',
            });
          }
        }
      }

      return configs;
    } catch (error: any) {
      throw new Error(`Failed to get NPM configuration: ${error.message}`);
    }
  }

  async setConfiguration(config: ConfigurationValue[], options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      if (!(await this.checkCommandExists('npm'))) {
        throw new Error('NPM is not installed');
      }

      for (const { key, value, scope = 'global' } of config) {
        const scopeFlag = scope === 'global' ? '--global' : '';
        await this.executeCommand('npm', ['config', 'set', key, value, scopeFlag].filter(Boolean), { silent: options.silent || false });
      }

      return {
        success: true,
        message: `NPM configuration updated with ${config.length} settings`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to configure NPM: ${error.message}`,
        error,
      };
    }
  }

  async resetConfiguration(options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      const npmConfigPath = path.join(os.homedir(), '.npmrc');
      let backupPath: string | undefined;

      if (options.backup && await fs.pathExists(npmConfigPath)) {
        backupPath = await this.backupFile(npmConfigPath);
      }

      if (await fs.pathExists(npmConfigPath)) {
        await fs.remove(npmConfigPath);
      }

      return {
        success: true,
        message: 'NPM configuration reset successfully',
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to reset NPM configuration: ${error.message}`,
        error,
      };
    }
  }

  async validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }> {
    const issues: string[] = [];

    try {
      const configs = await this.getConfiguration();
      const configMap = new Map(configs.map(c => [c.key, c.value]));

      const registry = configMap.get('registry');
      if (registry && !registry.startsWith('http')) {
        issues.push('registry URL appears to be invalid');
      }

      return {
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to validate configuration: ${error}`],
      };
    }
  }
}

export class DockerConfigurator extends BaseConfigurator {
  constructor() {
    super('Docker');
  }

  async isConfigured(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }

  async getConfiguration(key?: string): Promise<ConfigurationValue[]> {
    try {
      const configs: ConfigurationValue[] = [];
      const configPath = this.getDockerConfigPath();

      if (await fs.pathExists(configPath)) {
        const configContent = await fs.readJSON(configPath);
        
        if (key) {
          if (configContent[key] !== undefined) {
            configs.push({
              key,
              value: JSON.stringify(configContent[key]),
              scope: 'global',
            });
          }
        } else {
          for (const [configKey, value] of Object.entries(configContent)) {
            configs.push({
              key: configKey,
              value: JSON.stringify(value),
              scope: 'global',
            });
          }
        }
      }

      return configs;
    } catch (error: any) {
      throw new Error(`Failed to get Docker configuration: ${error.message}`);
    }
  }

  async setConfiguration(config: ConfigurationValue[], options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      if (!(await this.checkCommandExists('docker'))) {
        throw new Error('Docker is not installed');
      }

      const configPath = this.getDockerConfigPath();
      let currentConfig = {};

      if (await fs.pathExists(configPath)) {
        currentConfig = await fs.readJSON(configPath);
      }

      for (const { key, value } of config) {
        try {
          (currentConfig as any)[key] = JSON.parse(value);
        } catch {
          (currentConfig as any)[key] = value;
        }
      }

      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, currentConfig, { spaces: 2 });

      return {
        success: true,
        message: `Docker configuration updated with ${config.length} settings`,
        configPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to configure Docker: ${error.message}`,
        error,
      };
    }
  }

  async resetConfiguration(options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      const configPath = this.getDockerConfigPath();
      let backupPath: string | undefined;

      if (options.backup && await fs.pathExists(configPath)) {
        backupPath = await this.backupFile(configPath);
      }

      if (await fs.pathExists(configPath)) {
        await fs.remove(configPath);
      }

      return {
        success: true,
        message: 'Docker configuration reset successfully',
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to reset Docker configuration: ${error.message}`,
        error,
      };
    }
  }

  async validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }> {
    const issues: string[] = [];

    try {
      await execAsync('docker info');
      
      const configPath = this.getDockerConfigPath();
      if (await fs.pathExists(configPath)) {
        try {
          await fs.readJSON(configPath);
        } catch {
          issues.push('Docker configuration file is not valid JSON');
        }
      }

      return {
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Docker daemon is not running or not accessible: ${error}`],
      };
    }
  }

  private getDockerConfigPath(): string {
    const platform = this.getPlatform();
    switch (platform) {
      case 'darwin':
      case 'linux':
        return path.join(os.homedir(), '.docker', 'config.json');
      case 'win32':
        return path.join(os.homedir(), '.docker', 'config.json');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

export class VSCodeConfigurator extends BaseConfigurator {
  constructor() {
    super('VSCode');
  }

  async isConfigured(): Promise<boolean> {
    try {
      const settingsPath = this.getVSCodeSettingsPath();
      return await fs.pathExists(settingsPath);
    } catch {
      return false;
    }
  }

  async getConfiguration(key?: string): Promise<ConfigurationValue[]> {
    try {
      const configs: ConfigurationValue[] = [];
      const settingsPath = this.getVSCodeSettingsPath();

      if (await fs.pathExists(settingsPath)) {
        const settings = await fs.readJSON(settingsPath);
        
        if (key) {
          if (settings[key] !== undefined) {
            configs.push({
              key,
              value: JSON.stringify(settings[key]),
              scope: 'global',
            });
          }
        } else {
          for (const [settingKey, value] of Object.entries(settings)) {
            configs.push({
              key: settingKey,
              value: JSON.stringify(value),
              scope: 'global',
            });
          }
        }
      }

      return configs;
    } catch (error: any) {
      throw new Error(`Failed to get VSCode configuration: ${error.message}`);
    }
  }

  async setConfiguration(config: ConfigurationValue[], options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      const settingsPath = this.getVSCodeSettingsPath();
      let currentSettings = {};

      if (await fs.pathExists(settingsPath)) {
        currentSettings = await fs.readJSON(settingsPath);
      }

      if (options.backup && await fs.pathExists(settingsPath)) {
        await this.backupFile(settingsPath);
      }

      for (const { key, value } of config) {
        try {
          (currentSettings as any)[key] = JSON.parse(value);
        } catch {
          (currentSettings as any)[key] = value;
        }
      }

      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJSON(settingsPath, currentSettings, { spaces: 2 });

      return {
        success: true,
        message: `VSCode configuration updated with ${config.length} settings`,
        configPath: settingsPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to configure VSCode: ${error.message}`,
        error,
      };
    }
  }

  async resetConfiguration(options: ConfigurationOptions = {}): Promise<ConfigurationResult> {
    try {
      const settingsPath = this.getVSCodeSettingsPath();
      let backupPath: string | undefined;

      if (options.backup && await fs.pathExists(settingsPath)) {
        backupPath = await this.backupFile(settingsPath);
      }

      if (await fs.pathExists(settingsPath)) {
        await fs.remove(settingsPath);
      }

      return {
        success: true,
        message: 'VSCode configuration reset successfully',
        backupPath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to reset VSCode configuration: ${error.message}`,
        error,
      };
    }
  }

  async validateConfiguration(): Promise<{ valid: boolean; issues?: string[] }> {
    const issues: string[] = [];

    try {
      const settingsPath = this.getVSCodeSettingsPath();
      
      if (await fs.pathExists(settingsPath)) {
        try {
          await fs.readJSON(settingsPath);
        } catch {
          issues.push('VSCode settings file is not valid JSON');
        }
      }

      return {
        valid: issues.length === 0,
        issues: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to validate VSCode configuration: ${error}`],
      };
    }
  }

  private getVSCodeSettingsPath(): string {
    const platform = this.getPlatform();
    switch (platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      case 'linux':
        return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

// Export configurator instances for easy use
export const gitConfigurator = new GitConfigurator();
export const npmConfigurator = new NpmConfigurator();
export const dockerConfigurator = new DockerConfigurator();
export const vscodeConfigurator = new VSCodeConfigurator();

// Export factory function
export function createConfigurator(type: 'git' | 'npm' | 'docker' | 'vscode'): Configurator {
  switch (type) {
    case 'git':
      return new GitConfigurator();
    case 'npm':
      return new NpmConfigurator();
    case 'docker':
      return new DockerConfigurator();
    case 'vscode':
      return new VSCodeConfigurator();
    default:
      throw new Error(`Unknown configurator type: ${type}`);
  }
}