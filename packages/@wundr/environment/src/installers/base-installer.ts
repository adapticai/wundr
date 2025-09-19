/**
 * Base installer interface and common functionality
 */

import {
  ToolConfiguration,
  InstallationResult,
  ValidationResult,
} from '../types';

export abstract class BaseInstaller {
  abstract install(tool: ToolConfiguration): Promise<InstallationResult>;
  abstract validate(tool: ToolConfiguration): Promise<ValidationResult>;
  abstract isAvailable(): Promise<boolean>;

  /**
   * Common validation for version requirements
   */
  protected validateVersion(
    currentVersion: string,
    requiredVersion?: string
  ): boolean {
    if (!requiredVersion) return true;

    // Simple version comparison (can be enhanced with semver)
    const current = this.parseVersion(currentVersion);
    const required = this.parseVersion(
      requiredVersion.replace(/^>=?|^~|^\\^/, '')
    );

    return this.compareVersions(current, required) >= 0;
  }

  /**
   * Parse version string into comparable format
   */
  protected parseVersion(version: string): number[] {
    return version
      .replace(/^v/, '')
      .split('.')
      .map(part => parseInt(part.replace(/\\D+$/, ''), 10) || 0);
  }

  /**
   * Compare two version arrays
   */
  protected compareVersions(a: number[], b: number[]): number {
    const maxLength = Math.max(a.length, b.length);

    for (let i = 0; i < maxLength; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;

      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }

    return 0;
  }

  /**
   * Execute shell command and return result
   */
  protected async executeCommand(command: string): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
  }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      };
    } catch (error: unknown) {
      return {
        success: false,
        stdout: (error as { stdout?: Buffer }).stdout?.toString() || '',
        stderr:
          (error as { stderr?: Buffer }).stderr?.toString() || String(error),
      };
    }
  }

  /**
   * Check if command exists in PATH
   */
  protected async commandExists(command: string): Promise<boolean> {
    const { success } = await this.executeCommand(`which ${command}`);
    return success;
  }
}
