/**
 * Tool installation and management system
 */

import { ToolConfiguration, Platform, InstallationResult, ValidationResult } from '../types';
import { BaseInstaller } from '../installers/base-installer';
import { BrewInstaller } from '../installers/brew-installer';
import { NpmInstaller } from '../installers/npm-installer';
import { ManualInstaller } from '../installers/manual-installer';
import { createLogger } from '../utils/logger';

const logger = createLogger('ToolManager');

export class ToolManager {
  private installers: Map<string, BaseInstaller> = new Map();

  constructor() {
    this.initializeInstallers();
  }

  /**
   * Install a tool using the appropriate installer
   */
  async installTool(tool: ToolConfiguration): Promise<InstallationResult> {
    logger.info(`Installing tool: ${tool.name}`);

    const installer = this.installers.get(tool.installer);
    if (!installer) {
      return {
        success: false,
        tool: tool.name,
        message: `Installer not found: ${tool.installer}`,
        errors: [`Unknown installer type: ${tool.installer}`]
      };
    }

    try {
      const result = await installer.install(tool);
      
      if (result.success) {
        logger.info(`Successfully installed ${tool.name}`);
        
        // Apply configuration if provided
        if (tool.config) {
          await this.applyToolConfiguration(tool);
        }
      } else {
        logger.error(`Failed to install ${tool.name}:`, result.message);
      }

      return result;
    } catch (error) {
      logger.error(`Installation error for ${tool.name}:`, error);
      return {
        success: false,
        tool: tool.name,
        message: `Installation failed: ${error}`,
        errors: [String(error)]
      };
    }
  }

  /**
   * Validate that a tool is properly installed
   */
  async validateTool(tool: ToolConfiguration): Promise<ValidationResult> {
    logger.debug(`Validating tool: ${tool.name}`);

    const installer = this.installers.get(tool.installer);
    if (!installer) {
      return {
        valid: false,
        tool: tool.name,
        issues: [`Unknown installer: ${tool.installer}`]
      };
    }

    try {
      return await installer.validate(tool);
    } catch (error) {
      logger.error(`Validation error for ${tool.name}:`, error);
      return {
        valid: false,
        tool: tool.name,
        issues: [`Validation failed: ${error}`]
      };
    }
  }

  /**
   * Check if tool is supported on the given platform
   */
  isToolSupported(tool: ToolConfiguration, platform: Platform): boolean {
    if (!tool.platform || tool.platform.length === 0) {
      return true; // Tool supports all platforms
    }
    return tool.platform.includes(platform);
  }

  /**
   * Sort tools by their dependencies
   */
  sortToolsByDependencies(tools: ToolConfiguration[]): ToolConfiguration[] {
    const sorted: ToolConfiguration[] = [];
    const visited: Set<string> = new Set();
    const visiting: Set<string> = new Set();

    const visit = (tool: ToolConfiguration) => {
      if (visiting.has(tool.name)) {
        throw new Error(`Circular dependency detected: ${tool.name}`);
      }
      
      if (visited.has(tool.name)) {
        return;
      }

      visiting.add(tool.name);

      // Visit dependencies first
      if (tool.dependencies) {
        for (const depName of tool.dependencies) {
          const dependency = tools.find(t => t.name === depName);
          if (dependency) {
            visit(dependency);
          } else {
            logger.warn(`Dependency not found: ${depName} for tool ${tool.name}`);
          }
        }
      }

      visiting.delete(tool.name);
      visited.add(tool.name);
      sorted.push(tool);
    };

    for (const tool of tools) {
      if (!visited.has(tool.name)) {
        visit(tool);
      }
    }

    return sorted;
  }

  /**
   * Get available installers
   */
  getAvailableInstallers(): string[] {
    return Array.from(this.installers.keys());
  }

  /**
   * Apply tool-specific configuration
   */
  private async applyToolConfiguration(tool: ToolConfiguration): Promise<void> {
    logger.info(`Applying configuration for ${tool.name}`);

    switch (tool.name) {
      case 'vscode':
        await this.configureVSCode(tool.config);
        break;
      case 'git':
        await this.configureGit(tool.config);
        break;
      case 'claude-code':
        await this.configureClaudeCode(tool.config);
        break;
      default:
        logger.debug(`No specific configuration handler for ${tool.name}`);
    }
  }

  /**
   * Configure VS Code extensions and settings
   */
  private async configureVSCode(config?: Record<string, unknown>): Promise<void> {
    if (!config) return;

    const vscodeInstaller = this.installers.get('manual') as ManualInstaller;
    if (vscodeInstaller && config.extensions && Array.isArray(config.extensions)) {
      await vscodeInstaller.installVSCodeExtensions(config.extensions as string[]);
    }

    if (config.settings && typeof config.settings === 'object' && config.settings !== null) {
      await vscodeInstaller.applyVSCodeSettings(config.settings as Record<string, unknown>);
    }
  }

  /**
   * Configure Git settings
   */
  private async configureGit(config?: Record<string, unknown>): Promise<void> {
    if (!config) return;
    // Git configuration will be handled by specific installer
  }

  /**
   * Configure Claude Code
   */
  private async configureClaudeCode(config?: Record<string, unknown>): Promise<void> {
    if (!config) return;
    // Claude Code configuration
  }

  /**
   * Initialize available installers
   */
  private initializeInstallers(): void {
    this.installers.set('brew', new BrewInstaller());
    this.installers.set('npm', new NpmInstaller());
    this.installers.set('manual', new ManualInstaller());

    logger.info('Tool installers initialized');
  }
}