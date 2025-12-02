/**
 * Project Templates Manager
 * Handles creation of wundr-compliant projects
 */
import type { ProjectOptions } from './types';
export declare class ProjectTemplateManager {
    private templates;
    constructor();
    /**
     * Register all available templates
     */
    private registerTemplates;
    /**
     * Create a new project from template
     */
    createProject(options: ProjectOptions): Promise<void>;
    /**
     * Interactive project creation
     */
    createInteractive(): Promise<void>;
    /**
     * Validate project name
     */
    private validateProjectName;
    /**
     * Get template key based on type and framework
     */
    private getTemplateKey;
    /**
     * Get framework choices based on project type
     */
    private getFrameworkChoices;
    /**
     * Create template context for handlebars
     */
    private createTemplateContext;
    /**
     * Create package.json
     */
    private createPackageJson;
    /**
     * Copy template files
     */
    private copyTemplateFiles;
    /**
     * Add wundr-specific files
     */
    private addWundrFiles;
    /**
     * Initialize git repository
     */
    private initializeGit;
    /**
     * Install dependencies
     */
    private installDependencies;
    /**
     * Run post-install commands
     */
    private runPostInstall;
    /**
     * Create initial governance baseline
     */
    private createGovernanceBaseline;
    /**
     * Detect package manager
     */
    private detectPackageManager;
    /**
     * List available templates
     */
    listTemplates(): void;
}
export declare const projectTemplates: ProjectTemplateManager;
//# sourceMappingURL=index.d.ts.map