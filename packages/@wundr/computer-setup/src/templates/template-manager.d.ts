import { DeveloperProfile } from '../types/index.js';
export interface TemplateVariable {
    name: string;
    value: any;
    type: 'string' | 'boolean' | 'number' | 'array' | 'object';
}
export interface TemplateContext {
    profile: DeveloperProfile;
    project: ProjectInfo;
    platform: PlatformInfo;
    customVariables?: Record<string, any>;
}
export interface ProjectInfo {
    name: string;
    description: string;
    version: string;
    type: 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java';
    packageManager: 'npm' | 'pnpm' | 'yarn';
    repository?: string;
    license: string;
    author: string;
    organization?: string;
}
export interface PlatformInfo {
    os: 'darwin' | 'linux' | 'win32';
    arch: 'x64' | 'arm64';
    nodeVersion: string;
    shell: 'bash' | 'zsh' | 'fish';
}
export interface TemplateOptions {
    templateDir: string;
    outputDir: string;
    context: TemplateContext;
    dryRun?: boolean;
    verbose?: boolean;
    overwrite?: boolean;
}
export declare class TemplateManager {
    private readonly templatesDir;
    constructor(templatesDir?: string);
    /**
     * Copy and customize templates for a project
     */
    copyTemplates(options: TemplateOptions): Promise<void>;
    /**
     * Copy specific template file with customization
     */
    copyTemplate(templateName: string, outputPath: string, context: TemplateContext, options?: {
        overwrite?: boolean;
        verbose?: boolean;
    }): Promise<void>;
    /**
     * Generate configuration files for a project
     */
    generateConfigs(projectPath: string, context: TemplateContext, configs: string[]): Promise<void>;
    /**
     * Generate a specific configuration file
     */
    private generateConfig;
    /**
     * Copy GitHub templates (issue templates, PR template)
     */
    private copyGitHubTemplates;
    /**
     * Process directory recursively
     */
    private processDirectory;
    /**
     * Process individual file
     */
    private processFile;
    /**
     * Replace template variables in content
     */
    private replaceVariables;
    /**
     * Process conditional template blocks
     */
    private processConditionals;
    /**
     * Process array template blocks
     */
    private processArrays;
    /**
     * Build variable map from context
     */
    private buildVariableMap;
    /**
     * Check if value is truthy for template conditions
     */
    private isTruthy;
    /**
     * Get template path
     */
    private getTemplatePath;
    /**
     * List available templates
     */
    listTemplates(): Promise<string[]>;
}
export default TemplateManager;
//# sourceMappingURL=template-manager.d.ts.map