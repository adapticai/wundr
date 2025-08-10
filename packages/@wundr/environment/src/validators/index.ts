/**
 * Environment validation system
 */

import { EnvironmentConfig, ValidationResult, HealthCheckResult, SystemInfo } from '../types';
import { ToolManager } from '../core/tool-manager';
import { getSystemInfo } from '../utils/system';
import { createLogger } from '../utils/logger';

const logger = createLogger('Validator');

export class EnvironmentValidator {
  private toolManager: ToolManager;

  constructor() {
    this.toolManager = new ToolManager();
  }

  /**
   * Perform comprehensive environment validation
   */
  async validateEnvironment(config: EnvironmentConfig): Promise<HealthCheckResult> {
    logger.info('Starting comprehensive environment validation');

    const systemInfo = await getSystemInfo();
    const toolValidations = await this.validateAllTools(config);
    const platformValidation = this.validatePlatformCompatibility(config, systemInfo);
    const dependencyValidation = this.validateDependencies(config);

    const healthy = toolValidations.every(result => result.valid) && 
                   platformValidation.valid && 
                   dependencyValidation.valid;

    const recommendations: string[] = [];

    // Collect recommendations
    toolValidations.forEach(result => {
      if (result.suggestions) {
        recommendations.push(...result.suggestions);
      }
    });

    if (platformValidation.suggestions) {
      recommendations.push(...platformValidation.suggestions);
    }

    if (dependencyValidation.suggestions) {
      recommendations.push(...dependencyValidation.suggestions);
    }

    return {
      healthy,
      environment: config,
      tools: toolValidations,
      system: systemInfo,
      ...(recommendations.length > 0 && { recommendations })
    };
  }

