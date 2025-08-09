import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import { FSWatcher } from 'chokidar';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  // Credential Management
  credentials: {
    keychain: {
      service: string;
      encryptionAlgorithm: string;
      rotationIntervalMs: number;
    };
    storage: {
      provider: 'keychain' | 'file' | 'vault';
      options: Record<string, any>;
    };
  };

  // Scanning Configuration
  scanning: {
    secrets: {
      enabled: boolean;
      patterns: string[];
      excludePaths: string[];
      includeExtensions: string[];
      confidenceThreshold: number;
    };
    vulnerabilities: {
      enabled: boolean;
      updateIntervalMs: number;
      sources: string[];
      autoUpdate: boolean;
      offline: boolean;
    };
    staticAnalysis: {
      enabled: boolean;
      rules: string[];
      severity: 'info' | 'warning' | 'error' | 'critical';
      autoFix: boolean;
      excludePaths: string[];
    };
  };

  // Compliance Configuration
  compliance: {
    frameworks: string[];
    reportFormats: string[];
    assessmentInterval: number;
    autoAssessment: boolean;
    evidenceRetention: number;
  };

  // Audit Configuration
  audit: {
    enabled: boolean;
    storage: {
      provider: 'file' | 'database' | 'external';
      path: string;
      retention: number;
    };
    events: {
      includeSuccess: boolean;
      includeFailure: boolean;
      includeSystem: boolean;
      sensitiveDataMasking: boolean;
    };
    alerting: {
      enabled: boolean;
      thresholds: Record<string, number>;
      notifications: string[];
    };
  };

  // RBAC Configuration
  rbac: {
    enabled: boolean;
    defaultDenyAll: boolean;
    caching: {
      enabled: boolean;
      expirationMs: number;
    };
    session: {
      timeoutMs: number;
      maxConcurrent: number;
    };
  };

  // Security Policies
  policies: {
    password: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
      preventReuse: number;
    };
    session: {
      timeoutMs: number;
      maxInactiveMs: number;
      requireMFA: boolean;
      allowConcurrent: boolean;
    };
    encryption: {
      algorithm: string;
      keySize: number;
      mode: string;
    };
    network: {
      allowedOrigins: string[];
      rateLimiting: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
      };
      cors: {
        enabled: boolean;
        origins: string[];
      };
    };
  };

  // Monitoring Configuration
  monitoring: {
    enabled: boolean;
    metrics: {
      enabled: boolean;
      endpoint: string;
      interval: number;
    };
    logging: {
      level: string;
      format: string;
      outputs: string[];
    };
    alerting: {
      enabled: boolean;
      rules: AlertRule[];
    };
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
}

export class SecurityConfigManager extends EventEmitter {
  private config: SecurityConfig;
  private configPath: string;
  private watchers: Map<string, FSWatcher> = new Map();

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || path.join(process.cwd(), 'security.config.json');
    this.config = this.getDefaultConfig();
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<SecurityConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(configData);
      
      // Merge with defaults to handle missing properties
      this.config = this.mergeWithDefaults(loaded);
      
      this.emit('config:loaded', this.config);
      logger.info('Security configuration loaded', { path: this.configPath });
      
