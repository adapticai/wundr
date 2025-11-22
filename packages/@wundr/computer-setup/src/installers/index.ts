/**
 * Installer Registry - Central hub for managing all platform installers
 */
import claudeInstallerInstance from './claude-installer';
import { DockerInstaller } from './docker-installer';
import { GitInstaller } from './git-installer';
import { HomebrewInstaller } from './homebrew-installer';
import { LinuxInstaller } from './linux-installer';
import { MacInstaller } from './mac-installer';
import { NodeInstaller } from './node-installer';
import { PythonInstaller } from './python-installer';
import { WindowsInstaller } from './windows-installer';

import type {
  SetupPlatform,
  SetupStep,
  DeveloperProfile,
  ProgrammingLanguages,
} from '../types';

/** Node.js configuration type extracted from ProgrammingLanguages */
type NodeConfig = NonNullable<ProgrammingLanguages['node']>;

/** Python configuration type extracted from ProgrammingLanguages */
type PythonConfig = NonNullable<ProgrammingLanguages['python']>;

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
    this.register('claude', claudeInstallerInstance);
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
   * Get installers by category based on installer name patterns.
   * Categories are inferred from installer names:
   * - 'system': homebrew, mac, linux, windows
   * - 'development': git, node, python, docker
   * - 'ai': claude
   * - 'editor': vscode, slack
   */
  getByCategory(category: string): BaseInstaller[] {
    const categoryPatterns: Record<string, string[]> = {
      system: ['homebrew', 'mac', 'linux', 'windows'],
      development: ['git', 'node', 'python', 'docker', 'github'],
      ai: ['claude'],
      editor: ['vscode', 'slack'],
    };

    const patterns = categoryPatterns[category.toLowerCase()];
    if (!patterns) {
      // Unknown category - return empty array
      return [];
    }

    return Array.from(this.installers.entries())
      .filter(([name]) => patterns.some(pattern => name.includes(pattern)))
      .map(([, installer]) => installer);
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

    for (const installer of this.installers.values()) {
      const installerSteps = installer.getSteps(profile, this.platform);
      steps.push(...installerSteps);
    }

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
    if (!installer) {
return [];
}
    return installer.getSteps({} as DeveloperProfile, platform);
  }

  /**
   * Get Node.js setup steps
   */
  async getNodeSteps(nodeConfig: NodeConfig): Promise<SetupStep[]> {
    const installer = this.installers.get('node');
    if (!installer) {
      return [];
    }
    const profile: Partial<DeveloperProfile> = {
      tools: { languages: { node: nodeConfig } },
    };
    return installer.getSteps(profile as DeveloperProfile, this.platform);
  }

  /**
   * Get Python setup steps
   */
  async getPythonSteps(_pythonConfig: PythonConfig): Promise<SetupStep[]> {
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
    if (!installer) {
return [];
}
    return installer.getSteps({} as DeveloperProfile, this.platform);
  }

  /**
   * Get Claude Code setup steps
   */
  async getClaudeCodeSteps(): Promise<SetupStep[]> {
    const installer = this.installers.get('claude');
    if (!installer) {
return [];
}
    return installer.getSteps({} as DeveloperProfile, this.platform);
  }

  /**
   * Get Claude Flow setup steps
   */
  async getClaudeFlowSteps(swarmAgents?: string[]): Promise<SetupStep[]> {
    const installer = this.installers.get('claude');
    if (!installer) {
      return [];
    }
    const profile: Partial<DeveloperProfile> = {
      preferences: {
        aiTools: {
          claudeCode: true,
          claudeFlow: true,
          mcpTools: [],
          swarmAgents: swarmAgents || [],
          memoryAllocation: '4GB',
        },
        shell: 'zsh',
        editor: 'vscode',
        theme: 'dark',
        gitConfig: {
          userName: '',
          userEmail: '',
          signCommits: false,
          defaultBranch: 'main',
          aliases: {},
        },
      },
    };
    return installer.getSteps(profile as DeveloperProfile, this.platform);
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
      } catch {
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
      missingTools,
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
      errors,
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