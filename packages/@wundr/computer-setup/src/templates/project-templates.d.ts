import { DeveloperProfile } from '../types/index.js';
export interface ProjectTemplateOptions {
    projectPath: string;
    profile: DeveloperProfile;
    projectType: 'node' | 'react' | 'vue' | 'python' | 'go' | 'rust' | 'java';
    includeDocker?: boolean;
    includeGitHub?: boolean;
    includeSlack?: boolean;
    includeClaudeFlow?: boolean;
    overwrite?: boolean;
    verbose?: boolean;
}
/**
 * Create templates for a new project based on developer profile and project type
 */
export declare function createProjectTemplates(options: ProjectTemplateOptions): Promise<void>;
//# sourceMappingURL=project-templates.d.ts.map