  /**
   * Validate all tools in the configuration
   */
  private async validateAllTools(config: EnvironmentConfig): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const tool of config.tools) {
      try {
        const result = await this.toolManager.validateTool(tool);
        results.push(result);
      } catch (error) {
        logger.error(`Tool validation failed for ${tool.name}:`, error);
        results.push({
          valid: false,
          tool: tool.name,
          issues: [`Validation failed: ${error}`]
        });
      }
    }

    return results;
  }

  /**
   * Validate platform compatibility
   */
  private validatePlatformCompatibility(config: EnvironmentConfig, systemInfo: SystemInfo): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if current platform matches configuration
    if (config.platform !== systemInfo.platform) {
      issues.push(`Configuration platform (${config.platform}) doesn't match system platform (${systemInfo.platform})`);
      suggestions.push(`Update configuration to match system platform: ${systemInfo.platform}`);
    }

    // Check architecture compatibility
    if (systemInfo.architecture !== 'x64' && systemInfo.architecture !== 'arm64') {
      issues.push(`Unsupported architecture: ${systemInfo.architecture}`);
      suggestions.push('This environment manager supports x64 and arm64 architectures only');
    }

    // Platform-specific validations
    switch (systemInfo.platform) {
      case 'macos':
        return this.validateMacOSCompatibility(config, systemInfo, issues, suggestions);
      case 'linux':
        return this.validateLinuxCompatibility(config, systemInfo, issues, suggestions);
      case 'windows':
        return this.validateWindowsCompatibility(config, systemInfo, issues, suggestions);
      default:
        issues.push(`Unsupported platform: ${systemInfo.platform}`);
    }

    return {
      valid: issues.length === 0,
      tool: 'platform',
      ...(issues.length > 0 && { issues }),
      ...(suggestions.length > 0 && { suggestions })
    };
  }

  /**
   * Validate macOS compatibility
   */
  private validateMacOSCompatibility(
    config: EnvironmentConfig,
    systemInfo: SystemInfo,
    issues: string[],
    suggestions: string[]
  ): ValidationResult {
    // Check for Homebrew requirement
    const hasBrewTool = config.tools.some(tool => tool.installer === 'brew');
    if (hasBrewTool && !systemInfo.dockerVersion?.includes('not installed')) {
      suggestions.push('Consider using Homebrew for package management on macOS');
    }

    // Check Xcode Command Line Tools
    if (config.tools.some(tool => tool.name === 'git' || tool.name === 'node')) {
      suggestions.push('Ensure Xcode Command Line Tools are installed');
    }

    return {
      valid: issues.length === 0,
      tool: 'platform-macos',
      ...(issues.length > 0 && { issues }),
      ...(suggestions.length > 0 && { suggestions })
    };
  }

  /**
   * Validate Linux compatibility
   */
  private validateLinuxCompatibility(
    config: EnvironmentConfig,
    _systemInfo: SystemInfo,
    issues: string[],
    suggestions: string[]
  ): ValidationResult {
    // Check for common development tools
    suggestions.push('Ensure build-essential package is installed');
    
    // Check for snap/flatpak if needed
    if (config.tools.some(tool => tool.name === 'vscode')) {
      suggestions.push('VS Code can be installed via snap, flatpak, or distribution packages');
    }

    return {
      valid: issues.length === 0,
      tool: 'platform-linux',
      ...(issues.length > 0 && { issues }),
      ...(suggestions.length > 0 && { suggestions })
    };
  }

  /**
   * Validate Windows compatibility
   */
  private validateWindowsCompatibility(
    config: EnvironmentConfig,
    _systemInfo: SystemInfo,
    issues: string[],
    suggestions: string[]
  ): ValidationResult {
    // Check for Windows-specific tools
    suggestions.push('Consider installing Windows Subsystem for Linux (WSL2)');
    suggestions.push('PowerShell 7+ recommended for better cross-platform compatibility');

    if (config.tools.some(tool => tool.name === 'docker')) {
      suggestions.push('Docker Desktop requires Hyper-V or WSL2 backend');
    }

    return {
      valid: issues.length === 0,
      tool: 'platform-windows',
      ...(issues.length > 0 && { issues }),
      ...(suggestions.length > 0 && { suggestions })
    };
  }

  /**
   * Validate tool dependencies
   */
  private validateDependencies(config: EnvironmentConfig): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Create dependency map
    const toolMap = new Map(config.tools.map(tool => [tool.name, tool]));

    // Check dependencies
    for (const tool of config.tools) {
      if (tool.dependencies) {
        for (const depName of tool.dependencies) {
          const dependency = toolMap.get(depName);
          if (!dependency) {
            issues.push(`Tool ${tool.name} depends on ${depName} which is not configured`);
            suggestions.push(`Add ${depName} to your tool configuration`);
          } else if (!dependency.required && tool.required) {
            suggestions.push(`Consider making ${depName} required since ${tool.name} depends on it`);
          }
        }
      }
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(config.tools);
    if (circularDeps.length > 0) {
      issues.push(`Circular dependencies detected: ${circularDeps.join(' -> ')}`);
      suggestions.push('Remove circular dependencies from tool configuration');
    }

    return {
      valid: issues.length === 0,
      tool: 'dependencies',
      ...(issues.length > 0 && { issues }),
      ...(suggestions.length > 0 && { suggestions })
    };
  }

  /**
   * Detect circular dependencies in tool configuration
   */
  private detectCircularDependencies(tools: any[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const circularPath: string[] = [];

    const visit = (toolName: string, path: string[]): boolean => {
      if (visiting.has(toolName)) {
        // Found cycle
        const cycleStart = path.indexOf(toolName);
        circularPath.push(...path.slice(cycleStart), toolName);
        return true;
      }

      if (visited.has(toolName)) {
        return false;
      }

      visiting.add(toolName);
      const tool = tools.find(t => t.name === toolName);
      
      if (tool?.dependencies) {
        for (const dep of tool.dependencies) {
          if (visit(dep, [...path, toolName])) {
            return true;
          }
        }
      }

      visiting.delete(toolName);
      visited.add(toolName);
      return false;
    };

    // Check each tool for cycles
    for (const tool of tools) {
      if (!visited.has(tool.name)) {
        if (visit(tool.name, [])) {
          break;
        }
      }
    }

    return circularPath;
  }

  /**
   * Quick health check for essential tools
   */
  async quickHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    const essentialTools = ['node', 'npm', 'git'];

    for (const toolName of essentialTools) {
      try {
        const { success } = await this.executeCommand(`${toolName} --version`);
        if (!success) {
          issues.push(`${toolName} is not installed or not working`);
        }
      } catch (error) {
        issues.push(`Failed to check ${toolName}: ${error}`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  /**
   * Execute shell command for validation
   */
  private async executeCommand(command: string): Promise<{ success: boolean; output: string }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(command);
      return { success: true, output: stdout.toString().trim() };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }
}