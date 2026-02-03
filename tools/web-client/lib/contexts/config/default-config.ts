import { AppConfig } from './config-context';
import { templates } from './config-templates';

// Re-export templates for backward compatibility
export const configTemplates = templates.reduce(
  (acc, template) => {
    acc[template.id] = template;
    return acc;
  },
  {} as Record<string, any>
);

// Default configuration values
export const defaultConfig: AppConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  theme: 'system',
  sidebarOpen: true,

  // General Settings
  language: 'en',
  autoSave: true,
  notifications: true,
  compactMode: false,
  sidebarCollapsed: false,

  // Analysis Settings
  duplicateThreshold: 0.8,
  complexityThreshold: 10,
  minFileSize: 1000,
  patternsToIgnore: ['node_modules/**', 'dist/**', 'build/**'],
  excludeDirectories: ['node_modules', 'dist', 'build'],
  includeFileTypes: ['.ts', '.tsx', '.js', '.jsx'],
  enableSmartAnalysis: false,
  analysisDepth: 'medium',

  // Integration Settings
  webhookUrls: {
    onAnalysisComplete: '',
    onReportGenerated: '',
    onError: '',
  },
  apiKeys: {
    github: '',
    slack: '',
    jira: '',
  },
  automations: {
    autoUpload: false,
    scheduleAnalysis: false,
    notifyOnCompletion: false,
  },

  // Export Settings
  defaultFormats: ['json', 'html'],
  defaultPath: './wundr-reports',
  includeMetadata: true,
  compressionEnabled: false,
  timestampFiles: true,
  maxFileSize: 100,

  features: {
    analysis: true,
    reports: true,
    realtime: true,
  },
};

// Configuration presets for different environments
export const developmentConfig: Partial<AppConfig> = {
  theme: 'dark',
  autoSave: true,
  notifications: true,
  enableSmartAnalysis: true,
  analysisDepth: 'medium',
};

export const productionConfig: Partial<AppConfig> = {
  theme: 'light',
  autoSave: false,
  notifications: false,
  enableSmartAnalysis: false,
  analysisDepth: 'shallow',
  compressionEnabled: true,
};

export const testConfig: Partial<AppConfig> = {
  theme: 'system',
  autoSave: false,
  notifications: false,
  enableSmartAnalysis: false,
  analysisDepth: 'shallow',
  minFileSize: 0,
  includeMetadata: false,
};

// Helper functions
export const getConfigForEnvironment = (
  env: 'development' | 'production' | 'test'
): AppConfig => {
  const envConfigs = {
    development: developmentConfig,
    production: productionConfig,
    test: testConfig,
  };

  return {
    ...defaultConfig,
    ...envConfigs[env],
  };
};

export const validateConfigStructure = (config: any): config is AppConfig => {
  const requiredFields = [
    'apiUrl',
    'theme',
    'sidebarOpen',
    'language',
    'autoSave',
    'notifications',
    'compactMode',
    'sidebarCollapsed',
    'duplicateThreshold',
    'complexityThreshold',
    'minFileSize',
    'features',
  ];

  return requiredFields.every(field => field in config);
};
