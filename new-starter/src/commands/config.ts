import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { pathExists, readJson, ensureDir, writeJson } from 'fs-extra';
import { DEFAULT_CONFIG } from '../constants';
import type { ConfigOptions } from '../types';
import { logger } from '../utils/logger';

export class ConfigCommand {
  private options: ConfigOptions;
  private configPath: string;

  constructor(options: ConfigOptions) {
    this.options = options;
    this.configPath = path.join(os.homedir(), '.new-starter', 'config.json');
  }

  async execute(): Promise<void> {
    if (this.options.list) {
      await this.listConfig();
    } else if (this.options.get) {
      await this.getConfig(this.options.get);
    } else if (this.options.set) {
      await this.setConfig(this.options.set);
    } else if (this.options.reset) {
      await this.resetConfig();
    } else {
      logger.info(chalk.cyan('Use --list, --get, --set, or --reset'));
    }
  }

  private async loadConfig(): Promise<Record<string, unknown>> {
    try {
      if (await pathExists(this.configPath)) {
        return await readJson(this.configPath);
      }
    } catch {
      logger.warn('Failed to load config, using defaults');
    }
    return { ...DEFAULT_CONFIG };
  }

  private async saveConfig(config: Record<string, unknown>): Promise<void> {
    await ensureDir(path.dirname(this.configPath));
    await writeJson(this.configPath, config, { spaces: 2 });
  }

  private async listConfig(): Promise<void> {
    const config = await this.loadConfig();
    
    logger.info(chalk.cyan.bold('\n📋 Configuration:\n'));
    
    for (const [key, value] of Object.entries(config)) {
      logger.info(`  ${chalk.gray(key)}: ${chalk.white(JSON.stringify(value))}`);
    }
    
    logger.info('');
  }

  private async getConfig(key: string): Promise<void> {
    const config = await this.loadConfig();
    
    if (key in config) {
      logger.info(`${key}: ${JSON.stringify(config[key])}`);
    } else {
      logger.error(`Configuration key "${key}" not found`);
    }
  }

  private async setConfig(keyValue: string): Promise<void> {
    const [key, ...valueParts] = keyValue.split('=');
    const value = valueParts.join('=');
    
    if (!key || !value) {
      logger.error('Invalid format. Use: --set key=value');
      return;
    }
    
    const config = await this.loadConfig();
    
    // Parse value
    let parsedValue: string | number | boolean | Record<string, unknown> | unknown[] = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!Number.isNaN(Number(value))) parsedValue = Number(value);
    else if (value.startsWith('[') || value.startsWith('{')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if JSON parse fails
      }
    }
    
    config[key] = parsedValue;
    await this.saveConfig(config);
    
    logger.info(chalk.green(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`));
  }

  private async resetConfig(): Promise<void> {
    await this.saveConfig({ ...DEFAULT_CONFIG });
    logger.info(chalk.green('✅ Configuration reset to defaults'));
  }
}