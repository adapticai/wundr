/**
 * Centralized configuration constants for the monorepo refactoring toolkit
 * This file helps eliminate hardcoded values throughout the codebase
 */

// Server configuration
export const SERVER_CONFIG = {
  DEFAULT_PORT: parseInt(process.env.PORT || '8080', 10),
  DEFAULT_HOST: process.env.HOST || 'localhost',
  TIMEOUT: parseInt(process.env.TIMEOUT || '30000', 10),
} as const;

// File paths and patterns
export const FILE_PATTERNS = {
  TYPESCRIPT: ['**/*.ts', '**/*.tsx'],
  JAVASCRIPT: ['**/*.js', '**/*.jsx'],
  TEST_FILES: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js'],
  IGNORE_PATTERNS: [
    '**/node_modules/**',
    '**/*.d.ts',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
  ],
} as const;

// Analysis configuration
export const ANALYSIS_CONFIG = {
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '300', 10), // lines
  COMPLEXITY_THRESHOLD: parseInt(process.env.COMPLEXITY_THRESHOLD || '10', 10),
  DEPENDENCY_THRESHOLD: parseInt(process.env.DEPENDENCY_THRESHOLD || '5', 10),
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '5', 10),
  MAX_DEPTH: parseInt(process.env.MAX_DEPTH || '5', 10),
} as const;

// Dashboard configuration
export const DASHBOARD_CONFIG = {
  CHART_COLORS: [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
    '#9b59b6', '#34495e', '#1abc9c', '#e67e22'
  ],
  SEVERITY_COLORS: {
    critical: '#e74c3c',
    high: '#f39c12',
    medium: '#3498db',
    low: '#2ecc71',
  },
  CDN_URLS: {
    CHART_JS: process.env.CHART_JS_CDN || 'https://cdn.jsdelivr.net/npm/chart.js',
    FONT_AWESOME: process.env.FONT_AWESOME_CDN || 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  },
} as const;

// Directory structure
export const DIRECTORIES = {
  OUTPUT: process.env.OUTPUT_DIR || './analysis-output',
  REPORTS: process.env.REPORTS_DIR || '.governance/reports',
  BASELINES: process.env.BASELINES_DIR || '.governance/baselines',
  TEMP: process.env.TEMP_DIR || './temp',
  LOGS: process.env.LOGS_DIR || './logs',
} as const;

// GitHub integration
export const GITHUB_CONFIG = {
  TOKEN: process.env.GITHUB_TOKEN,
  REPOSITORY: process.env.GITHUB_REPOSITORY,
  EVENT_NAME: process.env.GITHUB_EVENT_NAME,
  EVENT_NUMBER: process.env.GITHUB_EVENT_NUMBER,
  CI: process.env.CI === 'true',
  API_BASE_URL: process.env.GITHUB_API_URL || 'https://api.github.com',
} as const;

// Drift detection thresholds
export const DRIFT_THRESHOLDS = {
  CRITICAL: {
    NEW_DUPLICATES: parseInt(process.env.CRITICAL_DUPLICATES || '5', 10),
    COMPLEXITY_INCREASE: parseInt(process.env.CRITICAL_COMPLEXITY || '10', 10),
  },
  HIGH: {
    NEW_DUPLICATES: parseInt(process.env.HIGH_DUPLICATES || '2', 10),
    COMPLEXITY_INCREASE: parseInt(process.env.HIGH_COMPLEXITY || '5', 10),
  },
  MEDIUM: {
    NEW_DUPLICATES: parseInt(process.env.MEDIUM_DUPLICATES || '1', 10),
    COMPLEXITY_INCREASE: parseInt(process.env.MEDIUM_COMPLEXITY || '2', 10),
    UNUSED_EXPORTS: parseInt(process.env.MEDIUM_UNUSED || '20', 10),
  },
  LOW: {
    UNUSED_EXPORTS: parseInt(process.env.LOW_UNUSED || '5', 10),
  },
} as const;

// Quality standards
export const QUALITY_STANDARDS = {
  MAX_CYCLOMATIC_COMPLEXITY: parseInt(process.env.MAX_COMPLEXITY || '10', 10),
  MAX_FUNCTION_LENGTH: parseInt(process.env.MAX_FUNCTION_LENGTH || '50', 10),
  MAX_CLASS_LENGTH: parseInt(process.env.MAX_CLASS_LENGTH || '200', 10),
  MAX_PARAMETERS: parseInt(process.env.MAX_PARAMETERS || '5', 10),
  MIN_TEST_COVERAGE: parseInt(process.env.MIN_COVERAGE || '80', 10),
} as const;

// ESLint rules configuration
export const ESLINT_CONFIG = {
  WRAPPER_PATTERNS: [
    /^Enhanced/,
    /^Extended/,
    /Wrapper$/,
    /Integration$/,
    /Adapter$/,
    /Proxy$/,
  ],
  DB_KEYWORDS: [
    'query', 'insert', 'update', 'delete', 'select',
    'raw', 'knex', 'sequelize', 'mongoose'
  ],
  VALID_ASYNC_PREFIXES: [
    'get', 'set', 'fetch', 'save', 'load', 'create', 'update', 'delete', 'remove',
    'process', 'handle', 'execute', 'run', 'start', 'stop', 'init', 'cleanup',
    'validate', 'check', 'verify', 'send', 'receive', 'subscribe', 'unsubscribe'
  ],
} as const;

// Monorepo package configuration
export const MONOREPO_CONFIG = {
  DEFAULT_PACKAGES: {
    '@your-org/core': {
      description: 'Core utilities and shared types',
      include: ['types/', 'interfaces/', 'utils/', 'constants/']
    },
    '@your-org/services': {
      description: 'Business logic services',
      include: ['services/', 'handlers/']
    },
    '@your-org/integrations': {
      description: 'External service integrations',
      include: ['integrations/', 'adapters/']
    },
    '@your-org/models': {
      description: 'Data models and schemas',
      include: ['models/', 'schemas/']
    },
    '@your-org/api': {
      description: 'API routes and controllers',
      include: ['api/', 'routes/', 'controllers/']
    }
  },
  PACKAGE_PREFIX: process.env.PACKAGE_PREFIX || '@your-org',
} as const;

// External URLs and resources
export const EXTERNAL_URLS = {
  TYPESCRIPT_DOCS: 'https://www.typescriptlang.org/docs/',
  TS_MORPH_DOCS: 'https://ts-morph.com/',
  TURBO_DOCS: 'https://turbo.build/repo/docs',
  NODEJS_DOWNLOAD: 'https://nodejs.org/',
  KEEP_CHANGELOG: 'https://keepachangelog.com/en/1.0.0/',
  SEMANTIC_VERSIONING: 'https://semver.org/spec/v2.0.0.html',
  CONVENTIONAL_COMMITS: 'https://conventionalcommits.org/',
} as const;

// Environment-specific configurations
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      LOG_LEVEL: 'debug',
      ENABLE_DASHBOARD: true,
      STRICT_MODE: false,
    },
    test: {
      LOG_LEVEL: 'error',
      ENABLE_DASHBOARD: false,
      STRICT_MODE: true,
    },
    production: {
      LOG_LEVEL: 'info',
      ENABLE_DASHBOARD: false,
      STRICT_MODE: true,
    },
  };

  return configs[env as keyof typeof configs] || configs.development;
};