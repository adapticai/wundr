/**
 * Installer Registry - Central hub for managing all platform installers
 */
import { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import { NodeInstaller } from './node-installer';
import { DockerInstaller } from './docker-installer';
import { GitInstaller } from './git-installer';
import { HomebrewInstaller } from './homebrew-installer';
import { PythonInstaller } from './python-installer';
import { MacInstaller } from './mac-installer';
import { LinuxInstaller } from './linux-installer';
import { WindowsInstaller } from './windows-installer';
import ClaudeInstaller from './claude-installer';

export interface BaseInstaller {
  name: string;
  isSupported(platform: SetupPlatform): boolean;
  isInstalled(): Promise<boolean>;
  getVersion(): Promise<string | null>;
  install(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
  configure?(profile: DeveloperProfile, platform: SetupPlatform): Promise<void>;
  validate(): Promise<boolean>;
  uninstall?(): Promise<void>;
  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[];
}

export class InstallerRegistry {
  private installers = new Map<string, BaseInstaller>();
  private platform: SetupPlatform;

  constructor(platform: SetupPlatform) {
    this.platform = platform;
    this.registerCoreInstallers();
    this.registerPlatformInstallers();
  }

  /**
   * Register core cross-platform installers
   */
  private registerCoreInstallers(): void {
    // System package managers
    if (['darwin', 'linux'].includes(this.platform.os)) {
      this.register('homebrew', new HomebrewInstaller());
    }
    
    // Development tools
    this.register('git', new GitInstaller());
    this.register('node', new NodeInstaller());
    this.register('python', new PythonInstaller());
    this.register('docker', new DockerInstaller());
    this.register('claude', ClaudeInstaller);
  }

  /**
   * Register platform-specific installers
   */
  private registerPlatformInstallers(): void {
    switch (this.platform.os) {
      case 'darwin':
        this.register('platform', new MacInstaller());
        break;
      case 'linux':
        this.register('platform', new LinuxInstaller());
        break;
      case 'win32':
        this.register('platform', new WindowsInstaller());
        break;
    }
  }

  /**
   * Register a new installer
   */
  register(name: string, installer: BaseInstaller): void {
    if (!installer.isSupported(this.platform)) {
      throw new Error(`Installer ${name} is not supported on ${this.platform.os}`);
    }
    this.installers.set(name, installer);
  }

  /**
   * Get installer by name
   */
  get(name: string): BaseInstaller | undefined {
    return this.installers.get(name);
  }

  /**
   * Get all registered installers
   */
  getAll(): Map<string, BaseInstaller> {
    return new Map(this.installers);
  }

  /**
   * Get installers by category
   */
  getByCategory(_category: string): BaseInstaller[] {
    return Array.from(this.installers.values()).filter(_installer => {
      // This would require extending BaseInstaller with category info
      return true; // Placeholder
    });
  }

  /**
   * Check if installer is available
   */
  has(name: string): boolean {
    return this.installers.has(name);
  }

  /**
   * Get installation steps for a profile
   */
  async getInstallationSteps(profile: DeveloperProfile): Promise<SetupStep[]> {
    const steps: SetupStep[] = [];
    
    Array.from(this.installers.entries()).forEach(([_name, installer]) => {
      const installerSteps = installer.getSteps(profile, this.platform);
      steps.push(...installerSteps);
    });

    return this.sortStepsByDependencies(steps);
  }

  /**
   * Sort steps by dependencies to ensure proper installation order
   */
  private sortStepsByDependencies(steps: SetupStep[]): SetupStep[] {
    const sorted: SetupStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: SetupStep) => {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected for step: ${step.id}`);
      }
      if (visited.has(step.id)) {
        return;
      }

      visiting.add(step.id);

      // Process dependencies first
      for (const depId of step.dependencies) {
        const depStep = steps.find(s => s.id === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step);
      }
    }

    return sorted;
  }

  /**
   * Get system setup steps
   */
  async getSystemSteps(platform: SetupPlatform): Promise<SetupStep[]> {
    const installer = this.installers.get('platform');
    if (!installer) return [];
    return installer.getSteps({} as DeveloperProfile, platform);
  }

  /**
   * Get Node.js setup steps
   */
  async getNodeSteps(nodeConfig: any): Promise<SetupStep[]> {
    const installer = this.installers.get('node');
    if (!installer) return [];
    const profile = { tools: { languages: { node: nodeConfig } } } as any;
    return installer.getSteps(profile, this.platform);
  }

  /**
   * Get Python setup steps
   */
  async getPythonSteps(pythonConfig: any): Promise<SetupStep[]> {
    // Python installer not yet implemented
    return [];
  }

  /**
   * Get Homebrew setup steps
   */
  async getBrewSteps(): Promise<SetupStep[]> {
    // Brew installer handled by MacInstaller
    return [];
  }

  /**
   * Get Docker setup steps
   */
  async getDockerSteps(): Promise<SetupStep[]> {
    const installer = this.installers.get('docker');
    if (!installer) return [];
    return installer.getSteps({} as DeveloperProfile, this.platform);
  }

  /**
   * Get Claude Code setup steps
   */
  async getClaudeCodeSteps(): Promise<SetupStep[]> {
    const installer = this.installers.get('claude');
    if (!installer) return [];
    return installer.getSteps({} as DeveloperProfile, this.platform);
  }

  /**
   * Get Claude Flow setup steps
   */
  async getClaudeFlowSteps(swarmAgents?: string[]): Promise<SetupStep[]> {
    const installer = this.installers.get('claude');
    if (!installer) return [];
    const profile = { aiTools: { claudeFlow: { agents: swarmAgents } } } as any;
    return installer.getSteps(profile, this.platform);
  }

  /**
   * Get Slack setup steps
   */
  async getSlackSteps(): Promise<SetupStep[]> {
    // Slack installer to be implemented
    return [];
  }

  /**
   * Validate all installers on current platform
   */
  async validateAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    const promises = Array.from(this.installers.entries()).map(async ([name, installer]) => {
      try {
        results[name] = await installer.validate();
      } catch (error) {
        results[name] = false;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get system information and requirements
   */
  async getSystemInfo(): Promise<{
    platform: SetupPlatform;
    installedTools: Record<string, string>;
    missingTools: string[];
  }> {
    const installedTools: Record<string, string> = {};
    const missingTools: string[] = [];

    const promises = Array.from(this.installers.entries()).map(async ([name, installer]) => {
      const isInstalled = await installer.isInstalled();
      if (isInstalled) {
        const version = await installer.getVersion();
        installedTools[name] = version || 'unknown';
      } else {
        missingTools.push(name);
      }
    });

    await Promise.all(promises);

    return {
      platform: this.platform,
      installedTools,
      missingTools
    };
  }

  /**
   * Install all required tools for a profile
   */
  async installProfile(profile: DeveloperProfile): Promise<{
    success: boolean;
    installed: string[];
    failed: string[];
    errors: Error[];
  }> {
    const installed: string[] = [];
    const failed: string[] = [];
    const errors: Error[] = [];

    // Process installers sequentially to handle dependencies
    for (const [name, installer] of Array.from(this.installers.entries())) {
      try {
        const isInstalled = await installer.isInstalled();
        if (!isInstalled) {
          await installer.install(profile, this.platform);
          if (installer.configure) {
            await installer.configure(profile, this.platform);
          }
          installed.push(name);
        }
      } catch (error) {
        failed.push(name);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return {
      success: failed.length === 0,
      installed,
      failed,
      errors
    };
  }
}

// Export all installers
export * from './homebrew-installer';
export * from './permissions-installer';
export * from './python-installer';
export * from './node-installer';
export * from './docker-installer';
export * from './git-installer';
export * from './mac-installer';
export * from './linux-installer';
export * from './windows-installer';
export { default as RealSetupOrchestrator } from './real-setup-orchestrator';