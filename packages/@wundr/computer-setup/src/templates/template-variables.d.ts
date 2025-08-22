import { DeveloperProfile } from '../types/index.js';
import { TemplateContext } from './template-manager.js';
/**
 * Get default template variables for common configurations
 */
export declare function getDefaultTemplateVariables(profile: DeveloperProfile, projectType?: string): Record<string, any>;
/**
 * Create a complete template context with sensible defaults
 */
export declare function createDefaultTemplateContext(profile: DeveloperProfile, projectName: string, projectType?: string): TemplateContext;
/**
 * Get template variables for specific configurations
 */
export declare function getConfigTemplateVariables(configType: string, profile: DeveloperProfile, projectType?: string): Record<string, any>;
//# sourceMappingURL=template-variables.d.ts.map