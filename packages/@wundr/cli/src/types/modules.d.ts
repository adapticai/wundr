// Type declarations for external modules
declare module '@wundr/computer-setup' {
  export class ComputerSetupManager {
    static getInstance(): ComputerSetupManager;
    initialize(): Promise<void>;
    validateSetup(profile?: any): Promise<boolean>;
    cleanup(): Promise<void>;
    getProfile(name: string): Promise<any>;
    getDefaultProfile(): Promise<any>;
    getAvailableProfiles(): Promise<any[]>;
    setup(profile: any): Promise<{
      success: boolean;
      completedSteps?: any[];
      skippedSteps?: any[];
      failedSteps?: any[];
      warnings?: string[];
      errors?: string[];
      report?: any;
    }>;
    on(event: string, callback: Function): void;
  }
}

declare module '@wundr/core' {
  export interface CoreConfig {
    [key: string]: any;
  }
  export const defaultConfig: CoreConfig;
  export function getLogger(name: string): any;
}

declare module '@wundr/project-templates' {
  export interface TemplateConfig {
    name: string;
    description: string;
    files: Array<{ path: string; content: string }>;
    [key: string]: any;
  }
  export function getTemplate(name: string): TemplateConfig | null;
  export function listTemplates(): string[];
  export const projectTemplates: Record<string, any>;
}

declare module 'open' {
  interface Options {
    app?: string | string[];
    wait?: boolean;
    background?: boolean;
    url?: boolean;
  }
  function open(
    target: string,
    options?: Options
  ): Promise<import('child_process').ChildProcess>;
  export = open;
}
