export interface GeneralSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  notifications: boolean;
  compactMode: boolean;
  sidebarCollapsed: boolean;
}

export interface AnalysisSettings {
  patternsToIgnore: string[];
  duplicateThreshold: number;
  complexityThreshold: number;
  minFileSize: number;
  excludeDirectories: string[];
  includeFileTypes: string[];
  enableSmartAnalysis: boolean;
  analysisDepth: 'shallow' | 'medium' | 'deep';
}

export interface IntegrationSettings {
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
}

export interface ExportSettings {
  defaultFormats: ('json' | 'csv' | 'html' | 'pdf')[];
  defaultPath: string;
  includeMetadata: boolean;
  compressionEnabled: boolean;
  timestampFiles: boolean;
  maxFileSize: number;
}

export interface ConfigurationState {
  general: GeneralSettings;
  analysis: AnalysisSettings;
  integration: IntegrationSettings;
  export: ExportSettings;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<ConfigurationState>;
  tags: string[];
}

export interface ConfigContextType {
  config: ConfigurationState;
  updateConfig: <T extends keyof ConfigurationState>(
    section: T,
    updates: Partial<ConfigurationState[T]>
  ) => void;
  resetSection: (section: keyof ConfigurationState) => void;
  resetAll: () => void;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
  applyTemplate: (template: ConfigTemplate) => void;
  isDirty: boolean;
  save: () => Promise<void>;
  errors: Record<string, string>;
}

export interface ValidationError {
  field: string;
  message: string;
  section: keyof ConfigurationState;
}