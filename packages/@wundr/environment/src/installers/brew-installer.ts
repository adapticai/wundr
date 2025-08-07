/**
 * Homebrew installer for macOS and Linux
 */

import { ToolConfiguration, InstallationResult, ValidationResult } from '../types';
import { BaseInstaller } from './base-installer';
import { createLogger } from '../utils/logger';

const logger = createLogger('BrewInstaller');

export class BrewInstaller extends BaseInstaller {
  async install(tool: ToolConfiguration): Promise<InstallationResult> {
    logger.info(`Installing ${tool.name} via Homebrew`);

    // Check if Homebrew is available
    if (!(await this.isAvailable())) {
      return {
        success: false,
        tool: tool.name,
        message: 'Homebrew is not installed',
        errors: ['Homebrew must be installed first']
      };
    }

    const installCommand = this.getInstallCommand(tool);
    const result = await this.executeCommand(installCommand);

    if (result.success) {
      // Verify installation
      const validation = await this.validate(tool);
      if (validation.valid) {
        return {
          success: true,
          tool: tool.name,
          version: validation.version,
          message: `Successfully installed ${tool.name}`,
          warnings: result.stderr ? [result.stderr] : undefined
        };
      } else {
        return {
          success: false,
          tool: tool.name,
          message: 'Installation completed but validation failed',
          errors: validation.issues
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
        suggestions: [`Install ${tool.name} using: brew install ${this.getBrewPackageName(tool.name)}`]
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
        suggestions: [`Update ${tool.name}: brew upgrade ${this.getBrewPackageName(tool.name)}`]
      };
    }

    return {
      valid: true,
      tool: tool.name,
      version
    };
  }

  async isAvailable(): Promise<boolean> {
    return await this.commandExists('brew');
  }

  /**
   * Get brew install command for the tool
   */
  private getInstallCommand(tool: ToolConfiguration): string {
    const packageName = this.getBrewPackageName(tool.name);
    const caskFlag = this.isCaskPackage(tool.name) ? '--cask' : '';
    
    return `brew install ${caskFlag} ${packageName}`.trim();
  }

  /**
   * Get Homebrew package name (may differ from tool name)
   */
  private getBrewPackageName(toolName: string): string {
    const packageMap: Record<string, string> = {
      'node': 'node@18', // Default to LTS
      'vscode': 'visual-studio-code',
      'docker': 'docker',
      'docker-compose': 'docker-compose',
      'claude-code': 'claude-ai/claude-code/claude-code'
    };

    return packageMap[toolName] || toolName;
  }

  /**
   * Check if package should be installed as cask
   */
  private isCaskPackage(toolName: string): boolean {
    const caskPackages = ['vscode', 'docker', 'slack'];
    return caskPackages.includes(toolName);
  }

  /**
   * Get command name for validation
   */
  private getCommandName(toolName: string): string {
    const commandMap: Record<string, string> = {
      'vscode': 'code',
      'docker-compose': 'docker-compose',
      'claude-code': 'claude'
    };

    return commandMap[toolName] || toolName;
  }

  /**
   * Get version command for the tool
   */
  private getVersionCommand(toolName: string): string {
    const versionCommands: Record<string, string> = {
      'node': 'node --version',
      'npm': 'npm --version',
      'pnpm': 'pnpm --version',
      'yarn': 'yarn --version',
      'git': 'git --version',
      'docker': 'docker --version',
      'docker-compose': 'docker-compose --version',
      'vscode': 'code --version',
      'claude-code': 'claude --version',
      'gh': 'gh --version'
    };

    return versionCommands[toolName] || `${toolName} --version`;
  }

  /**
   * Extract version from command output
   */
  private extractVersion(output: string): string {
    // Remove common prefixes and extract version number
    const cleaned = output.replace(/^v?([0-9]+\\.[0-9]+\\.[0-9]+).*$/m, '$1');
    const match = cleaned.match(/([0-9]+\\.[0-9]+\\.[0-9]+)/);
    return match ? match[1] : output.trim();
  }
}