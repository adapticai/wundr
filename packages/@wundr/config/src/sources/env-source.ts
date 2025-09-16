/**
 * Environment variables configuration source
 */

import { ConfigSource } from '../types/index.js';
import { getLogger, setNestedValue } from '@wundr.io/core';

const logger = getLogger();

export interface EnvConfigOptions {
  prefix?: string;
  separator?: string;
  transform?: {
    keys?: 'camelCase' | 'kebabCase' | 'snakeCase' | 'none';
    values?: 'auto' | 'string';
  };
  includeProcessEnv?: boolean;
}

export class EnvConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority: number;
  private readonly options: Required<EnvConfigOptions>;
  private readonly envVars: Record<string, string>;

  constructor(options: EnvConfigOptions = {}, priority = 100) {
    this.options = {
      prefix: 'WUNDR_',
      separator: '_',
      transform: {
        keys: 'camelCase',
        values: 'auto',
      },
      includeProcessEnv: true,
      ...options,
    };
    
    this.name = `env:${this.options.prefix}`;
    this.priority = priority;
    
    // Capture environment variables at instantiation
    this.envVars = this.options.includeProcessEnv 
      ? { ...process.env } as Record<string, string>
      : {};
  }

  load(): Record<string, any> {
    const config: Record<string, any> = {};
    const prefix = this.options.prefix;
    const separator = this.options.separator;

    for (const [key, value] of Object.entries(this.envVars)) {
      if (!key.startsWith(prefix) || value === undefined) {
        continue;
      }

      // Remove prefix and convert to nested key
      const configKey = key.slice(prefix.length);
      const nestedKey = this.transformKey(configKey, separator);
      const transformedValue = this.transformValue(value);

      setNestedValue(config, nestedKey, transformedValue);
    }

    logger.debug(`Loaded ${Object.keys(config).length} configuration keys from environment`);
    return config;
  }

  // Environment variables are read-only
  save(): void {
    logger.warn('Cannot save configuration to environment variables');
  }

  // Environment variables don't support watching in a straightforward way
  watch(): () => void {
    logger.warn('Environment variable watching is not supported');
    return () => {};
  }

  private transformKey(key: string, separator: string): string {
    const parts = key.split(separator).map(part => part.toLowerCase());
    
    switch (this.options.transform.keys) {
      case 'camelCase':
        return parts[0] + parts.slice(1).map(this.capitalize).join('');
      case 'kebabCase':
        return parts.join('-');
      case 'snakeCase':
        return parts.join('_');
      case 'none':
      default:
        return parts.join('.');
    }
  }

  private transformValue(value: string): any {
    if (this.options.transform.values === 'string') {
      return value;
    }

    // Auto-transform common value types
    if (value === '') {
      return '';
    }

    // Boolean
    if (/^(true|false)$/i.test(value)) {
      return value.toLowerCase() === 'true';
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }

    // JSON
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch {
        // If JSON parsing fails, return as string
        return value;
      }
    }

    // Comma-separated array
    if (value.includes(',')) {
      return value.split(',').map(v => v.trim());
    }

    return value;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}