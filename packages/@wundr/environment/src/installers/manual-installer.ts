/**
 * Manual installer for tools that require special setup procedures
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ToolConfiguration, InstallationResult, ValidationResult } from '../types';
import { BaseInstaller } from './base-installer';
import { createLogger } from '../utils/logger';

const logger = createLogger('ManualInstaller');

export class ManualInstaller extends BaseInstaller {
  async install(tool: ToolConfiguration): Promise<InstallationResult> {
    logger.info(`Manual installation for ${tool.name}`);

    switch (tool.name) {
      case 'homebrew':
        return await this.installHomebrew();
      case 'vscode-extensions':
        return await this.installVSCodeExtensions(tool.config?.extensions || []);
      default:
        return {
          success: false,
          tool: tool.name,
          message: `Manual installation not implemented for ${tool.name}`,
          errors: [`No manual installer available for ${tool.name}`]
        };
    }
  }

  async validate(tool: ToolConfiguration): Promise<ValidationResult> {
    switch (tool.name) {
      case 'homebrew':
        return await this.validateHomebrew();
      case 'vscode-extensions':
        return await this.validateVSCodeExtensions(tool.config?.extensions || []);
      default:
        return {
          valid: false,
          tool: tool.name,
          issues: [`Manual validation not implemented for ${tool.name}`]
        };
    }
  }

  async isAvailable(): Promise<boolean> {
    // Manual installer is always "available" but may not be able to install specific tools
    return true;
  }

  /**
   * Install Homebrew
   */
  private async installHomebrew(): Promise<InstallationResult> {
    const exists = await this.commandExists('brew');
    
    if (exists) {
      return {
        success: true,
        tool: 'homebrew',
        message: 'Homebrew is already installed'
      };
    }

    const installCommand = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
    const result = await this.executeCommand(installCommand);

    if (result.success) {
      return {
        success: true,
        tool: 'homebrew',
        message: 'Homebrew installed successfully',
        warnings: ['Please restart your terminal or run: eval "$(/opt/homebrew/bin/brew shellenv)"']
      };
    }

    return {
      success: false,
      tool: 'homebrew',
      message: 'Failed to install Homebrew',
      errors: [result.stderr || 'Unknown error']
    };
  }

  /**
   * Validate Homebrew installation
   */
  private async validateHomebrew(): Promise<ValidationResult> {
    const exists = await this.commandExists('brew');
    
    if (!exists) {
      return {
        valid: false,
        tool: 'homebrew',
        issues: ['Homebrew is not installed'],
        suggestions: ['Install Homebrew from https://brew.sh/']
      };
    }

    const versionResult = await this.executeCommand('brew --version');
    if (!versionResult.success) {
      return {
        valid: false,
        tool: 'homebrew',
        issues: ['Could not determine Homebrew version']
      };
    }

    const version = this.extractVersion(versionResult.stdout);
    return {
      valid: true,
      tool: 'homebrew',
      version
    };
  }

  /**
   * Install VS Code extensions
   */
  async installVSCodeExtensions(extensions: string[]): Promise<InstallationResult> {
    const codeExists = await this.commandExists('code');
    
    if (!codeExists) {
      return {
        success: false,
        tool: 'vscode-extensions',
        message: 'VS Code is not installed',
        errors: ['Install VS Code first']
      };
    }

    const results: string[] = [];
    const errors: string[] = [];

    for (const extension of extensions) {
      logger.info(`Installing VS Code extension: ${extension}`);
      const result = await this.executeCommand(`code --install-extension ${extension}`);
      
      if (result.success) {
        results.push(`Installed ${extension}`);
      } else {
        errors.push(`Failed to install ${extension}: ${result.stderr}`);
      }
    }

    return {
      success: errors.length === 0,
      tool: 'vscode-extensions',
      message: `Processed ${extensions.length} extensions`,
      warnings: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validate VS Code extensions
   */
  private async validateVSCodeExtensions(extensions: string[]): Promise<ValidationResult> {
    const codeExists = await this.commandExists('code');
    
    if (!codeExists) {
      return {
        valid: false,
        tool: 'vscode-extensions',
        issues: ['VS Code is not installed']
      };
    }

    const result = await this.executeCommand('code --list-extensions');
    if (!result.success) {
      return {
        valid: false,
        tool: 'vscode-extensions',
        issues: ['Could not list VS Code extensions']
      };
    }

    const installedExtensions = result.stdout.toLowerCase().split('\\n');
    const missingExtensions: string[] = [];

    for (const extension of extensions) {
      if (!installedExtensions.some(installed => installed.includes(extension.toLowerCase()))) {
        missingExtensions.push(extension);
      }
    }

    if (missingExtensions.length > 0) {
      return {
        valid: false,
        tool: 'vscode-extensions',
        issues: [`Missing extensions: ${missingExtensions.join(', ')}`],
        suggestions: [`Install missing extensions: code --install-extension ${missingExtensions.join(' ')}`]
      };
    }

    return {
      valid: true,
      tool: 'vscode-extensions'
    };
  }

  /**
   * Apply VS Code settings
   */
  async applyVSCodeSettings(settings: Record<string, any>): Promise<void> {
    const settingsPath = join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    
    try {
      let existingSettings = {};
      
      try {
        const existingData = await fs.readFile(settingsPath, 'utf8');
        existingSettings = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist or is invalid JSON, start with empty object
      }

      const mergedSettings = { ...existingSettings, ...settings };
      await fs.mkdir(join(settingsPath, '..'), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2));
      
      logger.info('VS Code settings applied');
    } catch (error) {
      logger.error('Failed to apply VS Code settings:', error);
      throw error;
    }
  }

  /**
   * Extract version from command output
   */
  private extractVersion(output: string): string {
    const match = output.match(/Homebrew ([0-9]+\\.[0-9]+\\.[0-9]+)/);
    return match ? match[1] : output.split('\\n')[0].trim();
  }
}