      return this.config;
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        logger.info('No configuration file found, using defaults');
        await this.saveConfig();
      } else {
        logger.error('Failed to load configuration:', error);
        throw error;
      }
    }
    
    return this.config;
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config?: SecurityConfig): Promise<void> {
    if (config) {
      this.config = config;
    }

    try {
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      
      this.emit('config:saved', this.config);
      logger.info('Security configuration saved', { path: this.configPath });
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Watch configuration file for changes
   */
  async watchConfig(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      const watcher = chokidar.watch(this.configPath, { persistent: false });
      
      watcher.on('change', async () => {
        try {
          logger.info('Configuration file changed, reloading...');
          await this.loadConfig();
          this.emit('config:changed', this.config);
        } catch (error) {
          logger.error('Failed to reload configuration:', error);
        }
      });

      this.watchers.set(this.configPath, watcher);
      logger.info('Watching configuration file for changes');
    } catch (error) {
      logger.warn('Failed to watch configuration file:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration section
   */
  async updateConfig<K extends keyof SecurityConfig>(
    section: K,
    updates: Partial<SecurityConfig[K]>
  ): Promise<void> {
    this.config[section] = {
      ...this.config[section],
      ...updates
    } as SecurityConfig[K];

    await this.saveConfig();
    this.emit('config:updated', { section, updates });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: SecurityConfig = this.config): string[] {
    const errors: string[] = [];

    // Validate credential configuration
    if (!config.credentials.keychain.service) {
      errors.push('credentials.keychain.service is required');
    }

    // Validate scanning configuration
    if (config.scanning.secrets.enabled && config.scanning.secrets.confidenceThreshold < 0) {
      errors.push('scanning.secrets.confidenceThreshold must be >= 0');
    }

    if (config.scanning.vulnerabilities.enabled && config.scanning.vulnerabilities.updateIntervalMs < 3600000) {
      errors.push('scanning.vulnerabilities.updateIntervalMs should be at least 1 hour');
    }

    // Validate audit configuration
    if (config.audit.enabled && !config.audit.storage.path) {
      errors.push('audit.storage.path is required when audit is enabled');
    }

    // Validate password policy
    if (config.policies.password.minLength < 8) {
      errors.push('policies.password.minLength should be at least 8');
    }

    // Validate encryption settings
    const supportedAlgorithms = ['AES-256-GCM', 'AES-192-GCM', 'AES-128-GCM'];
    if (!supportedAlgorithms.includes(config.policies.encryption.algorithm)) {
      errors.push(`policies.encryption.algorithm must be one of: ${supportedAlgorithms.join(', ')}`);
    }

    return errors;
  }

  /**
   * Get environment-specific overrides
   */
  getEnvironmentOverrides(): Partial<SecurityConfig> {
    const overrides: Partial<SecurityConfig> = {};

    // Environment-based configuration
    if (process.env.SECURITY_AUDIT_ENABLED) {
      overrides.audit = {
        ...this.config.audit,
        enabled: process.env.SECURITY_AUDIT_ENABLED === 'true'
      };
    }

    if (process.env.SECURITY_RBAC_CACHE_TTL) {
      overrides.rbac = {
        ...this.config.rbac,
        caching: {
          ...this.config.rbac.caching,
          expirationMs: parseInt(process.env.SECURITY_RBAC_CACHE_TTL)
        }
      };
    }

    if (process.env.SECURITY_LOG_LEVEL) {
      overrides.monitoring = {
        ...this.config.monitoring,
        logging: {
          ...this.config.monitoring.logging,
          level: process.env.SECURITY_LOG_LEVEL
        }
      };
    }

    return overrides;
  }

  /**
   * Apply environment overrides
   */
  applyEnvironmentOverrides(): void {
    const overrides = this.getEnvironmentOverrides();
    this.config = this.mergeDeep(this.config, overrides);
    this.emit('config:overrides-applied', overrides);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SecurityConfig {
    return {
      credentials: {
        keychain: {
          service: '@wundr/security',
          encryptionAlgorithm: 'AES-256-GCM',
          rotationIntervalMs: 30 * 24 * 60 * 60 * 1000 // 30 days
        },
        storage: {
          provider: 'keychain',
          options: {}
        }
      },

      scanning: {
        secrets: {
          enabled: true,
          patterns: ['default'],
          excludePaths: ['node_modules', '.git', 'dist', 'build'],
          includeExtensions: ['.js', '.ts', '.json', '.env', '.yaml', '.yml'],
          confidenceThreshold: 0.3
        },
        vulnerabilities: {
          enabled: true,
          updateIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
          sources: ['npm', 'github', 'nvd'],
          autoUpdate: true,
          offline: false
        },
        staticAnalysis: {
          enabled: true,
          rules: ['security', 'performance'],
          severity: 'warning',
          autoFix: false,
          excludePaths: ['node_modules', '.git', 'dist']
        }
      },

      compliance: {
        frameworks: ['soc2-type2', 'hipaa'],
        reportFormats: ['json', 'html', 'pdf'],
        assessmentInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
        autoAssessment: true,
        evidenceRetention: 365 * 24 * 60 * 60 * 1000 // 1 year
      },

      audit: {
        enabled: true,
        storage: {
          provider: 'file',
          path: './logs/audit',
          retention: 90 * 24 * 60 * 60 * 1000 // 90 days
        },
        events: {
          includeSuccess: true,
          includeFailure: true,
          includeSystem: true,
          sensitiveDataMasking: true
        },
        alerting: {
          enabled: true,
          thresholds: {
            failed_logins: 5,
            privilege_escalation: 1,
            data_access: 100
          },
          notifications: ['email', 'slack']
        }
      },

      rbac: {
        enabled: true,
        defaultDenyAll: true,
        caching: {
          enabled: true,
          expirationMs: 5 * 60 * 1000 // 5 minutes
        },
        session: {
          timeoutMs: 8 * 60 * 60 * 1000, // 8 hours
          maxConcurrent: 3
        }
      },

      policies: {
        password: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
          preventReuse: 5
        },
        session: {
          timeoutMs: 30 * 60 * 1000, // 30 minutes
          maxInactiveMs: 15 * 60 * 1000, // 15 minutes
          requireMFA: false,
          allowConcurrent: true
        },
        encryption: {
          algorithm: 'AES-256-GCM',
          keySize: 256,
          mode: 'GCM'
        },
        network: {
          allowedOrigins: ['localhost', '127.0.0.1'],
          rateLimiting: {
            enabled: true,
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 100
          },
          cors: {
            enabled: true,
            origins: ['http://localhost:3000']
          }
        }
      },

      monitoring: {
        enabled: true,
        metrics: {
          enabled: true,
          endpoint: '/metrics',
          interval: 60000 // 1 minute
        },
        logging: {
          level: 'info',
          format: 'json',
          outputs: ['console', 'file']
        },
        alerting: {
          enabled: true,
          rules: [
            {
              id: 'high-failed-logins',
              name: 'High Failed Login Attempts',
              condition: 'failed_logins > 10',
              threshold: 10,
              severity: 'high',
              actions: ['email', 'slack']
            },
            {
              id: 'privilege-escalation',
              name: 'Privilege Escalation Detected',
              condition: 'privilege_escalation > 0',
              threshold: 1,
              severity: 'critical',
              actions: ['email', 'slack', 'webhook']
            }
          ]
        }
      }
    };
  }

  private mergeWithDefaults(loaded: Partial<SecurityConfig>): SecurityConfig {
    const defaults = this.getDefaultConfig();
    return this.mergeDeep(defaults, loaded) as SecurityConfig;
  }

  private mergeDeep(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.mergeDeep(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Close all file watchers
    for (const [path, watcher] of this.watchers) {
      try {
        watcher.close();
        logger.info(`Stopped watching configuration file: ${path}`);
      } catch (error) {
        logger.warn(`Failed to close watcher for ${path}:`, error);
      }
    }
    
    this.watchers.clear();
    this.removeAllListeners();
  }
}