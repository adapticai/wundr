'use client';

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react';

export interface AppConfig {
  apiUrl: string;
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  // General Settings
  language: string;
  autoSave: boolean;
  notifications: boolean;
  compactMode: boolean;
  sidebarCollapsed: boolean;
  // Analysis Settings
  duplicateThreshold: number;
  complexityThreshold: number;
  minFileSize: number;
  patternsToIgnore: string[];
  excludeDirectories: string[];
  includeFileTypes: string[];
  enableSmartAnalysis: boolean;
  analysisDepth: 'shallow' | 'medium' | 'deep';
  // Integration Settings
  webhookUrls: {
    onAnalysisComplete: string;
    onReportGenerated: string;
    onError: string;
  };
  apiKeys: {
    github: string;
    slack: string;
    jira: string;
  };
  automations: {
    autoUpload: boolean;
    scheduleAnalysis: boolean;
    notifyOnCompletion: boolean;
  };
  // Export Settings
  defaultFormats: ('json' | 'csv' | 'html' | 'pdf' | 'xml' | 'xlsx')[];
  defaultPath: string;
  includeMetadata: boolean;
  compressionEnabled: boolean;
  timestampFiles: boolean;
  maxFileSize: number;
  features: {
    analysis: boolean;
    reports: boolean;
    realtime: boolean;
  };
}

const defaultConfig: AppConfig = {
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

interface ConfigContextType {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  resetAll: () => Promise<void>;
  resetSection: (section: keyof AppConfig) => void;
  exportConfig: () => void;
  importConfig: (configData: string) => Promise<void>;
  applyTemplate: (template: any) => void;
  save: () => Promise<void>;
  isDirty: boolean;
  errors: Record<string, string>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [originalConfig, setOriginalConfig] =
    useState<AppConfig>(defaultConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDirty = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    // Clear related errors when field is updated
    const updatedFields = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => {
        delete newErrors[field];
      });
      return newErrors;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setErrors({});
  }, []);

  const resetAll = useCallback(async () => {
    try {
      setConfig(defaultConfig);
      setOriginalConfig(defaultConfig);
      setErrors({});
      // In a real app, you might want to persist this reset
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async operation
    } catch (error) {
      console.error('Reset failed:', error);
      throw error;
    }
  }, []);

  const resetSection = useCallback((section: keyof AppConfig) => {
    setConfig(prev => ({
      ...prev,
      [section]: defaultConfig[section],
    }));
    // Clear related errors when section is reset
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[section];
      return newErrors;
    });
  }, []);

  const exportConfig = useCallback(() => {
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wundr-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [config]);

  const importConfig = useCallback(async (configData: string) => {
    try {
      const parsedConfig = JSON.parse(configData);
      // Validate the config structure here if needed
      setConfig({ ...defaultConfig, ...parsedConfig });
      setErrors({});
    } catch (error) {
      console.error('Failed to import config:', error);
      setErrors({ import: 'Invalid configuration file format' });
      throw new Error('Invalid configuration file format');
    }
  }, []);

  const applyTemplate = useCallback((template: any) => {
    const templateConfig = template.config || template;
    setConfig(prev => ({ ...prev, ...templateConfig }));
    setErrors({});
  }, []);

  const save = useCallback(async () => {
    try {
      // In a real app, you would save to your backend here
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      setOriginalConfig(config);
      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      setErrors({ save: 'Failed to save configuration' });
      throw error;
    }
  }, [config]);

  const value: ConfigContextType = {
    config,
    updateConfig,
    resetConfig,
    resetAll,
    resetSection,
    exportConfig,
    importConfig,
    applyTemplate,
    save,
    isDirty,
    errors,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
