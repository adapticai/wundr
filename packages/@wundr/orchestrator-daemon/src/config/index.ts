/**
 * Configuration Loader for Orchestrator Daemon
 *
 * Loads and validates environment variables, providing a typed configuration object.
 * Uses dotenv for .env file support and zod for validation.
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load .env file if it exists
 * Looks in the package root directory
 */
function loadEnvFile(): void {
  try {
    // Try to load dotenv if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    const envPath = path.join(__dirname, '../../.env');

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  } catch (error) {
    // dotenv not available or .env file doesn't exist, continue with existing env vars
  }
}

/**
 * Configuration schema with validation and defaults
 */
const ConfigSchema = z.object({
  // OpenAI Configuration (Required)
  openai: z.object({
    apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
    model: z.string().default('gpt-4o-mini'),
    organization: z.string().optional(),
    baseUrl: z.string().url().optional(),
  }),

  // Anthropic Configuration (Optional)
  anthropic: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('claude-3-sonnet-20240229'),
  }).optional(),

  // Daemon Server Configuration
  daemon: z.object({
    name: z.string().default('orchestrator-daemon'),
    port: z.number().int().min(1024).max(65535).default(8787),
    host: z.string().default('127.0.0.1'),
    maxSessions: z.number().int().positive().default(100),
    verbose: z.boolean().default(false),
  }),

  // Heartbeat and Health Configuration
  health: z.object({
    heartbeatInterval: z.number().int().positive().default(30000),
    healthCheckInterval: z.number().int().positive().default(60000),
    shutdownTimeout: z.number().int().positive().default(10000),
  }),

  // Redis Configuration (Optional)
  redis: z.object({
    url: z.string().optional(),
    password: z.string().optional(),
    db: z.number().int().min(0).max(15).default(0),
    connectTimeout: z.number().int().positive().default(5000),
  }).optional(),

  // Database Configuration (Optional)
  database: z.object({
    url: z.string().optional(),
    poolSize: z.number().int().positive().default(10),
    connectTimeout: z.number().int().positive().default(5000),
  }).optional(),

  // Distributed Configuration (Optional)
  distributed: z.object({
    clusterName: z.string().default('orchestrator-cluster'),
    loadBalancingStrategy: z.enum(['round-robin', 'least-loaded', 'weighted', 'hash-based']).default('least-loaded'),
    rebalanceInterval: z.number().int().positive().default(300000),
    migrationTimeout: z.number().int().positive().default(30000),
  }).optional(),

  // Neolith Integration (Optional)
  neolith: z.object({
    apiUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
  }).optional(),

  // Logging Configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
    file: z.string().optional(),
    rotation: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().int().positive().default(10),
      maxFiles: z.number().int().positive().default(5),
    }),
  }),

  // Security Configuration
  security: z.object({
    jwtSecret: z.string().min(32, 'JWT secret must be at least 32 characters'),
    jwtExpiration: z.string().default('24h'),
    cors: z.object({
      enabled: z.boolean().default(false),
      origins: z.array(z.string()).default([]),
    }),
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      max: z.number().int().positive().default(100),
      windowMs: z.number().int().positive().default(60000),
    }),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    metrics: z.object({
      enabled: z.boolean().default(true),
      port: z.number().int().min(1024).max(65535).default(9090),
      path: z.string().default('/metrics'),
    }),
    healthCheck: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/health'),
    }),
  }),

  // Memory Management
  memory: z.object({
    maxHeapMB: z.number().int().positive().default(2048),
    maxContextTokens: z.number().int().positive().default(128000),
    compaction: z.object({
      enabled: z.boolean().default(true),
      threshold: z.number().min(0).max(1).default(0.8),
    }),
  }),

  // Token Budget Configuration
  tokenBudget: z.object({
    daily: z.number().int().positive().default(1000000),
    weekly: z.number().int().positive().default(5000000),
    monthly: z.number().int().positive().default(20000000),
    alerts: z.object({
      enabled: z.boolean().default(true),
      threshold: z.number().min(0).max(1).default(0.8),
    }),
  }),

  // Environment
  env: z.enum(['development', 'production', 'test']).default('development'),
  debug: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Helper to parse boolean from string
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Helper to parse number from string
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper to parse comma-separated string to array
 */
function parseArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  // Load .env file first
  loadEnvFile();

  // Build configuration object from environment variables
  const rawConfig = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      organization: process.env.OPENAI_ORG_ID,
      baseUrl: process.env.OPENAI_BASE_URL,
    },

    anthropic: process.env.ANTHROPIC_API_KEY ? {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    } : undefined,

    daemon: {
      name: process.env.DAEMON_NAME || 'orchestrator-daemon',
      port: parseNumber(process.env.DAEMON_PORT, 8787),
      host: process.env.DAEMON_HOST || '127.0.0.1',
      maxSessions: parseNumber(process.env.DAEMON_MAX_SESSIONS, 100),
      verbose: parseBoolean(process.env.DAEMON_VERBOSE, false),
    },

    health: {
      heartbeatInterval: parseNumber(process.env.DAEMON_HEARTBEAT_INTERVAL, 30000),
      healthCheckInterval: parseNumber(process.env.DAEMON_HEALTH_CHECK_INTERVAL, 60000),
      shutdownTimeout: parseNumber(process.env.DAEMON_SHUTDOWN_TIMEOUT, 10000),
    },

    redis: process.env.REDIS_URL ? {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      db: parseNumber(process.env.REDIS_DB, 0),
      connectTimeout: parseNumber(process.env.REDIS_CONNECT_TIMEOUT, 5000),
    } : undefined,

    database: process.env.DATABASE_URL ? {
      url: process.env.DATABASE_URL,
      poolSize: parseNumber(process.env.DATABASE_POOL_SIZE, 10),
      connectTimeout: parseNumber(process.env.DATABASE_CONNECT_TIMEOUT, 5000),
    } : undefined,

    distributed: process.env.CLUSTER_NAME || process.env.REDIS_URL ? {
      clusterName: process.env.CLUSTER_NAME || 'orchestrator-cluster',
      loadBalancingStrategy: (process.env.LOAD_BALANCING_STRATEGY as any) || 'least-loaded',
      rebalanceInterval: parseNumber(process.env.REBALANCE_INTERVAL, 300000),
      migrationTimeout: parseNumber(process.env.MIGRATION_TIMEOUT, 30000),
    } : undefined,

    neolith: process.env.NEOLITH_API_URL ? {
      apiUrl: process.env.NEOLITH_API_URL,
      apiKey: process.env.NEOLITH_API_KEY,
      apiSecret: process.env.NEOLITH_API_SECRET,
    } : undefined,

    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      file: process.env.LOG_FILE,
      rotation: {
        enabled: parseBoolean(process.env.LOG_ROTATION_ENABLED, true),
        maxSize: parseNumber(process.env.LOG_MAX_SIZE, 10),
        maxFiles: parseNumber(process.env.LOG_MAX_FILES, 5),
      },
    },

    security: {
      jwtSecret: process.env.DAEMON_JWT_SECRET || 'change-this-in-production-to-a-random-secure-string',
      jwtExpiration: process.env.DAEMON_JWT_EXPIRATION || '24h',
      cors: {
        enabled: parseBoolean(process.env.DAEMON_CORS_ENABLED, false),
        origins: parseArray(process.env.DAEMON_CORS_ORIGINS),
      },
      rateLimit: {
        enabled: parseBoolean(process.env.DAEMON_RATE_LIMIT_ENABLED, true),
        max: parseNumber(process.env.DAEMON_RATE_LIMIT_MAX, 100),
        windowMs: parseNumber(process.env.DAEMON_RATE_LIMIT_WINDOW, 60000),
      },
    },

    monitoring: {
      metrics: {
        enabled: parseBoolean(process.env.METRICS_ENABLED, true),
        port: parseNumber(process.env.METRICS_PORT, 9090),
        path: process.env.METRICS_PATH || '/metrics',
      },
      healthCheck: {
        enabled: parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
        path: process.env.HEALTH_CHECK_PATH || '/health',
      },
    },

    memory: {
      maxHeapMB: parseNumber(process.env.DAEMON_MAX_HEAP_MB, 2048),
      maxContextTokens: parseNumber(process.env.DAEMON_MAX_CONTEXT_TOKENS, 128000),
      compaction: {
        enabled: parseBoolean(process.env.MEMORY_COMPACTION_ENABLED, true),
        threshold: parseFloat(process.env.MEMORY_COMPACTION_THRESHOLD || '0.8'),
      },
    },

    tokenBudget: {
      daily: parseNumber(process.env.TOKEN_BUDGET_DAILY, 1000000),
      weekly: parseNumber(process.env.TOKEN_BUDGET_WEEKLY, 5000000),
      monthly: parseNumber(process.env.TOKEN_BUDGET_MONTHLY, 20000000),
      alerts: {
        enabled: parseBoolean(process.env.TOKEN_BUDGET_ALERTS_ENABLED, true),
        threshold: parseFloat(process.env.TOKEN_BUDGET_ALERT_THRESHOLD || '0.8'),
      },
    },

    env: (process.env.NODE_ENV as any) || 'development',
    debug: parseBoolean(process.env.DEBUG, false),
  };

  try {
    // Validate and parse configuration
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors
      const errors = error.errors.map(err => {
        const field = err.path.join('.');
        return `  - ${field}: ${err.message}`;
      }).join('\n');

      throw new Error(
        `Configuration validation failed:\n${errors}\n\n` +
        `Please check your environment variables or .env file.\n` +
        `See .env.example for all available configuration options.`
      );
    }
    throw error;
  }
}

/**
 * Validate required configuration without loading full config
 * Useful for early validation before application startup
 */
export function validateRequiredEnv(): void {
  loadEnvFile();

  const required = [
    'OPENAI_API_KEY',
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
      `Please set these in your environment or create a .env file.\n` +
      `See .env.example for reference.`
    );
  }
}

/**
 * Get a singleton configuration instance
 * Lazy-loaded on first access
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Export types and schemas
 */
export { ConfigSchema };
