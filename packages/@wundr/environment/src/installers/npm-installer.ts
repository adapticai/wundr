/**
 * NPM installer for Node.js packages
 */

import { ToolConfiguration, InstallationResult, ValidationResult } from '../types';
import { BaseInstaller } from './base-installer';
import { createLogger } from '../utils/logger';

const logger = createLogger('NpmInstaller');

export class NpmInstaller extends BaseInstaller {
  async install(tool: ToolConfiguration): Promise<InstallationResult> {
    logger.info(`Installing ${tool.name} via NPM`);

    if (!(await this.isAvailable())) {
      return {
        success: false,
        tool: tool.name,
        message: 'NPM is not available',
        errors: ['Node.js and NPM must be installed first']
      };
    }

    const packageName = this.getPackageName(tool.name);
    const installCommand = `npm install -g ${packageName}`;
    
    const result = await this.executeCommand(installCommand);

    if (result.success) {
      const validation = await this.validate(tool);
      if (validation.valid) {
        return {
          success: true,
          tool: tool.name,
          ...(validation.version && { version: validation.version }),
          message: `Successfully installed ${tool.name}`,
          ...(result.stderr && { warnings: [result.stderr] })
        };
      } else {
        return {
          success: false,
          tool: tool.name,
          message: 'Installation completed but validation failed',
          ...(validation.issues && { errors: validation.issues })
        };
      }
    }

    return {
      success: false,
      tool: tool.name,
      message: `Failed to install ${tool.name}`,
      errors: [result.stderr || 'Unknown error']
    };
  }

  async validate(tool: ToolConfiguration): Promise<ValidationResult> {
    const commandName = this.getCommandName(tool.name);
    const exists = await this.commandExists(commandName);

    if (!exists) {
      return {
        valid: false,
        tool: tool.name,
        issues: [`Command '${commandName}' not found in PATH`],
        suggestions: [`Install ${tool.name} using: npm install -g ${this.getPackageName(tool.name)}`]
      };
    }

    // Get version
    const versionCommand = this.getVersionCommand(tool.name);
    const versionResult = await this.executeCommand(versionCommand);
    
    if (!versionResult.success) {
      return {
        valid: false,
        tool: tool.name,
        issues: ['Could not determine version'],
        suggestions: [`Verify ${tool.name} installation`]
      };
    }

    const version = this.extractVersion(versionResult.stdout);
    const versionValid = this.validateVersion(version, tool.version);

    if (!versionValid) {
      return {
        valid: false,
        tool: tool.name,
        version,
        issues: [`Version ${version} does not meet requirement ${tool.version}`],
        suggestions: [`Update ${tool.name}: npm update -g ${this.getPackageName(tool.name)}`]
      };
    }

    return {
      valid: true,
      tool: tool.name,
      version
    };
  }

  async isAvailable(): Promise<boolean> {
    return await this.commandExists('npm');
  }

  /**
   * Get NPM package name (may differ from tool name)
   */
  private getPackageName(toolName: string): string {
    const packageMap: Record<string, string> = {
      'pnpm': '@pnpm/exe',
      'yarn': 'yarn',
      'claude-flow': 'claude-flow@alpha',
      'typescript': 'typescript',
      'eslint': 'eslint',
      'prettier': 'prettier'
    };

    return packageMap[toolName] || toolName;
  }

  /**
   * Get command name for validation
   */
  private getCommandName(toolName: string): string {
    const commandMap: Record<string, string> = {
      'claude-flow': 'claude-flow'
    };

    return commandMap[toolName] || toolName;
  }

  /**
   * Get version command for the tool
   */
  private getVersionCommand(toolName: string): string {
    const versionCommands: Record<string, string> = {
      'pnpm': 'pnpm --version',
      'yarn': 'yarn --version',
      'claude-flow': 'claude-flow --version',
      'typescript': 'tsc --version',
      'eslint': 'eslint --version',
      'prettier': 'prettier --version'
    };

    return versionCommands[toolName] || `${toolName} --version`;
  }

  /**
   * Extract version from command output
   */
  private extractVersion(output: string): string {
    const match = output.match(/([0-9]+\\.[0-9]+\\.[0-9]+)/);
    return match?.[1] || output.trim();
  }
}